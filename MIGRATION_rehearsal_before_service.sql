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
