import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import path from 'node:path';

/**
 * Article images: branded covers (1080x1080 JPEG) and in-article images (1200 wide), each under 200 KB.
 *
 * Cover flow:  brand style (saved on the business, else read from its website, else none)
 *        -> Claude writes a small design spec (tag, short headline, key points, article kind, stock-photo
 *           searches, and a palette when there is no brand)
 *        -> Pexels candidates for those searches; Claude looks at the thumbnails, picks the one that fits the
 *           article best and says where its subject is (so crops keep it)
 *        -> a photo layout (rotating per business so neighbouring posts differ) that frames the photo with the
 *           brand: colour panels, duotone, shapes, key points. Text-only layouts are the fallback when no photo
 *           fits or PEXELS_API_KEY is not set. -> SVG -> resvg -> JPEG.
 * Inline flow (body.mode = 'inline'): Claude reads the article's sections and plans up to two images: a photo
 *        for a visual section (picked the same way) and an infographic (steps, comparison or checklist) built
 *        only from facts in that section's text.
 * Claude never writes raw SVG: the layouts are ours, so the result is always clean and on brand. Nothing is
 * drawn per industry: the photo carries the subject, the brand carries the look.
 *
 * Auth: a Supabase user token (Bearer), or the header  x-cron-secret: <CRON_SECRET>  for the auto-publisher.
 * Everything lives in this one file on purpose (relative imports break in the Vercel ESM function).
 */

export const config = { maxDuration: 60 };

const SIZE = 1080;
const MAX_BYTES = 200_000;
const MAX_BODY_BYTES = 40_000;
const MODEL_FAST = process.env.CLAUDE_MODEL_FAST || 'claude-haiku-5-5';

// ---------------- brand style ----------------
export interface BrandStyle {
  primary?: string;      // main accent, e.g. #E59173
  secondary?: string;    // soft accent / panels
  background?: string;   // page background
  text?: string;         // headline colour
  headingFont?: string;  // one of FONTS
  bodyFont?: string;
  logoUrl?: string;
  source?: 'manual' | 'auto';
}

type Palette = { primary: string; secondary?: string; background: string; text: string };

