-- ============================================================
-- KDEC Worship — security and data-integrity migration
-- For existing deployments. Safe to review and rerun.
-- ============================================================

begin;

create extension if not exists "uuid-ossp";

-- ── CORE COLUMNS ───────────────────────────────────────────

alter table public.profiles
  add column if not exists roles jsonb default '[]'::jsonb;
do $$
declare
  v_roles_type text;
begin
  select data_type
    into v_roles_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'profiles'
     and column_name = 'roles';

  if v_roles_type is distinct from 'jsonb' then
    -- Early versions stored roles as text[]. Convert any legacy array to the
    -- JSON array expected by current RLS helpers and client normalization.
    alter table public.profiles alter column roles drop default;
    alter table public.profiles
      alter column roles type jsonb
      using coalesce(to_jsonb(roles), '[]'::jsonb);
  end if;
end;
$$;
update public.profiles
   set roles = case
     when role is null or btrim(role) = '' then '[]'::jsonb
     else jsonb_build_array(role)
   end
 where roles is distinct from case
   when roles is null or jsonb_typeof(roles) <> 'array' or roles = '[]'::jsonb then
     case
       when role is null or btrim(role) = '' then '[]'::jsonb
       else jsonb_build_array(role)
     end
   else roles
 end;
alter table public.profiles alter column roles set default '[]'::jsonb;
alter table public.profiles alter column roles set not null;

alter table public.invitations
  add column if not exists roles jsonb default '[]'::jsonb;
do $$
declare
  v_roles_type text;
begin
  select data_type
    into v_roles_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'invitations'
     and column_name = 'roles';

  if v_roles_type is distinct from 'jsonb' then
    alter table public.invitations alter column roles drop default;
    alter table public.invitations
      alter column roles type jsonb
      using coalesce(to_jsonb(roles), '[]'::jsonb);
  end if;
end;
$$;
alter table public.invitations
  add column if not exists accepted_at timestamptz;
alter table public.invitations
  add column if not exists accepted_by uuid references public.profiles(id) on delete set null;
update public.invitations
   set roles = case
     when role is null or btrim(role) = '' then '[]'::jsonb
     else jsonb_build_array(role)
   end
 where roles is distinct from case
   when roles is null or jsonb_typeof(roles) <> 'array' or roles = '[]'::jsonb then
     case
       when role is null or btrim(role) = '' then '[]'::jsonb
       else jsonb_build_array(role)
     end
   else roles
 end;
alter table public.invitations alter column roles set default '[]'::jsonb;
alter table public.invitations alter column roles set not null;

alter table public.services
  add column if not exists setlist_blocks jsonb default '{}'::jsonb;
alter table public.services
  add column if not exists recurrence_frequency text;
update public.services set setlist_blocks = '{}'::jsonb where setlist_blocks is null;
alter table public.services alter column setlist_blocks set default '{}'::jsonb;
alter table public.services alter column setlist_blocks set not null;

update public.services
   set recurrence_frequency = null
 where recurrence_frequency is not null
   and recurrence_frequency not in ('weekly','biweekly','monthly');

-- A legacy one-row group does not contain enough information to distinguish
-- weekly, biweekly, and monthly cadence. Clear only unknown singleton metadata
-- instead of silently labelling it weekly; new singleton groups retain an
-- explicitly supplied recurrence_frequency on migration reruns.
with singleton_groups as (
  select recurrence_group_id
    from public.services
   where recurrence_group_id is not null
   group by recurrence_group_id
  having count(*) = 1
)
update public.services as service
   set recurrence_group_id = null,
       recurrence_frequency = null,
       recurrence_index = 0
  from singleton_groups
 where service.recurrence_group_id = singleton_groups.recurrence_group_id
   and service.recurrence_frequency is null;

-- If legacy rows already contain one unambiguous valid frequency, preserve it
-- and fill only the missing members of that group. Conflicting values are left
-- untouched for an administrator to audit rather than choosing a winner.
with configured_groups as (
  select recurrence_group_id,
         min(recurrence_frequency) as recurrence_frequency
    from public.services
   where recurrence_group_id is not null
     and recurrence_frequency is not null
   group by recurrence_group_id
  having count(distinct recurrence_frequency) = 1
)
update public.services as service
   set recurrence_frequency = configured_groups.recurrence_frequency
  from configured_groups
 where service.recurrence_group_id = configured_groups.recurrence_group_id
   and service.recurrence_frequency is null;

-- Infer cadence only when every indexed occurrence agrees with the same anchor.
with anchored as (
  select service.id,
         service.recurrence_group_id,
         service.recurrence_index,
         service.date,
         first_value(service.recurrence_index) over group_order as anchor_index,
         first_value(service.date) over group_order as anchor_date,
         count(*) over (partition by service.recurrence_group_id) as group_size
    from public.services as service
   where service.recurrence_group_id is not null
     and not exists (
       select 1
         from public.services as configured
        where configured.recurrence_group_id = service.recurrence_group_id
          and configured.recurrence_frequency is not null
     )
  window group_order as (
    partition by service.recurrence_group_id
    order by service.recurrence_index nulls last, service.date, service.id
  )
), inferred as (
  select recurrence_group_id,
         case
           when max(group_size) > 1
            and bool_and(
              recurrence_index is not null
              and anchor_index is not null
              and recurrence_index >= anchor_index
              and date = anchor_date + ((recurrence_index - anchor_index) * 7)
            ) then 'weekly'
           when max(group_size) > 1
            and bool_and(
              recurrence_index is not null
              and anchor_index is not null
              and recurrence_index >= anchor_index
              and date = anchor_date + ((recurrence_index - anchor_index) * 14)
            ) then 'biweekly'
           when max(group_size) > 1
            and bool_and(
              recurrence_index is not null
              and anchor_index is not null
              and recurrence_index >= anchor_index
              and date = (
                anchor_date
                + make_interval(months => recurrence_index - anchor_index)
              )::date
            ) then 'monthly'
           else null
         end as recurrence_frequency
    from anchored
   group by recurrence_group_id
)
update public.services as service
   set recurrence_frequency = inferred.recurrence_frequency
  from inferred
 where service.recurrence_group_id = inferred.recurrence_group_id
   and service.recurrence_frequency is null
   and inferred.recurrence_frequency is not null;

do $$
begin
  if exists (
    select 1
      from public.services
     where recurrence_group_id is not null
     group by recurrence_group_id
    having count(distinct recurrence_frequency) > 1
  ) then
    raise warning 'Some recurrence groups have conflicting frequency metadata and require cleanup';
  end if;

  if exists (
    select 1
      from public.services
     where recurrence_group_id is not null
     group by recurrence_group_id
    having count(*) > 1 and count(recurrence_frequency) = 0
  ) then
    raise warning 'Some legacy recurrence groups have ambiguous cadence and require cleanup';
  end if;
end;
$$;

alter table public.songs
  add column if not exists usage_count integer default 0;
alter table public.songs
  add column if not exists last_used date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and conname = 'profiles_roles_array_check'
  ) then
    alter table public.profiles
      add constraint profiles_roles_array_check
      check (jsonb_typeof(roles) = 'array') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.invitations'::regclass
       and conname = 'invitations_roles_array_check'
  ) then
    alter table public.invitations
      add constraint invitations_roles_array_check
      check (jsonb_typeof(roles) = 'array') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.services'::regclass
       and conname = 'services_setlist_blocks_object_check'
  ) then
    alter table public.services
      add constraint services_setlist_blocks_object_check
      check (jsonb_typeof(setlist_blocks) = 'object') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.services'::regclass
       and conname = 'services_recurrence_frequency_check'
  ) then
    alter table public.services
      add constraint services_recurrence_frequency_check
      check (
        recurrence_frequency is null
        or recurrence_frequency in ('weekly','biweekly','monthly')
      ) not valid;
  end if;
end;
$$;

-- Retain historical setlist rows if a referenced song is retired or removed.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
      from pg_constraint
     where conrelid = 'public.setlist_items'::regclass
       and contype = 'f'
       and pg_get_constraintdef(oid) like 'FOREIGN KEY (song_id)%'
  loop
    execute format(
      'alter table public.setlist_items drop constraint %I',
      v_constraint.conname
    );
  end loop;

  alter table public.setlist_items
    add constraint setlist_items_song_id_fkey
    foreign key (song_id) references public.songs(id) on delete restrict;
end;
$$;

-- ── SINGLETON ORGANIZATION SETTINGS ───────────────────────

create table if not exists public.organization_settings (
  id                       smallint primary key default 1,
  name                     text not null default 'Kasr El Doubara Evangelical Church',
  name_ar                  text not null default 'كنيسة قصر الدوبارة الإنجيلية',
  timezone                 text not null default 'Africa/Cairo',
  default_service_type     text not null default 'Sunday Service',
  attendance_late_minutes  smallint not null default 15,
  excuse_limit             smallint not null default 3,
  excuse_period            text not null default 'monthly',
  notification_preferences jsonb not null default
                             '{"reminders":true,"newSongs":true,"teamChanges":false,"events":true}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles(id) on delete set null
);

alter table public.organization_settings
  add column if not exists name text default 'Kasr El Doubara Evangelical Church';
alter table public.organization_settings
  add column if not exists name_ar text default 'كنيسة قصر الدوبارة الإنجيلية';
alter table public.organization_settings
  add column if not exists timezone text default 'Africa/Cairo';
alter table public.organization_settings
  add column if not exists default_service_type text default 'Sunday Service';
alter table public.organization_settings
  add column if not exists attendance_late_minutes smallint default 15;
alter table public.organization_settings
  add column if not exists excuse_limit smallint default 3;
alter table public.organization_settings
  add column if not exists excuse_period text default 'monthly';
alter table public.organization_settings
  add column if not exists notification_preferences jsonb default
    '{"reminders":true,"newSongs":true,"teamChanges":false,"events":true}'::jsonb;
alter table public.organization_settings
  add column if not exists created_at timestamptz default now();
alter table public.organization_settings
  add column if not exists updated_at timestamptz default now();
alter table public.organization_settings
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

drop trigger if exists organization_settings_updated_at on public.organization_settings;
alter table public.organization_settings
  drop constraint if exists organization_settings_singleton_check;
alter table public.organization_settings
  drop constraint if exists organization_settings_late_minutes_check;
alter table public.organization_settings
  drop constraint if exists organization_settings_excuse_limit_check;
alter table public.organization_settings
  drop constraint if exists organization_settings_excuse_period_check;
alter table public.organization_settings
  drop constraint if exists organization_settings_notifications_object_check;

