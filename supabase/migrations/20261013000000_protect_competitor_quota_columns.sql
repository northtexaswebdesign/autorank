-- The competitor-analysis quota uses three server-managed columns. The trigger protected only competitor_analyzed_at,
-- so a signed-in user could clear competitor_prev_analyzed_at / competitor_released_at from the browser and then
-- "give back" a successful run over and over. Only the API (service role) may change any of the three.
create or replace function public.protect_competitor_analyzed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.competitor_analyzed_at := null;
      new.competitor_prev_analyzed_at := null;
      new.competitor_released_at := null;
    else
      new.competitor_analyzed_at := old.competitor_analyzed_at;
      new.competitor_prev_analyzed_at := old.competitor_prev_analyzed_at;
      new.competitor_released_at := old.competitor_released_at;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_competitor_analyzed_at() from public, anon, authenticated;