// Fonts bundled in assets/fonts (Regular + Bold of each). `w` = average glyph width in em, used to wrap text.
const FONTS: Record<string, { file: string; serif: boolean; w: number }> = {
  'Inter': { file: 'Inter', serif: false, w: 0.58 },
  'Montserrat': { file: 'Montserrat', serif: false, w: 0.66 },
  'DM Sans': { file: 'DMSans', serif: false, w: 0.57 },
  'Poppins': { file: 'Poppins', serif: false, w: 0.63 },
  'Space Grotesk': { file: 'SpaceGrotesk', serif: false, w: 0.6 },
  'Cormorant Garamond': { file: 'CormorantGaramond', serif: true, w: 0.5 },
  'Playfair Display': { file: 'PlayfairDisplay', serif: true, w: 0.6 },
  'Lora': { file: 'Lora', serif: true, w: 0.57 },
};
const FONT_NAMES = Object.keys(FONTS);
const pickFont = (name: unknown, fallback: string): string => {
  const wanted = String(name || '').toLowerCase().replace(/["']/g, '').split(',')[0].trim();
  return FONT_NAMES.find(f => f.toLowerCase() === wanted) || fallback;
};

// ---------------- colour helpers ----------------
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const cleanHex = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const m = v.trim().match(HEX);
  if (!m) return undefined;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h;
};
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const readableOn = (bg: string) => (lum(bg) > 0.45 ? '#1A1A1A' : '#FFFFFF');

interface Tokens {
  bg: string; surface: string; text: string; muted: string;
  accent: string; accentSoft: string; onAccent: string;
  dark: string; onDark: string;
  heading: string; body: string;
}

export const buildTokens = (p: Palette, headingFont: string, bodyFont: string): Tokens => {
  const bg = p.background;
  const text = contrast(p.text, bg) >= 4.5 ? p.text : readableOn(bg);
  const accent = p.primary;
  const lightBg = lum(bg) > 0.45;
  // a dark colour for the "bold" layout: the brand text colour when it is dark, else a near-black tinted by the accent
  const dark = lum(text) < 0.12 ? text : mix('#0F1220', accent, 0.08);
  return {
    bg,
    surface: lightBg ? '#FFFFFF' : mix(bg, '#FFFFFF', 0.08),
    text,
    muted: mix(text, bg, 0.38),
    accent,
    accentSoft: p.secondary && lum(p.secondary) > 0.6 ? p.secondary : mix(accent, bg, 0.82),
    onAccent: readableOn(accent),
    dark,
    onDark: '#F5F5F5',
    heading: headingFont,
    body: bodyFont,
  };
};

/** The accent (lightened as far as needed) for words over a darkened photo, or white when no tint reads well. */
export const overlayAccent = (t: Tokens): string =>
  [t.accent, mix(t.accent, '#FFFFFF', 0.3), mix(t.accent, '#FFFFFF', 0.55)].find(c => contrast(c, t.dark) >= 4.5) || '#FFFFFF';

// ---------------- text helpers ----------------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textW = (s: string, size: number, font: string, bold = false) =>
  s.length * size * (FONTS[font]?.w ?? 0.6) * (bold ? 1 : 0.93) * (/[A-Z]{3,}/.test(s) ? 1.12 : 1);

const wrap = (text: string, size: number, font: string, maxW: number, bold = true): string[] => {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? cur + ' ' + word : word;
    if (cur && textW(next, size, font, bold) > maxW) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** Largest font size (from max down to min) at which the text fits in maxLines. */
const fit = (text: string, font: string, maxW: number, maxLines: number, max: number, min: number, maxH = 9999, bold = true) => {
  for (let size = max; size >= min; size -= 4) {
    const lines = wrap(text, size, font, maxW, bold);
    if (lines.length <= maxLines && lines.length * size * 1.06 <= maxH) return { size, lines };
  }
  return { size: min, lines: wrap(text, min, font, maxW, bold).slice(0, maxLines) };
};

/** One <text> per line; words inside `highlight` are drawn in the accent colour. */
const headlineSvg = (lines: string[], highlight: string, x: number, y: number, size: number, t: Tokens, fill: string, anchor = 'start', lh = 1.06) => {
  const hl = new Set<string>();
  const hlWords = highlight.toLowerCase().split(/\s+/).filter(Boolean);
  const all = lines.join(' ').toLowerCase().split(/\s+/);
  if (hlWords.length) {
    for (let i = 0; i + hlWords.length <= all.length; i++) {
      if (hlWords.every((w, j) => all[i + j] === w)) { for (let j = 0; j < hlWords.length; j++) hl.add(String(i + j)); break; }
    }
  }
  let idx = 0;
  return lines.map((line, li) => {
    const spans = line.split(' ').map((w, wi, arr) => {
      const on = hl.has(String(idx++));
      return `<tspan fill="${on ? t.accent : fill}">${esc(w)}${wi < arr.length - 1 ? ' ' : ''}</tspan>`;
    }).join('');
    return `<text x="${x}" y="${y + li * size * lh}" font-family="${t.heading}" font-weight="700" font-size="${size}" text-anchor="${anchor}" xml:space="preserve">${spans}</text>`;
  }).join('');
};

// ---------------- design spec & layouts ----------------
export type Layout = 'photo' | 'panel' | 'duotone' | 'window' | 'callout' | 'split' | 'frame'
  | 'editorial' | 'bold' | 'steps' | 'centered' | 'minimal' | 'question' | 'number';
export type ArticleKind = 'howto' | 'list' | 'cost' | 'comparison' | 'question' | 'guide';

/** A stock photo ready to draw: JPEG data URI, its width/height ratio, and where its subject is (0..1). */
export interface Photo { uri: string; ratio: number; focus: { x: number; y: number }; credit?: { name: string; url: string; pageUrl: string } }

export interface CoverSpec {
  layout: Layout;
  kind: ArticleKind;
  tag: string;
  headline: string;
  highlight: string;
  points: string[];
  bigNumber?: string;
  photoQueries: string[];
  photo?: Photo; // set when a fitting stock photo was found
  decor?: Decor; // background pattern for the bold layout
  alt: string;
  palette?: { primary: string; secondary?: string; background: string; text: string; headingFont?: string; bodyFont?: string };
}

/**
 * The orders covers rotate through, one step per article of the same business, so neighbouring posts never look
 * alike. Every cover uses a photo layout when a fitting photo was found; the text layouts are the fallback.
 * A layout is skipped when the article does not suit it.
 */
export const PHOTO_CYCLE: Layout[] = ['panel', 'duotone', 'window', 'callout', 'photo', 'split', 'frame'];
const TEXT_CYCLE: Layout[] = ['editorial', 'steps', 'bold', 'minimal', 'centered', 'question', 'number'];
export const PHOTO_LAYOUTS = new Set<Layout>(PHOTO_CYCLE);

const suits = (l: Layout, s: CoverSpec): boolean => {
  if (PHOTO_LAYOUTS.has(l)) return !!s.photo && (l !== 'window' && l !== 'callout' || s.points.length >= 3);
  if (l === 'number') return !!s.bigNumber;
  if (l === 'question') return /\?\s*$/.test(s.headline);
  if (l === 'steps') return (s.kind === 'howto' || s.kind === 'list') && s.points.length >= 3;
  return true;
};

/** Picks the layout for the nth cover of a business: the next suitable one in the photo cycle, else the text cycle. */
export const chooseLayout = (s: CoverSpec, n: number): Layout => {
  for (const cycle of s.photo ? [PHOTO_CYCLE, TEXT_CYCLE] : [TEXT_CYCLE]) {
    for (let i = 0; i < cycle.length; i++) {
      const l = cycle[(n + i) % cycle.length];
      if (suits(l, s)) return l;
    }
  }
  return 'editorial';
};

interface Brandmark { name: string; logoDataUri?: string; lightLogo?: boolean; logoRatio?: number }

const logoSvg = (b: Brandmark, t: Tokens, x: number, y: number, w: number, h: number, onDarkBg: boolean, anchor: 'start' | 'middle' = 'start') => {
  if (b.logoDataUri) {
    const pad = 12;
    // fit the panel to the logo's shape (a square favicon should not sit in a wide bar)
    if (b.logoRatio) w = Math.round(Math.min(w, Math.max(h, (h - pad * 2) * b.logoRatio + pad * 2)));
  }
  const px = anchor === 'middle' ? x - w / 2 : x;
  if (b.logoDataUri) {
    const pad = 12;
    // a white logo (named "white", "light"...) would vanish on a white panel, so give it a dark one
    return `<rect x="${px}" y="${y}" width="${w}" height="${h}" rx="14" fill="${b.lightLogo ? t.dark : '#FFFFFF'}"/>` +
      `<image x="${px + pad}" y="${y + pad}" width="${w - pad * 2}" height="${h - pad * 2}" preserveAspectRatio="xMidYMid meet" href="${b.logoDataUri}"/>`;
  }
  const size = 34;
  const label = b.name.slice(0, 28);
  return `<text x="${anchor === 'middle' ? x : px}" y="${y + h * 0.62}" font-family="${t.heading}" font-weight="700" font-size="${size}" text-anchor="${anchor}" fill="${onDarkBg ? t.onDark : t.text}">${esc(label)}</text>` +
    `<rect x="${anchor === 'middle' ? x - 36 : px}" y="${y + h * 0.62 + 14}" width="72" height="5" rx="2.5" fill="${t.accent}"/>`;
};

const tagPill = (label: string, t: Tokens, x: number, y: number, fill: string, color: string, anchor: 'start' | 'middle' = 'start') => {
  const txt = label.toUpperCase().slice(0, 24);
  const w = textW(txt, 20, t.body, true) + txt.length * 2.2 + 48;
  const px = anchor === 'middle' ? x - w / 2 : x;
  return `<rect x="${px}" y="${y}" width="${w}" height="46" rx="23" fill="${fill}"/>` +
    `<text x="${px + w / 2}" y="${y + 31}" font-family="${t.body}" font-weight="700" font-size="20" letter-spacing="2" text-anchor="middle" fill="${color}">${esc(txt)}</text>`;
};

/** Where to draw a photo so it fills a w x h box, keeping its subject (focus, 0..1) as close to the middle as the edges allow. */
export const coverCrop = (ratio: number, focus: { x: number; y: number }, w: number, h: number) => {
  const iw = ratio >= w / h ? h * ratio : w;
  const ih = ratio >= w / h ? h : w / ratio;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return { w: iw, h: ih, dx: -clamp(focus.x * iw - w / 2, iw - w), dy: -clamp(focus.y * ih - h / 2, ih - h) };
};

/** The image element for a photo filling a box (no clipping; wrap it in a clip-path). */
const photoImage = (p: Photo, x: number, y: number, w: number, h: number, filter = '') => {
  const c = coverCrop(p.ratio, p.focus, w, h);
  return `<image x="${(x + c.dx).toFixed(1)}" y="${(y + c.dy).toFixed(1)}" width="${c.w.toFixed(1)}" height="${c.h.toFixed(1)}" preserveAspectRatio="none" href="${p.uri}"${filter ? ` filter="url(#${filter})"` : ''}/>`;
};

/** A photo cropped to fill a box (optionally with rounded corners). */
const photoBox = (p: Photo, id: string, x: number, y: number, w: number, h: number, rx = 0) =>
  `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>` +
  `<g clip-path="url(#${id})">${photoImage(p, x, y, w, h)}</g>`;

/** Headline block whose last line sits on `baseline` (for layouts anchored to the bottom). */
const headlineUp = (s: CoverSpec, t: Tokens, fill: string, x: number, baseline: number, maxW: number, maxLines: number, max: number, min: number) => {
  const h = fit(s.headline, t.heading, maxW, maxLines, max, min);
  const first = baseline - (h.lines.length - 1) * h.size * 1.06;
  return { svg: headlineSvg(h.lines, s.highlight, x, first, h.size, t, fill), top: first - h.size * 0.8 };
};

const editorial = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 880, 4, 112, 52, 380);
  const lh = h.size * 1.06;
  const top = 190;
  const bottom = top + h.size * 0.8 + (h.lines.length - 1) * lh + h.size * 0.28;
  const pts = s.points.slice(0, 4);
  const cardH = 24 + 22 + 96 + 20 + pts.length * 43 + 14;
  const cardY = bottom + 50;
  const cy = Math.min(cardY, 1030 - cardH - 10);
  const rows = pts.map((p, i) => {
    const ry = cy + 24 + 22 + 96 + 20 + i * 43;
    return `<rect x="604" y="${ry}" width="28" height="28" rx="8" fill="${t.accentSoft}"/>` +
      `<path d="M611 ${ry + 14} l5 5 l9 -10" stroke="${t.accent}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<text x="646" y="${ry + 22}" font-family="${t.body}" font-weight="400" font-size="21" fill="${mix(t.text, '#FFFFFF', 0.25)}">${esc(p.slice(0, 26))}</text>`;
  }).join('');
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>
  <circle cx="930" cy="130" r="360" fill="${t.accentSoft}"/>
  ${tagPill(s.tag, t, 80, 80, t.text, t.bg)}
  ${headlineSvg(h.lines, s.highlight, 80, top + h.size * 0.8, h.size, t, t.text)}
  <g transform="rotate(3 800 ${cy + cardH / 2})">
    <rect x="580" y="${cy + 12}" width="420" height="${cardH}" rx="20" fill="#000" opacity="0.08"/>
    <rect x="580" y="${cy}" width="420" height="${cardH}" rx="20" fill="${t.surface}"/>
    <circle cx="610" cy="${cy + 26}" r="5.5" fill="${t.accentSoft}"/><circle cx="628" cy="${cy + 26}" r="5.5" fill="${t.accentSoft}"/><circle cx="646" cy="${cy + 26}" r="5.5" fill="${t.accentSoft}"/>
    <rect x="604" y="${cy + 46}" width="372" height="96" rx="14" fill="${t.accent}"/>
    ${rows}
  </g>
  ${logoSvg(b, t, 80, 1080 - 64 - 93, 440, 93, false)}`;
};

/** Brand-coloured background patterns for the bold cover; one per article, rotating, so covers do not repeat. */
export const DECORS = ['orbs', 'rings', 'stripes', 'halftone', 'waves', 'layers', 'arcs', 'grid'] as const;
export type Decor = typeof DECORS[number];

const decorSvg = (d: Decor, t: Tokens): string => {
  const a = t.accent;
  switch (d) {
    case 'rings':
      return Array.from({ length: 6 }, (_, i) => `<circle cx="980" cy="980" r="${140 + i * 90}" fill="none" stroke="${a}" stroke-width="${i === 1 ? 26 : 14}" opacity="${i === 1 ? 0.9 : 0.16}"/>`).join('');
    case 'stripes':
      return `<g transform="rotate(-35 1000 1000)">${Array.from({ length: 7 }, (_, i) => `<rect x="${760 + i * 62}" y="700" width="${i === 3 ? 34 : 18}" height="900" rx="9" fill="${a}" opacity="${i === 3 ? 0.95 : 0.18}"/>`).join('')}</g>`;
    case 'halftone': {
      let out = '';
      for (let r = 0; r < 14; r++) for (let c = 0; c < 14; c++) {
        const k = (r + c) / 26; // bigger dots toward the bottom-right corner
        if (k < 0.35) continue;
        out += `<circle cx="${470 + c * 44}" cy="${470 + r * 44}" r="${(k - 0.3) * 26}" fill="${a}" opacity="0.55"/>`;
      }
      return out;
    }
    case 'waves':
      return Array.from({ length: 7 }, (_, i) => {
        const y = 700 + i * 52;
        return `<path d="M-20 ${y} C 200 ${y - 70}, 380 ${y + 70}, 580 ${y} S 960 ${y - 70}, 1100 ${y}" fill="none" stroke="${a}" stroke-width="${i === 2 ? 12 : 5}" opacity="${i === 2 ? 0.9 : 0.2}"/>`;
      }).join('');
    case 'layers':
      return [0, 1, 2].map(i => `<rect x="${700 + i * 64}" y="${700 + i * 64}" width="400" height="400" rx="36" fill="${i === 2 ? a : mix(a, t.dark, 0.75 - i * 0.2)}"${i === 2 ? ' opacity="0.95"' : ''}/>`).join('');
    case 'arcs':
      return [420, 320, 220, 120].map((r, i) => `<circle cx="1080" cy="1080" r="${r}" fill="${i % 2 ? t.dark : mix(a, t.dark, i === 0 ? 0.7 : 0.15)}"/>`).join('');
    case 'grid': {
      const lines = Array.from({ length: 13 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90}" y2="${SIZE}" stroke="${t.onDark}" stroke-width="1.5" opacity="0.07"/><line x1="0" y1="${i * 90}" x2="${SIZE}" y2="${i * 90}" stroke="${t.onDark}" stroke-width="1.5" opacity="0.07"/>`).join('');
      return lines + `<rect x="810" y="720" width="180" height="180" fill="${a}"/><rect x="720" y="900" width="90" height="90" fill="${a}" opacity="0.35"/><rect x="990" y="630" width="90" height="90" fill="${a}" opacity="0.35"/>`;
    }
    default:
      return `<circle cx="960" cy="100" r="420" fill="${a}" opacity="0.22"/><circle cx="60" cy="1040" r="320" fill="${a}" opacity="0.10"/>`;
  }
};