update public.organization_settings
   set name = coalesce(name, 'Kasr El Doubara Evangelical Church'),
       name_ar = coalesce(name_ar, 'كنيسة قصر الدوبارة الإنجيلية'),
       timezone = coalesce(timezone, 'Africa/Cairo'),
       default_service_type = coalesce(default_service_type, 'Sunday Service'),
       attendance_late_minutes = coalesce(attendance_late_minutes, 15),
       excuse_limit = coalesce(excuse_limit, 3),
       excuse_period = coalesce(excuse_period, 'monthly'),
       notification_preferences = coalesce(
         notification_preferences,
         '{"reminders":true,"newSongs":true,"teamChanges":false,"events":true}'::jsonb
       ),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, now())
 where name is null
    or name_ar is null
    or timezone is null
    or default_service_type is null
    or attendance_late_minutes is null
    or excuse_limit is null
    or excuse_period is null
    or notification_preferences is null
    or created_at is null
    or updated_at is null;
update public.organization_settings as settings
   set timezone = 'Africa/Cairo'
 where not exists (
   select 1 from pg_catalog.pg_timezone_names as zones
    where zones.name = settings.timezone
 );

alter table public.organization_settings alter column name set not null;
alter table public.organization_settings alter column name_ar set not null;
alter table public.organization_settings alter column timezone set not null;
alter table public.organization_settings alter column default_service_type set not null;
alter table public.organization_settings alter column attendance_late_minutes set not null;
alter table public.organization_settings alter column excuse_limit set not null;
alter table public.organization_settings alter column excuse_period set not null;
alter table public.organization_settings alter column notification_preferences set not null;
alter table public.organization_settings alter column created_at set not null;
alter table public.organization_settings alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.organization_settings'::regclass
       and conname = 'organization_settings_singleton_check'
  ) then
    alter table public.organization_settings
      add constraint organization_settings_singleton_check check (id = 1) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.organization_settings'::regclass
       and conname = 'organization_settings_late_minutes_check'
  ) then
    alter table public.organization_settings
      add constraint organization_settings_late_minutes_check
      check (attendance_late_minutes between 0 and 240) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.organization_settings'::regclass
       and conname = 'organization_settings_excuse_limit_check'
  ) then
    alter table public.organization_settings
      add constraint organization_settings_excuse_limit_check
      check (excuse_limit between 0 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.organization_settings'::regclass
       and conname = 'organization_settings_excuse_period_check'
  ) then
    alter table public.organization_settings
      add constraint organization_settings_excuse_period_check
      check (excuse_period in ('total','monthly','weekly')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.organization_settings'::regclass
       and conname = 'organization_settings_notifications_object_check'
  ) then
    alter table public.organization_settings
      add constraint organization_settings_notifications_object_check
      check (jsonb_typeof(notification_preferences) = 'object') not valid;
  end if;
end;
$$;

insert into public.organization_settings (id) values (1)
on conflict (id) do nothing;

-- ── WORKFLOW TABLES AND COMPATIBILITY COLUMNS ─────────────

