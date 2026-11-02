-- ============================================================
-- KDEC WORSHIP PLATFORM — COMPLETE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null default '',
  email         text,
  phone         text default '',
  whatsapp      text default '',
  role          text default 'Vocalist',
  roles         jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(roles) = 'array'),
  position      text default 'Member',
  status        text default 'active' check (status in ('active','inactive','on-leave')),
  is_admin      boolean default false,
  notes         text default '',
  join_date     date default current_date,
  availability  jsonb default '{"sun":false,"mon":false,"tue":false,"wed":false,"thu":false,"fri":false,"sat":false}'::jsonb,
  time_slots    jsonb default '[]'::jsonb,
  tags          text[] default '{}',
  avatar_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. SONGS
-- ============================================================
create table public.songs (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  title_ar        text default '',
  author          text default '',
  key             text default 'G',
  bpm             integer,
  time_signature  text default '4/4',
  language        text default 'en' check (language in ('en','ar','both')),
  themes          text[] default '{}',
  sequence        text[] default '{}',
  notes           text default '',
  ccli_number     text default '',
  arrangements    text[] default '{}',
  usage_count     integer not null default 0,
  last_used       date,
  status          text default 'active' check (status in ('active','inactive')),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create trigger songs_updated_at
  before update on public.songs
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 3. SERVICES
-- ============================================================
create table public.services (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  date                  date not null,
  time                  text default '10:00',
  type                  text default 'Sunday Service',
  status                text default 'scheduled' check (status in ('scheduled','completed','cancelled','draft')),
  event_kind            text not null default 'service' check(event_kind in ('youth_meeting','service','general_meeting','prayer_shift','conference')),
  end_date              date,
  end_time              text,
  location              text not null default '',
  location_url          text not null default '',
  timezone              text not null default 'Africa/Cairo' check(timezone='Africa/Cairo'),
  published_at          timestamptz,
  archived_at           timestamptz,
  notes                 text default '',
  setlist_blocks        jsonb not null default '{}'::jsonb
                          check (jsonb_typeof(setlist_blocks) = 'object'),
  recurrence_group_id   uuid,
  recurrence_frequency  text check (
                          recurrence_frequency is null
                          or recurrence_frequency in ('weekly','biweekly','monthly')
                        ),
  recurrence_index      integer default 0,
  -- Practice session embedded as JSON
  practice              jsonb default null,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.handle_updated_at();

create index services_date_idx on public.services(date);
create index services_recurrence_idx on public.services(recurrence_group_id);
create unique index services_recurrence_position_uidx
  on public.services(recurrence_group_id, recurrence_index)
  where recurrence_group_id is not null and recurrence_index is not null;
create unique index services_recurrence_date_uidx
  on public.services(recurrence_group_id, date)
  where recurrence_group_id is not null;

-- ============================================================
-- 4. SETLIST ITEMS (songs within a service)
-- ============================================================
create table public.setlist_items (
  id          uuid primary key default uuid_generate_v4(),
  service_id  uuid not null references public.services(id) on delete cascade,
  song_id     uuid not null references public.songs(id) on delete restrict,
  key         text,
  notes       text default '',
  sort_order  integer not null default 1,
  created_at  timestamptz default now()
);

create index setlist_service_idx on public.setlist_items(service_id);
create index setlist_song_idx on public.setlist_items(song_id);

-- ============================================================
-- 5. SERVICE TEAM (assignments)
-- ============================================================
create table public.service_team (
  id          uuid primary key default uuid_generate_v4(),
  service_id  uuid not null references public.services(id) on delete cascade,
  person_id   uuid not null references public.profiles(id) on delete cascade,
  role        text not null,
  status      text default 'pending' check (status in ('pending','confirmed','declined')),
  created_at  timestamptz default now(),
  unique(service_id, person_id)
);

create index team_service_idx on public.service_team(service_id);
create index team_person_idx  on public.service_team(person_id);

-- ============================================================
-- 6. ANNOUNCEMENTS
-- ============================================================
create table public.announcements (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  content     text not null,
  priority    text default 'normal' check (priority in ('low','normal','high')),
  author_id   uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- ============================================================
-- 7. INVITATIONS
-- ============================================================
create table public.invitations (
  id            uuid primary key default uuid_generate_v4(),
  code          text not null unique,
  email         text not null,
  role          text default 'Vocalist',
  roles         jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(roles) = 'array'),
  method        text default 'email' check (method in ('email','whatsapp')),
  status        text default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  created_by    uuid references public.profiles(id),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now()
);

-- ============================================================
-- 8. ORGANIZATION SETTINGS (single-row configuration)
-- ============================================================
create table public.organization_settings (
  id                       smallint primary key default 1 check (id = 1),
  name                     text not null default 'Kasr El Doubara Evangelical Church',
  name_ar                  text not null default 'كنيسة قصر الدوبارة الإنجيلية',
  timezone                 text not null default 'Africa/Cairo',
  default_service_type     text not null default 'Sunday Service',
  attendance_late_minutes  smallint not null default 15
                             check (attendance_late_minutes between 0 and 240),
  excuse_limit             smallint not null default 3
                             check (excuse_limit between 0 and 100),
  excuse_period            text not null default 'monthly'
                             check (excuse_period in ('total','monthly','weekly')),
  notification_preferences jsonb not null default
                             '{"reminders":true,"newSongs":true,"teamChanges":false,"events":true}'::jsonb
                             check (jsonb_typeof(notification_preferences) = 'object'),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles(id) on delete set null
);

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

create trigger organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function public.stamp_organization_settings();

insert into public.organization_settings (id) values (1)
on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles      enable row level security;
alter table public.songs         enable row level security;
alter table public.services      enable row level security;
alter table public.setlist_items enable row level security;
alter table public.service_team  enable row level security;
alter table public.announcements enable row level security;
alter table public.invitations   enable row level security;
alter table public.organization_settings enable row level security;

-- Authorization helpers read protected profile fields through the function owner.
create or replace function public.is_active_member()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: check if current user is admin
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
  -- Requests carrying a user JWT must be an active admin. SQL Editor and
  -- service-role maintenance have no auth.uid() and remain available for
  -- initial bootstrap and emergency recovery.
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

create trigger protect_service_team_assignment
  before insert or update or delete on public.service_team
  for each row execute function public.protect_service_team_assignment();

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

revoke all on function public.validate_invitation(text, text) from public;
grant execute on function public.validate_invitation(text, text) to anon, authenticated;

revoke all on function public.is_active_member() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.can_manage_worship() from public;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_worship() to authenticated;

-- PROFILES policies
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

-- SONGS policies
create policy "Songs visible to authenticated users"
  on public.songs for select to authenticated using (public.is_active_member());

create policy "Worship managers can insert songs"
  on public.songs for insert to authenticated
  with check (public.can_manage_worship() and created_by = auth.uid());

create policy "Worship managers can update songs"
  on public.songs for update to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship());

create policy "Worship managers can archive songs"
  on public.songs for delete to authenticated
  using (false);

-- SERVICES policies
create policy "Services visible to authenticated users"
  on public.services for select to authenticated using (public.is_active_member());

create policy "Worship managers can create services"
  on public.services for insert to authenticated
  with check (public.can_manage_worship() and created_by = auth.uid());

create policy "Worship managers can update services"
  on public.services for update to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship());
-- No authenticated DELETE policy: set status = 'cancelled' to retain audit links.

-- SETLIST policies
create policy "Setlists visible to authenticated users"
  on public.setlist_items for select to authenticated using (public.is_active_member());

create policy "Worship managers can manage setlists"
  on public.setlist_items for all to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship());

-- TEAM policies
create policy "Team assignments visible to authenticated users"
  on public.service_team for select to authenticated using (public.is_active_member());

create policy "Worship managers can manage team assignments"
  on public.service_team for all to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship());

-- ANNOUNCEMENTS policies
create policy "Announcements visible to authenticated users"
  on public.announcements for select to authenticated using (public.is_active_member());

create policy "Worship managers can manage announcements"
  on public.announcements for all to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship() and author_id = auth.uid());

-- INVITATIONS policies
create policy "Admins can manage invitations"
  on public.invitations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ORGANIZATION SETTINGS policies
create policy "Active members can read organization settings"
  on public.organization_settings for select to authenticated
  using (public.is_active_member());

create policy "Admins can update organization settings"
  on public.organization_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and id = 1);

-- ============================================================
-- SEED DATA — run after creating your first admin account
-- (Replace 'YOUR-ADMIN-UUID' with your actual user ID from auth.users)
-- ============================================================

-- To seed songs, uncomment and run after auth setup:
/*
insert into public.songs (title, title_ar, author, key, bpm, time_signature, language, sequence, notes, ccli_number, usage_count, last_used) values
  ('Great Is Thy Faithfulness', 'عظيم أمانتك', 'Thomas O. Chisholm', 'D', 72, '3/4', 'en', array['Verse 1','Chorus','Verse 2','Chorus','Bridge','Chorus'], 'Capo 2 on guitar', '18723', 24, '2026-03-30'),
  ('How Great Is Our God', 'كم هو عظيم إلهنا', 'Chris Tomlin', 'G', 76, '4/4', 'en', array['Verse 1','Chorus','Verse 2','Chorus','Bridge','Chorus'], '', '4348399', 31, '2026-04-06'),
  ('يا مالئ كوني', 'يا مالئ كوني', 'KDEC Worship', 'Am', 68, '4/4', 'ar', array['Verse 1','Chorus','Verse 2','Chorus','Bridge'], 'Arabic worship song', '', 18, '2026-04-06'),
  ('Goodness of God', 'صلاح الله', 'Beth Redman', 'C', 70, '4/4', 'en', array['Verse 1','Chorus','Verse 2','Chorus','Bridge','Chorus'], '', '7117726', 15, '2026-03-23'),
  ('Way Maker', 'صانع الطريق', 'Sinach', 'Bb', 74, '4/4', 'en', array['Verse 1','Chorus','Bridge','Tag'], '', '7115744', 27, '2026-04-01'),
  ('أنت تستحق', 'أنت تستحق', 'KDEC Worship', 'G', 66, '4/4', 'ar', array['Verse 1','Chorus','Verse 2','Chorus'], '', '', 9, '2026-03-16'),
  ('Build My Life', 'ابن حياتي', 'Pat Barrett', 'E', 68, '4/4', 'en', array['Verse 1','Pre-Chorus','Chorus','Verse 2','Pre-Chorus','Chorus','Bridge'], '', '7070345', 12, '2026-02-23'),
  ('Oceans', 'محيطات', 'Hillsong United', 'D', 60, '4/4', 'en', array['Verse 1','Chorus','Verse 2','Chorus','Bridge','Chorus'], 'Long bridge', '6428767', 8, '2026-01-19');
*/
-- ============================================================
-- KDEC WORSHIP — SCHEMA ADDITIONS (run after v1)
-- ============================================================

-- ── ATTENDANCE SESSIONS ────────────────────────────────────
-- Each session = a checkin event (practice, soundcheck, meeting, service)
create table if not exists public.attendance_sessions (
  id            uuid primary key default uuid_generate_v4(),
  service_id    uuid references public.services(id) on delete cascade,
  name          text not null default '',
  label         text not null default 'Service',   -- 'Practice', 'Soundcheck', 'Team Meeting', 'Service'
  session_date  date not null default current_date,
  session_time  time,
  end_time      time,
  qr_code       text unique not null,               -- short token embedded in QR
  active        boolean not null default true,
  max_attendees integer check (max_attendees is null or max_attendees > 0),
  repeatable    boolean not null default false,
  repeat_freq   text check (repeat_freq is null or repeat_freq in ('daily','weekly','monthly')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  constraint attendance_session_expiry_check check (expires_at > created_at),
  constraint attendance_session_time_range_check check (end_time is null or session_time is not null),
  constraint attendance_session_repeat_check check (
    (repeatable and repeat_freq is not null)
    or (not repeatable and repeat_freq is null)
  )
);

-- ── ATTENDANCE RECORDS ─────────────────────────────────────
create table if not exists public.attendance_records (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references public.attendance_sessions(id) on delete cascade,
  person_id     uuid not null references public.profiles(id) on delete cascade,
  occurrence_date date not null default current_date,
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  status        text not null default 'present' check (status in ('present','late','absent','excused')),
  excuse_reason text default '',
  created_at    timestamptz not null default now(),
  constraint attendance_record_time_check
    check (check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at)),
  unique(session_id, person_id, occurrence_date)
);

-- ── EVENTS / CONFERENCES ───────────────────────────────────
create table if not exists public.events (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  title_ar      text default '',
  description   text default '',
  description_ar text default '',
  date          date not null,
  end_date      date,
  time          text default '10:00',
  location      text default '',
  type          text default 'Conference',   -- 'Conference','Camp','Workshop','Special','Social'
  cover_image   text default '',
  status        text not null default 'upcoming'
                  check (status in ('upcoming','ongoing','past','cancelled')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  constraint event_date_range_check check (end_date is null or end_date >= date)
);

-- ── EVENT RESPONSES (RSVP / POLL) ─────────────────────────
create table if not exists public.event_responses (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references public.events(id) on delete cascade,
  person_id   uuid not null references public.profiles(id) on delete cascade,
  response    text not null default 'pending' check (response in ('attending','not_attending','maybe','pending')),
  note        text default '',
  responded_at timestamptz default now(),
  unique(event_id, person_id)
);

-- ── EXCUSE REQUESTS ────────────────────────────────────────
create table if not exists public.excuses (
  id          uuid primary key default uuid_generate_v4(),
  service_id  uuid references public.services(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,
  person_id   uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint excuse_exactly_one_target_check
    check (num_nonnulls(service_id, event_id) = 1),
  constraint excuse_reason_length_check
    check (char_length(btrim(reason)) between 3 and 2000)
);

-- ── SUBSTITUTE REQUESTS ────────────────────────────────────
create table if not exists public.substitute_requests (
  id              uuid primary key default uuid_generate_v4(),
  service_id      uuid not null references public.services(id) on delete cascade,
  requester_id    uuid not null references public.profiles(id) on delete cascade,
  substitute_id   uuid references public.profiles(id) on delete set null,   -- chosen sub
  role            text not null,
  status          text not null default 'open' check (status in ('open','filled','cancelled')),
  note            text default '',
  resolved_by     uuid references public.profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint substitute_not_requester_check
    check (substitute_id is null or substitute_id <> requester_id),
  constraint substitute_role_present_check
    check (char_length(btrim(role)) between 1 and 100),
  constraint substitute_note_length_check
    check (char_length(note) <= 2000)
);

-- Query and workflow indexes. Partial unique indexes enforce one currently-open
-- request per member and target while retaining the history of closed requests.
create index attendance_sessions_service_idx
  on public.attendance_sessions(service_id);
create index attendance_sessions_active_expiry_idx
  on public.attendance_sessions(expires_at)
  where active;
create index attendance_records_person_date_idx
  on public.attendance_records(person_id, occurrence_date desc);
create index events_date_idx
  on public.events(date);
create index event_responses_person_idx
  on public.event_responses(person_id);
create index excuses_person_status_idx
  on public.excuses(person_id, status);
create index excuses_service_idx
  on public.excuses(service_id)
  where service_id is not null;
create index excuses_event_idx
  on public.excuses(event_id)
  where event_id is not null;
create unique index excuses_one_pending_service_idx
  on public.excuses(service_id, person_id)
  where status = 'pending' and service_id is not null;
create unique index excuses_one_pending_event_idx
  on public.excuses(event_id, person_id)
  where status = 'pending' and event_id is not null;
create index substitute_requests_requester_status_idx
  on public.substitute_requests(requester_id, status);
create index substitute_requests_substitute_idx
  on public.substitute_requests(substitute_id)
  where substitute_id is not null;
create unique index substitute_one_open_assignment_idx
  on public.substitute_requests(service_id, requester_id, role)
  where status = 'open';
create unique index substitute_one_filled_candidate_idx
  on public.substitute_requests(service_id, substitute_id)
  where status = 'filled' and substitute_id is not null;

-- ── SETLIST NOTES (blocks between songs) ──────────────────
-- Stored as ordered JSON blocks in services.setlist_blocks.

-- ── SERVER-ENFORCED WORKFLOWS ─────────────────────────────

-- Cancelling a service closes every linked attendance entry point in the same
-- transaction. This is SECURITY DEFINER because worship managers may update a
-- service without having direct access to attendance-session QR rows.
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

create trigger maintain_service_song_usage
  after update of date, status on public.services
  for each row
  when (old.date is distinct from new.date or old.status is distinct from new.status)
  execute function public.maintain_service_song_usage();

revoke all on function public.refresh_song_usage(uuid[]) from public;
revoke all on function public.maintain_setlist_song_usage() from public;
revoke all on function public.maintain_service_song_usage() from public;

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

-- Resolve a QR token without exposing the token column, creator information,
-- attendance records, or profile data. Invalid/expired tokens return no row so
-- callers cannot distinguish their failure mode.
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

-- Check-in is serialized on the session row. This makes the capacity check
-- race-safe and makes repeated scans idempotent for the current occurrence.
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
    )
    returning * into v_record;
  end if;

  return v_record;
end;
$$;

-- Check-out is idempotent and only ever touches the caller's newest record for
-- the requested session. Session expiry intentionally does not prevent checkout.
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

-- Request triggers treat client-supplied identity, workflow state, reviewer,
-- resolver, and timestamps as untrusted. SQL Editor/service-role maintenance has
-- no auth.uid() and remains available for recovery and controlled data imports.
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

create trigger guard_event_response
  before insert or update on public.event_responses
  for each row execute function public.guard_event_response();

-- RLS
alter table public.attendance_sessions  enable row level security;
alter table public.attendance_records   enable row level security;
alter table public.events               enable row level security;
alter table public.event_responses      enable row level security;
alter table public.excuses              enable row level security;
alter table public.substitute_requests  enable row level security;

-- Audit-bearing parents and children are soft-deleted/closed only. Revoking the
-- table privilege makes this invariant hold even if a permissive policy is added.
revoke delete on table
  public.services,
  public.events,
  public.attendance_sessions,
  public.attendance_records,
  public.excuses,
  public.substitute_requests
from anon, authenticated;

-- Only administrators can read the base attendance_sessions rows because that
-- table contains live QR secrets. Members resolve one exact token through the
-- narrow get_attendance_session RPC above.
create policy "Admins read attendance sessions"
  on public.attendance_sessions for select to authenticated
  using (public.is_admin());
create policy "Admins insert attendance sessions"
  on public.attendance_sessions for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Admins update attendance sessions"
  on public.attendance_sessions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Member check-in/out writes are only available through the RPCs. This keeps
-- identity, timestamps, capacity, and occurrence boundaries server-controlled.
create policy "Members read own attendance records"
  on public.attendance_records for select to authenticated
  using (public.is_active_member() and person_id = auth.uid());
create policy "Admins read all attendance records"
  on public.attendance_records for select to authenticated
  using (public.is_admin());
create policy "Admins insert attendance records"
  on public.attendance_records for insert to authenticated
  with check (public.is_admin());
create policy "Admins update attendance records"
  on public.attendance_records for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- Events are team-visible; event response identity and timestamps are stamped by
-- the trigger even when a client uses upsert.
create policy "Active members read events"
  on public.events for select to authenticated
  using (public.is_active_member());
create policy "Admins create events"
  on public.events for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Admins update events"
  on public.events for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- No authenticated DELETE policy: set status = 'cancelled'.

create policy "Active members read event responses"
  on public.event_responses for select to authenticated
  using (public.is_active_member());
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

-- Excuses preserve an audit trail: service submissions use the atomic RPC;
-- members can cancel, managers can review, and authenticated clients cannot
-- insert directly or delete.
create policy "Owners and managers read excuses"
  on public.excuses for select to authenticated
  using (
    public.is_active_member()
    and (person_id = auth.uid() or public.can_manage_worship())
  );
create policy "Members cancel own pending excuse"
  on public.excuses for update to authenticated
  using (
    public.is_active_member()
    and person_id = auth.uid()
    and status = 'pending'
  )
  with check (
    public.is_active_member()
    and person_id = auth.uid()
    and status = 'cancelled'
  );
create policy "Worship managers review excuses"
  on public.excuses for update to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship());