/** Dark brand background with a pattern, a large headline and the logo (no bullet list: a cover is read in a second). */
const bold = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 880, 4, 112, 56, 420);
  const top = 200;
  const num = s.bigNumber ? `<text x="1040" y="1040" font-family="${t.heading}" font-weight="700" font-size="520" text-anchor="end" fill="${t.accent}" opacity="0.14">${esc(s.bigNumber.slice(0, 3))}</text>` : '';
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  ${decorSvg(s.decor || 'orbs', t)}
  ${num}
  ${tagPill(s.tag, t, 80, 80, t.accent, t.onAccent)}
  <rect x="80" y="${top - 6}" width="64" height="8" rx="4" fill="${t.accent}"/>
  ${headlineSvg(h.lines, s.highlight, 80, top + h.size * 0.95, h.size, t, t.onDark)}
  ${logoSvg(b, t, 80, 1080 - 64 - 93, 440, 93, true)}`;
};

const centered = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 860, 5, 100, 52, 400);
  const lh = h.size * 1.06;
  const top = 230;
  const bottom = top + h.size * 0.8 + (h.lines.length - 1) * lh + h.size * 0.28;
  // chips, wrapped into centred rows
  const chips = s.points.slice(0, 4).map(p => p.slice(0, 26));
  const widths = chips.map(c => textW(c, 24, t.body, false) + 56);
  const rowsOut: { c: string; w: number }[][] = [[]];
  let rowW = 0;
  chips.forEach((c, i) => {
    if (rowW + widths[i] > 900 && rowsOut[rowsOut.length - 1].length) { rowsOut.push([]); rowW = 0; }
    rowsOut[rowsOut.length - 1].push({ c, w: widths[i] }); rowW += widths[i] + 16;
  });
  const cy0 = Math.max(bottom + 60, 700);
  const chipSvg = rowsOut.map((row, ri) => {
    const total = row.reduce((a, r) => a + r.w, 0) + (row.length - 1) * 16;
    let x = SIZE / 2 - total / 2;
    return row.map(r => {
      const out = `<rect x="${x}" y="${cy0 + ri * 66}" width="${r.w}" height="52" rx="26" fill="${t.surface}"/>` +
        `<circle cx="${x + 26}" cy="${cy0 + ri * 66 + 26}" r="7" fill="${t.accent}"/>` +
        `<text x="${x + 44}" y="${cy0 + ri * 66 + 34}" font-family="${t.body}" font-size="24" fill="${t.text}">${esc(r.c)}</text>`;
      x += r.w + 16; return out;
    }).join('');
  }).join('');
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.accentSoft}"/>
  <circle cx="-40" cy="-40" r="330" fill="${t.accent}" opacity="0.22"/>
  <circle cx="1120" cy="1120" r="380" fill="${t.accent}" opacity="0.22"/>
  ${tagPill(s.tag, t, SIZE / 2, 100, t.text, t.surface, 'middle')}
  ${headlineSvg(h.lines, s.highlight, SIZE / 2, top + h.size * 0.8, h.size, t, t.text, 'middle')}
  ${chipSvg}
  ${logoSvg(b, t, SIZE / 2, 1080 - 64 - 93, 440, 93, false, 'middle')}`;
};

/** Full-bleed photo, darkened toward the bottom, headline over it. */
const photo = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const head = headlineUp(s, { ...t, accent: overlayAccent(t) }, '#FFFFFF', 80, 850, 920, 4, 104, 56);
  return `
  <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.dark}" stop-opacity="0.10"/>
    <stop offset="0.42" stop-color="${t.dark}" stop-opacity="0.30"/>
    <stop offset="1" stop-color="${t.dark}" stop-opacity="0.94"/>
  </linearGradient></defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  ${photoBox(s.photo!, 'ph', 0, 0, SIZE, SIZE)}
  <rect width="${SIZE}" height="${SIZE}" fill="url(#shade)"/>
  ${tagPill(s.tag, t, 80, 80, t.accent, t.onAccent)}
  <rect x="80" y="${head.top - 34}" width="72" height="8" rx="4" fill="${t.accent}"/>
  ${head.svg}
  ${logoSvg(b, t, 80, 1080 - 56 - 93, 440, 93, true)}`;
};

/** Photo on top, brand panel below with the headline. */
const split = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const panel = t.dark;
  const h = fit(s.headline, t.heading, 920, 3, 84, 48);
  const y0 = 640 + h.size * 0.8;
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${panel}"/>
  ${photoBox(s.photo!, 'ph', 0, 0, SIZE, 560)}
  <rect x="0" y="556" width="${SIZE}" height="8" fill="${t.accent}"/>
  ${tagPill(s.tag, t, 80, 534, t.accent, t.onAccent)}
  ${headlineSvg(h.lines, s.highlight, 80, y0, h.size, t, t.onDark)}
  ${logoSvg(b, t, 80, 1080 - 48 - 80, 400, 80, true)}`;
};

/** Brand background, headline on top, the photo as a tilted print below. */
const frame = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 900, 3, 88, 48);
  const y0 = 170 + h.size * 0.8;
  const top = 170 + h.lines.length * h.size * 1.06 + 40;
  const ph = Math.min(470, 1080 - 150 - top);
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.accentSoft}"/>
  <circle cx="1000" cy="980" r="300" fill="${t.accent}" opacity="0.25"/>
  ${tagPill(s.tag, t, 80, 80, t.text, t.surface)}
  ${headlineSvg(h.lines, s.highlight, 80, y0, h.size, t, t.text)}
  <g transform="rotate(-3 ${640} ${top + ph / 2})">
    <rect x="${400 - 14}" y="${top - 14 + 10}" width="${600 + 28}" height="${ph + 28}" rx="22" fill="#000" opacity="0.12"/>
    <rect x="${400 - 14}" y="${top - 14}" width="${600 + 28}" height="${ph + 28}" rx="22" fill="#FFFFFF"/>
    ${photoBox(s.photo!, 'ph', 400, top, 600, ph, 12)}
  </g>
  ${logoSvg(b, t, 80, 1080 - 64 - 80, 300, 80, false)}`;
};

