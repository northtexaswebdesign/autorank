# Autorank AI

Automated GEO content platform: analyzes a business, builds a keyword plan, and writes/publishes long-form articles built to be cited by AI search engines.

Stack: Vite + React + TypeScript, Supabase (auth/DB/edge functions), Claude API via Vercel serverless functions, deployed on Vercel.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values
3. `npm run dev`

## Article images
Every article gets a branded 1080x1080 cover and up to two in-article images (1200 wide), all JPEGs under 200 KB, from
`api/cover.ts`. Brand style: the one saved on the business (Business Info tab), else colors/fonts/logo read from its
website (saved back as `businesses.brand_style`), else a look Claude picks for the topic. Fonts live in `assets/fonts`
(bundled into the function via `vercel.json`).
- Cover: Claude writes three stock photo searches (Pixabay when `PIXABAY_API_KEY` is set, else Pexels), looks at the candidate thumbnails and picks the best fit and where its
  subject is; the photo is framed with the brand in one of 7 photo layouts, rotating per business. With no fitting
  photo (or no stock photo key) a text layout with one of 8 brand patterns is used. No bullet lists on covers.
- In-article (`mode: 'inline'`): Claude reads the H2 sections and plans at most one photo (credited "Photo: name /
  Pixabay" or "Pexels", linked) and one infographic (steps, checklist or comparison) built only from that section's text. They go
  in as `[IMAGE_2]`/`[IMAGE_3]` placeholders after the section's first paragraph and are published as `<figure>`s
  (`supabase/functions/_shared/inlineImages.ts`). The auto-publisher adds them to articles it writes itself.
- Pixabay or Pexels (not Unsplash): their licenses allow editing photos into covers; Unsplash's API requires hotlinking.
- Vercel env: `PIXABAY_API_KEY` (or `PEXELS_API_KEY`); `CRON_SECRET` (same value as the Supabase function secret) so the auto-publisher can call `/api/cover`.
- Supabase function secret `APP_URL` (optional, defaults to https://autorank-umber.vercel.app).
- Apply `supabase/migrations/20261008010000_add_business_brand_style.sql` before deploying (adds `businesses.brand_style`).

## Article quality pipeline
Generated articles (manual, rewrite and auto-publish) share `supabase/functions/_shared/articleQuality.ts`:
- Prompt rules (topic-agnostic): keyword budget, credible-source rules, answer-first structure, no invented experience or quotes.
- Link verification: outside links the web search never returned, blocked hosts (forums/social) and dead pages are removed. The web app does this through `/api/claude` (`action: 'verify-links'`, which carries its own copy of the checks because relative imports break in the Vercel function).
- Lint: keyword stuffing, leaked meta-text, unsourced figures, missing summary/FAQ/Sources, meta lengths. Errors trigger one targeted repair edit; the rest show up as editor feedback.
- At publish: a visible "Last updated" line and Article + FAQPage JSON-LD (WordPress strips `<script>` for users without unfiltered HTML).
Run the tests with `npm test`. Redeploy the `autopublish-function` edge function after pulling this change.

## Limits
- AI competitive analysis: 1 per business per calendar month (UTC). `api/claude.ts` (`action: 'competitor-quota'`) stamps `businesses.competitor_analyzed_at` with the service role; a trigger stops signed-in users from editing it. If every research step fails the run is given back. **Apply `supabase/migrations/20261009000000_competitor_analysis_monthly_limit.sql` before deploying**, otherwise the analysis reports that the limit could not be checked.
