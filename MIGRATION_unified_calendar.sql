-- Apply after quarterly scheduling and rehearsal migrations. No cleanup or notifications here.
begin;
alter table public.services add column if not exists event_kind text not null default 'service'
  check(event_kind in ('youth_meeting','service','general_meeting','prayer_shift','conference'));
alter table public.services add column if not exists end_date date;
alter table public.services add column if not exists end_time text;
alter table public.services add column if not exists location text not null default '';
alter table public.services add column if not exists location_url text not null default '';
alter table public.services add column if not exists timezone text not null default 'Africa/Cairo' check(timezone='Africa/Cairo');
alter table public.services add column if not exists published_at timestamptz;
alter table public.services add column if not exists archived_at timestamptz;
alter table public.events add column if not exists calendar_service_id uuid references public.services(id);
alter table public.services alter column status set default 'draft';

-- Run backfill once. Subsequent reruns must not reinterpret newly saved draft events.
create table if not exists public.calendar_migration_runs(key text primary key,applied_at timestamptz not null default now());
alter table public.calendar_migration_runs enable row level security;
revoke all on public.calendar_migration_runs from public,anon,authenticated;
do $backfill$ begin
 if not exists(select 1 from public.calendar_migration_runs where key='unified-calendar-v1') then
   update public.services set event_kind=case
     when weekly_template_key='youth' or lower(trim(title)) in ('youth meeting','اجتماع الشباب') then 'youth_meeting'
     when type ~* '(conference|مؤتمر)' then 'conference'
     when type ~* '(prayer|صلاة)' then 'prayer_shift'
     when type ~* '(meeting|اجتماع)' then 'general_meeting' else 'service' end,
     end_date=date,
     published_at=case when exists(select 1 from public.schedule_slots sl where sl.service_id=services.id) then coalesce((select q.published_at from public.schedule_quarters q where q.starts_on=date_trunc('quarter',services.date)::date),now()) else null end;
   -- Previously unpublished scheduled records become drafts; original assignment trigger
   -- accepts drafts after the function replacement below. No assignment values are altered.
   update public.services set status='draft' where published_at is null and status='scheduled';
   insert into public.calendar_migration_runs(key) values('unified-calendar-v1');
 end if;
end $backfill$;

-- Retain legacy Events/RSVP IDs and map them to canonical services. Match an existing
-- identical gathering rather than displaying a second copy. No legacy records are deleted.
do $events$ declare e public.events; sid uuid; begin
 for e in select * from public.events where calendar_service_id is null order by created_at,id for update loop
   select id into sid from public.services where date=e.date and time=e.time and lower(trim(title)) in (lower(trim(e.title)),lower(trim(e.title_ar))) order by created_at,id limit 1;
   if sid is null then
     insert into public.services(title,date,time,type,event_kind,status,end_date,location,notes,created_by,published_at)
     values(e.title,e.date,e.time,e.type,case when lower(trim(e.title))='youth meeting' or trim(e.title_ar)='اجتماع الشباب' then 'youth_meeting' when e.type ~* '(conference|camp|مؤتمر)' then 'conference' else 'general_meeting' end,
       case when e.status='cancelled' then 'cancelled' when e.status='past' then 'completed' else 'draft' end,
       coalesce(e.end_date,e.date),e.location,concat_ws(E'\n',nullif(e.description,''),nullif(e.description_ar,'')),e.created_by,case when e.status='past' then e.created_at else null end) returning id into sid;
   end if;
   update public.events set calendar_service_id=sid where id=e.id;
 end loop;
end $events$;