/** Full-bleed photo with a solid brand card over its lower part: tag, headline, logo. */
const panel = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 760, 3, 80, 46, 260);
  const lh = h.size * 1.06;
  const cardH = 48 + 46 + 34 + h.size * 0.8 + (h.lines.length - 1) * lh + 44 + 74 + 44;
  const cy = SIZE - 60 - cardH;
  const y0 = cy + 48 + 46 + 34 + h.size * 0.8;
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  ${photoBox(s.photo!, 'ph', 0, 0, SIZE, SIZE)}
  <rect x="60" y="${cy + 14}" width="880" height="${cardH}" rx="26" fill="#000" opacity="0.18"/>
  <rect x="60" y="${cy}" width="880" height="${cardH}" rx="26" fill="${t.surface}"/>
  <rect x="60" y="${cy}" width="14" height="${cardH}" rx="7" fill="${t.accent}"/>
  ${tagPill(s.tag, t, 112, cy + 48, t.accent, t.onAccent)}
  ${headlineSvg(h.lines, s.highlight, 112, y0, h.size, t, t.text)}
  ${logoSvg(b, t, 112, cy + cardH - 44 - 74, 340, 74, false)}`;
};

/** The photo recoloured in two brand colours (shadows dark, highlights a light accent tint), headline below. */
const duotone = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const lo = rgb(t.dark).map(v => (v / 255).toFixed(3));
  const hi = rgb(mix(t.accent, '#FFFFFF', 0.45)).map(v => (v / 255).toFixed(3));
  const head = headlineUp(s, { ...t, accent: overlayAccent(t) }, '#FFFFFF', 80, 880, 920, 4, 100, 54);
  return `
  <defs>
    <filter id="duo" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncR type="table" tableValues="${lo[0]} ${hi[0]}"/><feFuncG type="table" tableValues="${lo[1]} ${hi[1]}"/><feFuncB type="table" tableValues="${lo[2]} ${hi[2]}"/></feComponentTransfer>
    </filter>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.15" stop-color="${t.dark}" stop-opacity="0"/><stop offset="0.7" stop-color="${t.dark}" stop-opacity="0.8"/><stop offset="1" stop-color="${t.dark}" stop-opacity="0.94"/>
    </linearGradient>
    <clipPath id="ph"><rect width="${SIZE}" height="${SIZE}"/></clipPath>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  <g clip-path="url(#ph)">${photoImage(s.photo!, 0, 0, SIZE, SIZE, 'duo')}</g>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#shade)"/>
  <circle cx="940" cy="150" r="130" fill="none" stroke="${t.accent}" stroke-width="14"/>
  <circle cx="940" cy="150" r="60" fill="${t.accent}"/>
  ${logoSvg(b, t, 80, 64, 360, 84, true)}
  <rect x="80" y="${head.top - 30}" width="72" height="8" rx="4" fill="${t.accent}"/>
  ${tagPill(s.tag, t, 80, head.top - 100, t.accent, t.onAccent)}
  ${head.svg}`;
};

/** Brand background, the photo in an arch on the right, key points on the left, headline across the bottom. */
const window_ = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 920, 3, 80, 46, 250);
  const arch = 'M560 700 V300 A220 220 0 0 1 1000 300 V700 Z';
  const dots = Array.from({ length: 24 }, (_, i) => `<circle cx="${96 + (i % 6) * 26}" cy="${560 + Math.floor(i / 6) * 26}" r="5" fill="${t.accent}" opacity="0.55"/>`).join('');
  const rows = s.points.slice(0, 4).map((p, i) => {
    const y = 270 + i * 64;
    return `<circle cx="96" cy="${y - 9}" r="15" fill="${t.accent}"/>` +
      `<path d="M89 ${y - 9} l5 5 l9 -10" stroke="${t.onAccent}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<text x="126" y="${y}" font-family="${t.body}" font-size="27" fill="${t.text}">${esc(p.slice(0, 24))}</text>`;
  }).join('');
  return `
  <defs><clipPath id="arch"><path d="${arch}"/></clipPath></defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${t.accentSoft}"/>
  <path d="M584 724 V324 A220 220 0 0 1 1024 324 V724 Z" fill="${t.accent}"/>
  <g clip-path="url(#arch)"><rect x="560" y="80" width="440" height="620" fill="${t.dark}"/>${photoImage(s.photo!, 560, 80, 440, 620)}</g>
  ${dots}
  ${logoSvg(b, t, 80, 64, 300, 80, false)}
  ${tagPill(s.tag, t, 80, 172, t.text, t.surface)}
  ${rows}
  ${headlineSvg(h.lines, s.highlight, 80, 770 + h.size * 0.8, h.size, t, t.text)}`;
};

/** Full-bleed photo, headline at the top, a tilted card of key points in the corner. */
const callout = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 920, 3, 92, 50, 300);
  const pts = s.points.slice(0, 3);
  const cardH = 40 + 30 + 20 + pts.length * 58 + 20;
  const cy = SIZE - 70 - cardH;
  const rows = pts.map((p, i) => {
    const y = cy + 40 + 30 + 20 + i * 58 + 20;
    return `<rect x="604" y="${y - 24}" width="30" height="30" rx="9" fill="${t.accentSoft}"/>` +
      `<path d="M611 ${y - 9} l5 5 l9 -10" stroke="${t.accent}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<text x="650" y="${y}" font-family="${t.body}" font-size="25" fill="${t.text}">${esc(p.slice(0, 24))}</text>`;
  }).join('');
  return `
  <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.dark}" stop-opacity="0.94"/><stop offset="0.45" stop-color="${t.dark}" stop-opacity="0.6"/><stop offset="0.75" stop-color="${t.dark}" stop-opacity="0.15"/><stop offset="1" stop-color="${t.dark}" stop-opacity="0.3"/>
  </linearGradient></defs>
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  ${photoBox(s.photo!, 'ph', 0, 0, SIZE, SIZE)}
  <rect width="${SIZE}" height="${SIZE}" fill="url(#shade)"/>
  ${tagPill(s.tag, t, 80, 72, t.accent, t.onAccent)}
  ${headlineSvg(h.lines, s.highlight, 80, 170 + h.size * 0.8, h.size, { ...t, accent: overlayAccent(t) }, '#FFFFFF')}
  <g transform="rotate(-2 800 ${cy + cardH / 2})">
    <rect x="580" y="${cy + 12}" width="420" height="${cardH}" rx="20" fill="#000" opacity="0.2"/>
    <rect x="580" y="${cy}" width="420" height="${cardH}" rx="20" fill="${t.surface}"/>
    <text x="604" y="${cy + 58}" font-family="${t.body}" font-weight="700" font-size="20" letter-spacing="2.5" fill="${t.accent}">KEY POINTS</text>
    ${rows}
  </g>
  ${logoSvg(b, t, 80, SIZE - 64 - 80, 300, 80, true)}`;
};

/** Numbered steps for how-to and list articles. */
const steps = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 920, 3, 88, 48);
  const y0 = 190 + h.size * 0.8;
  const startY = 190 + h.lines.length * h.size * 1.06 + 60;
  const pts = s.points.slice(0, 4);
  const gap = Math.min(110, (1080 - 190 - startY) / pts.length);
  const rows = pts.map((p, i) => {
    const y = startY + i * gap;
    return `<rect x="80" y="${y}" width="920" height="${gap - 18}" rx="18" fill="${mix(t.dark, '#FFFFFF', 0.07)}"/>` +
      `<text x="116" y="${y + (gap - 18) / 2 + 14}" font-family="${t.heading}" font-weight="700" font-size="40" fill="${t.accent}">${String(i + 1).padStart(2, '0')}</text>` +
      `<text x="196" y="${y + (gap - 18) / 2 + 11}" font-family="${t.body}" font-size="32" fill="${t.onDark}">${esc(p.slice(0, 34))}</text>`;
  }).join('');
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  <rect x="0" y="0" width="16" height="${SIZE}" fill="${t.accent}"/>
  ${tagPill(s.tag, t, 80, 80, t.accent, t.onAccent)}
  ${headlineSvg(h.lines, s.highlight, 80, y0, h.size, t, t.onDark)}
  ${rows}
  ${logoSvg(b, t, 80, 1080 - 56 - 80, 400, 80, true)}`;
};

/** Typographic: a very large headline and lots of air. */
const minimal = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 900, 5, 128, 60, 640);
  const y0 = 300 + h.size * 0.8;
  const end = 300 + h.lines.length * h.size * 1.06;
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.surface}"/>
  <rect x="80" y="80" width="920" height="3" fill="${t.text}" opacity="0.85"/>
  <text x="80" y="140" font-family="${t.body}" font-weight="700" font-size="22" letter-spacing="4" fill="${t.accent}">${esc(s.tag.toUpperCase().slice(0, 28))}</text>
  ${headlineSvg(h.lines, s.highlight, 80, y0, h.size, t, t.text)}
  <rect x="80" y="${Math.min(end + 30, 880)}" width="160" height="14" fill="${t.accent}"/>
  <rect x="80" y="${1080 - 160}" width="920" height="2" fill="${t.text}" opacity="0.25"/>
  ${logoSvg(b, t, 80, 1080 - 140, 400, 80, false)}`;
};

