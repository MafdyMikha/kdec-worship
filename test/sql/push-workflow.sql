-- Synthetic, rollback-only test. No real auth service or push provider.
begin;
create function public.push_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'TEST FAILED: %',message; end if;end;$$;
select set_config('app.admin_user_update','1',true);
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) select ('90000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'push-'||i||'@example.invalid' from generate_series(1,5) i;
alter table auth.users enable trigger on_auth_user_created;
insert into profiles(id,name,access_level,status) values
 ('90000000-0000-4000-8000-000000000001','Push manager','leader','active'),
 ('90000000-0000-4000-8000-000000000002','Push member','member','active'),
 ('90000000-0000-4000-8000-000000000003','Inactive member','member','inactive'),
 ('90000000-0000-4000-8000-000000000004','Unassigned member','member','active'),
 ('90000000-0000-4000-8000-000000000005','Another participant','member','active');
grant select on services,service_team,setlist_items to authenticated;
grant select,insert on announcements to authenticated;
grant select on profile_worship_roles,worship_roles to authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select register_push_subscription('https://fcm.googleapis.com/fcm/send/synthetic-device-a',repeat('A',87),repeat('B',22),'91000000-0000-4000-8000-000000000002','ar');
select register_push_subscription('https://fcm.googleapis.com/fcm/send/synthetic-device-b',repeat('A',87),repeat('B',22),'91000000-0000-4000-8000-000000000003','ar');
select push_assert((select count(*)=2 from push_subscriptions),'member owns multiple devices');
do $$begin
 begin perform register_push_subscription('https://127.0.0.1/private',repeat('A',87),repeat('B',22),gen_random_uuid(),'en');raise exception 'TEST FAILED: private endpoint accepted';exception when others then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform register_push_subscription('https://fcm.googleapis.com.evil.test/send',repeat('A',87),repeat('B',22),gen_random_uuid(),'en');raise exception 'TEST FAILED: spoofed host accepted';exception when others then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform push_enqueue('announcements','forged');raise exception 'TEST FAILED: client queued jobs';exception when insufficient_privilege then null;end;
 begin perform claim_push_jobs();raise exception 'TEST FAILED: member dispatched';exception when insufficient_privilege then null;end;
 begin insert into push_jobs(subscription_id,recipient,category,dedupe_key) select id,user_id,'test','forged' from push_subscriptions;raise exception 'TEST FAILED: client inserted jobs';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select register_push_subscription('https://web.push.apple.com/synthetic-manager',repeat('A',87),repeat('B',22),'91000000-0000-4000-8000-000000000001','en');
select push_assert((select count(*)=1 from push_subscriptions),'manager cannot enumerate others devices');
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select register_push_subscription('https://updates.push.services.mozilla.com/wpush/v2/synthetic-unassigned',repeat('A',87),repeat('B',22),'91000000-0000-4000-8000-000000000004','en');
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000005',true);
set local role authenticated;
select register_push_subscription('https://fcm.googleapis.com/fcm/send/synthetic-participant',repeat('A',87),repeat('B',22),'91000000-0000-4000-8000-000000000005','en');
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$begin
 begin perform register_push_subscription('https://fcm.googleapis.com/fcm/send/inactive',repeat('A',87),repeat('B',22),gen_random_uuid(),'en');raise exception 'TEST FAILED: inactive registered';exception when insufficient_privilege then null;end;
end$$;
select push_assert((select count(*)=0 from push_preferences),'inactive reads no preferences');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 begin perform register_push_subscription('https://fcm.googleapis.com/fcm/send/anon',repeat('A',87),repeat('B',22),gen_random_uuid(),'en');raise exception 'TEST FAILED: anon registered';exception when insufficient_privilege then null;end;
end$$;
reset role;

-- Create a draft through the real manager RPC; explicit participants avoid
-- inventing role assignments for this general meeting.
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select * from save_planning_events(jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000001','title','Push synthetic meeting','event_kind','general_meeting','date',current_date+7,'end_date',current_date+7,'time','18:00','end_time','20:00','participant_ids',jsonb_build_array('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000005'),'practice',jsonb_build_object('enabled',true,'date',current_date+6,'time','18:00'),'team','[]'::jsonb)),false);
update services set setlist_blocks='{"opening":"Draft song"}' where id='92000000-0000-4000-8000-000000000001';
reset role;
select push_assert((select count(*)=0 from push_jobs),'draft and draft setlist are silent');
set local role authenticated;
select publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);
reset role;
select push_assert((select count(*)=3 from push_jobs where category='schedule'),'publication targets participants devices, excluding actor');
select push_assert((select count(*)=8 from push_jobs where category='reminders'),'service and rehearsal reminders target all participant devices including actor');
select push_assert((select bool_and(due_at=occurrence_at-interval '1 hour') from push_jobs where category='reminders'),'one-hour lead time');
select push_assert((select bool_and(occurrence_at=((current_date+7+time '18:00') at time zone 'Africa/Cairo')) from push_jobs where category='reminders' and not rehearsal),'Cairo timezone retained');
set local role authenticated;
select publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);
update services set setlist_blocks='{"opening":"Published song"}' where id='92000000-0000-4000-8000-000000000001';
reset role;
select push_assert((select count(*)=3 from push_jobs where category='schedule'),'repeat publishing does not duplicate');
select push_assert((select count(*)=3 from push_jobs where category='setlists'),'published setlist targets participants');
-- Existing assignment notification path (also used by replacement approvals).
insert into schedule_notifications(recipient,service_id,kind,dedupe_key) values('90000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','replacement_assignment','synthetic-replacement');
select push_assert((select count(*)=2 from push_jobs where category='assignments'),'assignment/replacement targets only recipient devices');
-- Preferences and access are rechecked after enqueue, not trusted from the event.
update push_preferences set setlists=false where user_id='90000000-0000-4000-8000-000000000002';
select push_assert((select bool_and(not push_job_allowed(id)) from push_jobs where category='setlists' and recipient='90000000-0000-4000-8000-000000000002'),'opt-out invalidates queued work');
update profiles set status='inactive' where id='90000000-0000-4000-8000-000000000005';
select push_assert((select bool_and(not push_job_allowed(id)) from push_jobs where recipient='90000000-0000-4000-8000-000000000005'),'inactive recipients skipped at delivery');
-- Announcements publish immediately. Body text is never copied into jobs.
set local role authenticated;
insert into announcements(id,title,content,author_id) values('93000000-0000-4000-8000-000000000001','Synthetic','Never copy this private content','90000000-0000-4000-8000-000000000001');
reset role;
select push_assert((select count(*)=3 from push_jobs where category='announcements'),'announcements target active subscriptions excluding author');
-- Failed/rolled-back business writes leave no orphan outbox records.
savepoint rolled_back_announcement;
insert into announcements(id,title,content,author_id) values('93000000-0000-4000-8000-000000000099','Rollback','Rollback','90000000-0000-4000-8000-000000000001');
select push_assert(exists(select 1 from push_jobs where announcement_id='93000000-0000-4000-8000-000000000099'),'outbox exists inside business transaction');
rollback to savepoint rolled_back_announcement;
select push_assert(not exists(select 1 from push_jobs where announcement_id='93000000-0000-4000-8000-000000000099'),'rollback removes outbox with source write');
-- Test can queue only own device, with account-level rate limiting.
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select queue_push_test((select id from push_subscriptions where endpoint like '%device-a'));
do $$begin
 begin perform queue_push_test((select id from push_subscriptions where endpoint like '%device-b'));raise exception 'TEST FAILED: unlimited tests';exception when others then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform queue_push_test('99999999-0000-4000-8000-000000000001');raise exception 'TEST FAILED: tested foreign device';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Safe leases and retries, including stale-worker completion rejection.
