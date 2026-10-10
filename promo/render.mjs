import { chromium } from 'playwright-core';
import fs from 'fs';
fs.mkdirSync('frames',{recursive:true});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + process.cwd() + '/promo.html');
await p.evaluate(() => document.fonts.ready);
const FPS=60,N=900;
for (let i=0;i<N;i++){ await p.evaluate(t=>renderAt(t), i/FPS); await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:95}); }
await b.close(); console.log('done');