/** A question headline on the accent colour with a giant question mark. */
const question = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 820, 5, 104, 52, 520);
  const y0 = 260 + h.size * 0.8;
  const ink = t.onAccent;
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.accent}"/>
  <text x="1060" y="1000" font-family="${t.heading}" font-weight="700" font-size="900" text-anchor="end" fill="${ink}" opacity="0.10">?</text>
  ${tagPill(s.tag, t, 80, 100, ink, t.accent)}
  ${headlineSvg(h.lines, '', 80, y0, h.size, t, ink)}
  ${logoSvg(b, { ...t, onDark: ink, text: ink, accent: ink }, 80, 1080 - 64 - 80, 400, 80, lum(t.accent) < 0.45)}`;
};

/** The leading number of a list title, very large. */
const number = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 900, 3, 84, 48);
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>
  <text x="60" y="640" font-family="${t.heading}" font-weight="700" font-size="540" fill="${t.accent}">${esc((s.bigNumber || '').slice(0, 3))}</text>
  ${tagPill(s.tag, t, 80, 80, t.text, t.bg)}
  ${headlineSvg(h.lines, s.highlight, 80, 720 + h.size * 0.8, h.size, t, t.text)}
  ${logoSvg(b, t, 80, 1080 - 56 - 80, 400, 80, lum(t.bg) < 0.45)}`;
};

const RENDERERS: Record<Layout, (s: CoverSpec, t: Tokens, b: Brandmark) => string> = { editorial, bold, centered, photo, panel, duotone, window: window_, callout, split, frame, steps, minimal, question, number };

export const buildSvg = (spec: CoverSpec, tokens: Tokens, brand: Brandmark): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${RENDERERS[spec.layout](spec, tokens, brand)}</svg>`;

let fontFiles: string[] | null = null;
const loadFontFiles = () => (fontFiles ??= Object.values(FONTS).flatMap(f =>
  ['Regular', 'Bold'].map(w => path.join(process.cwd(), 'assets', 'fonts', `${f.file}-${w}.ttf`))));

/** SVG -> JPEG buffer, stepping the quality down until it is under the size limit. */
export const svgToJpeg = (svg: string, width = SIZE): Buffer => {
  const png = new Resvg(svg, {
    font: { fontFiles: loadFontFiles(), loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: width },
  }).render();
  let out = Buffer.alloc(0);
  for (const q of [90, 82, 74, 66, 58, 50, 44, 38]) {
    out = jpeg.encode({ data: png.pixels, width: png.width, height: png.height }, q).data as Buffer;
    if (out.length <= MAX_BYTES) break;
  }
  return out;
};

// ---------------- safe fetching (the website URL comes from users) ----------------
const isPrivateIp = (ip: string): boolean => {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') && isPrivateIp(l.slice(7));
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};

const safeFetch = async (rawUrl: string, maxBytes: number, accept: RegExp, redirects = 3): Promise<{ bytes: Buffer; type: string; url: string } | null> => {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
  const records = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (!records.length || records.some(r => isPrivateIp(r.address))) return null;

  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AutorankBot/1.0 (+brand-style)' } }).catch(() => null);
  if (!res) return null;
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    return redirects > 0 ? safeFetch(new URL(res.headers.get('location')!, url).toString(), maxBytes, accept, redirects - 1) : null;
  }
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!accept.test(type)) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel(); break; }
    chunks.push(value);
  }
  return { bytes: Buffer.concat(chunks), type, url: url.toString() };
};

const toDataUri = async (logoUrl: string): Promise<{ uri: string; ratio?: number } | undefined> => {
  const got = await safeFetch(logoUrl, 600_000, /^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/);
  if (!got || !got.bytes.length) return undefined;
  let ratio: number | undefined;
  try {
    if (got.type === 'image/png') ratio = got.bytes.readUInt32BE(16) / got.bytes.readUInt32BE(20);
    else if (got.type === 'image/jpeg' || got.type === 'image/jpg') { const d = jpeg.decode(got.bytes, { useTArray: true }); ratio = d.width / d.height; }
  } catch { /* unknown shape: use the default wide panel */ }
  return { uri: `data:${got.type};base64,${got.bytes.toString('base64')}`, ratio: ratio && isFinite(ratio) ? ratio : undefined };
};

// ---------------- stock photos (Pexels): search, let Claude pick, download ----------------
export interface Candidate { id: number; thumb: string; original: string; ratio: number; photographer: string; photographerUrl: string; pageUrl: string }

const pexelsHost = (u: string) => { try { return new URL(u).hostname === 'images.pexels.com'; } catch { return false; } };

/** Pexels results for several searches (most specific first), without duplicates, at most `max`. */
export const findCandidates = async (queries: string[], orientation: 'square' | 'landscape', max = 12): Promise<Candidate[]> => {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const search = async (q: string) => {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=${orientation}&per_page=8`, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res?.ok) return [];
    const data = await res.json().catch(() => null);
    return ((data?.photos || []) as any[]).filter(p => p.width >= 1000 && pexelsHost(p.src?.original) && pexelsHost(p.src?.medium));
  };
  const lists = await Promise.all(queries.filter(q => q.trim()).slice(0, 3).map(search));
  const seen = new Set<number>();
  const out: Candidate[] = [];
  // interleave the lists so every search gets a turn before any gets a second one
  for (let i = 0; i < 8 && out.length < max; i++) {
    for (const list of lists) {
      const p = list[i];
      if (!p || seen.has(p.id) || out.length >= max) continue;
      seen.add(p.id);
      out.push({ id: p.id, thumb: p.src.medium, original: p.src.original, ratio: p.width / p.height, photographer: String(p.photographer || ''), photographerUrl: String(p.photographer_url || ''), pageUrl: String(p.url || '') });
    }
  }
  return out;
};

/**
 * Claude looks at the thumbnails and picks the photo that fits the article best, and where its subject is.
 * Returns null when none of them is a decent fit (the caller then uses a text layout or no photo).
 */
export const pickPhoto = async (claude: Anthropic, cands: Candidate[], purpose: string): Promise<{ index: number; focus: { x: number; y: number } } | null> => {
  if (!cands.length) return null;
  try {
    const content: any[] = cands.flatMap((c, i) => [{ type: 'text', text: `Photo ${i}:` }, { type: 'image', source: { type: 'url', url: c.thumb } }]);
    content.push({ type: 'text', text: `These are stock photo candidates for ${purpose}
Pick the one photo that best shows the article's subject to this business's customers. Prefer: real and specific to the topic, attractive, well lit, natural rather than staged, room for a crop. Reject: visible text, watermarks, logos or brand names; screens; anything off topic, cheesy, alarming or that could misrepresent the business (wrong kind of product, place or service). If none is a decent fit, answer -1.
Also give the centre of the photo's main subject as fractions of its width and height (0 to 1), so a crop keeps it.` });
    const res = await claude.messages.create({
      model: MODEL_FAST,
      max_tokens: 400,
      messages: [{ role: 'user', content }],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: { type: 'object', properties: { index: { type: 'integer' }, focusX: { type: 'number' }, focusY: { type: 'number' } }, required: ['index', 'focusX', 'focusY'], additionalProperties: false } },
      },
    } as any);
    const o = JSON.parse(res.content.filter(b => b.type === 'text').map((b: any) => b.text).join(''));
    const index = Number(o.index);
    if (index === -1) return null;
    const f = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.5);
    return Number.isInteger(index) && index >= 0 && index < cands.length ? { index, focus: { x: f(o.focusX), y: f(o.focusY) } } : null;
  } catch (e: any) {
    // vision step failed (a thumbnail would not load, a timeout): use the best search hit, centred
    console.error('photo pick failed', e?.message);
    return { index: 0, focus: { x: 0.5, y: 0.5 } };
  }
};

/** Searches, picks and downloads a photo (about 1400px wide). `skip` drops the first candidates, for a "different image". */
export const stockPhoto = async (claude: Anthropic, queries: string[], orientation: 'square' | 'landscape', purpose: string, skip = 0): Promise<Photo | undefined> => {
  let cands = await findCandidates(queries, orientation);
  if (skip && cands.length > 3) cands = cands.slice(skip % (cands.length - 2));
  const pick = await pickPhoto(claude, cands, purpose);
  if (!pick) return undefined;
  const c = cands[pick.index];
  const u = new URL(c.original);
  const img = await safeFetch(`${u.origin}${u.pathname}?auto=compress&cs=tinysrgb&w=1400`, 1_500_000, /^image\/jpe?g$/);
  if (!img?.bytes.length) return undefined;
  return { uri: `data:image/jpeg;base64,${img.bytes.toString('base64')}`, ratio: c.ratio, focus: pick.focus, credit: { name: c.photographer, url: c.photographerUrl, pageUrl: c.pageUrl } };
};

// ---------------- reading a brand from the website ----------------
const COLOR_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

