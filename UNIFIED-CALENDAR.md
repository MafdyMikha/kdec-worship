# Unified quarterly calendar: deployment and verification

## Model and behavior

`services` is the canonical event table. `event_kind` distinguishes Youth Meeting,
Service, General Meeting, House of Prayer Shift and Conference. Team, setlist,
attendance, excuses, quarterly slots, proposals, notifications and audit records
continue to reference the same service ID. No second calendar dataset is created.
An enabled rehearsal is a calendar projection of `services.practice`, never a new
event row. Multi-day entries occupy every covered day and appear once in the list.

`published_at` records publication independently of assignment slots, including
zero-team events. New events are drafts; only quarter publication can expose them
to members. Restrictive RLS policies hide draft services and their team/setlist
rows. All active members can read published events. Existing contact/reason,
private-proposal and decision-history restrictions remain in effect. Legacy RSVP rows, which can contain private notes, are readable only by their owner or an authorized event/schedule manager.

`date/time` and `end_date/end_time` are wall times in `Africa/Cairo`, stored as
ISO dates and 24-hour `HH:mm`; the UI uses 12-hour AM/PM inputs. Conferences and
prayer shifts can last up to 31 days. Select the following end date for an
overnight shift. The server rejects nonexistent Cairo times during the spring
clock change. For the repeated hour in autumn, PostgreSQL uses its standard-time
interpretation. Legacy records with unknown end times are not assigned invented
durations: managers must add an end time before publishing an unpublished record.

Youth Meetings and Services require exactly one canonical Worship Leader at
publication. Other types can publish without a leader or setlist. Optional teams
can be assigned to every type. Ordinary replacement notifications always require
a confirmed Worship Leader's approval; if a non-worship event has no leader,
a declined slot stays vacant without offering a replacement. Only Super Admin
can replace a leader. Existing weighted workload selection and dedupe protection
are retained. Eligibility now checks availability throughout multi-day/overnight
ranges. Conflicts conservatively reserve all occupied dates and rehearsal dates,
including unpublished assignments, rather than assuming two events can share a day.

Drafts and explicit recurrence save in one `save_planning_events` transaction.
Unchanged team rows keep their IDs and response state. Recurrence keeps event
duration and rehearsal offset. Published event scheduling fields, location and
original assignments are locked; cancel and create a corrected event to change
them. Notes and setlists remain editable. Publication is transactional and sends
persistent **in-app** notifications to assignees only; no email/WhatsApp sender
is called. Saving or editing a draft never sends notifications.

`/schedule` is the main calendar; `/services`, `/services/youth` and `/events`
remain supported aliases. A quarter/year URL preserves the return position.
Desktop shows three monthly grids; mobile shows a readable list. Filters include
My assignments, type and cancelled events. Event details include team responses,
permitted replacement decisions and a return to the calendar. PDF export covers
the whole quarter independently of filters, including all types, locations,
end dates/times, rehearsals and assignment states; private notes, reasons, contacts
and proposals are omitted. The export opens the browser print dialog: Save as PDF.

## Exact deployment order

Use a separate Supabase test project first. Do not run `test/sql` against Supabase.

For a **fresh** project apply, in this order:

1. `supabase-schema-FULL.sql` (once only).
2. `MIGRATION_dynamic_roles_admin.sql`.
3. `MIGRATION_qa_hardening.sql`.
4. `MIGRATION_song_bulk_management.sql`.
5. `MIGRATION_rehearsal_before_service.sql`.
6. `MIGRATION_quarterly_scheduling.sql`.
7. `MIGRATION_unified_calendar.sql`.

For an **existing** project take a managed database backup and an owner-level
schema/data export first. Do not rerun the fresh schema. If older hardening has
not been applied, follow `SUPABASE-SETUP.md` through security/data integrity,
dynamic roles, QA, songs and rehearsal rules; then apply quarterly scheduling
and finally unified calendar. Never run a historical fixed-weekly/youth migration
after these files. The old `MIGRATION_youth_meeting_calendar.sql` is malformed and
is not part of this upgrade path. The fresh schema already has legacy template
columns; for an older database missing those columns, apply
`MIGRATION_fixed_weekly_services.sql` before quarterly scheduling, without calling
its generator. The final migrations replace the generator with a no-op.

The unified migration preserves accounts, songs, service IDs, setlists and
attendance. It classifies existing services, marks previously published events,
and maps legacy `events.calendar_service_id` to services. An existing event with
matching title/date/time is reused. Legacy event/RSVP rows and IDs stay stored;
new writes through the parallel legacy Events editor are disabled. Review legacy
duplicates with different titles manually; the migration does not guess that two
such gatherings are identical.

### Requested calendar cleanup

Apply **`MIGRATION_calendar_cleanup.sql` separately**, after the unified migration. Use a maintenance window with manager edits paused while reviewing the candidate list and applying cleanup:

1. Retain the managed backup and export. In SQL Editor execute the opening
   preparation block (owner-only selection table and candidate `SELECT`) first, stopping before `begin;`, and export the resulting IDs/titles/link counts.
2. The preview lists active (`draft`/`scheduled`) non-Youth events whose effective
   end date is today or later in Cairo. Known generated weekly-template occurrences
   are selected automatically. Legitimate manual events are retained. For other
   records reviewed as unwanted, insert their exact service IDs and reasons into
   owner-only `calendar_cleanup_selection` using the commented SQL example, then
   rerun the preview. Migrated legacy Events can be selected by their mapped
   service ID. Youth Meetings are excluded even if selected accidentally. Past,
   completed/cancelled history and unrelated data are retained.
