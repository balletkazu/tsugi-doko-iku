-- Staging migration for a Supabase project. No project is connected by this repository.
begin;

create schema if not exists travel_private;
revoke all on schema travel_private from public;
grant usage on schema travel_private to anon, authenticated;

create table public.travel_profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 300)
);

create table public.travel_blocks (
  actor uuid references public.travel_profiles on delete cascade,
  target uuid references public.travel_profiles on delete cascade,
  primary key (actor,target), check (actor <> target)
);

create table public.travel_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.travel_profiles on delete cascade,
  kind text not null check (kind in ('photo','journal','booklet')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null default '' check (char_length(body) <= 4000),
  visibility text not null default 'private' check (visibility in ('private','restricted','public')),
  moderation text not null default 'pending' check (moderation in ('pending','approved','hidden')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.travel_post_viewers (
  post_id uuid references public.travel_posts on delete cascade,
  viewer uuid references public.travel_profiles on delete cascade,
  primary key (post_id,viewer)
);

create table public.travel_post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.travel_posts on delete cascade,
  position integer not null check (position between 1 and 10),
  is_cover boolean not null default false,
  description text not null default '' check (char_length(description) <= 160),
  place_label text not null default '' check (char_length(place_label) <= 100),
  width integer not null check (width between 1 and 2400),
  height integer not null check (height between 1 and 2400),
  -- Only consciously shared technical fields belong here. Originals and GPS are never uploaded.
  camera_detail jsonb check (camera_detail is null or (
    jsonb_typeof(camera_detail) = 'object' and octet_length(camera_detail::text) <= 600 and
    (camera_detail - array['make','model','lens','exposure','aperture','iso','focal']) = '{}'::jsonb
  )),
  unique (post_id,position) deferrable initially deferred
);
create unique index travel_one_cover on public.travel_post_photos(post_id) where is_cover;

create table public.travel_follows (
  actor uuid references public.travel_profiles on delete cascade,
  target uuid references public.travel_profiles on delete cascade,
  primary key (actor,target), check (actor <> target)
);

create table public.travel_reactions (
  actor uuid references public.travel_profiles on delete cascade,
  post_id uuid references public.travel_posts on delete cascade,
  kind text not null check (kind in ('like','thanks','want_to_go','helpful','went')),
  primary key (actor,post_id,kind)
);

create index travel_posts_author on public.travel_posts(author,created_at desc);
create index travel_posts_feed on public.travel_posts(published_at desc) where moderation='approved' and visibility='public';

create function travel_private.is_blocked(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.travel_blocks b
    where (b.actor=auth.uid() and b.target=other) or (b.actor=other and b.target=auth.uid()))
$$;

create function travel_private.owns_post(item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.travel_posts p where p.id=item and p.author=auth.uid())
$$;

create function travel_private.can_view_post(item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.travel_posts p where p.id=item and (
    p.author=auth.uid() or (
      p.moderation='approved' and p.published_at is not null and p.published_at<=now() and
      not travel_private.is_blocked(p.author) and (
        p.visibility='public' or (p.visibility='restricted' and exists (
          select 1 from public.travel_post_viewers v where v.post_id=p.id and v.viewer=auth.uid()
        ))
      )
    )
  ))
$$;

revoke all on all functions in schema travel_private from public;
grant execute on function travel_private.can_view_post(uuid),travel_private.owns_post(uuid),travel_private.is_blocked(uuid) to anon,authenticated;

alter table public.travel_profiles enable row level security;
alter table public.travel_posts enable row level security;
alter table public.travel_post_viewers enable row level security;
alter table public.travel_post_photos enable row level security;
alter table public.travel_blocks enable row level security;
alter table public.travel_follows enable row level security;
alter table public.travel_reactions enable row level security;

revoke all on public.travel_profiles,public.travel_posts,public.travel_post_viewers,public.travel_post_photos,
  public.travel_blocks,public.travel_follows,public.travel_reactions from public,anon,authenticated;
grant select on public.travel_profiles,public.travel_posts,public.travel_post_photos to anon,authenticated;
grant insert (id,display_name,bio),update (display_name,bio) on public.travel_profiles to authenticated;
grant insert (id,author,kind,title,body),update (title,body),delete on public.travel_posts to authenticated;
grant select,insert,update,delete on public.travel_post_photos to authenticated;
grant select,insert,delete on public.travel_post_viewers,public.travel_blocks,public.travel_follows,public.travel_reactions to authenticated;
-- A trusted publishing service must approve visibility/moderation and set published_at.

create policy travel_profiles_read on public.travel_profiles for select using (not travel_private.is_blocked(id));
create policy travel_profiles_insert on public.travel_profiles for insert to authenticated with check (id=auth.uid());
create policy travel_profiles_edit on public.travel_profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy travel_post_read on public.travel_posts for select using (travel_private.can_view_post(id));
create policy travel_post_insert on public.travel_posts for insert to authenticated with check (author=auth.uid() and visibility='private' and moderation='pending' and published_at is null);
create policy travel_post_edit on public.travel_posts for update to authenticated using (author=auth.uid() and published_at is null) with check (author=auth.uid() and published_at is null);
create policy travel_post_delete on public.travel_posts for delete to authenticated using (author=auth.uid());
create policy travel_viewer_access on public.travel_post_viewers for all to authenticated using (travel_private.owns_post(post_id)) with check (travel_private.owns_post(post_id));
create policy travel_photo_read on public.travel_post_photos for select using (travel_private.can_view_post(post_id));
create policy travel_photo_write on public.travel_post_photos for all to authenticated
  using (travel_private.owns_post(post_id) and exists (select 1 from public.travel_posts p where p.id=post_id and p.published_at is null))
  with check (travel_private.owns_post(post_id) and exists (select 1 from public.travel_posts p where p.id=post_id and p.published_at is null));
create policy travel_blocks_mine on public.travel_blocks for all to authenticated using (actor=auth.uid()) with check (actor=auth.uid());
create policy travel_follows_mine on public.travel_follows for all to authenticated using (actor=auth.uid()) with check (actor=auth.uid() and not travel_private.is_blocked(target));
create policy travel_reaction_read on public.travel_reactions for select to authenticated
  using (actor=auth.uid() or (travel_private.owns_post(post_id) and not travel_private.is_blocked(actor)));
create policy travel_reaction_send on public.travel_reactions for insert to authenticated with check (actor=auth.uid() and travel_private.can_view_post(post_id));
create policy travel_reaction_remove on public.travel_reactions for delete to authenticated using (actor=auth.uid());

commit;
