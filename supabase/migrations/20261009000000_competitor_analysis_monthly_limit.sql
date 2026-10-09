-- One AI competitive analysis per business per calendar month (UTC).
-- The API (/api/claude, service role) stamps this column when an analysis starts; the app only reads it.
alter table public.businesses add column if not exists competitor_analyzed_at timestamptz;

-- Count analyses that already exist so nobody gets an extra run in the month this ships.
-- (The app stores the report with snake_case keys, so the timestamp is `analyzed_at`.)
update public.businesses
set competitor_analyzed_at = coalesce(competitor_analysis->>'analyzed_at', competitor_analysis->>'analyzedAt')::timestamptz
where competitor_analyzed_at is null
  and jsonb_typeof(competitor_analysis) = 'object'
  and coalesce(competitor_analysis->>'analyzed_at', competitor_analysis->>'analyzedAt') is not null;

-- Signed-in users (and anon) can edit their business row, so they must not be able to reset the stamp.
create or replace function public.protect_competitor_analyzed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.competitor_analyzed_at := null;
    else
      new.competitor_analyzed_at := old.competitor_analyzed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_competitor_analyzed_at on public.businesses;
create trigger protect_competitor_analyzed_at
  before insert or update on public.businesses
  for each row execute function public.protect_competitor_analyzed_at();

revoke execute on function public.protect_competitor_analyzed_at() from public, anon, authenticated;
