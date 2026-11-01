# KDEC Worship phone installation and deployment

## Implemented configuration

This extends the existing manifest and `/sw.js`; there is one PWA setup.

| Setting | Value |
| --- | --- |
| Application and short name | KDEC Worship |
| Stable manifest identity | `/` (unchanged) |
| Scope | `/` |
| Launch route | `/schedule` |
| Display | `standalone` |
| Launch background | Opaque branded navy, `#101923` |
| Icons | 192×192 and 512×512 PNG; separate 512×512 maskable PNG; 180×180 Apple touch PNG |
| Artwork | Existing approved `/brand/option-b-tower.png`, also used by the compact sidebar logo |

The artwork is resized proportionally, with its original colors and background
preserved, and centered on navy. No logo redesign, cropping or pre-rounded corners
is applied. The complete maskable artwork rectangle fits inside the central circle
of radius 40% of the icon width. The approved source is a 100×118 raster; higher
resolution original artwork would improve sharpness without changing its design.
To regenerate the same assets on macOS, run `sh scripts/generate-app-icons.sh`.

Install app appears above the login card and page content, in Settings, and as a
shortcut in the user menu. Supported browsers use their native prompt; other
browsers receive platform-specific English/Arabic instructions. The action hides
in installed/standalone windows. The app respects light/dark mode and device
accessibility preferences; navigation can use solid surfaces with Settings →
Appearance & readability → Reduce transparency.

## Deploy to the existing host

1. Use the existing Vercel project and existing production hostname. Deploy the
   source changes through its normal Git branch/deployment workflow. Changing
   hostname creates a different installation and browser session storage.
2. Retain the existing production `VITE_SUPABASE_URL` and public
   `VITE_SUPABASE_ANON_KEY`. Keep `VITE_DEMO_MODE=false`. Never use a secret or
   service-role key. **No SQL migration or new Supabase setting is required for
   this PWA change.** Existing calendar migrations must already be applied.
3. Vercel uses `npm ci`, `npm run build`, and output directory `dist`, as defined
   in `vercel.json`. The SPA rewrite must continue serving `/schedule` and service
   deep links. Existing static files must take priority over that rewrite.
4. Serve the whole application over valid HTTPS. If using a different host,
   reproduce the SPA fallback, security headers, manifest MIME type
   `application/manifest+json`, worker JavaScript MIME type, and revalidation
   headers from `vercel.json`. `/sw.js` must have root scope and must not be
   served with an immutable cache policy.
5. On the deployed origin, check these URLs in a browser or with `curl -I`:
   `/schedule`, `/manifest.webmanifest?v=pwa3`, `/sw.js`, `/offline.html`,
   `/offline.css`, `/offline-retry.js`, `/app-icon-192.png?v=pwa3`,
   `/app-icon-512.png?v=pwa3`, `/app-icon-maskable-512.png?v=pwa3`, and
   `/apple-touch-icon.png?v=2`. Expect 200 responses and the actual file content;
   an HTML response for a manifest, worker, stylesheet, script or icon is a hosting
   error. The worker and manifest need revalidation, while icons are PNG images.
6. In Chrome DevTools → Application, inspect Manifest and Service Workers. Check
   the name, stable ID, `/schedule` start URL, icon previews and maskable safe area.
   Check that there are no installability, HTTPS, MIME or CSP errors. Visit once
   online and wait for the worker to finish preparing offline help.
7. If the app reports an available update, save open work, then choose **Update &
   reload**. Updates do not automatically reload a user's unsaved form. Existing
   installations can also close all app windows and reopen online to activate a
   waiting worker. Versioned icon URLs encourage refresh without changing the
   manifest ID, start URL or session storage.

For local production preview, run `npm run build` and then
`npm run preview -- --host 127.0.0.1 --port 4187`. Development mode deliberately
does not register a worker. Localhost is suitable for desktop development, but an
HTTP LAN address opened on a phone is not a substitute for an HTTPS deployment.

## Install on iPhone or iPad

1. Open the deployed HTTPS website in **Safari**. If the link opened inside
   WhatsApp or another app, open it in Safari first.
2. Tap **Install app** for guidance, or use Safari's **Share** menu. Depending on
   Safari's toolbar layout, Share may be inside the page/More menu.
3. Choose **Add to Home Screen**. Leave **Open as Web App** enabled if it appears.
4. Confirm the name **KDEC Worship**, then tap **Add**.
5. Launch the new tower-logo icon. It should open without the browser address
   bar, load `/schedule`, and show normal login when required.

If Add to Home Screen is missing from Share, scroll down and use Edit Actions to
add it. Some iOS versions keep Safari and installed web-app storage separate, so
signing in once inside the installed app may be necessary. Subsequent normal app
launches use the existing Supabase persistent session; storage clearing, removal,
session revocation and browser storage eviction can require a new sign-in.

## Install on Android

1. Open the deployed HTTPS website in **Chrome**.
2. Tap **Install app** and complete the native browser prompt when offered.
3. If no prompt appears, use **⋮ → Add to Home screen → Install**, or **⋮ → Install
   app**, depending on the Chrome version. Browser engagement and installability
   checks determine whether a native prompt is available; it is not guaranteed to
   appear immediately. Other browsers may expose their own installation menu.
