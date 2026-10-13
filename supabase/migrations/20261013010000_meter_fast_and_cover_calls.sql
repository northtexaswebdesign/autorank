-- AI usage meter, part 2 (2026-10-13)
-- 1. fast: cheap-model calls without tools were not counted at all, so any account could run them without limit.
-- 2. cover: /api/cover (a Sonnet call per cover or in-article image plan) was not counted either.
-- 3. article_refund: an article whose credit is refunded (cut off, model error) no longer raises the day's
--    allowance; before, each failed article added 12 smart and 4 search calls to the cap for free.
-- 4. smart_out: output tokens of smart-model calls that take no article credit (rewrites, source passes, research).
--    Counting calls was not enough: one such call can be asked to write a whole article, so the daily allowance is
--    measured in what the model actually wrote.
-- api/claude.ts and api/cover.ts fail open when this function errors, so deploying the code first is safe.

alter table public.ai_usage add column if not exists fast integer not null default 0;
alter table public.ai_usage add column if not exists cover integer not null default 0;
alter table public.ai_usage add column if not exists smart_out integer not null default 0;

-- the returned columns change, so the function has to be dropped and created again
drop function if exists public.bump_ai_usage(uuid, text);

create function public.bump_ai_usage(p_user uuid, p_kind text)
returns table(articles integer, smart integer, search integer, fast integer, cover integer, smart_out integer)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_kind not in ('article', 'article_refund', 'smart', 'search', 'fast', 'cover') then
    raise exception 'unknown usage kind %', p_kind;
  end if;
  insert into public.ai_usage as u (user_id, day, articles, smart, search, fast, cover)
  values (p_user, (now() at time zone 'utc')::date,
          (p_kind = 'article')::int, (p_kind = 'smart')::int, (p_kind = 'search')::int,
          (p_kind = 'fast')::int, (p_kind = 'cover')::int)
  on conflict (user_id, day) do update set
    articles = greatest(0, u.articles + (p_kind = 'article')::int - (p_kind = 'article_refund')::int),
    smart = u.smart + (p_kind = 'smart')::int,
    search = u.search + (p_kind = 'search')::int,
    fast = u.fast + (p_kind = 'fast')::int,
    cover = u.cover + (p_kind = 'cover')::int;
  return query select u.articles, u.smart, u.search, u.fast, u.cover, u.smart_out from public.ai_usage u
    where u.user_id = p_user and u.day = (now() at time zone 'utc')::date;
end;
$$;
revoke execute on function public.bump_ai_usage(uuid, text) from public, anon, authenticated;

-- Adds the output tokens of a finished smart-model call to today's total (UTC).
create or replace function public.add_ai_output_tokens(p_user uuid, p_tokens integer)
returns void
language sql
security definer
set search_path to ''
as $$
  insert into public.ai_usage as u (user_id, day, smart_out)
  values (p_user, (now() at time zone 'utc')::date, greatest(0, p_tokens))
  on conflict (user_id, day) do update set smart_out = u.smart_out + greatest(0, p_tokens);
$$;
revoke execute on function public.add_ai_output_tokens(uuid, integer) from public, anon, authenticated;
