create table if not exists public.offers (
  id uuid primary key default uuid_generate_v4()
);

alter table public.offers
  add column if not exists product_id uuid references public.products(id),
  add column if not exists buyer_id uuid references public.users(id),
  add column if not exists seller_id uuid references public.sellers(id),
  add column if not exists amount numeric,
  add column if not exists message text,
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists responded_at timestamptz,
  add column if not exists resulting_order_id uuid references public.orders(id);

alter table public.orders
  add column if not exists offer_id uuid references public.offers(id);

alter table public.offers enable row level security;

drop policy if exists "Buyers can view their own offers" on public.offers;
create policy "Buyers can view their own offers" on public.offers for select
  using (buyer_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

drop policy if exists "Sellers can view offers on their listings" on public.offers;
create policy "Sellers can view offers on their listings" on public.offers for select
  using (seller_id in (
    select s.id from public.sellers s
    join public.users u on u.id = s.user_id
    where u.clerk_id = auth.jwt() ->> 'sub'
  ));

drop policy if exists "Buyers can create offers" on public.offers;
create policy "Buyers can create offers" on public.offers for insert
  with check (buyer_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

drop policy if exists "Sellers can respond to offers on their listings" on public.offers;
create policy "Sellers can respond to offers on their listings" on public.offers for update
  using (seller_id in (
    select s.id from public.sellers s
    join public.users u on u.id = s.user_id
    where u.clerk_id = auth.jwt() ->> 'sub'
  ));