create table if not exists public.attendance_sessions (
  id            uuid primary key default uuid_generate_v4(),
  service_id    uuid references public.services(id) on delete cascade,
  name          text not null default '',
  label         text not null default 'Service',
  session_date  date not null default current_date,
  session_time  time,
  end_time      time,
  qr_code       text unique not null,
  active        boolean not null default true,
  max_attendees integer,
  repeatable    boolean not null default false,
  repeat_freq   text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

alter table public.attendance_sessions add column if not exists name text default '';
alter table public.attendance_sessions add column if not exists session_date date;
alter table public.attendance_sessions add column if not exists session_time time;
alter table public.attendance_sessions add column if not exists end_time time;
alter table public.attendance_sessions add column if not exists max_attendees integer;
alter table public.attendance_sessions add column if not exists repeatable boolean default false;
alter table public.attendance_sessions add column if not exists repeat_freq text;
alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_max_attendees_check;
alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_repeat_freq_check;
alter table public.attendance_sessions
  drop constraint if exists attendance_session_expiry_check;
alter table public.attendance_sessions
  drop constraint if exists attendance_session_repeat_check;
alter table public.attendance_sessions
  drop constraint if exists attendance_session_time_range_check;
update public.attendance_sessions
   set name = coalesce(name, label, ''),
       active = coalesce(active, true),
       session_date = coalesce(
         session_date,
         (select service.date from public.services as service where service.id = attendance_sessions.service_id),
         (coalesce(created_at, now()) at time zone coalesce(
           (select settings.timezone from public.organization_settings as settings where settings.id = 1),
           'Africa/Cairo'
         ))::date
       ),
       max_attendees = case
         when max_attendees is not null and max_attendees <= 0 then null
         else max_attendees
       end,
       repeatable = coalesce(repeatable, false),
       repeat_freq = case
         when coalesce(repeatable, false) then
           case
             when repeat_freq in ('daily','weekly','monthly') then repeat_freq
             else 'weekly'
           end
         else null
       end,
       created_at = coalesce(created_at, now()),
       expires_at = case
         when coalesce(expires_at, coalesce(created_at, now()) + interval '24 hours')
                <= coalesce(created_at, now())
           then coalesce(created_at, now()) + interval '24 hours'
         else coalesce(expires_at, coalesce(created_at, now()) + interval '24 hours')
       end
 where name is null
    or active is null
    or session_date is null
    or max_attendees <= 0
    or repeatable is null
    or (coalesce(repeatable, false) and repeat_freq is null)
    or repeat_freq is not null and repeat_freq not in ('daily','weekly','monthly')
    or (not coalesce(repeatable, false) and repeat_freq is not null)
    or created_at is null
    or expires_at is null
    or expires_at <= created_at;

-- Backfill deployments where a service was cancelled before this invariant
-- existed. Constraints are still dropped here, so legacy-invalid rows can be
-- closed safely before the checks are restored below.
update public.attendance_sessions as session
   set active = false
  from public.services as service
 where session.service_id = service.id
   and service.status = 'cancelled'
   and session.active;
alter table public.attendance_sessions alter column name set not null;
alter table public.attendance_sessions alter column active set not null;
alter table public.attendance_sessions alter column session_date set default current_date;
alter table public.attendance_sessions alter column session_date set not null;
alter table public.attendance_sessions alter column repeatable set not null;
alter table public.attendance_sessions alter column created_at set not null;
alter table public.attendance_sessions alter column expires_at set not null;

create table if not exists public.attendance_records (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references public.attendance_sessions(id) on delete cascade,
  person_id       uuid not null references public.profiles(id) on delete cascade,
  occurrence_date date not null default current_date,
  check_in_at     timestamptz,
  check_out_at    timestamptz,
  status          text not null default 'present',
  excuse_reason   text default '',
  created_at      timestamptz not null default now()
);

alter table public.attendance_records
  add column if not exists occurrence_date date;
alter table public.attendance_records
  drop constraint if exists attendance_records_status_check;
alter table public.attendance_records
  drop constraint if exists attendance_record_time_check;
update public.attendance_records as r
   set occurrence_date = coalesce(
         r.occurrence_date,
         (r.check_in_at at time zone 'Africa/Cairo')::date,
         (r.created_at at time zone 'Africa/Cairo')::date,
         current_date
       ),
       status = coalesce(r.status, 'present'),
       created_at = coalesce(r.created_at, now())
 where r.occurrence_date is null
    or r.status is null
    or r.created_at is null;
alter table public.attendance_records alter column occurrence_date set not null;
alter table public.attendance_records alter column occurrence_date set default current_date;
alter table public.attendance_records alter column status set not null;
alter table public.attendance_records alter column created_at set not null;

create table if not exists public.events (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  title_ar       text default '',
  description    text default '',
  description_ar text default '',
  date           date not null,
  end_date       date,
  time           text default '10:00',
  location       text default '',
  type           text default 'Conference',
  cover_image    text default '',
  status         text not null default 'upcoming',
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
alter table public.events drop constraint if exists events_status_check;
alter table public.events drop constraint if exists event_date_range_check;
update public.events
   set status = coalesce(status, 'upcoming'),
       created_at = coalesce(created_at, now())
 where status is null or created_at is null;
alter table public.events alter column status set not null;
alter table public.events alter column created_at set not null;

create table if not exists public.event_responses (
  id           uuid primary key default uuid_generate_v4(),
  event_id     uuid not null references public.events(id) on delete cascade,
  person_id    uuid not null references public.profiles(id) on delete cascade,
  response     text not null default 'pending',
  note         text default '',
  responded_at timestamptz default now(),
  unique(event_id, person_id)
);
drop trigger if exists guard_event_response on public.event_responses;
alter table public.event_responses
  drop constraint if exists event_responses_response_check;
update public.event_responses set response = 'pending' where response is null;
alter table public.event_responses alter column response set not null;

create table if not exists public.excuses (
  id          uuid primary key default uuid_generate_v4(),
  service_id  uuid references public.services(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,
  person_id   uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  status      text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.excuses
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.excuses add column if not exists reviewed_at timestamptz;
alter table public.excuses add column if not exists updated_at timestamptz default now();
drop trigger if exists guard_excuse_request on public.excuses;
alter table public.excuses drop constraint if exists excuses_status_check;
alter table public.excuses drop constraint if exists excuse_exactly_one_target_check;
alter table public.excuses drop constraint if exists excuse_reason_length_check;
update public.excuses
   set reason = btrim(reason),
       status = coalesce(status, 'pending'),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now())
 where reason is distinct from btrim(reason)
    or status is null
    or created_at is null
    or updated_at is null;
alter table public.excuses alter column status set not null;
alter table public.excuses alter column created_at set not null;
alter table public.excuses alter column updated_at set not null;

create table if not exists public.substitute_requests (
  id            uuid primary key default uuid_generate_v4(),
  service_id    uuid not null references public.services(id) on delete cascade,
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  substitute_id uuid references public.profiles(id) on delete set null,
  role          text not null,
  status        text not null default 'open',
  note          text default '',
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.substitute_requests
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;
alter table public.substitute_requests add column if not exists resolved_at timestamptz;
alter table public.substitute_requests add column if not exists updated_at timestamptz default now();
drop trigger if exists guard_substitute_request on public.substitute_requests;
alter table public.substitute_requests
  drop constraint if exists substitute_requests_status_check;
alter table public.substitute_requests
  drop constraint if exists substitute_not_requester_check;
alter table public.substitute_requests
  drop constraint if exists substitute_role_present_check;
alter table public.substitute_requests
  drop constraint if exists substitute_note_length_check;
update public.substitute_requests
   set role = btrim(role),
       status = coalesce(status, 'open'),
       note = coalesce(note, ''),
       created_at = coalesce(created_at, now()),
       updated_at = coalesce(updated_at, created_at, now())
 where role is distinct from btrim(role)
    or status is null
    or note is null
    or created_at is null
    or updated_at is null;
alter table public.substitute_requests alter column status set not null;
alter table public.substitute_requests alter column created_at set not null;
alter table public.substitute_requests alter column updated_at set not null;

-- Synchronize legacy foreign-key delete actions with the fresh-install schema.
-- Invalid reviewer/resolver references are normalized to the SET NULL outcome;
-- orphaned required service/requester/person references still fail loudly.
update public.excuses as excuse
   set reviewed_by = null
 where reviewed_by is not null
   and not exists (
     select 1 from public.profiles as reviewer where reviewer.id = excuse.reviewed_by
   );
update public.substitute_requests as request
   set resolved_by = null
 where resolved_by is not null
   and not exists (
     select 1 from public.profiles as resolver where resolver.id = request.resolved_by
   );

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
      from pg_constraint
     where conrelid = 'public.excuses'::regclass
       and contype = 'f'
       and (
         pg_get_constraintdef(oid) like 'FOREIGN KEY (service_id)%'
         or pg_get_constraintdef(oid) like 'FOREIGN KEY (event_id)%'
         or pg_get_constraintdef(oid) like 'FOREIGN KEY (person_id)%'
         or pg_get_constraintdef(oid) like 'FOREIGN KEY (reviewed_by)%'
       )
  loop
    execute format('alter table public.excuses drop constraint %I', v_constraint.conname);
  end loop;
  alter table public.excuses
    add constraint excuses_service_id_fkey
    foreign key (service_id) references public.services(id) on delete cascade;
  alter table public.excuses
    add constraint excuses_event_id_fkey
    foreign key (event_id) references public.events(id) on delete cascade;
  alter table public.excuses
    add constraint excuses_person_id_fkey
    foreign key (person_id) references public.profiles(id) on delete cascade;
  alter table public.excuses
    add constraint excuses_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete set null;

  for v_constraint in
    select conname
      from pg_constraint
     where conrelid = 'public.substitute_requests'::regclass
       and contype = 'f'
       and (
         pg_get_constraintdef(oid) like 'FOREIGN KEY (service_id)%'
         or pg_get_constraintdef(oid) like 'FOREIGN KEY (requester_id)%'
         or pg_get_constraintdef(oid) like 'FOREIGN KEY (substitute_id)%'
         or pg_get_constraintdef(oid) like 'FOREIGN KEY (resolved_by)%'
       )
  loop
    execute format(
      'alter table public.substitute_requests drop constraint %I',
      v_constraint.conname
    );
  end loop;
  alter table public.substitute_requests
    add constraint substitute_requests_service_id_fkey
    foreign key (service_id) references public.services(id) on delete cascade;
  alter table public.substitute_requests
    add constraint substitute_requests_requester_id_fkey
    foreign key (requester_id) references public.profiles(id) on delete cascade;
  alter table public.substitute_requests
    add constraint substitute_requests_substitute_id_fkey
    foreign key (substitute_id) references public.profiles(id) on delete set null;
  alter table public.substitute_requests
    add constraint substitute_requests_resolved_by_fkey
    foreign key (resolved_by) references public.profiles(id) on delete set null;
end;
$$;

-- Replace legacy status checks, then add new checks as NOT VALID. NOT VALID
-- protects all new writes while allowing legacy inconsistencies to be audited.
alter table public.attendance_sessions
  add constraint attendance_sessions_max_attendees_check
  check (max_attendees is null or max_attendees > 0) not valid;
alter table public.attendance_sessions
  add constraint attendance_sessions_repeat_freq_check
  check (repeat_freq is null or repeat_freq in ('daily','weekly','monthly')) not valid;
alter table public.attendance_sessions
  add constraint attendance_session_expiry_check
  check (expires_at > created_at) not valid;
alter table public.attendance_sessions
  add constraint attendance_session_repeat_check
  check (
    (repeatable and repeat_freq is not null)
    or (not repeatable and repeat_freq is null)
  ) not valid;
alter table public.attendance_sessions
  add constraint attendance_session_time_range_check
  check (end_time is null or session_time is not null) not valid;

alter table public.attendance_records
  add constraint attendance_records_status_check
  check (status in ('present','late','absent','excused')) not valid;
alter table public.attendance_records
  add constraint attendance_record_time_check
  check (check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at)) not valid;

alter table public.events
  add constraint events_status_check
  check (status in ('upcoming','ongoing','past','cancelled')) not valid;
alter table public.events
  add constraint event_date_range_check
  check (end_date is null or end_date >= date) not valid;

alter table public.event_responses
  add constraint event_responses_response_check
  check (response in ('attending','not_attending','maybe','pending')) not valid;

alter table public.excuses
  add constraint excuses_status_check
  check (status in ('pending','approved','rejected','cancelled')) not valid;
alter table public.excuses
  add constraint excuse_exactly_one_target_check
  check (num_nonnulls(service_id, event_id) = 1) not valid;
alter table public.excuses
  add constraint excuse_reason_length_check
  check (char_length(btrim(reason)) between 3 and 2000) not valid;

alter table public.substitute_requests
  add constraint substitute_requests_status_check
  check (status in ('open','filled','cancelled')) not valid;
alter table public.substitute_requests
  add constraint substitute_not_requester_check
  check (substitute_id is null or substitute_id <> requester_id) not valid;
alter table public.substitute_requests
  add constraint substitute_role_present_check
  check (char_length(btrim(role)) between 1 and 100) not valid;
alter table public.substitute_requests
  add constraint substitute_note_length_check
  check (char_length(note) <= 2000) not valid;

-- Remove the old two-column attendance uniqueness rule so repeatable sessions
-- can create one record per occurrence.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
      from pg_constraint
     where conrelid = 'public.attendance_records'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) = 'UNIQUE (session_id, person_id)'
  loop
    execute format(
      'alter table public.attendance_records drop constraint %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

-- ── INDEXES ────────────────────────────────────────────────

create index if not exists attendance_sessions_service_idx
  on public.attendance_sessions(service_id);
create index if not exists attendance_sessions_active_expiry_idx
  on public.attendance_sessions(expires_at) where active;
create index if not exists attendance_records_person_date_idx
  on public.attendance_records(person_id, occurrence_date desc);
create index if not exists setlist_song_idx
  on public.setlist_items(song_id);
create index if not exists events_date_idx on public.events(date);
create index if not exists event_responses_person_idx
  on public.event_responses(person_id);
create index if not exists excuses_person_status_idx
  on public.excuses(person_id, status);
create index if not exists excuses_service_idx
  on public.excuses(service_id) where service_id is not null;
create index if not exists excuses_event_idx
  on public.excuses(event_id) where event_id is not null;
create index if not exists substitute_requests_requester_status_idx
  on public.substitute_requests(requester_id, status);
create index if not exists substitute_requests_substitute_idx
  on public.substitute_requests(substitute_id) where substitute_id is not null;

do $$
begin
  if to_regclass('public.services_recurrence_position_uidx') is null then
    if exists (
      select 1 from public.services
       where recurrence_group_id is not null and recurrence_index is not null
       group by recurrence_group_id, recurrence_index having count(*) > 1
    ) then
      raise warning 'Skipped recurrence-position unique index: duplicates require cleanup';
    else
      create unique index services_recurrence_position_uidx
        on public.services(recurrence_group_id, recurrence_index)
        where recurrence_group_id is not null and recurrence_index is not null;
    end if;
  end if;

  if to_regclass('public.services_recurrence_date_uidx') is null then
    if exists (
      select 1 from public.services
       where recurrence_group_id is not null
       group by recurrence_group_id, date having count(*) > 1
    ) then
      raise warning 'Skipped recurrence-date unique index: duplicates require cleanup';
    else
      create unique index services_recurrence_date_uidx
        on public.services(recurrence_group_id, date)
        where recurrence_group_id is not null;
    end if;
  end if;

  if to_regclass('public.attendance_records_session_person_occurrence_uidx') is null
     and not exists (
       select 1
         from pg_constraint
        where conrelid = 'public.attendance_records'::regclass
          and contype = 'u'
          and pg_get_constraintdef(oid) =
            'UNIQUE (session_id, person_id, occurrence_date)'
     ) then
    if exists (
      select 1 from public.attendance_records
       group by session_id, person_id, occurrence_date
      having count(*) > 1
    ) then
      raise warning 'Skipped attendance occurrence unique index: duplicate rows require cleanup';
    else
      create unique index attendance_records_session_person_occurrence_uidx
        on public.attendance_records(session_id, person_id, occurrence_date);
    end if;
  end if;

  if to_regclass('public.excuses_one_pending_service_idx') is null then
    if exists (
      select 1 from public.excuses
       where status = 'pending' and service_id is not null
       group by service_id, person_id having count(*) > 1
    ) then
      raise warning 'Skipped pending service-excuse unique index: duplicates require cleanup';
    else
      create unique index excuses_one_pending_service_idx
        on public.excuses(service_id, person_id)
        where status = 'pending' and service_id is not null;
    end if;
  end if;

  if to_regclass('public.excuses_one_pending_event_idx') is null then
    if exists (
      select 1 from public.excuses
       where status = 'pending' and event_id is not null
       group by event_id, person_id having count(*) > 1
    ) then
      raise warning 'Skipped pending event-excuse unique index: duplicates require cleanup';
    else
      create unique index excuses_one_pending_event_idx
        on public.excuses(event_id, person_id)
        where status = 'pending' and event_id is not null;
    end if;
  end if;

  if to_regclass('public.substitute_one_open_assignment_idx') is null then
    if exists (
      select 1 from public.substitute_requests
       where status = 'open'
       group by service_id, requester_id, role having count(*) > 1
    ) then
      raise warning 'Skipped open substitute-request unique index: duplicates require cleanup';
    else
      create unique index substitute_one_open_assignment_idx
        on public.substitute_requests(service_id, requester_id, role)
        where status = 'open';
    end if;
  end if;

  if to_regclass('public.substitute_one_filled_candidate_idx') is null then
    if exists (
      select 1 from public.substitute_requests
       where status = 'filled' and substitute_id is not null
       group by service_id, substitute_id having count(*) > 1
    ) then
      raise warning 'Skipped filled substitute-candidate unique index: duplicates require cleanup';
    else
      create unique index substitute_one_filled_candidate_idx
        on public.substitute_requests(service_id, substitute_id)
        where status = 'filled' and substitute_id is not null;
    end if;
  end if;
end;
$$;

-- ── AUTHORIZATION AND CORE TRIGGERS ───────────────────────

create or replace function public.handle_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(
    (select is_admin and status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.can_manage_worship()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((
    select status = 'active' and (
      is_admin
      or role in ('Worship Leader', 'Music Director')
      or roles ?| array['Worship Leader', 'Music Director']
    )
      from public.profiles
     where id = auth.uid()
  ), false);
$$;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.is_admin is distinct from old.is_admin
    or new.role is distinct from old.role
    or new.roles is distinct from old.roles
    or new.position is distinct from old.position
    or new.status is distinct from old.status
    or new.join_date is distinct from old.join_date
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only an active administrator can change membership or authorization fields';
  end if;

  if coalesce(old.is_admin, false)
     and old.status = 'active'
     and not (coalesce(new.is_admin, false) and new.status = 'active') then
    -- Serialize all active-admin demotions so two concurrent updates cannot
    -- each observe the other administrator and leave the organization locked out.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'kdec:active-administrators',
      0
    ));

    if not exists (
      select 1
        from public.profiles as other_admin
       where other_admin.id <> old.id
         and other_admin.is_admin
         and other_admin.status = 'active'
    ) then
      raise exception 'The last active administrator cannot be demoted or deactivated'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

create or replace function public.protect_service_team_assignment()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_timezone text;
  v_local_date date;
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
        from public.excuses as active_excuse
       where active_excuse.service_id = old.service_id
         and active_excuse.person_id = old.person_id
         and active_excuse.status in ('pending', 'approved')
    ) then
      raise exception 'Resolve the active excuse before deleting this assignment'
        using errcode = '23503';
    end if;

    if exists (
      select 1
        from public.substitute_requests as linked_request
       where linked_request.service_id = old.service_id
         and (
           (
             linked_request.requester_id = old.person_id
             and linked_request.status in ('open', 'filled')
           )
           or (
             linked_request.substitute_id = old.person_id
             and linked_request.status = 'filled'
           )
         )
    ) then
      raise exception 'Resolve linked substitute requests before deleting this assignment'
        using errcode = '23503';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and not public.can_manage_worship()
     and (
       old.person_id <> auth.uid()
       or new.id is distinct from old.id
       or new.service_id is distinct from old.service_id
       or new.person_id is distinct from old.person_id
       or new.role is distinct from old.role
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'Members may only update their own response status';
  end if;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (clock_timestamp() at time zone v_timezone)::date;

  perform target_service.id
    from public.services as target_service
   where target_service.id = new.service_id
     and target_service.status = 'scheduled'
     and target_service.date >= v_local_date
   for no key update;

  if not found then
    raise exception 'Assignments may only change for scheduled, non-past services'
      using errcode = '22023';
  end if;

  if new.status <> 'declined' and exists (
    select 1
      from public.excuses as active_excuse
     where active_excuse.service_id = new.service_id
       and active_excuse.person_id = new.person_id
       and active_excuse.status in ('pending', 'approved')
  ) then
    raise exception 'An assignment with an active excuse must remain declined'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.substitute_requests as filled_request
     where filled_request.service_id = new.service_id
       and filled_request.requester_id = new.person_id
       and filled_request.status = 'filled'
       and (
         filled_request.role is distinct from new.role
         or new.status <> 'declined'
       )
  ) then
    raise exception 'A replaced requester assignment must remain declined and keep its role'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.substitute_requests as filled_request
     where filled_request.service_id = new.service_id
       and filled_request.substitute_id = new.person_id
       and filled_request.status = 'filled'
       and (
         filled_request.role is distinct from new.role
         or new.status = 'declined'
       )
  ) then
    raise exception 'A filled substitute assignment cannot be declined or change role'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_service_team_assignment on public.service_team;
create trigger protect_service_team_assignment
  before insert or update or delete on public.service_team
  for each row execute function public.protect_service_team_assignment();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  invited_role text;
  invited_roles jsonb;
  invite_code text := nullif(new.raw_user_meta_data->>'invite_code', '');
  invitation_id uuid;
begin
  if invite_code is not null then
    select id, role, roles
      into invitation_id, invited_role, invited_roles
      from public.invitations
     where code = invite_code
       and lower(email) = lower(new.email)
       and status = 'pending'
       and expires_at > now()
     for update;
  end if;

  insert into public.profiles (id, email, name, role, roles, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(invited_role, 'Vocalist'),
    coalesce(invited_roles, jsonb_build_array(coalesce(invited_role, 'Vocalist'))),
    case when invitation_id is null then 'inactive' else 'active' end
  );

  if invitation_id is not null then
    update public.invitations
       set status = 'accepted', accepted_at = now(), accepted_by = new.id
     where id = invitation_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.validate_invitation(p_code text, p_email text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
      from public.invitations
     where code = p_code
       and lower(email) = lower(trim(p_email))
       and status = 'pending'
       and expires_at > now()
  );
$$;

create or replace function public.stamp_organization_settings()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception 'Unknown IANA timezone: %', coalesce(new.timezone, '<null>');
  end if;

  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists organization_settings_updated_at on public.organization_settings;
create trigger organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function public.stamp_organization_settings();

revoke all on function public.validate_invitation(text, text) from public;
grant execute on function public.validate_invitation(text, text) to anon, authenticated;
revoke all on function public.is_active_member() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.can_manage_worship() from public;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_worship() to authenticated;

-- ── ATTENDANCE RPCS ────────────────────────────────────────

create or replace function public.deactivate_cancelled_service_attendance()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.attendance_sessions
     set active = false
   where service_id = new.id
     and active;

  update public.excuses
     set status = 'cancelled'
   where service_id = new.id
     and status = 'pending';

  update public.substitute_requests
     set status = 'cancelled'
   where service_id = new.id
     and status = 'open';

  return new;
end;
$$;

drop trigger if exists deactivate_cancelled_service_attendance on public.services;
create trigger deactivate_cancelled_service_attendance
  after update of status on public.services
  for each row
  when (old.status is distinct from new.status and new.status = 'cancelled')
  execute function public.deactivate_cancelled_service_attendance();

revoke all on function public.deactivate_cancelled_service_attendance() from public;

-- Song usage is derived data. Lock affected songs in a stable order before
-- recounting so concurrent setlist edits cannot overwrite a newer total.
create or replace function public.refresh_song_usage(p_song_ids uuid[])
returns void language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_song_ids uuid[];
begin
  select coalesce(
           array_agg(distinct affected.song_id order by affected.song_id),
           '{}'::uuid[]
         )
    into v_song_ids
    from unnest(coalesce(p_song_ids, '{}'::uuid[])) as affected(song_id)
   where affected.song_id is not null;

  if cardinality(v_song_ids) = 0 then
    return;
  end if;

  perform song.id
    from public.songs as song
   where song.id = any(v_song_ids)
   order by song.id
   for no key update;

  with refreshed as (
    select affected_song.id as song_id,
           count(item.id)::integer as usage_count,
           max(linked_service.date) filter (
             where linked_service.status <> 'cancelled'
           ) as last_used
      from public.songs as affected_song
      left join public.setlist_items as item
        on item.song_id = affected_song.id
      left join public.services as linked_service
        on linked_service.id = item.service_id
     where affected_song.id = any(v_song_ids)
     group by affected_song.id
  )
  update public.songs as song
     set usage_count = refreshed.usage_count,
         last_used = refreshed.last_used
    from refreshed
   where song.id = refreshed.song_id
     and (
       song.usage_count is distinct from refreshed.usage_count
       or song.last_used is distinct from refreshed.last_used
     );
end;
$$;

create or replace function public.maintain_setlist_song_usage()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_song_usage(array[new.song_id]);
  elsif tg_op = 'DELETE' then
    perform public.refresh_song_usage(array[old.song_id]);
  elsif new.song_id is distinct from old.song_id
        or new.service_id is distinct from old.service_id then
    perform public.refresh_song_usage(array[old.song_id, new.song_id]);
  end if;

  return null;
end;
$$;

drop trigger if exists maintain_setlist_song_usage on public.setlist_items;
create trigger maintain_setlist_song_usage
  after insert or delete or update of song_id, service_id on public.setlist_items
  for each row execute function public.maintain_setlist_song_usage();

-- Service date/status changes also affect last_used even when the setlist rows
-- themselves do not change.
create or replace function public.maintain_service_song_usage()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_song_ids uuid[];
begin
  select coalesce(array_agg(distinct item.song_id), '{}'::uuid[])
    into v_song_ids
    from public.setlist_items as item
   where item.service_id = new.id;

  perform public.refresh_song_usage(v_song_ids);
  return null;
end;
$$;

drop trigger if exists maintain_service_song_usage on public.services;
create trigger maintain_service_song_usage
  after update of date, status on public.services
  for each row
  when (old.date is distinct from new.date or old.status is distinct from new.status)
  execute function public.maintain_service_song_usage();

revoke all on function public.refresh_song_usage(uuid[]) from public;
revoke all on function public.maintain_setlist_song_usage() from public;
revoke all on function public.maintain_service_song_usage() from public;

-- Repair legacy counters before making the derived total non-null.
select public.refresh_song_usage(array_agg(song.id order by song.id))
  from public.songs as song;
alter table public.songs alter column usage_count set default 0;
alter table public.songs alter column usage_count set not null;

-- Atomically extend an existing recurrence group. Each JSON object accepts
-- title/date/time/type/notes plus the required recurrence_index. Server-owned
-- status, group, creator, and copied team-response state cannot be overridden.
create or replace function public.generate_service_occurrences(
  p_group_id uuid,
  p_source_service_id uuid,
  p_occurrences jsonb
)
returns setof public.services
language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_source public.services%rowtype;
  v_inserted public.services%rowtype;
  v_occurrence jsonb;
  v_occurrence_count integer;
  v_recurrence_index integer;
  v_occurrence_date date;
  v_max_recurrence_index integer;
  v_max_group_date date;
  v_timezone text;
  v_local_date date;
  v_seen_indexes integer[] := '{}'::integer[];
  v_seen_dates date[] := '{}'::date[];
begin
  if auth.uid() is null or not public.can_manage_worship() then
    raise exception 'Worship manager access is required' using errcode = '42501';
  end if;

  if p_group_id is null or p_source_service_id is null then
    raise exception 'A recurrence group and source service are required'
      using errcode = '22023';
  end if;

  if coalesce(jsonb_typeof(p_occurrences), 'null') <> 'array' then
    raise exception 'Occurrences must be a JSON array' using errcode = '22023';
  end if;

  v_occurrence_count := jsonb_array_length(p_occurrences);
  if v_occurrence_count < 1 or v_occurrence_count > 52 then
    raise exception 'Occurrence count must be between 1 and 52'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'kdec:recurrence-group:' || p_group_id::text,
    0
  ));

  -- Lock the whole group in a stable order before selecting the source. The
  -- source row lock also prevents its team membership from gaining new rows
  -- while the assignments below are copied.
  perform grouped_service.id
    from public.services as grouped_service
   where grouped_service.recurrence_group_id = p_group_id
   order by grouped_service.id
   for update;

  if not found then
    raise exception 'Recurrence group not found' using errcode = 'P0002';
  end if;

  select source.*
    into v_source
   from public.services as source
   where source.id = p_source_service_id
     and source.recurrence_group_id = p_group_id
   for update;

  if not found then
    raise exception 'Source service not found in this recurrence group'
      using errcode = 'P0002';
  end if;

  if v_source.recurrence_frequency not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'The recurrence group requires a valid frequency'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.services as grouped_service
     where grouped_service.recurrence_group_id = p_group_id
       and grouped_service.recurrence_frequency
         is distinct from v_source.recurrence_frequency
  ) then
    raise exception 'The recurrence group contains inconsistent frequency metadata'
      using errcode = '22023';
  end if;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (clock_timestamp() at time zone v_timezone)::date;

  select coalesce(max(grouped_service.recurrence_index), -1),
         max(grouped_service.date)
    into v_max_recurrence_index, v_max_group_date
    from public.services as grouped_service
   where grouped_service.recurrence_group_id = p_group_id;

  perform assignment.id
    from public.service_team as assignment
   where assignment.service_id = p_source_service_id
   order by assignment.person_id, assignment.id
   for share;

  -- Validate the complete payload before performing the first insert. Any
  -- later database error still propagates and rolls the entire RPC back.
  for v_occurrence in
    select element.value
      from jsonb_array_elements(p_occurrences) as element(value)
  loop
    if jsonb_typeof(v_occurrence) <> 'object' then
      raise exception 'Every occurrence must be a JSON object' using errcode = '22023';
    end if;

    if coalesce(v_occurrence->>'recurrence_index', '') !~ '^[0-9]+$' then
      raise exception 'Every occurrence requires an integer recurrence_index'
        using errcode = '22023';
    end if;

    begin
      v_recurrence_index := (v_occurrence->>'recurrence_index')::integer;
    exception when others then
      raise exception 'Every occurrence requires a valid integer recurrence_index'
        using errcode = '22023';
    end;

    if v_recurrence_index <= v_max_recurrence_index then
      raise exception 'Occurrence recurrence_index must be greater than %',
        v_max_recurrence_index using errcode = '22023';
    end if;

    if v_recurrence_index = any(v_seen_indexes) then
      raise exception 'Occurrence recurrence_index values must be unique'
        using errcode = '22023';
    end if;
    v_seen_indexes := array_append(v_seen_indexes, v_recurrence_index);

    if coalesce(v_occurrence->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Every occurrence requires a date in YYYY-MM-DD format'
        using errcode = '22023';
    end if;

    begin
      v_occurrence_date := (v_occurrence->>'date')::date;
    exception when others then
      raise exception 'Every occurrence requires a valid calendar date'
        using errcode = '22023';
    end;

    if v_max_group_date is not null and v_occurrence_date <= v_max_group_date then
      raise exception 'Occurrence dates must be later than the existing group'
        using errcode = '22023';
    end if;

    if v_occurrence_date < v_local_date then
      raise exception 'Occurrence dates cannot be in the past'
        using errcode = '22023';
    end if;

    if v_occurrence ? 'recurrence_frequency'
       and coalesce(v_occurrence->>'recurrence_frequency', '')
         <> v_source.recurrence_frequency then
      raise exception 'Occurrence frequency must match the recurrence group'
        using errcode = '22023';
    end if;

    if v_occurrence_date = any(v_seen_dates) then
      raise exception 'Occurrence dates must be unique' using errcode = '22023';
    end if;
    v_seen_dates := array_append(v_seen_dates, v_occurrence_date);

    if char_length(coalesce(
      nullif(btrim(v_occurrence->>'title'), ''),
      v_source.title,
      ''
    )) not between 1 and 300 then
      raise exception 'Occurrence title must be between 1 and 300 characters'
        using errcode = '22023';
    end if;
  end loop;

  for v_occurrence in
    select element.value
      from jsonb_array_elements(p_occurrences) as element(value)
  loop
    v_recurrence_index := (v_occurrence->>'recurrence_index')::integer;
    v_occurrence_date := (v_occurrence->>'date')::date;

    insert into public.services (
      title,
      date,
      time,
      type,
      status,
      notes,
      recurrence_group_id,
      recurrence_frequency,
      recurrence_index,
      created_by
    ) values (
      coalesce(nullif(btrim(v_occurrence->>'title'), ''), v_source.title),
      v_occurrence_date,
      coalesce(nullif(btrim(v_occurrence->>'time'), ''), v_source.time),
      coalesce(nullif(btrim(v_occurrence->>'type'), ''), v_source.type),
      'scheduled',
      coalesce(v_occurrence->>'notes', v_source.notes, ''),
      p_group_id,
      v_source.recurrence_frequency,
      v_recurrence_index,
      auth.uid()
    )
    returning * into v_inserted;

    insert into public.service_team (service_id, person_id, role, status)
    select v_inserted.id,
           source_assignment.person_id,
           source_assignment.role,
           'pending'
      from public.service_team as source_assignment
     where source_assignment.service_id = p_source_service_id
     order by source_assignment.person_id, source_assignment.id;

    return next v_inserted;
  end loop;

  return;
end;
$$;

revoke all on function public.generate_service_occurrences(uuid, uuid, jsonb) from public;
grant execute on function public.generate_service_occurrences(uuid, uuid, jsonb) to authenticated;

drop function if exists public.get_attendance_session(text);
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
language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_timezone text;
  v_local_date date;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;
  if nullif(btrim(p_qr_code), '') is null then
    return;
  end if;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (statement_timestamp() at time zone v_timezone)::date;

  return query
  select s.id,
         s.service_id,
         s.name,
         s.label,
         s.session_date,
         s.session_time,
         s.end_time,
         s.active,
         s.max_attendees,
         s.repeatable,
         s.repeat_freq,
         s.expires_at,
         v.title,
         v.date,
         v.time
    from public.attendance_sessions as s
    left join public.services as v on v.id = s.service_id
   where s.qr_code = btrim(p_qr_code)
     and s.active
     and s.expires_at > now()
     and (s.service_id is null or v.status <> 'cancelled')
     and (
       (
         s.repeatable
         and v_local_date >= s.session_date
         and (
           s.repeat_freq = 'daily'
           or (s.repeat_freq = 'weekly' and mod(v_local_date - s.session_date, 7) = 0)
           or (
             s.repeat_freq = 'monthly'
             and extract(day from v_local_date)::integer =
               least(
                 extract(day from s.session_date)::integer,
                 extract(day from (date_trunc('month', v_local_date::timestamp) + interval '1 month - 1 day'))::integer
               )
           )
         )
       )
       or (not s.repeatable and s.session_date = v_local_date)
     )
   order by s.expires_at desc
   limit 1;
end;
$$;

create or replace function public.check_in_attendance(p_qr_code text)
returns public.attendance_records
language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_session         public.attendance_sessions%rowtype;
  v_record          public.attendance_records%rowtype;
  v_timezone        text;
  v_late_minutes    integer;
  v_local_now       timestamp without time zone;
  v_local_date      date;
  v_occurrence_date date;
  v_service_date    date;
  v_session_date    date;
  v_attendance_status public.attendance_records.status%type := 'present';
  v_attendee_count  integer;
  v_record_exists   boolean;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;
  if nullif(btrim(p_qr_code), '') is null then
    raise exception 'Attendance code is required' using errcode = '22023';
  end if;

  select *
    into v_session
    from public.attendance_sessions
   where qr_code = btrim(p_qr_code)
   for update;

  if not found
     or not v_session.active
     or v_session.expires_at <= clock_timestamp()
     or exists (
       select 1
         from public.services as linked_service
        where linked_service.id = v_session.service_id
          and linked_service.status = 'cancelled'
     ) then
    raise exception 'Attendance link is invalid or expired' using errcode = '22023';
  end if;

  select timezone, attendance_late_minutes
    into v_timezone, v_late_minutes
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_late_minutes := least(greatest(coalesce(v_late_minutes, 0), 0), 240);
  v_local_now := clock_timestamp() at time zone v_timezone;
  v_local_date := v_local_now::date;

  if v_session.service_id is not null then
    select linked_service.date
      into v_service_date
      from public.services as linked_service
     where linked_service.id = v_session.service_id;

    if not found then
      raise exception 'Attendance link is invalid or expired' using errcode = '22023';
    end if;
  end if;

  v_session_date := coalesce(
    v_session.session_date,
    v_service_date,
    (v_session.created_at at time zone v_timezone)::date
  );

  if not v_session.repeatable and v_session_date <> v_local_date then
    raise exception 'Attendance link is invalid or expired' using errcode = '22023';
  end if;

  if v_session.repeatable and (
    v_local_date < v_session_date
    or (v_session.repeat_freq = 'weekly' and mod(v_local_date - v_session_date, 7) <> 0)
    or (
      v_session.repeat_freq = 'monthly'
      and extract(day from v_local_date)::integer <>
        least(
          extract(day from v_session_date)::integer,
          extract(day from (date_trunc('month', v_local_date::timestamp) + interval '1 month - 1 day'))::integer
        )
    )
  ) then
    raise exception 'Attendance link is invalid or expired' using errcode = '22023';
  end if;

  v_occurrence_date := case when v_session.repeatable then v_local_date else v_session_date end;

  if v_session.session_time is not null and v_local_now > (
    (v_occurrence_date + v_session.session_time)
    + make_interval(mins => v_late_minutes)
  ) then
    v_attendance_status := 'late';
  end if;

  select *
    into v_record
    from public.attendance_records
   where session_id = v_session.id
     and person_id = auth.uid()
     and occurrence_date = v_occurrence_date
   for update;
  v_record_exists := found;

  if v_record_exists and v_record.check_in_at is not null then
    return v_record;
  end if;

  if v_session.max_attendees is not null then
    select count(*)
      into v_attendee_count
      from public.attendance_records
     where session_id = v_session.id
       and occurrence_date = v_occurrence_date
       and check_in_at is not null;
    if v_attendee_count >= v_session.max_attendees then
      raise exception 'This attendance session is full' using errcode = 'P0001';
    end if;
  end if;

  if v_record_exists then
    update public.attendance_records
       set check_in_at = clock_timestamp(),
           check_out_at = null,
           status = v_attendance_status
     where id = v_record.id
     returning * into v_record;
  else
    insert into public.attendance_records (
      session_id, person_id, occurrence_date, check_in_at, status
    ) values (
      v_session.id, auth.uid(), v_occurrence_date, clock_timestamp(), v_attendance_status
    ) returning * into v_record;
  end if;

  return v_record;
end;
$$;

create or replace function public.check_out_attendance(p_session_id uuid)
returns public.attendance_records
language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_record public.attendance_records%rowtype;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;
  if p_session_id is null then
    raise exception 'Attendance session is required' using errcode = '22023';
  end if;

  select *
    into v_record
    from public.attendance_records
   where session_id = p_session_id
     and person_id = auth.uid()
     and check_in_at is not null
   order by occurrence_date desc, created_at desc
   limit 1
   for update;

  if not found then
    raise exception 'Check-in record not found' using errcode = 'P0002';
  end if;
  if v_record.check_out_at is null then
    update public.attendance_records
       set check_out_at = greatest(clock_timestamp(), v_record.check_in_at)
     where id = v_record.id
     returning * into v_record;
  end if;
  return v_record;
end;
$$;

revoke all on function public.get_attendance_session(text) from public;
revoke all on function public.check_in_attendance(text) from public;
revoke all on function public.check_out_attendance(uuid) from public;
grant execute on function public.get_attendance_session(text) to authenticated;
grant execute on function public.check_in_attendance(text) to authenticated;
grant execute on function public.check_out_attendance(uuid) to authenticated;

-- ── REQUEST AND RESPONSE GUARDS ────────────────────────────

create or replace function public.guard_excuse_request()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_timezone       text;
  v_excuse_limit   integer;
  v_excuse_period  text;
  v_local_now      timestamp without time zone;
  v_excuse_count   integer;
begin
  new.reason := btrim(new.reason);
  new.updated_at := clock_timestamp();

  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    if auth.uid() is not null then
      if not public.is_active_member() then
        raise exception 'Active membership is required' using errcode = '42501';
      end if;
      new.person_id := auth.uid();
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;

    if num_nonnulls(new.service_id, new.event_id) <> 1 then
      raise exception 'An excuse must target exactly one service or event';
    end if;

    if new.person_id is null then
      raise exception 'An excuse requires a member' using errcode = '23502';
    end if;

    -- Serialize every excuse submission for this member. This protects both the
    -- configured period limit and per-assignment duplicate check from races.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'kdec:excuse:person:' || new.person_id::text,
      0
    ));

    if new.status = 'pending' and exists (
      select 1
        from public.excuses as existing
       where existing.person_id = new.person_id
         and existing.status = 'pending'
         and (
           (new.service_id is not null and existing.service_id = new.service_id)
           or (new.event_id is not null and existing.event_id = new.event_id)
         )
    ) then
      raise exception 'A pending excuse already exists for this assignment'
        using errcode = '23505';
    end if;

    select timezone, excuse_limit, excuse_period
      into v_timezone, v_excuse_limit, v_excuse_period
      from public.organization_settings
     where id = 1;
    v_timezone := coalesce(v_timezone, 'Africa/Cairo');
    v_excuse_limit := least(greatest(coalesce(v_excuse_limit, 0), 0), 100);
    v_excuse_period := case
      when v_excuse_period in ('total','monthly','weekly') then v_excuse_period
      else 'total'
    end;
    v_local_now := clock_timestamp() at time zone v_timezone;

    if new.service_id is not null and new.status in ('pending', 'approved') then
      if not exists (
        select 1
          from public.services as target_service
         where target_service.id = new.service_id
           and target_service.status = 'scheduled'
           and target_service.date >= v_local_now::date
      ) then
        raise exception 'Service excuses may only target scheduled, non-past services'
          using errcode = '22023';
      end if;

      if not exists (
        select 1
          from public.service_team as assignment
         where assignment.service_id = new.service_id
           and assignment.person_id = new.person_id
           and assignment.status = 'declined'
      ) then
        raise exception 'A service excuse requires a declined service assignment'
          using errcode = '22023';
      end if;
    end if;

    if new.status in ('pending', 'approved') then
      select count(*)
        into v_excuse_count
        from public.excuses as existing
       where existing.person_id = new.person_id
         and existing.status in ('pending', 'approved')
         and (
           v_excuse_period = 'total'
           or (
             v_excuse_period = 'monthly'
             and date_trunc('month', existing.created_at at time zone v_timezone)
               = date_trunc('month', v_local_now)
           )
           or (
             v_excuse_period = 'weekly'
             and date_trunc('week', existing.created_at at time zone v_timezone)
               = date_trunc('week', v_local_now)
           )
         );

      if v_excuse_count >= v_excuse_limit then
        raise exception 'Excuse limit reached for the configured % period', v_excuse_period
          using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.can_manage_worship() then
    if new.id is distinct from old.id
       or new.service_id is distinct from old.service_id
       or new.event_id is distinct from old.event_id
       or new.person_id is distinct from old.person_id
       or new.reason is distinct from old.reason
       or new.created_at is distinct from old.created_at then
      raise exception 'Excuse request details are immutable after submission';
    end if;
    if old.status <> 'pending' then
      raise exception 'A reviewed excuse is final and cannot be reopened or rewritten';
    end if;
    if new.status = 'pending' then
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.reviewed_by := auth.uid();
      new.reviewed_at := clock_timestamp();
    end if;
    return new;
  end if;

  if not public.is_active_member()
     or old.person_id <> auth.uid()
     or old.status <> 'pending'
     or new.status <> 'cancelled'
     or new.id is distinct from old.id
     or new.service_id is distinct from old.service_id
     or new.event_id is distinct from old.event_id
     or new.person_id is distinct from old.person_id
     or new.reason is distinct from old.reason
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Members may only cancel their own pending excuse';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_excuse_request on public.excuses;
create trigger guard_excuse_request
  before insert or update on public.excuses
  for each row execute function public.guard_excuse_request();

