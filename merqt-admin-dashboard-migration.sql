alter table public.products
  add column if not exists moderation_reason text;
