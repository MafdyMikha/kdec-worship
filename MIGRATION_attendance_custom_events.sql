-- Apply AFTER MIGRATION_unified_calendar.sql. No real-account tests or notifications.
begin;
-- BEGIN upgrade prerequisite check (the fresh schema defers this until final migration).
do $$begin
 if to_regprocedure('public.has_permission(text)') is null or to_regprocedure('public.generate_legacy_service_occurrences(uuid,uuid,jsonb)') is null then
   raise exception 'Apply the dynamic roles and unified calendar migrations before MIGRATION_attendance_custom_events.sql';
 end if;
end$$;
-- END upgrade prerequisite check.
alter table public.organization_settings add column if not exists attendance_late_enabled boolean not null default true;
alter table public.organization_settings alter column attendance_late_minutes type integer;
alter table public.organization_settings drop constraint if exists organization_settings_attendance_late_minutes_check;
alter table public.organization_settings add constraint organization_settings_attendance_late_minutes_check check(attendance_late_minutes>=0);
alter table public.services drop constraint if exists services_event_kind_check;
alter table public.services add constraint services_event_kind_check check(event_kind in ('youth_meeting','service','general_meeting','prayer_shift','conference','custom'));
alter table public.services add column if not exists custom_category text not null default '';
alter table public.services add column if not exists participant_ids uuid[] not null default '{}';
alter table public.services add column if not exists attendance_enabled boolean not null default true;
alter table public.services add column if not exists late_tolerance_mode text not null default 'inherit' check(late_tolerance_mode in ('inherit','custom','none'));
alter table public.services add column if not exists late_tolerance_minutes integer check(late_tolerance_minutes>=0);
do $$begin
 if not exists(select 1 from pg_constraint where conname='services_custom_category_check') then
 alter table public.services add constraint services_custom_category_check check(length(custom_category)<=100 and (event_kind<>'custom' or length(trim(custom_category))>0));
 end if;
 if not exists(select 1 from pg_constraint where conname='services_custom_tolerance_check') then
 alter table public.services add constraint services_custom_tolerance_check check(late_tolerance_mode<>'custom' or late_tolerance_minutes is not null);
 end if;
end$$;
alter table public.attendance_sessions add column if not exists session_end_date date;
alter table public.attendance_sessions add column if not exists late_tolerance_mode text not null default 'inherit' check(late_tolerance_mode in ('inherit','custom','none'));
alter table public.attendance_sessions add column if not exists late_tolerance_minutes integer check(late_tolerance_minutes>=0);
alter table public.attendance_sessions add column if not exists effective_late_minutes integer;
update public.attendance_sessions set session_end_date=session_date+case when end_time<=session_time then 1 else 0 end where session_end_date is null;
update public.attendance_sessions set effective_late_minutes=(select case when attendance_late_enabled then attendance_late_minutes else 0 end from public.organization_settings where id=1) where effective_late_minutes is null;
alter table public.attendance_sessions alter column effective_late_minutes set default 0;
alter table public.attendance_sessions alter column effective_late_minutes set not null;
alter table public.attendance_sessions alter column qr_code set default encode(uuid_send(gen_random_uuid())||uuid_send(gen_random_uuid()),'hex');
alter table public.attendance_records add column if not exists scheduled_start_at timestamptz;
alter table public.attendance_records add column if not exists scheduled_end_at timestamptz;
alter table public.attendance_records add column if not exists tolerance_minutes integer;
alter table public.attendance_records add column if not exists arrival_status text check(arrival_status in ('early','on_time','late'));
alter table public.attendance_records add column if not exists late_by_minutes integer;
-- Legacy records keep their persisted present/late status. The exact old grace value
-- cannot be reconstructed; capture available schedule metadata without rewriting status.
update public.attendance_records r set
 scheduled_start_at=(r.occurrence_date+s.session_time) at time zone coalesce(o.timezone,'Africa/Cairo'),
 scheduled_end_at=(r.occurrence_date+(s.session_end_date-s.session_date)+s.end_time) at time zone coalesce(o.timezone,'Africa/Cairo'),
 tolerance_minutes=s.effective_late_minutes,
 arrival_status=case when r.status='late' then 'late' when r.check_in_at < ((r.occurrence_date+s.session_time) at time zone coalesce(o.timezone,'Africa/Cairo')) then 'early' when r.check_in_at is not null then 'on_time' end,
 late_by_minutes=case when r.status='late' then greatest(1,ceil(extract(epoch from r.check_in_at-((r.occurrence_date+s.session_time) at time zone coalesce(o.timezone,'Africa/Cairo')))/60)::integer) else 0 end
 from public.attendance_sessions s cross join public.organization_settings o
 where r.session_id=s.id and o.id=1 and r.scheduled_start_at is null;
