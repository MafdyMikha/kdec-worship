-- Run only against the isolated fixture database. All scenario data rolls back.
begin;
create function public.test_assert(ok boolean, message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'TEST FAILED: %',message; end if; end;$$;
insert into profiles(id,name,access_level) values
 ('00000000-0000-0000-0000-000000000001','Super Admin','super_admin'),
 ('00000000-0000-0000-0000-000000000002','Worship Leader','member'),
 ('00000000-0000-0000-0000-000000000003','Original Guitar','member'),
 ('00000000-0000-0000-0000-000000000004','Guitar One','member'),
 ('00000000-0000-0000-0000-000000000005','Guitar Two','member'),
 ('00000000-0000-0000-0000-000000000006','Guitar Three','member'),
 ('00000000-0000-0000-0000-000000000007','Backup Leader','member'),
 ('00000000-0000-0000-0000-000000000008','Ordinary Admin','admin'),
 ('00000000-0000-0000-0000-000000000009','Unavailable','member');
update profiles set availability='{}' where name='Unavailable';
insert into worship_roles(id,name) values ('10000000-0000-0000-0000-000000000001','Worship Leader'),('10000000-0000-0000-0000-000000000002','Guitar');
update worship_roles set schedule_leader_role=true where name='Worship Leader';
insert into profile_worship_roles select id,'10000000-0000-0000-0000-000000000002'::uuid from profiles where name like '%Guitar%' or name='Unavailable';
insert into profile_worship_roles select id,'10000000-0000-0000-0000-000000000001'::uuid from profiles where name in ('Worship Leader','Backup Leader');
insert into services(id,title,date,time) values ('20000000-0000-0000-0000-000000000001','Quarterly test',current_date+7,'18:00');
insert into service_team(service_id,person_id,worship_role_id,role) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Worship Leader'),
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Guitar');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
select publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);
select publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);
reset role;
select test_assert((select count(*)=2 from schedule_notifications),'publish retries do not duplicate notifications');
select test_assert((select count(*)=2 from schedule_slots),'publish retries do not duplicate slots');
select test_assert(not schedule_eligible((select id from schedule_slots where not leader),'00000000-0000-0000-0000-000000000009'),'missing availability excluded');
select test_assert(not schedule_eligible((select id from schedule_slots where not leader),'00000000-0000-0000-0000-000000000007'),'wrong role excluded');
update profiles set time_slots=jsonb_build_array(jsonb_build_object('day',lower(to_char(current_date+7,'Dy')),'from','09:00','to','10:00')) where id='00000000-0000-0000-0000-000000000004';
select test_assert(not schedule_eligible((select id from schedule_slots where not leader),'00000000-0000-0000-0000-000000000004'),'outside available time window excluded');
update profiles set time_slots='[]' where id='00000000-0000-0000-0000-000000000004';
insert into services(id,title,date,time) values ('20000000-0000-0000-0000-000000000002','Conflicting draft',current_date+7,'20:00');
insert into service_team(service_id,person_id,worship_role_id,role) values ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Guitar');
select test_assert(not schedule_eligible((select id from schedule_slots where not leader),'00000000-0000-0000-0000-000000000004'),'same-day draft conflict excluded');
delete from service_team where service_id='20000000-0000-0000-0000-000000000002';
delete from services where id='20000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
set role authenticated;
select test_assert((select count(*)=2 from schedule_slots),'ordinary member sees all slots');
select test_assert((select count(*)=0 from schedule_attempts),'ordinary member cannot read internal attempts');
do $$begin
 begin perform publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);raise exception 'TEST FAILED publish permission'; exception when insufficient_privilege then null;end;
 begin update schedule_slots set state='confirmed';raise exception 'TEST FAILED direct mutation'; exception when insufficient_privilege then null;end;
end$$;
do $$declare sl public.schedule_slots; begin
 select * into sl from schedule_slots where not leader;
 if to_regprocedure('public.submit_service_excuse(uuid,text)') is not null then
   begin
     perform submit_schedule_excuse(sl.service_id,'');
     raise exception 'TEST FAILED invalid excuse accepted';
   exception when others then
     if sqlerrm='TEST FAILED invalid excuse accepted' then raise;end if;
   end;
   if not exists(select 1 from schedule_slots where id=sl.id and state='pending' and person_id=auth.uid()) then raise exception 'TEST FAILED failed excuse did not roll back decline';end if;
   perform submit_schedule_excuse(sl.service_id,'Synthetic isolated test reason');
 else
   perform respond_schedule_assignment(sl.id,sl.version,'declined');
 end if;
