-- Shared guard for tables with (buyer_id, seller_id) columns: blocks a
-- seller transacting with themselves. This is the real enforcement layer -
-- client-side checks are UX only and don't stop a direct API/DB call.
create or replace function public.prevent_self_dealing()
returns trigger as $$
begin
  if exists (
    select 1 from public.sellers s
    where s.id = new.seller_id and s.user_id = new.buyer_id
  ) then
    raise exception 'You cannot transact with your own seller account';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists prevent_self_dealing_orders on public.orders;
create trigger prevent_self_dealing_orders
  before insert on public.orders
  for each row execute function public.prevent_self_dealing();

drop trigger if exists prevent_self_dealing_offers on public.offers;
create trigger prevent_self_dealing_offers
  before insert on public.offers
  for each row execute function public.prevent_self_dealing();

drop trigger if exists prevent_self_dealing_reviews on public.reviews;
create trigger prevent_self_dealing_reviews
  before insert on public.reviews
  for each row execute function public.prevent_self_dealing();

-- buyer_requests doesn't have a seller_id column (responding_seller_id is
-- set later via update, not at insert), so it needs its own guard.
create or replace function public.prevent_self_dealing_request_response()
returns trigger as $$
begin
  if new.responding_seller_id is not null and exists (
    select 1 from public.sellers s
    where s.id = new.responding_seller_id and s.user_id = new.buyer_id
  ) then
    raise exception 'You cannot respond to your own request';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists prevent_self_dealing_request_response on public.buyer_requests;
create trigger prevent_self_dealing_request_response
  before insert or update on public.buyer_requests
  for each row execute function public.prevent_self_dealing_request_response();
