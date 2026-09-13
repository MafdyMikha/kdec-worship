-- Youth-only schedule. Safe whether or not the earlier weekly migration was applied.
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
create or replace function public.ensure_weekly_services()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if not public.is_active_member() then
    raise exception 'Active membership required' using errcode = '42501';
  end if;
  insert into public.services(title,date,time,type,weekly_template_key)
    select t.title, v_today + offset_day, t.time, 'Weekly Meeting', t.key
    from public.weekly_service_templates t cross join generate_series(0,83) offset_day
    where t.key = 'youth' and extract(dow from (v_today + offset_day)) = t.weekday
    on conflict (weekly_template_key,date) where weekly_template_key is not null do nothing;
end;
$$;
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