-- Substitute requests are visible only to participants and managers. Members can
-- cancel their own open request; assigning/filling a substitute is manager-only.
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
  using (
    public.is_active_member()
    and requester_id = auth.uid()
    and status = 'open'
  )
  with check (
    public.is_active_member()
    and requester_id = auth.uid()
    and status = 'cancelled'
  );
create policy "Worship managers resolve substitute requests"
  on public.substitute_requests for update to authenticated
  using (public.can_manage_worship())
  with check (public.can_manage_worship());

-- IMPORTANT FOR FRESH INSTALLS
-- Apply MIGRATION_dynamic_roles_admin.sql and then MIGRATION_qa_hardening.sql
-- immediately after this base schema.
-- It is kept as a separate transaction so the same reviewed, rerunnable SQL is
-- used for both fresh projects and existing production upgrades without drift.

-- Fixed weekly schedule (also available as an upgrade migration).
-- Run after the existing schema and dynamic roles / QA hardening migrations.
begin;
create table if not exists public.weekly_service_templates (
  key text primary key,
  title text not null,
  title_ar text not null,
  weekday integer not null check (weekday between 0 and 6),
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
insert into public.weekly_service_templates values
  ('youth','Youth Meeting','اجتماع الشباب',5,'18:00'),
  ('prayer','Prayer Meeting','اجتماع الصلاة',2,'19:00'),
  ('friday-morning','Friday Morning Meeting','اجتماع الجمعة الصباحي',5,'11:00'),
  ('house','House Meeting','اجتماع البيت',5,'14:00')
on conflict (key) do nothing;
alter table public.weekly_service_templates enable row level security;
drop policy if exists "Active members read weekly templates" on public.weekly_service_templates;
create policy "Active members read weekly templates" on public.weekly_service_templates
  for select to authenticated using (public.is_active_member());
grant select on public.weekly_service_templates to authenticated;
alter table public.services add column if not exists weekly_template_key text references public.weekly_service_templates(key);
alter table public.services add column if not exists soundcheck_time text
  check (soundcheck_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
create unique index if not exists services_weekly_occurrence_uidx
  on public.services(weekly_template_key, date) where weekly_template_key is not null;

create or replace function public.protect_fixed_weekly_service()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.weekly_template_key is not null and not exists (
      select 1 from public.weekly_service_templates t
      where t.key = new.weekly_template_key and t.title = new.title
        and t.time = new.time and t.weekday = extract(dow from new.date)
        and new.recurrence_group_id is null
    ) then
      raise exception 'Invalid fixed weekly occurrence';
    end if;
    return new;
  end if;
  if old.weekly_template_key is not null and
    (new.weekly_template_key is distinct from old.weekly_template_key
     or new.date is distinct from old.date or new.time is distinct from old.time
     or new.title is distinct from old.title or new.recurrence_group_id is distinct from old.recurrence_group_id) then
    raise exception 'The fixed weekly schedule cannot be changed on an occurrence';
  end if;
  if old.weekly_template_key is null and new.weekly_template_key is not null then
    raise exception 'Extra services cannot be converted into fixed weekly meetings';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_fixed_weekly_service on public.services;
create trigger protect_fixed_weekly_service before insert or update on public.services
  for each row execute function public.protect_fixed_weekly_service();

-- Active members may ensure the server-defined schedule, but cannot supply
-- dates, titles, team assignments or any other write payload to this function.
create or replace function public.ensure_weekly_services() returns void language plpgsql as $$begin return;end;$$;
revoke all on function public.ensure_weekly_services() from public, anon;
grant execute on function public.ensure_weekly_services() to authenticated;

-- Open a selected Friday without duplicating it or resetting its preparation.
create or replace function public.open_youth_meeting(p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_active_member() then
    raise exception 'Active membership required' using errcode = '42501';
  end if;
  if p_date is null or extract(dow from p_date) <> 5 then
    raise exception 'Choose a Friday for Youth Meeting';
  end if;
  select id into v_id from public.services where weekly_template_key = 'youth' and date = p_date;
  if v_id is not null then return v_id; end if;
  if not public.has_permission('services.create') then
    raise exception 'Service creation permission required' using errcode = '42501';
  end if;
  insert into public.services(title,date,time,type,weekly_template_key,created_by)
    values ('Youth Meeting',p_date,'18:00','Weekly Meeting','youth',auth.uid())
    on conflict (weekly_template_key,date) where weekly_template_key is not null do nothing;
  select id into v_id from public.services where weekly_template_key = 'youth' and date = p_date;
  return v_id;
end;
$$;
revoke all on function public.open_youth_meeting(date) from public, anon;
grant execute on function public.open_youth_meeting(date) to authenticated;
commit;
-- Reject rehearsal schedules at or after the service without altering existing rows.
begin;
create or replace function public.validate_rehearsal_schedule()
returns trigger language plpgsql set search_path = public as $$
declare
  rehearsal_date date;
  rehearsal_time time;
begin
  if coalesce(new.practice->>'enabled', 'false') <> 'true' then return new; end if;
  if coalesce(new.practice->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(new.practice->>'time', '') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$'
     or new.date is null
     or coalesce(new.time, '') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' then
    raise exception 'A valid rehearsal and service date and time are required.' using errcode = '23514';
  end if;
  rehearsal_date := (new.practice->>'date')::date;
  rehearsal_time := (new.practice->>'time')::time;
  if rehearsal_date + rehearsal_time >= new.date + new.time::time then
    raise exception 'Rehearsal must start before the service.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_rehearsal_schedule on public.services;
create trigger validate_rehearsal_schedule
before insert or update of practice, date, time on public.services
for each row execute function public.validate_rehearsal_schedule();
commit;

-- Fresh installations must also apply the documented dynamic-role, quarterly and
-- unified-calendar migrations for RPCs and RLS. Cleanup is an existing-data opt-in.

-- BEGIN attendance/custom-events feature schema (apply feature migration LAST after calendar upgrades).
-- Apply AFTER MIGRATION_unified_calendar.sql. No real-account tests or notifications.
begin;
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
-- The series wrapper is installed by the final feature migration after unified-calendar
-- has preserved the original recurrence function under its legacy name.

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

-- BEGIN web-push feature schema
-- Reapply MIGRATION_web_push.sql LAST after the prerequisite calendar upgrades
-- to activate the triggers. Keep this block identical to that migration.
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

-- BEGIN ministry feature prerequisites
-- Fresh projects need no separate historical workflow migrations.
-- Bundled fresh-install prerequisite: MIGRATION_dynamic_roles_admin.sql
-- KDEC Worship: dynamic worship roles, explicit system access levels,
-- granular permissions, safe legacy migration, and admin audit history.
-- Existing text role columns remain as historical/read-compatible snapshots.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.role_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_categories_name_length check (char_length(trim(name)) between 1 and 80),
  constraint role_categories_slug_length check (char_length(trim(slug)) between 1 and 100)
);
create unique index if not exists role_categories_name_uidx on public.role_categories(lower(trim(name)));
create unique index if not exists role_categories_slug_uidx on public.role_categories(lower(trim(slug)));

create table if not exists public.worship_roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null,
  category_id uuid references public.role_categories(id) on delete restrict,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worship_roles_name_length check (char_length(trim(name)) between 1 and 100),
  constraint worship_roles_slug_length check (char_length(trim(slug)) between 1 and 120)
);
create unique index if not exists worship_roles_name_uidx on public.worship_roles(lower(trim(name)));
create unique index if not exists worship_roles_slug_uidx on public.worship_roles(lower(trim(slug)));
create index if not exists worship_roles_order_idx on public.worship_roles(active desc, display_order, name);

create table if not exists public.profile_worship_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.worship_roles(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key(profile_id,role_id)
);
create unique index if not exists profile_worship_roles_primary_uidx
  on public.profile_worship_roles(profile_id) where is_primary;
create index if not exists profile_worship_roles_role_idx on public.profile_worship_roles(role_id,profile_id);

create table if not exists public.invitation_worship_roles (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  role_id uuid not null references public.worship_roles(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(invitation_id,role_id)
);
create unique index if not exists invitation_worship_roles_primary_uidx
  on public.invitation_worship_roles(invitation_id) where is_primary;

alter table public.profiles add column if not exists access_level text not null default 'member';
alter table public.profiles add column if not exists last_active_at timestamptz;
alter table public.invitations add column if not exists access_level text not null default 'member';
alter table public.service_team add column if not exists worship_role_id uuid references public.worship_roles(id) on delete restrict;
alter table public.substitute_requests add column if not exists worship_role_id uuid references public.worship_roles(id) on delete restrict;

alter table public.profiles drop constraint if exists profiles_access_level_check;
alter table public.profiles add constraint profiles_access_level_check
  check (access_level in ('super_admin','admin','leader','member'));
alter table public.invitations drop constraint if exists invitations_access_level_check;
alter table public.invitations add constraint invitations_access_level_check
  check (access_level in ('admin','leader','member'));

create table if not exists public.system_permissions (
  permission_key text primary key,
  category text not null,
  description text not null,
  display_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.access_level_permissions (
  access_level text not null check (access_level in ('admin','leader','member')),
  permission_key text not null references public.system_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key(access_level,permission_key)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  entity_type text not null,
  entity_id text,
  actor_id uuid references public.profiles(id) on delete set null,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type,entity_id);

create table if not exists public.app_migration_markers (
  migration_key text primary key,
  applied_at timestamptz not null default now()
);

drop trigger if exists role_categories_updated_at on public.role_categories;
create trigger role_categories_updated_at before update on public.role_categories
  for each row execute function public.handle_updated_at();
drop trigger if exists worship_roles_updated_at on public.worship_roles;
create trigger worship_roles_updated_at before update on public.worship_roles
  for each row execute function public.handle_updated_at();

insert into public.role_categories(name,slug,description,display_order) values
  ('Leadership','leadership','Worship and service leadership roles',10),
  ('Vocals','vocals','Singing and choir roles',20),
  ('Instruments','instruments','Musician and instrument roles',30),
  ('Technical','technical','Sound, media, projection, and production roles',40),
  ('Other','other','Other ministry roles',50)
on conflict do nothing;

with defaults(name,slug,category_slug,display_order) as (values
  ('Worship Leader','worship-leader','leadership',10),
  ('Music Director','music-director','leadership',20),
  ('Service Leader','service-leader','leadership',30),
  ('Vocalist','vocalist','vocals',40),
  ('Vocal','vocal','vocals',50),
  ('Background Vocal','background-vocal','vocals',60),
  ('Choir','choir','vocals',70),
  ('Pianist/Keys','pianist-keys','instruments',80),
  ('Piano','piano','instruments',90),
  ('Keyboard','keyboard','instruments',100),
  ('Acoustic Guitar','acoustic-guitar','instruments',110),
  ('Electric Guitar','electric-guitar','instruments',120),
  ('Bass Guitar','bass-guitar','instruments',130),
  ('Drummer','drummer','instruments',140),
  ('Percussion','percussion','instruments',150),
  ('Violin','violin','instruments',160),
  ('Cello','cello','instruments',170),
  ('Saxophone','saxophone','instruments',180),
  ('AUX Instrument','aux-instrument','instruments',190),
  ('Sound Engineer','sound-engineer','technical',200),
  ('Projection','projection','technical',210),
  ('Media','media','technical',220),
  ('Lyrics','lyrics','technical',230),
  ('Lighting','lighting','technical',240),
  ('Camera','camera','technical',250)
)
insert into public.worship_roles(name,slug,category_id,display_order)
select d.name,d.slug,c.id,d.display_order from defaults d join public.role_categories c on c.slug=d.category_slug
on conflict do nothing;

-- Import every distinct legacy role string before creating mappings.
with legacy_names as (
  select trim(role) name from public.profiles where nullif(trim(role),'') is not null
  union select trim(value) from public.profiles cross join lateral jsonb_array_elements_text(coalesce(roles,'[]'::jsonb)) where nullif(trim(value),'') is not null
  union select trim(role) from public.invitations where nullif(trim(role),'') is not null
  union select trim(value) from public.invitations cross join lateral jsonb_array_elements_text(coalesce(roles,'[]'::jsonb)) where nullif(trim(value),'') is not null
  union select trim(role) from public.service_team where nullif(trim(role),'') is not null
  union select trim(role) from public.substitute_requests where nullif(trim(role),'') is not null
)
insert into public.worship_roles(name,slug,category_id,display_order)
select name,
       'legacy-'||coalesce(nullif(trim(both '-' from lower(regexp_replace(name,'[^[:alnum:]]+','-','g'))),''),'role')||'-'||substr(md5(name),1,12),
       (select id from public.role_categories where slug='other'),
       1000 + row_number() over(order by lower(name))
from legacy_names
where not exists(select 1 from public.worship_roles r where lower(trim(r.name))=lower(trim(legacy_names.name)))
on conflict do nothing;

do $$
declare v_first_super uuid;
begin
  -- Preserve legacy operational access exactly once. Worship roles are never
  -- consulted for authorization again after this migration marker is written.
  if not exists(select 1 from public.app_migration_markers where migration_key='dynamic-roles-access-v1') then
    update public.profiles set access_level='admin' where is_admin and access_level='member';
    update public.profiles set access_level='leader'
     where access_level='member' and (
       lower(coalesce(role,'')) in ('worship leader','music director')
       or exists(select 1 from jsonb_array_elements_text(coalesce(roles,'[]'::jsonb)) value where lower(value) in ('worship leader','music director'))
     );
    if not exists(select 1 from public.profiles where access_level='super_admin' and status='active') then
      select id into v_first_super from public.profiles
       where is_admin and status='active' order by created_at,id limit 1;
      if v_first_super is not null then update public.profiles set access_level='super_admin' where id=v_first_super; end if;
    end if;
    insert into public.app_migration_markers(migration_key) values('dynamic-roles-access-v1');
  end if;
end $$;
update public.profiles set is_admin=(access_level in ('super_admin','admin'));

with source_roles as (
  select p.id profile_id,trim(value) role_name,p.role primary_name
    from public.profiles p
    cross join lateral jsonb_array_elements_text(
      case when jsonb_array_length(coalesce(p.roles,'[]'::jsonb))>0 then p.roles
           when nullif(trim(p.role),'') is not null then jsonb_build_array(p.role) else '[]'::jsonb end
    ) value
)
insert into public.profile_worship_roles(profile_id,role_id,is_primary)
select source.profile_id,role.id,lower(trim(source.role_name))=lower(trim(source.primary_name))
from source_roles source join public.worship_roles role on lower(trim(role.name))=lower(trim(source.role_name))
on conflict(profile_id,role_id) do nothing;

-- Ensure every mapped profile has exactly one primary role.
with first_role as (
  select profile_id,min(role_id::text)::uuid role_id from public.profile_worship_roles
  where profile_id not in (select profile_id from public.profile_worship_roles where is_primary)
  group by profile_id
)
update public.profile_worship_roles mapping set is_primary=true
from first_role where mapping.profile_id=first_role.profile_id and mapping.role_id=first_role.role_id;

with source_roles as (
  select invitation.id invitation_id,trim(value) role_name,invitation.role primary_name
  from public.invitations invitation
  cross join lateral jsonb_array_elements_text(
    case when jsonb_array_length(coalesce(invitation.roles,'[]'::jsonb))>0 then invitation.roles
         when nullif(trim(invitation.role),'') is not null then jsonb_build_array(invitation.role) else '[]'::jsonb end
  ) value
)
insert into public.invitation_worship_roles(invitation_id,role_id,is_primary)
select source.invitation_id,role.id,lower(trim(source.role_name))=lower(trim(source.primary_name))
from source_roles source join public.worship_roles role on lower(trim(role.name))=lower(trim(source.role_name))
on conflict(invitation_id,role_id) do nothing;

update public.service_team assignment set worship_role_id=role.id
from public.worship_roles role
where assignment.worship_role_id is null and lower(trim(assignment.role))=lower(trim(role.name));
update public.substitute_requests request set worship_role_id=role.id
from public.worship_roles role
where request.worship_role_id is null and lower(trim(request.role))=lower(trim(role.name));

insert into public.system_permissions(permission_key,category,description,display_order) values
  ('users.view','Users','View team members',10),('users.create','Users','Create or invite team members',20),
  ('users.edit','Users','Edit team members and access levels',30),('users.delete','Users','Deactivate team members',40),
  ('roles.manage','Roles','Manage worship roles and categories',50),('permissions.manage','Security','Change access-level permissions',60),
  ('services.view','Services','View services and assignments',70),('services.create','Services','Create services',80),
  ('services.edit','Services','Edit services and assignments',90),('services.delete','Services','Cancel services',100),
  ('songs.manage','Songs','Manage the song library',110),('schedules.manage','Schedule','Manage schedules',120),
  ('events.manage','Events','Manage events',130),('announcements.manage','Communication','Manage announcements',140),
  ('invitations.manage','Invitations','Create, renew, and cancel invitations',150),('reports.view','Reports','View and export reports',160),
  ('settings.manage','Settings','Manage organization settings and view audit history',170)
on conflict(permission_key) do update set category=excluded.category,description=excluded.description,display_order=excluded.display_order;

insert into public.access_level_permissions(access_level,permission_key)
select 'admin',permission_key from public.system_permissions where permission_key<>'permissions.manage'
on conflict do nothing;
insert into public.access_level_permissions(access_level,permission_key)
select 'leader',permission_key from public.system_permissions
where permission_key in ('users.view','services.view','services.create','services.edit','songs.manage','schedules.manage','events.manage','announcements.manage')
on conflict do nothing;
insert into public.access_level_permissions(access_level,permission_key)
values('member','services.view') on conflict do nothing;

create or replace function public.get_access_level()
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select access_level from public.profiles where id=auth.uid() and status='active'),'anonymous');
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.get_access_level()='super_admin';
$$;
create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select case public.get_access_level()
    when 'super_admin' then true
    when 'anonymous' then false
    else exists(select 1 from public.access_level_permissions where access_level=public.get_access_level() and permission_key=p_permission)
  end;
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.get_access_level() in ('super_admin','admin');
$$;
create or replace function public.can_manage_worship()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_permission('services.edit');
$$;

create or replace function public.log_admin_action(p_action text,p_entity_type text,p_entity_id text,p_old jsonb,p_new jsonb,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into public.admin_audit_logs(action,entity_type,entity_id,actor_id,old_value,new_value,metadata)
  values(p_action,p_entity_type,p_entity_id,auth.uid(),p_old,p_new,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

-- Keep legacy text/json columns synchronized for older reports and routines
-- while role IDs remain the authoritative relationship.
create or replace function public.refresh_profile_role_snapshot(p_profile_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_names text[]; v_primary text;
begin
  select array_agg(role.name order by mapping.is_primary desc,role.display_order,role.name)
    into v_names
  from public.profile_worship_roles mapping
  join public.worship_roles role on role.id=mapping.role_id
  where mapping.profile_id=p_profile_id;
  v_primary:=v_names[1];
  if coalesce(cardinality(v_names),0)>0 then
    perform set_config('app.admin_user_update','1',true);
    update public.profiles set role=v_primary,roles=to_jsonb(v_names) where id=p_profile_id;
  end if;
end $$;

create or replace function public.refresh_invitation_role_snapshot(p_invitation_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_names text[]; v_primary text;
begin
  select array_agg(role.name order by mapping.is_primary desc,role.display_order,role.name)
    into v_names
  from public.invitation_worship_roles mapping
  join public.worship_roles role on role.id=mapping.role_id
  where mapping.invitation_id=p_invitation_id;
  v_primary:=v_names[1];
  if coalesce(cardinality(v_names),0)>0 then
    update public.invitations set role=v_primary,roles=to_jsonb(v_names) where id=p_invitation_id;
  end if;
end $$;

create or replace function public.admin_save_role(
  p_role_id uuid,p_name text,p_category_id uuid,p_description text,p_display_order integer,p_active boolean
) returns public.worship_roles language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.worship_roles; v_saved public.worship_roles; v_slug text; v_profile_id uuid; v_invitation_id uuid;
begin
  if not public.has_permission('roles.manage') then raise exception 'You do not have permission to manage roles' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Role name is required' using errcode='22023'; end if;
  if exists(select 1 from public.worship_roles where lower(trim(name))=lower(trim(p_name)) and id is distinct from p_role_id) then
    raise exception 'A role with this name already exists' using errcode='23505';
  end if;
  if not exists(select 1 from public.role_categories where id=p_category_id) then raise exception 'Choose a valid category'; end if;
  v_slug:=trim(both '-' from lower(regexp_replace(trim(p_name),'[^[:alnum:]]+','-','g')));
  if v_slug='' then v_slug:='role-'||substr(uuid_generate_v4()::text,1,8); end if;
  if exists(select 1 from public.worship_roles where slug=v_slug and id is distinct from p_role_id) then
    v_slug:=v_slug||'-'||substr(md5(lower(trim(p_name))),1,8);
  end if;
  if p_role_id is null then
    insert into public.worship_roles(name,slug,category_id,description,display_order,active,archived_at,created_by)
    values(trim(p_name),v_slug,p_category_id,coalesce(p_description,''),coalesce(p_display_order,0),coalesce(p_active,true),case when p_active then null else now() end,auth.uid())
    returning * into v_saved;
    perform public.log_admin_action('role.created','worship_role',v_saved.id::text,null,to_jsonb(v_saved));
  else
    select * into v_old from public.worship_roles where id=p_role_id for update;
    if not found then raise exception 'Role not found'; end if;
    update public.worship_roles set name=trim(p_name),slug=v_slug,category_id=p_category_id,description=coalesce(p_description,''),display_order=coalesce(p_display_order,display_order),active=coalesce(p_active,active),archived_at=case when coalesce(p_active,active) then null else coalesce(archived_at,now()) end
    where id=p_role_id returning * into v_saved;
    if v_saved.name is distinct from v_old.name then
      for v_profile_id in select profile_id from public.profile_worship_roles where role_id=v_saved.id loop
        perform public.refresh_profile_role_snapshot(v_profile_id);
      end loop;
      for v_invitation_id in select invitation_id from public.invitation_worship_roles where role_id=v_saved.id loop
        perform public.refresh_invitation_role_snapshot(v_invitation_id);
      end loop;
      update public.service_team set role=v_saved.name where worship_role_id=v_saved.id;
      update public.substitute_requests set role=v_saved.name where worship_role_id=v_saved.id;
    end if;
    perform public.log_admin_action('role.updated','worship_role',v_saved.id::text,to_jsonb(v_old),to_jsonb(v_saved));
  end if;
  return v_saved;
end $$;

create or replace function public.admin_save_role_category(p_category_id uuid,p_name text,p_description text,p_display_order integer,p_active boolean)
returns public.role_categories language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.role_categories; v_saved public.role_categories; v_slug text;
begin
  if not public.has_permission('roles.manage') then raise exception 'You do not have permission to manage role categories' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Category name is required'; end if;
  if exists(select 1 from public.role_categories where lower(trim(name))=lower(trim(p_name)) and id is distinct from p_category_id) then raise exception 'A category with this name already exists' using errcode='23505'; end if;
  v_slug:=trim(both '-' from lower(regexp_replace(trim(p_name),'[^[:alnum:]]+','-','g')));
  if v_slug='' then v_slug:='category-'||substr(uuid_generate_v4()::text,1,8); end if;
  if exists(select 1 from public.role_categories where slug=v_slug and id is distinct from p_category_id) then
    v_slug:=v_slug||'-'||substr(md5(lower(trim(p_name))),1,8);
  end if;
  if p_category_id is null then
    insert into public.role_categories(name,slug,description,display_order,active) values(trim(p_name),v_slug,coalesce(p_description,''),coalesce(p_display_order,0),coalesce(p_active,true)) returning * into v_saved;
    perform public.log_admin_action('role_category.created','role_category',v_saved.id::text,null,to_jsonb(v_saved));
  else
    select * into v_old from public.role_categories where id=p_category_id for update;
    if not found then raise exception 'Category not found'; end if;
    update public.role_categories set name=trim(p_name),slug=v_slug,description=coalesce(p_description,''),display_order=coalesce(p_display_order,display_order),active=coalesce(p_active,active) where id=p_category_id returning * into v_saved;
    perform public.log_admin_action('role_category.updated','role_category',v_saved.id::text,to_jsonb(v_old),to_jsonb(v_saved));
  end if;
  return v_saved;
end $$;

create or replace function public.get_worship_role_usage()
returns table(role_id uuid,profile_count bigint,assignment_count bigint,invitation_count bigint,request_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  select r.id,
    (select count(*) from public.profile_worship_roles p where p.role_id=r.id),
    (select count(*) from public.service_team s where s.worship_role_id=r.id),
    (select count(*) from public.invitation_worship_roles i where i.role_id=r.id),
    (select count(*) from public.substitute_requests q where q.worship_role_id=r.id)
  from public.worship_roles r where public.has_permission('roles.manage');
$$;

create or replace function public.admin_set_role_status(p_role_id uuid,p_active boolean,p_replacement_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.worship_roles; v_replacement public.worship_roles; v_usage jsonb; v_profile_id uuid; v_invitation_id uuid;
begin
  if not public.has_permission('roles.manage') then raise exception 'You do not have permission to manage roles' using errcode='42501'; end if;
  select * into v_old from public.worship_roles where id=p_role_id for update;
  if not found then raise exception 'Role not found'; end if;
  select jsonb_build_object('profiles',profile_count,'assignments',assignment_count,'invitations',invitation_count,'requests',request_count)
    into v_usage from public.get_worship_role_usage() where role_id=p_role_id;
  if p_replacement_id is not null then
    if p_replacement_id=p_role_id then raise exception 'Replacement role must be different'; end if;
    select * into v_replacement from public.worship_roles where id=p_replacement_id and active;
    if not found then raise exception 'Choose an active replacement role'; end if;
    with moved as (
      delete from public.profile_worship_roles where role_id=p_role_id returning profile_id,is_primary
    )
    insert into public.profile_worship_roles(profile_id,role_id,is_primary,created_by)
      select profile_id,p_replacement_id,is_primary,auth.uid() from moved
      on conflict(profile_id,role_id) do update set is_primary=excluded.is_primary or public.profile_worship_roles.is_primary;
    with moved as (
      delete from public.invitation_worship_roles where role_id=p_role_id returning invitation_id,is_primary
    )
    insert into public.invitation_worship_roles(invitation_id,role_id,is_primary)
      select invitation_id,p_replacement_id,is_primary from moved
      on conflict(invitation_id,role_id) do update set is_primary=excluded.is_primary or public.invitation_worship_roles.is_primary;
    update public.substitute_requests set worship_role_id=p_replacement_id,role=v_replacement.name where worship_role_id=p_role_id and status='open';
    for v_profile_id in select profile_id from public.profile_worship_roles where role_id=p_replacement_id loop
      perform public.refresh_profile_role_snapshot(v_profile_id);
    end loop;
    for v_invitation_id in select invitation_id from public.invitation_worship_roles where role_id=p_replacement_id loop
      perform public.refresh_invitation_role_snapshot(v_invitation_id);
    end loop;
  end if;
  update public.worship_roles set active=p_active,archived_at=case when p_active then null else coalesce(archived_at,now()) end where id=p_role_id;
  perform public.log_admin_action(case when p_active then 'role.enabled' else 'role.disabled' end,'worship_role',p_role_id::text,to_jsonb(v_old),(select to_jsonb(r) from public.worship_roles r where id=p_role_id),jsonb_build_object('usage',v_usage,'replacementId',p_replacement_id));
  return coalesce(v_usage,'{}'::jsonb)||jsonb_build_object('active',p_active,'replacementId',p_replacement_id);
end $$;

create or replace function public.admin_reorder_roles(p_role_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.has_permission('roles.manage') then raise exception 'You do not have permission to reorder roles' using errcode='42501'; end if;
  if cardinality(p_role_ids)<>(select count(*) from public.worship_roles) then raise exception 'The reorder list must contain every role exactly once'; end if;
  if cardinality(p_role_ids)<>(select count(distinct selected.role_id) from unnest(p_role_ids) as selected(role_id)) then raise exception 'Duplicate role in reorder list'; end if;
  update public.worship_roles role set display_order=ordered.position*10 from unnest(p_role_ids) with ordinality ordered(role_id,position) where role.id=ordered.role_id;
  perform public.log_admin_action('roles.reordered','worship_role',null,null,to_jsonb(p_role_ids));
end $$;

create or replace function public.admin_update_user(
  p_user_id uuid,p_name text,p_phone text,p_whatsapp text,p_notes text,p_status text,
  p_access_level text,p_role_ids uuid[],p_primary_role_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.profiles; v_names text[]; v_primary_name text; v_new jsonb;
begin
  if not public.has_permission('users.edit') then raise exception 'You do not have permission to edit users' using errcode='42501'; end if;
  select * into v_old from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  if p_status not in ('active','inactive','on-leave') then raise exception 'Invalid account status'; end if;
  if p_access_level not in ('super_admin','admin','leader','member') then raise exception 'Invalid access level'; end if;
  if (v_old.access_level in ('super_admin','admin') or p_access_level in ('super_admin','admin')) and not public.is_super_admin() then raise exception 'Only a Super Admin can manage administrator access' using errcode='42501'; end if;
  if p_user_id=auth.uid() and p_status<>'active' then raise exception 'You cannot deactivate your signed-in account'; end if;
  if v_old.access_level='super_admin' and v_old.status='active' and (p_access_level<>'super_admin' or p_status<>'active') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kdec:active-super-admins',0));
    if not exists(select 1 from public.profiles where id<>p_user_id and access_level='super_admin' and status='active') then raise exception 'The final active Super Admin cannot be demoted or deactivated' using errcode='23514'; end if;
  end if;
  if coalesce(cardinality(p_role_ids),0)=0 then raise exception 'Select at least one worship role'; end if;
  if p_primary_role_id is null or not (p_primary_role_id=any(p_role_ids)) then raise exception 'Choose a primary role from the selected roles'; end if;
  if exists(
    select 1 from unnest(p_role_ids) as selected(role_id)
    left join public.worship_roles role on role.id=selected.role_id
    where role.id is null
       or (not role.active and not exists(
         select 1 from public.profile_worship_roles existing
         where existing.profile_id=p_user_id and existing.role_id=selected.role_id
       ))
  ) then raise exception 'New assignments require active roles'; end if;
  select array_agg(role.name order by mapping.position),max(role.name) filter(where role.id=p_primary_role_id)
    into v_names,v_primary_name from unnest(p_role_ids) with ordinality mapping(role_id,position) join public.worship_roles role on role.id=mapping.role_id;
  perform set_config('app.admin_user_update','1',true);
  update public.profiles set name=trim(p_name),phone=coalesce(p_phone,''),whatsapp=coalesce(p_whatsapp,''),notes=coalesce(p_notes,''),status=p_status,access_level=p_access_level,is_admin=(p_access_level in ('super_admin','admin')),position=case p_access_level when 'super_admin' then 'Admin' when 'admin' then 'Admin' when 'leader' then 'Leader' else 'Member' end,role=v_primary_name,roles=to_jsonb(v_names) where id=p_user_id;
  delete from public.profile_worship_roles where profile_id=p_user_id;
  insert into public.profile_worship_roles(profile_id,role_id,is_primary,created_by)
    select p_user_id,selected.role_id,selected.role_id=p_primary_role_id,auth.uid()
    from unnest(p_role_ids) as selected(role_id);
  select to_jsonb(p) into v_new from public.profiles p where id=p_user_id;
  perform public.log_admin_action('user.updated','profile',p_user_id::text,to_jsonb(v_old)-'notes',v_new-'notes');
  return v_new;
end $$;

create or replace function public.admin_create_invitation(
  p_email text,p_role_ids uuid[],p_primary_role_id uuid,p_access_level text,p_method text,p_code text
) returns public.invitations language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invitation public.invitations; v_names text[]; v_primary_name text;
begin
  if not public.has_permission('invitations.manage') then raise exception 'You do not have permission to create invitations' using errcode='42501'; end if;
  if p_access_level not in ('admin','leader','member') then raise exception 'Invalid invited access level'; end if;
  if p_access_level='admin' and not public.is_super_admin() then raise exception 'Only a Super Admin can invite another Admin' using errcode='42501'; end if;
  if nullif(trim(p_email),'') is null or position('@' in p_email)=0 then raise exception 'Enter a valid email address'; end if;
  if coalesce(cardinality(p_role_ids),0)=0 or p_primary_role_id is null or not(p_primary_role_id=any(p_role_ids)) then raise exception 'Select roles and a primary role'; end if;
  if exists(select 1 from unnest(p_role_ids) as selected(role_id) left join public.worship_roles role on role.id=selected.role_id where role.id is null or not role.active) then raise exception 'Invitations require active roles'; end if;
  select array_agg(role.name order by mapping.position),max(role.name) filter(where role.id=p_primary_role_id) into v_names,v_primary_name from unnest(p_role_ids) with ordinality mapping(role_id,position) join public.worship_roles role on role.id=mapping.role_id;
  insert into public.invitations(code,email,role,roles,method,status,created_by,expires_at,access_level)
  values(p_code,lower(trim(p_email)),v_primary_name,to_jsonb(v_names),p_method,'pending',auth.uid(),now()+interval '7 days',p_access_level) returning * into v_invitation;
  insert into public.invitation_worship_roles(invitation_id,role_id,is_primary)
    select v_invitation.id,selected.role_id,selected.role_id=p_primary_role_id
    from unnest(p_role_ids) as selected(role_id);
  perform public.log_admin_action('invitation.created','invitation',v_invitation.id::text,null,to_jsonb(v_invitation)-'code');
  return v_invitation;
end $$;

create or replace function public.admin_renew_invitation(p_invitation_id uuid)
returns public.invitations language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.invitations; v_new public.invitations;
begin
  if not public.has_permission('invitations.manage') then raise exception 'You do not have permission to renew invitations' using errcode='42501'; end if;
  select * into v_old from public.invitations where id=p_invitation_id for update;
  if not found or v_old.status='accepted' then raise exception 'Only unaccepted invitations can be renewed'; end if;
  update public.invitations set status='pending',expires_at=now()+interval '7 days' where id=p_invitation_id returning * into v_new;
  perform public.log_admin_action('invitation.renewed','invitation',p_invitation_id::text,to_jsonb(v_old)-'code',to_jsonb(v_new)-'code');
  return v_new;
end $$;

create or replace function public.admin_cancel_invitation(p_invitation_id uuid)
returns public.invitations language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.invitations; v_new public.invitations;
begin
  if not public.has_permission('invitations.manage') then raise exception 'You do not have permission to cancel invitations' using errcode='42501'; end if;
  select * into v_old from public.invitations where id=p_invitation_id for update;
  if not found or v_old.status<>'pending' then raise exception 'Only pending invitations can be cancelled'; end if;
  update public.invitations set status='cancelled' where id=p_invitation_id returning * into v_new;
  perform public.log_admin_action('invitation.cancelled','invitation',p_invitation_id::text,to_jsonb(v_old)-'code',to_jsonb(v_new)-'code');
  return v_new;
end $$;

create or replace function public.admin_set_access_permissions(p_access_level text,p_permission_keys text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old jsonb;
begin
  if not public.is_super_admin() then raise exception 'Only a Super Admin can change the permission matrix' using errcode='42501'; end if;
  if p_access_level not in ('admin','leader','member') then raise exception 'Invalid access level'; end if;
  if exists(select 1 from unnest(p_permission_keys) as selected(permission_key) left join public.system_permissions permission on permission.permission_key=selected.permission_key where permission.permission_key is null) then raise exception 'Unknown permission key'; end if;
  select coalesce(jsonb_agg(permission_key order by permission_key),'[]'::jsonb) into v_old from public.access_level_permissions where access_level=p_access_level;
  delete from public.access_level_permissions where access_level=p_access_level;
  insert into public.access_level_permissions(access_level,permission_key,created_by)
    select p_access_level,selected.permission_key,auth.uid()
    from unnest(p_permission_keys) as selected(permission_key);
  perform public.log_admin_action('permissions.updated','access_level',p_access_level,v_old,to_jsonb(p_permission_keys));
end $$;

create or replace function public.record_user_activity()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin update public.profiles set last_active_at=now() where id=auth.uid(); end $$;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.admin_user_update',true),'')<>'1' and (
    new.is_admin is distinct from old.is_admin or new.role is distinct from old.role or new.roles is distinct from old.roles
    or new.position is distinct from old.position or new.status is distinct from old.status or new.access_level is distinct from old.access_level
    or new.join_date is distinct from old.join_date or new.created_at is distinct from old.created_at
  ) then raise exception 'Authorization fields must be changed through the protected admin workflow' using errcode='42501'; end if;
  return new;
end $$;
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields before update on public.profiles for each row execute function public.protect_profile_security_fields();

create or replace function public.sync_assignment_role_snapshot()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role public.worship_roles;
begin
  if new.worship_role_id is null and nullif(trim(new.role),'') is not null then select * into v_role from public.worship_roles where lower(trim(name))=lower(trim(new.role));
  else select * into v_role from public.worship_roles where id=new.worship_role_id; end if;
  if v_role.id is null then raise exception 'Choose a valid worship role'; end if;
  if (tg_op='INSERT' or new.worship_role_id is distinct from old.worship_role_id) and not v_role.active then raise exception 'Inactive roles cannot be used for new assignments'; end if;
  new.worship_role_id:=v_role.id; new.role:=v_role.name; return new;
end $$;
drop trigger if exists sync_service_team_role on public.service_team;
create trigger sync_service_team_role before insert or update of worship_role_id,role on public.service_team for each row execute function public.sync_assignment_role_snapshot();
drop trigger if exists sync_substitute_request_role on public.substitute_requests;
create trigger sync_substitute_request_role before insert or update of worship_role_id,role on public.substitute_requests for each row execute function public.sync_assignment_role_snapshot();

-- Invitation redemption now transfers role IDs and explicit system access.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invitation public.invitations; v_code text:=nullif(new.raw_user_meta_data->>'invite_code','');
begin
  if v_code is not null then
    select * into v_invitation from public.invitations where code=v_code and lower(email)=lower(new.email) and status='pending' and expires_at>now() for update;
  end if;
  insert into public.profiles(id,email,name,role,roles,status,access_level,is_admin,position)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),coalesce(v_invitation.role,'Vocalist'),coalesce(v_invitation.roles,'["Vocalist"]'::jsonb),case when v_invitation.id is null then 'inactive' else 'active' end,coalesce(v_invitation.access_level,'member'),coalesce(v_invitation.access_level in ('admin','super_admin'),false),case coalesce(v_invitation.access_level,'member') when 'admin' then 'Admin' when 'leader' then 'Leader' else 'Member' end);
  if v_invitation.id is not null then
    insert into public.profile_worship_roles(profile_id,role_id,is_primary,created_by) select new.id,role_id,is_primary,v_invitation.created_by from public.invitation_worship_roles where invitation_id=v_invitation.id;
    update public.invitations set status='accepted',accepted_at=now(),accepted_by=new.id where id=v_invitation.id;
    perform public.log_admin_action('invitation.accepted','invitation',v_invitation.id::text,null,jsonb_build_object('acceptedBy',new.id));
  end if;
  return new;
end $$;

alter table public.role_categories enable row level security;
alter table public.worship_roles enable row level security;
alter table public.profile_worship_roles enable row level security;
alter table public.invitation_worship_roles enable row level security;
alter table public.system_permissions enable row level security;
alter table public.access_level_permissions enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.app_migration_markers enable row level security;

drop policy if exists "Members read role categories" on public.role_categories;
create policy "Members read role categories" on public.role_categories for select to authenticated using(public.is_active_member());
drop policy if exists "Members read worship roles" on public.worship_roles;
create policy "Members read worship roles" on public.worship_roles for select to authenticated using(public.is_active_member());
drop policy if exists "Members read profile roles" on public.profile_worship_roles;
create policy "Members read profile roles" on public.profile_worship_roles for select to authenticated using(public.is_active_member());
drop policy if exists "Admins read invitation roles" on public.invitation_worship_roles;
create policy "Admins read invitation roles" on public.invitation_worship_roles for select to authenticated using(public.has_permission('invitations.manage'));
drop policy if exists "Members read permission definitions" on public.system_permissions;
create policy "Members read permission definitions" on public.system_permissions for select to authenticated using(public.is_active_member());
drop policy if exists "Members read permission matrix" on public.access_level_permissions;
create policy "Members read permission matrix" on public.access_level_permissions for select to authenticated using(public.is_active_member());
drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
create policy "Admins read audit logs" on public.admin_audit_logs for select to authenticated using(public.has_permission('settings.manage'));

drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Authorized users can update profiles" on public.profiles;
create policy "Authorized users can update profiles" on public.profiles for update to authenticated
  using(id=auth.uid() or public.has_permission('users.edit')) with check(id=auth.uid() or public.has_permission('users.edit'));
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Authorized users can insert profiles" on public.profiles;
create policy "Authorized users can insert profiles" on public.profiles for insert to authenticated with check(public.has_permission('users.create'));
drop policy if exists "Admins can manage invitations" on public.invitations;
drop policy if exists "Authorized users can manage invitations" on public.invitations;
create policy "Authorized users can manage invitations" on public.invitations for all to authenticated
  using(public.has_permission('invitations.manage')) with check(public.has_permission('invitations.manage'));
drop policy if exists "Admins can update organization settings" on public.organization_settings;
drop policy if exists "Authorized users can update organization settings" on public.organization_settings;
create policy "Authorized users can update organization settings" on public.organization_settings for update to authenticated
  using(public.has_permission('settings.manage')) with check(public.has_permission('settings.manage') and id=1);

-- Replace legacy broad manager policies with workflow-specific permissions.
drop policy if exists "Worship managers can insert songs" on public.songs;
drop policy if exists "Authorized users can insert songs" on public.songs;
create policy "Authorized users can insert songs" on public.songs for insert to authenticated
  with check(public.has_permission('songs.manage') and created_by=auth.uid());
drop policy if exists "Worship managers can update songs" on public.songs;
drop policy if exists "Authorized users can update songs" on public.songs;
create policy "Authorized users can update songs" on public.songs for update to authenticated
  using(public.has_permission('songs.manage')) with check(public.has_permission('songs.manage'));
drop policy if exists "Worship managers can create services" on public.services;
drop policy if exists "Authorized users can create services" on public.services;
create policy "Authorized users can create services" on public.services for insert to authenticated
  with check(public.has_permission('services.create') and created_by=auth.uid());
drop policy if exists "Worship managers can update services" on public.services;
drop policy if exists "Authorized users can update services" on public.services;
create policy "Authorized users can update services" on public.services for update to authenticated
  using(public.has_permission('services.edit')) with check(public.has_permission('services.edit'));
drop policy if exists "Worship managers can manage setlists" on public.setlist_items;
drop policy if exists "Authorized users can manage setlists" on public.setlist_items;
create policy "Authorized users can manage setlists" on public.setlist_items for all to authenticated
  using(public.has_permission('services.edit')) with check(public.has_permission('services.edit'));
drop policy if exists "Worship managers can manage team assignments" on public.service_team;
drop policy if exists "Authorized users can manage team assignments" on public.service_team;
create policy "Authorized users can manage team assignments" on public.service_team for all to authenticated
  using(public.has_permission('services.edit') or public.has_permission('schedules.manage'))
  with check(public.has_permission('services.edit') or public.has_permission('schedules.manage'));
drop policy if exists "Worship managers can manage announcements" on public.announcements;
drop policy if exists "Authorized users can manage announcements" on public.announcements;
create policy "Authorized users can manage announcements" on public.announcements for all to authenticated
  using(public.has_permission('announcements.manage'))
  with check(public.has_permission('announcements.manage') and author_id=auth.uid());
drop policy if exists "Admins create events" on public.events;
drop policy if exists "Authorized users can create events" on public.events;
create policy "Authorized users can create events" on public.events for insert to authenticated
  with check(public.has_permission('events.manage') and created_by=auth.uid());
drop policy if exists "Admins update events" on public.events;
drop policy if exists "Authorized users can update events" on public.events;
create policy "Authorized users can update events" on public.events for update to authenticated
  using(public.has_permission('events.manage')) with check(public.has_permission('events.manage'));
drop policy if exists "Admins read attendance sessions" on public.attendance_sessions;
drop policy if exists "Authorized users read attendance sessions" on public.attendance_sessions;
create policy "Authorized users read attendance sessions" on public.attendance_sessions for select to authenticated
  using(public.has_permission('reports.view') or public.has_permission('services.edit'));
drop policy if exists "Admins insert attendance sessions" on public.attendance_sessions;
drop policy if exists "Authorized users insert attendance sessions" on public.attendance_sessions;
create policy "Authorized users insert attendance sessions" on public.attendance_sessions for insert to authenticated
  with check(public.has_permission('services.edit') and created_by=auth.uid());
drop policy if exists "Admins update attendance sessions" on public.attendance_sessions;
drop policy if exists "Authorized users update attendance sessions" on public.attendance_sessions;
create policy "Authorized users update attendance sessions" on public.attendance_sessions for update to authenticated
  using(public.has_permission('services.edit')) with check(public.has_permission('services.edit'));
drop policy if exists "Admins read all attendance records" on public.attendance_records;
drop policy if exists "Authorized users read attendance records" on public.attendance_records;
create policy "Authorized users read attendance records" on public.attendance_records for select to authenticated
  using(public.has_permission('reports.view'));
drop policy if exists "Admins insert attendance records" on public.attendance_records;
drop policy if exists "Authorized users insert attendance records" on public.attendance_records;
create policy "Authorized users insert attendance records" on public.attendance_records for insert to authenticated
  with check(public.has_permission('services.edit'));
drop policy if exists "Admins update attendance records" on public.attendance_records;
drop policy if exists "Authorized users update attendance records" on public.attendance_records;
create policy "Authorized users update attendance records" on public.attendance_records for update to authenticated
  using(public.has_permission('services.edit')) with check(public.has_permission('services.edit'));
drop policy if exists "Worship managers review excuses" on public.excuses;
drop policy if exists "Authorized users review excuses" on public.excuses;
create policy "Authorized users review excuses" on public.excuses for update to authenticated
  using(public.has_permission('services.edit')) with check(public.has_permission('services.edit'));
drop policy if exists "Worship managers resolve substitute requests" on public.substitute_requests;
drop policy if exists "Authorized users resolve substitute requests" on public.substitute_requests;
create policy "Authorized users resolve substitute requests" on public.substitute_requests for update to authenticated
  using(public.has_permission('services.edit')) with check(public.has_permission('services.edit'));

revoke all on function public.get_access_level() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.log_admin_action(text,text,text,jsonb,jsonb,jsonb) from public;
revoke all on function public.refresh_profile_role_snapshot(uuid) from public;
revoke all on function public.refresh_invitation_role_snapshot(uuid) from public;
revoke all on function public.admin_save_role(uuid,text,uuid,text,integer,boolean) from public;
revoke all on function public.admin_save_role_category(uuid,text,text,integer,boolean) from public;
revoke all on function public.get_worship_role_usage() from public;
revoke all on function public.admin_set_role_status(uuid,boolean,uuid) from public;
revoke all on function public.admin_reorder_roles(uuid[]) from public;
revoke all on function public.admin_update_user(uuid,text,text,text,text,text,text,uuid[],uuid) from public;
revoke all on function public.admin_create_invitation(text,uuid[],uuid,text,text,text) from public;
revoke all on function public.admin_renew_invitation(uuid) from public;
revoke all on function public.admin_cancel_invitation(uuid) from public;
revoke all on function public.admin_set_access_permissions(text,text[]) from public;
revoke all on function public.record_user_activity() from public;
grant execute on function public.get_access_level() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.admin_save_role(uuid,text,uuid,text,integer,boolean) to authenticated;
grant execute on function public.admin_save_role_category(uuid,text,text,integer,boolean) to authenticated;
grant execute on function public.get_worship_role_usage() to authenticated;
grant execute on function public.admin_set_role_status(uuid,boolean,uuid) to authenticated;
grant execute on function public.admin_reorder_roles(uuid[]) to authenticated;
grant execute on function public.admin_update_user(uuid,text,text,text,text,text,text,uuid[],uuid) to authenticated;
grant execute on function public.admin_create_invitation(text,uuid[],uuid,text,text,text) to authenticated;
grant execute on function public.admin_renew_invitation(uuid) to authenticated;
grant execute on function public.admin_cancel_invitation(uuid) to authenticated;
grant execute on function public.admin_set_access_permissions(text,text[]) to authenticated;
grant execute on function public.record_user_activity() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Bundled fresh-install prerequisite: MIGRATION_qa_hardening.sql
-- KDEC Worship — QA hardening upgrade
-- Apply after MIGRATION_dynamic_roles_admin.sql.

begin;

-- Full profile rows contain contact details and authorization metadata. Ordinary
-- members can read only their own row; users.view grants directory management.
drop policy if exists "Profiles are visible to authenticated users" on public.profiles;
drop policy if exists "Profiles readable by owner or authorized users" on public.profiles;
create policy "Profiles readable by owner or authorized users"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('users.view'));

-- Non-privileged workflows still need names and worship roles for assignments.
-- This RPC deliberately omits email, phone, WhatsApp, notes, availability,
-- access level, admin flags, activity timestamps, and other private fields.
create or replace function public.get_member_directory()
returns table (
  id uuid,
  name text,
  avatar_url text,
  role text,
  roles jsonb,
  "position" text,
  status text
)
language sql stable security definer
set search_path=public,pg_temp as $$
  select profile.id,
         profile.name,
         profile.avatar_url,
         profile.role,
         profile.roles,
         case when profile.position='Leader' then 'Leader' else 'Member' end,
         profile.status
    from public.profiles as profile
   where public.is_active_member()
     and profile.status='active'
   order by profile.name;
$$;
revoke all on function public.get_member_directory() from public;
grant execute on function public.get_member_directory() to authenticated;

-- Required user-facing names must contain a non-whitespace character. NOT
-- VALID keeps the migration deployable if old bad rows exist while enforcing
-- the rule for every new or changed row immediately.
alter table public.songs drop constraint if exists songs_title_not_blank;
alter table public.songs add constraint songs_title_not_blank check (title ~ '\S') not valid;
alter table public.services drop constraint if exists services_title_not_blank;
alter table public.services add constraint services_title_not_blank check (title ~ '\S') not valid;
alter table public.events drop constraint if exists events_title_not_blank;
alter table public.events add constraint events_title_not_blank check (title ~ '\S') not valid;
alter table public.announcements drop constraint if exists announcements_title_not_blank;
alter table public.announcements add constraint announcements_title_not_blank check (title ~ '\S') not valid;
alter table public.announcements drop constraint if exists announcements_content_not_blank;
alter table public.announcements add constraint announcements_content_not_blank check (content ~ '\S') not valid;
alter table public.invitations drop constraint if exists invitations_email_format_check;
alter table public.invitations add constraint invitations_email_format_check
  check (lower(trim(email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') not valid;

-- Invitation creation validates and normalizes email at the trusted boundary.
create or replace function public.admin_create_invitation(
  p_email text,p_role_ids uuid[],p_primary_role_id uuid,p_access_level text,p_method text,p_code text
) returns public.invitations language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invitation public.invitations; v_names text[]; v_primary_name text; v_email text;
begin
  if not public.has_permission('invitations.manage') then raise exception 'You do not have permission to create invitations' using errcode='42501'; end if;
  if p_access_level not in ('admin','leader','member') then raise exception 'Invalid invited access level'; end if;
  if p_access_level='admin' and not public.is_super_admin() then raise exception 'Only a Super Admin can invite another Admin' using errcode='42501'; end if;
  v_email=lower(trim(p_email));
  if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if exists(select 1 from public.invitations where lower(email)=v_email and status='pending' and expires_at>now()) then raise exception 'A pending invitation already exists for this email'; end if;
  if coalesce(cardinality(p_role_ids),0)=0 or p_primary_role_id is null or not(p_primary_role_id=any(p_role_ids)) then raise exception 'Select roles and a primary role'; end if;
  if exists(select 1 from unnest(p_role_ids) as selected(role_id) left join public.worship_roles role on role.id=selected.role_id where role.id is null or not role.active) then raise exception 'Invitations require active roles'; end if;
  select array_agg(role.name order by mapping.role_order),max(role.name) filter(where role.id=p_primary_role_id) into v_names,v_primary_name from unnest(p_role_ids) with ordinality mapping(role_id,role_order) join public.worship_roles role on role.id=mapping.role_id;
  insert into public.invitations(code,email,role,roles,method,status,created_by,expires_at,access_level)
  values(p_code,v_email,v_primary_name,to_jsonb(v_names),p_method,'pending',auth.uid(),now()+interval '7 days',p_access_level) returning * into v_invitation;
  insert into public.invitation_worship_roles(invitation_id,role_id,is_primary)
    select v_invitation.id,selected.role_id,selected.role_id=p_primary_role_id
    from unnest(p_role_ids) as selected(role_id);
  perform public.log_admin_action('invitation.created','invitation',v_invitation.id::text,null,to_jsonb(v_invitation)-'code');
  return v_invitation;
end $$;

-- Derive one-time QR expiry from the organization's timezone and reject a
-- session whose usable window has already ended. Repeatable QR codes are valid
-- across occurrences and are intentionally exempt from the past anchor check.
create or replace function public.guard_attendance_session_schedule()
returns trigger language plpgsql
set search_path=public,pg_temp as $$
declare
  v_timezone text;
  v_end_date date;
  v_expiry timestamptz;
begin
  if new.session_date is null or new.session_time is null or new.end_time is null then
    raise exception 'Session date, start time, and end time are required';
  end if;
  if new.repeatable then return new; end if;
  select coalesce(settings.timezone,'Africa/Cairo') into v_timezone
    from public.organization_settings as settings where settings.id=1;
  v_timezone=coalesce(v_timezone,'Africa/Cairo');
  v_end_date=new.session_date + case when new.end_time<=new.session_time then 1 else 0 end;
  v_expiry=((v_end_date+new.end_time) at time zone v_timezone)+interval '6 hours';
  if v_expiry<=now() then
    raise exception 'This attendance session has already ended. Choose a future date or make it repeatable';
  end if;
  new.expires_at=v_expiry;
  return new;
end $$;

drop trigger if exists attendance_session_schedule_guard on public.attendance_sessions;
create trigger attendance_session_schedule_guard
  before insert or update of session_date,session_time,end_time,repeatable
  on public.attendance_sessions
  for each row execute function public.guard_attendance_session_schedule();

notify pgrst, 'reload schema';

commit;

-- Bundled fresh-install prerequisite: MIGRATION_song_bulk_management.sql
-- KDEC Worship: bulk song imports, multilingual lyrics, Pro Chord charts,
-- private chart storage, and import audit history.
-- Safe for the existing live project: existing song rows and IDs are preserved.

begin;

-- Existing installations only accepted en/ar/both. Add the future-safe "other"
-- value without changing stored rows.
alter table public.songs drop constraint if exists songs_language_check;
alter table public.songs
  add constraint songs_language_check check (language in ('en','ar','both','other'));
alter table public.songs drop constraint if exists songs_bpm_range_check;
alter table public.songs add constraint songs_bpm_range_check
  check (bpm is null or bpm between 20 and 300) not valid;
alter table public.songs drop constraint if exists songs_time_signature_format_check;
alter table public.songs add constraint songs_time_signature_format_check
  check (time_signature ~ '^[0-9]{1,2}/[0-9]{1,2}$') not valid;
alter table public.songs drop constraint if exists songs_key_supported_check;
alter table public.songs add constraint songs_key_supported_check check (
  key = any(array['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dbm','Dm','D#m','Ebm','Em','Fm','F#m','Gbm','Gm','G#m','Abm','Am','A#m','Bbm','Bm'])
) not valid;

create table if not exists public.song_lyrics (
  id          uuid primary key default uuid_generate_v4(),
  song_id     uuid not null references public.songs(id) on delete cascade,
  language    text not null default 'other' check (language in ('en','ar','both','other')),
  content     text not null default '',
  sections    jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  is_primary  boolean not null default false,
  version     integer not null default 1 check (version > 0),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists song_lyrics_primary_uidx
  on public.song_lyrics(song_id) where is_primary;
create index if not exists song_lyrics_song_idx on public.song_lyrics(song_id, language);
create index if not exists song_lyrics_search_idx
  on public.song_lyrics using gin (to_tsvector('simple', content));

drop trigger if exists song_lyrics_updated_at on public.song_lyrics;
create trigger song_lyrics_updated_at
  before update on public.song_lyrics
  for each row execute function public.handle_updated_at();

create table if not exists public.song_charts (
  id                uuid primary key default uuid_generate_v4(),
  song_id           uuid not null references public.songs(id) on delete cascade,
  arrangement_name  text not null default 'Original',
  chart_key         text not null default '',
  chart_type        text not null check (chart_type in ('pdf','chordpro','txt','docx','image','other')),
  notes             text not null default '',
  is_inline         boolean not null default false,
  is_primary        boolean not null default false,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists song_charts_primary_uidx
  on public.song_charts(song_id) where is_primary;
alter table public.song_charts add column if not exists is_inline boolean not null default false;
create unique index if not exists song_charts_inline_uidx
  on public.song_charts(song_id) where is_inline;
create index if not exists song_charts_song_idx on public.song_charts(song_id, created_at desc);

drop trigger if exists song_charts_updated_at on public.song_charts;
create trigger song_charts_updated_at
  before update on public.song_charts
  for each row execute function public.handle_updated_at();

create table if not exists public.song_chart_versions (
  id                 uuid primary key default uuid_generate_v4(),
  chart_id           uuid not null references public.song_charts(id) on delete cascade,
  version            integer not null check (version > 0),
  storage_path       text unique,
  original_filename text not null,
  mime_type          text not null default 'application/octet-stream',
  file_size          bigint not null default 0 check (file_size >= 0 and file_size <= 20971520),
  raw_content        text,
  parsed_data        jsonb,
  uploaded_by        uuid references public.profiles(id),
  uploaded_at        timestamptz not null default now(),
  unique(chart_id, version),
  constraint song_chart_storage_path_check check (
    storage_path is null or (
      storage_path like 'songs/%'
      and storage_path not like '%..%'
    )
  )
);

alter table public.song_chart_versions alter column storage_path drop not null;
alter table public.song_chart_versions drop constraint if exists song_chart_storage_path_check;
alter table public.song_chart_versions add constraint song_chart_storage_path_check check (
  storage_path is null or (
    storage_path like 'songs/%'
    and storage_path not like '%..%'
  )
);

create index if not exists song_chart_versions_chart_idx
  on public.song_chart_versions(chart_id, version desc);

create table if not exists public.song_import_batches (
  id             uuid primary key default uuid_generate_v4(),
  import_type    text not null check (import_type in ('songs_csv','songs_xlsx','songs_paste','charts')),
  source_name    text not null default '',
  status         text not null default 'processing' check (status in ('processing','completed','completed_with_errors','failed')),
  total_items    integer not null default 0 check (total_items >= 0),
  created_count  integer not null default 0 check (created_count >= 0),
  updated_count  integer not null default 0 check (updated_count >= 0),
  skipped_count  integer not null default 0 check (skipped_count >= 0),
  error_count    integer not null default 0 check (error_count >= 0),
  chart_count    integer not null default 0 check (chart_count >= 0),
  failed_matches integer not null default 0 check (failed_matches >= 0),
  summary        jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists song_import_batches_created_idx
  on public.song_import_batches(created_at desc);

create table if not exists public.song_import_items (
  id            uuid primary key default uuid_generate_v4(),
  batch_id      uuid not null references public.song_import_batches(id) on delete cascade,
  source_index  integer,
  source_name   text not null default '',
  action        text not null default 'skip' check (action in ('create','create_new','update','skip','upload')),
  status        text not null check (status in ('created','updated','uploaded','skipped','error')),
  song_id       uuid references public.songs(id) on delete set null,
  chart_id      uuid references public.song_charts(id) on delete set null,
  error_message text not null default '',
  details       jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at    timestamptz not null default now()
);

create index if not exists song_import_items_batch_idx
  on public.song_import_items(batch_id, source_index);

alter table public.song_lyrics          enable row level security;
alter table public.song_charts          enable row level security;
alter table public.song_chart_versions enable row level security;
alter table public.song_import_batches  enable row level security;
alter table public.song_import_items    enable row level security;

drop policy if exists "Members read song lyrics" on public.song_lyrics;
drop policy if exists "Admins manage song lyrics" on public.song_lyrics;
create policy "Members read song lyrics" on public.song_lyrics for select to authenticated
  using (public.is_active_member());
-- Lyrics are written only through the audited song-save and bulk-import RPCs.

drop policy if exists "Members read song charts" on public.song_charts;
drop policy if exists "Admins manage song charts" on public.song_charts;
drop policy if exists "Admins delete song charts" on public.song_charts;
create policy "Members read song charts" on public.song_charts for select to authenticated
  using (public.is_active_member());
create policy "Admins delete song charts" on public.song_charts for delete to authenticated
  using (public.has_permission('songs.manage'));

drop policy if exists "Members read song chart versions" on public.song_chart_versions;
drop policy if exists "Admins manage song chart versions" on public.song_chart_versions;
create policy "Members read song chart versions" on public.song_chart_versions for select to authenticated
  using (public.is_active_member());
-- Chart versions are registered only through register_song_chart; deleting a
-- chart cascades its version rows after the client removes the storage objects.

drop policy if exists "Admins read song import batches" on public.song_import_batches;
drop policy if exists "Admins create song import batches" on public.song_import_batches;
drop policy if exists "Admins update song import batches" on public.song_import_batches;
create policy "Admins read song import batches" on public.song_import_batches for select to authenticated
  using (public.has_permission('songs.manage'));
-- Import batches are created and finalized only through audited RPCs.

drop policy if exists "Admins read song import items" on public.song_import_items;
drop policy if exists "Admins create song import items" on public.song_import_items;
create policy "Admins read song import items" on public.song_import_items for select to authenticated
  using (public.has_permission('songs.manage'));
-- Import items are server-authored by the RPCs below.

-- Shared transactional writer for the primary lyrics and the manually entered
-- Pro Chords sheet. Empty text removes that content; null leaves it unchanged.
create or replace function public.upsert_song_text_content(
  p_song_id uuid,
  p_language text,
  p_lyrics text,
  p_lyrics_sections jsonb,
  p_pro_chords text,
  p_chart_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lyrics_id uuid;
  v_chart_id uuid;
  v_version integer;
begin
  if p_song_id is null or not exists(select 1 from public.songs where id=p_song_id) then
    raise exception 'Song not found' using errcode='P0002';
  end if;
  if p_language not in ('en','ar','both','other') then
    raise exception 'Unsupported song language' using errcode='22023';
  end if;
  if p_lyrics_sections is not null and jsonb_typeof(p_lyrics_sections) <> 'array' then
    raise exception 'Lyrics sections must be an array' using errcode='22023';
  end if;
  if p_lyrics is not null and char_length(p_lyrics) > 2000000 then
    raise exception 'Lyrics are limited to 2,000,000 characters' using errcode='22023';
  end if;
  if p_pro_chords is not null and char_length(p_pro_chords) > 2000000 then
    raise exception 'Pro Chords are limited to 2,000,000 characters' using errcode='22023';
  end if;

  if p_lyrics is not null then
    if btrim(p_lyrics) = '' then
      delete from public.song_lyrics where song_id=p_song_id;
    else
      update public.song_lyrics set is_primary=false where song_id=p_song_id and is_primary;
      select id into v_lyrics_id
        from public.song_lyrics
       where song_id=p_song_id and language=p_language
       order by updated_at desc limit 1
       for update;
      if v_lyrics_id is null then
        insert into public.song_lyrics(song_id,language,content,sections,is_primary,created_by)
        values(p_song_id,p_language,p_lyrics,coalesce(p_lyrics_sections,'[]'::jsonb),true,auth.uid());
      else
        update public.song_lyrics
           set content=p_lyrics,sections=coalesce(p_lyrics_sections,'[]'::jsonb),is_primary=true,version=version+1
         where id=v_lyrics_id;
      end if;
    end if;
  end if;

  if p_pro_chords is not null then
    select id into v_chart_id
      from public.song_charts
     where song_id=p_song_id and is_inline
     limit 1 for update;
    if btrim(p_pro_chords) = '' then
      if v_chart_id is not null then delete from public.song_charts where id=v_chart_id; end if;
    else
      if v_chart_id is null then
        insert into public.song_charts(song_id,arrangement_name,chart_key,chart_type,notes,is_inline,is_primary,created_by)
        values(
          p_song_id,'Manual chords',coalesce(p_chart_key,''),'txt','',true,
          not exists(select 1 from public.song_charts where song_id=p_song_id and is_primary),auth.uid()
        ) returning id into v_chart_id;
        v_version:=1;
      else
        update public.song_charts set chart_key=coalesce(p_chart_key,''),chart_type='txt' where id=v_chart_id;
        select coalesce(max(version),0)+1 into v_version from public.song_chart_versions where chart_id=v_chart_id;
      end if;
      insert into public.song_chart_versions(
        chart_id,version,storage_path,original_filename,mime_type,file_size,raw_content,parsed_data,uploaded_by
      ) values (
        v_chart_id,v_version,null,'manual-chords.txt','text/plain;charset=utf-8',octet_length(p_pro_chords),p_pro_chords,null,auth.uid()
      );
    end if;
  end if;
end;
$$;

-- One atomic save for basic song information, lyrics, and manually entered
-- chords. The client never reports success after only part of a song saved.
drop function if exists public.save_song_library_entry(uuid,text,text,text,text,integer,text,text,text[],text,text,text,jsonb,text);
create or replace function public.save_song_library_entry(
  p_song_id uuid,
  p_title text,
  p_title_ar text,
  p_author text,
  p_key text,
  p_bpm integer,
  p_time_signature text,
  p_language text,
  p_themes text[],
  p_sequence text[],
  p_notes text,
  p_ccli_number text,
  p_lyrics text,
  p_lyrics_sections jsonb,
  p_pro_chords text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_song_id uuid;
  v_user uuid:=auth.uid();
  v_old jsonb;
  v_title text:=btrim(coalesce(p_title,''));
  v_title_ar text:=btrim(coalesce(p_title_ar,''));
begin
  if v_user is null or not public.has_permission('songs.manage') then
    raise exception 'You do not have permission to manage songs' using errcode='42501';
  end if;
  if v_title='' and v_title_ar='' then raise exception 'Song title is required' using errcode='22023'; end if;
  if coalesce(p_key,'') <> all(array['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Cm','C#m','Dbm','Dm','D#m','Ebm','Em','Fm','F#m','Gbm','Gm','G#m','Abm','Am','A#m','Bbm','Bm']) then
    raise exception 'Choose a valid musical key' using errcode='22023';
  end if;
  if p_bpm is not null and (p_bpm<20 or p_bpm>300) then raise exception 'BPM must be between 20 and 300' using errcode='22023'; end if;
  if coalesce(p_time_signature,'') !~ '^[0-9]{1,2}/[0-9]{1,2}$' then raise exception 'Invalid time signature' using errcode='22023'; end if;
  if p_language not in ('en','ar','both') then raise exception 'Unsupported song language' using errcode='22023'; end if;

  if p_song_id is null then
    insert into public.songs(title,title_ar,author,key,bpm,time_signature,language,themes,sequence,notes,ccli_number,usage_count,status,created_by)
    values(
      coalesce(nullif(v_title,''),v_title_ar),v_title_ar,btrim(coalesce(p_author,'')),p_key,p_bpm,p_time_signature,p_language,
      coalesce(p_themes,'{}'::text[]),case when jsonb_array_length(coalesce(p_lyrics_sections,'[]'::jsonb))>0
        then array(select section->>'label' from jsonb_array_elements(p_lyrics_sections) section where coalesce(section->>'label','')<>'')
        else coalesce(p_sequence,'{}'::text[]) end,
      coalesce(p_notes,''),btrim(coalesce(p_ccli_number,'')),0,'active',v_user
    ) returning id into v_song_id;
  else
    select to_jsonb(song) into v_old from public.songs song where song.id=p_song_id for update;
    if v_old is null then raise exception 'Song not found' using errcode='P0002'; end if;
    update public.songs set
      title=coalesce(nullif(v_title,''),v_title_ar),title_ar=v_title_ar,author=btrim(coalesce(p_author,'')),key=p_key,bpm=p_bpm,
      time_signature=p_time_signature,language=p_language,themes=coalesce(p_themes,'{}'::text[]),
      sequence=case when jsonb_array_length(coalesce(p_lyrics_sections,'[]'::jsonb))>0
        then array(select section->>'label' from jsonb_array_elements(p_lyrics_sections) section where coalesce(section->>'label','')<>'')
        else coalesce(p_sequence,'{}'::text[]) end,
      notes=coalesce(p_notes,''),ccli_number=btrim(coalesce(p_ccli_number,'')),status='active'
    where id=p_song_id;
    v_song_id:=p_song_id;
  end if;

  perform public.upsert_song_text_content(v_song_id,p_language,p_lyrics,coalesce(p_lyrics_sections,'[]'::jsonb),p_pro_chords,p_key);
  perform public.log_admin_action(case when p_song_id is null then 'song.created' else 'song.updated' end,'song',v_song_id::text,v_old,(select to_jsonb(song) from public.songs song where song.id=v_song_id));
  return v_song_id;
end;
$$;

create or replace function public.bulk_import_songs(
  p_items jsonb,
  p_source_name text default '',
  p_import_type text default 'songs_csv'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_batch_id uuid;
  v_item jsonb;
  v_song_id uuid;
  v_action text;
  v_title text;
  v_language text;
  v_source_index integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  v_total integer := 0;
begin
  if v_user is null or not public.has_permission('songs.manage') then
    raise exception 'You do not have permission to bulk import songs' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Import items must be a JSON array' using errcode = '22023';
  end if;
  if p_import_type not in ('songs_csv','songs_xlsx','songs_paste') then
    raise exception 'Unsupported song import type' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 1000 then
    raise exception 'A single import is limited to 1000 rows' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_items);
  insert into public.song_import_batches (import_type, source_name, total_items, created_by)
  values (p_import_type, left(coalesce(p_source_name,''), 240), v_total, v_user)
  returning id into v_batch_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_action := coalesce(nullif(v_item->>'action',''), 'skip');
    v_title := trim(coalesce(v_item->>'title',''));
    v_source_index := null;
    v_song_id := null;
    begin
      v_source_index := nullif(v_item->>'sourceRow','')::integer;
      if jsonb_typeof(v_item->'errors') = 'array' and jsonb_array_length(v_item->'errors') > 0 then
        raise exception '%', coalesce(v_item->'errors'->>0, 'Invalid import row') using errcode = '22023';
      end if;
      if v_action = 'skip' then
        v_skipped := v_skipped + 1;
        insert into public.song_import_items (batch_id, source_index, source_name, action, status, song_id, details)
        values (v_batch_id, v_source_index, v_title, 'skip', 'skipped', nullif(v_item->>'matchedSongId','')::uuid, jsonb_build_object('reason',coalesce(v_item->>'matchReason','')));
        continue;
      end if;
      if v_title = '' then
        raise exception 'Missing song title' using errcode = '22023';
      end if;
      if v_action not in ('create','create_new','update') then
        raise exception 'Unsupported import action: %', v_action using errcode = '22023';
      end if;

      v_language := coalesce(nullif(v_item->>'language',''), 'other');
      if v_language not in ('en','ar','both','other') then
        raise exception 'Unsupported language: %', v_language using errcode = '22023';
      end if;

      if v_action = 'update' then
        v_song_id := nullif(v_item->>'matchedSongId','')::uuid;
        if v_song_id is null then raise exception 'Select an existing song to update'; end if;
        update public.songs as target
           set title = coalesce(nullif(v_item->>'title',''), target.title),
               title_ar = case
                 when nullif(v_item->>'arabicTitle','') is not null then v_item->>'arabicTitle'
                 when v_language = 'ar' and target.title_ar = '' then v_title
                 else target.title_ar
               end,
               author = coalesce(nullif(v_item->>'artist',''), target.author),
               key = coalesce(nullif(v_item->>'key',''), target.key),
               bpm = coalesce(nullif(v_item->>'bpm','')::integer, target.bpm),
               time_signature = coalesce(nullif(v_item->>'timeSignature',''), target.time_signature),
               language = v_language,
               themes = case when jsonb_array_length(coalesce(v_item->'tags','[]'::jsonb)) > 0
                         then array(select jsonb_array_elements_text(v_item->'tags')) else target.themes end,
               notes = coalesce(nullif(v_item->>'notes',''), target.notes),
               ccli_number = coalesce(nullif(v_item->>'ccliNumber',''), target.ccli_number),
               status = 'active'
         where target.id = v_song_id;
        if not found then raise exception 'The selected song no longer exists'; end if;
      else
        insert into public.songs (
          title, title_ar, author, key, bpm, time_signature, language,
          themes, sequence, notes, ccli_number, usage_count, status, created_by
        ) values (
          v_title,
          case when nullif(v_item->>'arabicTitle','') is not null then v_item->>'arabicTitle' when v_language='ar' then v_title else '' end,
          coalesce(v_item->>'artist',''), coalesce(nullif(v_item->>'key',''),'G'),
          nullif(v_item->>'bpm','')::integer, coalesce(nullif(v_item->>'timeSignature',''),'4/4'), v_language,
          array(select jsonb_array_elements_text(coalesce(v_item->'tags','[]'::jsonb))),
          array(select section->>'label' from jsonb_array_elements(coalesce(v_item->'lyricSections','[]'::jsonb)) section where section->>'label' <> ''),
          coalesce(v_item->>'notes',''), coalesce(v_item->>'ccliNumber',''), 0, 'active', v_user
        ) returning id into v_song_id;
      end if;

      perform public.upsert_song_text_content(
        v_song_id,v_language,
        case when btrim(coalesce(v_item->>'lyrics',''))<>'' then v_item->>'lyrics' else null end,
        coalesce(v_item->'lyricSections','[]'::jsonb),
        case when btrim(coalesce(v_item->>'proChords',''))<>'' then v_item->>'proChords' else null end,
        coalesce(nullif(v_item->>'key',''),'G')
      );
      if v_action='update' then v_updated:=v_updated+1; else v_created:=v_created+1; end if;

      insert into public.song_import_items (batch_id, source_index, source_name, action, status, song_id, details)
      values (v_batch_id, v_source_index, v_title, v_action, case when v_action='update' then 'updated' else 'created' end, v_song_id,
              jsonb_build_object('language',v_language,'hasLyrics',coalesce(v_item->>'lyrics','')<>'','hasProChords',coalesce(v_item->>'proChords','')<>''));
    exception when others then
      v_errors := v_errors + 1;
      v_song_id := null;
      insert into public.song_import_items (batch_id, source_index, source_name, action, status, song_id, error_message, details)
      values (v_batch_id, v_source_index, v_title, case when v_action in ('create','create_new','update','skip') then v_action else 'skip' end,
              'error', v_song_id, sqlerrm, jsonb_build_object('sqlstate',sqlstate));
    end;
  end loop;

  update public.song_import_batches
     set status = case when v_errors > 0 then 'completed_with_errors' else 'completed' end,
         created_count = v_created, updated_count = v_updated, skipped_count = v_skipped,
         error_count = v_errors,
         summary = jsonb_build_object('processed',v_total,'created',v_created,'updated',v_updated,'skipped',v_skipped,'errors',v_errors),
         completed_at = now()
   where id = v_batch_id;

  return jsonb_build_object('batchId',v_batch_id,'processed',v_total,'created',v_created,'updated',v_updated,'skipped',v_skipped,'errors',v_errors);
end;
$$;

create or replace function public.start_song_chart_import(p_source_name text, p_total integer)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch_id uuid;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to upload song charts' using errcode='42501'; end if;
  if p_total < 1 or p_total > 250 then raise exception 'Chart imports must contain 1 to 250 files' using errcode='22023'; end if;
  insert into public.song_import_batches(import_type,source_name,total_items,created_by)
  values('charts',left(coalesce(p_source_name,''),240),p_total,auth.uid()) returning id into v_batch_id;
  return v_batch_id;
end;
$$;

create or replace function public.register_song_chart(
  p_batch_id uuid, p_song_id uuid, p_arrangement_name text, p_chart_key text,
  p_chart_type text, p_notes text, p_is_primary boolean, p_storage_path text,
  p_original_filename text, p_mime_type text, p_file_size bigint,
  p_raw_content text default null, p_parsed_data jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_chart_id uuid; v_version integer;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to upload song charts' using errcode='42501'; end if;
  if not exists(select 1 from public.song_import_batches where id=p_batch_id and created_by=auth.uid() and status='processing') then raise exception 'Chart import batch is not active'; end if;
  if not exists(select 1 from public.songs where id=p_song_id and status='active') then raise exception 'Select an active song'; end if;
  if p_chart_type not in ('pdf','chordpro','txt','docx','image','other') then raise exception 'Unsupported chart type'; end if;
  if p_storage_path not like 'songs/%' or p_storage_path like '%..%' then raise exception 'Invalid chart storage path'; end if;
  if p_file_size < 0 or p_file_size > 20971520 then raise exception 'Chart files are limited to 20 MB'; end if;

  if coalesce(p_is_primary,false) then update public.song_charts set is_primary=false where song_id=p_song_id and is_primary; end if;
  insert into public.song_charts(song_id,arrangement_name,chart_key,chart_type,notes,is_primary,created_by)
  values(p_song_id,coalesce(nullif(trim(p_arrangement_name),''),'Original'),coalesce(p_chart_key,''),p_chart_type,coalesce(p_notes,''),coalesce(p_is_primary,false),auth.uid())
  returning id into v_chart_id;
  v_version := 1;
  insert into public.song_chart_versions(chart_id,version,storage_path,original_filename,mime_type,file_size,raw_content,parsed_data,uploaded_by)
  values(v_chart_id,v_version,p_storage_path,p_original_filename,coalesce(p_mime_type,'application/octet-stream'),p_file_size,p_raw_content,p_parsed_data,auth.uid());
  insert into public.song_import_items(batch_id,source_name,action,status,song_id,chart_id,details)
  values(p_batch_id,p_original_filename,'upload','uploaded',p_song_id,v_chart_id,jsonb_build_object('key',coalesce(p_chart_key,''),'storagePath',p_storage_path));
  return jsonb_build_object('chartId',v_chart_id,'version',v_version);
end;
$$;

create or replace function public.finish_song_chart_import(p_batch_id uuid, p_errors integer, p_failed_matches integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uploaded integer; v_total integer;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to finish chart imports' using errcode='42501'; end if;
  select total_items into v_total from public.song_import_batches where id=p_batch_id and created_by=auth.uid() and status='processing' for update;
  if not found then raise exception 'Chart import batch is not active'; end if;
  select count(*) into v_uploaded from public.song_import_items where batch_id=p_batch_id and status='uploaded';
  update public.song_import_batches set
    status=case when coalesce(p_errors,0)>0 or coalesce(p_failed_matches,0)>0 then 'completed_with_errors' else 'completed' end,
    chart_count=v_uploaded, error_count=greatest(coalesce(p_errors,0),0), failed_matches=greatest(coalesce(p_failed_matches,0),0),
    skipped_count=greatest(v_total-v_uploaded-greatest(coalesce(p_errors,0),0),0),
    summary=jsonb_build_object('processed',v_total,'uploaded',v_uploaded,'errors',greatest(coalesce(p_errors,0),0),'failedMatches',greatest(coalesce(p_failed_matches,0),0)),
    completed_at=now()
  where id=p_batch_id;
  return jsonb_build_object('batchId',p_batch_id,'processed',v_total,'uploaded',v_uploaded,'errors',greatest(coalesce(p_errors,0),0),'failedMatches',greatest(coalesce(p_failed_matches,0),0));
end;
$$;

create or replace function public.record_song_chart_import_error(
  p_batch_id uuid, p_source_name text, p_error_message text, p_song_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_item_id uuid;
begin
  if auth.uid() is null or not public.has_permission('songs.manage') then raise exception 'You do not have permission to record chart imports' using errcode='42501'; end if;
  if not exists(select 1 from public.song_import_batches where id=p_batch_id and created_by=auth.uid() and status='processing') then raise exception 'Chart import batch is not active'; end if;
  insert into public.song_import_items(batch_id,source_name,action,status,song_id,error_message)
  values(p_batch_id,left(coalesce(p_source_name,''),240),'upload','error',p_song_id,left(coalesce(p_error_message,'Upload failed'),1000))
  returning id into v_item_id;
  return v_item_id;
end;
$$;

revoke all on function public.upsert_song_text_content(uuid,text,text,jsonb,text,text) from public;
revoke all on function public.save_song_library_entry(uuid,text,text,text,text,integer,text,text,text[],text[],text,text,text,jsonb,text) from public;
revoke all on function public.bulk_import_songs(jsonb,text,text) from public;
revoke all on function public.start_song_chart_import(text,integer) from public;
revoke all on function public.register_song_chart(uuid,uuid,text,text,text,text,boolean,text,text,text,bigint,text,jsonb) from public;
revoke all on function public.finish_song_chart_import(uuid,integer,integer) from public;
revoke all on function public.record_song_chart_import_error(uuid,text,text,uuid) from public;
grant execute on function public.save_song_library_entry(uuid,text,text,text,text,integer,text,text,text[],text[],text,text,text,jsonb,text) to authenticated;
grant execute on function public.bulk_import_songs(jsonb,text,text) to authenticated;
grant execute on function public.start_song_chart_import(text,integer) to authenticated;
grant execute on function public.register_song_chart(uuid,uuid,text,text,text,text,boolean,text,text,text,bigint,text,jsonb) to authenticated;
grant execute on function public.finish_song_chart_import(uuid,integer,integer) to authenticated;
grant execute on function public.record_song_chart_import_error(uuid,text,text,uuid) to authenticated;

-- Private Supabase Storage bucket. The database stores only paths and metadata,
-- never large binaries.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-charts','song-charts',false,20971520,
  array['application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp','application/octet-stream']
)
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Members read song chart files" on storage.objects;
drop policy if exists "Admins upload song chart files" on storage.objects;
drop policy if exists "Admins update song chart files" on storage.objects;
drop policy if exists "Admins delete song chart files" on storage.objects;
create policy "Members read song chart files" on storage.objects for select to authenticated
  using (bucket_id='song-charts' and public.is_active_member());
create policy "Admins upload song chart files" on storage.objects for insert to authenticated
  with check (bucket_id='song-charts' and public.has_permission('songs.manage') and (storage.foldername(name))[1]='songs');
create policy "Admins update song chart files" on storage.objects for update to authenticated
  using (bucket_id='song-charts' and public.has_permission('songs.manage')) with check (bucket_id='song-charts' and public.has_permission('songs.manage'));
create policy "Admins delete song chart files" on storage.objects for delete to authenticated
  using (bucket_id='song-charts' and public.has_permission('songs.manage'));

-- Make newly created foreign-key relationships available to PostgREST
-- immediately after the SQL Editor transaction commits.
notify pgrst, 'reload schema';

commit;

-- Bundled fresh-install prerequisite: MIGRATION_rehearsal_before_service.sql
-- Reject rehearsal schedules at or after the service without altering existing rows.
begin;
create or replace function public.validate_rehearsal_schedule()
returns trigger language plpgsql set search_path = public as $$
declare
  rehearsal_date date;
  rehearsal_time time;
begin
  if coalesce(new.practice->>'enabled', 'false') <> 'true' then return new; end if;
  if coalesce(new.practice->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(new.practice->>'time', '') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$'
     or new.date is null
     or coalesce(new.time, '') !~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' then
    raise exception 'A valid rehearsal and service date and time are required.' using errcode = '23514';
  end if;
  rehearsal_date := (new.practice->>'date')::date;
  rehearsal_time := (new.practice->>'time')::time;
  if rehearsal_date + rehearsal_time >= new.date + new.time::time then
    raise exception 'Rehearsal must start before the service.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_rehearsal_schedule on public.services;
create trigger validate_rehearsal_schedule
before insert or update of practice, date, time on public.services
for each row execute function public.validate_rehearsal_schedule();
commit;

-- Bundled fresh-install prerequisite: MIGRATION_quarterly_scheduling.sql
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

-- Bundled fresh-install prerequisite: MIGRATION_unified_calendar.sql
-- Apply after quarterly scheduling and rehearsal migrations. No cleanup or notifications here.
begin;
alter table public.services add column if not exists event_kind text not null default 'service'
  check(event_kind in ('youth_meeting','service','general_meeting','prayer_shift','conference'));
alter table public.services add column if not exists end_date date;
alter table public.services add column if not exists end_time text;
alter table public.services add column if not exists location text not null default '';
alter table public.services add column if not exists location_url text not null default '';
alter table public.services add column if not exists timezone text not null default 'Africa/Cairo' check(timezone='Africa/Cairo');
alter table public.services add column if not exists published_at timestamptz;
alter table public.services add column if not exists archived_at timestamptz;
alter table public.events add column if not exists calendar_service_id uuid references public.services(id);
alter table public.services alter column status set default 'draft';

-- Run backfill once. Subsequent reruns must not reinterpret newly saved draft events.
create table if not exists public.calendar_migration_runs(key text primary key,applied_at timestamptz not null default now());
alter table public.calendar_migration_runs enable row level security;
revoke all on public.calendar_migration_runs from public,anon,authenticated;
do $backfill$ begin
 if not exists(select 1 from public.calendar_migration_runs where key='unified-calendar-v1') then
   update public.services set event_kind=case
     when weekly_template_key='youth' or lower(trim(title)) in ('youth meeting','اجتماع الشباب') then 'youth_meeting'
     when type ~* '(conference|مؤتمر)' then 'conference'
     when type ~* '(prayer|صلاة)' then 'prayer_shift'
     when type ~* '(meeting|اجتماع)' then 'general_meeting' else 'service' end,
     end_date=date,
     published_at=case when exists(select 1 from public.schedule_slots sl where sl.service_id=services.id) then coalesce((select q.published_at from public.schedule_quarters q where q.starts_on=date_trunc('quarter',services.date)::date),now()) else null end;
   -- Previously unpublished scheduled records become drafts; original assignment trigger
   -- accepts drafts after the function replacement below. No assignment values are altered.
   update public.services set status='draft' where published_at is null and status='scheduled';
   insert into public.calendar_migration_runs(key) values('unified-calendar-v1');
 end if;
end $backfill$;

-- Retain legacy Events/RSVP IDs and map them to canonical services. Match an existing
-- identical gathering rather than displaying a second copy. No legacy records are deleted.
do $events$ declare e public.events; sid uuid; begin
 for e in select * from public.events where calendar_service_id is null order by created_at,id for update loop
   select id into sid from public.services where date=e.date and time=e.time and lower(trim(title)) in (lower(trim(e.title)),lower(trim(e.title_ar))) order by created_at,id limit 1;
   if sid is null then
     insert into public.services(title,date,time,type,event_kind,status,end_date,location,notes,created_by,published_at)
     values(e.title,e.date,e.time,e.type,case when lower(trim(e.title))='youth meeting' or trim(e.title_ar)='اجتماع الشباب' then 'youth_meeting' when e.type ~* '(conference|camp|مؤتمر)' then 'conference' else 'general_meeting' end,
       case when e.status='cancelled' then 'cancelled' when e.status='past' then 'completed' else 'draft' end,
       coalesce(e.end_date,e.date),e.location,concat_ws(E'\n',nullif(e.description,''),nullif(e.description_ar,'')),e.created_by,case when e.status='past' then e.created_at else null end) returning id into sid;
   end if;
   update public.events set calendar_service_id=sid where id=e.id;
 end loop;
end $events$;

create or replace function public.calendar_can_view(p_service uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and exists(select 1 from public.services s where s.id=p_service and
   (public.has_permission('schedules.manage') or public.has_permission('services.edit') or public.has_permission('services.create') or (s.published_at is not null and s.archived_at is null)));
$$;
revoke all on function public.calendar_can_view(uuid) from public,anon;
grant execute on function public.calendar_can_view(uuid) to authenticated;
-- Restrictive policies also constrain existing permissive ALL policies on child tables.
drop policy if exists calendar_visibility on public.services;
create policy calendar_visibility on public.services as restrictive for select to authenticated using(public.calendar_can_view(id));
drop policy if exists calendar_visibility on public.service_team;
create policy calendar_visibility on public.service_team as restrictive for select to authenticated using(public.calendar_can_view(service_id));
drop policy if exists calendar_visibility on public.setlist_items;
create policy calendar_visibility on public.setlist_items as restrictive for select to authenticated using(public.calendar_can_view(service_id));
drop policy if exists calendar_visibility on public.events;
create policy calendar_visibility on public.events as restrictive for select to authenticated using(public.calendar_can_view(calendar_service_id));
drop policy if exists calendar_visibility on public.event_responses;
create policy calendar_visibility on public.event_responses as restrictive for select to authenticated using(exists(select 1 from public.events e where e.id=event_id and public.calendar_can_view(e.calendar_service_id)));
drop policy if exists calendar_response_privacy on public.event_responses;
create policy calendar_response_privacy on public.event_responses as restrictive for select to authenticated using(person_id=auth.uid() or public.has_permission('events.manage') or public.has_permission('schedules.manage'));
-- Close the legacy parallel event writer. Canonical planning is the only new event path.
revoke insert,update,delete on public.events from authenticated;
revoke truncate,references,trigger on public.services from authenticated,anon;

drop policy if exists "Authorized users can create services" on public.services;
create policy "Authorized users can create services" on public.services for insert to authenticated with check((public.has_permission('services.create') or public.has_permission('schedules.manage')) and created_by=auth.uid());
drop policy if exists "Authorized users can update services" on public.services;
create policy "Authorized users can update services" on public.services for update to authenticated using(public.has_permission('services.edit') or public.has_permission('schedules.manage')) with check(public.has_permission('services.edit') or public.has_permission('schedules.manage'));
-- Never expose the publication/archive columns to direct client writes. Security-definer
-- RPCs own those fields; SQL owner migrations can still backfill and restore snapshots.
revoke insert,update on public.services from authenticated;
grant insert(title,date,time,type,status,notes,practice,created_by,recurrence_group_id,recurrence_index,recurrence_frequency,event_kind,end_date,end_time,location,location_url,timezone,id,weekly_template_key,soundcheck_time,setlist_blocks) on public.services to authenticated;
grant update(title,date,time,type,status,notes,practice,recurrence_group_id,recurrence_index,recurrence_frequency,event_kind,end_date,end_time,location,location_url,timezone,soundcheck_time,setlist_blocks) on public.services to authenticated;

create or replace function public.guard_calendar_event()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(762901);
 if tg_op='DELETE' then raise exception 'Cancel events to preserve attendance and history'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.published_at is not null then raise exception 'Publish events through the quarterly workflow'; end if;
 if tg_op='UPDATE' and old.published_at is not null then
   if (to_jsonb(new)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency']) is distinct from (to_jsonb(old)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency']) then raise exception 'Published schedule is locked; cancel and create a corrected event'; end if;
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
   if new.end_date<>new.date and new.event_kind not in ('prayer_shift','conference') then raise exception 'Only conferences and prayer shifts span multiple days'; end if;
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
   if e->>'event_kind' not in ('youth_meeting','service','general_meeting','prayer_shift','conference') or e->>'event_kind' is null then raise exception 'Choose a supported event type'; end if;
   select * into existing from public.services where id=sid for update;
   if p_edit then
     if existing.id is null or existing.published_at is not null or existing.archived_at is not null or existing.status='cancelled' then raise exception 'Only active unpublished drafts can be edited'; end if;
     update public.services set title=trim(e->>'title'),event_kind=e->>'event_kind',type=e->>'event_kind',date=(e->>'date')::date,time=e->>'time',end_date=(e->>'end_date')::date,end_time=e->>'end_time',location=coalesce(e->>'location',''),location_url=coalesce(e->>'location_url',''),notes=coalesce(e->>'notes',''),practice=nullif(e->'practice','null'::jsonb) where id=sid;
   else
     if existing.id is not null then raise exception 'Event already exists; reload before retrying'; end if;
     insert into public.services(id,title,date,time,end_date,end_time,event_kind,type,status,location,location_url,notes,practice,created_by,recurrence_group_id,recurrence_index,recurrence_frequency)
     values(sid,trim(e->>'title'),(e->>'date')::date,e->>'time',(e->>'end_date')::date,e->>'end_time',e->>'event_kind',e->>'event_kind','draft',coalesce(e->>'location',''),coalesce(e->>'location_url',''),coalesce(e->>'notes',''),nullif(e->'practice','null'::jsonb),auth.uid(),(e->>'recurrence_group_id')::uuid,coalesce((e->>'recurrence_index')::integer,0),e->>'recurrence_frequency');
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
create or replace function public.publish_schedule_quarter(p_start date)
returns void language plpgsql security definer set search_path=public as $$
declare svc public.services; t public.service_team; sid uuid;
begin
 if not public.is_active_member() or not public.has_permission('schedules.manage') then raise exception 'Schedule manager permission required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(762901);
 if p_start is null or p_start<>date_trunc('quarter',p_start)::date then raise exception 'Choose a quarter start'; end if;
 if p_start+interval '3 months' <= (now() at time zone 'Africa/Cairo')::date then raise exception 'Cannot publish a past quarter'; end if;
 if not exists(select 1 from public.services where date>=greatest(p_start,(now() at time zone 'Africa/Cairo')::date) and date<p_start+interval '3 months' and status in ('scheduled','draft') and archived_at is null) then raise exception 'Create upcoming services before publishing'; end if;
 insert into public.schedule_quarters(starts_on,published_by) values(p_start,auth.uid()) on conflict do nothing;
 for svc in select * from public.services where date>=greatest(p_start,(now() at time zone 'Africa/Cairo')::date) and date<p_start+interval '3 months' and status in ('scheduled','draft') and archived_at is null and published_at is null order by id for update loop
   if exists(select 1 from public.substitute_requests where service_id=svc.id and status in ('open','filled')) then raise exception 'Resolve legacy substitute requests or keep this service in the legacy workflow before publishing'; end if;
   if svc.end_time is null then raise exception 'Set an end time before publishing: %',svc.title; end if;
   if svc.event_kind in ('youth_meeting','service') and (select count(*) from public.service_team assignment join public.worship_roles r on r.id=assignment.worship_role_id where assignment.service_id=svc.id and r.schedule_leader_role)<>1 then raise exception 'Each service needs exactly one Worship Leader'; end if;
   update public.services set status='scheduled',published_at=now() where id=svc.id;
   for t in select * from public.service_team where service_id=svc.id order by id for update loop
     if not exists(select 1 from public.profile_worship_roles pr join public.worship_roles wr on wr.id=pr.role_id and wr.active where pr.profile_id=t.person_id and pr.role_id=t.worship_role_id) then raise exception 'Every assignment needs an active matching member role'; end if;
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
 if tg_op='UPDATE' and auth.uid() is not null and not (public.can_manage_worship() or public.has_permission('schedules.manage')) and
   (old.person_id<>auth.uid() or new.id is distinct from old.id or new.service_id is distinct from old.service_id or new.person_id is distinct from old.person_id or new.role is distinct from old.role or new.created_at is distinct from old.created_at) then raise exception 'Members may only update their own response status'; end if;
 if auth.uid() is not null and not (public.can_manage_worship() or public.has_permission('schedules.manage')) and not exists(select 1 from public.services where id=new.service_id and published_at is not null) then raise exception 'Members can respond only to published assignments' using errcode='42501'; end if;
 select timezone into v_timezone from public.organization_settings where id=1;
 if not exists(select 1 from public.services where id=new.service_id and status in ('scheduled','draft') and archived_at is null and date>=(clock_timestamp() at time zone coalesce(v_timezone,'Africa/Cairo'))::date for no key update) then raise exception 'Assignments may only change for scheduled, non-past services' using errcode='22023'; end if;
 if new.status<>'declined' and exists(select 1 from public.excuses e where e.service_id=new.service_id and e.person_id=new.person_id and e.status in ('pending','approved')) then raise exception 'An assignment with an active excuse must remain declined' using errcode='22023'; end if;
 if exists(select 1 from public.substitute_requests r where r.service_id=new.service_id and r.requester_id=new.person_id and r.status='filled' and (r.role is distinct from new.role or new.status<>'declined')) then raise exception 'A replaced requester assignment must remain declined and keep its role' using errcode='22023'; end if;
 if exists(select 1 from public.substitute_requests r where r.service_id=new.service_id and r.substitute_id=new.person_id and r.status='filled' and (r.role is distinct from new.role or new.status='declined')) then raise exception 'A filled substitute assignment cannot be declined or change role' using errcode='22023'; end if;
 return new;
end;
$$;

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
   if exists(select 1 from public.services where id=sid and published_at is not null) then raise exception 'Published assignments must use the quarterly workflow'; end if;
   if tg_op='UPDATE' and exists(select 1 from public.services where id=old.service_id and published_at is not null) then raise exception 'Published assignments cannot be moved'; end if;
 else
   if exists(select 1 from public.schedule_slots where service_id=old.id) and
     (tg_op='DELETE' or new.date is distinct from old.date or new.time is distinct from old.time or new.practice is distinct from old.practice) then
     raise exception 'Published schedule dates and rehearsals are locked; create a new service for a changed meeting';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end;
$$;

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
   select 1 from (select d::date as day,case when d::date=s.date then s.time else '00:00' end as clock,
       case when d::date=coalesce(s.end_date,s.date) then coalesce(s.end_time,s.time) else '24:00' end as until
     from generate_series(s.date::timestamp,coalesce(s.end_date,s.date)::timestamp,interval '1 day') d
     where d::date<coalesce(s.end_date,s.date) or coalesce(s.end_time,'00:01')<>'00:00'
     union all select (s.practice->>'date')::date,s.practice->>'time',s.practice->>'time' where s.practice->>'enabled'='true') needed
   where coalesce(p.availability->>lower(to_char(needed.day,'Dy')),'false') <> 'true'
   or (exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')))
       and not exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')) and ts->>'from' <= needed.clock and ts->>'to' > needed.clock and ts->>'to' >= needed.until))
   or exists(select 1 from public.services other where other.id<>s.id and other.status in ('scheduled','draft') and other.archived_at is null
     and (needed.day between other.date and coalesce(other.end_date,other.date) or (other.practice->>'enabled'='true' and other.practice->>'date'=needed.day::text))
     and (exists(select 1 from public.schedule_slots os where os.service_id=other.id and os.person_id=p.id)
       or (not exists(select 1 from public.schedule_slots os where os.service_id=other.id)
         and exists(select 1 from public.service_team ot where ot.service_id=other.id and ot.person_id=p.id and ot.status<>'declined'))
       or exists(select 1 from public.schedule_attempts oa join public.schedule_slots os on os.id=oa.slot_id where os.service_id=other.id and oa.person_id=p.id and oa.state='proposed')))
  )
 );
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
   (select count(*) from public.schedule_slots x join public.services s on s.id=x.service_id where x.quarter=sl.quarter and x.person_id=p.id and s.status<>'cancelled' and s.archived_at is null)+
   (select count(*) from public.service_team t join public.services s on s.id=t.service_id where t.person_id=p.id and t.status<>'declined' and s.status in ('scheduled','draft') and s.archived_at is null and s.date>=sl.quarter and s.date<sl.quarter+interval '3 months' and not exists(select 1 from public.schedule_slots x where x.service_id=s.id))+
   2*(select count(*) from public.schedule_attempts a join public.schedule_slots x on x.id=a.slot_id join public.services s on s.id=x.service_id where x.quarter=sl.quarter and s.status<>'cancelled' and s.archived_at is null and a.person_id=p.id and a.replacement and a.state in ('proposed','notified','confirmed','declined')))
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

-- Extending a previously saved series preserves the canonical event fields and
-- rehearsal offset. Future occurrences are always unpublished drafts.
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
   update public.services set event_kind=source.event_kind,end_date=occurrence.date+(coalesce(source.end_date,source.date)-source.date),end_time=source.end_time,location=source.location,location_url=source.location_url,timezone='Africa/Cairo',status='draft',practice=shifted_practice where id=occurrence.id returning * into occurrence;
   return next occurrence;
 end loop;
 return;
end;
$$;
revoke all on function public.generate_service_occurrences(uuid,uuid,jsonb) from public,anon;
grant execute on function public.generate_service_occurrences(uuid,uuid,jsonb) to authenticated;

-- Keep a stale client from creating rolling predefined services.
create or replace function public.ensure_weekly_services() returns void language plpgsql as $$begin return;end;$$;
drop trigger if exists protect_fixed_weekly_service on public.services;
-- Old date-picker entry point becomes an explicit draft create through the canonical API.
create or replace function public.open_youth_meeting(p_date date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid;
begin
 if not public.is_active_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 select id into sid from public.services where event_kind='youth_meeting' and date=p_date and archived_at is null and status<>'cancelled' limit 1;
 if sid is not null then
   if not public.calendar_can_view(sid) then raise exception 'Draft unavailable' using errcode='42501'; end if;
   return sid;
 end if;
 sid:=gen_random_uuid();
 perform public.save_planning_events(jsonb_build_array(jsonb_build_object('id',sid,'event_kind','youth_meeting','title','Youth Meeting','date',p_date,'end_date',p_date,'time','18:00','end_time','20:00','team','[]'::jsonb)),false);
 return sid;
end;
$$;
revoke all on function public.guard_calendar_event() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

-- Bundled fresh-install prerequisite: MIGRATION_attendance_custom_events.sql
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
-- END ministry feature prerequisites

-- BEGIN ministry insights feature schema
-- Apply after MIGRATION_attendance_custom_events.sql and all earlier migrations.
-- Additive: historical responses, ratings and appearances are never fabricated.
begin;

create table if not exists public.ministry_access_roles (
 person_id uuid not null references public.profiles(id), role text not null check(role in ('technical_admin','musical_admin','pastoral_admin','worship_leader')),
 created_at timestamptz not null default now(), primary key(person_id,role)
);
create or replace function public.has_ministry_role(p_role text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and exists(select 1 from public.ministry_access_roles where person_id=auth.uid() and role=p_role);
$$;
create or replace function public.can_evaluate_members()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and (public.is_super_admin() or public.has_ministry_role('technical_admin'));
$$;
create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select case
 when not public.is_active_member() then false
 when p_permission='evaluations.manage' then public.can_evaluate_members()
 when public.is_super_admin() then true
 else exists(select 1 from public.access_level_permissions where access_level=public.get_access_level() and permission_key=p_permission)
 or (public.has_ministry_role('technical_admin') and p_permission in ('users.view','ratings.view','ratings.musician','ratings.vocal','ratings.leader','ratings.configure','reports.view'))
 or (public.has_ministry_role('musical_admin') and p_permission in ('users.view','ratings.view','ratings.musician','ratings.vocal','ratings.leader'))
 or (public.has_ministry_role('pastoral_admin') and p_permission in ('users.view','reports.view'))
 or (public.has_ministry_role('worship_leader') and p_permission='reports.own') end;
$$;
create or replace function public.ministry_can_read_service_report(p_service uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and (public.has_permission('reports.view') or
 (public.has_permission('reports.own') and exists(select 1 from public.service_team t join public.worship_roles r on r.id=t.worship_role_id where t.service_id=p_service and t.person_id=auth.uid() and t.status<>'declined' and r.schedule_leader_role)));
$$;
-- Report readers receive session metadata without QR credentials.
drop policy if exists "Authorized users read attendance sessions" on public.attendance_sessions;
create policy "Authorized users read attendance sessions" on public.attendance_sessions for select to authenticated using(public.has_permission('services.edit') or public.has_permission('schedules.manage'));
-- Report scope is checked by a definer helper without exposing QR credentials.
create or replace function public.ministry_can_read_attendance(p_session uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_member() and exists(select 1 from public.attendance_sessions where id=p_session and public.ministry_can_read_service_report(service_id));
$$;
drop policy if exists ministry_leader_attendance on public.attendance_records;
create policy ministry_leader_attendance on public.attendance_records for select to authenticated using(public.has_permission('reports.own') and public.ministry_can_read_attendance(session_id));
create or replace function public.get_report_attendance_sessions(p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select (to_jsonb(s)-'qr_code')||jsonb_build_object('service',case when v.id is null then null else jsonb_build_object('id',v.id,'title',v.title,'date',v.date,'time',v.time,'status',v.status,'event_kind',v.event_kind,'custom_category',v.custom_category) end)
 from public.attendance_sessions s left join public.services v on v.id=s.service_id
 where public.ministry_can_read_service_report(s.service_id)
 order by s.id limit 500 offset greatest(coalesce(p_offset,0),0);
$$;
insert into public.system_permissions(permission_key,category,description,display_order,active) values
 ('ratings.view','ratings','View profile ratings',300,true),('ratings.musician','ratings','Rate musicians',310,true),
 ('ratings.vocal','ratings','Rate vocalists',320,true),('ratings.leader','ratings','Rate worship leaders',330,true),
 ('ratings.configure','ratings','Configure rating criteria',340,true),('reports.own','reports','View own worship leader reports',350,true)
on conflict(permission_key) do nothing;
insert into public.access_level_permissions(access_level,permission_key)
select 'admin',permission_key from public.system_permissions where permission_key in ('ratings.view','ratings.musician','ratings.vocal','ratings.leader') on conflict do nothing;

create table if not exists public.ministry_members (
 person_id uuid primary key references public.profiles(id), category text not null default 'member' check(category in ('member','newcomer')),
 serving_status text not null default 'active' check(serving_status in ('active','inactive','leave','archived')),
 leader_quote text not null default '' check(length(leader_quote)<=1000), updated_at timestamptz not null default now()
);
create table if not exists public.ministry_member_history (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.profiles(id), snapshot jsonb not null,
 actor uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table if not exists public.ministry_guests (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 150),
 roles text[] not null default '{}', status text not null default 'active' check(status in ('active','inactive','on-leave')),
 join_date date not null default current_date, created_at timestamptz not null default now()
);
create table if not exists public.ministry_guest_assignments (
 service_id uuid not null references public.services(id),person_id uuid not null references public.ministry_guests(id),
 role text not null check(length(trim(role)) between 1 and 100),status text not null default 'confirmed' check(status in ('confirmed','declined','pending')),
 primary key(service_id,person_id)
);
create table if not exists public.rating_criteria (
 id uuid primary key default gen_random_uuid(),family_id uuid not null default gen_random_uuid(),version integer not null default 1,
 name text not null check(length(trim(name)) between 1 and 150),name_ar text not null default '',
 audience text not null check(audience in ('musician','vocal','leader')),minimum integer not null default 1,maximum integer not null default 5,
 weight numeric not null default 1 check(weight>0 and weight<=1000),display_order integer not null default 0,active boolean not null default true,
 created_at timestamptz not null default now(),check(maximum>minimum and maximum-minimum<=20),unique(family_id,version)
);
create unique index if not exists rating_criteria_active_name on public.rating_criteria(audience,lower(trim(name))) where active;
create table if not exists public.member_ratings (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.profiles(id),audience text not null check(audience in ('musician','vocal','leader')),
 evaluator_id uuid not null references public.profiles(id),scores jsonb not null check(jsonb_typeof(scores)='array'),comment text not null default '',created_at timestamptz not null default now()
);
create table if not exists public.service_evaluations (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.services(id),person_id uuid not null,
 evaluator_id uuid not null references public.profiles(id),audience text not null check(audience in ('musician','vocal','leader')),
 scores jsonb not null check(jsonb_typeof(scores)='array'),comment text not null default '' check(length(comment)<=4000),
 state text not null check(state in ('draft','submitted')),revision integer not null default 1,updated_at timestamptz not null default now(),
 unique(service_id,person_id,evaluator_id,audience)
);
create table if not exists public.evaluation_revisions (
 id uuid primary key default gen_random_uuid(),evaluation_id uuid not null references public.service_evaluations(id),
 snapshot jsonb not null,created_at timestamptz not null default now()
);
create table if not exists public.member_stage_appearances (
 service_id uuid not null references public.services(id),person_id uuid not null,played boolean not null,
 recorded_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),primary key(service_id,person_id)
);
create table if not exists public.assignment_response_history (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.services(id),person_id uuid not null references public.profiles(id),
 request_key text not null,sent_at timestamptz,response text not null check(response in ('confirmed','declined')),
 responded_at timestamptz not null default clock_timestamp(),actor uuid references public.profiles(id)
);
create index if not exists ministry_response_member_idx on public.assignment_response_history(person_id,service_id,responded_at);
create index if not exists ministry_evaluation_service_idx on public.service_evaluations(service_id,person_id);
create index if not exists ministry_rating_member_idx on public.member_ratings(person_id,created_at);
alter table public.service_team add column if not exists invitation_sent_at timestamptz;
alter table public.services add column if not exists subcategory text not null default '' check(length(subcategory)<=100);
alter table public.services add column if not exists setlist_finalized boolean not null default false;
alter table public.songs add column if not exists origin_year integer check(origin_year between 1000 and 2200);
create table if not exists public.song_tag_catalog (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 80),active boolean not null default true
);
create unique index if not exists song_tag_catalog_name_idx on public.song_tag_catalog(lower(trim(name)));
insert into public.song_tag_catalog(name) select distinct trim(tag) from public.songs cross join lateral unnest(themes) tag where length(trim(tag)) between 1 and 80 on conflict do nothing;

-- All new tables default to read-only through RLS; mutations use narrow RPCs.
do $$ declare t text;begin
 foreach t in array array['ministry_access_roles','ministry_members','ministry_member_history','ministry_guests','ministry_guest_assignments','rating_criteria','member_ratings','service_evaluations','evaluation_revisions','member_stage_appearances','assignment_response_history','song_tag_catalog'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
drop policy if exists ministry_roles_read on public.ministry_access_roles;
create policy ministry_roles_read on public.ministry_access_roles for select to authenticated using(public.is_active_member() and (person_id=auth.uid() or public.is_super_admin()));
do $$ declare t text;begin
 foreach t in array array['ministry_members','ministry_guests','ministry_guest_assignments','song_tag_catalog'] loop
 execute format('drop policy if exists ministry_directory_read on public.%I',t);
 execute format('create policy ministry_directory_read on public.%I for select to authenticated using(public.is_active_member())',t);
 end loop;
end $$;
drop policy if exists ministry_member_history_read on public.ministry_member_history;
create policy ministry_member_history_read on public.ministry_member_history for select to authenticated using(public.has_permission('reports.view'));
drop policy if exists criteria_read on public.rating_criteria;
create policy criteria_read on public.rating_criteria for select to authenticated using(public.has_permission('ratings.view') or public.has_permission('ratings.configure') or public.can_evaluate_members());
drop policy if exists ratings_read on public.member_ratings;
create policy ratings_read on public.member_ratings for select to authenticated using(public.has_permission('ratings.view'));
drop policy if exists evaluations_private on public.service_evaluations;
create policy evaluations_private on public.service_evaluations for select to authenticated using(public.can_evaluate_members());
drop policy if exists revisions_private on public.evaluation_revisions;
create policy revisions_private on public.evaluation_revisions for select to authenticated using(public.can_evaluate_members());
drop policy if exists appearances_read on public.member_stage_appearances;
create policy appearances_read on public.member_stage_appearances for select to authenticated using(public.is_active_member() and (public.has_permission('reports.view') or public.has_permission('schedules.manage') or public.can_evaluate_members() or public.schedule_is_leader(service_id) or person_id=auth.uid() or (public.has_permission('reports.own') and exists(select 1 from public.service_team t join public.worship_roles r on r.id=t.worship_role_id where t.service_id=member_stage_appearances.service_id and t.person_id=auth.uid() and t.status<>'declined' and r.schedule_leader_role))));
drop policy if exists responses_read on public.assignment_response_history;
create policy responses_read on public.assignment_response_history for select to authenticated using(public.is_active_member() and (public.has_permission('reports.view') or person_id=auth.uid() or (public.has_permission('reports.own') and exists(select 1 from public.service_team t join public.worship_roles r on r.id=t.worship_role_id where t.service_id=assignment_response_history.service_id and t.person_id=auth.uid() and t.status<>'declined' and r.schedule_leader_role))));

create or replace function public.ministry_set_roles(p_person uuid,p_roles text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_super_admin() then raise exception 'Super Admin required' using errcode='42501';end if;
 if p_roles is null or exists(select 1 from unnest(p_roles) r where r is null or r not in ('technical_admin','musical_admin','pastoral_admin','worship_leader')) then raise exception 'Invalid ministry roles';end if;
 if not exists(select 1 from public.profiles where id=p_person) then raise exception 'Member not found';end if;
 perform pg_advisory_xact_lock(hashtext(p_person::text));
 delete from public.ministry_access_roles where person_id=p_person;
 insert into public.ministry_access_roles(person_id,role) select p_person,r from (select distinct unnest(p_roles) r) x;
 perform public.log_admin_action('ministry.roles.updated','profile',p_person::text,null,to_jsonb(p_roles));
end $$;
create or replace function public.ministry_save_member(p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.ministry_members;
begin
 if not public.has_permission('users.edit') then raise exception 'Member management permission required' using errcode='42501';end if;
 insert into public.ministry_members(person_id,category,serving_status,leader_quote) values((p_data->>'person_id')::uuid,p_data->>'category',p_data->>'serving_status',coalesce(p_data->>'leader_quote',''))
 on conflict(person_id) do update set category=excluded.category,serving_status=excluded.serving_status,leader_quote=excluded.leader_quote,updated_at=now() returning * into saved;
 insert into public.ministry_member_history(person_id,snapshot,actor) values(saved.person_id,to_jsonb(saved),auth.uid());
end $$;
create or replace function public.ministry_save_criterion(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.rating_criteria;saved uuid;
begin
 if not public.has_permission('ratings.configure') then raise exception 'Rating configuration permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(762902);
 if nullif(p_data->>'id','') is not null then
 select * into strict prior from public.rating_criteria where id=(p_data->>'id')::uuid for update;
 update public.rating_criteria set active=false where family_id=prior.family_id;
 end if;
 insert into public.rating_criteria(family_id,version,name,name_ar,audience,minimum,maximum,weight,display_order,active)
 values(coalesce(prior.family_id,gen_random_uuid()),coalesce((select max(version)+1 from public.rating_criteria where family_id=prior.family_id),1),trim(p_data->>'name'),coalesce(p_data->>'name_ar',''),p_data->>'audience',(p_data->>'minimum')::integer,(p_data->>'maximum')::integer,(p_data->>'weight')::numeric,(p_data->>'display_order')::integer,coalesce((p_data->>'active')::boolean,true)) returning id into saved;
 return saved;
end $$;
create or replace function public.ministry_save_rating(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare is_evaluation boolean:=nullif(p_data->>'service_id','') is not null; sid uuid:=(p_data->>'service_id')::uuid;
 pid uuid:=(p_data->>'person_id')::uuid;aud text:=p_data->>'audience';item jsonb;criterion public.rating_criteria;
 snapshots jsonb:='[]';saved uuid;previous public.service_evaluations;
begin
 if is_evaluation then
 if not public.can_evaluate_members() then raise exception 'Technical Admin or Super Admin required' using errcode='42501';end if;
 perform 1 from public.services where id=sid and status='completed' for share;
 if not found then raise exception 'Choose a completed service';end if;
 if not exists(select 1 from public.service_team where service_id=sid and person_id=pid) and not exists(select 1 from public.ministry_guest_assignments where service_id=sid and person_id=pid) then raise exception 'Member must be assigned to this service';end if;
 if coalesce(p_data->>'state','') not in ('draft','submitted') then raise exception 'Invalid evaluation state';end if;
 else
 if not public.has_permission('ratings.'||coalesce(aud,'')) then raise exception 'Rating permission required' using errcode='42501';end if;
 end if;
 if jsonb_typeof(p_data->'scores') is distinct from 'array' or jsonb_array_length(p_data->'scores')>100 then raise exception 'Supply rating scores';end if;
 if (select count(*)<>count(distinct value->>'criterion_id') from jsonb_array_elements(p_data->'scores')) then raise exception 'Duplicate criteria';end if;
 for item in select value from jsonb_array_elements(p_data->'scores') loop
 select * into criterion from public.rating_criteria where id=(item->>'criterion_id')::uuid and active and audience=aud;
 if criterion.id is null or (item->>'value')::numeric<>trunc((item->>'value')::numeric) or (item->>'value')::numeric not between criterion.minimum and criterion.maximum or item->>'value' is null then raise exception 'Invalid rating value or archived criterion';end if;
 snapshots:=snapshots||jsonb_build_array(to_jsonb(criterion)||jsonb_build_object('criterion_id',criterion.id,'value',(item->>'value')::integer));
 end loop;
 if jsonb_array_length(snapshots)=0 and (not is_evaluation or p_data->>'state'='submitted') then raise exception 'Select at least one rating';end if;
 if length(coalesce(p_data->>'comment',''))>4000 then raise exception 'Comment is too long';end if;
 if is_evaluation then
 perform pg_advisory_xact_lock(hashtext(sid::text||pid::text||auth.uid()::text||aud));
 select * into previous from public.service_evaluations where service_id=sid and person_id=pid and evaluator_id=auth.uid() and audience=aud for update;
 if previous.id is not null and coalesce((p_data->>'revision')::integer,0)<>previous.revision then raise exception 'Evaluation changed. Reload before editing.';end if;
 insert into public.service_evaluations(service_id,person_id,evaluator_id,audience,scores,comment,state)
 values(sid,pid,auth.uid(),aud,snapshots,coalesce(p_data->>'comment',''),p_data->>'state')
 on conflict(service_id,person_id,evaluator_id,audience) do update set scores=excluded.scores,comment=excluded.comment,state=excluded.state,revision=service_evaluations.revision+1,updated_at=now() returning id into saved;
 insert into public.evaluation_revisions(evaluation_id,snapshot) select saved,to_jsonb(e) from public.service_evaluations e where id=saved;
 else
 insert into public.member_ratings(person_id,audience,evaluator_id,scores,comment) values(pid,aud,auth.uid(),snapshots,coalesce(p_data->>'comment','')) returning id into saved;
 end if;
 return saved;
end $$;
create or replace function public.ministry_save_guest(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved uuid;
begin
 if not public.has_permission('users.edit') then raise exception 'Member management permission required' using errcode='42501';end if;
 insert into public.ministry_guests(id,name,roles,status) values(coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid()),trim(p_data->>'name'),array(select jsonb_array_elements_text(p_data->'roles')),coalesce(p_data->>'status','active'))
 on conflict(id) do update set name=excluded.name,roles=excluded.roles,status=excluded.status returning id into saved;return saved;
end $$;
create or replace function public.ministry_assign_guest(p_service uuid,p_guest uuid,p_role text,p_remove boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_permission('schedules.manage') then raise exception 'Schedule management permission required' using errcode='42501';end if;
 perform 1 from public.services where id=p_service and status in ('draft','scheduled') for update;
 if not found then raise exception 'Choose an active event';end if;
 if p_remove then delete from public.ministry_guest_assignments where service_id=p_service and person_id=p_guest;return;end if;
 if not exists(select 1 from public.ministry_guests where id=p_guest and status='active' and p_role=any(roles)) then raise exception 'Choose an active guest and matching role';end if;
 insert into public.ministry_guest_assignments(service_id,person_id,role) values(p_service,p_guest,p_role) on conflict(service_id,person_id) do update set role=excluded.role;
end $$;
create or replace function public.ministry_record_stage(p_service uuid,p_person uuid,p_played boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not (public.has_permission('schedules.manage') or public.can_evaluate_members() or public.schedule_is_leader(p_service)) then raise exception 'Service manager permission required' using errcode='42501';end if;
 if not exists(select 1 from public.services where id=p_service and status='completed') then raise exception 'Choose a completed service';end if;
 if not exists(select 1 from public.service_team where service_id=p_service and person_id=p_person) and not exists(select 1 from public.ministry_guest_assignments where service_id=p_service and person_id=p_person) then raise exception 'Choose an assigned participant';end if;
 insert into public.member_stage_appearances(service_id,person_id,played,recorded_by) values(p_service,p_person,p_played,auth.uid()) on conflict(service_id,person_id) do update set played=excluded.played,recorded_by=excluded.recorded_by,updated_at=now();
end $$;
create or replace function public.ministry_complete_service(p_service uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.services;
begin
 if not (public.has_permission('services.edit') or public.has_permission('schedules.manage')) then raise exception 'Service manager required' using errcode='42501';end if;
 select * into strict event from public.services where id=p_service for update;
 if event.status='completed' then return;end if;
 if event.status<>'scheduled' or event.published_at is null then raise exception 'Publish this event before completing it';end if;
 if event.end_time is null or (coalesce(event.end_date,event.date)+event.end_time::time) at time zone 'Africa/Cairo'>now() then raise exception 'Complete this event after its scheduled end time';end if;
 update public.services set status='completed' where id=p_service;
end $$;
create or replace function public.ministry_finalize_setlist(p_service uuid,p_finalized boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not (public.has_permission('services.edit') or public.schedule_is_leader(p_service)) then raise exception 'Service editor permission required' using errcode='42501';end if;
 update public.services set setlist_finalized=p_finalized where id=p_service and status='completed';
 if not found then raise exception 'Choose a completed service';end if;
end $$;

-- Publish time is the start of the response clock, never assignment creation time.
create or replace function public.ministry_capture_response()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='schedule_notifications' then
 if new.kind in ('assignment','replacement_assignment') then
 update public.service_team set invitation_sent_at=coalesce(invitation_sent_at,new.created_at) where service_id=new.service_id and person_id=new.recipient;
 end if;
 elsif tg_table_name='service_team' then
 if auth.uid()=new.person_id and new.status is distinct from old.status and new.status in ('confirmed','declined') then
 insert into public.assignment_response_history(service_id,person_id,request_key,sent_at,response,actor) values(new.service_id,new.person_id,new.id::text,new.invitation_sent_at,new.status,auth.uid());
 end if;
 end if;return new;
end $$;
drop trigger if exists ministry_response_history on public.service_team;
create trigger ministry_response_history after update of status on public.service_team for each row execute function public.ministry_capture_response();
drop trigger if exists ministry_notification_clock on public.schedule_notifications;
create trigger ministry_notification_clock after insert on public.schedule_notifications for each row execute function public.ministry_capture_response();

create or replace function public.ministry_bulk_schedule(p_events jsonb)
returns setof uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb;
begin
 if not public.has_permission('schedules.manage') then raise exception 'Schedule manager required' using errcode='42501';end if;
 if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 52 then raise exception 'Import 1–52 events at a time';end if;
 perform pg_advisory_xact_lock(762901);
 if (select count(*)<>count(distinct (value->>'date',value->>'time',lower(trim(value->>'title')))) from jsonb_array_elements(p_events)) then raise exception 'Duplicate events in upload';end if;
 for e in select value from jsonb_array_elements(p_events) loop
 if exists(select 1 from public.services where date=(e->>'date')::date and time=e->>'time' and lower(trim(title))=lower(trim(e->>'title'))) then raise exception 'An event already exists: %',e->>'title';end if;
 end loop;
 return query select * from public.save_planning_events(p_events,false);
 for e in select value from jsonb_array_elements(p_events) loop update public.services set subcategory=coalesce(e->>'subcategory','') where id=(e->>'id')::uuid;end loop;
end $$;
create or replace function public.save_song_with_metadata(p_data jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare saved uuid;tag text;canonical_tags text[]:='{}';
begin
 if not public.has_permission('songs.manage') then raise exception 'Song management permission required' using errcode='42501';end if;
 for tag in select trim(value) from jsonb_array_elements_text(p_data->'p_themes') with ordinality tags(value,n) where trim(value)<>'' order by n loop
 if length(tag)>80 then raise exception 'Tags must be 80 characters or fewer';end if;
 insert into public.song_tag_catalog(name) values(tag) on conflict do nothing;
 select name into tag from public.song_tag_catalog where lower(trim(name))=lower(trim(tag));
 canonical_tags:=array_append(canonical_tags,tag);
 end loop;
 canonical_tags:=array(select distinct unnest(canonical_tags));
 saved:=public.save_song_library_entry((p_data->>'p_song_id')::uuid,p_data->>'p_title',p_data->>'p_title_ar',p_data->>'p_author',p_data->>'p_key',(p_data->>'p_bpm')::integer,p_data->>'p_time_signature',p_data->>'p_language',canonical_tags,array(select jsonb_array_elements_text(p_data->'p_sequence')),p_data->>'p_notes',p_data->>'p_ccli_number',p_data->>'p_lyrics',p_data->'p_lyrics_sections',p_data->>'p_pro_chords');
 update public.songs set origin_year=nullif(p_data->>'origin_year','')::integer where id=saved;return saved;
end $$;
create or replace function public.ministry_manage_tag(p_id uuid,p_name text,p_active boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare old_name text;canonical text;
begin
 if not public.has_permission('songs.manage') then raise exception 'Song management permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(762903);
 if p_id is null then insert into public.song_tag_catalog(name,active) values(trim(p_name),p_active);return;end if;
 select name into strict old_name from public.song_tag_catalog where id=p_id for update;
 select name into canonical from public.song_tag_catalog where lower(trim(name))=lower(trim(p_name)) and id<>p_id;
 if canonical is null then update public.song_tag_catalog set name=trim(p_name),active=p_active where id=p_id;canonical:=trim(p_name);
 else update public.song_tag_catalog set active=false where id=p_id;end if;
 update public.songs set themes=array(select distinct case when lower(trim(t))=lower(trim(old_name)) then canonical else t end from unnest(themes) t) where exists(select 1 from unnest(themes) t where lower(trim(t))=lower(trim(old_name)));
end $$;

create or replace function public.schedule_eligible(p_slot uuid,p_person uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
 select 1 from public.schedule_slots sl join public.services s on s.id=sl.service_id
 join public.profiles p on p.id=p_person
 join public.worship_roles wr on wr.id=sl.role_id and wr.active
 where sl.id=p_slot and p.status='active' and not exists(select 1 from public.ministry_members mm where mm.person_id=p.id and mm.serving_status<>'active') and s.status='scheduled'
 and s.date >= (now() at time zone 'Africa/Cairo')::date
 and exists(select 1 from public.profile_worship_roles pr where pr.profile_id=p.id and pr.role_id=sl.role_id)
 and not exists(select 1 from public.schedule_attempts a where a.slot_id=sl.id and a.person_id=p.id and a.state in ('declined','rejected'))
 and not exists(select 1 from public.schedule_attempts a join public.schedule_slots x on x.id=a.slot_id where x.service_id=s.id and a.person_id=p.id and a.state='declined')
 and not exists(select 1 from public.service_team t where t.service_id=s.id and t.person_id=p.id and t.status='declined')
 and not exists(select 1 from public.schedule_slots other where other.service_id=s.id and other.id<>sl.id and other.person_id=p.id)
 and not exists(select 1 from public.schedule_attempts a join public.schedule_slots other on other.id=a.slot_id where other.service_id=s.id and other.id<>sl.id and a.person_id=p.id and a.state='proposed')
 and not exists(select 1 from public.excuses e where e.person_id=p.id and e.service_id=s.id and e.status in ('pending','approved'))
 and not exists(
   select 1 from (select d::date as day,case when d::date=s.date then s.time else '00:00' end as clock,
       case when d::date=coalesce(s.end_date,s.date) then coalesce(s.end_time,s.time) else '24:00' end as until
     from generate_series(s.date::timestamp,coalesce(s.end_date,s.date)::timestamp,interval '1 day') d
     where d::date<coalesce(s.end_date,s.date) or coalesce(s.end_time,'00:01')<>'00:00'
     union all select (s.practice->>'date')::date,s.practice->>'time',s.practice->>'time' where s.practice->>'enabled'='true') needed
   where (exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')))
       and not exists(select 1 from jsonb_array_elements(coalesce(p.time_slots,'[]')) ts where ts->>'day'=lower(to_char(needed.day,'Dy')) and ts->>'from' <= needed.clock and ts->>'to' > needed.clock and ts->>'to' >= needed.until))
   or exists(select 1 from public.services other where other.id<>s.id and other.status in ('scheduled','draft') and other.archived_at is null
     and (needed.day between other.date and coalesce(other.end_date,other.date) or (other.practice->>'enabled'='true' and other.practice->>'date'=needed.day::text))
     and (exists(select 1 from public.schedule_slots os where os.service_id=other.id and os.person_id=p.id)
       or (not exists(select 1 from public.schedule_slots os where os.service_id=other.id)
         and exists(select 1 from public.service_team ot where ot.service_id=other.id and ot.person_id=p.id and ot.status<>'declined'))
       or exists(select 1 from public.schedule_attempts oa join public.schedule_slots os on os.id=oa.slot_id where os.service_id=other.id and oa.person_id=p.id and oa.state='proposed')))
  )
 );
$$;

create or replace function public.ministry_save_subcategory(p_service uuid,p_subcategory text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.has_permission('services.edit') then raise exception 'Service editor permission required' using errcode='42501';end if;
 update public.services set subcategory=trim(p_subcategory) where id=p_service and status<>'cancelled';
 if not found then raise exception 'Choose an active service';end if;
end $$;

create or replace function public.guard_calendar_event()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(762901);
 if tg_op='DELETE' then raise exception 'Cancel events to preserve attendance and history'; end if;
 if tg_op='INSERT' and auth.uid() is not null and new.published_at is not null then raise exception 'Publish events through the quarterly workflow'; end if;
 if tg_op='UPDATE' and old.published_at is not null then
   if (to_jsonb(new)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency','attendance_enabled','late_tolerance_mode','late_tolerance_minutes','subcategory','setlist_finalized']) is distinct from (to_jsonb(old)-array['status','notes','setlist_blocks','updated_at','archived_at','recurrence_group_id','recurrence_index','recurrence_frequency','attendance_enabled','late_tolerance_mode','late_tolerance_minutes','subcategory','setlist_finalized']) then raise exception 'Published schedule is locked; cancel and create a corrected event'; end if;
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

create or replace function public.ministry_setlist_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op<>'INSERT' then update public.services set setlist_finalized=false where id=old.service_id and setlist_finalized;end if;
 if tg_op<>'DELETE' then update public.services set setlist_finalized=false where id=new.service_id and setlist_finalized;return new;end if;
 return old;
end $$;
drop trigger if exists ministry_setlist_changed on public.setlist_items;
create trigger ministry_setlist_changed after insert or update or delete on public.setlist_items for each row execute function public.ministry_setlist_changed();
revoke all on function public.ministry_setlist_changed() from public,anon,authenticated;

-- Internal trigger functions cannot be invoked as application endpoints.
revoke all on function public.ministry_capture_response() from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname in ('has_ministry_role','can_evaluate_members','save_song_with_metadata','get_report_attendance_sessions') or p.proname like 'ministry_%') and p.proname not in ('ministry_capture_response','ministry_setlist_changed') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
-- END ministry insights feature schema
