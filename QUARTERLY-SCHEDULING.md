# Quarterly scheduling: setup and verification

## Deployment

1. Back up the current database. Use the separate Supabase test project for acceptance testing first; no production migration has been applied by this change.
2. For an existing, up-to-date KDEC database, open that project's **SQL Editor**, paste the entire `MIGRATION_quarterly_scheduling.sql`, and run it. It is transactional and rerunnable. Do not rerun `supabase-schema-FULL.sql` over existing data.
3. For a fresh database, first follow `SUPABASE-SETUP.md`: full base schema, dynamic roles, QA hardening, song bulk management and any required attendance/rehearsal upgrades. Run the quarterly migration last, after any legacy weekly/youth migration.
4. Confirm SQL Editor reports success. The migration creates `schedule_quarters`, `schedule_slots`, `schedule_attempts`, `schedule_notifications` and `schedule_audit`, with RLS and protected RPCs. It reloads the API schema cache. No Edge Function, SMTP setting, cron job, service-role browser key or additional dependency is required.
5. Run `npm test`, `npm run lint`, and `npm run build`, then deploy this frontend through the existing Vercel project. Keep the existing public Supabase environment variables pointing to the same project. Retain the SPA rewrite in `vercel.json`.
6. On the **test deployment**, complete the acceptance steps below with synthetic accounts before publishing a real quarter. Do not run scripts or SQL under `test/sql/` against Supabase.

## Manager and member workflow

1. In Services, manually create the quarter's meetings. Assign exactly one Worship Leader and the required team members; enter rehearsal details before publication. Review the dates, 12-hour time display, roles and availability.
2. In Schedule, choose the year and quarter, then **Publish quarter → Publish and notify**. A manager needs `schedules.manage`. Only upcoming scheduled services are published. Existing response states are retained. Publishing again is idempotent; **Publish added services** adds newly created services without resetting published ones.
3. Each assigned member receives a persistent in-app notification and can confirm or decline in Schedule, their home page or service details. The bell opens Schedule when there are unread schedule messages. The inbox refreshes every 30 seconds while the tab is visible, without reloading the page; use Refresh for other people's latest responses.
4. An ordinary decline creates a vacancy. If the Worship Leader has confirmed, the server proposes a suitable replacement and notifies only that leader. The leader can approve or reject from Schedule. Rejection selects another candidate. Approval sends the candidate a pending assignment notification; they must confirm or decline themselves. A replacement can decline even after confirming.
5. A leader decline, inactive/on-leave status, or availability change that makes their assigned meeting unavailable creates a leader vacancy. Only Super Admin sees the selection control. Server checks still enforce role, availability and conflicts. Ordinary approvals pause until the replacement leader confirms. Existing private proposals are retained and the new leader receives them after confirmation.
6. When nobody qualifies, the vacancy stays unresolved. The leader can review availability/roles and retry. Super Admin can correct account/availability data; the workflow does not silently override eligibility or force an ordinary candidate assignment.
7. Active members can view all services, rehearsals, roles, confirmed/pending assignments and vacancies. Private proposals and decision history are restricted by RLS to the confirmed service leader and Super Admin. Contact information and private excuse reasons are excluded from quarterly exports.
8. Use **Export PDF** and choose **Save as PDF** in the browser print dialog. Allow the print window, use landscape A4, and leave background graphics enabled for branding. The export contains the logo, quarter/year, export timestamp in Cairo time, status legend, repeated headers and page numbering. Arabic uses a mirrored table and system Arabic-capable fonts. No third-party PDF service receives team data.

## Business rules and compatibility

- Notifications here are **in-app**, with no email or WhatsApp sent automatically.
- The migration marks the existing canonical **Worship Leader** role by ID with `schedule_leader_role`. Later display-name changes preserve that identity. Initial services must contain exactly one such role. Newly invented role names do not automatically become leader roles.
- Replacement eligibility requires an active profile, an active matching canonical role and explicit weekly availability for both the service and any enabled rehearsal. If time windows exist for a day, the start time must fall inside one. Missing weekly availability excludes the member from automatic proposals. An availability edit that makes an existing assignment ineligible vacates it and records the decision; reactivation does not resurrect old assignments.
- Conflict detection conservatively reserves the **whole service/rehearsal day**, since services have no reliable end-time field. Draft assignments and outstanding proposals reserve those days too. Same-service duplicate assignments/proposals are excluded.
- A decline in any slot excludes that person for that service. Rejected proposals and previously attempted candidates are not repeated for that slot.
- Weighted random selection uses `weight = 1 / (1 + A + 2R)`. `A` counts current published assignments plus non-declined draft assignments during the quarter, without double-counting the legacy compatibility rows. `R` counts replacement proposals/offers still proposed, notified, confirmed or declined during the quarter. Rejected private proposals do not penalize the candidate. A lighter workload increases the chance of selection; this is a preference, not a hard assignment cap or guaranteed equal rotation.
- Quarter publication, response, proposal, approval and retry use one transaction lock plus row locks and uniqueness constraints. Notification dedupe keys make retries safe. Original assignments, every candidate attempt and the decision audit remain persisted. Approved/declined responses are synchronized to legacy assignment rows for reports and excuses; original declined rows remain as history.
- Existing **unpublished** services keep their current editing and legacy substitute workflows. Services with open/filled legacy substitute requests must stay in that workflow, or have those requests resolved before publication. New manual substitute requests cannot bypass approval on published services. Private service excuses remain transactional with the quarterly decline.
- Explicitly extending a recurring series from a published meeting copies only the current approved/pending team, excluding the declined history retained for reports.
- Published dates, rehearsals and source team assignments are locked against old clients and direct writes. Setlists and notes remain editable. To change a published meeting, cancel it and create/publish a corrected meeting. Existing services, including previously generated weekly meetings, are never deleted by this migration.
- Demo mode supports quarter previews and PDF export. Publishing and approval deliberately require the server; browser-local demo data does not simulate secured writes or send notifications.

