# Supabase (project `thyfuwjcntzmlkudoqhw`, AutoRankAI)

The export's schema/migration/config files were corrupted, so the live project is the source of truth.
Tables (all RLS-enabled): businesses, keywords, posts, cms_integrations, activity_logs, profiles. Storage bucket: `articles`.

## Pending (not yet applied to the live project)
1. `migrations/20261008000000_harden_profiles_and_security_definer_functions.sql`
   - Any signed-in user could `UPDATE` their own profile row freely (no WITH CHECK, all columns granted), i.e. set
     `plan_status='paid'`, `credits_remaining`, or `role='admin'`. Now only `full_name` is writable by clients.
   - `get_all_users()` skipped its admin check for anonymous callers (`NULL != 'admin'` is NULL). It only failed to leak
     because of an unrelated varchar/text bug. Fixed, and anon access revoked.
   - Trigger-only SECURITY DEFINER functions were callable as RPC endpoints.
2. `functions/autopublish-function` (Claude version of the live Gemini/Imagen function; pg_cron runs it every 2h).
   Before deploying:
   - Set secrets: `ANTHROPIC_API_KEY`, `CRON_SECRET` (any long random string).
   - Deploy with verify_jwt = false (as today).
   - Update the cron job to send `x-cron-secret` instead of embedding the service-role key in the command:
     `select cron.alter_job(55, command := $$ select net.http_post(url:='https://thyfuwjcntzmlkudoqhw.supabase.co/functions/v1/autopublish-function', headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')), body:='{}'::jsonb) $$);`
     (store the secret in Vault first: `select vault.create_secret('<CRON_SECRET>', 'cron_secret');`)
   - Rotate the service-role key afterwards: the current cron command contains it in plain text.

## Other things worth cleaning up
- Edge functions `auth-proxy`, `migrate-images` and `dynamic-endpoint` ("Migrate Articles") are unused one-offs. Both migrate functions
  run with the service role and verify_jwt only checks for *a* valid key (the public anon key passes). Delete them.
- Enable "Leaked password protection" in Auth settings.
- `posts` has legacy duplicate camelCase columns (`articleContent`, `publishedUrl`, `geoScore`, `metaTitle`, ...).
- After deploying the web app, set Authentication -> URL Configuration to your Vercel domain.
