# Strix security review

Status: proposed integration; runtime not installed or validated. No scans have run.

Upstream: https://github.com/usestrix/strix/tree/main/skills (Apache-2.0). Use the application-security-testing, find-security-vulnerabilities-in-code, fix-security-vulnerabilities-with-strix and CI skills as review guidance.

## Scope
Start with source review of App.jsx, permissions.js, useStore.jsx, Supabase client, schema, migrations and edge functions. Verify RLS, role changes, invitations, attendance QR integrity, scheduling, report access and notification permissions. Review anonymous, inactive, ordinary member and manager access. Record evidence and distinguish observations from validated findings.

## Safety gates
- Use a disposable checkout and isolated staging database with synthetic users. No production endpoints, credentials, member records, outbound notifications or destructive operations.
- Review and pin the Strix runtime, dependencies and sandbox image before installing. Do not run remote shell installers or enable hooks automatically.
- Obtain explicit approval for model provider, data handling and spend before execution. Never commit credentials or upload source or findings to a managed service without approval.
- Keep reports private and outside the public repository. Redact secrets and personal data.
- Run npm test, npm run lint, npm run build and review npm audit. Retest each fix in isolation.
- CI remains disabled until a successful baseline scan, reviewed runtime and secure credentials are available. Treat incomplete scans as inconclusive, not passing. No automatic merge or production deployment.
