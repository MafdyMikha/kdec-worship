-- ONE-TIME USER-REQUESTED CLEANUP. Apply AFTER MIGRATION_unified_calendar.sql.
-- First take a managed database backup / pg_dump. Known non-Youth weekly-template
-- occurrences are selected automatically. Manually created events are preserved
-- unless their IDs are explicitly reviewed as unwanted in this OWNER-ONLY table.
create table if not exists public.calendar_cleanup_selection (
 service_id uuid primary key references public.services(id), reason text not null
);
alter table public.calendar_cleanup_selection enable row level security;
revoke all on public.calendar_cleanup_selection from public,anon,authenticated;
-- Optional reviewed selections (never select a Youth Meeting):
-- insert into public.calendar_cleanup_selection(service_id,reason)
-- values ('REVIEWED-SERVICE-UUID','Unwanted legacy meeting');
select id,title,event_kind,date,status,published_at,
 (weekly_template_key is not null and weekly_template_key<>'youth') as generated_non_youth,
 exists(select 1 from public.calendar_cleanup_selection c where c.service_id=s.id) as explicitly_selected,
 (select count(*) from public.service_team t where t.service_id=s.id) as assignments,
 (select count(*) from public.attendance_sessions a where a.service_id=s.id) as attendance_sessions
from public.services s where archived_at is null and event_kind<>'youth_meeting'
and status in ('draft','scheduled') and coalesce(end_date,date)>=(now() at time zone 'Africa/Cairo')::date
order by date,time;

begin;
select pg_advisory_xact_lock(762901);
create table if not exists public.calendar_cleanup_backup (
 batch text not null, table_name text not null, record_id text not null,
 snapshot jsonb not null, backed_up_at timestamptz not null default now(),
 primary key(batch,table_name,record_id)
);
alter table public.calendar_cleanup_backup enable row level security;
revoke all on public.calendar_cleanup_backup from public,anon,authenticated;
do $cleanup$
declare ids uuid[]; event_ids uuid[]; child text;
begin
 if exists(select 1 from public.calendar_migration_runs where key='calendar-cleanup-v1') then
   raise notice 'Cleanup already applied; later manager-created events are untouched'; return;
 end if;
 select coalesce(array_agg(s.id),'{}'::uuid[]) into ids from public.services s where archived_at is null and event_kind<>'youth_meeting' and status in ('draft','scheduled') and coalesce(end_date,date)>=(now() at time zone 'Africa/Cairo')::date
 and ((weekly_template_key is not null and weekly_template_key<>'youth') or exists(select 1 from public.calendar_cleanup_selection c where c.service_id=s.id));
 select coalesce(array_agg(id),'{}'::uuid[]) into event_ids from public.events where calendar_service_id=any(ids);
 -- Snapshot parents and every workflow child before changing any status. Even
 -- unassigned records are retained. Linked history is never deleted or rewritten.
 insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot)
 select 'calendar-cleanup-v1','services',id::text,to_jsonb(s) from public.services s where id=any(ids);
 insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot)
 select 'calendar-cleanup-v1','events',id::text,to_jsonb(e) from public.events e where id=any(event_ids);
 foreach child in array array['service_team','setlist_items','attendance_sessions','excuses','substitute_requests','schedule_slots','schedule_notifications'] loop
   execute format('insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot) select %L,%L,id::text,to_jsonb(t) from public.%I t where service_id=any($1)', 'calendar-cleanup-v1',child,child) using ids;
 end loop;
 insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot)
 select 'calendar-cleanup-v1','attendance_records',r.id::text,to_jsonb(r) from public.attendance_records r where r.session_id in(select id from public.attendance_sessions where service_id=any(ids));
 insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot)
 select 'calendar-cleanup-v1','event_responses',r.id::text,to_jsonb(r) from public.event_responses r where event_id=any(event_ids);
 insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot)
 select 'calendar-cleanup-v1','excuses',r.id::text,to_jsonb(r) from public.excuses r where event_id=any(event_ids) on conflict do nothing;
 foreach child in array array['schedule_attempts','schedule_audit'] loop
   execute format('insert into public.calendar_cleanup_backup(batch,table_name,record_id,snapshot) select %L,%L,id::text,to_jsonb(t) from public.%I t where slot_id in(select id from public.schedule_slots where service_id=any($1))','calendar-cleanup-v1',child,child) using ids;
 end loop;
 update public.services set status='cancelled',archived_at=now() where id=any(ids);
 update public.events set status='cancelled' where id=any(event_ids);
 insert into public.calendar_migration_runs(key) values('calendar-cleanup-v1');
end $cleanup$;
commit;
-- Owner-only manifest: export and retain this beside the managed backup.
select table_name,record_id,backed_up_at from public.calendar_cleanup_backup where batch='calendar-cleanup-v1' order by table_name,record_id;
