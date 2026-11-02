# Ministry ratings, evaluations and reports

## Installation

For a **new project**, apply the current `supabase-schema-FULL.sql` once. It now bundles the dynamic-role, song-content, quarterly-calendar and custom-attendance prerequisites and the ministry extension. Do not replay older workflow migrations afterward: they replace shared permission and calendar functions.

For an **existing project** already using the current calendar and attendance workflows, back up the database and apply `MIGRATION_ministry_insights.sql` **last**, after `MIGRATION_attendance_custom_events.sql` and the previously required upgrades. Existing web-push setup remains intact. Deploy the matching frontend after the migration. The migration can be rerun without resetting criteria, assignments or history. It sends no notifications during installation.

The extension does not create real ratings, historical responses, stage appearances or origin years. Old records remain unknown until an authorized person records them. The UI shows a setup error when the migration is unavailable; production never falls back to demo mode.

`node scripts/sync-ministry-schema.mjs` updates the bundled fresh schema after editing the upgrade SQL. This is a file-generation command, not a database command.

## Access roles

Super Admins assign additional roles from **Team → Status & ratings → Additional access roles**. Roles compose with the person's existing base access level; adding a narrow role does not remove permissions granted by another role.

| Additional role | Profile ratings | Confidential service evaluations | Reports | Other access |
| --- | --- | --- | --- | --- |
| Super Admin | All audiences; configure criteria | Read/write all; see revisions | All | Assign additional roles and manage members |
| Technical Admin | Read/write all audiences; configure criteria | Read all; create/edit own evaluations | All | Read member directory/contact data |
| Musical Admin | Read/write musician, vocalist and worship-leader profile ratings | No access | Only if another role grants it | Read member directory/contact data |
| Pastoral Admin | No access unless another role grants it | No access | All attendance, participation and inactivity reports | Read member directory/contact data for follow-up |
| Worship Leader | No access unless separately granted | No access | Assigned, non-declined worship-leader services only | Safe team names already available through the existing directory |
| Ordinary Admin | Profile ratings under the existing permission matrix | No access without Technical Admin | Existing report permissions | Existing administration permissions |
| Ordinary member / anonymous / inactive | No new privileged access | No access | No new broad access | Existing access rules remain |

Evaluation access is an exact database check for **Technical Admin or Super Admin**. A generic admin flag, rating permission, or wildcard client permission does not grant it. Evaluation revisions use the same RLS boundary; feedback is never included in general reports, exports, notifications or profile-rating history.

Report readers receive sanitized attendance-session metadata through `get_report_attendance_sessions`; it omits QR tokens. QR session access and mutation remain with service/schedule managers. Own-service reporting is also enforced on attendance records, stage records and response history.

## Members and guests

Account status still controls sign-in. **Serving status** independently records active, temporarily inactive, leave or former-member status. Participation category records team member or audition/newcomer. Changes are timestamped for future historical reporting; leave dates before tracking began are not invented.

**Guest contributors** are separate records without authentication accounts. Create/edit them under the Guest contributors tab, then assign an active guest and matching role from an event's Participants & service records panel. Guests appear in relevant assignment, stage and evaluation views. Existing historical guest assignments are retained if a guest becomes inactive.

Available-day checkboxes and the member availability grid were removed. Existing saved weekday data is retained but no longer excludes replacement candidates. Explicit availability time slots, conflict checks, active-account checks, member roles and serving status still apply to replacement eligibility.

“Worship leader quote” is implemented as optional profile text, not a service quota. It can be changed independently later if the intended requirement is a service target.

## Rating and feedback workflows

Technical Admins and Super Admins manage criteria under **Evaluations → Rating settings** or **Team → Customize rating criteria**. Criteria have English/Arabic names, audience, whole-number scale, weight, order and active/archive state. Edits create immutable versions; historical score snapshots retain their original name, bounds and weight. There are no automatic member scores.

Profile ratings are appended to member history. Missing values are excluded from the weighted normalized percentage, not scored as zero. `100 × (value − minimum) / (maximum − minimum)` normalizes each rated criterion, then the weighted mean is calculated using rated criteria only.

For post-service feedback, select a completed service and a participant in **Evaluations**. The phone layout puts the member, rating buttons and optional comment first; changing the service/audience is collapsible. Save a draft, submit, or submit and move to the next member. Each evaluator has one record per service/member/audience, with revision history and stale-edit protection. Guest participants are supported. Archived criterion values remain visible in revision history; a new edit uses the current active criteria.

Managers can mark a published service completed after its scheduled Cairo end time. Mark actual stage participation explicitly from the service panel. Confirmation and QR attendance are not automatically converted into stage appearances.

A completed service's setlist must be explicitly finalized to enter song averages. Editing its song rows invalidates finalization, requiring a fresh review. An explicitly finalized empty list counts as zero; an unfinished list is excluded.

## Song metadata and tags

Origin year is separate from the date the song record was added. Unknown years are allowed. Tags reuse the existing `songs.themes` relationship and a reusable catalogue. Song editing, filtering and reports share those values. Tags can be renamed, archived, or merged into an existing tag; renames/merges update linked songs transactionally. Archived tags remain in history and remain available as filters when used by existing songs.

## Schedule imports

