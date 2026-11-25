-- Apply after 001 and 002 in staging. No external account or worker is provisioned.
begin;

create table public.travel_companion_accounts (
  actor uuid primary key references public.travel_profiles on delete cascade,
  automatic boolean not null default false,
  tier text not null default 'free' check(tier in ('free','paid'))
);
create table public.travel_friendships (
  actor uuid references public.travel_profiles on delete cascade,
  friend uuid references public.travel_profiles on delete cascade,
  primary key(actor,friend), check(actor<>friend)
);
create table public.travel_companion_trips (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.travel_profiles on delete cascade,
  trip_date date not null,
  area_label text not null check(char_length(trim(area_label)) between 1 and 60),
  note text not null default '' check(char_length(note)<=320),
  audience text not null default 'private' check(audience in ('private','friends','public')),
  moderation text not null default 'pending' check(moderation in ('pending','approved','hidden')),
  status text not null default 'open' check(status in ('open','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table public.travel_companion_seats (
  trip_id uuid references public.travel_companion_trips on delete cascade,
  traveler uuid references public.travel_profiles on delete cascade,
  joined_day date not null,
  joined_at timestamptz not null default now(),
  method text not null check(method in ('manual','automatic')),
  portrait jsonb check(portrait is null or (jsonb_typeof(portrait)='object' and octet_length(portrait::text)<=900)),
  primary key(trip_id,traveler)
);
create index travel_companion_day on public.travel_companion_seats(traveler,joined_day);
create table public.travel_companion_receipts (
  trip_id uuid references public.travel_companion_trips on delete cascade,
  recipient uuid references public.travel_profiles on delete cascade,
  group_no integer not null check(group_no>=0),
  kind text not null check(kind in ('host','companion')),
  coins integer not null check(coins>=0),
  souvenir text not null,
  created_at timestamptz not null default now(),
  primary key(trip_id,recipient)
);
create table public.travel_companion_images (
  trip_id uuid references public.travel_companion_trips on delete cascade,
  group_no integer check(group_no>=0),
  object_key uuid not null unique default gen_random_uuid(),
  state text not null default 'pending' check(state in ('pending','ready','withdrawn')),
  primary key(trip_id,group_no)
);
create table public.travel_companion_reports (
  trip_id uuid references public.travel_companion_trips on delete cascade,
  actor uuid references public.travel_profiles on delete cascade,
  reason text not null check(char_length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key(trip_id,actor)
);

create function travel_private.can_read_companion_trip(item uuid,viewer uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.travel_companion_trips t where t.id=item and (
      viewer=t.host or (
        t.moderation='approved' and not exists(
          select 1 from public.travel_blocks b where (b.actor,b.target) in ((viewer,t.host),(t.host,viewer))
        ) and (t.audience='public' or (
          t.audience='friends' and exists(select 1 from public.travel_friendships f where (f.actor,f.friend)=(viewer,t.host))
          and exists(select 1 from public.travel_friendships f where (f.actor,f.friend)=(t.host,viewer))
        ))
      )
    )
  )
$$;
create function travel_private.can_read_own_companion_trip(item uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select travel_private.can_read_companion_trip(item,auth.uid())
$$;
create function travel_private.can_read_companion_seat(item uuid,traveler_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.travel_companion_trips t where t.id=item and (
    auth.uid()=traveler_id or auth.uid()=t.host
  ) and not exists(
    select 1 from public.travel_blocks b where (b.actor,b.target) in ((traveler_id,t.host),(t.host,traveler_id))
  ))
$$;

-- Serialize each trip capacity check and each traveler's daily counter.
create function travel_private.reserve_companion_seat(item uuid,viewer uuid,channel text) returns boolean
language plpgsql security definer set search_path='' as $$
declare day_in_japan date := (pg_catalog.now() at time zone 'Asia/Tokyo')::date;
declare plan text;
declare trip public.travel_companion_trips%rowtype;
declare max_guests integer;
begin
  if viewer is null or channel not in ('manual','automatic') then return false; end if;
  select * into trip from public.travel_companion_trips where id=item for update;
  if not found or trip.host=viewer or trip.status<>'open' or trip.trip_date<day_in_japan or
    not travel_private.can_read_companion_trip(item,viewer) or
    exists(select 1 from public.travel_mutes m where m.actor=viewer and m.target=trip.host) then
    return false;
  end if;
  insert into public.travel_companion_accounts(actor) values(viewer) on conflict do nothing;
  select a.tier into plan from public.travel_companion_accounts a where a.actor=viewer for update;
  if channel='automatic' and (
    not exists(select 1 from public.travel_companion_accounts a where a.actor=viewer and a.automatic) or
    not exists(select 1 from public.travel_friendships f where (f.actor,f.friend)=(viewer,trip.host)) or
    not exists(select 1 from public.travel_friendships f where (f.actor,f.friend)=(trip.host,viewer))
  ) then return false; end if;
  if exists(select 1 from public.travel_companion_seats s where (s.trip_id,s.traveler)=(item,viewer)) then return true; end if;
  if (select count(*) from public.travel_companion_seats s where s.traveler=viewer and s.joined_day=day_in_japan)>=
    (case when plan='paid' then 10 else 5 end) then return false; end if;
  select case when a.tier='paid' then 30 else 20 end into max_guests from public.travel_companion_accounts a where a.actor=trip.host;
  if (select count(*) from public.travel_companion_seats s where s.trip_id=item)>=coalesce(max_guests,20) then return false; end if;
  insert into public.travel_companion_seats(trip_id,traveler,joined_day,method) values(item,viewer,day_in_japan,channel);
  return true;
end
$$;

create function public.travel_join_companion(item uuid) returns boolean
language sql security definer set search_path='' as $$ select travel_private.reserve_companion_seat(item,auth.uid(),'manual') $$;

-- Service jobs are keyed by trip ID and retry safely. Only the confirmed host trip is rewarded.
create function travel_private.finish_companion_trip(item uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare trip public.travel_companion_trips%rowtype;
declare added integer;
begin
  select * into trip from public.travel_companion_trips where id=item for update;
  if not found or trip.status<>'completed' or trip.moderation<>'approved' or trip.trip_date>(pg_catalog.now() at time zone 'Asia/Tokyo')::date then return 0; end if;
  insert into public.travel_companion_receipts(trip_id,recipient,group_no,kind,coins,souvenir)
  select item,s.traveler,((row_number() over(order by s.joined_at,s.traveler)-1)/3)::int,'companion',5,'shared-postcard'
  from public.travel_companion_seats s where s.trip_id=item
  and not exists(select 1 from public.travel_blocks b where (b.actor,b.target) in ((s.traveler,trip.host),(trip.host,s.traveler)))
  on conflict(trip_id,recipient) do nothing;
  get diagnostics added=row_count;
  if exists(select 1 from public.travel_companion_receipts r where r.trip_id=item and r.kind='companion') then
    insert into public.travel_companion_receipts(trip_id,recipient,group_no,kind,coins,souvenir)
    values(item,trip.host,0,'host',8,'shared-postcard') on conflict(trip_id,recipient) do nothing;
  end if;
  insert into public.travel_companion_images(trip_id,group_no)
  select distinct item,r.group_no from public.travel_companion_receipts r
  where r.trip_id=item and r.kind='companion'
  on conflict(trip_id,group_no) do nothing;
  return added;
end
$$;

-- The worker uses ready metadata and checks access again before signing a private object.
create function travel_private.can_read_companion_image(item uuid,group_index integer,viewer uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.travel_companion_images i
    join public.travel_companion_trips t on t.id=i.trip_id
    where (i.trip_id,i.group_no)=(item,group_index) and i.state='ready' and t.moderation='approved'
    and exists (select 1 from public.travel_companion_receipts r where r.trip_id=item and r.recipient=viewer
      and (r.kind='host' or r.group_no=group_index))
    and not exists (
      select 1 from public.travel_companion_receipts r join public.travel_blocks b
      on (b.actor,b.target) in ((viewer,r.recipient),(r.recipient,viewer))
      where r.trip_id=item and (r.group_no=group_index or r.kind='host')
    )
  )
$$;

create function public.travel_cancel_companion_trip(item uuid) returns boolean
language sql security definer set search_path='' as $$
  with changed as (
    update public.travel_companion_trips set status='cancelled'
    where id=item and host=auth.uid() and status='open' returning id
  ) select exists(select 1 from changed)
$$;

alter table public.travel_companion_accounts enable row level security;
alter table public.travel_friendships enable row level security;
alter table public.travel_companion_trips enable row level security;
alter table public.travel_companion_seats enable row level security;
alter table public.travel_companion_receipts enable row level security;
alter table public.travel_companion_reports enable row level security;
alter table public.travel_companion_images enable row level security;
revoke all on public.travel_companion_images from public,anon,authenticated;
grant select,insert,update on public.travel_companion_images to service_role;
create policy companion_images_service on public.travel_companion_images for all to service_role using(true) with check(true);
revoke all on function travel_private.can_read_companion_image(uuid,integer,uuid),public.travel_cancel_companion_trip(uuid) from public,anon,authenticated;
grant execute on function travel_private.can_read_companion_image(uuid,integer,uuid) to service_role;
grant execute on function public.travel_cancel_companion_trip(uuid) to authenticated;
revoke all on public.travel_companion_accounts,public.travel_friendships,public.travel_companion_trips,public.travel_companion_seats,
 public.travel_companion_receipts,public.travel_companion_reports from public,anon,authenticated;
revoke all on function travel_private.can_read_companion_trip(uuid,uuid),travel_private.can_read_companion_seat(uuid,uuid),travel_private.can_read_own_companion_trip(uuid),
 travel_private.reserve_companion_seat(uuid,uuid,text),travel_private.finish_companion_trip(uuid),public.travel_join_companion(uuid) from public,anon,authenticated;
grant execute on function travel_private.can_read_own_companion_trip(uuid),travel_private.can_read_companion_seat(uuid,uuid),public.travel_join_companion(uuid) to authenticated;
-- The automatic reservation and fulfillment functions are used by a limited role in the future worker.
grant execute on function travel_private.reserve_companion_seat(uuid,uuid,text),travel_private.finish_companion_trip(uuid) to service_role;
grant usage on schema travel_private to service_role;

grant select on public.travel_companion_accounts,public.travel_friendships,public.travel_companion_trips,public.travel_companion_seats,
 public.travel_companion_receipts,public.travel_companion_reports to authenticated;
grant insert(actor,automatic),update(automatic) on public.travel_companion_accounts to authenticated;
grant insert,delete on public.travel_friendships to authenticated;
grant insert(host,trip_date,area_label,note,audience),update(area_label,note,audience) on public.travel_companion_trips to authenticated;
grant insert(trip_id,actor,reason) on public.travel_companion_reports to authenticated;

create policy companion_accounts_owner on public.travel_companion_accounts for all to authenticated using(actor=auth.uid()) with check(actor=auth.uid());
create policy companion_friendships_owner on public.travel_friendships for all to authenticated using(actor=auth.uid()) with check(actor=auth.uid() and not travel_private.is_blocked(friend));
create policy companion_trips_read on public.travel_companion_trips for select to authenticated using(host=auth.uid() or travel_private.can_read_own_companion_trip(id));
create policy companion_trips_draft on public.travel_companion_trips for insert to authenticated
  with check(host=auth.uid() and moderation='pending' and status='open' and trip_date>=(now() at time zone 'Asia/Tokyo')::date);
create policy companion_trips_edit on public.travel_companion_trips for update to authenticated
  using(host=auth.uid() and moderation='pending' and status='open') with check(host=auth.uid() and moderation='pending' and status='open');
create policy companion_seats_read on public.travel_companion_seats for select to authenticated
  using(travel_private.can_read_companion_seat(trip_id,traveler));
create policy companion_receipts_owner on public.travel_companion_receipts for select to authenticated using(recipient=auth.uid());
create policy companion_reports_read on public.travel_companion_reports for select to authenticated using(actor=auth.uid());
create policy companion_reports_add on public.travel_companion_reports for insert to authenticated with check(actor=auth.uid() and travel_private.can_read_own_companion_trip(trip_id));

create view public.travel_companion_board with (security_invoker=true) as
  select t.id,t.host,t.trip_date,t.area_label,t.note,t.audience from public.travel_companion_trips t
  where t.moderation='approved' and t.status='open' and
    not exists(select 1 from public.travel_mutes m where m.actor=auth.uid() and m.target=t.host);
revoke all on public.travel_companion_board from public,anon,authenticated;
grant select on public.travel_companion_board to authenticated;
commit;
