# Supabase setup

This guide configures the persistent backend for KDEC Worship. Demo mode is browser-local and does not require Supabase.

## 1. Create a project

Create a Supabase project in a region close to the team. Save the project URL and public anonymous key from **Project Settings → API**.

Do not put the service-role key in this application. Vite exposes every `VITE_*` variable to browser users.

## 2. Apply the database schema

For a new project, open **SQL Editor**, paste the complete contents of `supabase-schema-FULL.sql`, and run it once. Then run `MIGRATION_dynamic_roles_admin.sql` to install the normalized role catalogue, explicit access levels, permission matrix, audit log, and protected administration functions. Finally run `MIGRATION_qa_hardening.sql` to restrict private profile fields, install the safe member directory, enforce input integrity, and protect attendance expiry. Run the files in that order.

For an existing project:

1. Take a database backup.
2. Review and run `MIGRATION_security_data_integrity.sql` in **SQL Editor**. Do not rerun the fresh-install file over a deployed database.
3. Read the SQL Editor output. The migration is rerunnable and preserves legacy rows, but it deliberately emits a warning and skips a unique index when duplicate historical attendance, recurrence position/date, pending-excuse, open-substitute, or filled-substitute-candidate rows need manual reconciliation. It also warns instead of guessing when legacy recurrence cadence metadata is ambiguous or conflicting.
4. After cleaning any warned-about rows, rerun the migration and confirm that it completes without warnings.
5. Validate any constraints left `NOT VALID` after legacy cleanup, for example with `alter table public.excuses validate constraint excuse_exactly_one_target_check;`.
6. Run `MIGRATION_dynamic_roles_admin.sql`. It imports every legacy role name, creates role-ID relationships, preserves the legacy text columns as synchronized compatibility snapshots, and promotes the oldest active legacy administrator to the first Super Admin. Review the resulting access levels before inviting additional administrators.
7. Run `MIGRATION_qa_hardening.sql`. It is rerunnable and must be applied before deploying the matching client because the client loads team names through its safe directory function.

If `MIGRATION_security_data_integrity.sql` was already applied before explicit attendance dates and end times were introduced, run `MIGRATION_attendance_session_timing.sql` once. New upgrades do not need the smaller migration because the main migration already includes the same columns and RPC behavior.

`MIGRATION_multi_role.sql` only adds and backfills the legacy `roles` columns. It does not apply the later authorization hardening or synchronize the rest of an older database.

The security migration supersedes `MIGRATION_multi_role.sql`; do not run both on a newly upgraded database. It adds/backfills the multi-role fields itself.

Attendance QR tokens are secrets. Only administrators may select the base `attendance_sessions` table. Authenticated active members resolve one active, unexpired token through `get_attendance_session(text)` and check in/out through `check_in_attendance(text)` and `check_out_attendance(uuid)`. Direct member inserts or timestamp edits on `attendance_records` are intentionally denied. Every newly created session records an explicit organization-local date, start time, and end time. Arrival timing is classified as early, on time, or late using the configured grace period; departure before the scheduled end is early, while departure at or after the end is normal.

Attendance, excuse, substitute, and assignment-response rows are audit-bearing workflow state. Members answer an assignment through `respond_to_service_assignment(uuid, text)` with `confirmed` or `declined`; direct member updates to `service_team` are denied. Members submit service excuses through `submit_service_excuse(uuid, text)`, which declines their matching team assignment before creating the pending excuse in the same transaction; direct authenticated inserts into `excuses` are denied. Worship managers fill an open substitute request through `fill_substitute_request(uuid, uuid)`, which reuses only a compatible pending/confirmed candidate assignment (or creates a missing pending one), declines the requester, and stamps the resolution atomically. Members can cancel their own pending/open requests, while worship managers review or cancel them. These operations accept only scheduled, non-past services using the organization timezone. Physical deletion of services, events, attendance sessions/records, excuses, and substitute requests is intentionally unavailable to authenticated clients—cancel/close them instead. Identity, workflow state, reviewer/resolver, and timestamps are enforced by database triggers.

Worship managers extend an existing recurring service group through `generate_service_occurrences(uuid, uuid, jsonb)`. The source group must persist one consistent `recurrence_frequency` of `weekly`, `biweekly`, or `monthly`. The occurrence payload is a nonempty array of at most 52 objects with `date` and `recurrence_index` plus optional `title`, `time`, `type`, `notes`, and a matching `recurrence_frequency`. The database validates and locks the group/source, copies the server-owned frequency, creates every service under the authenticated manager, and copies the source team as pending in one transaction.

## 3. Configure the application

