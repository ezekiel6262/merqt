-- Reposting: a repost is just a post row that points back at the original
-- via repost_of_post_id, with no text/image of its own. Feeds render the
-- original's content under a "X reposted" attribution line.
alter table public.posts
  add column if not exists repost_of_post_id uuid references public.posts(id) on delete cascade;

create index if not exists posts_repost_of_idx on public.posts (repost_of_post_id);

-- Bookmarks are being replaced by share/repost - drop the now-unused table.
drop table if exists public.post_bookmarks;
