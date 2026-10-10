-- 1. Competitor analysis quota: the server keeps the stamp to restore when a failed run is given back, and allows
--    at most one give-back per month (before, the browser sent the value to restore, so the limit could be reset).
alter table public.businesses add column if not exists competitor_prev_analyzed_at timestamptz;
alter table public.businesses add column if not exists competitor_released_at timestamptz;

-- 2. Plans past their end date become expired. Paid plans get a 3-day grace period, because Stripe renewals can
--    arrive a little after the end date. Returns how many accounts were expired. Run daily by pg_cron
--    (scheduled separately, see the PR notes).
create or replace function public.expire_lapsed_plans()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare n integer;
begin
  update public.profiles set plan_status = 'expired'
  where (plan_status = 'paid' and subscription_end_date is not null and subscription_end_date < now() - interval '3 days')
     or (plan_status = 'trial' and trial_end_date is not null and trial_end_date < now());
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.expire_lapsed_plans() from public, anon, authenticated;