-- Service excuses are submitted through one transaction so the audit request
-- and the member's assignment response cannot drift apart.
create or replace function public.submit_service_excuse(
  p_service_id uuid,
  p_reason text
)
returns public.excuses
language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_assignment_id uuid;
  v_excuse public.excuses%rowtype;
  v_timezone text;
  v_local_date date;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  if p_service_id is null then
    raise exception 'A service is required' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'An excuse reason must be between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (clock_timestamp() at time zone v_timezone)::date;

  perform service.id
    from public.services as service
   where service.id = p_service_id
     and service.status = 'scheduled'
     and service.date >= v_local_date
   for no key update;

  if not found then
    raise exception 'Service excuses may only target scheduled, non-past services'
      using errcode = '22023';
  end if;

  select assignment.id
    into v_assignment_id
    from public.service_team as assignment
   where assignment.service_id = p_service_id
     and assignment.person_id = auth.uid()
   for update;

  if not found then
    raise exception 'An eligible service assignment is required' using errcode = '42501';
  end if;

  update public.service_team
     set status = 'declined'
   where id = v_assignment_id;

  -- The trigger above applies identity, assignment, duplicate, and configured-
  -- limit rules. A failure rolls the preceding response change back.
  insert into public.excuses (service_id, event_id, person_id, reason, status)
  values (p_service_id, null, auth.uid(), btrim(p_reason), 'pending')
  returning * into v_excuse;

  return v_excuse;
