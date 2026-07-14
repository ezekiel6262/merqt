alter table public.sellers
  add column if not exists cover_photo_url text;

alter table public.users
  add column if not exists cover_photo_url text;
