# Attendance, custom events and QR deployment

The implementation uses the existing Supabase profiles, services, attendance records,
calendar RPCs, draft/publish workflow and English/Arabic layouts. There is no second
calendar or authentication setup.

## Existing Supabase projects

1. Back up the database using your normal Supabase backup/export process.
2. On an isolated Supabase test project, verify that the existing migrations through
   `MIGRATION_unified_calendar.sql` have been applied. The exact prerequisite order
   is in `UNIFIED-CALENDAR.md`.
3. Open Supabase Dashboard → the correct project → **SQL Editor → New query**.
   Paste the complete contents of `MIGRATION_attendance_custom_events.sql` and run
   it as the project's database administrator. It contains its own transaction and
   PostgREST schema-reload notification. Run this migration **last**, after the
   calendar migrations. It is safe to reapply; it does not delete attendance rows.
4. Build the matching frontend: `npm ci`, `npm test`, `npm run lint`, `npm run build`.
   Deploy that version through the existing Vercel project. Keep the existing
   Supabase URL, public anon/publishable key, auth redirect URLs and hosting routes.
   Never put a service-role key in a `VITE_` variable. Production demo mode must stay
   disabled. No new environment variable or external QR service is required.
5. Follow the staging checklist below, then repeat the migration and normal Vercel
   deployment against production. Do not rerun `supabase-schema-FULL.sql` on an
   existing database. Do not rerun older calendar migrations after this migration;
   they replace some of the same functions. If you do, reapply this feature last.
6. Reload the app. For an installed PWA, use its existing update/reload action once
   work is saved. This feature does not change the installed icon or app identity.

**Existing printed QR codes must be replaced.** The previous session-wide code is
no longer accepted. Open Attendance → the session → QR to generate its occurrence
code, then download or print a replacement. Existing attendance records remain.
Reopening the same occurrence retains its code, including its revoked state;
explicit regeneration creates a new valid code.

If SQL fails, the transaction rolls back. Share the actual error and resolve the
prerequisite rather than deploying a frontend against an incomplete schema.
Rolling back only the frontend is insufficient: old clients use the retired QR
workflow. Keep deployment artifacts aligned with the migrated database.

## Fresh Supabase projects

Apply these files in order:

1. `supabase-schema-FULL.sql` (once; its attendance section is also updated).
2. `MIGRATION_dynamic_roles_admin.sql`.
3. `MIGRATION_qa_hardening.sql`.
4. `MIGRATION_song_bulk_management.sql`.
5. `MIGRATION_rehearsal_before_service.sql`.
6. `MIGRATION_quarterly_scheduling.sql`.
7. `MIGRATION_unified_calendar.sql`.
8. `MIGRATION_attendance_custom_events.sql` **again, last**. The preceding migrations
   install earlier calendar/attendance function versions. This final step installs
   the current versions, permissions and occurrence-code workflow.

Finish the project's normal account/bootstrap and Vercel setup. Do not run anything
under `test/sql` against a real Supabase project; those files are isolated test
scaffolding, not application migrations.

## Behavior and permissions

- **Attendance settings:** `settings.manage` can disable the default grace period or
  enter any non-negative PostgreSQL integer of minutes (including zero). Plus and
  minus change exactly one minute. Saving is explicit and persists to Supabase.
- **Per event:** authorized calendar managers can choose Default, Custom minutes or
  **Remove tolerance entirely (0 minutes)** in the form or event details, including
  an already published event. This changes only attendance options; published
  schedule dates, original assignments and quarterly permissions remain locked.
  Attendance tracking can be disabled separately.
- **Per session:** attendance managers (`services.edit` or `reports.view`) may use
  the event/default policy, set custom minutes or remove grace. The effective
  minutes are displayed before creation and on the session card. New sessions
  snapshot that value. Changing the organization default affects new sessions.
  Explicit event policy edits also update inherited sessions for future check-ins.
- **Late rule:** check-in is late strictly AFTER scheduled start plus effective
  minutes. At 19:03:00 with a 19:00 start and three minutes, arrival is on time;
  19:03:00.001 is late. Zero grace still marks arrival after the start as late.
  Dates and scheduled timestamps use `Africa/Cairo`. Minutes late mean elapsed
  minutes after the scheduled start, rounded up when late, not minutes beyond
  the grace period.
- **History:** each check-in freezes scheduled timestamps, effective tolerance and
  arrival classification. Later defaults do not reclassify it. Legacy records
  retain their saved present/late status; their original historical tolerance is
  unavailable, so the migration records the available policy as an estimate.
  `reports.view` can open People → member name/Attendance history and filter dates,
  event type and status. Members may read their own history only. Totals count
  recorded attendance (including late), late arrivals, recorded absences and
  excuses. A missing check-in never creates an absence.
