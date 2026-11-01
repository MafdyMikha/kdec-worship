-- Isolated, synthetic identities only. All changes roll back; no real notifications.
begin;
create function public.att_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'TEST FAILED: %',message; end if;end$$;
select set_config('app.admin_user_update','1',true);
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) select ('92000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'attendance-'||i||'@example.invalid' from generate_series(1,5) i;
alter table auth.users enable trigger on_auth_user_created;
insert into profiles(id,name,email,access_level,status) values
 ('92000000-0000-0000-0000-000000000001','Synthetic Admin','attendance-1@example.invalid','super_admin','active'),
 ('92000000-0000-0000-0000-000000000002','Synthetic Member','attendance-2@example.invalid','member','active'),
 ('92000000-0000-0000-0000-000000000003','Synthetic Other','attendance-3@example.invalid','member','active'),
 ('92000000-0000-0000-0000-000000000004','Synthetic Inactive','attendance-4@example.invalid','member','inactive'),
 ('92000000-0000-0000-0000-000000000005','Synthetic Manager','attendance-5@example.invalid','leader','active');
grant select on services,attendance_sessions,attendance_records,organization_settings to authenticated;
grant update on organization_settings to authenticated;
create temporary table att_state(key text primary key,value jsonb);
grant select,insert,update on att_state to authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000005',true);
set local role authenticated;
select * from save_planning_events(jsonb_build_array(jsonb_build_object('id','93000000-0000-0000-0000-000000000001','title','Synthetic custom gathering','event_kind','custom','custom_category','Workshop','date',(now() at time zone 'Africa/Cairo')::date,'end_date',(now() at time zone 'Africa/Cairo')::date,'time','00:00','end_time','23:59','team','[]'::jsonb,'participant_ids',jsonb_build_array('92000000-0000-0000-0000-000000000002'),'attendance_enabled',true,'late_tolerance_mode','custom','late_tolerance_minutes',3)),false);
select att_assert((select count(*)=0 from schedule_notifications),'silent custom draft');
select att_assert((select custom_category='Workshop' and cardinality(participant_ids)=1 and late_tolerance_minutes=3 from services where id='93000000-0000-0000-0000-000000000001'),'custom fields persist');
select publish_schedule_quarter(date_trunc('quarter',(now() at time zone 'Africa/Cairo'))::date);
select att_assert((select count(*)=0 from schedule_notifications),'participants do not alter assignment notification workflow');
insert into att_state values('session',create_attendance_session(jsonb_build_object('name','Synthetic QR','label','Workshop','service_id','93000000-0000-0000-0000-000000000001','session_date',(now() at time zone 'Africa/Cairo')::date,'session_time','00:00','end_time','23:59','late_tolerance_mode','inherit','repeatable',true,'repeat_freq','daily','max_attendees',3)));
insert into att_state select 'code',manage_attendance_qr((value->>'id')::uuid,(now() at time zone 'Africa/Cairo')::date,'get') from att_state where key='session';
select att_assert((select value->>'qr_code' from att_state where key='code')=(manage_attendance_qr((select (value->>'id')::uuid from att_state where key='session'),(now() at time zone 'Africa/Cairo')::date,'get')->>'qr_code'),'reopen uses persisted code');
insert into att_state select 'tomorrow',manage_attendance_qr((value->>'id')::uuid,(now() at time zone 'Africa/Cairo')::date+1,'get') from att_state where key='session';
select att_assert((select value->>'qr_code' from att_state where key='code')<>(select value->>'qr_code' from att_state where key='tomorrow'),'occurrences have distinct tokens');
select att_assert((select value->>'qr_code' ~ '^[0-9a-f]{64}$' from att_state where key='code'),'secure opaque token');
insert into att_state values('second',create_attendance_session(jsonb_build_object('name','Other session','session_date',(now() at time zone 'Africa/Cairo')::date,'session_time','00:00','end_time','23:59','late_tolerance_mode','none')));
select att_assert((manage_attendance_qr((select (value->>'id')::uuid from att_state where key='second'),null,'get')->>'qr_code')<>(select value->>'qr_code' from att_state where key='code'),'sessions have distinct tokens');
reset role;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select att_assert((select count(*)=0 from attendance_sessions),'member cannot enumerate session tokens');
do $$begin
 begin perform * from attendance_qr_codes;raise exception 'TEST FAILED: token enumeration';exception when insufficient_privilege then null;end;
 begin perform manage_attendance_qr((select (value->>'id')::uuid from att_state where key='session'),null,'rotate');raise exception 'TEST FAILED: member rotate';exception when insufficient_privilege then null;end;
 begin perform resolve_attendance_code((select value->>'qr_code' from att_state where key='tomorrow'));raise exception 'TEST FAILED: future code accepted';exception when others then if sqlerrm not like '%not active yet%' then raise;end if;end;
end$$;
select att_assert(resolve_attendance_code((select value->>'qr_code' from att_state where key='code'))->>'name'='Synthetic QR','member resolves correct session');
select att_assert((select session_id=(select (value->>'id')::uuid from att_state where key='session') from get_attendance_session((select value->>'qr_code' from att_state where key='code'))),'legacy resolver identity retained');
insert into att_state values('record',to_jsonb(check_in_attendance((select value->>'qr_code' from att_state where key='code'))));
select att_assert((check_in_attendance((select value->>'qr_code' from att_state where key='code'))).id=(select (value->>'id')::uuid from att_state where key='record'),'repeated scan is idempotent');
select att_assert((check_out_attendance((select (value->>'id')::uuid from att_state where key='session'))).check_out_at is not null,'checkout persists');
select att_assert((select tolerance_minutes=3 from attendance_records where id=(select (value->>'id')::uuid from att_state where key='record')),'event tolerance snapshotted');
select att_assert((get_member_attendance_history(auth.uid())->>'total')::int=1,'self history');
select att_assert(not ((get_member_attendance_history(auth.uid())->'rows'->0->'session')?'qr_code'),'history omits token');
do $$begin
 begin perform get_member_attendance_history('92000000-0000-0000-0000-000000000003');raise exception 'TEST FAILED: other member history';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000001',true);
set local role authenticated;
update organization_settings set attendance_late_enabled=false,attendance_late_minutes=17 where id=1;
select update_event_attendance_options('93000000-0000-0000-0000-000000000001','none',null,true);
select att_assert((select tolerance_minutes=3 from attendance_records where id=(select (value->>'id')::uuid from att_state where key='record')),'default and event edits do not rewrite history');
select att_assert((select effective_late_minutes=0 from attendance_sessions where id=(select (value->>'id')::uuid from att_state where key='session')),'event removal applies zero grace to future checkins');
select att_assert((get_member_attendance_history('92000000-0000-0000-0000-000000000002',null,null,'Workshop',null)->>'total')::int=1,'type filter');
select att_assert((get_member_attendance_history('92000000-0000-0000-0000-000000000002',null,null,null,'absent')->>'total')::int=0,'no invented absences');
select att_assert((get_member_attendance_history('92000000-0000-0000-0000-000000000002',(now() at time zone 'Africa/Cairo')::date+1)->>'total')::int=0,'date filter');
insert into att_state select 'rotated',manage_attendance_qr((value->>'id')::uuid,(now() at time zone 'Africa/Cairo')::date,'rotate') from att_state where key='session';
do $$begin
 begin perform resolve_attendance_code((select value->>'qr_code' from att_state where key='code'));raise exception 'TEST FAILED: old rotated token';exception when others then if sqlerrm not like '%revoked or is invalid%' then raise;end if;end;
end$$;
select att_assert(resolve_attendance_code((select value->>'qr_code' from att_state where key='rotated')) is not null,'new rotated code resolves');
select manage_attendance_qr((select (value->>'id')::uuid from att_state where key='session'),(now() at time zone 'Africa/Cairo')::date,'revoke');
do $$begin
 begin perform check_in_attendance((select value->>'qr_code' from att_state where key='rotated'));raise exception 'TEST FAILED: revoked scan';exception when others then if sqlerrm not like '%revoked or is invalid%' then raise;end if;end;
end$$;
select manage_attendance_qr((select (value->>'id')::uuid from att_state where key='session'),(now() at time zone 'Africa/Cairo')::date,'close');
reset role;
-- Exact boundary uses real PostgreSQL timestamp precision (start + 3 min vs +1 ms).
insert into attendance_sessions(id,name,session_date,session_time,end_time,expires_at,created_by,late_tolerance_mode,late_tolerance_minutes) values
('94000000-0000-0000-0000-000000000001','Boundary',(now() at time zone 'Africa/Cairo')::date,'19:00','20:00',now()+interval '1 day','92000000-0000-0000-0000-000000000001','custom',3),
('94000000-0000-0000-0000-000000000002','No grace',(now() at time zone 'Africa/Cairo')::date,'19:00','20:00',now()+interval '1 day','92000000-0000-0000-0000-000000000001','none',null);
insert into attendance_records(session_id,person_id,occurrence_date,check_in_at) select '94000000-0000-0000-0000-000000000001',id,(now() at time zone 'Africa/Cairo')::date,(((now() at time zone 'Africa/Cairo')::date+time '19:03') at time zone 'Africa/Cairo')+case when id::text like '%2' then interval '0' else interval '1 millisecond' end from profiles where id in ('92000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000003');
select att_assert((select status='present' from attendance_records where session_id='94000000-0000-0000-0000-000000000001' and person_id='92000000-0000-0000-0000-000000000002'),'19:03 exactly is on time');
select att_assert((select status='late' and late_by_minutes=4 from attendance_records where session_id='94000000-0000-0000-0000-000000000001' and person_id='92000000-0000-0000-0000-000000000003'),'19:03 plus 1 ms is late; minutes measured from start');
insert into attendance_records(session_id,person_id,occurrence_date,check_in_at) select '94000000-0000-0000-0000-000000000002',id,(now() at time zone 'Africa/Cairo')::date,(((now() at time zone 'Africa/Cairo')::date+time '19:00') at time zone 'Africa/Cairo')+case when id::text like '%2' then interval '0' else interval '1 millisecond' end from profiles where id in ('92000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000003');
select att_assert((select status='present' from attendance_records where session_id='94000000-0000-0000-0000-000000000002' and person_id='92000000-0000-0000-0000-000000000002'),'zero grace exact start is on time');
select att_assert((select status='late' from attendance_records where session_id='94000000-0000-0000-0000-000000000002' and person_id='92000000-0000-0000-0000-000000000003'),'zero grace after start is late');
do $$begin
 begin update attendance_records set tolerance_minutes=100 where session_id='94000000-0000-0000-0000-000000000001';raise exception 'TEST FAILED: history rewrite';exception when others then if sqlerrm not like '%immutable%' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select att_assert((select count(*)=0 from attendance_records where person_id='92000000-0000-0000-0000-000000000002'),'record RLS prevents other member reads');
reset role;
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select att_assert((select count(*)=0 from attendance_records),'inactive record RLS');
do $$begin
 begin perform resolve_attendance_code('invalid');raise exception 'TEST FAILED: inactive resolve';exception when insufficient_privilege then null;end;
 begin perform get_member_attendance_history(auth.uid());raise exception 'TEST FAILED: inactive history';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 begin perform resolve_attendance_code('invalid');raise exception 'TEST FAILED: anonymous resolve';exception when insufficient_privilege then null;end;
 begin perform create_attendance_session('{}');raise exception 'TEST FAILED: anonymous create';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
