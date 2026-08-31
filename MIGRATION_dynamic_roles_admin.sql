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
  if cardinality(p_role_ids)<>(select count(distinct id) from unnest(p_role_ids) id) then raise exception 'Duplicate role in reorder list'; end if;
  update public.worship_roles role set display_order=ordered.position*10 from unnest(p_role_ids) with ordinality ordered(id,position) where role.id=ordered.id;
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
    select 1 from unnest(p_role_ids) id
    left join public.worship_roles role on role.id=id
    where role.id is null
       or (not role.active and not exists(
         select 1 from public.profile_worship_roles existing
         where existing.profile_id=p_user_id and existing.role_id=id
       ))
  ) then raise exception 'New assignments require active roles'; end if;
  select array_agg(role.name order by mapping.position),max(role.name) filter(where role.id=p_primary_role_id)
    into v_names,v_primary_name from unnest(p_role_ids) with ordinality mapping(id,position) join public.worship_roles role on role.id=mapping.id;
  perform set_config('app.admin_user_update','1',true);
  update public.profiles set name=trim(p_name),phone=coalesce(p_phone,''),whatsapp=coalesce(p_whatsapp,''),notes=coalesce(p_notes,''),status=p_status,access_level=p_access_level,is_admin=(p_access_level in ('super_admin','admin')),position=case p_access_level when 'super_admin' then 'Admin' when 'admin' then 'Admin' when 'leader' then 'Leader' else 'Member' end,role=v_primary_name,roles=to_jsonb(v_names) where id=p_user_id;
  delete from public.profile_worship_roles where profile_id=p_user_id;
  insert into public.profile_worship_roles(profile_id,role_id,is_primary,created_by) select p_user_id,id,id=p_primary_role_id,auth.uid() from unnest(p_role_ids) id;
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
  if exists(select 1 from unnest(p_role_ids) id left join public.worship_roles role on role.id=id where role.id is null or not role.active) then raise exception 'Invitations require active roles'; end if;
  select array_agg(role.name order by mapping.position),max(role.name) filter(where role.id=p_primary_role_id) into v_names,v_primary_name from unnest(p_role_ids) with ordinality mapping(id,position) join public.worship_roles role on role.id=mapping.id;
  insert into public.invitations(code,email,role,roles,method,status,created_by,expires_at,access_level)
  values(p_code,lower(trim(p_email)),v_primary_name,to_jsonb(v_names),p_method,'pending',auth.uid(),now()+interval '7 days',p_access_level) returning * into v_invitation;
  insert into public.invitation_worship_roles(invitation_id,role_id,is_primary) select v_invitation.id,id,id=p_primary_role_id from unnest(p_role_ids) id;
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
  if exists(select 1 from unnest(p_permission_keys) key left join public.system_permissions permission on permission.permission_key=key where permission.permission_key is null) then raise exception 'Unknown permission key'; end if;
  select coalesce(jsonb_agg(permission_key order by permission_key),'[]'::jsonb) into v_old from public.access_level_permissions where access_level=p_access_level;
  delete from public.access_level_permissions where access_level=p_access_level;
  insert into public.access_level_permissions(access_level,permission_key,created_by) select p_access_level,key,auth.uid() from unnest(p_permission_keys) key;
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

commit;
