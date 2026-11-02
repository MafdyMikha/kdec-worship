-- Upgrade fixture for the pre-feature base schema; in-memory test database only.
begin;
select set_config('app.admin_user_update','1',true);
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values('95000000-0000-0000-0000-000000000001','attendance-upgrade@example.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into profiles(id,name,email,access_level,status) values('95000000-0000-0000-0000-000000000001','Synthetic Legacy','attendance-upgrade@example.invalid','super_admin','active');
insert into attendance_sessions(id,name,session_date,session_time,end_time,qr_code,repeatable,repeat_freq,created_by)
values('95000000-0000-0000-0000-000000000002','Legacy recurring',(now() at time zone 'Africa/Cairo')::date-1,'19:00','20:00','synthetic-old-session-code',true,'daily','95000000-0000-0000-0000-000000000001');
insert into attendance_records(session_id,person_id,occurrence_date,check_in_at,status)
select '95000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000001',(now() at time zone 'Africa/Cairo')::date-1,(((now() at time zone 'Africa/Cairo')::date-1+time '19:16') at time zone 'Africa/Cairo'),'present';
commit;