create or replace function public.calendar_can_view(p_service uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and exists(select 1 from public.services s where s.id=p_service and
   (public.has_permission('schedules.manage') or public.has_permission('services.edit') or public.has_permission('services.create') or (s.published_at is not null and s.archived_at is null)));
$$;
revoke all on function public.calendar_can_view(uuid) from public,anon;
grant execute on function public.calendar_can_view(uuid) to authenticated;
-- Restrictive policies also constrain existing permissive ALL policies on child tables.
drop policy if exists calendar_visibility on public.services;
create policy calendar_visibility on public.services as restrictive for select to authenticated using(public.calendar_can_view(id));
drop policy if exists calendar_visibility on public.service_team;
create policy calendar_visibility on public.service_team as restrictive for select to authenticated using(public.calendar_can_view(service_id));
drop policy if exists calendar_visibility on public.setlist_items;
create policy calendar_visibility on public.setlist_items as restrictive for select to authenticated using(public.calendar_can_view(service_id));
drop policy if exists calendar_visibility on public.events;
create policy calendar_visibility on public.events as restrictive for select to authenticated using(public.calendar_can_view(calendar_service_id));
drop policy if exists calendar_visibility on public.event_responses;
create policy calendar_visibility on public.event_responses as restrictive for select to authenticated using(exists(select 1 from public.events e where e.id=event_id and public.calendar_can_view(e.calendar_service_id)));
drop policy if exists calendar_response_privacy on public.event_responses;
create policy calendar_response_privacy on public.event_responses as restrictive for select to authenticated using(person_id=auth.uid() or public.has_permission('events.manage') or public.has_permission('schedules.manage'));
-- Close the legacy parallel event writer. Canonical planning is the only new event path.
revoke insert,update,delete on public.events from authenticated;
revoke truncate,references,trigger on public.services from authenticated,anon;

drop policy if exists "Authorized users can create services" on public.services;
create policy "Authorized users can create services" on public.services for insert to authenticated with check((public.has_permission('services.create') or public.has_permission('schedules.manage')) and created_by=auth.uid());
drop policy if exists "Authorized users can update services" on public.services;
create policy "Authorized users can update services" on public.services for update to authenticated using(public.has_permission('services.edit') or public.has_permission('schedules.manage')) with check(public.has_permission('services.edit') or public.has_permission('schedules.manage'));
-- Never expose the publication/archive columns to direct client writes. Security-definer
-- RPCs own those fields; SQL owner migrations can still backfill and restore snapshots.
revoke insert,update on public.services from authenticated;
grant insert(title,date,time,type,status,notes,practice,created_by,recurrence_group_id,recurrence_index,recurrence_frequency,event_kind,end_date,end_time,location,location_url,timezone,id,weekly_template_key,soundcheck_time,setlist_blocks) on public.services to authenticated;
grant update(title,date,time,type,status,notes,practice,recurrence_group_id,recurrence_index,recurrence_frequency,event_kind,end_date,end_time,location,location_url,timezone,soundcheck_time,setlist_blocks) on public.services to authenticated;

create or replace function public.guard_calendar_event()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(762901);
 if tg_op='DELETE' then raise exception 'Cancel events to preserve attendance and history'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.published_at is not null then raise exception 'Publish events through the quarterly workflow'; end if;
 if tg_op='UPDATE' and old.published_at is not null then
   if (to_jsonb(new)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency']) is distinct from (to_jsonb(old)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency']) then raise exception 'Published schedule is locked; cancel and create a corrected event'; end if;
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
   if new.end_date<>new.date and new.event_kind not in ('prayer_shift','conference') then raise exception 'Only conferences and prayer shifts span multiple days'; end if;
   if new.location_url<>'' and (new.location_url!~*'^https?://[^/[:space:]@]+' or new.location_url~*'^https?://[^/]*@' or new.location_url~'[[:space:]]') then raise exception 'Valid HTTP/HTTPS location link required'; end if;
   if ((new.date+new.time::time) at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' <> new.date+new.time::time or (new.end_time is not null and ((new.end_date+new.end_time::time) at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' <> new.end_date+new.end_time::time) then raise exception 'This Cairo time does not exist during the daylight-saving change'; end if;
   if new.status<>'cancelled' and new.archived_at is null and exists(select 1 from public.services s where s.id<>new.id and s.archived_at is null and s.status<>'cancelled' and lower(trim(s.title))=lower(trim(new.title)) and s.date=new.date and s.time=new.time and s.event_kind=new.event_kind) then raise exception 'This event already exists at the selected date and time'; end if;
 end if;
 return new;
end;
$$;
drop trigger if exists guard_calendar_event on public.services;
create trigger guard_calendar_event before insert or update or delete on public.services for each row execute function public.guard_calendar_event();

