-- Apply LAST, after dynamic roles, QA hardening, quarterly scheduling, unified
-- calendar and attendance/custom-events upgrades. No jobs are backfilled.
begin;
create table if not exists public.push_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 language text not null default 'en' check(language in ('en','ar')),
 assignments boolean not null default true, reminders boolean not null default true,
 schedule boolean not null default true, setlists boolean not null default true,
 announcements boolean not null default true
);
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048),
 p256dh text not null, auth_key text not null, binding_token uuid not null,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create table if not exists public.push_jobs (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 recipient uuid not null references public.profiles(id) on delete cascade,
 category text not null check(category in ('assignments','reminders','schedule','setlists','announcements','test')),
 service_id uuid references public.services(id) on delete cascade,
 announcement_id uuid references public.announcements(id) on delete cascade,
 actor_id uuid, occurrence_at timestamptz, rehearsal boolean not null default false,
 dedupe_key text not null, due_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '1 day'),
 state text not null default 'pending' check(state in ('pending','processing','sent','skipped','failed')),
 attempts integer not null default 0, lease_token uuid, leased_at timestamptz,
 last_status integer, finished_at timestamptz, created_at timestamptz not null default now(),
 unique(subscription_id,dedupe_key)
);
create index if not exists push_jobs_pending_idx on public.push_jobs(due_at) where state in ('pending','processing');
alter table public.push_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_preferences,public.push_subscriptions,public.push_jobs from public,anon,authenticated;
grant select,insert,update on public.push_preferences to authenticated;
grant select on public.push_subscriptions to authenticated;
grant all on public.push_preferences,public.push_subscriptions,public.push_jobs to service_role;
drop policy if exists push_preferences_own on public.push_preferences;
create policy push_preferences_own on public.push_preferences for all to authenticated
 using(user_id=auth.uid() and public.is_active_member()) with check(user_id=auth.uid() and public.is_active_member());
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
 using(user_id=auth.uid() and public.is_active_member());

create or replace function public.push_endpoint_valid(p_endpoint text)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(length(p_endpoint)<=2048 and p_endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])?push[.]apple[.]com)/[^[:space:]#]+$',false);
$$;
create or replace function public.register_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_binding uuid,p_language text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; event_id uuid;
begin
 if not public.is_active_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 if not public.push_endpoint_valid(p_endpoint) or p_p256dh !~ '^[A-Za-z0-9_-]{87}=?$' or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$' or p_binding is null or p_language not in ('en','ar') or p_language is null or p_p256dh is null or p_auth is null then raise exception 'Invalid push subscription'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and user_id<>auth.uid()) then raise exception 'Unsubscribe this browser before changing accounts'; end if;
 if (select count(*) from public.push_subscriptions where user_id=auth.uid() and active and endpoint<>p_endpoint)>=10 then raise exception 'Maximum of 10 devices; disable notifications on an unused device'; end if;
 insert into public.push_preferences(user_id,language) values(auth.uid(),p_language)
 on conflict(user_id) do update set language=excluded.language;
 insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_key,binding_token)
 values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_binding)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,binding_token=excluded.binding_token,active=true,updated_at=now()
 where push_subscriptions.user_id=auth.uid() returning id into sid;
 -- Registering a new device schedules only its upcoming reminders, never past announcements.
 for event_id in select s.id from public.services s where s.status='scheduled' and public.push_service_recipient(s.id,auth.uid()) loop
  perform public.push_queue_reminders(event_id);
 end loop;
 return sid;
end;
$$;
create or replace function public.unregister_push_subscription(p_endpoint text)
returns void language sql security definer set search_path=public,pg_temp as $$
 delete from public.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint;
$$;

-- Recipients mirror the canonical team, explicit custom-event participants and
-- public calendar visibility. All job paths require a published, unarchived event.
create or replace function public.push_service_recipient(p_service uuid,p_person uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.services s where s.id=p_service and s.published_at is not null and s.archived_at is null
 and (p_person=any(s.participant_ids) or exists(select 1 from public.service_team t where t.service_id=s.id and t.person_id=p_person and t.status<>'declined')));
