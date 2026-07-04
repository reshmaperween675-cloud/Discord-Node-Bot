---
name: Control Center backend architecture
description: Key decisions for the Lowo bot admin dashboard backend routes and auth
---

## Dashboard API routes
All dashboard routes live under `artifacts/api-server/src/routes/dashboard/` and are mounted at `/api/dashboard/` via `routes/dashboard/index.ts`. Session middleware (`express-session` + `connect-pg-simple`) is added in `app.ts` before all routes.

## Auth flow
- Discord OAuth2 PKCE-like flow: `/api/dashboard/auth/login` generates a random `state` stored in session; `/api/dashboard/auth/callback` validates it before token exchange.
- Authorized users: checked against `LOWO_OWNER_IDS` (comma-separated) and `LOWO_OWNER_ID` (single) env vars via `lib/ownerIds.ts`.
- Session fields: `userId`, `username`, `globalName`, `avatar`, `accessLevel`, `oauthState`.

## bot_kv key conventions
Dashboard stores all overrides in `bot_kv`:
- `dashboard:cmd:override:{name}` — command enable/override
- `dashboard:embed:{id}` — embed text overrides
- `dashboard:module:{name}` — module enabled state
- `dashboard:module:settings:{name}` — module settings
- `dashboard:bot:presence` — bot presence config
- `dashboard:bot:heartbeat` — bot writes status every 30s
- `dashboard:bot:pending-action` — queued bot actions

## DB table: dashboard_audit_logs
Added to `lib/db/src/schema/index.ts`. Schema: id (text PK), action, userId, username, before (jsonb), after (jsonb), metadata (jsonb), createdAt.

## Security
- File explorer: `execFile` (no shell) for grep, `relative()` path-traversal check (reject if starts with `..` or isAbsolute).
- Search: same `execFile` pattern.
- Secret redaction patterns applied to all file content before returning.
- OAuth CSRF: state nonce round-trip, single-use (deleted after callback).

**Why:** Code review found RCE via shell injection, path traversal bypass, and missing CSRF state — all fixed before deploy.