end;
$$;

revoke all on function public.submit_service_excuse(uuid, text) from public;
grant execute on function public.submit_service_excuse(uuid, text) to authenticated;

-- Authenticated callers must use submit_service_excuse; the security-definer
-- function exposes only the narrow, atomic workflow above.
revoke insert on table public.excuses from anon, authenticated;

create or replace function public.guard_substitute_request()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_candidate_valid boolean;
  v_validate_candidate boolean := false;
  v_timezone text;
  v_local_date date;
begin
  new.role := btrim(new.role);
  new.note := coalesce(new.note, '');
  new.updated_at := clock_timestamp();

  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    if auth.uid() is not null then
      if not public.is_active_member() then
        raise exception 'Active membership is required' using errcode = '42501';
      end if;
      new.requester_id := auth.uid();
      new.substitute_id := null;
      new.status := 'open';
      new.resolved_by := null;
      new.resolved_at := null;
    end if;
  elsif auth.uid() is not null and public.can_manage_worship() then
    if new.id is distinct from old.id
       or new.service_id is distinct from old.service_id
       or new.requester_id is distinct from old.requester_id
       or new.role is distinct from old.role
       or new.note is distinct from old.note
       or new.created_at is distinct from old.created_at then
      raise exception 'Substitute request details are immutable after submission';
    end if;
    if old.status <> 'open' then
      raise exception 'A resolved substitute request is final and cannot be reopened or rewritten';
    end if;
    if new.status = 'open' then
      new.resolved_by := null;
      new.resolved_at := null;
    else
      new.resolved_by := auth.uid();
      new.resolved_at := clock_timestamp();
    end if;
  elsif auth.uid() is not null then
    if not public.is_active_member()
       or old.requester_id <> auth.uid()
       or old.status <> 'open'
       or new.status <> 'cancelled'
       or new.id is distinct from old.id
       or new.service_id is distinct from old.service_id
       or new.requester_id is distinct from old.requester_id
       or new.substitute_id is distinct from old.substitute_id
       or new.role is distinct from old.role
       or new.note is distinct from old.note
       or new.resolved_by is distinct from old.resolved_by
       or new.resolved_at is distinct from old.resolved_at
       or new.created_at is distinct from old.created_at then
      raise exception 'Members may only cancel their own open substitute request';
    end if;
  end if;

  if tg_op = 'INSERT' or new.status = 'filled' then
    select timezone
      into v_timezone
      from public.organization_settings
     where id = 1;
    v_timezone := coalesce(v_timezone, 'Africa/Cairo');
    v_local_date := (clock_timestamp() at time zone v_timezone)::date;

    perform target_service.id
      from public.services as target_service
     where target_service.id = new.service_id
       and target_service.status = 'scheduled'
       and target_service.date >= v_local_date
     for no key update;

    if not found then
      raise exception 'Substitute requests require a scheduled, non-past service'
        using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT' and not exists (
    select 1
      from public.service_team
     where service_id = new.service_id
       and person_id = new.requester_id
       and role = new.role
  ) then
    raise exception 'A substitute request requires a matching service assignment';
  end if;

  if tg_op = 'INSERT' and exists (
    select 1
      from public.substitute_requests as filled_request
     where filled_request.service_id = new.service_id
       and filled_request.substitute_id = new.requester_id
       and filled_request.status = 'filled'
  ) then
    raise exception 'A filled substitute cannot request a replacement for the same service'
      using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'kdec:substitute:service:' || new.service_id::text
      || ':requester:' || new.requester_id::text
      || ':role:' || new.role,
      0
    ));

    if exists (
      select 1
        from public.substitute_requests as existing
       where existing.service_id = new.service_id
         and existing.requester_id = new.requester_id
         and existing.role = new.role
         and existing.status = 'open'
    ) then
      raise exception 'An open substitute request already exists for this assignment'
        using errcode = '23505';
    end if;
  end if;

  if new.status = 'filled' then
    if new.substitute_id is null then
      raise exception 'A filled request requires a substitute';
    end if;

    if new.substitute_id = new.requester_id then
      raise exception 'The requester cannot substitute for their own assignment';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'kdec:substitute:candidate:service:' || new.service_id::text
      || ':person:' || new.substitute_id::text,
      0
    ));

    if exists (
      select 1
        from public.substitute_requests as existing
       where existing.service_id = new.service_id
         and existing.substitute_id = new.substitute_id
         and existing.status = 'filled'
         and existing.id is distinct from new.id
    ) then
      raise exception 'This substitute already fills another request for the service'
        using errcode = '23505';
    end if;

    if not exists (
      select 1
        from public.service_team as candidate_assignment
       where candidate_assignment.service_id = new.service_id
         and candidate_assignment.person_id = new.substitute_id
         and candidate_assignment.role = new.role
         and candidate_assignment.status in ('pending', 'confirmed')
    ) or not exists (
      select 1
        from public.service_team as requester_assignment
       where requester_assignment.service_id = new.service_id
         and requester_assignment.person_id = new.requester_id
         and requester_assignment.role = new.role
         and requester_assignment.status = 'declined'
    ) then
      raise exception 'Team assignments must be updated before filling a substitute request';
    end if;
  end if;

  if new.substitute_id is not null then
    if tg_op = 'INSERT' then
      v_validate_candidate := true;
    else
      v_validate_candidate := new.substitute_id is distinct from old.substitute_id
        or new.role is distinct from old.role
        or new.status = 'filled';
    end if;
  end if;

  if v_validate_candidate then
    select exists (
      select 1
        from public.profiles as p
       where p.id = new.substitute_id
         and p.status = 'active'
         and (p.role = new.role or p.roles ? new.role)
    ) into v_candidate_valid;
    if not v_candidate_valid then
      raise exception 'The selected substitute is not active or is not assigned this role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_substitute_request on public.substitute_requests;
