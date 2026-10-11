// Prototype renderer for feature-image options (see README). Run from the repo root after npm install:
//   node explorations/feature-images/render.mjs assets/fonts explorations/feature-images/samples
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

const [fontsDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const fontFiles = fs.readdirSync(fontsDir).map(f => path.join(fontsDir, f));
const render = (name, svg, w) => {
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: w } }).render().asPng();
  fs.writeFileSync(path.join(outDir, name + '.png'), png);
  fs.writeFileSync(path.join(outDir, name + '.svg'), svg);
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- brand kits (placeholders until each client's real colours/logo are saved) ----------
const BRANDS = {
  marine: { name: 'Snap-It Products', ink: '#0B2545', accent: '#F2A541', teal: '#13A89E', sky1: '#BFE3EF', sky2: '#F7EBD8', paper: '#F7F2EA', heading: 'Montserrat', body: 'DM Sans' },
  guns:   { name: 'Lone Star Arms', ink: '#1C1D1A', accent: '#E8702A', olive: '#5B6236', tan: '#E9E1CF', paper: '#EFE8D8', heading: 'Space Grotesk', body: 'Inter' },
  therapy:{ name: 'Still Water Counseling', ink: '#2F3E3A', accent: '#D9A38A', sage: '#8FAE96', paper: '#F6F1EA', heading: 'Lora', body: 'DM Sans' },
};

// ---------- text ----------
const W = { 'Montserrat': .66, 'DM Sans': .57, 'Space Grotesk': .6, 'Inter': .58, 'Lora': .57, 'Playfair Display': .6 };
const wrap = (t, size, font, maxW) => { const out = []; let cur = ''; for (const w of t.split(' ')) { const n = cur ? cur + ' ' + w : w; if (cur && n.length * size * W[font] > maxW) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out; };
const lines = (arr, x, y, size, lh, attrs) => arr.map((l, i) => `<text x="${x}" y="${y + i * size * lh}" ${attrs} font-size="${size}">${esc(l)}</text>`).join('');
const grain = (id, op = .06) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${op} 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

// =====================================================================================
// OPTION A: illustrated scene covers (vector motif library per industry + our typography)
// =====================================================================================
const marineScene = (b) => `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.sky1}"/><stop offset="1" stop-color="${b.sky2}"/></linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E7FA0"/><stop offset="1" stop-color="${b.ink}"/></linearGradient>
    <linearGradient id="canvas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F5C7A"/><stop offset="1" stop-color="#174A63"/></linearGradient>
    <clipPath id="card"><rect x="60" y="430" width="960" height="590" rx="36"/></clipPath>
    ${grain('g1', .08)}
  </defs>
  <g clip-path="url(#card)">
    <rect x="60" y="430" width="960" height="590" fill="url(#sky)"/>
    <circle cx="820" cy="560" r="70" fill="${b.accent}" opacity=".9"/>
    <circle cx="820" cy="560" r="110" fill="${b.accent}" opacity=".18"/>
    <path d="M60 690 Q200 640 330 672 T600 662 T1020 676 V720 H60Z" fill="#7FB6A8" opacity=".7"/>
    <rect x="60" y="700" width="960" height="320" fill="url(#sea)"/>
    ${[740, 800, 870, 950].map((y, i) => `<path d="M${60 - i * 40} ${y} q40 -14 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#FFFFFF" stroke-opacity="${.25 - i * .04}" stroke-width="4" fill="none"/>`).join('')}
    <!-- boat -->
    <g transform="translate(150 640)">
      <path d="M0 120 L520 120 Q560 120 600 70 L620 50 L40 50 Q10 50 0 80Z" fill="#FFFFFF"/>
      <path d="M0 120 L520 120 Q560 120 600 70 L606 63 L20 63 Q4 70 0 90Z" fill="#E7EEF2"/>
      <rect x="0" y="108" width="540" height="12" fill="${b.teal}"/>
      <!-- canvas cover, snapped along the gunwale -->
      <path d="M60 52 Q120 -40 300 -46 Q470 -46 560 52Z" fill="url(#canvas)"/>
      <path d="M110 30 Q190 -18 300 -22 Q420 -22 500 30" stroke="#FFFFFF" stroke-opacity=".25" stroke-width="3" fill="none" stroke-dasharray="10 8"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="${80 + i * 58}" cy="52" r="7" fill="#D7DEE3" stroke="#8C9AA5" stroke-width="2"/>`).join('')}
    </g>
    <ellipse cx="450" cy="772" rx="330" ry="14" fill="${b.ink}" opacity=".35"/>
    <!-- snap fastener callout -->
    <line x1="534" y1="692" x2="760" y2="822" stroke="${b.ink}" stroke-width="3" stroke-dasharray="6 6" opacity=".7"/>
    <circle cx="860" cy="880" r="112" fill="${b.paper}" stroke="${b.accent}" stroke-width="8"/>
    <circle cx="860" cy="880" r="62" fill="#C9D2D8"/><circle cx="860" cy="880" r="62" fill="none" stroke="#8C9AA5" stroke-width="6"/>
    <circle cx="860" cy="880" r="34" fill="#E9EEF1" stroke="#8C9AA5" stroke-width="4"/>
    <circle cx="848" cy="868" r="10" fill="#FFFFFF" opacity=".9"/>
    <rect x="60" y="430" width="960" height="590" filter="url(#g1)"/>
  </g>`;

const gunsScene = (b) => `
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3B26B"/><stop offset=".6" stop-color="#E9895A"/><stop offset="1" stop-color="#8C4B3A"/></linearGradient>
    <clipPath id="card"><rect x="60" y="430" width="960" height="590" rx="10"/></clipPath>
    ${grain('g1', .12)}
  </defs>
  <g clip-path="url(#card)">
    <rect x="60" y="430" width="960" height="590" fill="url(#dusk)"/>
    <circle cx="300" cy="700" r="90" fill="#FBE3B8" opacity=".85"/>
    <path d="M60 760 L200 640 L300 710 L430 590 L560 720 L700 620 L860 740 L1020 650 V1020 H60Z" fill="#6E4A3C"/>
    <path d="M60 830 L240 740 L420 820 L600 730 L800 820 L1020 760 V1020 H60Z" fill="${b.olive}"/>
    ${[120, 190, 980, 920].map((x, i) => `<path d="M${x} ${880 - i * 6} l26 -110 l26 110z" fill="#2E3320"/>`).join('')}
    <rect x="60" y="900" width="960" height="120" fill="#3A3F28"/>
    <!-- target stand -->
    <g transform="translate(640 560)">
      <rect x="-8" y="250" width="16" height="140" fill="#2A2A26"/><rect x="164" y="250" width="16" height="140" fill="#2A2A26"/>
      <rect x="-20" y="-10" width="212" height="270" fill="${b.tan}"/>
      ${[100, 80, 60, 40, 20].map((r, i) => `<circle cx="86" cy="125" r="${r}" fill="${i % 2 ? b.tan : b.ink}"/>`).join('')}
      <circle cx="86" cy="125" r="10" fill="${b.accent}"/>
      ${[[80, 118], [98, 132], [70, 140], [92, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#111"/><circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#FFF" stroke-opacity=".5" stroke-width="1.5"/>`).join('')}
    </g>
    <!-- brass -->
    ${[[200, 960, 20], [250, 975, -35], [300, 955, 70], [380, 985, 10]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="0" y="0" width="54" height="16" rx="3" fill="#D8A84E"/><rect x="0" y="0" width="54" height="5" rx="2" fill="#F1CF83"/><rect x="48" y="-1" width="7" height="18" rx="2" fill="#B9893A"/></g>`).join('')}
    <!-- crosshair badge -->
    <g transform="translate(870 520)"><circle r="62" fill="${b.ink}"/><circle r="40" fill="none" stroke="${b.accent}" stroke-width="6"/><path d="M0 -54 V-14 M0 14 V54 M-54 0 H-14 M14 0 H54" stroke="${b.accent}" stroke-width="6" stroke-linecap="round"/></g>
    <rect x="60" y="430" width="960" height="590" filter="url(#g1)"/>
  </g>`;

const therapyScene = (b) => `
  <defs>
    <linearGradient id="calm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3DCCB"/><stop offset="1" stop-color="#F6F1EA"/></linearGradient>
    <clipPath id="card"><rect x="60" y="430" width="960" height="590" rx="300"/></clipPath>
    ${grain('g1', .07)}
  </defs>
  <g clip-path="url(#card)">
    <rect x="60" y="430" width="960" height="590" fill="url(#calm)"/>
    <circle cx="540" cy="700" r="120" fill="${b.accent}" opacity=".85"/>
    <path d="M60 770 Q300 660 540 760 T1020 720 V1020 H60Z" fill="#B9CDBD"/>
    <path d="M60 850 Q340 760 600 850 T1020 820 V1020 H60Z" fill="${b.sage}"/>
    <path d="M60 940 Q380 870 680 950 T1020 930 V1020 H60Z" fill="#6E8F78"/>
    <!-- path to the horizon -->
    <path d="M520 1020 Q560 940 520 880 Q490 830 540 790 L548 792 Q520 830 560 878 Q610 940 620 1020Z" fill="#F6E7D7" opacity=".95"/>
    <!-- bench -->
    <g transform="translate(700 830)" fill="${b.ink}"><rect x="0" y="0" width="120" height="10" rx="4"/><rect x="0" y="-34" width="120" height="8" rx="4"/><rect x="10" y="-34" width="7" height="36"/><rect x="103" y="-34" width="7" height="36"/><rect x="10" y="10" width="8" height="30"/><rect x="102" y="10" width="8" height="30"/></g>
    <!-- leaves -->
    ${[[200, 820, -30], [240, 790, 10], [180, 770, -60], [880, 800, 30], [910, 770, 70]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0 Q30 -40 0 -80 Q-30 -40 0 0Z" fill="#5E7F68"/><path d="M0 0 V-76" stroke="#F6F1EA" stroke-opacity=".4" stroke-width="2"/></g>`).join('')}
    <path d="M260 600 q12 -10 24 0 q12 -10 24 0" stroke="${b.ink}" stroke-width="4" fill="none" opacity=".5"/>
    <path d="M330 560 q9 -8 18 0 q9 -8 18 0" stroke="${b.ink}" stroke-width="3.5" fill="none" opacity=".4"/>
    <rect x="60" y="430" width="960" height="590" filter="url(#g1)"/>
  </g>`;

const illustratedCover = (b, tag, headline, scene, dark = false) => {
  const bg = dark ? b.ink : b.paper, fg = dark ? '#F3EEE2' : b.ink;
  const size = headline.length > 34 ? 76 : 88;
  const hl = wrap(headline, size, b.heading, 940);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${bg}"/>
  <text x="70" y="110" font-family="${b.body}" font-weight="700" font-size="22" letter-spacing="4" fill="${b.accent}">${esc(tag.toUpperCase())}</text>
  ${lines(hl, 70, 110 + 30 + size * .95, size, 1.04, `font-family="${b.heading}" font-weight="700" fill="${fg}"`)}
  ${scene(b)}
  <text x="1010" y="${1080 - 26}" text-anchor="end" font-family="${b.body}" font-weight="700" font-size="20" fill="${fg}" opacity=".7">${esc(b.name)}</text>
  </svg>`;
};

// =====================================================================================
// OPTION C: inline article infographics (Claude extracts JSON from the article, we draw it)
// =====================================================================================
const IW = 1200;
const infoFrame = (b, kicker, title, inner, dark = false) => {
  const bg = dark ? b.ink : b.paper, fg = dark ? '#F5F2EA' : b.ink;
  const tl = wrap(title, 50, b.heading, 1060);
  const top = 150 + (tl.length - 1) * 55 + 50;
  const body = inner(top, fg);
  const IH = Math.round(top + body.h + 110);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${IW}" height="${IH}" viewBox="0 0 ${IW} ${IH}">
  <rect width="${IW}" height="${IH}" fill="${bg}"/>
  <rect x="0" y="0" width="${IW}" height="10" fill="${b.accent}"/>
  <text x="70" y="86" font-family="${b.body}" font-weight="700" font-size="20" letter-spacing="3.5" fill="${b.accent}">${esc(kicker.toUpperCase())}</text>
  ${lines(tl, 70, 150, 50, 1.1, `font-family="${b.heading}" font-weight="700" fill="${fg}"`)}
  ${body.svg}
  <text x="70" y="${IH - 34}" font-family="${b.body}" font-size="18" fill="${fg}" opacity=".6">${esc(b.name)}</text>
  </svg>`;
};

/** comparison: columns of options x rows of attributes (e.g. snap types). */
const comparison = (b, d) => infoFrame(b, d.kicker, d.title, (top, fg) => {
  const cols = d.columns, rowH = 74, labelW = 300, colW = (1060 - labelW) / cols.length;
  const head = cols.map((c, i) => `<rect x="${70 + labelW + i * colW + 6}" y="${top}" width="${colW - 12}" height="70" rx="14" fill="${i === d.highlight ? b.accent : b.ink}"/>
    <text x="${70 + labelW + i * colW + colW / 2}" y="${top + 45}" text-anchor="middle" font-family="${b.heading}" font-weight="700" font-size="26" fill="#FFFFFF">${esc(c)}</text>`).join('');
  const rows = d.rows.map((r, ri) => {
    const y = top + 90 + ri * rowH;
    return `<rect x="70" y="${y}" width="1060" height="${rowH - 10}" rx="12" fill="${ri % 2 ? 'transparent' : (b.tan || '#FFFFFF')}" opacity=".9"/>
      <text x="96" y="${y + 41}" font-family="${b.body}" font-weight="700" font-size="24" fill="${fg}">${esc(r.label)}</text>` +
      r.values.map((v, i) => {
        const cx = 70 + labelW + i * colW + colW / 2;
        if (typeof v === 'number') return Array.from({ length: 5 }, (_, k) => `<circle cx="${cx - 48 + k * 24}" cy="${y + 32}" r="8" fill="${k < v ? (i === d.highlight ? b.accent : (b.teal || b.ink)) : '#CFD6DA'}"/>`).join('');
        return `<text x="${cx}" y="${y + 41}" text-anchor="middle" font-family="${b.body}" font-size="23" fill="${fg}">${esc(v)}</text>`;
      }).join('');
  }).join('');
  return { svg: head + rows, h: 90 + d.rows.length * rowH };
});

/** steps: numbered process with a connecting rail. */
const steps = (b, d, dark) => infoFrame(b, d.kicker, d.title, (top, fg) => {
  const n = d.steps.length, colW = 1060 / n;
  const rail = `<line x1="${70 + colW / 2}" y1="${top + 50}" x2="${70 + colW * (n - .5)}" y2="${top + 50}" stroke="${b.accent}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>`;
  let h = 0;
  const out = rail + d.steps.map((s, i) => {
    const cx = 70 + i * colW + colW / 2;
    const tl = wrap(s.title, 28, b.heading, colW - 30), bl = wrap(s.body, 21, b.body, colW - 34);
    const svgStep = `<circle cx="${cx}" cy="${top + 50}" r="46" fill="${b.accent}"/>
      <text x="${cx}" y="${top + 66}" text-anchor="middle" font-family="${b.heading}" font-weight="700" font-size="44" fill="${b.ink}">${i + 1}</text>
      ${lines(tl, cx, top + 150, 28, 1.15, `text-anchor="middle" font-family="${b.heading}" font-weight="700" fill="${fg}"`)}
      ${lines(bl, cx, top + 160 + tl.length * 32 + 10, 21, 1.4, `text-anchor="middle" font-family="${b.body}" fill="${fg}" opacity=".8"`)}`;
    h = Math.max(h, 160 + tl.length * 32 + 10 + bl.length * 29);
    return svgStep;
  }).join('');
  return { svg: out, h };
}, dark);

/** checklist: large numerals with short items, e.g. a grounding exercise. */
const checklist = (b, d) => infoFrame(b, d.kicker, d.title, (top, fg) => {
  const half = Math.ceil(d.items.length / 2);
  const svg = d.items.map((it, i) => {
    const col = i < half ? 0 : 1, row = col ? i - half : i;
    const x = 70 + col * 540, y = top + row * 112;
    return `<rect x="${x}" y="${y}" width="510" height="96" rx="48" fill="#FFFFFF"/>
      <circle cx="${x + 48}" cy="${y + 48}" r="34" fill="${it.color || b.sage}"/>
      <text x="${x + 48}" y="${y + 61}" text-anchor="middle" font-family="${b.heading}" font-weight="700" font-size="36" fill="#FFFFFF">${esc(it.n)}</text>
      <text x="${x + 100}" y="${y + 44}" font-family="${b.heading}" font-weight="700" font-size="27" fill="${fg}">${esc(it.title)}</text>
      <text x="${x + 100}" y="${y + 74}" font-family="${b.body}" font-size="20" fill="${fg}" opacity=".7">${esc(it.body)}</text>`;
  }).join('');
  return { svg, h: half * 112 - 16 };
});

// =====================================================================================
// OPTION B frame: AI/real photo + brand type. The photo slot here is a flat stand-in.
// =====================================================================================
const photoFrame = (b, tag, headline, photoSvg) => {
  const hl = wrap(headline, 80, b.heading, 900);
  const base = 1080 - 150 - (hl.length - 1) * 84;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="${b.ink}" stop-opacity="0"/><stop offset="1" stop-color="${b.ink}" stop-opacity=".92"/></linearGradient></defs>
  ${photoSvg}
  <rect width="1080" height="1080" fill="url(#shade)"/>
  <rect x="70" y="${base - 120}" width="${tag.length * 15 + 50}" height="44" rx="22" fill="${b.accent}"/>
  <text x="95" y="${base - 91}" font-family="${b.body}" font-weight="700" font-size="20" letter-spacing="3" fill="${b.ink}">${esc(tag.toUpperCase())}</text>
  ${lines(hl, 70, base, 80, 1.05, `font-family="${b.heading}" font-weight="700" fill="#FFFFFF"`)}
  <text x="70" y="1030" font-family="${b.body}" font-weight="700" font-size="22" fill="#FFFFFF" opacity=".85">${esc(b.name)}</text>
  </svg>`;
};

// ---------- render the sample set ----------
const { marine, guns, therapy } = BRANDS;
render('A-marine-cover', illustratedCover(marine, 'Boat Covers', 'How to Replace Boat Cover Snaps Without Drilling', marineScene), 1080);
render('A-guns-cover', illustratedCover(guns, 'Range Day', 'First Range Day Checklist for New Shooters', gunsScene, true), 1080);
render('A-therapy-cover', illustratedCover(therapy, 'Anxiety', 'What Your First Therapy Session Is Really Like', therapyScene), 1080);

render('C-marine-compare', comparison(marine, {
  kicker: 'Quick comparison', title: 'Which boat cover snap should you use?',
  columns: ['Screw stud', 'Adhesive', 'Rivet'], highlight: 1,
  rows: [
    { label: 'No drilling', values: ['No', 'Yes', 'No'] },
    { label: 'Hold strength', values: [5, 3, 4] },
    { label: 'Install time', values: ['10 min', '2 min', '5 min'] },
    { label: 'Best for', values: ['Fiberglass', 'Gelcoat', 'Aluminum'] },
  ],
}), IW);
render('C-guns-steps', steps({ ...guns, tan: '#2A2B27' }, {
  kicker: 'Step by step', title: 'Buying your first handgun at a licensed dealer',
  steps: [
    { title: 'Pick the purpose', body: 'Home defense, carry or sport shapes the size and caliber.' },
    { title: 'Handle a few', body: 'Grip, trigger reach and sights matter more than specs.' },
    { title: 'Form 4473 + NICS', body: 'Fill out the federal form; the dealer runs the check.' },
    { title: 'Train', body: 'Take a safety class and book range time early.' },
  ],
}, true), IW);
render('C-therapy-checklist', checklist(therapy, {
  kicker: 'Try it now', title: 'The 5-4-3-2-1 grounding technique',
  items: [
    { n: '5', title: 'Things you see', body: 'Name them slowly, one by one', color: '#6E8F78' },
    { n: '4', title: 'Things you feel', body: 'Your feet, the chair, your sleeves', color: '#8FAE96' },
    { n: '3', title: 'Things you hear', body: 'Near sounds, then far ones', color: '#D9A38A' },
    { n: '2', title: 'Things you smell', body: 'Or two smells you like', color: '#C98B73' },
    { n: '1', title: 'Thing you taste', body: 'Or one kind thing to yourself', color: '#2F3E3A' },
  ],
}), IW);

// option B stand-ins (flat colour fields where the generated/real photo goes)
const standIn = (c1, c2, label) => `<defs><linearGradient id="ph" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1080" height="1080" fill="url(#ph)"/><text x="540" y="400" text-anchor="middle" font-family="Inter" font-size="30" fill="#FFFFFF" opacity=".6">${esc(label)}</text>`;
render('B-marine-frame', photoFrame(marine, 'Boat Covers', 'How to Replace Boat Cover Snaps Without Drilling', standIn('#5FA8C4', '#0B2545', '[ AI photo: snapped canvas cover on a center console at golden hour ]')), 1080);
