-- Phase 3 social layer: user-to-user follows, likes/comments/bookmarks on
-- posts, buyer request photos, and a notifications inbox driven entirely by
-- triggers (so notifications can't be spoofed by a direct client insert -
-- there is no insert policy for regular users, only the SECURITY DEFINER
-- helper function below can write rows).

-- 1. Let a user follow another user's personal profile, not just a seller.
-- Existing rows (follower_id -> seller_id) are untouched; followee_user_id
-- is the new alternative target.
alter table public.follows
  add column if not exists followee_user_id uuid references public.users(id) on delete cascade;

alter table public.follows drop constraint if exists follows_one_target_chk;
alter table public.follows add constraint follows_one_target_chk check (
  (seller_id is not null and followee_user_id is null) or
  (seller_id is null and followee_user_id is not null)
);

drop policy if exists "Anyone can view follows" on public.follows;
create policy "Anyone can view follows" on public.follows for select using (true);

drop policy if exists "Users can follow" on public.follows;
create policy "Users can follow" on public.follows for insert
  with check (follower_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow" on public.follows for delete
  using (follower_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

-- 2. Likes
create table if not exists public.post_likes (
  id uuid primary key default uuid_generate_v4()
);
alter table public.post_likes
  add column if not exists post_id uuid not null references public.posts(id) on delete cascade,
  add column if not exists user_id uuid not null references public.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table public.post_likes drop constraint if exists post_likes_unique;
alter table public.post_likes add constraint post_likes_unique unique (post_id, user_id);

alter table public.post_likes enable row level security;
drop policy if exists "Anyone can view likes" on public.post_likes;
create policy "Anyone can view likes" on public.post_likes for select using (true);
drop policy if exists "Users can like posts" on public.post_likes;
create policy "Users can like posts" on public.post_likes for insert
  with check (user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));
drop policy if exists "Users can unlike their own likes" on public.post_likes;
create policy "Users can unlike their own likes" on public.post_likes for delete
  using (user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

-- 3. Comments
create table if not exists public.post_comments (
  id uuid primary key default uuid_generate_v4()
);
alter table public.post_comments
  add column if not exists post_id uuid not null references public.posts(id) on delete cascade,
  add column if not exists author_user_id uuid not null references public.users(id) on delete cascade,
  add column if not exists text text not null,
  add column if not exists created_at timestamptz not null default now();

alter table public.post_comments enable row level security;
drop policy if exists "Anyone can view comments" on public.post_comments;
create policy "Anyone can view comments" on public.post_comments for select using (true);
drop policy if exists "Users can comment" on public.post_comments;
create policy "Users can comment" on public.post_comments for insert
  with check (author_user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));
drop policy if exists "Users can delete their own comments" on public.post_comments;
create policy "Users can delete their own comments" on public.post_comments for delete
  using (author_user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

-- 4. Bookmarks (private to the user who saved them)
create table if not exists public.post_bookmarks (
  id uuid primary key default uuid_generate_v4()
);
alter table public.post_bookmarks
  add column if not exists post_id uuid not null references public.posts(id) on delete cascade,
  add column if not exists user_id uuid not null references public.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table public.post_bookmarks drop constraint if exists post_bookmarks_unique;
alter table public.post_bookmarks add constraint post_bookmarks_unique unique (post_id, user_id);

alter table public.post_bookmarks enable row level security;
drop policy if exists "Users can view their own bookmarks" on public.post_bookmarks;
create policy "Users can view their own bookmarks" on public.post_bookmarks for select
  using (user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));
drop policy if exists "Users can bookmark posts" on public.post_bookmarks;
create policy "Users can bookmark posts" on public.post_bookmarks for insert
  with check (user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));
drop policy if exists "Users can remove their own bookmarks" on public.post_bookmarks;
create policy "Users can remove their own bookmarks" on public.post_bookmarks for delete
  using (user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));

-- 5. Buyer request photos
alter table public.buyer_requests
  add column if not exists image_url text;

