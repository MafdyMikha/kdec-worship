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
  position text,
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
  select array_agg(role.name order by mapping.position),max(role.name) filter(where role.id=p_primary_role_id) into v_names,v_primary_name from unnest(p_role_ids) with ordinality mapping(role_id,position) join public.worship_roles role on role.id=mapping.role_id;
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

commit;
