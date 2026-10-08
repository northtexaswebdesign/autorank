# Supabase (project `thyfuwjcntzmlkudoqhw`, AutoRankAI)

The export's schema/migration/config files were corrupted, so the live project is the source of truth.
Tables (all RLS-enabled): businesses, keywords, posts, cms_integrations, activity_logs, profiles. Storage bucket: `articles`.

## Applied to the live project on 2026-10-08
1. `migrations/20261008000000_harden_profiles_and_security_definer_functions.sql` (applied). Clients can now only update
   `profiles.full_name`; `get_all_users()` admin check fixed; anon access and trigger-function RPC access revoked.
2. `functions/autopublish-function` deployed (v31): Claude instead of Gemini/Imagen, text-only, max 10 posts per run,
   requires header `x-cron-secret`. pg_cron job 55 now reads that secret from Vault (`cron_secret`), so the service-role key
   is no longer in the cron command.
   **Still required:** add Edge Function secrets `ANTHROPIC_API_KEY` and `CRON_SECRET` (same value as the Vault `cron_secret`),
   otherwise the function answers 401. Then rotate the service-role key (it was in the old cron command).

## Other things worth cleaning up
- Edge functions `auth-proxy`, `migrate-images` and `dynamic-endpoint` ("Migrate Articles") are unused one-offs. Both migrate functions
  run with the service role and verify_jwt only checks for *a* valid key (the public anon key passes). Delete them.
- Enable "Leaked password protection" in Auth settings.
- `posts` has legacy duplicate camelCase columns (`articleContent`, `publishedUrl`, `geoScore`, `metaTitle`, ...).
- After deploying the web app, set Authentication -> URL Configuration to your Vercel domain.
