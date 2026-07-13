alter table public.orders
  add column if not exists dispute_category text,
  add column if not exists dispute_suggested_action text;

alter table public.reviews
  add column if not exists hidden boolean not null default false;
