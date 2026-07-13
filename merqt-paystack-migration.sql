alter table public.orders
  add column if not exists paystack_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists payout_status text not null default 'pending';