## Isolated checks

`npm test` remains browser- and service-independent. It covers quarter boundaries, normalization/pagination, the PDF's privacy/escaping and a seeded 10,000-selection workload simulation.

Optional database tests require a **dedicated local** PostgreSQL instance listening at `127.0.0.1:55439`. They use synthetic UUIDs, no actual Supabase Auth credentials and no email sender. `test/sql/auth-stub.sql` models only the Auth identity needed for RLS, not the Supabase Auth service itself.

For an empty dedicated local base-fixture database:

```bash
psql -h 127.0.0.1 -p 55439 -d postgres -v ON_ERROR_STOP=1 -f test/sql/quarterly-fixture.sql -f MIGRATION_quarterly_scheduling.sql -f test/sql/quarterly-workflow.sql
```

The scenario rolls back its account/assignment data. Run the fixture only once in an empty local database. For the complete existing schema integration:

```bash
createdb -h 127.0.0.1 -p 55439 kdec_full_schema_test
psql -h 127.0.0.1 -p 55439 -d kdec_full_schema_test -v ON_ERROR_STOP=1 -f test/sql/auth-stub.sql -f supabase-schema-FULL.sql -f MIGRATION_dynamic_roles_admin.sql -f MIGRATION_qa_hardening.sql -f MIGRATION_quarterly_scheduling.sql
node scripts/quarterly-full-schema-check.mjs kdec_full_schema_test
node scripts/quarterly-concurrency-check.mjs
```

The local roles `anon`/`authenticated` must already exist (the base fixture creates them). Set `KDEC_TEST_PSQL` to the absolute `psql` path when it is not on PATH. The concurrency script creates and removes only its dedicated `kdec_concurrency_test` local database. It sends identical approvals over two independent connections and checks a single assignment/notification plus persistence from fresh connections. These optional checks are deliberately separate from `npm test`.

For PDF visual QA, `node scripts/quarterly-pdf-fixture.mjs` produces synthetic EN/AR print HTML under `/tmp/kdec-quarter-pdf`. Print each to PDF with headless Chrome or the browser, then render with `pdftoppm` for inspection. The fixture has 15 services, 120 assignment rows and long bilingual names. The optional `quarterly-ui-check.mjs` uses an isolated Chrome debugging session on port 9228 and a **demo-only** Vite server on port 5186. It checks desktop/mobile widths, RTL, no horizontal overflow, persistence after reload, print readiness and blocked-popup feedback; it clears storage only in that isolated local origin.

## Acceptance on the separate Supabase test project

Use synthetic manager, Super Admin, leader, original member, three matching replacement candidates, an inactive account and a wrong-role account. Set matching roles and weekly availability in their profiles. Avoid production accounts.

1. Create one future service and earlier rehearsal, assign its leader and member, publish, then reload each test account. Check inbox notifications, member names and statuses. Publish again and verify no duplicate messages.
2. Confirm the leader. Decline the member. Verify the proposed candidate has no assignment notification yet and ordinary accounts cannot view the proposal or edit another member's response.
3. Reject once, approve the next candidate, then sign in as that candidate and confirm. Reload. Decline again and verify a fresh candidate appears without repeats.
4. Decline the leader or change the leader's availability/status. Verify ordinary admins cannot select a new leader and cannot approve ordinary replacements. Select a replacement as Super Admin; confirm as that leader and verify approvals resume.
5. Remove candidate availability, introduce a same-day conflict and test a wrong role/inactive profile. Verify those candidates are excluded and exhaustion produces an unresolved vacancy. Test two approval clicks from separate leader sessions.
6. Submit a private service excuse and verify the assignment decline and excuse either both persist or both fail. Check older reports and service details reflect the approved replacement after reload.
7. Check English/Arabic, RTL, mobile navigation, the bell/inbox, and Save as PDF with a multi-page quarter. Confirm anonymous/inactive accounts cannot read the schedule through the API.

Local PostgreSQL tests exercise persistence, authorization, notification ordering, legacy triggers and concurrency. Local browser checks exercise the demo preview and PDF layout. **A deployed browser-to-Supabase acceptance run, real Auth sessions, production RLS installation and the live Vercel release remain unverified until these deployment steps are completed.** No real member was notified during local testing.
