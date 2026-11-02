# KDEC Worship Web Push

The implementation uses standard encrypted Web Push with VAPID and a Supabase
Edge Function. Installation alone does not enable notifications. Each device must
opt in while signed in; account preferences are shared between devices.

## Deployment

1. Apply the existing setup/migration order in README first, including dynamic
   roles, QA hardening, quarterly scheduling, unified calendar, and
   `MIGRATION_attendance_custom_events.sql`. Then apply **`MIGRATION_web_push.sql`
   LAST** in Supabase SQL Editor. It is rerunnable and does not replay old events.
   The fresh schema includes the same definitions, but its notification triggers
   activate only once the quarterly tables exist: run the push migration last
   for fresh installations too. Do not rerun the full schema on an existing DB.
2. Generate one persistent P-256 VAPID key pair locally with Node:

   ```sh
   node --input-type=module -e "import {createECDH} from 'node:crypto'; const pair=createECDH('prime256v1'); pair.generateKeys(); console.log(JSON.stringify({VAPID_PUBLIC_KEY:pair.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:pair.getPrivateKey().toString('base64url')},null,2))"
   ```

   Treat the private key as a secret. Store it in your password/secret manager;
   do not paste it into source control, browser code, screenshots, or chat.
   Reusing the same pair keeps existing subscriptions valid. Key rotation requires
   members to disable and re-enable their devices.
3. Configure the public frontend variable **`VITE_VAPID_PUBLIC_KEY`** with the
   public key. Rebuild/deploy the frontend over HTTPS. Production configuration
   still requires the Supabase URL and public publishable/anonymous key.
4. Set these Edge Function secrets using the Supabase dashboard or
   `supabase secrets set --env-file /path/to/private-server-env-file`:

   | Name | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | Same public key as the frontend |
   | `VAPID_PRIVATE_KEY` | Private key; server only |
   | `VAPID_SUBJECT` | A real operator contact, e.g. `mailto:operator@your-domain.org` |
   | `PUSH_DISPATCH_SECRET` | Independently generated high-entropy secret, server only |

   Generate the dispatch secret with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by hosted Supabase
   Edge Functions. For isolated local Edge testing, supply their local values.
   Never put any private/server key in a `VITE_*` variable. The build guard rejects
   known notification-secret variable names. The server env template is
   `supabase/functions/.env.example`; create your private copy outside the repo.
5. Deploy only when ready:

   ```sh
   supabase functions deploy push-dispatch --project-ref YOUR_PROJECT_REF
   ```

   `supabase/config.toml` intentionally disables the gateway JWT check for this
   cron-only function. The handler independently requires the dedicated
   `Authorization: Bearer <PUSH_DISPATCH_SECRET>` header. It accepts no recipient,
   subscription endpoint, or payload from the caller. Ordinary members can only
   queue a rate-limited test for a device belonging to their own account.
6. Enable Supabase Cron (`pg_cron`), `pg_net` and Vault. In Vault create:

   - `kdec_push_project_url`: your HTTPS Supabase project URL, without trailing `/`.
   - `kdec_push_dispatch_secret`: exactly the dispatch secret configured above.

   Apply **`supabase/schedule-push.sql`** after reviewing it. It installs one
   dispatcher invocation every minute. Until the scheduler and secrets are set,
   tests and business events remain queued and no live delivery occurs. This
   repository work does not deploy or schedule anything automatically.

## Behavior and scope

| Category | Trigger and recipients |
| --- | --- |
| Assignments | Existing quarterly `assignment` and `replacement_assignment` inbox events; the assigned active member's subscribed devices. Legacy published team changes also use the outbox. |
| Schedule | Publication and scheduling/cancellation changes to a published event; currently assigned team and explicitly selected participants. |
| Setlists | Setlist-item or block changes on a published event; its current assigned team and explicit participants. Bulk rows in the same transaction coalesce. |
| Announcements | Successful announcement insert; active subscribed members except the actor. The existing announcement workflow publishes immediately and has no drafts or team targeting. |
| Reminders | One hour before a published scheduled service and, when enabled, its rehearsal; current assigned team and explicit participants, including the actor. |

