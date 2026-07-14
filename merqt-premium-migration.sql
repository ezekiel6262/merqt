-- Premium/pro tier: a recurring Paystack subscription that raises
-- max_businesses from 1 to 5. premium_status is the source of truth;
-- max_businesses is kept in sync by a trigger rather than set directly.
alter table public.users
  add column if not exists premium_status text not null default 'none',
  add column if not exists premium_subscription_code text,
  add column if not exists premium_customer_code text,
  add column if not exists premium_email_token text,
  add column if not exists premium_current_period_end timestamptz;

-- Server-only key/value store (no RLS policies at all, so only the
-- service-role admin client can read/write it) - caches the Paystack plan
-- code so we only create the plan once.
create table if not exists public.platform_settings (
  key text primary key,
  value text
);
alter table public.platform_settings enable row level security;

-- Closes a real hole: the existing "users can update own row" policy has no
-- column restriction, so without this a user could set their own
-- max_businesses (or premium_status) directly via a client update call.
-- Only the service-role admin client (used by the subscribe/verify/webhook
-- routes) may change these columns.
create or replace function public.protect_premium_columns()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    if new.premium_status is distinct from old.premium_status
      or new.premium_subscription_code is distinct from old.premium_subscription_code
      or new.premium_customer_code is distinct from old.premium_customer_code
      or new.premium_email_token is distinct from old.premium_email_token
      or new.premium_current_period_end is distinct from old.premium_current_period_end
      or new.max_businesses is distinct from old.max_businesses
    then
      raise exception 'This field can only be changed by Merqt';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists protect_premium_columns on public.users;
create trigger protect_premium_columns
  before update on public.users
  for each row execute function public.protect_premium_columns();

create or replace function public.sync_premium_business_limit()
returns trigger as $$
begin
  if new.premium_status = 'active' and old.premium_status is distinct from 'active' then
    new.max_businesses := 5;
  elsif new.premium_status is distinct from 'active' and old.premium_status = 'active' then
    new.max_businesses := 1;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists sync_premium_business_limit on public.users;
create trigger sync_premium_business_limit
  before update on public.users
  for each row execute function public.sync_premium_business_limit();