create temp table push_claims as select * from claim_push_jobs(50);
select push_assert((select count(*)>0 from push_claims),'due work claimed');
select push_assert((select count(*)=0 from claim_push_jobs(50)),'active leases cannot be claimed twice');
select push_assert((select count(*)=0 from push_claims c cross join lateral prepare_push_delivery(c.id,c.lease_token) d where d is not null and (d->>'endpoint') is null),'prepared delivery has endpoint');
select finish_push_job(id,gen_random_uuid(),201) from push_claims;
select push_assert((select bool_and(state<>'sent') from push_jobs),'stale worker cannot finish another lease');
select finish_push_job(c.id,c.lease_token,503) from push_claims c join push_jobs j on j.id=c.id where j.state='processing';
select push_assert((select count(*)>0 from push_jobs where state='pending' and attempts=1 and due_at>now()),'transient failures back off');
-- Advance synthetic due times, not the real clock.
update push_jobs set due_at=now()-interval '1 minute' where state='pending' and category<>'reminders';
truncate push_claims;
insert into push_claims select * from claim_push_jobs(50);
select prepare_push_delivery(id,lease_token) from push_claims;
select finish_push_job(c.id,c.lease_token,201) from push_claims c join push_jobs j on j.id=c.id where j.state='processing';
select push_assert((select count(*)>0 from push_jobs where state='sent' and last_status=201),'delivery results persist');
-- Cancel invalidates both reminders; no obsolete reminder is delivered.
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
set local role authenticated;
update services set status='cancelled' where id='92000000-0000-4000-8000-000000000001';
reset role;
select push_assert((select bool_and(not push_job_allowed(id)) from push_jobs where category='reminders'),'cancelled service and rehearsal reminders invalidated');
-- A real team assignment travels through publication -> existing assignment
-- inbox -> push outbox, all within the original transaction.
savepoint team_publication;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
insert into profile_worship_roles(profile_id,role_id) select '90000000-0000-4000-8000-000000000002',id from worship_roles where active limit 1 on conflict do nothing;
set local role authenticated;
select * from save_planning_events(jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000002','title','Synthetic assigned meeting','event_kind','general_meeting','date',current_date+8,'end_date',current_date+8,'time','18:00','end_time','20:00','team',jsonb_build_array(jsonb_build_object('person_id','90000000-0000-4000-8000-000000000002','worship_role_id',(select role_id from profile_worship_roles where profile_id='90000000-0000-4000-8000-000000000002' limit 1),'status','pending')))),false);
select publish_schedule_quarter(date_trunc('quarter',current_date+8)::date);
reset role;
select push_assert((select count(*)=2 from push_jobs where category='assignments' and service_id='92000000-0000-4000-8000-000000000002'),'real published assignment reaches both member devices');
select push_assert((select count(*)=1 from schedule_notifications where service_id='92000000-0000-4000-8000-000000000002' and kind='assignment'),'existing assignment inbox preserved');
rollback to savepoint team_publication;
-- Simulate an obsolete job timestamp: current schedule is authoritative.
update push_jobs set occurrence_at=occurrence_at+interval '1 day' where category='reminders';
select push_assert((select bool_and(not push_job_allowed(id)) from push_jobs where category='reminders'),'stale occurrence snapshots cannot send');
-- Crashed workers reclaim expired leases; fifth failures terminate.
update push_jobs set state='processing',attempts=4,leased_at=now()-interval '6 minutes',due_at=now()-interval '1 minute' where category='setlists';
truncate push_claims;
insert into push_claims select * from claim_push_jobs(50);
select finish_push_job(id,lease_token,503) from push_claims;
select push_assert((select count(*)>0 from push_jobs where category='setlists' and state='failed' and attempts=5),'retry limit terminates stale/failing work');
-- Permanent expiry deactivates only this device and retains delivery diagnostics.
update push_jobs set state='processing',lease_token='94000000-0000-4000-8000-000000000001',leased_at=now() where category='test';
select finish_push_job(id,'94000000-0000-4000-8000-000000000001',410) from push_jobs where category='test';
select push_assert((select not active from push_subscriptions where endpoint like '%device-a'),'expired device deactivated');
select push_assert((select active from push_subscriptions where endpoint like '%device-b'),'other device unaffected');
select push_assert((select last_status=410 and state='failed' from push_jobs where category='test'),'permanent failure diagnostic retained');
rollback;