Create `.env.local` at the repository root:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
VITE_DEMO_MODE=false
```

Restart the Vite server after changing environment variables.

Configuration behavior is intentional:

- Development and production both default to live mode and fail closed when credentials are missing or still contain placeholders.
- `VITE_DEMO_MODE=true` enables browser-only demo mode only during local development and only when live credentials are absent.
- A production build can never enter demo mode, even if a stale demo environment variable remains configured.

## 4. Configure Auth URLs

In **Authentication → URL Configuration**:

- set the Site URL to the deployed application origin;
- add the local development origin while testing;
- allow the deployed `/reset-password` recovery URL.

The hosting provider must rewrite application routes to `index.html`. This repository already supplies the Vercel rewrite in `vercel.json`.

## 5. Bootstrap the first administrator

Use the trusted Supabase dashboard for the first account:

1. Create or invite the user under **Authentication → Users**.
2. Confirm that the signup trigger created its `profiles` row.
3. In **Table Editor → profiles**, set `status` to `active`, `access_level` to `super_admin`, `is_admin` to `true`, and `position` to `Admin`.
4. In **Table Editor → profile_worship_roles**, add at least one role assignment for that profile and mark exactly one assignment as `is_primary = true`. Use a role ID from `worship_roles`.

This manual step is only for the first trusted administrator. Create subsequent accounts through application invitations so the invitation email, role, expiry, and one-time redemption checks are applied.

## 6. Production verification

Before inviting the team, verify all of the following:

- the administrator can sign in and reload persisted data;
- Admin Control can create, rename, reorder, disable, reactivate, and safely replace a worship role, with the change still present after reload;
- worship-role changes never grant system access; only `access_level` and its permission matrix authorize protected actions;
- a member can hold multiple worship roles while exactly one is primary, and inactive roles remain visible on historical records but cannot be used for new assignments;
- an Admin cannot modify another Admin or Super Admin, while a Super Admin can, and the final active Super Admin remains protected;
- a new invitation works only for its intended email and cannot be reused;
- an ordinary member cannot change their role, status, position, or admin flag;
- an ordinary member can see safe team names on assignments but cannot select other members' full profile rows or open the People/WhatsApp routes without `users.view`;
- the last active administrator cannot be demoted, deactivated, or stripped of administrator status, including by concurrent updates;
- an inactive member cannot continue into the application;
- permitted users can create a song and service and see both after reload;
- an ordinary member cannot perform manager-only database mutations;
- an ordinary member cannot list attendance QR tokens or insert/edit an attendance record directly;
- a valid attendance QR resolves only while active and unexpired, a non-repeatable QR works only on its explicit organization-local session date, repeated scans are idempotent, capacity is enforced, the configured local-time grace period determines early/on-time/late arrival, scheduled end time determines early/normal checkout, and checkout affects only the signed-in member;
- cancelling a service deactivates every linked attendance session, cancels its pending excuses and open substitute requests in the same transaction, and its old QR can no longer resolve or check in;
- setlist inserts, removals, and song/service reassignment recompute `songs.usage_count`, while `last_used` tracks the latest linked non-cancelled service date and refreshes after relevant service changes;
- cancelled events and events whose effective end date has passed in the organization timezone reject new or changed responses;
- duplicate pending excuses, duplicate open substitute requests, and reuse of one filled candidate for multiple requests in the same service are rejected;
- `respond_to_service_assignment` rejects direct/member-cross-account writes, past or non-scheduled services, confirmation while an active excuse or filled replacement exists, and decline by a filled substitute;
- `submit_service_excuse` rejects an unassigned member or past/non-scheduled service, declines the caller's assignment and creates the pending excuse in one transaction, and direct authenticated excuse inserts are denied;
- a member cannot submit an excuse for another member, request a substitute for an assignment they do not hold, or mark either request approved/filled;
- a filled substitute cannot request their own replacement for that service, and assignments linked to an active excuse, open/filled requester request, or filled substitute cannot be deleted before the workflow is resolved;
- pending and approved excuses obey the configured total/monthly/weekly active allowance in the organization timezone, including a zero limit that blocks all new excuses; rejected/cancelled requests do not consume it;
- `fill_substitute_request` rejects non-managers, closed requests, past/non-scheduled services, invalid/self/duplicate substitutes, and conflicting candidate assignments; it never overwrites an existing candidate role or declined status;
- `generate_service_occurrences` rejects invalid, stale, duplicate, past, empty, oversized, or frequency-inconsistent occurrence payloads and leaves no partial services or copied assignments when any row fails;
- invalid organization timezones are rejected and the singleton settings row remains `id = 1`;
- password recovery returns to `/reset-password` on the deployed origin;
- a direct link such as `/services/<id>` loads instead of returning a hosting 404.

Use browser developer tools and Supabase logs when a write fails. Do not convert a Row Level Security failure into an optimistic success message.

## Deploy

Install all dependencies, including build-time development dependencies, then build:

```bash
npm ci
npm test
npm run lint
npm run build
```

Publish `dist/` and configure the two Supabase variables in the hosting environment. Vercel is configured by `vercel.json`. For another static host, add an equivalent SPA fallback to `index.html`.

## Troubleshooting

- **Configuration required screen:** verify both Supabase values are present and the URL is an HTTP(S) URL.
- **Unexpected demo data:** remove `VITE_DEMO_MODE=true`, configure Supabase, and restart the server.
- **Auth works but data writes fail:** inspect the Supabase response and RLS policies for the signed-in profile's active status and roles.
- **Recovery or deep link returns 404:** add the route to Supabase's redirect allow-list and configure the host's SPA rewrite.
- **Old database lacks roles:** run `MIGRATION_security_data_integrity.sql`; it includes the legacy roles backfill and the current policy/trigger hardening.
- **Admin Control reports missing tables/functions:** run `MIGRATION_dynamic_roles_admin.sql`, then sign out and back in so the new access level and role assignments reload.
- **The app reports `get_member_directory` is missing:** run `MIGRATION_qa_hardening.sql`, then reload the application.
- **Security migration prints a skipped-index warning:** query the duplicate key named in the warning, reconcile the historical rows without discarding audit evidence, then rerun the migration.
- **A legacy constraint remains `NOT VALID`:** new writes are already protected. Audit/fix older violating rows, then run `alter table ... validate constraint ...` during a maintenance window.
