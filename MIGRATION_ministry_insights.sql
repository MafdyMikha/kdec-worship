-- Apply after MIGRATION_attendance_custom_events.sql and all earlier migrations.
-- Additive: historical responses, ratings and appearances are never fabricated.
begin;

create table if not exists public.ministry_access_roles (
 person_id uuid not null references public.profiles(id), role text not null check(role in ('technical_admin','musical_admin','pastoral_admin','worship_leader')),
 created_at timestamptz not null default now(), primary key(person_id,role)
);
create or replace function public.has_ministry_role(p_role text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and exists(select 1 from public.ministry_access_roles where person_id=auth.uid() and role=p_role);
$$;
create or replace function public.can_evaluate_members()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and (public.is_super_admin() or public.has_ministry_role('technical_admin'));
$$;
create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when not public.is_active_member() then false
 when p_permission='evaluations.manage' then public.can_evaluate_members()
 when public.is_super_admin() then true
 else exists(select 1 from public.access_level_permissions where access_level=public.get_access_level() and permission_key=p_permission)
 or (public.has_ministry_role('technical_admin') and p_permission in ('users.view','ratings.view','ratings.musician','ratings.vocal','ratings.leader','ratings.configure','reports.view'))
 or (public.has_ministry_role('musical_admin') and p_permission in ('users.view','ratings.view','ratings.musician','ratings.vocal','ratings.leader'))
 or (public.has_ministry_role('pastoral_admin') and p_permission in ('users.view','reports.view'))
 or (public.has_ministry_role('worship_leader') and p_permission='reports.own') end;
$$;
create or replace function public.ministry_can_read_service_report(p_service uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and (public.has_permission('reports.view') or
 (public.has_permission('reports.own') and exists(select 1 from public.service_team t join public.worship_roles r on r.id=t.worship_role_id where t.service_id=p_service and t.person_id=auth.uid() and t.status<>'declined' and r.schedule_leader_role)));
$$;
-- Report readers receive session metadata without QR credentials.
drop policy if exists "Authorized users read attendance sessions" on public.attendance_sessions;
create policy "Authorized users read attendance sessions" on public.attendance_sessions for select to authenticated using(public.has_permission('services.edit') or public.has_permission('schedules.manage'));
-- Report scope is checked by a definer helper without exposing QR credentials.
create or replace function public.ministry_can_read_attendance(p_session uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and exists(select 1 from public.attendance_sessions where id=p_session and public.ministry_can_read_service_report(service_id));
$$;
drop policy if exists ministry_leader_attendance on public.attendance_records;
create policy ministry_leader_attendance on public.attendance_records for select to authenticated using(public.has_permission('reports.own') and public.ministry_can_read_attendance(session_id));
create or replace function public.get_report_attendance_sessions(p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select (to_jsonb(s)-'qr_code')||jsonb_build_object('service',case when v.id is null then null else jsonb_build_object('id',v.id,'title',v.title,'date',v.date,'time',v.time,'status',v.status,'event_kind',v.event_kind,'custom_category',v.custom_category) end)
 from public.attendance_sessions s left join public.services v on v.id=s.service_id
 where public.ministry_can_read_service_report(s.service_id)
 order by s.id limit 500 offset greatest(coalesce(p_offset,0),0);
$$;
insert into public.system_permissions(permission_key,category,description,display_order,active) values
 ('ratings.view','ratings','View profile ratings',300,true),('ratings.musician','ratings','Rate musicians',310,true),
 ('ratings.vocal','ratings','Rate vocalists',320,true),('ratings.leader','ratings','Rate worship leaders',330,true),
 ('ratings.configure','ratings','Configure rating criteria',340,true),('reports.own','reports','View own worship leader reports',350,true)
on conflict(permission_key) do nothing;
insert into public.access_level_permissions(access_level,permission_key)
select 'admin',permission_key from public.system_permissions where permission_key in ('ratings.view','ratings.musician','ratings.vocal','ratings.leader') on conflict do nothing;

create table if not exists public.ministry_members (
 person_id uuid primary key references public.profiles(id), category text not null default 'member' check(category in ('member','newcomer')),
 serving_status text not null default 'active' check(serving_status in ('active','inactive','leave','archived')),
 leader_quote text not null default '' check(length(leader_quote)<=1000), updated_at timestamptz not null default now()
);
create table if not exists public.ministry_member_history (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.profiles(id), snapshot jsonb not null,
 actor uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table if not exists public.ministry_guests (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 150),
 roles text[] not null default '{}', status text not null default 'active' check(status in ('active','inactive','on-leave')),
 join_date date not null default current_date, created_at timestamptz not null default now()
);
create table if not exists public.ministry_guest_assignments (
 service_id uuid not null references public.services(id),person_id uuid not null references public.ministry_guests(id),
 role text not null check(length(trim(role)) between 1 and 100),status text not null default 'confirmed' check(status in ('confirmed','declined','pending')),
 primary key(service_id,person_id)
);
create table if not exists public.rating_criteria (
 id uuid primary key default gen_random_uuid(),family_id uuid not null default gen_random_uuid(),version integer not null default 1,
 name text not null check(length(trim(name)) between 1 and 150),name_ar text not null default '',
 audience text not null check(audience in ('musician','vocal','leader')),minimum integer not null default 1,maximum integer not null default 5,
 weight numeric not null default 1 check(weight>0 and weight<=1000),display_order integer not null default 0,active boolean not null default true,
 created_at timestamptz not null default now(),check(maximum>minimum and maximum-minimum<=20),unique(family_id,version)
);
create unique index if not exists rating_criteria_active_name on public.rating_criteria(audience,lower(trim(name))) where active;
create table if not exists public.member_ratings (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.profiles(id),audience text not null check(audience in ('musician','vocal','leader')),
 evaluator_id uuid not null references public.profiles(id),scores jsonb not null check(jsonb_typeof(scores)='array'),comment text not null default '',created_at timestamptz not null default now()
);
create table if not exists public.service_evaluations (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.services(id),person_id uuid not null,
 evaluator_id uuid not null references public.profiles(id),audience text not null check(audience in ('musician','vocal','leader')),
 scores jsonb not null check(jsonb_typeof(scores)='array'),comment text not null default '' check(length(comment)<=4000),
 state text not null check(state in ('draft','submitted')),revision integer not null default 1,updated_at timestamptz not null default now(),
 unique(service_id,person_id,evaluator_id,audience)
);
create table if not exists public.evaluation_revisions (
 id uuid primary key default gen_random_uuid(),evaluation_id uuid not null references public.service_evaluations(id),
 snapshot jsonb not null,created_at timestamptz not null default now()
);
create table if not exists public.member_stage_appearances (
 service_id uuid not null references public.services(id),person_id uuid not null,played boolean not null,
 recorded_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),primary key(service_id,person_id)
);
create table if not exists public.assignment_response_history (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.services(id),person_id uuid not null references public.profiles(id),
 request_key text not null,sent_at timestamptz,response text not null check(response in ('confirmed','declined')),
 responded_at timestamptz not null default clock_timestamp(),actor uuid references public.profiles(id)
);
create index if not exists ministry_response_member_idx on public.assignment_response_history(person_id,service_id,responded_at);
create index if not exists ministry_evaluation_service_idx on public.service_evaluations(service_id,person_id);
create index if not exists ministry_rating_member_idx on public.member_ratings(person_id,created_at);
alter table public.service_team add column if not exists invitation_sent_at timestamptz;
alter table public.services add column if not exists subcategory text not null default '' check(length(subcategory)<=100);
alter table public.services add column if not exists setlist_finalized boolean not null default false;
alter table public.songs add column if not exists origin_year integer check(origin_year between 1000 and 2200);
create table if not exists public.song_tag_catalog (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 80),active boolean not null default true
);
create unique index if not exists song_tag_catalog_name_idx on public.song_tag_catalog(lower(trim(name)));
insert into public.song_tag_catalog(name) select distinct trim(tag) from public.songs cross join lateral unnest(themes) tag where length(trim(tag)) between 1 and 80 on conflict do nothing;

-- All new tables default to read-only through RLS; mutations use narrow RPCs.
do $$ declare t text;begin
 foreach t in array array['ministry_access_roles','ministry_members','ministry_member_history','ministry_guests','ministry_guest_assignments','rating_criteria','member_ratings','service_evaluations','evaluation_revisions','member_stage_appearances','assignment_response_history','song_tag_catalog'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
drop policy if exists ministry_roles_read on public.ministry_access_roles;
create policy ministry_roles_read on public.ministry_access_roles for select to authenticated using(public.is_active_member() and (person_id=auth.uid() or public.is_super_admin()));
do $$ declare t text;begin
 foreach t in array array['ministry_members','ministry_guests','ministry_guest_assignments','song_tag_catalog'] loop
 execute format('drop policy if exists ministry_directory_read on public.%I',t);
 execute format('create policy ministry_directory_read on public.%I for select to authenticated using(public.is_active_member())',t);
 end loop;
end $$;
drop policy if exists ministry_member_history_read on public.ministry_member_history;
create policy ministry_member_history_read on public.ministry_member_history for select to authenticated using(public.has_permission('reports.view'));
drop policy if exists criteria_read on public.rating_criteria;
create policy criteria_read on public.rating_criteria for select to authenticated using(public.has_permission('ratings.view') or public.has_permission('ratings.configure') or public.can_evaluate_members());
drop policy if exists ratings_read on public.member_ratings;
create policy ratings_read on public.member_ratings for select to authenticated using(public.has_permission('ratings.view'));
drop policy if exists evaluations_private on public.service_evaluations;
create policy evaluations_private on public.service_evaluations for select to authenticated using(public.can_evaluate_members());
drop policy if exists revisions_private on public.evaluation_revisions;
create policy revisions_private on public.evaluation_revisions for select to authenticated using(public.can_evaluate_members());
drop policy if exists appearances_read on public.member_stage_appearances;
create policy appearances_read on public.member_stage_appearances for select to authenticated using(public.is_active_member() and (public.has_permission('reports.view') or public.has_permission('schedules.manage') or public.can_evaluate_members() or public.schedule_is_leader(service_id) or person_id=auth.uid() or (public.has_permission('reports.own') and exists(select 1 from public.service_team t join public.worship_roles r on r.id=t.worship_role_id where t.service_id=member_stage_appearances.service_id and t.person_id=auth.uid() and t.status<>'declined' and r.schedule_leader_role))));
drop policy if exists responses_read on public.assignment_response_history;
create policy responses_read on public.assignment_response_history for select to authenticated using(public.is_active_member() and (public.has_permission('reports.view') or person_id=auth.uid() or (public.has_permission('reports.own') and exists(select 1 from public.service_team t join public.worship_roles r on r.id=t.worship_role_id where t.service_id=assignment_response_history.service_id and t.person_id=auth.uid() and t.status<>'declined' and r.schedule_leader_role))));

create or replace function public.ministry_set_roles(p_person uuid,p_roles text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_super_admin() then raise exception 'Super Admin required' using errcode='42501';end if;
 if p_roles is null or exists(select 1 from unnest(p_roles) r where r is null or r not in ('technical_admin','musical_admin','pastoral_admin','worship_leader')) then raise exception 'Invalid ministry roles';end if;
 if not exists(select 1 from public.profiles where id=p_person) then raise exception 'Member not found';end if;
 perform pg_advisory_xact_lock(hashtext(p_person::text));
 delete from public.ministry_access_roles where person_id=p_person;
 insert into public.ministry_access_roles(person_id,role) select p_person,r from (select distinct unnest(p_roles) r) x;
 perform public.log_admin_action('ministry.roles.updated','profile',p_person::text,null,to_jsonb(p_roles));
end $$;
create or replace function public.ministry_save_member(p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.ministry_members;
begin
 if not public.has_permission('users.edit') then raise exception 'Member management permission required' using errcode='42501';end if;
 insert into public.ministry_members(person_id,category,serving_status,leader_quote) values((p_data->>'person_id')::uuid,p_data->>'category',p_data->>'serving_status',coalesce(p_data->>'leader_quote',''))
 on conflict(person_id) do update set category=excluded.category,serving_status=excluded.serving_status,leader_quote=excluded.leader_quote,updated_at=now() returning * into saved;
 insert into public.ministry_member_history(person_id,snapshot,actor) values(saved.person_id,to_jsonb(saved),auth.uid());
end $$;
create or replace function public.ministry_save_criterion(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.rating_criteria;saved uuid;
begin
 if not public.has_permission('ratings.configure') then raise exception 'Rating configuration permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(762902);
 if nullif(p_data->>'id','') is not null then
 select * into strict prior from public.rating_criteria where id=(p_data->>'id')::uuid for update;
 update public.rating_criteria set active=false where family_id=prior.family_id;
 end if;
 insert into public.rating_criteria(family_id,version,name,name_ar,audience,minimum,maximum,weight,display_order,active)
 values(coalesce(prior.family_id,gen_random_uuid()),coalesce((select max(version)+1 from public.rating_criteria where family_id=prior.family_id),1),trim(p_data->>'name'),coalesce(p_data->>'name_ar',''),p_data->>'audience',(p_data->>'minimum')::integer,(p_data->>'maximum')::integer,(p_data->>'weight')::numeric,(p_data->>'display_order')::integer,coalesce((p_data->>'active')::boolean,true)) returning id into saved;
 return saved;
end $$;
create or replace function public.ministry_save_rating(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare is_evaluation boolean:=nullif(p_data->>'service_id','') is not null; sid uuid:=(p_data->>'service_id')::uuid;
 pid uuid:=(p_data->>'person_id')::uuid;aud text:=p_data->>'audience';item jsonb;criterion public.rating_criteria;
 snapshots jsonb:='[]';saved uuid;previous public.service_evaluations;
begin
 if is_evaluation then
 if not public.can_evaluate_members() then raise exception 'Technical Admin or Super Admin required' using errcode='42501';end if;
 perform 1 from public.services where id=sid and status='completed' for share;
 if not found then raise exception 'Choose a completed service';end if;
 if not exists(select 1 from public.service_team where service_id=sid and person_id=pid) and not exists(select 1 from public.ministry_guest_assignments where service_id=sid and person_id=pid) then raise exception 'Member must be assigned to this service';end if;
 if coalesce(p_data->>'state','') not in ('draft','submitted') then raise exception 'Invalid evaluation state';end if;
 else
 if not public.has_permission('ratings.'||coalesce(aud,'')) then raise exception 'Rating permission required' using errcode='42501';end if;
 end if;
 if jsonb_typeof(p_data->'scores') is distinct from 'array' or jsonb_array_length(p_data->'scores')>100 then raise exception 'Supply rating scores';end if;
 if (select count(*)<>count(distinct value->>'criterion_id') from jsonb_array_elements(p_data->'scores')) then raise exception 'Duplicate criteria';end if;
 for item in select value from jsonb_array_elements(p_data->'scores') loop
 select * into criterion from public.rating_criteria where id=(item->>'criterion_id')::uuid and active and audience=aud;
 if criterion.id is null or (item->>'value')::numeric<>trunc((item->>'value')::numeric) or (item->>'value')::numeric not between criterion.minimum and criterion.maximum or item->>'value' is null then raise exception 'Invalid rating value or archived criterion';end if;
 snapshots:=snapshots||jsonb_build_array(to_jsonb(criterion)||jsonb_build_object('criterion_id',criterion.id,'value',(item->>'value')::integer));
 end loop;
 if jsonb_array_length(snapshots)=0 and (not is_evaluation or p_data->>'state'='submitted') then raise exception 'Select at least one rating';end if;
 if length(coalesce(p_data->>'comment',''))>4000 then raise exception 'Comment is too long';end if;
 if is_evaluation then
 perform pg_advisory_xact_lock(hashtext(sid::text||pid::text||auth.uid()::text||aud));
 select * into previous from public.service_evaluations where service_id=sid and person_id=pid and evaluator_id=auth.uid() and audience=aud for update;
 if previous.id is not null and coalesce((p_data->>'revision')::integer,0)<>previous.revision then raise exception 'Evaluation changed. Reload before editing.';end if;
 insert into public.service_evaluations(service_id,person_id,evaluator_id,audience,scores,comment,state)
 values(sid,pid,auth.uid(),aud,snapshots,coalesce(p_data->>'comment',''),p_data->>'state')
 on conflict(service_id,person_id,evaluator_id,audience) do update set scores=excluded.scores,comment=excluded.comment,state=excluded.state,revision=service_evaluations.revision+1,updated_at=now() returning id into saved;
 insert into public.evaluation_revisions(evaluation_id,snapshot) select saved,to_jsonb(e) from public.service_evaluations e where id=saved;
 else
 insert into public.member_ratings(person_id,audience,evaluator_id,scores,comment) values(pid,aud,auth.uid(),snapshots,coalesce(p_data->>'comment','')) returning id into saved;
 end if;
 return saved;
end $$;
create or replace function public.ministry_save_guest(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved uuid;
begin
 if not public.has_permission('users.edit') then raise exception 'Member management permission required' using errcode='42501';end if;
 insert into public.ministry_guests(id,name,roles,status) values(coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()),trim(p_data->>'name'),array(select jsonb_array_elements_text(p_data->'roles')),coalesce(p_data->>'status','active'))
 on conflict(id) do update set name=excluded.name,roles=excluded.roles,status=excluded.status returning id into saved;return saved;
end $$;
create or replace function public.ministry_assign_guest(p_service uuid,p_guest uuid,p_role text,p_remove boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_permission('schedules.manage') then raise exception 'Schedule management permission required' using errcode='42501';end if;
 perform 1 from public.services where id=p_service and status in ('draft','scheduled') for update;
 if not found then raise exception 'Choose an active event';end if;
 if p_remove then delete from public.ministry_guest_assignments where service_id=p_service and person_id=p_guest;return;end if;
 if not exists(select 1 from public.ministry_guests where id=p_guest and status='active' and p_role=any(roles)) then raise exception 'Choose an active guest and matching role';end if;
 insert into public.ministry_guest_assignments(service_id,person_id,role) values(p_service,p_guest,p_role) on conflict(service_id,person_id) do update set role=excluded.role;
end $$;
create or replace function public.ministry_record_stage(p_service uuid,p_person uuid,p_played boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not (public.has_permission('schedules.manage') or public.can_evaluate_members() or public.schedule_is_leader(p_service)) then raise exception 'Service manager permission required' using errcode='42501';end if;
 if not exists(select 1 from public.services where id=p_service and status='completed') then raise exception 'Choose a completed service';end if;
 if not exists(select 1 from public.service_team where service_id=p_service and person_id=p_person) and not exists(select 1 from public.ministry_guest_assignments where service_id=p_service and person_id=p_person) then raise exception 'Choose an assigned participant';end if;
 insert into public.member_stage_appearances(service_id,person_id,played,recorded_by) values(p_service,p_person,p_played,auth.uid()) on conflict(service_id,person_id) do update set played=excluded.played,recorded_by=excluded.recorded_by,updated_at=now();
end $$;
create or replace function public.ministry_complete_service(p_service uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.services;
begin
 if not (public.has_permission('services.edit') or public.has_permission('schedules.manage')) then raise exception 'Service manager required' using errcode='42501';end if;
 select * into strict event from public.services where id=p_service for update;
 if event.status='completed' then return;end if;
 if event.status<>'scheduled' or event.published_at is null then raise exception 'Publish this event before completing it';end if;
 if event.end_time is null or (coalesce(event.end_date,event.date)+event.end_time::time) at time zone 'Africa/Cairo'>now() then raise exception 'Complete this event after its scheduled end time';end if;
 update public.services set status='completed' where id=p_service;
end $$;
create or replace function public.ministry_finalize_setlist(p_service uuid,p_finalized boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not (public.has_permission('services.edit') or public.schedule_is_leader(p_service)) then raise exception 'Service editor permission required' using errcode='42501';end if;
 update public.services set setlist_finalized=p_finalized where id=p_service and status='completed';
 if not found then raise exception 'Choose a completed service';end if;
end $$;

-- Publish time is the start of the response clock, never assignment creation time.
create or replace function public.ministry_capture_response()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='schedule_notifications' then
 if new.kind in ('assignment','replacement_assignment') then
 update public.service_team set invitation_sent_at=coalesce(invitation_sent_at,new.created_at) where service_id=new.service_id and person_id=new.recipient;
 end if;
 elsif tg_table_name='service_team' then
 if auth.uid()=new.person_id and new.status is distinct from old.status and new.status in ('confirmed','declined') then
 insert into public.assignment_response_history(service_id,person_id,request_key,sent_at,response,actor) values(new.service_id,new.person_id,new.id::text,new.invitation_sent_at,new.status,auth.uid());
 end if;
 end if;return new;
end $$;
drop trigger if exists ministry_response_history on public.service_team;
create trigger ministry_response_history after update of status on public.service_team for each row execute function public.ministry_capture_response();
drop trigger if exists ministry_notification_clock on public.schedule_notifications;
create trigger ministry_notification_clock after insert on public.schedule_notifications for each row execute function public.ministry_capture_response();

create or replace function public.ministry_bulk_schedule(p_events jsonb)
returns setof uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb;
begin
 if not public.has_permission('schedules.manage') then raise exception 'Schedule manager required' using errcode='42501';end if;
 if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 52 then raise exception 'Import 1–52 events at a time';end if;
 perform pg_advisory_xact_lock(762901);
 if (select count(*)<>count(distinct (value->>'date',value->>'time',lower(trim(value->>'title')))) from jsonb_array_elements(p_events)) then raise exception 'Duplicate events in upload';end if;
 for e in select value from jsonb_array_elements(p_events) loop
 if exists(select 1 from public.services where date=(e->>'date')::date and time=e->>'time' and lower(trim(title))=lower(trim(e->>'title'))) then raise exception 'An event already exists: %',e->>'title';end if;
 end loop;
 return query select * from public.save_planning_events(p_events,false);
 for e in select value from jsonb_array_elements(p_events) loop update public.services set subcategory=coalesce(e->>'subcategory','') where id=(e->>'id')::uuid;end loop;
end $$;
create or replace function public.save_song_with_metadata(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved uuid;tag text;canonical_tags text[]:='{}';
begin
 if not public.has_permission('songs.manage') then raise exception 'Song management permission required' using errcode='42501';end if;
 for tag in select trim(value) from jsonb_array_elements_text(p_data->'p_themes') with ordinality tags(value,n) where trim(value)<>'' order by n loop
 if length(tag)>80 then raise exception 'Tags must be 80 characters or fewer';end if;
 insert into public.song_tag_catalog(name) values(tag) on conflict do nothing;
 select name into tag from public.song_tag_catalog where lower(trim(name))=lower(trim(tag));
 canonical_tags:=array_append(canonical_tags,tag);
 end loop;
 canonical_tags:=array(select distinct unnest(canonical_tags));
 saved:=public.save_song_library_entry((p_data->>'p_song_id')::uuid,p_data->>'p_title',p_data->>'p_title_ar',p_data->>'p_author',p_data->>'p_key',(p_data->>'p_bpm')::integer,p_data->>'p_time_signature',p_data->>'p_language',canonical_tags,array(select jsonb_array_elements_text(p_data->'p_sequence')),p_data->>'p_notes',p_data->>'p_ccli_number',p_data->>'p_lyrics',p_data->'p_lyrics_sections',p_data->>'p_pro_chords');
 update public.songs set origin_year=nullif(p_data->>'origin_year','')::integer where id=saved;return saved;
end $$;
create or replace function public.ministry_manage_tag(p_id uuid,p_name text,p_active boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare old_name text;canonical text;
begin
 if not public.has_permission('songs.manage') then raise exception 'Song management permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(762903);
 if p_id is null then insert into public.song_tag_catalog(name,active) values(trim(p_name),p_active);return;end if;
 select name into strict old_name from public.song_tag_catalog where id=p_id for update;
 select name into canonical from public.song_tag_catalog where lower(trim(name))=lower(trim(p_name)) and id<>p_id;
 if canonical is null then update public.song_tag_catalog set name=trim(p_name),active=p_active where id=p_id;canonical:=trim(p_name);
 else update public.song_tag_catalog set active=false where id=p_id;end if;
 update public.songs set themes=array(select distinct case when lower(trim(t))=lower(trim(old_name)) then canonical else t end from unnest(themes) t) where exists(select 1 from unnest(themes) t where lower(trim(t))=lower(trim(old_name)));
end $$;

create or replace function public.schedule_eligible(p_slot uuid,p_person uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
 select 1 from public.schedule_slots sl join public.services s on s.id=sl.service_id
 join public.profiles p on p.id=p_person
 join public.worship_roles wr on wr.id=sl.role_id and wr.active
 where sl.id=p_slot and p.status='active' and not exists(select 1 from public.ministry_members mm where mm.person_id=p.id and mm.serving_status<>'active') and s.status='scheduled'
 and s.date >= (now() at time zone 'Africa/Cairo')::date
 and exists(select 1 from public.profile_worship_roles pr where pr.profile_id=p.id and pr.role_id=sl.role_id)
 and not exists(select 1 from public.schedule_attempts a where a.slot_id=sl.id and a.person_id=p.id and a.state in ('declined','rejected'))
 and not exists(select 1 from public.schedule_attempts a join public.schedule_slots x on x.id=a.slot_id where x.service_id=s.id and a.person_id=p.id and a.state='declined')
 and not exists(select 1 from public.service_team t where t.service_id=s.id and t.person_id=p.id and t.status='declined')
 and not exists(select 1 from public.schedule_slots other where other.service_id=s.id and other.id<>sl.id and other.person_id=p.id)
 and not exists(select 1 from public.schedule_attempts a join public.schedule_slots other on other.id=a.slot_id where other.service_id=s.id and other.id<>sl.id and a.person_id=p.id and a.state='proposed')
 and not exists(select 1 from public.excuses e where e.person_id=p.id and e.service_id=s.id and e.status in ('pending','approved'))
 and not exists(
   select 1 from (select d::date as day,case when d::date=s.date then s.time else '00:00' end as clock,
       case when d::date=coalesce(s.end_date,s.date) then coalesce(s.end_time,s.time) else '24:00' end as until
     from generate_series(s.date::timestamp,coalesce(s.end_date,s.date)::timestamp,interval '1 day') d
     where d::date<coalesce(s.end_date,s.date) or coalesce(s.end_time,'00:01')<>'00:00'
     union all select (s.practice->>'date')::date,s.practice->>'time',s.practice->>'time' where s.practice->>'enabled'='true') needed
   where (exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')))
       and not exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')) and ts->>'from' <= needed.clock and ts->>'to' > needed.clock and ts->>'to' >= needed.until))
   or exists(select 1 from public.services other where other.id<>s.id and other.status in ('scheduled','draft') and other.archived_at is null
     and (needed.day between other.date and coalesce(other.end_date,other.date) or (other.practice->>'enabled'='true' and other.practice->>'date'=needed.day::text))
     and (exists(select 1 from public.schedule_slots os where os.service_id=other.id and os.person_id=p.id)
       or (not exists(select 1 from public.schedule_slots os where os.service_id=other.id)
         and exists(select 1 from public.service_team ot where ot.service_id=other.id and ot.person_id=p.id and ot.status<>'declined'))
       or exists(select 1 from public.schedule_attempts oa join public.schedule_slots os on os.id=oa.slot_id where os.service_id=other.id and oa.person_id=p.id and oa.state='proposed')))
  )
 );
$$;

create or replace function public.ministry_save_subcategory(p_service uuid,p_subcategory text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_permission('services.edit') then raise exception 'Service editor permission required' using errcode='42501';end if;
 update public.services set subcategory=trim(p_subcategory) where id=p_service and status<>'cancelled';
 if not found then raise exception 'Choose an active service';end if;
end $$;

create or replace function public.guard_calendar_event()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(762901);
 if tg_op='DELETE' then raise exception 'Cancel events to preserve attendance and history'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.published_at is not null then raise exception 'Publish events through the quarterly workflow'; end if;
 if tg_op='UPDATE' and old.published_at is not null then
   if (to_jsonb(new)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency','attendance_enabled','late_tolerance_mode','late_tolerance_minutes','subcategory','setlist_finalized']) is distinct from (to_jsonb(old)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency','attendance_enabled','late_tolerance_mode','late_tolerance_minutes','subcategory','setlist_finalized']) then raise exception 'Published schedule is locked; cancel and create a corrected event'; end if;
   if old.status='cancelled' and new.status<>'cancelled' then raise exception 'Cancelled published events cannot be reactivated'; end if;
 end if;
 if new.published_at is null and new.status='completed' and tg_op='UPDATE' and old.status<>'completed' then raise exception 'Publish before completing an event'; end if;
 if new.end_date is null then new.end_date:=new.date; end if;
 -- Validate changed/new scheduling fields. Legacy unknown end times remain explicit
 -- until a manager edits that schedule; quarter publication requires completion.
 if tg_op='INSERT' or (new.date,new.time,new.end_date,new.end_time,new.event_kind,new.location_url) is distinct from (old.date,old.time,old.end_date,old.end_time,old.event_kind,old.location_url) then
   if coalesce(new.time,'')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Valid start time required'; end if;
   if new.end_time is not null and new.end_time!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Valid end time required'; end if;
   if new.end_date<new.date or new.end_date>new.date+31 or (new.end_time is not null and new.end_date+new.end_time::time<=new.date+new.time::time) then raise exception 'End must follow start, within 31 days'; end if;
   if new.end_date<>new.date and new.event_kind not in ('prayer_shift','conference','custom') then raise exception 'Only conferences, prayer shifts and custom events span multiple days'; end if;
   if new.location_url<>'' and (new.location_url!~*'^https?://[^/[:space:]@]+' or new.location_url~*'^https?://[^/]*@' or new.location_url~'[[:space:]]') then raise exception 'Valid HTTP/HTTPS location link required'; end if;
   if ((new.date+new.time::time) at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' <> new.date+new.time::time or (new.end_time is not null and ((new.end_date+new.end_time::time) at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' <> new.end_date+new.end_time::time) then raise exception 'This Cairo time does not exist during the daylight-saving change'; end if;
   if new.status<>'cancelled' and new.archived_at is null and exists(select 1 from public.services s where s.id<>new.id and s.archived_at is null and s.status<>'cancelled' and lower(trim(s.title))=lower(trim(new.title)) and s.date=new.date and s.time=new.time and s.event_kind=new.event_kind) then raise exception 'This event already exists at the selected date and time'; end if;
 end if;
 return new;
end;
$$;

create or replace function public.ministry_setlist_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op<>'INSERT' then update public.services set setlist_finalized=false where id=old.service_id and setlist_finalized;end if;
 if tg_op<>'DELETE' then update public.services set setlist_finalized=false where id=new.service_id and setlist_finalized;return new;end if;
 return old;
end $$;
drop trigger if exists ministry_setlist_changed on public.setlist_items;
create trigger ministry_setlist_changed after insert or update or delete on public.setlist_items for each row execute function public.ministry_setlist_changed();
revoke all on function public.ministry_setlist_changed() from public,anon,authenticated;

-- Internal trigger functions cannot be invoked as application endpoints.
revoke all on function public.ministry_capture_response() from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname in ('has_ministry_role','can_evaluate_members','save_song_with_metadata','get_report_attendance_sessions') or p.proname like 'ministry_%') and p.proname not in ('ministry_capture_response','ministry_setlist_changed') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