**Schedule → Bulk upload** supports UTF-8 CSV and XLSX, a template, column mapping, validation, preview, member-identity resolution and explicit confirmation. One row represents an assignment; repeated event details group assignments into one event. Use ISO dates and 12-hour times such as `6:00 PM`; 24-hour input and ordinary Excel time cells are also accepted.

Imports create **new silent drafts only**; they never overwrite or publish existing schedules. Duplicate events, repeated members, ambiguous identities, role mismatches and invalid date/time ranges block the import. The database repeats validation and writes the whole batch transactionally. Limits are 52 events, 1,000 source rows and a 2 MB upload. Guest assignment uses the dedicated event guest picker after import; the member column resolves team-member accounts.

## Report definitions

Report filters are stored in the URL and survive reload. Active-tab exports use the same selected rows as the on-screen report. Member/role/category/status, dates/quarters, service type/subcategory, worship leader, song metadata and stage-count filters are available where relevant. Cancelled and archived events are excluded from normal activity totals; cancellation history is preserved in the database. The main calendar no longer shows a cancelled-events control.

- **Scheduled:** distinct matching service assignments known from the current team or recorded response history. General participant lists and scheduled rehearsals are separate columns.
- **Recorded attendance:** distinct QR session/occurrence check-ins across all event types, including recurring sessions. It does not infer attendance from an assignment or RSVP.
- **Stage appearances:** distinct completed services explicitly recorded as played/sang. Missing records mean unknown, not confirmed absence.
- **Recorded activity:** distinct recorded attendance occurrences and stage services; a service QR session at the service time and a stage record for the same occurrence are counted once. Separate rehearsal sessions remain distinct.
- **Quarterly inactivity:** use the year/quarter preset and quick filters for no recorded activity, no assignments, no confirmations, no attendance or no stage records. Join dates exclude pre-membership periods. Recorded serving-status history can exclude a full leave period; older leave history may be unavailable. Current/future quarters are provisional.
- **Response outcomes:** unique requests classified by their latest recorded accept/decline. Acceptance and rejection action counts separately include changed answers. Repeat clicks that do not change state do not add history.
- **Pending / expired:** unanswered assignments on published services are pending while the response window is open. They are classified as expired unanswered when the event is completed or its Cairo date is past, matching the existing response state machine. Unpublished draft assignments are not treated as sent requests.
- **Response speed:** first response minus actual request-notification time. Acceptance/rejection speeds use the first respective action per request. Missing or invalid timestamps are excluded; pending requests are not zero-minute responses. Historical answers before this migration are not fabricated.
- **Average songs per set:** matching song occurrences divided by completed, explicitly finalized sets, including finalized empty sets. Song filters count matching songs per eligible set, so a set without a matching song contributes zero.
- **Worship-leader attribution:** one primary non-declined leader per service, identified by the canonical leader role. Leader reports show total services, finalized sets, song occurrences, unique songs and the average per set.
- **Added songs:** records whose creation date falls in the selected Cairo period. Rows without a known added timestamp are not counted as new additions.
- **Introduced songs:** first known finalized use across all available historical services falls in the selected scope/period. This does not claim an original introduction date when earlier setlists are unavailable.
- **Key/scale counts:** distinct song-library entries grouped by their stored original key, preserving major/minor and enharmonic spellings. This is separate from the transposed key of a particular performance.
- **Early checkout rate:** early checkouts divided by check-ins with a recorded checkout and a reliable early/normal departure classification, multiplied by 100. Missing checkouts and unknown end times are excluded. The sample size is shown. Member summary and export omit Early-arrival and Normal-out columns; the detailed record history remains intact.

## Verification

Run `npm test`, `npm run lint` and `npm run build`.

The optional integration check needs an isolated PGlite installation, not live Supabase credentials:

```sh
KDEC_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/ministry-sql-check.mjs
```

It checks both fresh-install and upgrade paths, reruns the migration, and uses only synthetic accounts. It covers role isolation, direct-write denial, evaluation revisions, historical criteria, stage visibility, sanitized attendance metadata, response clocks/idempotency, song metadata/tag writes and atomic schedule-import rollback. Never run files under `test/sql/` in a real Supabase project.

For UI QA, start an isolated explicit demo on `127.0.0.1:5190`. Initialize it through the normal demo sign-in, then optionally open `/test/fixtures/ministry-preview.html` and press its fixture button. It adds synthetic records while retaining existing demo rows and refuses to run on other hosts/ports. This fixture is a test source file and is not included in the production bundle. Demo persistence is browser-local; production Supabase verification must still be performed in the target deployment after applying the migration.

### Verification recorded on 2 November 2026

- `npm test`: 165 passed, no failures.
- `npm run lint`: passed.
- `npm run build`: passed; the existing Browserslist-data warning remains non-blocking.
- Isolated ministry SQL check: fresh schema, upgrade path, reruns and workflow scenarios passed.
- Existing isolated web-push SQL check: fresh and upgrade scenarios passed after the schema changes.
- Browser-local demo at 390px: evaluation submission and reload, Arabic/RTL without page overflow, member/newcomer profile rating persistence, song year/tag persistence, actual-stage reporting, finalized-set averages, CSV import/reload and ordinary-member evaluation-route denial verified.
- The target live Supabase project was not migrated or deployed. Its final production reload/permission smoke check remains a deployment step.