end$$;
reset role;
select test_assert((select count(*)=0 from schedule_attempts where state='proposed'),'pause until leader confirms');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
select respond_schedule_assignment(id,version,'confirmed') from schedule_slots where leader;
reset role;
select test_assert((select count(*)=1 from schedule_attempts where state='proposed'),'automatically proposed');
select test_assert((select status='declined' from service_team where person_id='00000000-0000-0000-0000-000000000003'),'legacy assignment synchronized on decline');
select test_assert((select count(*)=1 from schedule_notifications where kind='approval_required'),'one notification per proposal and leader');
select test_assert(not exists(select 1 from schedule_notifications n join schedule_attempts a on n.recipient=a.person_id where a.state='proposed'),'proposal candidate not notified');
set role authenticated;
select decide_schedule_replacement(slot_id,id,false) from schedule_attempts where state='proposed';
reset role;
select test_assert((select count(*)=1 from schedule_attempts where state='rejected'),'rejection audited');
select test_assert((select count(*)=1 from schedule_attempts where state='proposed'),'new candidate selected');
set role authenticated;
select decide_schedule_replacement(slot_id,id,true) from schedule_attempts where state='proposed';
reset role;
select test_assert((select count(*)=1 from schedule_notifications where kind='replacement_assignment'),'notify only after approval');
select test_assert(exists(select 1 from service_team t join schedule_slots s on s.service_id=t.service_id and s.person_id=t.person_id where not s.leader and t.status='pending'),'approved replacement persisted to legacy consumers');
select set_config('request.jwt.claim.sub',(select person_id::text from schedule_slots where not leader),false);
set role authenticated;
do $$begin
 begin perform respond_schedule_assignment((select id from schedule_slots where not leader),0,'confirmed');raise exception 'TEST FAILED stale version';exception when raise_exception then if sqlerrm='TEST FAILED stale version' then raise;end if;end;
end$$;
select respond_schedule_assignment(id,version,'confirmed') from schedule_slots where not leader;
select test_assert((select state='confirmed' from schedule_slots where not leader),'replacement can confirm');
reset role;
do $$declare created public.services; saved_identity text:=auth.uid()::text; begin
 if to_regprocedure('public.generate_legacy_service_occurrences(uuid,uuid,jsonb)') is not null then
   update public.services set recurrence_group_id='30000000-0000-0000-0000-000000000001',recurrence_frequency='weekly',recurrence_index=0 where id='20000000-0000-0000-0000-000000000001';
   perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
   for created in select * from public.generate_service_occurrences('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('date',current_date+14,'recurrence_index',1))) loop
     perform public.test_assert((select count(*)=2 from public.service_team where service_id=created.id),'recurrence copies only the current approved team');
     perform public.test_assert(not exists(select 1 from public.service_team where service_id=created.id and person_id='00000000-0000-0000-0000-000000000003'),'recurrence does not reassign declined history');
   end loop;
   perform set_config('request.jwt.claim.sub',saved_identity,true);
 end if;
end$$;
set role authenticated;
select respond_schedule_assignment(id,version,'declined') from schedule_slots where not leader;
reset role;
select test_assert((select count(*)=1 from schedule_attempts where state='proposed'),'replacement decline reproposes');
select test_assert((select count(*)=4 from schedule_attempts where slot_id=(select id from schedule_slots where not leader)),'assignment history retained');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
select respond_schedule_assignment(id,version,'declined') from schedule_slots where leader;
reset role;
select test_assert((select count(*)=1 from schedule_notifications where kind='leader_required'),'Super Admin notified about leader vacancy');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
set role authenticated;
do $$begin
 begin perform decide_schedule_replacement((select id from schedule_slots where leader),null,true,'00000000-0000-0000-0000-000000000007');raise exception 'TEST FAILED admin leader override';exception when insufficient_privilege then null;end;
 begin update service_team set person_id='00000000-0000-0000-0000-000000000007' where role='Worship Leader';raise exception 'TEST FAILED legacy bypass';exception when raise_exception then if sqlerrm='TEST FAILED legacy bypass' then raise;end if;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
select decide_schedule_replacement(id,null,true,'00000000-0000-0000-0000-000000000007') from schedule_slots where leader;
reset role;
select test_assert((select state='pending' from schedule_slots where leader),'replacement leader needs own confirmation');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
set role authenticated;
select respond_schedule_assignment(id,version,'confirmed') from schedule_slots where leader;
select decide_schedule_replacement(slot_id,id,false) from schedule_attempts where state='proposed';
reset role;
select test_assert((select count(*)=0 from schedule_attempts where state='proposed'),'exhausted candidates remain unresolved');
select test_assert((select count(*)>=1 from schedule_notifications where kind='no_candidate'),'no candidate notification');
update profiles set availability='{}' where id='00000000-0000-0000-0000-000000000007';
select test_assert((select state='vacant' and person_id is null from schedule_slots where leader),'unavailable leader becomes vacant');
select test_assert((select count(*)=2 from schedule_notifications where kind='leader_required'),'unavailable leader escalates to Super Admin');
update profiles set status='inactive' where id='00000000-0000-0000-0000-000000000007';
select test_assert((select count(*)=2 from schedule_notifications where kind='leader_required'),'repeated unavailability does not duplicate notification');
update profiles set status='inactive' where id='00000000-0000-0000-0000-000000000009';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
set role authenticated;
select test_assert((select count(*)=0 from schedule_slots),'inactive cannot view schedule');
reset role;
set role anon;
do $$begin
 begin perform count(*) from schedule_slots;raise exception 'TEST FAILED anonymous read';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
\echo 'Quarterly workflow, notification ordering, privacy and permissions passed.'
