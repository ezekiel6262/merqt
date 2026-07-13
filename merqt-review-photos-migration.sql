alter table public.reviews
  add column if not exists photo_urls text[];