create trigger guard_substitute_request
  before insert or update on public.substitute_requests
  for each row execute function public.guard_substitute_request();

create or replace function public.fill_substitute_request(
  p_request_id uuid,
  p_substitute_id uuid
)
returns public.substitute_requests
language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_request public.substitute_requests%rowtype;
  v_filled_request public.substitute_requests%rowtype;
  v_candidate_assignment public.service_team%rowtype;
  v_requester_assignment_id uuid;
  v_service_id uuid;
  v_timezone text;
  v_local_date date;
begin
  if auth.uid() is null or not public.can_manage_worship() then
    raise exception 'Worship manager access is required' using errcode = '42501';
  end if;

  if p_request_id is null or p_substitute_id is null then
    raise exception 'A request and substitute are required' using errcode = '22023';
  end if;

  select request.*
    into v_request
    from public.substitute_requests as request
   where request.id = p_request_id
     and request.status = 'open';

  if not found then
    raise exception 'Open substitute request not found' using errcode = 'P0002';
  end if;
  v_service_id := v_request.service_id;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (clock_timestamp() at time zone v_timezone)::date;

  perform service.id
   from public.services as service
   where service.id = v_service_id
     and service.status = 'scheduled'
     and service.date >= v_local_date
   for no key update;

  if not found then
    raise exception 'Substitutes may only fill scheduled, non-past services'
      using errcode = '22023';
  end if;

  -- Follow the service -> request lock order used by service cancellation.
  select request.*
    into v_request
    from public.substitute_requests as request
   where request.id = p_request_id
     and request.status = 'open'
     and request.service_id = v_service_id
   for update;

  if not found then
    raise exception 'Open substitute request not found' using errcode = 'P0002';
  end if;

  if p_substitute_id = v_request.requester_id then
    raise exception 'The requester cannot substitute for their own assignment'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'kdec:substitute:candidate:service:' || v_request.service_id::text
    || ':person:' || p_substitute_id::text,
    0
  ));

  if not exists (
    select 1
      from public.profiles as candidate
     where candidate.id = p_substitute_id
       and candidate.status = 'active'
       and (candidate.role = v_request.role or candidate.roles ? v_request.role)
  ) then
    raise exception 'The selected substitute is not active or is not assigned this role'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.excuses as active_excuse
     where active_excuse.service_id = v_request.service_id
       and active_excuse.person_id = p_substitute_id
       and active_excuse.status in ('pending', 'approved')
  ) then
    raise exception 'A member with an active excuse cannot fill this service'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.substitute_requests as requester_replacement
     where requester_replacement.service_id = v_request.service_id
       and requester_replacement.requester_id = p_substitute_id
       and requester_replacement.status = 'filled'
  ) then
    raise exception 'A replaced requester cannot also fill another request for the service'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.substitute_requests as existing_fill
     where existing_fill.service_id = v_request.service_id
       and existing_fill.substitute_id = p_substitute_id
       and existing_fill.status = 'filled'
       and existing_fill.id <> v_request.id
  ) then
    raise exception 'This substitute already fills another request for the service'
      using errcode = '23505';
  end if;

  -- Lock existing team rows in a stable order. An existing candidate row is
  -- reusable only when it already represents this role and is still active.
  perform assignment.id
    from public.service_team as assignment
   where assignment.service_id = v_request.service_id
     and assignment.person_id in (v_request.requester_id, p_substitute_id)
   order by assignment.person_id, assignment.id
   for update;

  select assignment.id
    into v_requester_assignment_id
    from public.service_team as assignment
   where assignment.service_id = v_request.service_id
     and assignment.person_id = v_request.requester_id
     and assignment.role = v_request.role;

  if not found then
    raise exception 'The requester no longer has the matching service assignment'
      using errcode = '22023';
  end if;

  insert into public.service_team (service_id, person_id, role, status)
  values (v_request.service_id, p_substitute_id, v_request.role, 'pending')
  on conflict (service_id, person_id) do nothing;

  select assignment.*
    into v_candidate_assignment
    from public.service_team as assignment
   where assignment.service_id = v_request.service_id
     and assignment.person_id = p_substitute_id
   for update;

  if not found
     or v_candidate_assignment.role is distinct from v_request.role
     or v_candidate_assignment.status not in ('pending', 'confirmed') then
    raise exception 'The substitute has a conflicting service assignment'
      using errcode = '22023';
  end if;

  update public.service_team
     set status = 'declined'
   where id = v_requester_assignment_id;

  -- guard_substitute_request validates the completed assignment state and
  -- supplies resolved_by/resolved_at from the authenticated manager.
  update public.substitute_requests
     set substitute_id = p_substitute_id,
         status = 'filled'
   where id = v_request.id
     and status = 'open'
  returning * into v_filled_request;

  if not found then
    raise exception 'Open substitute request not found' using errcode = 'P0002';
  end if;

  return v_filled_request;
