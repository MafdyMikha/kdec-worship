# Repository guidance

## Project

KDEC Worship is a React 19 and Vite 8 single-page application with bilingual English/Arabic UI. Supabase provides authentication, PostgreSQL persistence, and Row Level Security. Production always fails closed without live credentials; an explicit browser-local demo mode remains available only for development and product evaluation.

## Working agreement

- Inspect the relevant route, page, store action, normalization code, schema, and policy before changing a workflow.
- Keep changes scoped. Preserve unrelated work in a dirty worktree.
- Never commit secrets, `.env` files, generated `dist/`, dependency directories, or operating-system metadata.
- Preserve both left-to-right and right-to-left behavior. Check English and Arabic labels, layout direction, and mobile navigation for UI changes.
- Do not advertise a workflow as persisted until it is wired through the store, database schema, RLS, error handling, and reload verification.

## Key files

- `src/App.jsx`: authentication/configuration gates and route access.
- `src/store/useStore.jsx`: auth state, data normalization, demo persistence, and Supabase actions.
- `src/lib/permissions.js`: shared client permission helpers.
- `src/lib/supabase.js`: environment validation and client creation.
- `src/pages/`: page-level workflows.
- `supabase-schema-FULL.sql`: authoritative schema for a fresh Supabase project.
- `MIGRATION_multi_role.sql`: legacy multi-role migration, not a complete upgrade path.
- `test/`: dependency-free Node unit tests.

## Commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm audit
```

Use Node.js 20.19+ or 22.12+. `npm test` must remain independent of a browser and external services. Add focused tests for pure permission, formatting, recurrence, and normalization helpers as those helpers become importable modules.

## Data boundaries

- UI/store objects use camelCase; database columns use snake_case. Convert explicitly at the boundary instead of spreading UI objects into Supabase writes.
- Treat Supabase errors as part of every operation. Do not update local state or display success until the required write succeeds.
- Keep demo and Supabase behavior aligned where practical, but never silently fall back to demo mode in production.
- Empty arrays are valid persisted state; do not replace them with seed data merely because they are empty.
- Prefer transactional database functions for multi-row operations that must succeed or fail together.

## Authorization and security

- RLS and database triggers are the authorization boundary. Client checks and hidden navigation are supplementary only.
- Never let a user-controlled profile update change admin, role, roles, position, or active status without a privileged database check.
- Invitation lookup must not enumerate codes and redemption must bind code, email, pending status, and expiry atomically.
- Use the public anonymous key in the client. Never expose the service-role key through `VITE_*` variables.
- Test manager, ordinary member, inactive member, anonymous, and demo behavior when changing access control.

## Definition of done

Before handoff:

1. Run the smallest relevant tests while iterating.
2. Run `npm test`, `npm run lint`, and `npm run build` for application changes.
3. Run `npm audit` after dependency changes and report any intentionally retained advisory.
4. Verify affected workflows after reload and at mobile width; include Arabic/RTL checks for visible UI.
5. Update README/setup guidance when configuration, persistence coverage, schema application, or deployment behavior changes.

If a pre-existing check still fails, identify the exact failures and do not claim a clean verification result.