No new publishing system or roles are introduced. Existing drafts remain silent.
Published scheduling fields stay locked by the existing workflow: cancel and
create/publish a corrected event to reschedule. Obsolete, canceled, archived,
completed, removed-assignee and inactive-member reminder jobs fail eligibility
checks before dispatch. Occurrence timestamps are rechecked against current data.
Service/rehearsal timezone comes from the event (`Africa/Cairo` in the current
calendar); PostgreSQL timezone rules handle daylight-saving changes.

Subscribing or re-enabling reminder preferences schedules upcoming reminders.
Reminders require enrollment before their one-hour lead time; no late catch-up
reminders or replay of previous announcements/assignments are sent. Events with
no assigned team or explicit participants do not create schedule/setlist/reminder
pushes. Members can still see published events under the existing calendar RLS.

Notification language is stored in the user's notification preferences and can
be set independently of the page language. Lock-screen text is generic: no member
names, service titles, notes, announcement body, or song lyrics. Notification links
contain only the internal destination and re-enter normal authentication and RLS.

## Reliability and privacy

Business triggers enqueue jobs in the same transaction as the data write. A
business transaction that rolls back cannot leave a notification behind. Each
subscription/job key is unique. Reminder keys include the canonical occurrence
instant; assignment keys use the existing inbox dedupe key.

The dispatcher claims at most 20 jobs with `FOR UPDATE SKIP LOCKED`, leases them
for five minutes, and rechecks membership, current recipients, preferences,
publication and expiry immediately before each network request. Delivery results
are recorded per device. A late worker cannot finish another worker's lease.

Temporary network, HTTP 429, and 5xx failures retry with bounded exponential
backoff (60/120/240/480 seconds, at most five attempts). Other HTTP failures end
the job. HTTP 404/410 deactivates only the expired device and retains diagnostics.
Expired devices do not count against the ten-active-device limit. Successful
status means provider acceptance, not proof of screen display. A worker crash
after provider acceptance and before recording success can cause redelivery;
notification tags mitigate repeat display, but exactly-once delivery is not
claimed. Preferences and access can change in the short interval between the
final database check and provider acceptance; already delivered generic previews
cannot be recalled from every device.

Allowed push providers are Google FCM, Mozilla's production push service, and
Apple's push hosts. Endpoint URLs and encryption keys are validated both at
registration and dispatch. HTTP redirects are rejected, and requests time out
after five seconds. Adding another browser/provider requires an explicit reviewed
allowlist change; endpoints supplied by clients cannot reach arbitrary hosts.

The service worker retains only an opaque binding plus the client-side account
association in IndexedDB, never auth tokens or payloads. Logout/account switching
clears its display gate and closes displayed notifications, unsubscribes the
browser, and removes that device's server record when its original account
session is available. If an account switch has already replaced that session,
the old browser endpoint is invalidated and its record deactivates on provider
expiry. Offline failures retain a
non-delivering cleanup receipt so Settings can retry server removal. Other devices
remain subscribed. Site storage must be available. Disabling notifications or
browser subscription expiry should not be treated as a reliable revocation of
already delivered lock-screen previews; previews are deliberately minimal.

Production keeps fail-closed auth/configuration behavior. Demo never creates real
subscriptions, jobs, or provider requests. The existing public offline cache is
unchanged; no private app/API responses or push payloads enter it.

## Browser setup and troubleshooting

- HTTPS is required (trusted localhost is usable for development). The existing
  PWA registers its service worker only in production/production preview. Vite
  development intentionally does not register it.
- Apply any available app update before enabling notifications. Settings checks
  that the active worker supports push; an old worker must be updated/reloaded.