end;
$$;

revoke all on function public.fill_substitute_request(uuid, uuid) from public;
grant execute on function public.fill_substitute_request(uuid, uuid) to authenticated;

-- Members respond through this narrow RPC; direct service_team updates are not
-- exposed by RLS. The assignment trigger remains the final workflow invariant.
create or replace function public.respond_to_service_assignment(
  p_service_id uuid,
  p_status text
)
returns public.service_team
language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_timezone text;
  v_local_date date;
  v_assignment public.service_team%rowtype;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  if p_service_id is null or v_status not in ('confirmed', 'declined') then
    raise exception 'A service and a confirmed or declined response are required'
      using errcode = '22023';
  end if;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (clock_timestamp() at time zone v_timezone)::date;

  perform service.id
    from public.services as service
   where service.id = p_service_id
     and service.status = 'scheduled'
     and service.date >= v_local_date
   for no key update;

  if not found then
    raise exception 'Assignments may only change for scheduled, non-past services'
      using errcode = '22023';
  end if;

  select assignment.*
    into v_assignment
    from public.service_team as assignment
   where assignment.service_id = p_service_id
     and assignment.person_id = auth.uid()
   for update;

  if not found then
    raise exception 'Service assignment not found' using errcode = 'P0002';
  end if;

  if v_status = 'confirmed' and exists (
    select 1
      from public.excuses as active_excuse
     where active_excuse.service_id = p_service_id
       and active_excuse.person_id = auth.uid()
       and active_excuse.status in ('pending', 'approved')
  ) then
    raise exception 'An assignment with an active excuse must remain declined'
      using errcode = '22023';
  end if;

  if v_status = 'confirmed' and exists (
    select 1
      from public.substitute_requests as filled_request
     where filled_request.service_id = p_service_id
       and filled_request.requester_id = auth.uid()
       and filled_request.status = 'filled'
  ) then
    raise exception 'A replaced requester assignment must remain declined'
      using errcode = '22023';
  end if;

  if v_status = 'declined' and exists (
    select 1
      from public.substitute_requests as filled_request
     where filled_request.service_id = p_service_id
       and filled_request.substitute_id = auth.uid()
       and filled_request.status = 'filled'
  ) then
    raise exception 'A filled substitute cannot decline the accepted assignment'
      using errcode = '22023';
  end if;

  update public.service_team
     set status = v_status
   where id = v_assignment.id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.respond_to_service_assignment(uuid, text) from public;
grant execute on function public.respond_to_service_assignment(uuid, text) to authenticated;

create or replace function public.guard_event_response()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_timezone text;
  v_local_date date;
begin
  if auth.uid() is not null then
    if not public.is_active_member() then
      raise exception 'Active membership is required' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      new.person_id := auth.uid();
    elsif old.person_id <> auth.uid()
          or new.id is distinct from old.id
          or new.person_id is distinct from old.person_id
          or new.event_id is distinct from old.event_id then
      raise exception 'Members may only update their own event response';
    end if;
  end if;

  select timezone
    into v_timezone
    from public.organization_settings
   where id = 1;
  v_timezone := coalesce(v_timezone, 'Africa/Cairo');
  v_local_date := (clock_timestamp() at time zone v_timezone)::date;

  if not exists (
    select 1
      from public.events as target_event
     where target_event.id = new.event_id
       and target_event.status <> 'cancelled'
       and coalesce(target_event.end_date, target_event.date) >= v_local_date
  ) then
    raise exception 'This event is no longer accepting responses' using errcode = '22023';
  end if;
  new.responded_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists guard_event_response on public.event_responses;