$$;
-- Defensive parsing: legacy incomplete rehearsal JSON must not break business writes.
create or replace function public.push_occurrence(p_service uuid,p_rehearsal boolean default false)
returns timestamptz language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s public.services; d date; t time;
begin
 select * into s from public.services where id=p_service;
 if s.id is null then return null; end if;
 if p_rehearsal then
  if s.practice->>'enabled' is distinct from 'true' then return null; end if;
  d:=(s.practice->>'date')::date; t:=(s.practice->>'time')::time;
 else d:=s.date; t:=s.time::time; end if;
 return (d+t) at time zone coalesce(s.timezone,'Africa/Cairo');
 exception when invalid_datetime_format or datetime_field_overflow then return null;
end;
$$;
create or replace function public.push_enqueue(p_category text,p_key text,p_service uuid default null,p_announcement uuid default null,p_person uuid default null,p_due timestamptz default now(),p_occurrence timestamptz default null,p_rehearsal boolean default false)
returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.push_jobs(subscription_id,recipient,category,service_id,announcement_id,actor_id,occurrence_at,rehearsal,dedupe_key,due_at,expires_at)
 select sub.id,sub.user_id,p_category,p_service,p_announcement,case when p_category='reminders' then null else auth.uid() end,p_occurrence,p_rehearsal,p_key,p_due,
 case when p_category='reminders' then p_occurrence else now()+interval '1 day' end
 from public.push_subscriptions sub join public.profiles p on p.id=sub.user_id and p.status='active'
 join public.push_preferences pref on pref.user_id=p.id
 where sub.active and (p_person is null or p.id=p_person)
 and (p_category='reminders' or p.id is distinct from auth.uid())
 and coalesce((to_jsonb(pref)->>p_category)::boolean,false)
 and (p_service is null or public.push_service_recipient(p_service,p.id))
 and p_due is not null and (p_category<>'reminders' or p_due>now())
 on conflict(subscription_id,dedupe_key) do nothing;