4. Launch **KDEC Worship** from the home screen/app launcher. Confirm the tower
   icon, standalone window and `/schedule` launch route.

## Refresh an older installed icon

First save any open changes, open the updated HTTPS website, reload it online and
apply an offered app update. Installed icon updates are controlled by the browser
and OS and may not happen immediately.

If the old icon remains:

- **iPhone/iPad:** remove the old installed web app, open the updated site in
  Safari, reload, and repeat Add to Home Screen. Check the icon in the Add sheet.
- **Android:** uninstall the old installed web app (Settings → Apps → KDEC Worship
  → Uninstall, if listed). Removing only its launcher shortcut may leave the old
  installed app. Reload the updated site in Chrome and install again.

Removal may clear app-local session state, so be prepared to sign in again.
Saved Supabase records are separate from the installation. Avoid clearing all
browser storage merely to refresh the icon.

## Offline behavior and privacy

The worker caches exactly four public files: `/offline.html`, `/offline.css`,
`/offline-retry.js`, and `/brand/option-b-lockup.png`. Installation fetches them
without credentials and bypasses stale HTTP cache entries. Only old
`kdec-offline-*` cache versions are removed on activation.

Application HTML, JavaScript bundles, auth callbacks, API responses, member data,
calendar content, private documents and tokens are never written to Cache Storage
by this worker. Supabase auth continues using its existing persistent session
storage; this is distinct from service-worker caching. Calendar reads and writes
require the internet. There is no background sync or deferred write queue.

After an online visit has prepared offline help, an offline navigation receives a
public bilingual reconnect page. **Try again** reloads the original URL, preserving
the path/query/hash, rather than redirecting to a new route. An already-open app
shows connection status; when connectivity returns, **Refresh data** uses the
existing store loader and its error handling. It does not automatically reload an
open form. A never-visited site cannot provide its own offline page.

## Verification record — 1 November 2026

Completed locally:

- Dependency-free tests cover installation prompt capture/consumption,
  dismissal/error fallback, English/Arabic platform instructions, iPad detection,
  standalone behavior, reconnect state, worker registration/retry, explicit update
  activation, and React StrictMode registration cleanup.
- Worker tests exercise online/offline navigation, public asset fallback, cache
  allowlisting, non-GET/API/auth bypass and cleanup limited to KDEC offline caches.
- PNG decoding tests check actual dimensions, opaque navy padding and every
  artwork pixel's position within the maskable safe circle. The Apple icon was
  visually inspected against the existing approved tower.
- The repository's permission, auth-event, calendar normalization, publication and
  demo/runtime tests run with the full test suite (114 passing tests). `npm test`, `npm run lint`, and
  `npm run build` pass. The build retains the existing non-blocking warning about
  an outdated Browserslist dataset. No dependencies were changed.
- Authentication, permissions, store actions, database schema/RLS and publication
  functions were not modified. No real member accounts were used or notified.

Not completed in this environment:

- Browser/computer-use startup failed; the in-app browser was unavailable.
- The sandbox rejected localhost listening and requests with `EPERM`, so a local
  HTTP preview could not be exercised. Production files were built and inspected
  on disk; deployed status codes, HTTPS, headers and MIME delivery remain pending.
- Physical iPhone/Android installation, launcher appearance on light/dark
  wallpapers, standalone launch and EN/AR mobile/keyboard layout remain pending.
- Live Supabase login/session restoration, calendar reloads and database-enforced
  access/publishing behavior were not tested end to end. Passing unit tests does
  not establish deployed RLS or live persistence correctness.

Before release, use a separate Supabase test project and synthetic manager,
ordinary-member and inactive accounts; include anonymous and explicit local-demo
checks. Do not test publication against real members. On both phones, verify:

1. Install from the signed-out screen; launch into `/schedule`, sign in, close and
   reopen, and confirm the session and calendar restore. Test the normal auth
   recovery/deep-link routes as well.
2. Switch EN/AR and light/dark mode, check RTL and the install guide, then inspect
   320–430px widths and landscape cutouts. Check all bottom tabs/More drawer, text
   wrapping, focused form fields and modal footers with the keyboard open.
3. Confirm ordinary members cannot access manager/admin workflows, inactive
   accounts cannot enter, and only permitted test managers can publish. Run the
   existing isolated calendar acceptance procedure in `UNIFIED-CALENDAR.md`.
4. Go offline and navigate/relaunch: see generic help, no private calendar. Restore
   the connection and use Try again/Refresh data. Confirm API failures do not
   produce false success or queued writes. Inspect Cache Storage for only the four
   public files, and check tokens never appear there.
5. Confirm that an available worker update waits for explicit Update & reload,
   and that the installation action is hidden inside the standalone app.

## Official browser references

Checked 1 November 2026:

- [Chrome install-promotion requirements](https://web.dev/articles/install-criteria)
  — HTTPS, manifest names/icons/start/display, and browser-controlled engagement.
- [Web app manifest and maskable icon safe area](https://web.dev/learn/pwa/web-app-manifest)
  — stable identity, manifest delivery and the radius-40% safe circle.
- [WebKit: Safari 26 web-app installation](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
  — Add to Home Screen and Open as Web App.
- [Apple: Turn a website into an app](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
  — current Safari installation steps.
- [Apple archived web app configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
  — explicit 180×180 touch icon and legacy standalone metadata.
