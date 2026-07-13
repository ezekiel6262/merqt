alter table public.users
  add column if not exists slug text unique,
  add column if not exists bio text;

drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row"
  on public.users for update
  using (clerk_id = auth.jwt() ->> 'sub')
  with check (clerk_id = auth.jwt() ->> 'sub');
