# Autorank AI

Automated GEO content platform: analyzes a business, builds a keyword plan, and writes/publishes long-form articles built to be cited by AI search engines.

Stack: Vite + React + TypeScript, Supabase (auth/DB/edge functions), Claude API via Vercel serverless functions, deployed on Vercel.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values
3. `npm run dev`

## Cover images
Every article gets a branded 1080x1080 cover (JPEG under 200 KB) from `api/cover.ts`: the brand style saved on the business
(Business Info tab), else colors/fonts/logo read from its website (saved back as `businesses.brand_style`), else a look
Claude picks for the topic. Fonts live in `assets/fonts` (bundled into the function via `vercel.json`).
- Vercel env: `CRON_SECRET` (same value as the Supabase function secret) so the auto-publisher can call `/api/cover`.
- Supabase function secret `APP_URL` (optional, defaults to https://autorank-umber.vercel.app).
- Apply `supabase/migrations/20261008010000_add_business_brand_style.sql` before deploying (adds `businesses.brand_style`).
- `PEXELS_API_KEY` is now only a fallback if a cover cannot be made.