- **Custom schedule events:** select Custom event, supply title/category and dates,
  start/end times, location/link, optional notes, participants and attendance flag.
  They share the existing calendar, list, filters, details and silent draft save.
  Recurrence and series extension preserve these fields and remain unpublished.
  Only the existing explicit quarter-publish action publishes and notifies actual
  team assignees; participants do not bypass assignment/response rules.
- **QR:** every session/occurrence has its own server-generated 64-character random
  token. The QR includes no personal data. Clients cannot enumerate token rows or
  supply token/expiry/creator through session table writes. Rotation/revocation
  and check-in lock the parent session. Check-in requires normal active-member
  authentication, validates publication/attendance/expiry, respects capacity, and
  reuses an existing record for duplicate scans. Rotation invalidates the old
  token; revocation stays in effect until regeneration. Closing stops the session.
  Codes open at Cairo midnight on the occurrence date and expire at the earlier
  of session expiry and occurrence end + six hours. Repeating sessions expire
  90 days after creation or their initial scheduled end, whichever is later.
- **QR card:** approved logo outside the QR, high contrast and white quiet space,
  title/date/time, SVG download, print dialog and native fullscreen with an expanded-dialog fallback. Scanning alone
  does not prove physical presence. Attendance data/API responses are not added
  to service-worker caches.

بالعربي: افتح تفاصيل الفعالية ← «حضور هذه الفعالية وسماح التأخير» ←
«إلغاء السماح تمامًا (صفر دقيقة)» ← «حفظ إعدادات الحضور». إلغاء السماح يخص
هذه الفعالية؛ لا يمسح السجل القديم ولا يوقف تسجيل الحضور. لإيقاف التسجيل نفسه،
ألغِ اختيار «تفعيل تسجيل الحضور لهذه الفعالية».

## Automated verification

- `npm test`: 121 tests passed, including new tolerance, exact boundary, frozen
  history, Cairo dates, custom recurrence and export-escaping tests.
- `npm run lint` and `npm run build`: passed (the existing Browserslist age warning
  is informational).
- Isolated in-memory PostgreSQL/PGlite: fresh schema + all listed prerequisites +
  feature migration + reapplication, an upgrade with a persisted legacy record,
  current calendar workflow, and the new
  attendance workflow passed. Synthetic identities only, rolled back. Checks cover
  manager/admin/member/inactive/anonymous access, record RLS, self/other history,
  filters, custom draft persistence, publication, series extension, stable/distinct
  QR codes, rotation, revocation, closed/expired/invalid codes, duplicate scans,
  checkout, immutable snapshots, zero grace and exact timestamp boundaries.
- No real Supabase project, real accounts, email or WhatsApp provider was used.
  PGlite has one connection, so this is not a multi-connection load/race test.

Reproduce SQL verification without touching Supabase:

```sh
npm --cache /tmp/kdec-sql-cache install --prefix /tmp/kdec-sql-tools @electric-sql/pglite@0.5.14 --ignore-scripts --no-fund --no-audit
KDEC_PGLITE_MODULE=/tmp/kdec-sql-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/attendance-sql-check.mjs
```

## Checks still required on staging and phones

The browser service was unavailable after the workspace reconnected. Actual UI
interaction, reload persistence through a deployed Supabase API, print/download,
physical QR scanning and iPhone/Android visual checks have **not** been verified.

Use isolated admin/manager, active member, inactive member and anonymous sessions:

1. Save default 3, reload, then test +1, −1, direct 0 and disabled. Reject negative,
   blank and fractional input. Save an event-specific zero-grace rule and reload.
2. Create a custom draft with notes/location/participants, reload, check calendar,
   list/type filter/detail and recurrence. Verify no notification on draft save.
   Publish only a synthetic quarter, then confirm the published assignment rules.
3. Create linked attendance, reopen QR and compare the link. A different session
   or occurrence must differ. Regenerate: old link must fail; revoke: new link must
   fail; regenerate, close and test again. Test future, expired and malformed links.
4. Scan on iPhone/Android, sign in normally, check in twice and check out. Expect one
   persisted attendance row. Reload and open that member's history as admin;
   filter it and change defaults. Historical status/tolerance must remain unchanged.
5. Attempt another member's history and token-table reads with the member's session;
   deny them. Inactive/anonymous users must not resolve or check in to a session.
6. Inspect English/Arabic RTL at 390px, light/dark mode, safe areas and the keyboard;
   confirm no horizontal overflow and reachable modal actions. Download the SVG,
   print it, expand its display and test scanning the actual output. Use the
   existing PWA update flow to confirm the deployed frontend revision is active.
