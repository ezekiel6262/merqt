-- Forward-compatible groundwork for the premium tier: free accounts get 1
-- business, premium accounts will get up to 5 (this column is what a future
-- premium upgrade flips). The trigger is the real enforcement layer - the
-- onboarding UI also checks this so users see a message instead of a raw
-- DB error, but a direct API/DB call is still blocked here.
alter table public.users
  add column if not exists max_businesses int not null default 1;

create or replace function public.enforce_business_limit()
returns trigger as $$
declare
  current_count int;
  allowed int;
begin
  select count(*) into current_count from public.sellers where user_id = new.user_id;
  select max_businesses into allowed from public.users where id = new.user_id;

  if current_count >= coalesce(allowed, 1) then
    raise exception 'You have reached your business profile limit';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_business_limit on public.sellers;
create trigger enforce_business_limit
  before insert on public.sellers
  for each row execute function public.enforce_business_limit();
