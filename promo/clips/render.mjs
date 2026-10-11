// Renders one clip frame by frame from the harness (npx vite --config vite.config.mjs must be running).
// node render.mjs <clip> <outDir> [fps] [t1 t2 ...]   (times given = only those frames, as PNG, for checking)
import { chromium } from 'playwright-core';
import fs from 'fs';
const [clip, out, fpsArg, ...times] = process.argv.slice(2);
const FPS = Number(fpsArg || 60), LOOP = 0.5, W = 1120, H = 990, SCALE = 1600 / 1120;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(`http://localhost:5199/?clip=${clip}`);
await page.waitForFunction(() => window.__ready);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const duration = await page.evaluate(() => window.__duration);
const list = times.length ? times.map(Number) : Array.from({ length: Math.round((duration + LOOP) * FPS) }, (_, i) => i / FPS);
let down = false;
// times must be visited in order: the timeline runs forward only
const all = times.length ? Array.from({ length: Math.ceil(Math.max(...list) * 30) + 1 }, (_, i) => i / 30) : list;
for (const t of all) {
  const r = await page.evaluate(t => window.__pre(t), t);
  await page.mouse.move(r.x, r.y);
  if (r.down && !down) await page.mouse.down();
  if (!r.down && down) await page.mouse.up();
  down = r.down;
  await page.evaluate(t => window.__post(t), t);
  if (!times.length) {
    await page.screenshot({ path: `${out}/f${String(list.indexOf(t)).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 94 });
  } else {
    for (const want of list) if (Math.abs(want - t) < 1 / 60) await page.screenshot({ path: `${out}/t${want.toFixed(2)}.png` });
  }
}
await browser.close();
console.log('done', clip, all.length, 'steps');
