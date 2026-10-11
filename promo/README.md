# Autorank promo (15 s)

`autorank_promo.mp4`: 1920x1080, 60 fps, H.264 + AAC, loudness-normalised to -14 LUFS.

## Script
| Time | Beat | On screen |
|---|---|---|
| 0.0–2.5 | Hook | "Your customers stopped searching." (strike-through) → "They ask *AI.*", with ChatGPT / Perplexity / AI Overviews / Claude chips |
| 2.5–4.5 | Drop + logo | Orange and canvas wipe, the mark springs in, the A draws, the dot pops, "autorank" + "Grow your organic traffic on *autopilot.*" |
| 4.5–7.0 | 01 Analyze | URL typed, site scanned, GEO score counts to 94, competitor and keyword-gap metrics |
| 7.0–9.5 | 02 Plan | Pillar "Roof replacement" with cluster keywords flying in; the one to write gets picked |
| 9.5–12.0 | 03 Write & publish | Cover + article build, quality checks pop, the week fills in, "Published" stamp |
| 12.0–13.5 | Cited | "Who's the best roofer near me?" → AI answer citing yourbusiness.com |
| 13.5–15.0 | End card | autorank: "Get found — and cited — by *AI search.*" + "Start your 5-day free trial", "3 free articles · autorank-ai.com" |

Brand comes from the app: canvas `#F4F3EF`, ink `#111214`, accent `#EA580C`, Geist + Instrument Serif, the `LogoMark` A.

## Rebuild
Music (120 BPM, A minor, house groove with sidechain) and every sound effect are synthesised in `audio.py`, timed to the animation in `promo.html` (`renderAt(t)`).
```
npm i playwright-core            # Chromium path is set in render.mjs
node render.mjs                  # -> frames/ (900 JPEGs)
pip install numpy scipy && python3 audio.py   # -> audio.wav
ffmpeg -framerate 60 -i frames/f%04d.jpg -i audio.wav -af "lowpass=f=16000,loudnorm=I=-14:TP=-1:LRA=7" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k -shortest autorank_promo.mp4
```
Fonts: Geist, Geist Mono and Instrument Serif (SIL OFL), from @fontsource.