create or replace function public.save_planning_events(p_events jsonb,p_edit boolean default false)
returns setof uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb; m jsonb; sid uuid; existing public.services; role_name text;
begin
 if not public.is_active_member() or not (public.has_permission('schedules.manage') or public.has_permission(case when p_edit then 'services.edit' else 'services.create' end)) then raise exception 'Schedule management permission required' using errcode='42501'; end if;
 if p_edit is null or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 52 or (p_edit and jsonb_array_length(p_events)<>1) then raise exception 'Supply 1–52 events, or one event when editing'; end if;
 perform pg_advisory_xact_lock(762901);
 for e in select value from jsonb_array_elements(p_events) loop
   sid:=(e->>'id')::uuid;
   if sid is null or nullif(trim(e->>'title'),'') is null or length(e->>'title')>200 or nullif(e->>'end_time','') is null or nullif(e->>'end_date','') is null then raise exception 'Title, dates, start and end times are required'; end if;
   if jsonb_typeof(e->'team') is distinct from 'array' then raise exception 'Team must be an array'; end if;
   if e->>'event_kind' not in ('youth_meeting','service','general_meeting','prayer_shift','conference') or e->>'event_kind' is null then raise exception 'Choose a supported event type'; end if;
   select * into existing from public.services where id=sid for update;
   if p_edit then
     if existing.id is null or existing.published_at is not null or existing.archived_at is not null or existing.status='cancelled' then raise exception 'Only active unpublished drafts can be edited'; end if;
     update public.services set title=trim(e->>'title'),event_kind=e->>'event_kind',type=e->>'event_kind',date=(e->>'date')::date,time=e->>'time',end_date=(e->>'end_date')::date,end_time=e->>'end_time',location=coalesce(e->>'location',''),location_url=coalesce(e->>'location_url',''),notes=coalesce(e->>'notes',''),practice=nullif(e->'practice','null'::jsonb) where id=sid;
   else
     if existing.id is not null then raise exception 'Event already exists; reload before retrying'; end if;
     insert into public.services(id,title,date,time,end_date,end_time,event_kind,type,status,location,location_url,notes,practice,created_by,recurrence_group_id,recurrence_index,recurrence_frequency)
     values(sid,trim(e->>'title'),(e->>'date')::date,e->>'time',(e->>'end_date')::date,e->>'end_time',e->>'event_kind',e->>'event_kind','draft',coalesce(e->>'location',''),coalesce(e->>'location_url',''),coalesce(e->>'notes',''),nullif(e->'practice','null'::jsonb),auth.uid(),(e->>'recurrence_group_id')::uuid,coalesce((e->>'recurrence_index')::integer,0),e->>'recurrence_frequency');
   end if;
   if (select count(*)<>count(distinct value->>'person_id') from jsonb_array_elements(e->'team')) then raise exception 'A member can be assigned only once per event'; end if;
   -- Keep unchanged assignment IDs/status/history. Never wholesale replace team rows.
   delete from public.service_team t where service_id=sid and not exists(select 1 from jsonb_array_elements(e->'team') x where x->>'person_id'=t.person_id::text);
   for m in select value from jsonb_array_elements(e->'team') loop
     if not exists(select 1 from public.profiles where id=(m->>'person_id')::uuid and status='active') then raise exception 'Choose an active member'; end if;
     select r.name into role_name from public.worship_roles r join public.profile_worship_roles pr on pr.role_id=r.id where r.id=(m->>'worship_role_id')::uuid and pr.profile_id=(m->>'person_id')::uuid and r.active;
     if role_name is null then raise exception 'Choose an active role assigned to this member'; end if;
     if exists(select 1 from public.service_team where service_id=sid and person_id=(m->>'person_id')::uuid) then
       update public.service_team set worship_role_id=(m->>'worship_role_id')::uuid,role=role_name where service_id=sid and person_id=(m->>'person_id')::uuid and worship_role_id is distinct from (m->>'worship_role_id')::uuid;
     else insert into public.service_team(service_id,person_id,worship_role_id,role,status) values(sid,(m->>'person_id')::uuid,(m->>'worship_role_id')::uuid,role_name,'pending'); end if;
   end loop;
   return next sid;
 end loop;
 return;
end;
$$;
revoke all on function public.save_planning_events(jsonb,boolean) from public,anon;
grant execute on function public.save_planning_events(jsonb,boolean) to authenticated;

