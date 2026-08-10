-- KDEC Worship — explicit attendance date/start/end timing
-- Safe to run once on a project that already has MIGRATION_security_data_integrity.sql.

begin;

alter table public.attendance_sessions add column if not exists session_date date;
alter table public.attendance_sessions add column if not exists end_time time;

update public.attendance_sessions
   set session_date = coalesce(
     session_date,
     (select service.date from public.services as service where service.id = attendance_sessions.service_id),
     (coalesce(created_at, now()) at time zone coalesce(
       (select settings.timezone from public.organization_settings as settings where settings.id = 1),
       'Africa/Cairo'
     ))::date
   )
 where session_date is null;

alter table public.attendance_sessions alter column session_date set default current_date;
alter table public.attendance_sessions alter column session_date set not null;
alter table public.attendance_sessions drop constraint if exists attendance_session_time_range_check;
alter table public.attendance_sessions
  add constraint attendance_session_time_range_check
  check (end_time is null or session_time is not null) not valid;

-- The result columns changed, so PostgreSQL requires the existing function to
-- be dropped before it can be recreated with the new date/end-time fields.
drop function if exists public.get_attendance_session(text);
create function public.get_attendance_session(p_qr_code text)
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

revoke all on function public.get_attendance_session(text) from public;
revoke all on function public.check_in_attendance(text) from public;
grant execute on function public.get_attendance_session(text) to authenticated;
grant execute on function public.check_in_attendance(text) to authenticated;

commit;
