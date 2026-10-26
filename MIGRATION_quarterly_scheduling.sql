-- Apply after the full schema and MIGRATION_dynamic_roles_admin.sql.
-- No existing services or assignments are deleted.
begin;
-- Preserve the leader role identity even when its display name is renamed.
alter table public.worship_roles add column if not exists schedule_leader_role boolean not null default false;
update public.worship_roles set schedule_leader_role=true where lower(trim(name))='worship leader' and not schedule_leader_role;
create table if not exists public.schedule_quarters (
  starts_on date primary key, published_at timestamptz not null default now(),
  published_by uuid not null references public.profiles(id),
  check (extract(day from starts_on)=1 and extract(month from starts_on) in (1,4,7,10))
);
create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  quarter date not null references public.schedule_quarters(starts_on),
  service_id uuid not null references public.services(id),
  role_id uuid not null references public.worship_roles(id), role text not null,
  leader boolean not null default false,
  person_id uuid references public.profiles(id),
  state text not null default 'pending' check (state in ('pending','confirmed','vacant')),
  source_assignment uuid unique references public.service_team(id),
  version integer not null default 1
);
create unique index if not exists schedule_one_person_per_service on public.schedule_slots(service_id,person_id) where person_id is not null;
create unique index if not exists schedule_one_leader on public.schedule_slots(service_id) where leader;
create table if not exists public.schedule_attempts (
  id uuid primary key default gen_random_uuid(), slot_id uuid not null references public.schedule_slots(id),
  person_id uuid not null references public.profiles(id),
  state text not null check (state in ('proposed','rejected','notified','confirmed','declined')),
  replacement boolean not null default true, created_at timestamptz not null default now(),
  unique(slot_id,person_id)
);
create unique index if not exists schedule_one_proposal on public.schedule_attempts(slot_id) where state='proposed';
create table if not exists public.schedule_audit (
  id bigint generated always as identity primary key, slot_id uuid references public.schedule_slots(id),
  actor uuid references public.profiles(id), action text not null, person_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.schedule_notifications (
  id uuid primary key default gen_random_uuid(), recipient uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id), kind text not null,
  dedupe_key text not null unique, created_at timestamptz not null default now(), read_at timestamptz
);
alter table public.schedule_quarters enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.schedule_attempts enable row level security;
alter table public.schedule_audit enable row level security;
alter table public.schedule_notifications enable row level security;

create or replace function public.schedule_is_leader(p_service uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.is_active_member() and exists(select 1 from public.schedule_slots where service_id=p_service and leader and person_id=auth.uid() and state='confirmed');
$$;
drop policy if exists schedule_read on public.schedule_quarters;
create policy schedule_read on public.schedule_quarters for select to authenticated using(public.is_active_member());
drop policy if exists schedule_read on public.schedule_slots;
create policy schedule_read on public.schedule_slots for select to authenticated using(public.is_active_member());
drop policy if exists schedule_review on public.schedule_attempts;
create policy schedule_review on public.schedule_attempts for select to authenticated using(public.is_active_member() and (public.is_super_admin() or exists(select 1 from public.schedule_slots s where s.id=slot_id and public.schedule_is_leader(s.service_id))));
drop policy if exists schedule_audit_read on public.schedule_audit;
create policy schedule_audit_read on public.schedule_audit for select to authenticated using(public.is_active_member() and (public.is_super_admin() or exists(select 1 from public.schedule_slots s where s.id=slot_id and public.schedule_is_leader(s.service_id))));
drop policy if exists schedule_inbox on public.schedule_notifications;
create policy schedule_inbox on public.schedule_notifications for select to authenticated using(public.is_active_member() and recipient=auth.uid());
revoke all on public.schedule_quarters,public.schedule_slots,public.schedule_attempts,public.schedule_audit,public.schedule_notifications from anon,authenticated;
grant select on public.schedule_quarters,public.schedule_slots,public.schedule_attempts,public.schedule_audit,public.schedule_notifications to authenticated;

-- Conservative conflict rule: an assignment reserves the entire service/rehearsal day.
-- Missing availability is not permission to auto-assign. Both dates must be available.
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
   select 1 from (select s.date as day,s.time as clock union all
     select (s.practice->>'date')::date,s.practice->>'time' where s.practice->>'enabled'='true') needed
   where coalesce(p.availability->>lower(to_char(needed.day,'Dy')),'false') <> 'true'
   or (exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')))
       and not exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')) and ts->>'from' <= needed.clock and ts->>'to' > needed.clock))
   or exists(select 1 from public.services other where other.id<>s.id and other.status='scheduled'
     and (other.date=needed.day or (other.practice->>'enabled'='true' and other.practice->>'date'=needed.day::text))
     and (exists(select 1 from public.schedule_slots os where os.service_id=other.id and os.person_id=p.id)
       or (not exists(select 1 from public.schedule_slots os where os.service_id=other.id)
         and exists(select 1 from public.service_team ot where ot.service_id=other.id and ot.person_id=p.id and ot.status<>'declined'))
       or exists(select 1 from public.schedule_attempts oa join public.schedule_slots os on os.id=oa.slot_id where os.service_id=other.id and oa.person_id=p.id and oa.state='proposed')))
  )
 );
