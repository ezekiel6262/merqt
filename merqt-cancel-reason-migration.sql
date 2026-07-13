alter table public.orders
  add column if not exists cancel_reason text;