3. Run the complete file. In one transaction it snapshots affected parents,
   original assignments, setlists, attendance sessions/records, excuses,
   substitute requests, legacy RSVPs, slots, attempts, notifications and audits
   into owner-only `calendar_cleanup_backup` before setting status cancelled and
   `archived_at`. Existing cancellation triggers may close attendance sessions
   and cancel pending requests; their original values are in the snapshot.
4. Export the final manifest and retain it with the backup. Verify Youth IDs and
   linked-history counts before/after. No records are physically deleted. Cleanup
   does not call any notification function. An immutable migration marker makes
   rerunning it leave later manager-created events untouched.

Do not blindly restore parents alone: linked attendance/request transitions also
need restoration. For recovery, use the pre-migration managed backup in a separate
database, compare owner-only JSON snapshots, and restore the chosen parent and
related state in a maintenance transaction. This avoids bypassing published-state
and request-history invariants. Keep the new schema during a frontend rollback;
old clients intentionally cannot edit published timing or use the Events writer.

After the migrations, deploy:

```bash
npm ci
npm test
npm run lint
npm run build
```

Publish `dist/` through the existing host. Keep public Supabase URL/anonymous key,
`VITE_DEMO_MODE=false`, Auth redirect URLs and SPA rewrites configured. No secret
or service-role key belongs in Vite variables. Refresh the client after the
migration's PostgREST schema-cache reload.

## Installable web app

The HTTPS deployment includes a manifest, branded 192/512 icons, standalone launch
to `/schedule`, iOS home-screen metadata and a generic offline fallback. On mobile
use the browser's Install / Add to Home Screen action. Only the generic offline
page/script is cached; auth, API responses, app HTML and member data are not cached
by the service worker. An internet connection is required for calendar data and
writes. This is an installable responsive web app, not an offline database client.
Serve `sw.js` without long-lived immutable caching. Existing Vercel static-asset
handling precedes the SPA fallback.

## Verification commands

`npm test` is browser/service-independent. The calendar tests cover normalization
and reload-shaped JSON, all five types, Cairo date boundaries, range validation,
recurrence, cleanup preservation, member filters, rehearsal projection, publication
requirements and private-data exclusion in EN/AR PDF HTML. Existing permission,
weighted-selection and workflow tests remain.

For optional integration, start a dedicated local PostgreSQL server on port 55439
and create cluster roles `anon` and `authenticated` if absent. Create **only** an
empty `kdec_calendar_test` database, then:

```bash
psql -h 127.0.0.1 -p 55439 -d kdec_calendar_test -v ON_ERROR_STOP=1 \
  -f test/sql/auth-stub.sql -f supabase-schema-FULL.sql \
  -f MIGRATION_dynamic_roles_admin.sql -f MIGRATION_qa_hardening.sql \
  -f MIGRATION_rehearsal_before_service.sql -f MIGRATION_quarterly_scheduling.sql \
  -f MIGRATION_unified_calendar.sql
node scripts/unified-calendar-check.mjs kdec_calendar_test
```

Set `KDEC_TEST_PSQL` when `psql` is not on PATH. The script rejects every other
database name and fixes host/port to localhost. Synthetic scenario data rolls back;
it exercises silent drafts, zero-team publishing, ordinary/inactive/anonymous
permissions, atomic batch failures, duplicate prevention, locked published fields,
confirmation/decline, private proposals, leader approvals and Super Admin replacement.
The legacy `quarterly-concurrency-check.mjs` verifies the pre-existing state machine;
a current deployed two-session approval test is still required for the new release.

Before production, use synthetic accounts in the separate Supabase test project:

- Create all five event types and an explicit recurring series; reload another
  session and verify every field. Include overnight/month-boundary conferences,
  enabled and disabled rehearsals, and intentional empty teams.
- Verify no inbox row on draft save/edit. Publish a quarter, repeat publication,
  reload as an ordinary member, filter My assignments, confirm, decline, reject
  then approve a proposed replacement. Check candidate notifications only after
  approval, including simultaneous approvals from two leader sessions.
- Decline/deactivate a leader; verify ordinary Admin cannot replace them. As Super
  Admin choose an eligible leader, confirm as that person, and verify approvals
  resume. Check missing availability, multi-day conflicts, workload bias, exhausted
  candidates, inactive and anonymous reads, and direct API mutation attempts.
- Apply cleanup to synthetic linked events. Verify backup manifests, Youth IDs,
  history/RSVP/attendance counts, archived calendar exclusion, no new notifications,
  and that rerunning cleanup preserves a subsequently created Conference.
- At 1440px and 390px check EN/AR, RTL, navigation, date clicks, form errors,
  publish errors, loading/empty states, reload persistence, return to selected
  quarter and multi-page PDF output. Install the HTTPS app and test offline/reconnect.

Local sandbox limitations and final check results are reported in the handoff.
No production cleanup, migrations, real-account tests or member notifications are
performed by these development commands.

An updated optional browser harness is also provided:

```bash
VITE_DEMO_MODE=true VITE_SUPABASE_URL='' VITE_SUPABASE_ANON_KEY='' npm run dev -- --host 127.0.0.1 --port 5186
# In another terminal, launch an ISOLATED Chrome profile with remote debugging:
# Google Chrome --remote-debugging-port=9228 --user-data-dir=/tmp/kdec-calendar-chrome about:blank
node scripts/quarterly-ui-check.mjs
```

The harness resets storage only at the dedicated `127.0.0.1:5186` origin, seeds
five synthetic published types, checks EN/AR at 1440px/390px, persistence after
reload, no horizontal overflow, PDF print readiness and popup-blocking feedback.
Run it only against the explicitly demo-only server. It is separate from `npm test`.