$$;

create or replace function public.schedule_notify(p_person uuid,p_service uuid,p_kind text,p_key text)
returns void language sql security definer set search_path=public as $$
 insert into public.schedule_notifications(recipient,service_id,kind,dedupe_key)
 values(p_person,p_service,p_kind,p_key) on conflict(dedupe_key) do nothing;
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
   (select count(*) from public.schedule_slots x where x.quarter=sl.quarter and x.person_id=p.id)+
   (select count(*) from public.service_team t join public.services s on s.id=t.service_id where t.person_id=p.id and t.status<>'declined' and s.date>=sl.quarter and s.date<sl.quarter+interval '3 months' and not exists(select 1 from public.schedule_slots x where x.service_id=s.id))+
   2*(select count(*) from public.schedule_attempts a join public.schedule_slots x on x.id=a.slot_id where x.quarter=sl.quarter and a.person_id=p.id and a.replacement and a.state in ('proposed','notified','confirmed','declined')))
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

create or replace function public.publish_schedule_quarter(p_start date)
returns void language plpgsql security definer set search_path=public as $$
declare svc public.services; t public.service_team; sid uuid;
begin
 if not public.is_active_member() or not public.has_permission('schedules.manage') then raise exception 'Schedule manager permission required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(762901);
 if p_start is null or p_start<>date_trunc('quarter',p_start)::date then raise exception 'Choose a quarter start'; end if;
 if p_start+interval '3 months' <= (now() at time zone 'Africa/Cairo')::date then raise exception 'Cannot publish a past quarter'; end if;
 if not exists(select 1 from public.services where date>=greatest(p_start,(now() at time zone 'Africa/Cairo')::date) and date<p_start+interval '3 months' and status='scheduled') then raise exception 'Create upcoming services before publishing'; end if;
 insert into public.schedule_quarters(starts_on,published_by) values(p_start,auth.uid()) on conflict do nothing;
 for svc in select * from public.services where date>=greatest(p_start,(now() at time zone 'Africa/Cairo')::date) and date<p_start+interval '3 months' and status='scheduled' and not exists(select 1 from public.schedule_slots sl where sl.service_id=services.id) order by id for update loop
   if exists(select 1 from public.substitute_requests where service_id=svc.id and status in ('open','filled')) then raise exception 'Resolve legacy substitute requests or keep this service in the legacy workflow before publishing'; end if;
   if (select count(*) from public.service_team assignment join public.worship_roles r on r.id=assignment.worship_role_id where assignment.service_id=svc.id and r.schedule_leader_role)<>1 then raise exception 'Each service needs exactly one Worship Leader'; end if;
   for t in select * from public.service_team where service_id=svc.id order by id for update loop
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

