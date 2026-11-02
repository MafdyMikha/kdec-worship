-- Validate upgrade preserves the saved historical classification, not a recomputation.
begin;
do $$begin
 if not exists(select 1 from attendance_records where session_id='95000000-0000-0000-0000-000000000002' and status='present' and arrival_status='on_time' and scheduled_start_at is not null and tolerance_minutes=15) then raise exception 'TEST FAILED: legacy status changed or missing backfill';end if;
end$$;
update organization_settings set attendance_late_minutes=0,attendance_late_enabled=false where id=1;
do $$begin
 if not exists(select 1 from attendance_records where session_id='95000000-0000-0000-0000-000000000002' and status='present' and arrival_status='on_time' and tolerance_minutes=15) then raise exception 'TEST FAILED: legacy status reclassified';end if;
end$$;
rollback;
