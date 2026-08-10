# KDEC Worship Platform

KDEC Worship is a bilingual Arabic/English worship-team planning application for Kasr El Doubara Evangelical Church. It supports team profiles and invitations, songs, services, setlists, assignments, schedules, announcements, reports, and member responses.

The application has two data modes:

- **Supabase mode** persists the implemented core planning data and is the intended production configuration.
- **Demo mode** stores seeded core data in the current browser. Use it for evaluation only, never with production data.

With the current schema/migration applied, attendance, events/RSVPs, organization settings, setlist content blocks, excuses, and substitute requests are end-to-end Supabase workflows. Their database triggers and RPCs enforce QR isolation, request identity, workflow transitions, limits, and cross-table updates. The Settings export is a client-readable operational export, not a replacement for a managed PostgreSQL backup.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10 or newer
- A Supabase project for persistent or production use

## Run locally

Install dependencies and start Vite:

```bash
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The application now defaults to live mode in development and production. Copy `.env.example` to `.env.local`, replace both placeholders, and keep `VITE_DEMO_MODE=false`. Missing or placeholder credentials show a configuration error instead of loading demo data.

Demo mode is available only when deliberately enabled for local development with `VITE_DEMO_MODE=true` and no live credentials. A production build can never enter demo mode.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm test` | Run Node's built-in unit tests |
| `npm run lint` | Run ESLint across the repository |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Preview the production bundle locally |
| `npm audit` | Check the complete dependency tree for known advisories |

Run tests, lint, and the production build before handing off a change.

## Backend setup

Follow [SUPABASE-SETUP.md](./SUPABASE-SETUP.md). The checked-in `.env.example` contains public client variable names only. Never add a Supabase service-role key or any other secret to a Vite environment variable: every `VITE_*` value is shipped to the browser.

## Persistence coverage

Supabase mode currently loads and writes:

- profiles and multi-role membership;
- invitations;
- songs;
- services and recurrence metadata;
- setlist song rows;
- service-team assignments and response status;
- announcements;
- practice data stored with services;
- events and per-member RSVP responses;
- attendance sessions, occurrence-aware records, check-in/out RPCs, and organization attendance thresholds;
- organization settings;
- setlist note/prayer/reading/break blocks;
- excuse and substitute request creation, review, cancellation, and resolution.

Explicit local demo mode persists its browser-only datasets in `localStorage`. Clearing site data resets that isolated evaluation state; production builds cannot enable it.

## Project structure

```text
src/App.jsx                 application gates and routes
src/pages/                  page-level UI
src/components/             shared layout and UI components
src/store/useStore.jsx      auth, normalization, persistence, and actions
src/lib/permissions.js      shared client permission helpers
src/lib/runtimeConfig.js    fail-closed live/demo environment validation
src/lib/supabase.js         Supabase client creation
src/lib/recurrence.js       tested recurrence generation
src/lib/attendance.js       occurrence-date helpers
supabase-schema-FULL.sql    authoritative fresh-project schema and RLS
MIGRATION_security_data_integrity.sql current rerunnable upgrade migration
MIGRATION_multi_role.sql    superseded legacy migration; do not combine
scripts/check-browser-env.mjs blocks server secrets before bundling
test/                       Node unit tests
```

The UI uses camelCase objects while Supabase columns use snake_case. Normalize at the data boundary and surface backend errors before showing success.

## Deployment

Use `npm run build` and publish `dist/`. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider, then add the deployed origin and password-recovery URL to Supabase Auth redirect settings.

`vercel.json` includes the required single-page-app rewrite. Other static hosts must also route unknown application paths to `index.html` so direct links such as `/services/:id` and `/reset-password` work.

## Security notes

- Row Level Security is the real authorization boundary; client route guards are user experience only.
- Keep profile authorization fields and invitation redemption protected by database policies/triggers.
- Use only the public anonymous key in the browser.
- The predev/prebuild guard rejects Supabase secret/service-role keys before Vite can bundle them.
- Deactivate access at both the application and policy layers.
- Review `npm audit` before releases; the checked-in dependency tree currently audits clean.