-- Preserve the protected quarterly state machine and notification dedupe keys.
create or replace function public.publish_schedule_quarter(p_start date)
returns void language plpgsql security definer set search_path=public as $$
declare svc public.services; t public.service_team; sid uuid;
begin
 if not public.is_active_member() or not public.has_permission('schedules.manage') then raise exception 'Schedule manager permission required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(762901);
 if p_start is null or p_start<>date_trunc('quarter',p_start)::date then raise exception 'Choose a quarter start'; end if;
 if p_start+interval '3 months' <= (now() at time zone 'Africa/Cairo')::date then raise exception 'Cannot publish a past quarter'; end if;
 if not exists(select 1 from public.services where date>=greatest(p_start,(now() at time zone 'Africa/Cairo')::date) and date<p_start+interval '3 months' and status in ('scheduled','draft') and archived_at is null) then raise exception 'Create upcoming services before publishing'; end if;
 insert into public.schedule_quarters(starts_on,published_by) values(p_start,auth.uid()) on conflict do nothing;
 for svc in select * from public.services where date>=greatest(p_start,(now() at time zone 'Africa/Cairo')::date) and date<p_start+interval '3 months' and status in ('scheduled','draft') and archived_at is null and published_at is null order by id for update loop
   if exists(select 1 from public.substitute_requests where service_id=svc.id and status in ('open','filled')) then raise exception 'Resolve legacy substitute requests or keep this service in the legacy workflow before publishing'; end if;
   if svc.end_time is null then raise exception 'Set an end time before publishing: %',svc.title; end if;
   if svc.event_kind in ('youth_meeting','service') and (select count(*) from public.service_team assignment join public.worship_roles r on r.id=assignment.worship_role_id where assignment.service_id=svc.id and r.schedule_leader_role)<>1 then raise exception 'Each service needs exactly one Worship Leader'; end if;
   update public.services set status='scheduled',published_at=now() where id=svc.id;
   for t in select * from public.service_team where service_id=svc.id order by id for update loop
     if not exists(select 1 from public.profile_worship_roles pr join public.worship_roles wr on wr.id=pr.role_id and wr.active where pr.profile_id=t.person_id and pr.role_id=t.worship_role_id) then raise exception 'Every assignment needs an active matching member role'; end if;
     if t.worship_role_id is null then raise exception 'Every assignment requires a role'; end if;
     if not exists(select 1 from public.profiles where id=t.person_id and status='active') then raise exception 'Remove inactive team assignments before publishing'; end if;
     insert into public.schedule_slots(quarter,service_id,role_id,role,leader,person_id,state,source_assignment)
       values(p_start,svc.id,t.worship_role_id,t.role,(select schedule_leader_role from public.worship_roles where id=t.worship_role_id),case when t.status='declined' then null else t.person_id end,
         case when t.status='declined' then 'vacant' else t.status end,t.id) returning id into sid;
     insert into public.schedule_attempts(slot_id,person_id,state,replacement) values(sid,t.person_id,case when t.status='pending' then 'notified' else t.status end,false);
     insert into public.schedule_audit(slot_id,actor,action,person_id) values(sid,auth.uid(),'published',t.person_id);
     if t.status<>'declined' then perform public.schedule_notify(t.person_id,svc.id,'assignment',sid||':published'); end if;
   end loop;
 end loop;
 for sid in select id from public.schedule_slots where quarter=p_start and state='vacant' loop perform public.schedule_propose(sid); end loop;
end;
$$;

create or replace function public.protect_service_team_assignment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_timezone text;
begin
 if tg_op<>'DELETE' and pg_trigger_depth()>1 and exists(
   select 1 from public.schedule_slots s where s.service_id=new.service_id and s.role_id=new.worship_role_id
   and ((s.person_id=new.person_id and s.state=new.status) or (new.status='declined' and exists(select 1 from public.schedule_attempts a where a.slot_id=s.id and a.person_id=new.person_id and a.state='declined')))
 ) then return new; end if;
 if tg_op='DELETE' then
   if exists(select 1 from public.excuses e where e.service_id=old.service_id and e.person_id=old.person_id and e.status in ('pending','approved')) then raise exception 'Resolve the active excuse before deleting this assignment' using errcode='23503'; end if;
   if exists(select 1 from public.substitute_requests r where r.service_id=old.service_id and ((r.requester_id=old.person_id and r.status in ('open','filled')) or (r.substitute_id=old.person_id and r.status='filled'))) then raise exception 'Resolve linked substitute requests before deleting this assignment' using errcode='23503'; end if;
   return old;
 end if;
 if tg_op='UPDATE' and auth.uid() is not null and not (public.can_manage_worship() or public.has_permission('schedules.manage')) and
   (old.person_id<>auth.uid() or new.id is distinct from old.id or new.service_id is distinct from old.service_id or new.person_id is distinct from old.person_id or new.role is distinct from old.role or new.created_at is distinct from old.created_at) then raise exception 'Members may only update their own response status'; end if;
 if auth.uid() is not null and not (public.can_manage_worship() or public.has_permission('schedules.manage')) and not exists(select 1 from public.services where id=new.service_id and published_at is not null) then raise exception 'Members can respond only to published assignments' using errcode='42501'; end if;
 select timezone into v_timezone from public.organization_settings where id=1;
 if not exists(select 1 from public.services where id=new.service_id and status in ('scheduled','draft') and archived_at is null and date>=(clock_timestamp() at time zone coalesce(v_timezone,'Africa/Cairo'))::date for no key update) then raise exception 'Assignments may only change for scheduled, non-past services' using errcode='22023'; end if;
 if new.status<>'declined' and exists(select 1 from public.excuses e where e.service_id=new.service_id and e.person_id=new.person_id and e.status in ('pending','approved')) then raise exception 'An assignment with an active excuse must remain declined' using errcode='22023'; end if;
 if exists(select 1 from public.substitute_requests r where r.service_id=new.service_id and r.requester_id=new.person_id and r.status='filled' and (r.role is distinct from new.role or new.status<>'declined')) then raise exception 'A replaced requester assignment must remain declined and keep its role' using errcode='22023'; end if;
 if exists(select 1 from public.substitute_requests r where r.service_id=new.service_id and r.substitute_id=new.person_id and r.status='filled' and (r.role is distinct from new.role or new.status='declined')) then raise exception 'A filled substitute assignment cannot be declined or change role' using errcode='22023'; end if;
 return new;
