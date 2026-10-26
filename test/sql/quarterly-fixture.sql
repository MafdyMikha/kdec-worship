-- ISOLATED DATABASE ONLY. Minimal dependency contract for the quarterly migration.
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(id uuid primary key default gen_random_uuid(),name text,status text default 'active',access_level text default 'member',availability jsonb default '{"sun":true,"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true}',time_slots jsonb default '[]');
create table public.worship_roles(id uuid primary key default gen_random_uuid(),name text,active boolean default true);
create table public.profile_worship_roles(profile_id uuid references profiles,role_id uuid references worship_roles,primary key(profile_id,role_id));
create table public.services(id uuid primary key default gen_random_uuid(),title text,date date,time text,status text default 'scheduled',practice jsonb);
create table public.service_team(id uuid primary key default gen_random_uuid(),service_id uuid references services,person_id uuid references profiles,worship_role_id uuid references worship_roles,role text,status text default 'pending');
create table public.excuses(person_id uuid,service_id uuid,status text);
create table public.substitute_requests(service_id uuid,status text);
create function public.is_active_member() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and status='active')$$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and status='active' and access_level='super_admin')$$;
create function public.has_permission(text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and status='active' and access_level in ('super_admin','admin','leader'))$$;
grant select on profiles,services,service_team to authenticated;
grant update,insert,delete on service_team to authenticated;
