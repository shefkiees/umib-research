# Authentication rollout

## Required configuration

- Set `NODE_ENV=production` (Vercel also sets `VERCEL`).
- Keep `SESSION_SECRET` stable across instances and restarts. Generate it from at least 32 random bytes using a secret manager; do not commit or log it. The application rejects values shorter than 32 characters. Changing it logs out existing users.
- Set `CLIENT_URL` to the canonical HTTPS frontend URL, without a query or fragment.
- Set `GOOGLE_CALLBACK_URL` explicitly to the HTTPS backend callback, normally `/api/auth/google/callback`. It must exactly match the URI registered for the existing Google OAuth client. Keep the existing client ID and secret.
- `SESSION_MAX_AGE_MS` defaults to `604800000` (7 days); longer, zero or invalid values are rejected.
- Outside Vercel, set `TRUSTED_PROXY` to comma-separated IPs/CIDRs of the reverse proxy, or an appropriate Express alias such as `loopback` for a same-host proxy. Trust-all CIDRs are rejected. The service must only be reachable through the HTTPS proxy, which must replace client-supplied forwarding headers. Vercel defaults to one platform-controlled proxy hop; verify this in the target deployment.
- Cookies are host-only with `Path=/`, `HttpOnly` and production `Secure`. `SameSite=Lax` is used for one origin; differing frontend/backend origins use `None` with `Secure`. Cross-origin deployments must verify browser cookie policies and credentialed `/auth/me` requests.

Run `npm run auth:config:check` with the target environment loaded. For a Vercel configuration checked locally, run `npm run auth:config:check -- --vercel`. This prints validation results, not values, and does not contact Google or modify the database. It cannot verify the registered callback, proxy topology, secret entropy or remote configuration.

## Session migration and revocation

Authenticated legacy sessions without a trusted deadline or authentication timestamp require Google reauthentication. Cookie expiry is never accepted as authentication evidence. New successful Google logins record `authenticatedAt` and `authExpiresAt` after Passport rotates the ID. Touches, updates and unrelated ID rotations cannot extend that deadline.

No schema migration is required. The existing `app_sessions` JSONB table stores revoked IDs as `{ "revoked": true }` with an infinite expiry, removing all user/session data. Conditional UPSERTs and touches cannot revive them. Fresh cryptographically generated IDs can still be inserted normally. Revocation markers are intentionally retained; monitor table size. Do not delete markers or let maintenance jobs purge them without a separate, reviewed session-namespace retirement procedure.

Google state is issued and consumed by dedicated atomic PostgreSQL updates. Ordinary session writes preserve the database's state and authentication deadline, so stale snapshots cannot restore a consumed nonce. State expires after 10 minutes and is bound to the session ID. Only one pending Google flow is supported per browser session; starting another flow supersedes the previous nonce.

Drain all old application workers and in-flight requests before routing traffic to this version. Do not run the previous store implementation alongside it: the old unconditional UPSERT could overwrite revocation markers. Google flows started before the change may need to restart. Do not roll back to the old store against active revocation markers without a reviewed session invalidation procedure.

## Verification

Run `npm run test:auth`, `npm run lint`, `npm run build`, and `npm run test:reimbursements` locally. The auth suite mocks Google and PostgreSQL and tests legacy migration, parallel callbacks, revoked-cookie rejection, late writes, rotation and cookie flags.

For real PostgreSQL concurrency checks, set `TEST_DATABASE_URL` to a dedicated local test database, then run `npm run test:auth:postgres`. The suite uses a random isolated schema and multiple connections, and removes only that schema afterward. It never falls back to `DATABASE_URL`. Remote test databases require explicit `AUTH_TEST_ALLOW_REMOTE=true`; never point it at production. If no test URL is supplied the suite reports SKIP, not PASS.

Before deployment approval, verify real PostgreSQL concurrency tests, real Google login as admin/professor, `/auth/me` after refresh and browser reopen, logout with the old cookie, secure cookie flags behind the actual proxy, and persistence after an application restart. Local simulated tests do not establish these production results.
