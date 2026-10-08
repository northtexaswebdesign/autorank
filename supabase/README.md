# Supabase

The AI Studio export contained empty/corrupted schema, migration, config and cron files, so they were removed.
The live project is the source of truth. To bring the schema into this repo:

```
npx supabase login
npx supabase link --project-ref thyfuwjcntzmlkudoqhw
npx supabase db pull          # writes supabase/migrations/*.sql (tables, RLS policies, functions, cron)
```

Edge functions in `functions/`: `stripe-webhook` (deploy with `--no-verify-jwt`), `migrate-articles` (one-off; no auth check, delete if finished), `publish-articles` (placeholder).

After deploying to Vercel, update in the Supabase dashboard:
- Authentication -> URL Configuration: Site URL and Redirect URLs -> your Vercel domain (and `http://localhost:3000`)
- Stripe webhook endpoint stays on the Supabase function URL; only change it if the project ref changes