end;
$$;

create or replace function public.guard_published_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
 perform pg_advisory_xact_lock(762901);
 if tg_table_name='service_team' then
   sid:=case when tg_op='DELETE' then old.service_id else new.service_id end;
   if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
   -- Canonical role renaming is metadata only; published role labels remain snapshots.
   if tg_op='UPDATE' and public.has_permission('roles.manage') and
     (to_jsonb(new)-'role')=(to_jsonb(old)-'role') and exists(select 1 from public.worship_roles r where r.id=new.worship_role_id and r.name=new.role) then return new; end if;
   if tg_op<>'DELETE' and pg_trigger_depth()>1 and exists(
     select 1 from public.schedule_slots sl where sl.service_id=new.service_id and sl.role_id=new.worship_role_id
     and ((sl.person_id=new.person_id and sl.state=new.status) or (new.status='declined' and exists(select 1 from public.schedule_attempts a where a.slot_id=sl.id and a.person_id=new.person_id and a.state='declined')))
   ) and (tg_op='INSERT' or (old.id=new.id and old.service_id=new.service_id and old.person_id=new.person_id and old.worship_role_id=new.worship_role_id and old.role=new.role)) then return new; end if;
   if exists(select 1 from public.services where id=sid and published_at is not null) then raise exception 'Published assignments must use the quarterly workflow'; end if;
   if tg_op='UPDATE' and exists(select 1 from public.services where id=old.service_id and published_at is not null) then raise exception 'Published assignments cannot be moved'; end if;
 else
   if exists(select 1 from public.schedule_slots where service_id=old.id) and
     (tg_op='DELETE' or new.date is distinct from old.date or new.time is distinct from old.time or new.practice is distinct from old.practice) then
     raise exception 'Published schedule dates and rehearsals are locked; create a new service for a changed meeting';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end;
$$;

