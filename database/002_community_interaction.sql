-- Apply after 001 to an approved staging project.
begin;
alter table public.travel_reactions drop constraint travel_reactions_kind_check;
alter table public.travel_reactions add check (kind in ('like','thanks','want_to_go','helpful','went','amazing','delicious'));
alter table public.travel_posts add column comment_scope text not null default 'closed'
  check (comment_scope in ('closed','author','readers'));
grant update(comment_scope) on public.travel_posts to authenticated;

create table public.travel_mutes (
  actor uuid references public.travel_profiles on delete cascade,
  target uuid references public.travel_profiles on delete cascade,
  primary key(actor,target), check(actor<>target)
);
create table public.travel_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.travel_posts on delete cascade,
  actor uuid not null references public.travel_profiles on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 1000),
  moderation text not null default 'pending' check(moderation in ('pending','approved','hidden')),
  created_at timestamptz not null default now()
);
create index travel_comments_by_post on public.travel_comments(post_id,created_at);
create table public.travel_reports (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references public.travel_profiles on delete cascade,
  post_id uuid not null references public.travel_posts on delete cascade,
  reason text not null check(char_length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(), unique(actor,post_id)
);
alter table public.travel_mutes enable row level security;
alter table public.travel_comments enable row level security;
alter table public.travel_reports enable row level security;
revoke all on public.travel_mutes,public.travel_comments,public.travel_reports from public,anon,authenticated;
grant select,insert,delete on public.travel_mutes to authenticated;
grant select,delete on public.travel_comments to authenticated;
grant insert (post_id,actor,body) on public.travel_comments to authenticated;
grant insert (post_id,actor,reason) on public.travel_reports to authenticated;
grant select on public.travel_reports to authenticated;
create policy travel_mutes_self on public.travel_mutes for all to authenticated
  using (actor=auth.uid()) with check(actor=auth.uid());
create policy travel_reports_self_read on public.travel_reports for select to authenticated using(actor=auth.uid());
create policy travel_reports_file on public.travel_reports for insert to authenticated
  with check(actor=auth.uid() and travel_private.can_view_post(post_id));
create policy travel_comments_insert on public.travel_comments for insert to authenticated
  with check(actor=auth.uid() and exists(select 1 from public.travel_posts p where p.id=post_id and p.comment_scope<>'closed'));
create policy travel_comments_read on public.travel_comments for select to authenticated
  using(travel_private.can_view_post(post_id) and not travel_private.is_blocked(actor) and
    (actor=auth.uid() or (moderation='approved' and exists (
      select 1 from public.travel_posts p where p.id=post_id and
      (p.author=auth.uid() or p.comment_scope='readers')
    ) and not exists(select 1 from public.travel_mutes m where m.actor=auth.uid() and m.target=travel_comments.actor))));
create policy travel_comments_delete on public.travel_comments for delete to authenticated using(actor=auth.uid());
-- Clients use this invoker view for their timeline. Direct post reads retain the visibility controls of 001.
create view public.travel_feed with (security_invoker=true) as
  select p.* from public.travel_posts p where p.published_at is not null
  and p.moderation='approved' and not exists
    (select 1 from public.travel_mutes m where m.actor=auth.uid() and m.target=p.author);
revoke all on public.travel_feed from public,anon,authenticated;
grant select on public.travel_feed to authenticated;
commit;
