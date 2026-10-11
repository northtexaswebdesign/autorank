import { test } from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import { findCandidates, chooseLayout, coverCrop, cleanPlan, overlayAccent, buildTokens, buildSvg, svgToJpeg, infographicSvg, PHOTO_CYCLE, DECORS, type CoverSpec, type Photo } from '../api/cover.ts';

// a real (small) JPEG, so the photo layouts render through resvg
const w = 300, h = 200, px = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) px.set([(i % w) % 256, 120, 180, 255], i * 4);
const photo: Photo = { uri: `data:image/jpeg;base64,${Buffer.from(jpeg.encode({ data: px, width: w, height: h }, 80).data).toString('base64')}`, ratio: 1.5, focus: { x: 0.3, y: 0.5 } };

const spec = (extra: Partial<CoverSpec> = {}): CoverSpec => ({ layout: 'editorial', kind: 'guide', tag: 'Window Tint', headline: 'Mobile Window Tinting in Burleson TX', highlight: 'Mobile', points: [], photoQueries: [], alt: 'x', ...extra });
const tokens = buildTokens({ primary: '#E0892B', background: '#F4F2EE', text: '#1B2430' }, 'Montserrat', 'DM Sans');

test('chooseLayout rotates through photo layouts when there is a photo, text layouts otherwise', () => {
  assert.deepEqual(Array.from({ length: PHOTO_CYCLE.length }, (_, n) => chooseLayout(spec({ photo }), n)), PHOTO_CYCLE);
  for (let n = 0; n < 10; n++) assert.ok(!PHOTO_CYCLE.includes(chooseLayout(spec(), n)));
  assert.notEqual(chooseLayout(spec({ headline: 'Do I need a permit' }), 5), 'question'); // no question mark
});

test('coverCrop fills the box and keeps the subject inside it', () => {
  const c = coverCrop(1.5, { x: 0.9, y: 0.5 }, 1080, 1080);
  assert.equal(c.h, 1080);
  assert.equal(c.w, 1620);
  assert.equal(c.dx, -540); // pushed to the right edge, no further
  assert.equal(coverCrop(1.5, { x: 0.5, y: 0.5 }, 1080, 1080).dx, -270);
});

test('overlayAccent stays readable on the dark overlay', () => {
  const dark = buildTokens({ primary: '#1B2430', background: '#FFFFFF', text: '#111111' }, 'Inter', 'Inter');
  assert.equal(overlayAccent(tokens), tokens.accent);
  assert.notEqual(overlayAccent(dark), dark.accent);
});

test('cleanPlan keeps one photo and one valid graphic in different sections', () => {
  const base = { kicker: 'k', title: 'T', alt: 'alt', photoQueries: [], items: [], columns: [], rows: [] };
  const plan = cleanPlan([
    { ...base, section: 1, kind: 'photo', photoQueries: ['car window tint'] },
    { ...base, section: 1, kind: 'steps', items: [{ title: 'a', body: '' }, { title: 'b', body: '' }, { title: 'c', body: '' }] }, // same section
    { ...base, section: 2, kind: 'checklist', items: [{ title: 'a', body: '' }] }, // too few items
    { ...base, section: 3, kind: 'comparison', columns: ['A', 'B'], rows: [{ label: 'x', values: ['1', '2'] }, { label: 'y', values: ['1'] }, { label: 'z', values: ['3', '4'] }] },
    { ...base, section: 4, kind: 'photo', photoQueries: ['x'] }, // second photo
    { ...base, section: 99, kind: 'steps' },
  ], 6);
  assert.deepEqual(plan.map(p => [p.section, p.kind]), [[1, 'photo'], [3, 'comparison']]);
  assert.equal(plan[1].rows.length, 2); // the row with a missing value is dropped
});

test('every layout and pattern renders a JPEG under 200 KB', () => {
  for (const layout of [...PHOTO_CYCLE, 'editorial', 'bold', 'steps', 'centered', 'minimal', 'question', 'number'] as const) {
    const jpg = svgToJpeg(buildSvg(spec({ layout, photo, bigNumber: '7', points: ['One', 'Two', 'Three'] }), tokens, { name: 'Texas Mobile Glass Tinters' }));
    assert.ok(jpg.length > 5_000 && jpg.length <= 200_000, `${layout}: ${jpg.length}`);
  }
  for (const decor of DECORS) assert.ok(svgToJpeg(buildSvg(spec({ layout: 'bold', decor }), tokens, { name: 'B' })).length <= 200_000);
  const g = infographicSvg({ section: 0, kind: 'steps', kicker: 'Step by step', title: 'Install', alt: 'a', photoQueries: [], columns: [], rows: [], items: [{ title: 'Prep', body: 'Clean the glass.' }, { title: 'Cut', body: 'Shrink to fit.' }, { title: 'Cure', body: 'A few days.' }] }, tokens, 'B');
  assert.ok(svgToJpeg(g, 1200).length <= 200_000);
});

test('findCandidates uses Pixabay when its key is set, keeping big photos from its own CDN', async () => {
  const original = globalThis.fetch;
  process.env.PIXABAY_API_KEY = 'k';
  const hit = (id: number, w: number, host = 'cdn.pixabay.com') => ({ id, imageWidth: w, imageHeight: w / 1.5, webformatURL: `https://${host}/t${id}.jpg`, largeImageURL: `https://${host}/l${id}.jpg`, user: 'Ann', user_id: 9, pageURL: `https://pixabay.com/photos/${id}/` });
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => { urls.push(String(url)); return { ok: true, json: async () => ({ hits: [hit(1, 1920), hit(2, 640), hit(3, 1920, 'evil.example'), hit(1, 1920)] }) }; }) as any;
  try {
    const c = await findCandidates(['window tint', 'car window'], 'landscape');
    assert.deepEqual(c.map(x => x.id), ['pb1']);
    assert.equal(c[0].download, 'https://cdn.pixabay.com/l1.jpg');
    assert.equal(c[0].source, 'Pixabay');
    assert.ok(urls[0].includes('orientation=horizontal') && urls[0].includes('q=window%20tint'));
  } finally { globalThis.fetch = original; delete process.env.PIXABAY_API_KEY; }
});
