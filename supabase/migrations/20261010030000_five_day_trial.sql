-- Free trial: 3 articles or 5 days, whichever comes first (the website promises a 5-day trial).
-- Before this, trial_end_date was never set, so trials only ended after 3 articles.
-- The default applies to profiles created from now on (both auth.users insert triggers insert without it);
-- existing trial accounts keep a null end date. The app, api/claude.ts and the auto-publisher check the date.
alter table public.profiles alter column trial_end_date set default (now() + interval '5 days');
