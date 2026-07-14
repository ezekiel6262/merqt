-- Follow-up to merqt-premium-migration.sql: protect_premium_columns only
-- fired on UPDATE. Since public.users rows are created via a client-side
-- insert (see src/lib/ensureUser.ts, using the anon/authenticated browser
-- client - governed purely by RLS), a crafted direct insert to the
-- REST API could plausibly set premium_status/max_businesses on row
-- creation, before any update ever happens - skipping the guard entirely.
-- This makes the same function fire on INSERT too, rejecting any
-- non-default value for these columns unless the service-role backend is
-- the one inserting the row.
create or replace function public.protect_premium_columns()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if auth.role() <> 'service_role' then
      if new.premium_status is distinct from 'none'
        or new.premium_subscription_code is not null
        or new.premium_customer_code is not null
        or new.premium_email_token is not null
        or new.premium_current_period_end is not null
        or new.max_businesses is distinct from 1
      then
        raise exception 'This field can only be changed by Merqt';
      end if;
    end if;
    return new;
  end if;

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
  before insert or update on public.users
  for each row execute function public.protect_premium_columns();
