-- Brand style used for article cover images (colors, fonts, logo URL).
-- Empty = the cover generator reads the business website, then falls back to a look picked for the topic.
alter table public.businesses add column if not exists brand_style jsonb;
