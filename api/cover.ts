import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import path from 'node:path';

/**
 * Branded cover (featured) images for blog articles: 1080x1080 JPEG under 200 KB.
 *
 * Flow:  brand style (saved on the business, else read from its website, else none)
 *        -> Claude writes a small design spec (layout, tag, headline, key points, and a palette
 *           when there is no brand) -> we render it as SVG -> resvg -> JPEG.
 * Claude never writes raw SVG: the layout is ours, so the result is always clean and on brand.
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

const buildTokens = (p: Palette, headingFont: string, bodyFont: string): Tokens => {
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
export interface CoverSpec {
  layout: 'editorial' | 'bold' | 'centered';
  tag: string;
  headline: string;
  highlight: string;
  points: string[];
  bigNumber?: string;
  alt: string;
  palette?: { primary: string; secondary?: string; background: string; text: string; headingFont?: string; bodyFont?: string };
}
const LAYOUTS: CoverSpec['layout'][] = ['editorial', 'bold', 'centered'];

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

const bold = (s: CoverSpec, t: Tokens, b: Brandmark) => {
  const h = fit(s.headline, t.heading, 900, 5, 108, 52, 420);
  const lh = h.size * 1.06;
  const top = 190;
  const bottom = top + h.size * 0.95 + (h.lines.length - 1) * lh + h.size * 0.28;
  const pts = s.points.slice(0, 4);
  const py = bottom + 70;
  const rows = pts.map((p, i) =>
    `<circle cx="96" cy="${py + i * 62 - 9}" r="9" fill="${t.accent}"/>` +
    `<text x="124" y="${py + i * 62}" font-family="${t.body}" font-weight="400" font-size="34" fill="${mix(t.onDark, t.dark, 0.18)}">${esc(p.slice(0, 34))}</text>`).join('');
  const num = s.bigNumber ? `<text x="1040" y="1040" font-family="${t.heading}" font-weight="700" font-size="520" text-anchor="end" fill="${t.accent}" opacity="0.14">${esc(s.bigNumber.slice(0, 3))}</text>` : '';
  return `
  <rect width="${SIZE}" height="${SIZE}" fill="${t.dark}"/>
  <circle cx="960" cy="100" r="420" fill="${t.accent}" opacity="0.22"/>
  <circle cx="60" cy="1040" r="320" fill="${t.accent}" opacity="0.10"/>
  ${num}
  ${tagPill(s.tag, t, 80, 80, t.accent, t.onAccent)}
  <rect x="80" y="${top - 6}" width="64" height="8" rx="4" fill="${t.accent}"/>
  ${headlineSvg(h.lines, s.highlight, 80, top + h.size * 0.95, h.size, t, t.onDark)}
  ${rows}
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

const RENDERERS = { editorial, bold, centered };

export const buildSvg = (spec: CoverSpec, tokens: Tokens, brand: Brandmark): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${RENDERERS[spec.layout](spec, tokens, brand)}</svg>`;

let fontFiles: string[] | null = null;
const loadFontFiles = () => (fontFiles ??= Object.values(FONTS).flatMap(f =>
  ['Regular', 'Bold'].map(w => path.join(process.cwd(), 'assets', 'fonts', `${f.file}-${w}.ttf`))));

/** SVG -> JPEG buffer, stepping the quality down until it is under the size limit. */
export const svgToJpeg = (svg: string): Buffer => {
  const png = new Resvg(svg, {
    font: { fontFiles: loadFontFiles(), loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: SIZE },
  }).render();
  let out = Buffer.alloc(0);
  for (const q of [90, 82, 74, 66, 58, 50]) {
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
const designSpec = async (claude: Anthropic, p: { title: string; keyword: string; businessName: string; description: string; hasBrand: boolean; layout: CoverSpec['layout']; variant: number }): Promise<CoverSpec> => {
  const res = await claude.messages.create({
    model: MODEL_FAST,
    max_tokens: 900,
    messages: [{ role: 'user', content: `Design the cover image for a blog article.
Article title: "${p.title}"
Target keyword: "${p.keyword}"
Published by: ${p.businessName}${p.description ? ` (${p.description.slice(0, 200)})` : ''}

The cover is a square graphic with a short category tag, a big headline, and 3 or 4 short key points. Layout is already chosen: "${p.layout}".
Rules: plain words, no em dashes, no emojis. headline = the article title, shortened to at most 70 characters if needed (keep the meaning and the main keyword). highlight = the 1 to 3 consecutive words in the headline that matter most (copied exactly as written there). tag = 1 to 3 words naming the topic area (for example "Web Design", "Roofing Tips"). points = 3 or 4 concrete takeaways from the article topic, each at most 24 characters. bigNumber = the leading number if the title starts with a count (for example "7"), else empty. alt = SEO alt text under 125 characters describing the cover.
${p.hasBrand ? 'The brand colours are fixed, so leave the palette fields empty.' : `The business has no brand style, so choose one that fits this topic and industry${p.variant ? ' (try something different from a typical choice)' : ''}: primary = a confident accent colour, secondary = a light tint of it, background = a light background, text = a dark headline colour readable on the background (all hex), headingFont and bodyFont from: ${FONT_NAMES.join(', ')}.`}` }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', properties: { tag: { type: 'string' }, headline: { type: 'string' }, highlight: { type: 'string' }, points: { type: 'array', items: { type: 'string' } }, bigNumber: { type: 'string' }, alt: { type: 'string' }, primary: { type: 'string' }, secondary: { type: 'string' }, background: { type: 'string' }, text: { type: 'string' }, headingFont: { type: 'string' }, bodyFont: { type: 'string' } }, required: ['tag', 'headline', 'highlight', 'points', 'bigNumber', 'alt', 'primary', 'secondary', 'background', 'text', 'headingFont', 'bodyFont'], additionalProperties: false } },
    },
  } as any);
  const o = JSON.parse(res.content.filter(b => b.type === 'text').map((b: any) => b.text).join(''));
  const primary = cleanHex(o.primary);
  return {
    layout: p.layout,
    tag: String(o.tag || '').trim() || 'Guide',
    headline: String(o.headline || p.title).trim().slice(0, 90),
    highlight: String(o.highlight || '').trim(),
    points: (Array.isArray(o.points) ? o.points : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4),
    bigNumber: String(o.bigNumber || '').trim() || undefined,
    alt: String(o.alt || p.title).trim().slice(0, 125),
    palette: primary ? { primary, secondary: cleanHex(o.secondary), background: cleanHex(o.background) || '#F7F7F7', text: cleanHex(o.text) || '#1A1A1A', headingFont: pickFont(o.headingFont, 'Inter'), bodyFont: pickFont(o.bodyFont, 'Inter') } : undefined,
  };
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

    // 2. design spec from Claude
    const layout = LAYOUTS[(Math.abs(hashCode(title)) + variant) % LAYOUTS.length];
    const spec = await designSpec(claude, { title, keyword, businessName, description, hasBrand: !!brand, layout, variant });
    if (spec.points.length < 3) spec.points = ['Clear next steps', 'Local focus', 'Proven approach'].slice(0, 3);

    // 3. tokens: brand colours/fonts, else the palette Claude chose, else a neutral default
    const pal = brand ? { primary: brand.primary!, secondary: brand.secondary, background: brand.background || '#F7F7F7', text: brand.text || '#1A1A1A' }
      : spec.palette ? { primary: spec.palette.primary, secondary: spec.palette.secondary, background: spec.palette.background, text: spec.palette.text }
      : { primary: '#2563EB', secondary: undefined, background: '#F7F7F7', text: '#1A1A1A' };
    const heading = brand?.headingFont || spec.palette?.headingFont || 'Inter';
    const bodyFont = brand?.bodyFont || spec.palette?.bodyFont || 'Inter';
    const tokens = buildTokens(pal, heading, bodyFont);

    const logo = brand?.logoUrl ? await toDataUri(brand.logoUrl).catch(() => undefined) : undefined;
    const jpg = svgToJpeg(buildSvg(spec, tokens, { name: businessName || 'Your Brand', logoDataUri: logo?.uri, logoRatio: logo?.ratio, lightLogo: /white|light|inverse|reverse/i.test(brand?.logoUrl || '') }));
    if (jpg.length > MAX_BYTES) return json(502, { error: 'Could not produce a cover under the size limit.' });

    return json(200, { base64: jpg.toString('base64'), alt: spec.alt, width: SIZE, height: SIZE, bytes: jpg.length, layout: spec.layout, brandStyle: detected });
  } catch (err: any) {
    console.error('cover error', err?.message);
    return json(502, { error: 'Could not generate a cover image.' });
  }
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
