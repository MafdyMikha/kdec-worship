-- Dedicated FULL-SCHEMA test database only, after MIGRATION_unified_calendar.sql.
-- Synthetic identities only. No email/WhatsApp provider is used. All rows roll back.
begin;
create function public.calendar_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'TEST FAILED: %',message; end if;end;$$;
select set_config('app.admin_user_update','1',true);
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) select ('90000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'calendar-'||i||'@example.invalid' from generate_series(1,4) i;
alter table auth.users enable trigger on_auth_user_created;
insert into public.profiles(id,name,email,access_level,status) values
 ('90000000-0000-0000-0000-000000000001','Synthetic Super Admin','calendar-1@example.invalid','super_admin','active'),
 ('90000000-0000-0000-0000-000000000002','Synthetic Member','calendar-2@example.invalid','member','active'),
 ('90000000-0000-0000-0000-000000000003','Synthetic Inactive','calendar-3@example.invalid','member','inactive'),
 ('90000000-0000-0000-0000-000000000004','Synthetic Manager','calendar-4@example.invalid','leader','active');
-- Test scaffolding mirrors Supabase's ordinary grants, retaining column restrictions.
grant select on public.services,public.service_team,public.setlist_items to authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select * from public.save_planning_events(jsonb_build_array(jsonb_build_object('id','91000000-0000-0000-0000-000000000001','title','Synthetic overnight shift','event_kind','prayer_shift','date',current_date+7,'end_date',current_date+8,'time','23:00','end_time','02:00','location','Synthetic room','team','[]'::jsonb)),false);
select * from public.save_planning_events(jsonb_build_array(jsonb_build_object('id','91000000-0000-0000-0000-000000000002','title','Synthetic conference','event_kind','conference','date',current_date+9,'end_date',current_date+11,'time','10:00','end_time','16:00','team','[]'::jsonb)),false);
reset role;
select calendar_assert((select count(*)=0 from schedule_notifications),'draft saves send no notifications');
select calendar_assert((select end_date=date+1 and end_time='02:00' from services where id='91000000-0000-0000-0000-000000000001'),'overnight range persists');
-- A whole batch must roll back when a later row fails, even though the first is valid.
set local role authenticated;
do $$begin
 begin
 perform public.save_planning_events(jsonb_build_array(
   jsonb_build_object('id','91000000-0000-0000-0000-000000000003','title','Rollback valid row','event_kind','general_meeting','date',current_date+12,'end_date',current_date+12,'time','18:00','end_time','19:00','team','[]'::jsonb),
   jsonb_build_object('id','91000000-0000-0000-0000-000000000004','title','Rollback invalid row','event_kind','service','date',current_date+12,'end_date',current_date+12,'time','19:00','end_time','18:00','team','[]'::jsonb)),false);
 raise exception 'TEST FAILED: invalid batch accepted';
 exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end$$;
reset role;
select calendar_assert(not exists(select 1 from services where id='91000000-0000-0000-0000-000000000003'),'failed batch rolls back earlier inserts');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select calendar_assert((select count(*)=0 from services where id::text like '91000000%'),'member cannot read drafts');
do $$begin
 begin perform public.save_planning_events('[]',false);raise exception 'TEST FAILED: member write';exception when insufficient_privilege then null;end;
 begin update services set published_at=now();raise exception 'TEST FAILED: direct publication';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
set local role authenticated;
-- Non-worship gatherings publish without a Worship Leader or setlist.
select publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);
select publish_schedule_quarter(date_trunc('quarter',current_date+7)::date);
reset role;
select calendar_assert((select published_at is not null from services where id='91000000-0000-0000-0000-000000000001'),'zero-assignment event publication persists');
select calendar_assert((select count(*)=0 from schedule_notifications),'no team means no assignment notification');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select calendar_assert((select count(*)>=1 from services where id::text like '91000000%'),'member sees published zero-team calendar');
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select calendar_assert((select count(*)=0 from services),'inactive members cannot read calendar');
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000004',true);
set local role authenticated;
do $$begin
 begin update services set location='Changed' where id='91000000-0000-0000-0000-000000000001';raise exception 'TEST FAILED: published location edit';exception when others then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 begin perform public.save_planning_events(jsonb_build_array(jsonb_build_object('id','91000000-0000-0000-0000-000000000005','title','Synthetic overnight shift','event_kind','prayer_shift','date',current_date+7,'end_date',current_date+8,'time','23:00','end_time','02:00','team','[]'::jsonb)),false);raise exception 'TEST FAILED: duplicate event';exception when others then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end$$;
update services set status='cancelled' where id='91000000-0000-0000-0000-000000000001';
reset role;
select calendar_assert((select status='cancelled' and published_at is not null from services where id='91000000-0000-0000-0000-000000000001'),'cancel preserves published event');
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 begin perform public.save_planning_events('[]',false);raise exception 'TEST FAILED: anonymous write';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
