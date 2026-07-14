-- Renaming (display name, business name, or profile link/slug) is a real
-- fraud vector: a seller mid-dispute, or mid-order, could rename to dodge
-- accountability. This closes it with three things, all enforced in
-- triggers (not just the UI) so a direct API call is blocked the same way:
--   1. a 30-day cooldown between changes
--   2. a freeze while the account has an active order or an open dispute
--   3. a "formerly known as" trail visible on the public profile for 14
--      days after a change, so anyone mid-conversation isn't confused
-- The very first time a (previously blank) name is filled in is exempt from
-- the freeze - that's profile completion, not a rename.

alter table public.users
  add column if not exists name_changed_at timestamptz,
  add column if not exists previous_name text,
  add column if not exists previous_name_until timestamptz,
  add column if not exists slug_changed_at timestamptz;

alter table public.sellers
  add column if not exists business_name_changed_at timestamptz,
  add column if not exists previous_business_name text,
  add column if not exists previous_business_name_until timestamptz,
  add column if not exists slug_changed_at timestamptz;

create or replace function public.guard_user_identity_change()
returns trigger as $$
begin
  if new.name is distinct from old.name then
    if old.name_changed_at is not null and old.name_changed_at > now() - interval '30 days' then
      raise exception 'You can change your name once every 30 days';
    end if;

    if old.name is not null and old.name <> '' and exists (
      select 1 from public.orders
      where buyer_id = old.id
        and (status not in ('delivered', 'completed', 'cancelled') or dispute_status = 'reported')
    ) then
      raise exception 'You cannot change your name while you have an active order or open dispute';
    end if;

    if old.name is not null and old.name <> '' then
      new.previous_name := old.name;
      new.previous_name_until := now() + interval '14 days';
    end if;
    new.name_changed_at := now();
  end if;

  if new.slug is distinct from old.slug then
    if old.slug_changed_at is not null and old.slug_changed_at > now() - interval '30 days' then
      raise exception 'You can change your profile link once every 30 days';
    end if;
    new.slug_changed_at := now();
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists guard_user_identity_change on public.users;
create trigger guard_user_identity_change
  before update on public.users
  for each row execute function public.guard_user_identity_change();

create or replace function public.guard_seller_identity_change()
returns trigger as $$
begin
  if new.business_name is distinct from old.business_name then
    if old.business_name_changed_at is not null and old.business_name_changed_at > now() - interval '30 days' then
      raise exception 'You can change your business name once every 30 days';
    end if;

    if exists (
      select 1 from public.orders
      where seller_id = old.id
        and (status not in ('delivered', 'completed', 'cancelled') or dispute_status = 'reported')
    ) then
      raise exception 'You cannot change your business name while you have an active order or open dispute';
    end if;

    new.previous_business_name := old.business_name;
    new.previous_business_name_until := now() + interval '14 days';
    new.business_name_changed_at := now();
  end if;

  if new.slug is distinct from old.slug then
    if old.slug_changed_at is not null and old.slug_changed_at > now() - interval '30 days' then
      raise exception 'You can change your business link once every 30 days';
    end if;
    new.slug_changed_at := now();
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists guard_seller_identity_change on public.sellers;
create trigger guard_seller_identity_change
  before update on public.sellers
  for each row execute function public.guard_seller_identity_change();
