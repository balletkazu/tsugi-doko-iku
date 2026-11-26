-- Staging only. Review and publication are explicit editor actions.
begin;
create table public.travel_regional_proposals (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.travel_profiles on delete cascade,
  place text not null check(char_length(trim(place)) between 1 and 60),
  title text not null check(char_length(trim(title)) between 1 and 70),
  story text not null check(char_length(trim(story)) between 1 and 700),
  source_url text check(source_url is null or (char_length(source_url)<=300 and source_url like 'https://%')),
  state text not null default 'draft' check(state in ('draft','submitted','in_review','adopted','returned')),
  catalog_key text check(catalog_key is null or catalog_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  created_at timestamptz not null default now(),
  check(state<>'adopted' or catalog_key is not null)
);
create unique index travel_regional_adoption on public.travel_regional_proposals(catalog_key) where state='adopted';
create table public.travel_regional_medals (
  proposal_id uuid primary key references public.travel_regional_proposals on delete cascade,
  recipient uuid not null references public.travel_profiles on delete cascade,
  medal text not null check(medal='local-storyteller'),
  awarded_at timestamptz not null default now()
);
alter table public.travel_regional_proposals enable row level security;
alter table public.travel_regional_medals enable row level security;
revoke all on public.travel_regional_proposals,public.travel_regional_medals from public,anon,authenticated;
grant select on public.travel_regional_proposals,public.travel_regional_medals to authenticated;
grant insert(author,place,title,story,source_url),update(place,title,story,source_url) on public.travel_regional_proposals to authenticated;
create policy travel_proposals_read on public.travel_regional_proposals for select to authenticated using(author=auth.uid());
create policy travel_proposals_insert on public.travel_regional_proposals for insert to authenticated with check(author=auth.uid() and state='draft');
create policy travel_proposals_edit on public.travel_regional_proposals for update to authenticated using(author=auth.uid() and state in ('draft','returned'));
create policy travel_regional_medals_read on public.travel_regional_medals for select to authenticated using(recipient=auth.uid());
create function public.travel_send_regional_proposal(item uuid) returns boolean
language sql security definer set search_path='' as $$
  with changed as (
    update public.travel_regional_proposals set state='submitted'
    where id=item and author=auth.uid() and state in ('draft','returned') returning id
  ) select exists(select 1 from changed)
$$;
create function travel_private.adopt_regional_proposal(item uuid,key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare who uuid;
begin
  update public.travel_regional_proposals set state='adopted',catalog_key=key
    where id=item and state in ('submitted','in_review') returning author into who;
  if who is null then return false; end if;
  insert into public.travel_regional_medals(proposal_id,recipient,medal)
    values(item,who,'local-storyteller') on conflict(proposal_id) do nothing;
  return true;
end
$$;
revoke all on function public.travel_send_regional_proposal(uuid),travel_private.adopt_regional_proposal(uuid,text) from public,anon,authenticated;
grant execute on function public.travel_send_regional_proposal(uuid) to authenticated;
grant execute on function travel_private.adopt_regional_proposal(uuid,text) to service_role;
commit;
