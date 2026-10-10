-- Publishing safety (2026-10-10)
-- wp_post_id: the WordPress post an article became, so publishing again updates it instead of creating a copy.
-- publish_attempts: failed auto-publish runs in a row; after 3 the post goes back to draft instead of retrying forever.
alter table public.posts add column if not exists wp_post_id bigint;
alter table public.posts add column if not exists publish_attempts integer not null default 0;
