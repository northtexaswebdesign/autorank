-- Billing safety (2026-10-10)
-- 1. stripe_events: every Stripe event id we have handled, so a redelivered event is not applied twice.
-- 2. ai_usage: per-user daily counters for AI calls that do not take an article credit (rewrites, repairs,
--    keyword and gap research). api/claude.ts caps them relative to the articles charged that day, so the
--    browser cannot run unlimited expensive calls for free.
-- Both tables are server-only: no grants to anon or authenticated; the service role bypasses RLS.

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on table public.stripe_events from anon, authenticated;

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  articles integer not null default 0,
  smart integer not null default 0,
  search integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

-- Adds one to a counter for today (UTC) and returns today's totals. Atomic, so parallel calls all count.
create or replace function public.bump_ai_usage(p_user uuid, p_kind text)
returns table(articles integer, smart integer, search integer)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_kind not in ('article', 'smart', 'search') then
    raise exception 'unknown usage kind %', p_kind;
  end if;
  insert into public.ai_usage as u (user_id, day, articles, smart, search)
  values (p_user, (now() at time zone 'utc')::date,
          (p_kind = 'article')::int, (p_kind = 'smart')::int, (p_kind = 'search')::int)
  on conflict (user_id, day) do update set
    articles = u.articles + (p_kind = 'article')::int,
    smart = u.smart + (p_kind = 'smart')::int,
    search = u.search + (p_kind = 'search')::int;
  return query select u.articles, u.smart, u.search from public.ai_usage u
    where u.user_id = p_user and u.day = (now() at time zone 'utc')::date;
end;
$$;
revoke execute on function public.bump_ai_usage(uuid, text) from public, anon, authenticated;