-- 6. Notifications inbox
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4()
);
alter table public.notifications
  add column if not exists recipient_user_id uuid references public.users(id) on delete cascade,
  add column if not exists type text,
  add column if not exists actor_user_id uuid references public.users(id) on delete set null,
  add column if not exists actor_seller_id uuid references public.sellers(id) on delete set null,
  add column if not exists post_id uuid references public.posts(id) on delete cascade,
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists request_id uuid references public.buyer_requests(id) on delete cascade,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications for select
  using (recipient_user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));
drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read" on public.notifications for update
  using (recipient_user_id in (select id from public.users where clerk_id = auth.jwt() ->> 'sub'));
-- deliberately no insert policy for regular users - only create_notification()
-- (SECURITY DEFINER, below) can write rows, so notifications can't be spoofed.

create or replace function public.create_notification(
  p_recipient uuid,
  p_type text,
  p_actor_user uuid,
  p_actor_seller uuid,
  p_post uuid,
  p_order uuid,
  p_request uuid
) returns void as $$
begin
  if p_recipient is null or p_recipient = p_actor_user then
    return;
  end if;
  insert into public.notifications (recipient_user_id, type, actor_user_id, actor_seller_id, post_id, order_id, request_id)
  values (p_recipient, p_type, p_actor_user, p_actor_seller, p_post, p_order, p_request);
end;
$$ language plpgsql security definer set search_path = public;

-- Follow someone -> notify them
create or replace function public.notify_on_follow()
returns trigger as $$
declare
  recipient uuid;
begin
  if new.seller_id is not null then
    select user_id into recipient from public.sellers where id = new.seller_id;
  else
    recipient := new.followee_user_id;
  end if;
  perform public.create_notification(recipient, 'follow', new.follower_id, null, null, null, null);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists notify_on_follow on public.follows;
create trigger notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- Like a post -> notify its author
create or replace function public.notify_on_post_like()
returns trigger as $$
declare
  recipient uuid;
  post_seller_id uuid;
begin
  select author_user_id, seller_id into recipient, post_seller_id from public.posts where id = new.post_id;
  if post_seller_id is not null then
    select user_id into recipient from public.sellers where id = post_seller_id;
  end if;
  perform public.create_notification(recipient, 'like', new.user_id, null, new.post_id, null, null);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists notify_on_post_like on public.post_likes;
create trigger notify_on_post_like
  after insert on public.post_likes
  for each row execute function public.notify_on_post_like();

-- Comment on a post -> notify its author
create or replace function public.notify_on_post_comment()
returns trigger as $$
declare
  recipient uuid;
  post_seller_id uuid;
begin
  select author_user_id, seller_id into recipient, post_seller_id from public.posts where id = new.post_id;
  if post_seller_id is not null then
    select user_id into recipient from public.sellers where id = post_seller_id;
  end if;
  perform public.create_notification(recipient, 'comment', new.author_user_id, null, new.post_id, null, null);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists notify_on_post_comment on public.post_comments;
create trigger notify_on_post_comment
  after insert on public.post_comments
  for each row execute function public.notify_on_post_comment();

-- A seller responds to a buyer request -> notify the buyer
create or replace function public.notify_on_request_response()
returns trigger as $$
declare
  actor uuid;
begin
  if new.status = 'responded' and old.status is distinct from 'responded' and new.responding_seller_id is not null then
    select user_id into actor from public.sellers where id = new.responding_seller_id;
    perform public.create_notification(new.buyer_id, 'request_accepted', actor, new.responding_seller_id, null, null, new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists notify_on_request_response on public.buyer_requests;
create trigger notify_on_request_response
  after update on public.buyer_requests
  for each row execute function public.notify_on_request_response();

-- An offer gets accepted -> notify the buyer who made it
create or replace function public.notify_on_offer_accepted()
returns trigger as $$
declare
  actor uuid;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select user_id into actor from public.sellers where id = new.seller_id;
    perform public.create_notification(new.buyer_id, 'offer_accepted', actor, new.seller_id, null, null, null);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists notify_on_offer_accepted on public.offers;
create trigger notify_on_offer_accepted
  after update on public.offers
  for each row execute function public.notify_on_offer_accepted();