$$;
create or replace function public.push_queue_reminders(p_service uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare at_time timestamptz; rehearsal_value boolean;
begin
 if not exists(select 1 from public.services where id=p_service and status='scheduled' and published_at is not null and archived_at is null) then return; end if;
 foreach rehearsal_value in array array[false,true] loop
  at_time:=public.push_occurrence(p_service,rehearsal_value);
  perform public.push_enqueue('reminders','reminder:'||p_service||':'||rehearsal_value||':'||extract(epoch from at_time),p_service,null,null,at_time-interval '1 hour',at_time,rehearsal_value);
 end loop;
end;
$$;
create or replace function public.push_preferences_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid;
begin
 if new.reminders then
  for sid in select s.id from public.services s where s.status='scheduled' and public.push_service_recipient(s.id,new.user_id) loop
   perform public.push_queue_reminders(sid);
  end loop;
 end if;
 return null;
end;
$$;
create or replace function public.push_business_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; key_value text; was_published boolean:=false;
begin
 -- One key per transaction/category/service coalesces bulk reorder/update rows.
 key_value:=txid_current()::text;
 if tg_table_name='announcements' then
  perform public.push_enqueue('announcements','announcement:'||new.id,null,new.id);
 elsif tg_table_name='schedule_notifications' then
  if new.kind in ('assignment','replacement_assignment') then
   perform public.push_enqueue('assignments','assignment:'||new.dedupe_key,new.service_id,null,new.recipient);
   perform public.push_queue_reminders(new.service_id);
  end if;
 elsif tg_table_name='services' then
  sid:=new.id;
  if tg_op='UPDATE' then was_published:=old.published_at is not null; end if;
  if new.published_at is not null and new.archived_at is null then
   if not was_published then
    perform public.push_enqueue('schedule','published:'||sid,sid);
   elsif (new.status,new.date,new.time,new.end_date,new.end_time,new.location,new.practice-'attendance') is distinct from (old.status,old.date,old.time,old.end_date,old.end_time,old.location,old.practice-'attendance') then
    perform public.push_enqueue('schedule','schedule:'||sid||':'||key_value,sid);
   end if;
   if tg_op='UPDATE' and new.setlist_blocks is distinct from old.setlist_blocks then
    perform public.push_enqueue('setlists','setlist:'||sid||':'||key_value,sid);
   end if;
   perform public.push_queue_reminders(sid);
  end if;
 elsif tg_table_name='setlist_items' then
  if tg_op='DELETE' then sid:=old.service_id; else sid:=new.service_id; end if;
  if tg_op<>'UPDATE' or to_jsonb(new) is distinct from to_jsonb(old) then
   perform public.push_enqueue('setlists','setlist:'||sid||':'||key_value,sid);
   if tg_op='UPDATE' and old.service_id<>new.service_id then perform public.push_enqueue('setlists','setlist:'||old.service_id||':'||key_value,old.service_id); end if;
  end if;
 elsif tg_table_name='service_team' then
  sid:=new.service_id;
  -- Quarterly assignments use schedule_notifications, preserving their dedupe.
  if not exists(select 1 from public.schedule_slots where service_id=sid) and
   (tg_op='INSERT' or (new.person_id,new.role,new.status) is distinct from (old.person_id,old.role,old.status)) then
   perform public.push_enqueue('assignments','team:'||sid||':'||new.person_id||':'||key_value,sid,null,new.person_id);
  end if;
  perform public.push_queue_reminders(sid);
 end if;
 return null;
end;
$$;
-- Base-schema installation defers activation until quarterly/calendar migrations
-- exist. Reapply this migration LAST to activate all hooks together.
do $$begin
 if to_regclass('public.schedule_notifications') is not null then
  execute 'drop trigger if exists push_preferences_changed on public.push_preferences';
  execute 'create trigger push_preferences_changed after insert or update of reminders on public.push_preferences for each row execute function public.push_preferences_changed()';
  execute 'drop trigger if exists push_service_event on public.services';
  execute 'create trigger push_service_event after insert or update on public.services for each row execute function public.push_business_event()';
  execute 'drop trigger if exists push_setlist_event on public.setlist_items';
  execute 'create trigger push_setlist_event after insert or update or delete on public.setlist_items for each row execute function public.push_business_event()';
  execute 'drop trigger if exists push_team_event on public.service_team';
  execute 'create trigger push_team_event after insert or update on public.service_team for each row execute function public.push_business_event()';
  execute 'drop trigger if exists push_announcement_event on public.announcements';
  execute 'create trigger push_announcement_event after insert on public.announcements for each row execute function public.push_business_event()';
  execute 'drop trigger if exists push_assignment_event on public.schedule_notifications';
  execute 'create trigger push_assignment_event after insert on public.schedule_notifications for each row execute function public.push_business_event()';
 end if;
end$$;

create or replace function public.push_job_allowed(p_job uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.push_jobs j join public.push_subscriptions sub on sub.id=j.subscription_id and sub.user_id=j.recipient and sub.active
 join public.profiles p on p.id=j.recipient and p.status='active'
 join public.push_preferences pref on pref.user_id=p.id
 where j.id=p_job and j.expires_at>now() and (j.category='test' or coalesce((to_jsonb(pref)->>j.category)::boolean,false))
 and (j.actor_id is null or j.actor_id<>p.id)
 and (j.category='test' or j.service_id is not null or (j.category='announcements' and exists(select 1 from public.announcements a where a.id=j.announcement_id)))
 and (j.service_id is null or (public.push_service_recipient(j.service_id,p.id)
  and exists(select 1 from public.services s where s.id=j.service_id and (s.status='scheduled' or (j.category='schedule' and s.status='cancelled')))))
 and (j.category<>'reminders' or j.occurrence_at=public.push_occurrence(j.service_id,j.rehearsal)));
$$;
create or replace function public.claim_push_jobs(p_limit integer default 20)
returns table(id uuid,lease_token uuid) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return query
 with picked as (
  select j.id from public.push_jobs j where j.due_at<=now() and j.attempts<5
   and (j.state='pending' or (j.state='processing' and j.leased_at<now()-interval '5 minutes'))
  order by j.due_at for update skip locked limit least(greatest(p_limit,1),50)
 ), claimed as (
  update public.push_jobs j set state='processing',attempts=j.attempts+1,lease_token=gen_random_uuid(),leased_at=now()
  from picked where j.id=picked.id returning j.id,j.lease_token
 ) select claimed.id,claimed.lease_token from claimed;
 -- A crashed final attempt must not remain processing forever.
 update public.push_jobs j set state='failed',finished_at=now() where j.state='processing' and j.attempts>=5 and j.leased_at<now()-interval '5 minutes';
end;
$$;
-- Re-read permission, preferences and subscription just before EACH delivery.
create or replace function public.prepare_push_delivery(p_job uuid,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from public.push_jobs where id=p_job and lease_token=p_lease and state='processing' and leased_at>now()-interval '5 minutes') then return null; end if;
 if not public.push_job_allowed(p_job) then
  update public.push_jobs set state='skipped',finished_at=now() where id=p_job and lease_token=p_lease;
  return null;
 end if;
 select jsonb_build_object('id',j.id,'category',j.category,'service_id',j.service_id,'attempts',j.attempts,'language',pref.language,
  'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_key,'binding_token',s.binding_token,'expires_at',j.expires_at)
 into result from public.push_jobs j join public.push_subscriptions s on s.id=j.subscription_id join public.push_preferences pref on pref.user_id=j.recipient where j.id=p_job;
 return result;
end;
$$;
create or replace function public.finish_push_job(p_job uuid,p_lease uuid,p_status integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.push_jobs; outcome text;
begin
 select * into j from public.push_jobs where id=p_job and lease_token=p_lease and state='processing' for update;
 if j.id is null then return; end if;
 if p_status in (404,410) then update public.push_subscriptions set active=false where id=j.subscription_id; end if;
 outcome:=case when p_status between 200 and 299 then 'sent'
  when (p_status=0 or p_status=429 or p_status>=500) and j.attempts<5 and j.expires_at>now() then 'pending' else 'failed' end;
 update public.push_jobs set state=outcome,last_status=p_status,finished_at=case when outcome<>'pending' then now() end,
  due_at=case when outcome='pending' then now()+make_interval(secs=>least(3600,30*power(2,j.attempts)::integer)) else due_at end where id=j.id;
end;
$$;
create or replace function public.queue_push_test(p_subscription uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_active_member() or not exists(select 1 from public.push_subscriptions where id=p_subscription and user_id=auth.uid() and active) then raise exception 'Own device required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.push_jobs where recipient=auth.uid() and category='test' and created_at>now()-interval '1 minute') then raise exception 'Wait one minute before testing again'; end if;
 insert into public.push_jobs(subscription_id,recipient,category,dedupe_key,expires_at)
 values(p_subscription,auth.uid(),'test','test:'||gen_random_uuid(),now()+interval '5 minutes');
end;
$$;
-- Definer helper functions are server/trigger only, never callable by clients.
do $$declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and
  proname in ('push_endpoint_valid','push_service_recipient','push_occurrence','push_enqueue','push_queue_reminders','push_preferences_changed','push_business_event','push_job_allowed','register_push_subscription','unregister_push_subscription','claim_push_jobs','prepare_push_delivery','finish_push_job','queue_push_test') loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 end loop;
end$$;
grant execute on function public.register_push_subscription(text,text,text,uuid,text),public.unregister_push_subscription(text),public.queue_push_test(uuid) to authenticated;
grant execute on function public.claim_push_jobs(integer),public.prepare_push_delivery(uuid,uuid),public.finish_push_job(uuid,uuid,integer) to service_role;
commit;