export const detectBrand = async (siteUrl: string, name: string, claude: Anthropic): Promise<BrandStyle | null> => {
  const page = await safeFetch(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`, 1_500_000, /^text\/html|application\/xhtml/);
  if (!page) return null;
  const html = page.bytes.toString('utf8');
  const abs = (u: string) => { try { return new URL(u, page.url).toString(); } catch { return ''; } };

  // CSS: inline <style> blocks plus the first two linked stylesheets
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)].map(m => m[0].match(/href=["']([^"']+)["']/i)?.[1]).filter(Boolean).slice(0, 2) as string[];
  for (const s of sheets) {
    const got = await safeFetch(abs(s), 400_000, /^text\/css/);
    if (got) css += '\n' + got.bytes.toString('utf8');
  }

  const counts = new Map<string, number>();
  for (const m of (css + html).matchAll(COLOR_RE)) {
    const hex = cleanHex(m[0]);
    if (!hex) continue;
    const [r, g, b] = rgb(hex);
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 25) continue;                       // greys, white, black
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const topColors = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  const themeColor = cleanHex(html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1]);
  const vars = [...css.matchAll(/--[\w-]*(?:primary|brand|accent|secondary|background|bg|text|heading)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6})/gi)].map(m => `${m[0].split(':')[0]}=${m[1]}`).slice(0, 12);
  const fonts = [...new Set([...css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)].map(m => m[1].split(',')[0].replace(/["']/g, '').trim()).filter(f => f && !/^(inherit|initial|sans-serif|serif|system-ui|-apple-system)$/i.test(f)))].slice(0, 8);

  // logo candidates: an <img> that looks like a logo, then touch icon, then favicon
  const logos: string[] = [];
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    if (/logo/i.test(m[0])) { const src = m[0].match(/\ssrc=["']([^"']+)["']/i)?.[1]; if (src && !src.startsWith('data:')) logos.push(abs(src)); }
    if (logos.length >= 2) break;
  }
  for (const rel of ['apple-touch-icon', 'icon']) {
    const tag = html.match(new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*>`, 'i'))?.[0];
    const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) logos.push(abs(href));
  }

  const ask = await claude.messages.create({
    model: MODEL_FAST,
    max_tokens: 500,
    messages: [{ role: 'user', content: `Pick a brand style for the business "${name}" (${siteUrl}) from what we found on its website.
theme-color: ${themeColor || 'none'}
Most used colours (hex, most common first): ${topColors.join(', ') || 'none'}
Colour variables: ${vars.join('; ') || 'none'}
Fonts used: ${fonts.join(', ') || 'none'}
Logo candidates: ${logos.join(' | ') || 'none'}

Return: primary (the main brand/accent colour, never grey), secondary (a soft tint of the brand colour, or empty), background (a light page background, hex), text (the headline colour, hex, readable on the background), headingFont and bodyFont (the closest match from: ${FONT_NAMES.join(', ')}; a serif heading font only if the site's heading font is a serif), logoUrl (the best logo candidate, or empty).` }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', properties: { primary: { type: 'string' }, secondary: { type: 'string' }, background: { type: 'string' }, text: { type: 'string' }, headingFont: { type: 'string' }, bodyFont: { type: 'string' }, logoUrl: { type: 'string' } }, required: ['primary', 'secondary', 'background', 'text', 'headingFont', 'bodyFont', 'logoUrl'], additionalProperties: false } },
    },
  } as any);
  const out = JSON.parse(ask.content.filter(b => b.type === 'text').map((b: any) => b.text).join(''));
  const primary = cleanHex(out.primary) || themeColor || topColors[0];
  if (!primary) return null;
  return {
    primary,
    secondary: cleanHex(out.secondary),
    background: cleanHex(out.background) || '#F7F7F7',
    text: cleanHex(out.text) || '#1A1A1A',
    headingFont: pickFont(out.headingFont, 'Inter'),
    bodyFont: pickFont(out.bodyFont, 'Inter'),
    logoUrl: logos.includes(out.logoUrl) ? out.logoUrl : logos[0],
    source: 'auto',
  };
};

const sanitizeBrand = (b: any): BrandStyle | null => {
  if (!b || typeof b !== 'object') return null;
  const primary = cleanHex(b.primary);
  if (!primary) return null;
  return {
    primary,
    secondary: cleanHex(b.secondary),
    background: cleanHex(b.background),
    text: cleanHex(b.text),
    headingFont: b.headingFont ? pickFont(b.headingFont, 'Inter') : undefined,
    bodyFont: b.bodyFont ? pickFont(b.bodyFont, 'Inter') : undefined,
    logoUrl: typeof b.logoUrl === 'string' && /^https?:\/\//i.test(b.logoUrl) ? b.logoUrl.slice(0, 500) : undefined,
    source: b.source === 'auto' ? 'auto' : 'manual',
  };
};

// ---------------- Claude: the design spec ----------------
const designSpec = async (claude: Anthropic, p: { title: string; keyword: string; businessName: string; description: string; hasBrand: boolean; variant: number }): Promise<CoverSpec> => {
  const res = await claude.messages.create({
    model: MODEL_FAST,
    max_tokens: 900,
    messages: [{ role: 'user', content: `Write the text for the cover image of a blog article.
Article title: "${p.title}"
Target keyword: "${p.keyword}"
Published by: ${p.businessName}${p.description ? ` (${p.description.slice(0, 200)})` : ''}

A cover is read in one second, like a magazine cover, so be short and punchy. Rules: plain words, no em dashes, no emojis.
- headline: a short version of the title, at most 6 words and 45 characters, keeping the main topic (for example "Flower Mound Web Design: What It Costs"). If the title is a question, keep it a question. Never invent numbers.
- highlight: the 1 or 2 consecutive words in the headline that matter most, copied exactly.
- tag: 1 or 2 words naming the topic area (for example "Web Design", "Roofing").
- points: 3 or 4 concrete takeaways, each at most 22 characters.
- bigNumber: the leading number if the title starts with a count (for example "7"), else empty.
- kind: howto (steps or a process), list (a numbered list), cost (prices or budgets), comparison (X vs Y, options), question (the title asks something), or guide (anything else).
- photoQueries: 3 stock photo searches of 2 to 4 words, most specific first, that find a realistic, attractive photo of the subject for this business's customers (real people, places or objects you could photograph; no screens full of text, no abstract ideas, no logos). The last one broader, so it always finds something. For example ["contractor measuring roof", "roofer on house", "house roof"].
- alt: SEO alt text under 125 characters describing the cover.
${p.hasBrand ? 'The brand colours are fixed, so leave the palette fields empty.' : `The business has no brand style, so choose one that fits this topic and industry${p.variant ? ' (try something different from a typical choice)' : ''}: primary = a confident accent colour, secondary = a light tint of it, background = a light background, text = a dark headline colour readable on the background (all hex), headingFont and bodyFont from: ${FONT_NAMES.join(', ')}.`}` }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', properties: { tag: { type: 'string' }, headline: { type: 'string' }, highlight: { type: 'string' }, points: { type: 'array', items: { type: 'string' } }, bigNumber: { type: 'string' }, kind: { type: 'string', enum: ['howto', 'list', 'cost', 'comparison', 'question', 'guide'] }, photoQueries: { type: 'array', items: { type: 'string' } }, alt: { type: 'string' }, primary: { type: 'string' }, secondary: { type: 'string' }, background: { type: 'string' }, text: { type: 'string' }, headingFont: { type: 'string' }, bodyFont: { type: 'string' } }, required: ['tag', 'headline', 'highlight', 'points', 'bigNumber', 'kind', 'photoQueries', 'alt', 'primary', 'secondary', 'background', 'text', 'headingFont', 'bodyFont'], additionalProperties: false } },
    },
  } as any);
  const o = JSON.parse(res.content.filter(b => b.type === 'text').map((b: any) => b.text).join(''));
  const primary = cleanHex(o.primary);
  return {
    layout: 'editorial',
    kind: (['howto', 'list', 'cost', 'comparison', 'question', 'guide'].includes(o.kind) ? o.kind : 'guide') as ArticleKind,
    tag: String(o.tag || '').trim() || 'Guide',
    headline: String(o.headline || p.title).trim().slice(0, 70),
    highlight: String(o.highlight || '').trim(),
    points: (Array.isArray(o.points) ? o.points : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4),
    bigNumber: String(o.bigNumber || '').trim() || undefined,
    photoQueries: (() => { const q = (Array.isArray(o.photoQueries) ? o.photoQueries : []).map((x: any) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 3); return q.length ? q : [p.keyword.slice(0, 60)]; })(),
    alt: String(o.alt || p.title).trim().slice(0, 125),
    palette: primary ? { primary, secondary: cleanHex(o.secondary), background: cleanHex(o.background) || '#F7F7F7', text: cleanHex(o.text) || '#1A1A1A', headingFont: pickFont(o.headingFont, 'Inter'), bodyFont: pickFont(o.bodyFont, 'Inter') } : undefined,
  };
};

// ---------------- in-article images ----------------
const INLINE_W = 1200;
const INLINE_PHOTO_H = 675;

export interface InlinePlan {
  section: number;
  kind: 'photo' | 'steps' | 'comparison' | 'checklist';
  kicker: string;
  title: string;
  alt: string;
  photoQueries: string[];
  items: { title: string; body: string }[];
  columns: string[];
  rows: { label: string; values: string[] }[];
}