create table if not exists public.attendance_qr_codes(
 session_id uuid not null references public.attendance_sessions(id),
 occurrence_date date not null,
 token text not null unique default encode(uuid_send(gen_random_uuid())||uuid_send(gen_random_uuid()),'hex'),
 revoked boolean not null default false,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key(session_id,occurrence_date)
);
alter table public.attendance_qr_codes enable row level security;
revoke all on public.attendance_qr_codes from public,anon,authenticated;
create index if not exists attendance_person_history_idx on public.attendance_records(person_id,occurrence_date desc,id);

create or replace function public.guard_calendar_event()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(762901);
 if tg_op='DELETE' then raise exception 'Cancel events to preserve attendance and history'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.published_at is not null then raise exception 'Publish events through the quarterly workflow'; end if;
 if tg_op='UPDATE' and old.published_at is not null then
   if (to_jsonb(new)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency','attendance_enabled','late_tolerance_mode','late_tolerance_minutes']) is distinct from (to_jsonb(old)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency','attendance_enabled','late_tolerance_mode','late_tolerance_minutes']) then raise exception 'Published schedule is locked; cancel and create a corrected event'; end if;
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
   if e->>'event_kind' not in ('youth_meeting','service','general_meeting','prayer_shift','conference','custom') or e->>'event_kind' is null then raise exception 'Choose a supported event type'; end if;
   if exists(select 1 from jsonb_array_elements_text(e->'participant_ids') x where not exists(select 1 from public.profiles p where p.id=x.value::uuid and p.status='active')) then raise exception 'Choose active participants'; end if;
   select * into existing from public.services where id=sid for update;
   if p_edit then
     if existing.id is null or existing.published_at is not null or existing.archived_at is not null or existing.status='cancelled' then raise exception 'Only active unpublished drafts can be edited'; end if;
     update public.services set custom_category=coalesce(e->>'custom_category',''), participant_ids=coalesce(array(select jsonb_array_elements_text(e->'participant_ids')::uuid),'{}'),attendance_enabled=coalesce((e->>'attendance_enabled')::boolean,true),late_tolerance_mode=coalesce(e->>'late_tolerance_mode','inherit'),late_tolerance_minutes=(e->>'late_tolerance_minutes')::integer,title=trim(e->>'title'),event_kind=e->>'event_kind',type=e->>'event_kind',date=(e->>'date')::date,time=e->>'time',end_date=(e->>'end_date')::date,end_time=e->>'end_time',location=coalesce(e->>'location',''),location_url=coalesce(e->>'location_url',''),notes=coalesce(e->>'notes',''),practice=nullif(e->'practice','null'::jsonb) where id=sid;
   else
     if existing.id is not null then raise exception 'Event already exists; reload before retrying'; end if;
     insert into public.services(custom_category,participant_ids,attendance_enabled,late_tolerance_mode,late_tolerance_minutes,id,title,date,time,end_date,end_time,event_kind,type,status,location,location_url,notes,practice,created_by,recurrence_group_id,recurrence_index,recurrence_frequency)
     values(coalesce(e->>'custom_category',''),coalesce(array(select jsonb_array_elements_text(e->'participant_ids')::uuid),'{}'),coalesce((e->>'attendance_enabled')::boolean,true),coalesce(e->>'late_tolerance_mode','inherit'),(e->>'late_tolerance_minutes')::integer,sid,trim(e->>'title'),(e->>'date')::date,e->>'time',(e->>'end_date')::date,e->>'end_time',e->>'event_kind',e->>'event_kind','draft',coalesce(e->>'location',''),coalesce(e->>'location_url',''),coalesce(e->>'notes',''),nullif(e->'practice','null'::jsonb),auth.uid(),(e->>'recurrence_group_id')::uuid,coalesce((e->>'recurrence_index')::integer,0),e->>'recurrence_frequency');
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
-- Series extension carries the custom metadata into silent future drafts.
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
   update public.services set custom_category=source.custom_category,participant_ids=source.participant_ids,attendance_enabled=source.attendance_enabled,late_tolerance_mode=source.late_tolerance_mode,late_tolerance_minutes=source.late_tolerance_minutes,event_kind=source.event_kind,end_date=occurrence.date+(coalesce(source.end_date,source.date)-source.date),end_time=source.end_time,location=source.location,location_url=source.location_url,timezone='Africa/Cairo',status='draft',practice=shifted_practice where id=occurrence.id returning * into occurrence;
   return next occurrence;
 end loop;
 return;