create or replace function public.respond_schedule_assignment(p_slot uuid,p_version integer,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare sl public.schedule_slots; sid uuid;
begin
 if not public.is_active_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(762901);
 select * into sl from public.schedule_slots where id=p_slot for update;
 if sl.person_id is distinct from auth.uid() or p_status not in ('confirmed','declined') or p_status is null then raise exception 'Only the assigned member can respond' using errcode='42501'; end if;
 if sl.state=p_status then return; end if;
 if sl.version<>p_version then raise exception 'Assignment changed; refresh and retry'; end if;
 if p_version is null then raise exception 'Assignment version required'; end if;
 if not exists(select 1 from public.services where id=sl.service_id and status='scheduled' and date>=(now() at time zone 'Africa/Cairo')::date) then raise exception 'Service is no longer open'; end if;
 update public.schedule_attempts set state=p_status where slot_id=sl.id and person_id=auth.uid();
 update public.schedule_slots set state=case when p_status='declined' then 'vacant' else 'confirmed' end,
   person_id=case when p_status='declined' then null else person_id end,version=version+1 where id=sl.id;
 insert into public.schedule_audit(slot_id,actor,action,person_id) values(sl.id,auth.uid(),p_status,auth.uid());
 if p_status='declined' then perform public.schedule_propose(sl.id); end if;
 if sl.leader and p_status='confirmed' then
   for sid in select id from public.schedule_slots where service_id=sl.service_id and state='vacant' loop perform public.schedule_propose(sid); end loop;
   insert into public.schedule_notifications(recipient,service_id,kind,dedupe_key)
     select auth.uid(),sl.service_id,'approval_required',a.id||':leader:'||auth.uid() from public.schedule_attempts a join public.schedule_slots s on s.id=a.slot_id where s.service_id=sl.service_id and a.state='proposed' on conflict do nothing;
 end if;
end;
$$;

create or replace function public.decide_schedule_replacement(p_slot uuid,p_attempt uuid,p_approve boolean,p_candidate uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare sl public.schedule_slots; a public.schedule_attempts; candidate uuid; aid uuid;
begin
 if not public.is_active_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(762901);
 select * into sl from public.schedule_slots where id=p_slot for update;
 if sl.id is null then raise exception 'Assignment not found'; end if;
 if sl.leader then
   if not public.is_super_admin() then raise exception 'Only Super Admin can replace a Worship Leader' using errcode='42501'; end if;
 else
   if not public.schedule_is_leader(sl.service_id) then raise exception 'Confirmed service Worship Leader approval required' using errcode='42501'; end if;
 end if;
 if sl.state<>'vacant' then return; end if;
 if not exists(select 1 from public.services where id=sl.service_id and status='scheduled' and date>=(now() at time zone 'Africa/Cairo')::date) then raise exception 'Service is no longer open'; end if;
 if sl.leader then
   candidate:=p_candidate;
   if p_approve is distinct from true or candidate is null then raise exception 'Select a replacement leader'; end if;
 else
   select * into a from public.schedule_attempts where id=p_attempt and slot_id=sl.id for update;
   if a.id is null or a.state<>'proposed' then raise exception 'Proposal changed; refresh and retry'; end if;
   candidate:=a.person_id;
   if p_approve is distinct from true then
     update public.schedule_attempts set state='rejected' where id=a.id;
     insert into public.schedule_audit(slot_id,actor,action,person_id) values(sl.id,auth.uid(),'rejected',candidate);
     update public.schedule_slots set version=version+1 where id=sl.id;
     perform public.schedule_propose(sl.id); return;
   end if;
 end if;
 if not public.schedule_eligible(sl.id,candidate) then raise exception 'Candidate is no longer eligible; reject and choose another'; end if;
 if sl.leader then
   insert into public.schedule_attempts(slot_id,person_id,state) values(sl.id,candidate,'notified') returning id into aid;
 else
   update public.schedule_attempts set state='notified' where id=a.id returning id into aid;
 end if;
 update public.schedule_slots set person_id=candidate,state='pending',version=version+1 where id=sl.id;
 insert into public.schedule_audit(slot_id,actor,action,person_id) values(sl.id,auth.uid(),'approved',candidate);
 perform public.schedule_notify(candidate,sl.service_id,'replacement_assignment',aid||':assigned');
end;
$$;

create or replace function public.retry_schedule_replacement(p_slot uuid)
returns void language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
 perform pg_advisory_xact_lock(762901);
 select service_id into sid from public.schedule_slots where id=p_slot;
 if not public.schedule_is_leader(sid) then raise exception 'Confirmed Worship Leader required' using errcode='42501'; end if;
 perform public.schedule_propose(p_slot);
end;
$$;
create or replace function public.read_schedule_notification(p_id uuid)
returns void language sql security definer set search_path=public as $$
 update public.schedule_notifications set read_at=coalesce(read_at,now()) where id=p_id and recipient=auth.uid() and public.is_active_member();
$$;

-- Preserve the existing private excuse workflow without letting its legacy
-- assignment update bypass quarterly response/replacement rules.
create or replace function public.submit_schedule_excuse(p_service uuid,p_reason text)
returns public.excuses language plpgsql security definer set search_path=public as $$
declare sl public.schedule_slots; result public.excuses;
begin
 if not public.is_active_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(762901);
 select * into sl from public.schedule_slots where service_id=p_service and person_id=auth.uid() for update;
 if sl.id is not null then perform public.respond_schedule_assignment(sl.id,sl.version,'declined');
 elsif not exists(select 1 from public.schedule_attempts a join public.schedule_slots s on s.id=a.slot_id where s.service_id=p_service and a.person_id=auth.uid() and a.state='declined') then
   raise exception 'No assignment found' using errcode='42501';
 end if;
 select * into result from public.submit_service_excuse(p_service,p_reason);
 return result;
end;
$$;

-- Freeze published source assignments so old clients and manual substitute RPCs cannot bypass approval.
-- Keep legacy consumers (reports, excuses, attendance) current. Original rows remain
-- as declined history; the only new assignment writer is this private slot trigger.
create or replace function public.sync_published_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and old.person_id is not null and old.person_id is distinct from new.person_id then
   update public.service_team set status='declined' where service_id=old.service_id and person_id=old.person_id and status<>'declined';
 end if;
 if new.person_id is not null then
   if exists(select 1 from public.service_team where service_id=new.service_id and person_id=new.person_id) then
     update public.service_team set status=new.state where service_id=new.service_id and person_id=new.person_id and status is distinct from new.state;
   else
     insert into public.service_team(service_id,person_id,worship_role_id,role,status) values(new.service_id,new.person_id,new.role_id,new.role,new.state);
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists sync_published_assignment on public.schedule_slots;
create trigger sync_published_assignment after insert or update on public.schedule_slots for each row execute function public.sync_published_assignment();

create or replace function public.schedule_member_unavailable()
returns trigger language plpgsql security definer set search_path=public as $$
declare sl public.schedule_slots;
begin
 if new.status='active' and new.status is not distinct from old.status and new.availability is not distinct from old.availability and new.time_slots is not distinct from old.time_slots then return new; end if;
 perform pg_advisory_xact_lock(762901);
 for sl in select x.* from public.schedule_slots x join public.services s on s.id=x.service_id
   where x.person_id=new.id and s.status='scheduled' and s.date>=(now() at time zone 'Africa/Cairo')::date for update of x loop
   if new.status='active' and public.schedule_eligible(sl.id,new.id) then continue; end if;
   update public.schedule_attempts set state='declined' where slot_id=sl.id and person_id=new.id;
   update public.schedule_slots set person_id=null,state='vacant',version=version+1 where id=sl.id;
   insert into public.schedule_audit(slot_id,actor,action,person_id) values(sl.id,auth.uid(),'account_unavailable',new.id);
   perform public.schedule_propose(sl.id);
 end loop;
 return new;
end;
$$;
drop trigger if exists schedule_member_unavailable on public.profiles;
create trigger schedule_member_unavailable after update of status,availability,time_slots on public.profiles for each row execute function public.schedule_member_unavailable();

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
   if exists(select 1 from public.schedule_slots where service_id=sid) then raise exception 'Published assignments must use the quarterly workflow'; end if;
   if tg_op='UPDATE' and exists(select 1 from public.schedule_slots where service_id=old.service_id) then raise exception 'Published assignments cannot be moved'; end if;
 else
   if exists(select 1 from public.schedule_slots where service_id=old.id) and
     (tg_op='DELETE' or new.date is distinct from old.date or new.time is distinct from old.time or new.practice is distinct from old.practice) then
     raise exception 'Published schedule dates and rehearsals are locked; create a new service for a changed meeting';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end;
$$;
drop trigger if exists guard_published_schedule on public.service_team;
create trigger guard_published_schedule before insert or update or delete on public.service_team for each row execute function public.guard_published_schedule();
drop trigger if exists guard_published_schedule on public.services;
create trigger guard_published_schedule before update or delete on public.services for each row execute function public.guard_published_schedule();

-- Preserve legacy invariants and accept only nested writes already authorized by
-- the quarterly slot state. This also supports users.status managers who do not
-- have separate worship-team management permission when deactivating a member.
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
 if tg_op='UPDATE' and auth.uid() is not null and not public.can_manage_worship() and
   (old.person_id<>auth.uid() or new.id is distinct from old.id or new.service_id is distinct from old.service_id or new.person_id is distinct from old.person_id or new.role is distinct from old.role or new.created_at is distinct from old.created_at) then raise exception 'Members may only update their own response status'; end if;
 select timezone into v_timezone from public.organization_settings where id=1;
 if not exists(select 1 from public.services where id=new.service_id and status='scheduled' and date>=(clock_timestamp() at time zone coalesce(v_timezone,'Africa/Cairo'))::date for no key update) then raise exception 'Assignments may only change for scheduled, non-past services' using errcode='22023'; end if;
 if new.status<>'declined' and exists(select 1 from public.excuses e where e.service_id=new.service_id and e.person_id=new.person_id and e.status in ('pending','approved')) then raise exception 'An assignment with an active excuse must remain declined' using errcode='22023'; end if;
 if exists(select 1 from public.substitute_requests r where r.service_id=new.service_id and r.requester_id=new.person_id and r.status='filled' and (r.role is distinct from new.role or new.status<>'declined')) then raise exception 'A replaced requester assignment must remain declined and keep its role' using errcode='22023'; end if;
 if exists(select 1 from public.substitute_requests r where r.service_id=new.service_id and r.substitute_id=new.person_id and r.status='filled' and (r.role is distinct from new.role or new.status='declined')) then raise exception 'A filled substitute assignment cannot be declined or change role' using errcode='22023'; end if;
 return new;
end;
$$;

create or replace function public.guard_quarterly_substitute_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(762901);
 if exists(select 1 from public.schedule_slots where service_id=new.service_id) then raise exception 'Use the quarterly schedule for replacement approval'; end if;
 return new;
end;
$$;
drop trigger if exists guard_quarterly_substitute_request on public.substitute_requests;
create trigger guard_quarterly_substitute_request before insert or update on public.substitute_requests for each row execute function public.guard_quarterly_substitute_request();

-- Recurrence keeps the approved current team, without reassigning retained
-- declined history when the existing generator copies a published service.
do $upgrade$ begin
 if to_regprocedure('public.generate_service_occurrences(uuid,uuid,jsonb)') is not null and to_regprocedure('public.generate_legacy_service_occurrences(uuid,uuid,jsonb)') is null then
   alter function public.generate_service_occurrences(uuid,uuid,jsonb) rename to generate_legacy_service_occurrences;
 end if;
 if to_regprocedure('public.generate_legacy_service_occurrences(uuid,uuid,jsonb)') is not null then
   revoke all on function public.generate_legacy_service_occurrences(uuid,uuid,jsonb) from public,anon,authenticated;
   execute $definition$
   create or replace function public.generate_service_occurrences(p_group_id uuid,p_source_service_id uuid,p_occurrences jsonb)
   returns setof public.services language plpgsql security definer set search_path=public,pg_temp as $body$
   declare occurrence public.services;
   begin
     perform pg_advisory_xact_lock(762901);
     for occurrence in select * from public.generate_legacy_service_occurrences(p_group_id,p_source_service_id,p_occurrences) loop
       if exists(select 1 from public.schedule_slots where service_id=p_source_service_id) then
         delete from public.service_team copied where copied.service_id=occurrence.id and not exists(select 1 from public.schedule_slots s where s.service_id=p_source_service_id and s.person_id=copied.person_id and s.role_id=copied.worship_role_id);
       end if;
       return next occurrence;
     end loop;
     return;
   end;
   $body$;
   $definition$;
   revoke all on function public.generate_service_occurrences(uuid,uuid,jsonb) from public,anon;
   grant execute on function public.generate_service_occurrences(uuid,uuid,jsonb) to authenticated;
 end if;
end $upgrade$;

-- Disable legacy auto-generation without deleting prepared or historical services.
create or replace function public.ensure_weekly_services() returns void language plpgsql as $$ begin return; end; $$;
drop trigger if exists protect_fixed_weekly_service on public.services;

revoke all on function public.schedule_eligible(uuid,uuid),public.schedule_notify(uuid,uuid,text,text),public.schedule_propose(uuid),public.guard_published_schedule(),public.schedule_member_unavailable(),public.sync_published_assignment() from public,anon,authenticated;
revoke all on function public.guard_quarterly_substitute_request(),public.protect_service_team_assignment() from public,anon,authenticated;
revoke all on function public.schedule_is_leader(uuid),public.publish_schedule_quarter(date),public.respond_schedule_assignment(uuid,integer,text),public.decide_schedule_replacement(uuid,uuid,boolean,uuid),public.retry_schedule_replacement(uuid),public.read_schedule_notification(uuid),public.submit_schedule_excuse(uuid,text) from public,anon;
grant execute on function public.schedule_is_leader(uuid),public.publish_schedule_quarter(date),public.respond_schedule_assignment(uuid,integer,text),public.decide_schedule_replacement(uuid,uuid,boolean,uuid),public.retry_schedule_replacement(uuid),public.read_schedule_notification(uuid),public.submit_schedule_excuse(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