/** Keeps only plans the renderers can draw well: at most one photo and one graphic, in different sections. */
export const cleanPlan = (raw: any[], sectionCount: number): InlinePlan[] => {
  const out: InlinePlan[] = [];
  const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
  for (const r of Array.isArray(raw) ? raw : []) {
    const section = Number(r?.section);
    const kind = r?.kind;
    if (!Number.isInteger(section) || section < 0 || section >= sectionCount) continue;
    if (!['photo', 'steps', 'comparison', 'checklist'].includes(kind)) continue;
    if (out.some(o => o.section === section || (o.kind === 'photo') === (kind === 'photo'))) continue;
    const items = (Array.isArray(r.items) ? r.items : []).map((i: any) => ({ title: str(i?.title, 40), body: str(i?.body, 90) })).filter((i: { title: string }) => i.title);
    const columns = (Array.isArray(r.columns) ? r.columns : []).map((c: any) => str(c, 22)).filter(Boolean).slice(0, 4);
    const rows = (Array.isArray(r.rows) ? r.rows : []).map((x: any) => ({ label: str(x?.label, 24), values: (Array.isArray(x?.values) ? x.values : []).map((v: any) => str(v, 26)) }))
      .filter((x: { label: string; values: string[] }) => x.label && x.values.length === columns.length).slice(0, 5);
    const plan: InlinePlan = {
      section, kind, kicker: str(r.kicker, 28), title: str(r.title, 70), alt: str(r.alt, 125),
      photoQueries: (Array.isArray(r.photoQueries) ? r.photoQueries : []).map((q: any) => str(q, 60)).filter(Boolean).slice(0, 3),
      items: items.slice(0, kind === 'steps' ? 5 : 6), columns, rows,
    };
    if (!plan.alt) continue;
    if (kind === 'photo' && !plan.photoQueries.length) continue;
    if ((kind === 'steps' || kind === 'checklist') && (plan.items.length < 3 || !plan.title)) continue;
    if (kind === 'comparison' && (columns.length < 2 || rows.length < 2 || !plan.title)) continue;
    out.push(plan);
  }
  return out.slice(0, 2);
};

/** Claude reads the article's sections and decides which (up to two) get an image, and what goes in it. */
const planInline = async (claude: Anthropic, p: { title: string; keyword: string; about: string; sections: { heading: string; text: string }[] }): Promise<InlinePlan[]> => {
  const list = p.sections.map((s, i) => `[${i}] ${s.heading}\n${s.text}`).join('\n\n');
  const res = await claude.messages.create({
    model: MODEL_FAST,
    max_tokens: 2000,
    messages: [{ role: 'user', content: `Plan up to two images inside a blog article, to make it easier to follow.
Article: "${p.title}" (keyword "${p.keyword}") by ${p.about}.
Its sections (number, heading, start of the text):

${list}

Choose at most one of each, in different sections, and skip the summary, FAQ and conclusion sections:
- one photo for a section whose subject is something you can photograph (a place, a product, people doing the work). photoQueries: 3 stock photo searches of 2 to 4 words, most specific first, the last broader.
- one infographic, only when a section's own text already holds the content: steps (3 to 5 steps of a process, in order), checklist (3 to 6 things to check, bring or do) or comparison (2 to 4 options compared on 2 to 5 points; every row has one value per option). Copy facts from the text; never add numbers, prices, laws or claims that are not in it. Short words: item titles under 32 characters, item bodies under 80, table cells under 24. kicker: 1 to 3 words like "Step by step" or "Quick comparison"; title: what the graphic shows, under 60 characters.
Leave the fields a kind does not use empty. alt: SEO alt text under 125 characters describing the image. Plain words, no em dashes. Return an empty list when nothing fits.` }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', properties: { images: { type: 'array', items: { type: 'object', properties: {
        section: { type: 'integer' }, kind: { type: 'string', enum: ['photo', 'steps', 'comparison', 'checklist'] }, kicker: { type: 'string' }, title: { type: 'string' }, alt: { type: 'string' },
        photoQueries: { type: 'array', items: { type: 'string' } },
        items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'], additionalProperties: false } },
        columns: { type: 'array', items: { type: 'string' } },
        rows: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, values: { type: 'array', items: { type: 'string' } } }, required: ['label', 'values'], additionalProperties: false } },
      }, required: ['section', 'kind', 'kicker', 'title', 'alt', 'photoQueries', 'items', 'columns', 'rows'], additionalProperties: false } } }, required: ['images'], additionalProperties: false } },
    },
  } as any);
  const o = JSON.parse(res.content.filter(b => b.type === 'text').map((b: any) => b.text).join(''));
  return cleanPlan(o.images, p.sections.length);
};