end;
$$;
revoke all on function public.generate_service_occurrences(uuid,uuid,jsonb) from public,anon;
grant execute on function public.generate_service_occurrences(uuid,uuid,jsonb) to authenticated;



create or replace function public.attendance_effective_tolerance(p_mode text,p_minutes integer,p_service uuid default null)
returns integer language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_mode text; v_minutes integer;
begin
 if p_mode='none' then return 0; end if;
 if p_mode='custom' then
   if p_minutes is null or p_minutes<0 then raise exception 'Enter a non-negative whole number of minutes.'; end if;
   return p_minutes;
 end if;
 if p_mode is distinct from 'inherit' then raise exception 'Invalid tolerance mode'; end if;
 if p_service is not null then
   select late_tolerance_mode,late_tolerance_minutes into v_mode,v_minutes from services where id=p_service;
   if v_mode='none' then return 0; end if;
   if v_mode='custom' then return v_minutes; end if;
 end if;
 select case when attendance_late_enabled then attendance_late_minutes else 0 end into v_minutes from organization_settings where id=1;
 return coalesce(v_minutes,0);
end$$;
revoke all on function public.attendance_effective_tolerance(text,integer,uuid) from public,anon,authenticated;

create or replace function public.stamp_attendance_session_policy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' or (new.session_date,new.session_time,new.session_end_date,new.end_time) is distinct from (old.session_date,old.session_time,old.session_end_date,old.end_time) then
 if new.session_date is null or new.session_time is null or new.end_time is null then raise exception 'Session date, start time, and end time are required.'; end if;
 new.session_end_date:=coalesce(new.session_end_date,new.session_date+case when new.end_time<=new.session_time then 1 else 0 end);
 if ((new.session_date+new.session_time) at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' <> new.session_date+new.session_time or ((new.session_end_date+new.end_time) at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' <> new.session_end_date+new.end_time then raise exception 'This Cairo time does not exist during the daylight-saving change'; end if;
 if new.session_end_date<new.session_date or new.session_end_date>new.session_date+31 or new.session_end_date+new.end_time<=new.session_date+new.session_time then raise exception 'End must follow start, within 31 days'; end if;
 end if;
 if tg_op='UPDATE' and exists(select 1 from attendance_records where session_id=old.id) and
 (new.session_date,new.session_time,new.session_end_date,new.end_time,new.service_id,new.repeatable,new.repeat_freq) is distinct from
 (old.session_date,old.session_time,old.session_end_date,old.end_time,old.service_id,old.repeatable,old.repeat_freq) then raise exception 'Recorded session schedule is locked; create a new session'; end if;
 if tg_op='INSERT' or (new.late_tolerance_mode,new.late_tolerance_minutes) is distinct from (old.late_tolerance_mode,old.late_tolerance_minutes) then
   new.effective_late_minutes:=public.attendance_effective_tolerance(new.late_tolerance_mode,new.late_tolerance_minutes,new.service_id);
 end if;
 return new;
end$$;
-- Replaces the legacy one-day/organization-timezone expiry trigger. The creation
-- RPC derives expiry from the explicit Cairo end date; writes are RPC-only.
drop trigger if exists attendance_session_schedule_guard on public.attendance_sessions;
drop trigger if exists stamp_attendance_session_policy on attendance_sessions;
create trigger stamp_attendance_session_policy before insert or update on attendance_sessions for each row execute function stamp_attendance_session_policy();

create or replace function public.stamp_attendance_record_policy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare s attendance_sessions; v_delta numeric;
begin
 if tg_op='UPDATE' and old.check_in_at is not null and
 (new.check_in_at,new.scheduled_start_at,new.scheduled_end_at,new.tolerance_minutes,new.arrival_status,new.late_by_minutes,new.session_id,new.person_id,new.occurrence_date) is distinct from
 (old.check_in_at,old.scheduled_start_at,old.scheduled_end_at,old.tolerance_minutes,old.arrival_status,old.late_by_minutes,old.session_id,old.person_id,old.occurrence_date) then raise exception 'Recorded arrival policy and identity are immutable'; end if;
 if new.check_in_at is not null and (tg_op='INSERT' or old.check_in_at is null) then
   select * into strict s from attendance_sessions where id=new.session_id;
   new.scheduled_start_at:=(new.occurrence_date+s.session_time) at time zone 'Africa/Cairo';
   new.scheduled_end_at:=(new.occurrence_date+(s.session_end_date-s.session_date)+s.end_time) at time zone 'Africa/Cairo';
   new.tolerance_minutes:=s.effective_late_minutes;
   v_delta:=extract(epoch from new.check_in_at-new.scheduled_start_at)/60;
   new.arrival_status:=case when v_delta<0 then 'early' when v_delta>new.tolerance_minutes then 'late' else 'on_time' end;
   new.status:=case when new.arrival_status='late' then 'late' else 'present' end;
   new.late_by_minutes:=case when new.arrival_status='late' then ceil(v_delta)::integer else 0 end;
 end if;
 return new;
end$$;
drop trigger if exists stamp_attendance_record_policy on attendance_records;
create trigger stamp_attendance_record_policy before insert or update on attendance_records for each row execute function stamp_attendance_record_policy();

create or replace function public.create_attendance_session(p_form jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s attendance_sessions; v_end date; v_expiry timestamptz;
begin
 if not public.is_active_member() or not(public.has_permission('services.edit') or public.has_permission('reports.view')) then raise exception 'Attendance management permission required' using errcode='42501'; end if;
 if nullif(p_form->>'service_id','') is not null and not exists(select 1 from services where id=(p_form->>'service_id')::uuid and status<>'cancelled' and archived_at is null and published_at is not null and attendance_enabled) then raise exception 'Publish and enable attendance for this event first.'; end if;
 v_end:=coalesce(nullif(p_form->>'session_end_date','')::date,(p_form->>'session_date')::date+case when (p_form->>'end_time')::time<=(p_form->>'session_time')::time then 1 else 0 end);
 v_expiry:=case when coalesce((p_form->>'repeatable')::boolean,false) then greatest(clock_timestamp(),(v_end+(p_form->>'end_time')::time) at time zone 'Africa/Cairo')+interval '90 days' else ((v_end+(p_form->>'end_time')::time) at time zone 'Africa/Cairo')+interval '6 hours' end;
 if v_expiry<=clock_timestamp() then raise exception 'This session has already ended.'; end if;
 insert into attendance_sessions(name,label,service_id,session_date,session_time,session_end_date,end_time,max_attendees,repeatable,repeat_freq,expires_at,created_by,late_tolerance_mode,late_tolerance_minutes)
 values(left(coalesce(nullif(trim(p_form->>'name'),''),p_form->>'label','Attendance'),200),left(coalesce(nullif(trim(p_form->>'label'),''),'Service'),100),nullif(p_form->>'service_id','')::uuid,(p_form->>'session_date')::date,(p_form->>'session_time')::time,v_end,(p_form->>'end_time')::time,nullif(p_form->>'max_attendees','')::integer,coalesce((p_form->>'repeatable')::boolean,false),case when coalesce((p_form->>'repeatable')::boolean,false) then p_form->>'repeat_freq' end,v_expiry,auth.uid(),coalesce(p_form->>'late_tolerance_mode','inherit'),nullif(p_form->>'late_tolerance_minutes','')::integer) returning * into s;
 return to_jsonb(s);
end$$;
-- Clients cannot choose token, identity, frozen policy or expiry through table writes.
revoke insert,update on attendance_sessions from authenticated;

create or replace function public.attendance_occurrence_valid(s public.attendance_sessions,p_day date)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select p_day>=s.session_date and (case when not s.repeatable then p_day=s.session_date when s.repeat_freq='daily' then true when s.repeat_freq='weekly' then mod(p_day-s.session_date,7)=0 when s.repeat_freq='monthly' then extract(day from p_day)=least(extract(day from s.session_date),extract(day from date_trunc('month',p_day::timestamp)+interval '1 month - 1 day')) else false end)
$$;
revoke all on function public.attendance_occurrence_valid(public.attendance_sessions,date) from public,anon,authenticated;

create or replace function public.manage_attendance_qr(p_session uuid,p_date date default null,p_action text default 'get')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s attendance_sessions; q attendance_qr_codes; day date; v_expiry timestamptz;
begin
 if not public.is_active_member() or not(public.has_permission('services.edit') or public.has_permission('reports.view')) then raise exception 'Attendance management permission required' using errcode='42501'; end if;
 if p_action not in ('get','rotate','revoke','close') then raise exception 'Invalid QR action'; end if;
 select * into strict s from attendance_sessions where id=p_session for update;
 if p_action='close' then update attendance_sessions set active=false where id=s.id; update attendance_qr_codes set revoked=true,updated_at=clock_timestamp() where session_id=s.id; return jsonb_build_object('closed',true); end if;
 if not s.active then raise exception 'This attendance session is closed.'; end if;
 day:=coalesce(p_date,s.session_date);
 if not attendance_occurrence_valid(s,day) then raise exception 'This code is not valid for this occurrence.'; end if;
 v_expiry:=least(s.expires_at,((day+(s.session_end_date-s.session_date)+s.end_time) at time zone 'Africa/Cairo')+interval '6 hours');
 if v_expiry<=clock_timestamp() then raise exception 'This attendance code is not active yet or has expired.'; end if;
 insert into attendance_qr_codes(session_id,occurrence_date) values(s.id,day) on conflict do nothing;
 if p_action='rotate' then update attendance_qr_codes set token=encode(uuid_send(gen_random_uuid())||uuid_send(gen_random_uuid()),'hex'),revoked=false,version=version+1,updated_at=clock_timestamp() where session_id=s.id and occurrence_date=day; end if;
 if p_action='revoke' then update attendance_qr_codes set revoked=true,updated_at=clock_timestamp() where session_id=s.id and occurrence_date=day; end if;
 select * into q from attendance_qr_codes where session_id=s.id and occurrence_date=day;
 return jsonb_build_object('qr_code',q.token,'occurrence_date',day,'revoked',q.revoked,'version',q.version,'expires_at',v_expiry);
end$$;

create or replace function public.resolve_attendance_code(p_qr_code text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s attendance_sessions; q attendance_qr_codes; v_expiry timestamptz; svc services;
begin
 if not public.is_active_member() then raise exception 'Active membership is required' using errcode='42501'; end if;
 select * into q from attendance_qr_codes where token=btrim(p_qr_code);
 if not found then raise exception 'This attendance code has been revoked or is invalid.'; end if;
 select * into strict s from attendance_sessions where id=q.session_id;
 if not s.active then raise exception 'This attendance session is closed.'; end if;
 if q.revoked then raise exception 'This attendance code has been revoked or is invalid.'; end if;
 if s.service_id is not null then
 select * into svc from services where id=s.service_id;
 if svc.id is null or svc.status='cancelled' or svc.archived_at is not null or svc.published_at is null or not svc.attendance_enabled then raise exception 'Publish and enable attendance for this event first.'; end if;
 end if;
 if not attendance_occurrence_valid(s,q.occurrence_date) then raise exception 'This code is not valid for this occurrence.'; end if;
 v_expiry:=least(s.expires_at,((q.occurrence_date+(s.session_end_date-s.session_date)+s.end_time) at time zone 'Africa/Cairo')+interval '6 hours');
 if clock_timestamp()<q.occurrence_date::timestamp at time zone 'Africa/Cairo' or clock_timestamp()>=v_expiry then raise exception 'This attendance code is not active yet or has expired.'; end if;
 return (to_jsonb(s)-'qr_code')||jsonb_build_object('qr_code',q.token,'occurrence_date',q.occurrence_date,'session_date',q.occurrence_date,'session_end_date',q.occurrence_date+(s.session_end_date-s.session_date),'expires_at',v_expiry,'service_title',svc.title,'service_date',svc.date,'service_time',svc.time);
end$$;

create or replace function public.check_in_attendance(p_qr_code text)
returns public.attendance_records language plpgsql security definer set search_path=public,pg_temp as $$
declare s attendance_sessions; r attendance_records; resolved jsonb; day date;
begin
 if not public.is_active_member() then raise exception 'Active membership is required' using errcode='42501'; end if;
 -- Serialize token rotation, capacity and duplicate scans on the same parent row.
 select a.* into s from attendance_sessions a join attendance_qr_codes q on q.session_id=a.id where q.token=btrim(p_qr_code) for update of a;
 if not found then raise exception 'This attendance code has been revoked or is invalid.'; end if;
 resolved:=public.resolve_attendance_code(p_qr_code);
 day:=(resolved->>'occurrence_date')::date;
 select * into r from attendance_records where session_id=s.id and person_id=auth.uid() and occurrence_date=day for update;
 if found and r.check_in_at is not null then return r; end if;
 if s.max_attendees is not null and (select count(*) from attendance_records where session_id=s.id and occurrence_date=day and check_in_at is not null)>=s.max_attendees then raise exception 'This attendance session is full.'; end if;
 if r.id is not null then
 update attendance_records set check_in_at=clock_timestamp(),check_out_at=null where id=r.id returning * into r;
 else
 insert into attendance_records(session_id,person_id,occurrence_date,check_in_at) values(s.id,auth.uid(),day,clock_timestamp()) returning * into r;
 end if;
 return r;
end$$;

create or replace function public.update_event_attendance_options(p_service uuid,p_mode text,p_minutes integer,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_active_member() or not(public.has_permission('services.edit') or public.has_permission('schedules.manage')) then raise exception 'Schedule management permission required' using errcode='42501'; end if;
 perform public.attendance_effective_tolerance(p_mode,p_minutes,null);
 update services set late_tolerance_mode=p_mode,late_tolerance_minutes=case when p_mode='custom' then p_minutes end,attendance_enabled=p_enabled where id=p_service and archived_at is null and status<>'cancelled';
 if not found then raise exception 'Event is unavailable'; end if;
 -- Only inherited sessions follow an explicit event-level policy edit. Existing
 -- attendance rows keep their original snapshots and cannot be reclassified.
 update attendance_sessions set effective_late_minutes=public.attendance_effective_tolerance('inherit',null,p_service) where service_id=p_service and late_tolerance_mode='inherit';
end$$;

create or replace function public.get_member_attendance_history(p_person uuid,p_from date default null,p_to date default null,p_kind text default null,p_status text default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.is_active_member() or (p_person is distinct from auth.uid() and not public.has_permission('reports.view')) then raise exception 'Attendance history permission required' using errcode='42501'; end if;
 with base as (
   select r.*,coalesce(nullif(v.custom_category,''),v.event_kind,s.label) as event_type,
     (to_jsonb(s)-'qr_code')||jsonb_build_object('service',case when v.id is null then null else jsonb_build_object('id',v.id,'title',v.title,'date',v.date,'time',v.time,'event_kind',v.event_kind,'custom_category',v.custom_category) end) as session
   from attendance_records r join attendance_sessions s on s.id=r.session_id left join services v on v.id=s.service_id
   where r.person_id=p_person
 ), filtered as (
   select * from base where (p_from is null or occurrence_date>=p_from) and (p_to is null or occurrence_date<=p_to)
    and (p_kind is null or event_type=p_kind) and (p_status is null or status=p_status)
 ), page as (select * from filtered order by occurrence_date desc,created_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered),
 'types',coalesce((select jsonb_agg(x.event_type order by x.event_type) from (select distinct event_type from base) x),'[]'::jsonb),
 'summary',(select jsonb_build_object('records',count(*),'present',count(*) filter(where check_in_at is not null),'late',count(*) filter(where status='late'),'absent',count(*) filter(where status='absent'),'excused',count(*) filter(where status='excused')) from filtered)) into result;
 return result;
end$$;

revoke all on function public.create_attendance_session(jsonb),public.manage_attendance_qr(uuid,date,text),public.resolve_attendance_code(text),public.check_in_attendance(text),public.update_event_attendance_options(uuid,text,integer,boolean),public.get_member_attendance_history(uuid,date,date,text,text,integer,integer) from public,anon;
grant execute on function public.create_attendance_session(jsonb),public.manage_attendance_qr(uuid,date,text),public.resolve_attendance_code(text),public.check_in_attendance(text),public.update_event_attendance_options(uuid,text,integer,boolean),public.get_member_attendance_history(uuid,date,date,text,text,integer,integer) to authenticated;
create or replace function public.get_attendance_session(p_qr_code text)
returns table (
  session_id       uuid,
  service_id       uuid,
  name             text,
  label            text,
  session_date     date,
  session_time     time,
  end_time         time,
  active           boolean,
  max_attendees    integer,
  repeatable       boolean,
  repeat_freq      text,
  expires_at       timestamptz,
  service_title    text,
  service_date     date,
  service_time     text
)
language plpgsql security definer set search_path=public,pg_temp as $$declare v jsonb;begin v:=resolve_attendance_code(p_qr_code);return query select (v->>'id')::uuid,(v->>'service_id')::uuid,(v->>'name')::text,(v->>'label')::text,(v->>'session_date')::date,(v->>'session_time')::time,(v->>'end_time')::time,(v->>'active')::boolean,(v->>'max_attendees')::integer,(v->>'repeatable')::boolean,(v->>'repeat_freq')::text,(v->>'expires_at')::timestamptz,(v->>'service_title')::text,(v->>'service_date')::date,(v->>'service_time')::text;end$$;
notify pgrst, 'reload schema';
commit;
