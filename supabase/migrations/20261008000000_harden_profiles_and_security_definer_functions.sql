-- PENDING: not yet applied to the live project (thyfuwjcntzmlkudoqhw).
-- Review, then apply with the Supabase connector, `supabase db push`, or the SQL editor.

-- 1. Profiles: users may only change their own full_name. plan_status, credits_remaining,
--    role, subscription dates and stripe ids are written by the Stripe webhook / service role only.
--    (Before this, the "Users can update their own profile" policy had no WITH CHECK and the
--    authenticated role had UPDATE on every column, so any user could set plan_status='paid',
--    credits_remaining, or role='admin' on their own row.)
revoke all on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- 2. get_all_users: the admin check used `!=`, which yields NULL (not true) for anonymous callers,
--    so the check was skipped. Use IS DISTINCT FROM, fix the email type mismatch (the function
--    currently errors for everyone), and close anon access.
create or replace function public.get_all_users()
returns table(id uuid, email text, created_at timestamptz, plan_status text,
              trial_articles_created integer, role text,
              subscription_end_date timestamptz, trial_end_date timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'You must be an admin to perform this action.';
  end if;
  return query
  select u.id, u.email::text, u.created_at, p.plan_status, p.trial_articles_created,
         p.role, p.subscription_end_date, p.trial_end_date
  from auth.users u
  left join public.profiles p on p.id = u.id;
end;
$$;

revoke execute on function public.get_all_users() from public, anon;
revoke execute on function public.get_my_role() from public, anon;

-- 3. Trigger-only functions should not be callable as RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_with_email() from public, anon, authenticated;
revoke execute on function public.handle_update_user() from public, anon, authenticated;
revoke execute on function public.handle_new_subscription_period() from public, anon, authenticated;
revoke execute on function public.trigger_set_timestamp() from public, anon, authenticated;
