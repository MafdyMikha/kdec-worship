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
  roles         text[] default array['Vocalist'],
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
returns trigger language plpgsql as $$
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
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
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
  usage_count     integer default 0,
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
  notes                 text default '',
  recurrence_group_id   uuid,
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

-- ============================================================
-- 4. SETLIST ITEMS (songs within a service)
-- ============================================================
create table public.setlist_items (
  id          uuid primary key default uuid_generate_v4(),
  service_id  uuid not null references public.services(id) on delete cascade,
  song_id     uuid not null references public.songs(id) on delete cascade,
  key         text,
  notes       text default '',
  sort_order  integer not null default 1,
  created_at  timestamptz default now()
);

create index setlist_service_idx on public.setlist_items(service_id);

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
  roles         text[] default array['Vocalist'],
  method        text default 'email' check (method in ('email','whatsapp')),
  status        text default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  created_by    uuid references public.profiles(id),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz default now()
);

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

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- PROFILES policies
create policy "Profiles are visible to authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.is_admin());

create policy "Admins can insert profiles"
  on public.profiles for insert to authenticated
  with check (public.is_admin());

-- SONGS policies
create policy "Songs visible to authenticated users"
  on public.songs for select to authenticated using (true);

create policy "Admins and leaders can insert songs"
  on public.songs for insert to authenticated
  with check (auth.uid() is not null);

create policy "Admins and leaders can update songs"
  on public.songs for update to authenticated
  using (auth.uid() is not null);

create policy "Admins can delete songs"
  on public.songs for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- SERVICES policies
create policy "Services visible to authenticated users"
  on public.services for select to authenticated using (true);

create policy "Admins can manage services"
  on public.services for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SETLIST policies
create policy "Setlists visible to authenticated users"
  on public.setlist_items for select to authenticated using (true);

create policy "Admins can manage setlists"
  on public.setlist_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- TEAM policies
create policy "Team assignments visible to authenticated users"
  on public.service_team for select to authenticated using (true);

create policy "Admins can manage team assignments"
  on public.service_team for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Members can update their own status"
  on public.service_team for update to authenticated
  using (person_id = auth.uid())
  with check (person_id = auth.uid());

-- ANNOUNCEMENTS policies
create policy "Announcements visible to authenticated users"
  on public.announcements for select to authenticated using (true);

create policy "Admins can manage announcements"
  on public.announcements for all to authenticated
  using (public.is_admin() or author_id = auth.uid())
  with check (public.is_admin() or author_id = auth.uid());

-- INVITATIONS policies
create policy "Admins can manage invitations"
  on public.invitations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read invitation by code (for signup)"
  on public.invitations for select
  using (true);

create policy "Invited users can accept their invitation"
  on public.invitations for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') and status = 'pending')
  with check (lower(email) = lower(auth.jwt() ->> 'email') and status = 'accepted');

-- Safe upgrade for existing Supabase projects that already ran an older schema.
alter table public.profiles add column if not exists roles text[] default array['Vocalist'];
alter table public.invitations add column if not exists roles text[] default array['Vocalist'];
update public.profiles set roles = array[coalesce(role, 'Vocalist')] where roles is null or array_length(roles, 1) is null;
update public.invitations set roles = array[coalesce(role, 'Vocalist')] where roles is null or array_length(roles, 1) is null;

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
  label         text not null default 'Service',   -- 'Practice', 'Soundcheck', 'Team Meeting', 'Service'
  qr_code       text unique not null,               -- short token embedded in QR
  active        boolean default true,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now(),
  expires_at    timestamptz default (now() + interval '24 hours')
);

-- ── ATTENDANCE RECORDS ─────────────────────────────────────
create table if not exists public.attendance_records (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references public.attendance_sessions(id) on delete cascade,
  person_id     uuid not null references public.profiles(id) on delete cascade,
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  status        text default 'present' check (status in ('present','late','absent','excused')),
  excuse_reason text default '',
  created_at    timestamptz default now(),
  unique(session_id, person_id)
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
  status        text default 'upcoming',
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now()
);

-- ── EVENT RESPONSES (RSVP / POLL) ─────────────────────────
create table if not exists public.event_responses (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references public.events(id) on delete cascade,
  person_id   uuid not null references public.profiles(id) on delete cascade,
  response    text default 'pending' check (response in ('attending','not_attending','maybe','pending')),
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
  status      text default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz default now()
);

-- ── SUBSTITUTE REQUESTS ────────────────────────────────────
create table if not exists public.substitute_requests (
  id              uuid primary key default uuid_generate_v4(),
  service_id      uuid not null references public.services(id) on delete cascade,
  requester_id    uuid not null references public.profiles(id),
  substitute_id   uuid references public.profiles(id),   -- chosen sub
  role            text not null,
  status          text default 'open' check (status in ('open','filled','cancelled')),
  note            text default '',
  created_at      timestamptz default now()
);

-- ── SETLIST NOTES (blocks between songs) ──────────────────
-- stored inside services.setlist_items as JSON, no extra table needed

-- RLS
alter table public.attendance_sessions  enable row level security;
alter table public.attendance_records   enable row level security;
alter table public.events               enable row level security;
alter table public.event_responses      enable row level security;
alter table public.excuses              enable row level security;
alter table public.substitute_requests  enable row level security;

-- attendance sessions: all auth users can read, admins manage
create policy "Attendance sessions readable" on public.attendance_sessions for select to authenticated using (true);
create policy "Admins manage sessions" on public.attendance_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- attendance records: users see own + admins see all
create policy "Own records" on public.attendance_records for select to authenticated using (person_id = auth.uid() or public.is_admin());
create policy "Insert own record" on public.attendance_records for insert to authenticated with check (person_id = auth.uid());
create policy "Update own record" on public.attendance_records for update to authenticated using (person_id = auth.uid() or public.is_admin());
create policy "Admins delete records" on public.attendance_records for delete to authenticated using (public.is_admin());

-- events: all auth users read, admins write
create policy "Events readable" on public.events for select to authenticated using (true);
create policy "Admins manage events" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- event responses
create policy "Event responses readable" on public.event_responses for select to authenticated using (true);
create policy "Own response" on public.event_responses for all to authenticated using (person_id = auth.uid()) with check (person_id = auth.uid());

-- excuses
create policy "Excuses readable by admin and owner" on public.excuses for select to authenticated using (person_id = auth.uid() or public.is_admin());
create policy "Create own excuse" on public.excuses for insert to authenticated with check (person_id = auth.uid());
create policy "Admin manage excuses" on public.excuses for update to authenticated using (public.is_admin());

-- substitutes
create policy "Sub requests readable" on public.substitute_requests for select to authenticated using (true);
create policy "Create sub request" on public.substitute_requests for insert to authenticated with check (requester_id = auth.uid());
create policy "Manage sub requests" on public.substitute_requests for update to authenticated using (requester_id = auth.uid() or public.is_admin());
