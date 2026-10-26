# Quarterly scheduling verification — 26 October 2026

## Existing behavior retained

Manual service creation, explicit recurrence, monthly/list schedules, team roles,
setlists, notes, private excuses and unpublished legacy substitute requests already
existed. The new workflow reuses those records, the existing active-member checks,
the permission matrix and canonical worship-role IDs. No account, password or
production record was changed during this work.

## Implementation

Added quarter publication, a persistent schedule inbox, read-only team-wide
schedule visibility, member responses, private weighted replacement proposals,
confirmed-leader approval, Super Admin-only leader replacement, unavailability
handling, audit history and English/Arabic branded PDF export. Published source
assignments stay synchronized for older reports and excuse handling. Recurrence
copies the current team instead of assigning declined historical members again.
Automatic weekly generation is disabled; existing services remain stored.

Notifications are in-app. Replacement selection uses explicit weekly availability,
optional time windows and whole-day service/rehearsal conflicts. Weighting favors
lower workloads without imposing a hard assignment cap. Published preparation is
locked; corrected meetings are created and published separately. The complete rules
and deployment steps are in `QUARTERLY-SCHEDULING.md`.

## Checks completed locally

| Check | Result |
| --- | --- |
| `npm test` | 83 passed, 0 failed; no browser or external service required |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Complete base schema + dynamic roles + QA hardening + new migration | Applied successfully to isolated PostgreSQL |
| Migration rerun | Passed; no data reset |
| Publish twice | One set of slots and notifications |
| Confirm, decline, approve/reject, replacement confirm then decline | Passed |
| Role, time window, missing availability, same-day draft conflict | Unsuitable candidates excluded |
| Proposal privacy and notification order | Candidate not notified before approval; ordinary members cannot read proposals |
| Leader decline and later availability loss | Super Admin selection required; ordinary approvals paused until leader confirmation |
| Exhausted candidates | Clear unresolved vacancy; no repeated rejected/declined candidate |
| Inactive/anonymous accounts and direct assignment writes | Denied by database authorization |
| Private excuse | Decline and excuse atomic; invalid excuse rolled the decline back |
| Legacy assignment consumers and recurring-series copy | Current responses/replacements synchronized; declined history not copied as new assignments |
| Concurrent approvals | Two independent requests yielded one assignment and one notification |
| Persistence | Approved assignment, notification and history matched from fresh database connections |
| Weighted selection simulation | 10,000 seeded trials favored lighter workload while retaining a nonzero chance for heavier members |
| Browser preview/reload | Passed at 1440px and 390px, in English and Arabic/RTL; manually created services retained; no horizontal overflow or runtime exceptions |
| Actual Export PDF button | Print document loaded, RTL/row content checked, print invoked; blocked popup showed an error |
| PDF visual QA | EN and AR samples with 15 services/120 assignments each rendered to 16 landscape A4 pages; all pages reviewed in contact sheets plus enlarged selected pages; readable long names, repeated headers, page numbers and no clipping observed |

Database checks used synthetic identities and a local Auth identity stub. The
complete workflow scenario rolls back account/assignment data. The concurrency
check used a disposable local database and removed it afterward. No real member
received a notification.

## Live verification still required

The new migration and frontend have **not** been deployed to Supabase/Vercel.
Browser-to-Supabase operation with real Auth sessions, PostgREST, the deployed
permission matrix and the live print experience on Safari/mobile devices remain
unverified. Local browser tests used demo preview data; secured responses and
approval transitions were exercised separately against PostgreSQL.

Before real use: follow `QUARTERLY-SCHEDULING.md`, deploy to the separate test
project, complete its synthetic-account acceptance checklist after reload, then
apply the approved migration and frontend release to production. Demo mode cannot
publish or approve secured quarterly assignments.