- iPhone/iPad requires iOS/iPadOS 16.4+ and a Home Screen web app. Use Share → Add
  to Home Screen, open the installed app, sign in, then tap Enable notifications.
- Permission is requested only by the Enable button. If denied, use browser/device
  notification settings to allow it; a website cannot override a denial.
- Test queues for the current device and is limited to once per account per
  minute. Expect scheduler latency. Focus mode, browser/OS settings, connectivity,
  battery restrictions, expiry and provider availability affect display.
- A missing migration/backend or offline network produces an error instead of a
  saved/enabled success state. An unavailable VAPID public key disables enabling
  and testing while preserving the disable action on supported devices.
- After an offline disable, reconnect and use Disable again to remove the saved
  server subscription. An account switch also attempts pending cleanup.
- If tests remain pending with `attempts > 0` and `last_status = 0`, the
  dispatcher ran but encountered a local request/encryption error or transport
  exception. Inspect **Edge Functions → push-dispatch → Logs**. Updated senders
  emit only the job ID, stage (`payload`, `encryption`, `request`), and a fixed
  safe reason (`crypto_unsupported`, `vapid_key_invalid`,
  `crypto_key_invalid`, `subscription_crypto_invalid`, `request_timeout`, `request_network_error`, or
  `request_build_failed`), never the exception text or keys. Configuration shape
  failures emit `Push configuration rejected` with a safe reason and return HTTP
  503 without claiming jobs. Surrounding whitespace is trimmed from server VAPID
  values. Redeploy the updated function, then queue a fresh own-device test;
  previous five-minute test jobs may already have expired.
- If tests remain pending with no attempts, verify Cron history, dispatch secret
  equality and Edge configuration. Inspect `push_jobs.state`, `attempts`, `last_status` and
  `finished_at` from an administrator SQL session. Never export subscription
  endpoints/keys or provider payloads into logs.
- Terminal delivery rows are retained for diagnostics. For a large deployment,
  configure an operator-approved retention policy, e.g. removal of terminal rows
  older than 30 days. Do not delete pending work merely because it is old.

## Verification

Dependency-free application tests:

```sh
npm test
npm run lint
npm run build
npm audit
```

Isolated real PostgreSQL execution (WASM PGlite, no remote DB/provider): install
`@electric-sql/pglite` into scratch, then run:

```sh
KDEC_PGLITE_MODULE=/absolute/scratch/node_modules/@electric-sql/pglite/dist/index.js node scripts/push-sql-check.mjs
```

This checks fresh and upgraded schemas, repeated migration application, real
publication/assignment triggers, transaction rollback, draft silence, RLS for
manager/member/inactive/anonymous users, recipient filtering, multiple devices,
preferences, localized data, dedupe, Cairo reminder timing, stale/canceled jobs,
lease ownership, retries, expiry, and own-device test rate limiting. Browser,
worker, and dispatcher modules also have mocked unit tests; these do not establish
actual Edge runtime or provider interoperability.

Before production rollout, use an explicitly configured test account and verify
on real devices: English/Arabic at desktop and 390px width; settings after reload;
permission denial; install instructions; test and business pushes while closed;
notification navigation after revoked access; multiple devices; offline disable;
logout and shared-device account switching; cancellation/replacement; and Cron
retries. Do not send tests to the real team.

During implementation, full browser verification was blocked by sandbox EPERM
errors when binding a local Vite port and launching Chrome. Live Supabase RLS,
Deno Edge deployment, scheduler execution, and real-device delivery require a
deployed isolated test environment and remain unverified. `npm audit` could not
reach the registry (ENOTFOUND); no clean vulnerability-audit result is claimed.

## Official references

- [Apple/WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN notification clicks](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event)
- [Supabase Edge dependencies](https://supabase.com/docs/guides/functions/dependencies)
- [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Web Push library API and encryption](https://github.com/web-push-libs/web-push)