const inlinePhotoSvg = (photo: Photo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${INLINE_W}" height="${INLINE_PHOTO_H}" viewBox="0 0 ${INLINE_W} ${INLINE_PHOTO_H}">` +
  `<rect width="${INLINE_W}" height="${INLINE_PHOTO_H}" fill="#222"/>${photoBox(photo, 'ph', 0, 0, INLINE_W, INLINE_PHOTO_H)}</svg>`;

const linesSvg = (lines: string[], x: number, y: number, size: number, lh: number, attrs: string) =>
  lines.map((l, i) => `<text x="${x}" y="${(y + i * size * lh).toFixed(1)}" ${attrs} font-size="${size}">${esc(l)}</text>`).join('');

/** An on-brand infographic (steps, checklist or comparison), 1200 wide, as tall as its content. */
export const infographicSvg = (p: InlinePlan, t: Tokens, businessName: string): string => {
  const ink = t.text, muted = t.muted;
  const title = wrap(p.title, 48, t.heading, 1060);
  const top = 150 + (title.length - 1) * 54 + 54;
  let body = '';
  let h = 0;
  if (p.kind === 'steps') {
    const n = p.items.length, colW = 1060 / n;
    body = `<line x1="${70 + colW / 2}" y1="${top + 46}" x2="${70 + colW * (n - 0.5)}" y2="${top + 46}" stroke="${t.accent}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>`;
    p.items.forEach((it, i) => {
      const cx = 70 + i * colW + colW / 2;
      const tl = wrap(it.title, 26, t.heading, colW - 28).slice(0, 3);
      const bl = wrap(it.body, 20, t.body, colW - 32, false).slice(0, 5);
      body += `<circle cx="${cx}" cy="${top + 46}" r="42" fill="${t.accent}"/>` +
        `<text x="${cx}" y="${top + 61}" text-anchor="middle" font-family="${t.heading}" font-weight="700" font-size="40" fill="${t.onAccent}">${i + 1}</text>` +
        linesSvg(tl, cx, top + 140, 26, 1.15, `text-anchor="middle" font-family="${t.heading}" font-weight="700" fill="${ink}"`) +
        linesSvg(bl, cx, top + 140 + tl.length * 30 + 8, 20, 1.4, `text-anchor="middle" font-family="${t.body}" fill="${muted}"`);
      h = Math.max(h, 140 + tl.length * 30 + 8 + bl.length * 28);
    });
  } else if (p.kind === 'checklist') {
    const half = Math.ceil(p.items.length / 2), rowH = 112;
    p.items.forEach((it, i) => {
      const col = i < half ? 0 : 1, row = col ? i - half : i;
      const x = 70 + col * 540, y = top + row * rowH;
      const bl = wrap(it.body, 19, t.body, 380, false).slice(0, 2);
      body += `<rect x="${x}" y="${y}" width="510" height="${rowH - 16}" rx="22" fill="${t.surface}"/>` +
        `<circle cx="${x + 46}" cy="${y + 48}" r="26" fill="${t.accent}"/>` +
        `<path d="M${x + 35} ${y + 48} l8 8 l14 -16" stroke="${t.onAccent}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<text x="${x + 90}" y="${y + (bl.length ? 40 : 56)}" font-family="${t.heading}" font-weight="700" font-size="24" fill="${ink}">${esc(it.title)}</text>` +
        linesSvg(bl, x + 90, y + 68, 19, 1.3, `font-family="${t.body}" fill="${muted}"`);
    });
    h = half * rowH - 16;
  } else {
    const cols = p.columns, labelW = 280, colW = (1060 - labelW) / cols.length;
    body = cols.map((c, i) => `<rect x="${70 + labelW + i * colW + 6}" y="${top}" width="${colW - 12}" height="64" rx="14" fill="${t.dark}"/>` +
      `<text x="${70 + labelW + i * colW + colW / 2}" y="${top + 41}" text-anchor="middle" font-family="${t.heading}" font-weight="700" font-size="${cols.length > 3 ? 21 : 24}" fill="${t.onDark}">${esc(c)}</text>`).join('');
    let y = top + 82;
    p.rows.forEach((r, ri) => {
      const cells = r.values.map(v => wrap(v, 21, t.body, colW - 24, false).slice(0, 2));
      const label = wrap(r.label, 22, t.body, labelW - 30).slice(0, 2);
      const rh = Math.max(64, 30 + Math.max(label.length, ...cells.map(c => c.length)) * 28);
      if (ri % 2 === 0) body += `<rect x="70" y="${y}" width="1060" height="${rh}" rx="12" fill="${t.surface}"/>`;
      body += linesSvg(label, 94, y + rh / 2 - (label.length - 1) * 14 + 8, 22, 1.27, `font-family="${t.body}" font-weight="700" fill="${ink}"`);
      cells.forEach((c, i) => { body += linesSvg(c, 70 + labelW + i * colW + colW / 2, y + rh / 2 - (c.length - 1) * 14 + 8, 21, 1.33, `text-anchor="middle" font-family="${t.body}" fill="${ink}"`); });
      y += rh + 6;
    });
    h = y - top;
  }
  const H = Math.round(top + h + 100);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${INLINE_W}" height="${H}" viewBox="0 0 ${INLINE_W} ${H}">
  <rect width="${INLINE_W}" height="${H}" fill="${t.bg}"/>
  <rect width="${INLINE_W}" height="10" fill="${t.accent}"/>
  <text x="70" y="84" font-family="${t.body}" font-weight="700" font-size="20" letter-spacing="3.5" fill="${t.accent}">${esc((p.kicker || 'At a glance').toUpperCase())}</text>
  ${linesSvg(title, 70, 146, 48, 1.12, `font-family="${t.heading}" font-weight="700" fill="${ink}"`)}
  ${body}
  <text x="70" y="${H - 36}" font-family="${t.body}" font-size="18" fill="${muted}">${esc(businessName.slice(0, 60))}</text>
  </svg>`;
};

// ---------------- request handling ----------------
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let admin: SupabaseClient | null = null;
const getAdmin = (): SupabaseClient | null => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (admin ??= createClient(url, key, { auth: { persistSession: false } }));
};

const authenticate = async (request: Request): Promise<{ userId: string | null; cron: boolean } | null> => {
  const cronSecret = process.env.CRON_SECRET;
  const sent = request.headers.get('x-cron-secret');
  if (cronSecret && sent && sent === cronSecret) return { userId: null, cron: true };
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.id === 'string' ? { userId: user.id, cron: false } : null;
};

const hits = new Map<string, number[]>();
const rateLimited = (key: string) => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 20;
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  const auth = await authenticate(request);
  if (!auth) return json(401, { error: 'Not authenticated.' });
  if (rateLimited(auth.userId || 'cron')) return json(429, { error: 'Too many requests. Please slow down.' });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large.' });
  let body: any;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid JSON.' }); }

  const title = String(body.title || body.keyword || '').slice(0, 200).trim();
  if (!title) return json(400, { error: 'title is required.' });
  const keyword = String(body.keyword || title).slice(0, 200).trim();
  const businessName = String(body.businessName || '').slice(0, 100).trim();
  const description = String(body.description || '').slice(0, 400);
  const siteUrl = String(body.businessUrl || '').slice(0, 300).trim();
  const businessId = typeof body.businessId === 'string' ? body.businessId : '';
  const variant = Math.abs(Number(body.variant) || 0);

  const db = getAdmin();
  // a signed-in user needs an active plan (same rule as stock photos); the auto-publisher is already gated
  if (auth.userId && db) {
    const { data: profile } = await db.from('profiles').select('plan_status').eq('id', auth.userId).maybeSingle();
    if (!profile || !['trial', 'paid'].includes(profile.plan_status)) return json(402, { error: 'Your plan has expired. Please upgrade to continue.' });
  }

  const claude = new Anthropic();
  try {
    // 1. brand: saved on the business, else read from its website (and saved for next time)
    let brand = sanitizeBrand(body.brandStyle);
    let detected: BrandStyle | null = null;
    // never overwrite something the user saved by hand (even a partial one)
    const hasSaved = !!body.brandStyle && typeof body.brandStyle === 'object' && Object.values(body.brandStyle).some(v => v);
    if (!brand && siteUrl) {
      brand = await detectBrand(siteUrl, businessName, claude).catch(e => { console.error('brand detect failed', e?.message); return null; });
      detected = brand;
      if (brand && businessId && db && !hasSaved) {
        let q = db.from('businesses').update({ brand_style: brand }).eq('id', businessId);
        if (auth.userId) q = q.eq('user_id', auth.userId);
        await q.then(() => {}, () => {}); // best effort (the column may not exist yet)
      }
    }
    const about = `${businessName || 'a local business'}${description ? ` (${description.slice(0, 150)})` : ''}`;

    if (body.mode === 'inline') {
      const sections = (Array.isArray(body.sections) ? body.sections : []).slice(0, 12)
        .map((x: any) => ({ heading: String(x?.heading || '').slice(0, 140).trim(), text: String(x?.text || '').slice(0, 700).trim() }))
        .filter((x: { heading: string }) => x.heading);
      if (sections.length < 2) return json(200, { images: [], brandStyle: detected });
      const tokens = brandTokens(brand);
      const plan = await planInline(claude, { title, keyword, about, sections });
      const images = (await Promise.all(plan.map(async (item) => {
        try {
          if (item.kind === 'photo') {
            const photo = await stockPhoto(claude, item.photoQueries, 'landscape', `a photo inside the article "${title}" (keyword "${keyword}") by ${about}, for its section "${sections[item.section].heading}".`, variant);
            if (!photo) return null;
            const jpg = svgToJpeg(inlinePhotoSvg(photo), INLINE_W);
            return { base64: jpg.toString('base64'), alt: item.alt, heading: sections[item.section].heading, kind: item.kind, caption: photo.credit?.name ? `Photo: ${photo.credit.name} / Pexels` : undefined, creditUrl: photo.credit?.pageUrl || undefined };
          }
          const jpg = svgToJpeg(infographicSvg(item, tokens, businessName), INLINE_W);
          return { base64: jpg.toString('base64'), alt: item.alt, heading: sections[item.section].heading, kind: item.kind };
        } catch (e: any) {
          console.error('inline image failed', item.kind, e?.message);
          return null;
        }
      }))).filter(Boolean);
      return json(200, { images, brandStyle: detected });
    }

    // 2. design spec from Claude
    const spec = await designSpec(claude, { title, keyword, businessName, description, hasBrand: !!brand, variant });
    if (spec.points.length < 3) spec.points = ['Clear next steps', 'Local focus', 'Proven approach'].slice(0, 3);

    // 3. a stock photo Claude picked for this article; without one the cover uses a text layout
    spec.photo = await stockPhoto(claude, spec.photoQueries, 'square', `the cover image of the article "${title}" (keyword "${keyword}") by ${about}.`, variant).catch(() => undefined);

    // layout: rotate per business (its article count), so neighbouring covers differ
    let n = Math.abs(hashCode(title));
    if (businessId && db) {
      const { count } = await db.from('posts').select('id', { count: 'exact', head: true }).eq('business_id', businessId).then(r => r, () => ({ count: null }));
      if (typeof count === 'number') n = count;
    }
    spec.layout = chooseLayout(spec, n + variant);
    spec.decor = DECORS[Math.abs(n + variant + hashCode(title)) % DECORS.length];

    // 4. tokens: brand colours/fonts, else the palette Claude chose, else a neutral default
    const tokens = brandTokens(brand, spec.palette);
    const logo = brand?.logoUrl ? await toDataUri(brand.logoUrl).catch(() => undefined) : undefined;
    const jpg = svgToJpeg(buildSvg(spec, tokens, { name: businessName || 'Your Brand', logoDataUri: logo?.uri, logoRatio: logo?.ratio, lightLogo: /white|light|inverse|reverse/i.test(brand?.logoUrl || '') }));
    if (jpg.length > MAX_BYTES) return json(502, { error: 'Could not produce a cover under the size limit.' });

    return json(200, { base64: jpg.toString('base64'), alt: spec.alt, width: SIZE, height: SIZE, bytes: jpg.length, layout: spec.layout, brandStyle: detected, photoCredit: spec.photo?.credit });
  } catch (err: any) {
    console.error('cover error', err?.message);
    return json(502, { error: body.mode === 'inline' ? 'Could not generate article images.' : 'Could not generate a cover image.' });
  }
}

/** Design tokens from the brand, else a palette Claude chose, else a neutral default. */
const brandTokens = (brand: BrandStyle | null, palette?: CoverSpec['palette']): Tokens => {
  const pal = brand ? { primary: brand.primary!, secondary: brand.secondary, background: brand.background || '#F7F7F7', text: brand.text || '#1A1A1A' }
    : palette ? { primary: palette.primary, secondary: palette.secondary, background: palette.background, text: palette.text }
    : { primary: '#2563EB', secondary: undefined, background: '#F7F7F7', text: '#1A1A1A' };
  return buildTokens(pal, brand?.headingFont || palette?.headingFont || 'Inter', brand?.bodyFont || palette?.bodyFont || 'Inter');
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
