# KDEC Worship design and component review

Base: `ec086cc` (V29 top bar on all signed-in pages). Branch: `kdec-design-craft`.

## Implementation checklist

- [x] Inspect AGENTS.md, available skills, routes, UI components, bilingual context, demo/live boundary, permissions, store, and schema.
- [x] Refine shared surfaces, page measure, controls, tables, tabs, empty states, and loading feedback across signed-in pages.
- [x] Preserve the approved tower; restore one visible mobile header tower, retaining one desktop sidebar tower.
- [x] Keep the expanded sidebar floating, and move its collapse control inside the capsule.
- [x] Group Songs filters; show result counts and recoverable filtered-empty states; keep existing management actions.
- [x] Make Settings language choices actionable and persist through the existing language provider.
- [x] Mirror tab arrow-key behavior in Arabic; retain Escape behavior and focus restoration.
- [x] Add Settings to the existing account popover.
- [x] Keep one top-level heading on Schedule and Reports.

## Scope

The existing authentication gates, Supabase writes, permissions, RLS, event publishing, and notification delivery remain in their existing modules. No dependency or database migration is required. Production still requires live Supabase configuration; demo mode remains development-only.

The applicable available instruction package was Vercel React Best Practices, including deriving state during rendering. The requested Impeccable, GSAP, web-design-guidelines, and frontend-testing-debugging packages were not installed in this checkout. No claim is made that they were run. Styling uses the existing CSS/Tailwind stack; no animation dependency was added.

## Local review

Use Node 20.19+ or 22.12+, with dependencies installed through the existing lockfile. Run `VITE_DEMO_MODE=true npm run dev` in a checkout without live Supabase variables. The login screen provides existing admin, leader, and member demo entry points. All demo changes stay in that browser.

`npm test`, `npm run lint`, and `npm run build` are the required repository checks. Demo mode is not a production deployment configuration.

## Browser verification

Browser-local demo verification covers Songs search/reset, empty results, Add Song dialog, Escape dismissal, RTL tabs, dark/light switching, Settings language persistence after reload, and rendering of Team, Schedule, Attendance, and Reports. Narrow CSS widths are checked using browser zoom because device-emulation DevTools is restricted. This checks responsive layout and navigation, not native touch, a phone keyboard, or installed-PWA behavior.

Live Supabase persistence, push delivery, and production credentials are not verified by this demo preview. Dashboard fixtures in the existing unit suite cover selected-day resolution; the initial browser demo has no upcoming events.

## Verification results

- `npm test`: 170 passing, zero failures.
- `npm run lint`: passed.
- `npm run build`: passed. Existing Browserslist data-age warning remains; dependencies were not changed.
- Browser: admin and ordinary member demo entry, with Add Song/Manage Library absent for the member; account popover Settings link; English/light and Arabic/dark library; search/reset; Add Song modal and Escape; Settings language survives reload.
- Responsive: no document overflow at 454px and 340px CSS widths; one visible tower and one filter column at 340px; mobile More drawer opens and closes with Escape.
- Dashboard: existing selected-day unit coverage passes. Populated-event visual verification remains outstanding because the browser demo has no upcoming events.
- Reduced motion: shared CSS disables added motion through the existing media-query rules; operating-system preference emulation was not available in this browser.

Review screenshots: `docs/review/kdec-songs-light.jpg` and `docs/review/kdec-songs-arabic-dark.jpg`.
