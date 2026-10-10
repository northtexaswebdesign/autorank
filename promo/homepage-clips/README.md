# Homepage "how it works" clips

Four silent, seamlessly looping clips of the current (v2) app UI, to replace the Step 1–4 videos on the homepage.

| File | Step | What happens |
|---|---|---|
| `01-competitive-report` | AI competitive report | Analysis runs (progress modal) → View Report → recommendations and rival breakdowns build in → scroll to competitors |
| `02-keyword-research` | Keyword research | Generate with AI Insights → 17 new keywords stream in (counts tick 12 → 29) → Add to Plan → star → Content Plan filter |
| `03-content-calendar` | Calendar planned for you | Autofill from content plan → 7 posts drop onto Oct 11–17 → today's written draft auto-publishes (dot turns green) |
| `04-written-and-published` | Written daily, auto-published | Article editor: Analyze GEO Score → ring fills to 92 → Publish to WordPress → Published / Live URL |

Each comes as `.mp4` (H.264) and `.webm` (VP9), 1600×1414 (about 8:7, the shape of the old clips' content area), 60 fps, 7.2–7.5 s, plus a `-poster.jpg`.

```html
<video autoplay muted loop playsinline preload="metadata" poster="/clips/01-competitive-report-poster.jpg">
  <source src="/clips/01-competitive-report.webm" type="video/webm">
  <source src="/clips/01-competitive-report.mp4" type="video/mp4">
</video>
```

## Re-rendering after a UI change
`promo/clips/` renders the real components (`AIKeywordsIntelligenceTab`, `KeywordPlannerTab`, `CalendarTab`, `ContentGenerationScreen`, …) with mock data, a virtual clock and a scripted cursor, and films them frame by frame. Network modules are swapped for stand-ins (`promo/clips/mocks`); the featured image comes from the app's own `api/cover.ts`.

```
cd promo/clips
npx tailwindcss@3 -c tailwind.config.cjs -i tw.in.css -o tw.css --minify   # after changing components
npx vite --config vite.config.mjs &                                          # harness on :5199
npm i --no-save playwright-core
node render.mjs keywords frames/keywords                                     # report | keywords | calendar | article
python3 loopenc.py 02-keyword-research frames/keywords ../homepage-clips     # loop crossfade + MP4/WebM/poster
```