create or replace function public.schedule_eligible(p_slot uuid,p_person uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
 select 1 from public.schedule_slots sl join public.services s on s.id=sl.service_id
 join public.profiles p on p.id=p_person
 join public.worship_roles wr on wr.id=sl.role_id and wr.active
 where sl.id=p_slot and p.status='active' and s.status='scheduled'
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
   where coalesce(p.availability->>lower(to_char(needed.day,'Dy')),'false') <> 'true'
   or (exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')))
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

create or replace function public.schedule_propose(p_slot uuid)
returns void language plpgsql security definer set search_path=public as $$
declare sl public.schedule_slots; candidate uuid; leader_id uuid; aid uuid; admin_id uuid;
begin
 select * into sl from public.schedule_slots where id=p_slot for update;
 if sl.id is null or sl.state<>'vacant' or exists(select 1 from public.schedule_attempts where slot_id=p_slot and state='proposed') then return; end if;
 if not exists(select 1 from public.services where id=sl.service_id and status='scheduled' and date>=(now() at time zone 'Africa/Cairo')::date) then return; end if;
 if sl.leader then
   for admin_id in select id from public.profiles where access_level='super_admin' and status='active' loop
     perform public.schedule_notify(admin_id,sl.service_id,'leader_required',sl.id||':leader:'||sl.version||':'||admin_id);
   end loop;
   return;
 end if;
 select person_id into leader_id from public.schedule_slots where service_id=sl.service_id and leader and state='confirmed';
 if leader_id is null then return; end if;
 -- Exponential race implements weighted random sampling: weight=1/(1+assignments+2*replacement offers).
 select p.id into candidate from public.profiles p where public.schedule_eligible(sl.id,p.id)
 and not exists(select 1 from public.schedule_attempts a where a.slot_id=sl.id and a.person_id=p.id)
 order by -ln(greatest(random(),0.000000001)) * (1+
   (select count(*) from public.schedule_slots x join public.services s on s.id=x.service_id where x.quarter=sl.quarter and x.person_id=p.id and s.status<>'cancelled' and s.archived_at is null)+
   (select count(*) from public.service_team t join public.services s on s.id=t.service_id where t.person_id=p.id and t.status<>'declined' and s.status in ('scheduled','draft') and s.archived_at is null and s.date>=sl.quarter and s.date<sl.quarter+interval '3 months' and not exists(select 1 from public.schedule_slots x where x.service_id=s.id))+
   2*(select count(*) from public.schedule_attempts a join public.schedule_slots x on x.id=a.slot_id join public.services s on s.id=x.service_id where x.quarter=sl.quarter and s.status<>'cancelled' and s.archived_at is null and a.person_id=p.id and a.replacement and a.state in ('proposed','notified','confirmed','declined')))
 limit 1;
 if candidate is null then
   perform public.schedule_notify(leader_id,sl.service_id,'no_candidate',sl.id||':empty:'||sl.version);
   return;
 end if;
 insert into public.schedule_attempts(slot_id,person_id,state) values(sl.id,candidate,'proposed') returning id into aid;
 insert into public.schedule_audit(slot_id,actor,action,person_id) values(sl.id,auth.uid(),'proposed',candidate);
 perform public.schedule_notify(leader_id,sl.service_id,'approval_required',aid||':leader:'||leader_id);
end;
$$;

-- Extending a previously saved series preserves the canonical event fields and
-- rehearsal offset. Future occurrences are always unpublished drafts.
create or replace function public.generate_service_occurrences(p_group_id uuid,p_source_service_id uuid,p_occurrences jsonb)
returns setof public.services language plpgsql security definer set search_path=public,pg_temp as $$
declare occurrence public.services; source public.services; shifted_practice jsonb;
begin
 perform pg_advisory_xact_lock(762901);
 select * into source from public.services where id=p_source_service_id;
 for occurrence in select * from public.generate_legacy_service_occurrences(p_group_id,p_source_service_id,p_occurrences) loop
   if source.published_at is not null then
     delete from public.service_team copied where copied.service_id=occurrence.id and not exists(select 1 from public.schedule_slots sl where sl.service_id=source.id and sl.person_id=copied.person_id and sl.role_id=copied.worship_role_id);
   end if;
   shifted_practice:=source.practice;
   if source.practice->>'enabled'='true' then shifted_practice:=jsonb_set(source.practice,'{date}',to_jsonb((occurrence.date+((source.practice->>'date')::date-source.date))::text)); end if;
   update public.services set event_kind=source.event_kind,end_date=occurrence.date+(coalesce(source.end_date,source.date)-source.date),end_time=source.end_time,location=source.location,location_url=source.location_url,timezone='Africa/Cairo',status='draft',practice=shifted_practice where id=occurrence.id returning * into occurrence;
   return next occurrence;
 end loop;
 return;
end;
$$;
revoke all on function public.generate_service_occurrences(uuid,uuid,jsonb) from public,anon;
grant execute on function public.generate_service_occurrences(uuid,uuid,jsonb) to authenticated;

-- Keep a stale client from creating rolling predefined services.
create or replace function public.ensure_weekly_services() returns void language plpgsql as $$begin return;end;$$;
drop trigger if exists protect_fixed_weekly_service on public.services;
-- Old date-picker entry point becomes an explicit draft create through the canonical API.
create or replace function public.open_youth_meeting(p_date date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid;
begin
 if not public.is_active_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 select id into sid from public.services where event_kind='youth_meeting' and date=p_date and archived_at is null and status<>'cancelled' limit 1;
 if sid is not null then
   if not public.calendar_can_view(sid) then raise exception 'Draft unavailable' using errcode='42501'; end if;
   return sid;
 end if;
 sid:=gen_random_uuid();
 perform public.save_planning_events(jsonb_build_array(jsonb_build_object('id',sid,'event_kind','youth_meeting','title','Youth Meeting','date',p_date,'end_date',p_date,'time','18:00','end_time','20:00','team','[]'::jsonb)),false);
 return sid;
end;
$$;
revoke all on function public.guard_calendar_event() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