create trigger guard_event_response
  before insert or update on public.event_responses
  for each row execute function public.guard_event_response();

-- Refresh generic timestamp triggers in case an older deployment omitted them.
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
drop trigger if exists songs_updated_at on public.songs;
create trigger songs_updated_at
  before update on public.songs
  for each row execute function public.handle_updated_at();
drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at
  before update on public.services
  for each row execute function public.handle_updated_at();

-- ── ROW LEVEL SECURITY ─────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.services enable row level security;
alter table public.setlist_items enable row level security;
alter table public.service_team enable row level security;
alter table public.announcements enable row level security;
alter table public.invitations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.events enable row level security;
alter table public.event_responses enable row level security;
alter table public.excuses enable row level security;
alter table public.substitute_requests enable row level security;

revoke delete on table
  public.services,
  public.events,
  public.attendance_sessions,
  public.attendance_records,
  public.excuses,
  public.substitute_requests
from anon, authenticated;

-- Remove all policy names shipped by prior repository versions and this
-- migration. This closes the former permissive policies before replacement.
drop policy if exists "Profiles are visible to authenticated users" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;

drop policy if exists "Songs visible to authenticated users" on public.songs;
drop policy if exists "Admins and leaders can insert songs" on public.songs;
drop policy if exists "Admins and leaders can update songs" on public.songs;
drop policy if exists "Admins can delete songs" on public.songs;
drop policy if exists "Worship managers can insert songs" on public.songs;
drop policy if exists "Worship managers can update songs" on public.songs;
drop policy if exists "Worship managers can archive songs" on public.songs;

drop policy if exists "Services visible to authenticated users" on public.services;
drop policy if exists "Admins can manage services" on public.services;
drop policy if exists "Worship managers can manage services" on public.services;
drop policy if exists "Worship managers can create services" on public.services;
drop policy if exists "Worship managers can update services" on public.services;

drop policy if exists "Setlists visible to authenticated users" on public.setlist_items;
drop policy if exists "Admins can manage setlists" on public.setlist_items;
drop policy if exists "Worship managers can manage setlists" on public.setlist_items;

drop policy if exists "Team assignments visible to authenticated users" on public.service_team;
drop policy if exists "Admins can manage team assignments" on public.service_team;
drop policy if exists "Worship managers can manage team assignments" on public.service_team;
drop policy if exists "Members can update their own status" on public.service_team;

drop policy if exists "Announcements visible to authenticated users" on public.announcements;
drop policy if exists "Admins can manage announcements" on public.announcements;
drop policy if exists "Worship managers can manage announcements" on public.announcements;

drop policy if exists "Admins can manage invitations" on public.invitations;
drop policy if exists "Anyone can read invitation by code (for signup)" on public.invitations;

drop policy if exists "Active members can read organization settings" on public.organization_settings;
drop policy if exists "Admins can update organization settings" on public.organization_settings;

drop policy if exists "Attendance sessions readable" on public.attendance_sessions;
drop policy if exists "Admins manage sessions" on public.attendance_sessions;
drop policy if exists "Admins read attendance sessions" on public.attendance_sessions;
drop policy if exists "Admins insert attendance sessions" on public.attendance_sessions;
drop policy if exists "Admins update attendance sessions" on public.attendance_sessions;
drop policy if exists "Admins delete attendance sessions" on public.attendance_sessions;

drop policy if exists "Own records" on public.attendance_records;
drop policy if exists "Insert own record" on public.attendance_records;
drop policy if exists "Update own record" on public.attendance_records;
drop policy if exists "Admins delete records" on public.attendance_records;
drop policy if exists "Members read own attendance records" on public.attendance_records;
drop policy if exists "Admins read all attendance records" on public.attendance_records;
drop policy if exists "Admins insert attendance records" on public.attendance_records;
drop policy if exists "Admins update attendance records" on public.attendance_records;
drop policy if exists "Admins delete attendance records" on public.attendance_records;

drop policy if exists "Events readable" on public.events;
drop policy if exists "Active members read events" on public.events;
drop policy if exists "Admins manage events" on public.events;
drop policy if exists "Admins create events" on public.events;
drop policy if exists "Admins update events" on public.events;

drop policy if exists "Event responses readable" on public.event_responses;
drop policy if exists "Own response" on public.event_responses;
drop policy if exists "Active members read event responses" on public.event_responses;
drop policy if exists "Members insert own event response" on public.event_responses;
drop policy if exists "Members update own event response" on public.event_responses;
drop policy if exists "Members delete own event response" on public.event_responses;

drop policy if exists "Excuses readable by admin and owner" on public.excuses;
drop policy if exists "Create own excuse" on public.excuses;
drop policy if exists "Admin manage excuses" on public.excuses;
drop policy if exists "Owners and managers read excuses" on public.excuses;
drop policy if exists "Members create own pending excuse" on public.excuses;
drop policy if exists "Members cancel own pending excuse" on public.excuses;
drop policy if exists "Worship managers review excuses" on public.excuses;

drop policy if exists "Sub requests readable" on public.substitute_requests;
drop policy if exists "Create sub request" on public.substitute_requests;
drop policy if exists "Manage sub requests" on public.substitute_requests;
drop policy if exists "Participants and managers read substitute requests" on public.substitute_requests;
drop policy if exists "Members create own open substitute request" on public.substitute_requests;
drop policy if exists "Members cancel own open substitute request" on public.substitute_requests;
drop policy if exists "Worship managers resolve substitute requests" on public.substitute_requests;

-- Core data is available only to active members; management stays server-side.
create policy "Profiles are visible to authenticated users"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_member());
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_member())
  with check (id = auth.uid() and public.is_active_member());
create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.is_admin());
create policy "Admins can insert profiles"
  on public.profiles for insert to authenticated
  with check (public.is_admin());

create policy "Songs visible to authenticated users"
  on public.songs for select to authenticated using (public.is_active_member());
create policy "Worship managers can insert songs"
  on public.songs for insert to authenticated
  with check (public.can_manage_worship() and created_by = auth.uid());
create policy "Worship managers can update songs"
  on public.songs for update to authenticated
  using (public.can_manage_worship()) with check (public.can_manage_worship());
create policy "Worship managers can archive songs"
  on public.songs for delete to authenticated using (false);

create policy "Services visible to authenticated users"
  on public.services for select to authenticated using (public.is_active_member());
create policy "Worship managers can create services"
  on public.services for insert to authenticated
  with check (public.can_manage_worship() and created_by = auth.uid());
create policy "Worship managers can update services"
  on public.services for update to authenticated
  using (public.can_manage_worship()) with check (public.can_manage_worship());

create policy "Setlists visible to authenticated users"
  on public.setlist_items for select to authenticated using (public.is_active_member());
create policy "Worship managers can manage setlists"
  on public.setlist_items for all to authenticated
  using (public.can_manage_worship()) with check (public.can_manage_worship());

create policy "Team assignments visible to authenticated users"
  on public.service_team for select to authenticated using (public.is_active_member());
create policy "Worship managers can manage team assignments"
  on public.service_team for all to authenticated
  using (public.can_manage_worship()) with check (public.can_manage_worship());
create policy "Announcements visible to authenticated users"
  on public.announcements for select to authenticated using (public.is_active_member());
create policy "Worship managers can manage announcements"
  on public.announcements for all to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship() and author_id = auth.uid());

create policy "Admins can manage invitations"
  on public.invitations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Active members can read organization settings"
  on public.organization_settings for select to authenticated
  using (public.is_active_member());
create policy "Admins can update organization settings"
  on public.organization_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin() and id = 1);

-- QR-bearing session rows are admin-only. Members resolve one exact QR via RPC.
create policy "Admins read attendance sessions"
  on public.attendance_sessions for select to authenticated using (public.is_admin());
create policy "Admins insert attendance sessions"
  on public.attendance_sessions for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Admins update attendance sessions"
  on public.attendance_sessions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Direct member writes are intentionally absent; check-in/out use the RPCs.
create policy "Members read own attendance records"
  on public.attendance_records for select to authenticated
  using (public.is_active_member() and person_id = auth.uid());
create policy "Admins read all attendance records"
  on public.attendance_records for select to authenticated using (public.is_admin());
create policy "Admins insert attendance records"
  on public.attendance_records for insert to authenticated with check (public.is_admin());
create policy "Admins update attendance records"
  on public.attendance_records for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Active members read events"
  on public.events for select to authenticated using (public.is_active_member());
create policy "Admins create events"
  on public.events for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Admins update events"
  on public.events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Active members read event responses"
  on public.event_responses for select to authenticated using (public.is_active_member());
create policy "Members insert own event response"
  on public.event_responses for insert to authenticated
  with check (public.is_active_member() and person_id = auth.uid());
create policy "Members update own event response"
  on public.event_responses for update to authenticated
  using (public.is_active_member() and person_id = auth.uid())
  with check (public.is_active_member() and person_id = auth.uid());
create policy "Members delete own event response"
  on public.event_responses for delete to authenticated
  using (public.is_active_member() and person_id = auth.uid());

create policy "Owners and managers read excuses"
  on public.excuses for select to authenticated
  using (
    public.is_active_member()
    and (person_id = auth.uid() or public.can_manage_worship())
  );
create policy "Members cancel own pending excuse"
  on public.excuses for update to authenticated
  using (public.is_active_member() and person_id = auth.uid() and status = 'pending')
  with check (public.is_active_member() and person_id = auth.uid() and status = 'cancelled');
create policy "Worship managers review excuses"
  on public.excuses for update to authenticated
  using (public.can_manage_worship()) with check (public.can_manage_worship());

create policy "Participants and managers read substitute requests"
  on public.substitute_requests for select to authenticated
  using (
    public.is_active_member()
    and (
      requester_id = auth.uid()
      or substitute_id = auth.uid()
      or public.can_manage_worship()
    )
  );
create policy "Members create own open substitute request"
  on public.substitute_requests for insert to authenticated
  with check (
    public.is_active_member()
    and requester_id = auth.uid()
    and status = 'open'
    and resolved_by is null
    and resolved_at is null
    and exists (
      select 1 from public.service_team
       where service_id = substitute_requests.service_id
         and person_id = auth.uid()
         and role = substitute_requests.role
    )
  );
create policy "Members cancel own open substitute request"
  on public.substitute_requests for update to authenticated
  using (public.is_active_member() and requester_id = auth.uid() and status = 'open')
  with check (public.is_active_member() and requester_id = auth.uid() and status = 'cancelled');
create policy "Worship managers resolve substitute requests"
  on public.substitute_requests for update to authenticated
  using (public.can_manage_worship()) with check (public.can_manage_worship());

commit;
