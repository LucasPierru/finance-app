# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Monorepo with three packages:

- `apps/frontend` — SvelteKit 2 / Svelte 5 app (Vite, Tailwind CSS 4, shadcn-svelte/bits-ui, chart.js)
- `apps/backend` — Express 5 API (TypeScript, PostgreSQL, JWT auth, Plaid, Nodemailer)
- `packages/shared-types` — shared TypeScript interfaces consumed directly from source (no build step) by both apps

## Commands (run from repo root)

```bash
npm run dev:frontend       # start frontend dev server (port 5173)
npm run dev:backend        # start backend dev server (port 4000, tsx watch)
npm run check:frontend     # svelte-check type checking
npm run check:backend      # tsc --noEmit type checking
npm run build:frontend
npm run build:backend
```

Backend database (Docker required):

```bash
cd apps/backend
npm run db:up              # start PostgreSQL container (maps to port 5433)
npm run db:down
npm run db:reset           # wipe volume and restart
npm run db:seed-categories # seed category data
```

There are no test scripts.

## Backend architecture

Entry point: `src/index.ts` — registers CORS, JSON middleware, and four route groups under `/api/{auth,budget,finance,plaid}`. All routes except `/api/auth` are protected by the `requireAuth` middleware.

Layer structure (top → bottom):

| Layer | Path | Purpose |
|---|---|---|
| Routes | `src/routes/` | Express routers, parameter parsing, HTTP response |
| Services | `src/services/` | Business logic, transactions |
| Repositories | `src/repositories/` | SQL queries via `pg` pool |
| DB | `src/db/pool.ts` | Single `pg.Pool` instance |

**Path aliases** (configured in `tsconfig.json`): `@config/*`, `@db/*`, `@lib/*`, `@middleware/*`, `@repositories/*`, `@routes/*`, `@schemas/*`, `@services/*`.

**Error handling**: throw `AppError(statusCode, message)` from `@lib/errors`; the global error handler in `index.ts` maps it to the correct HTTP status.

**Auth**: passwordless email OTP. Flow: `POST /api/auth/request-code` → `POST /api/auth/verify-code` → access+refresh JWT pair set as `HttpOnly` cookies. `requireAuth` middleware accepts either cookie or `Authorization: Bearer` header. Refresh tokens are stored hashed in the database; rotation happens on every `/api/auth/refresh` call.

**Plaid**: `src/lib/plaid.ts` exports a `plaidClient` singleton. Bank tokens are AES-encrypted at rest via `src/lib/plaid-token-crypto.ts`.

## Frontend architecture

SvelteKit file-based routing under `src/routes/`. Each route may have:

- `+page.server.ts` — server-only `load` function; fetches data from the backend using the user's access token from `locals.auth.accessToken`
- `+page.svelte` — the page component

**Session resolution** (`src/hooks.server.ts`): runs on every request via `resolveAuthSession`, which tries the access-token cookie, then silently refreshes using the refresh token, and writes `event.locals.auth`. The root `+layout.server.ts` redirects unauthenticated users to `/login`.

**API client** (`$lib/requests/api.ts`): exports a single `api` object with `get/post/put/patch/delete` methods. Each method builds the URL from `VITE_API_BASE_URL`, auto-serializes the body to JSON, and throws on error with the parsed `message` from the response. When running in the browser, `credentials: 'include'` and `cache: 'no-store'` are added automatically via `$app/environment`'s `browser` flag — callers don't set these manually.

Route-specific request helpers in `$lib/requests/{auth,budget,finance,plaid,transactions}.ts` are thin wrappers:
- SSR helpers (called from `+page.server.ts`) pass `{ headers }` and use `.catch(() => null)` for null-on-failure behavior.
- Mutation helpers (called from client components/stores) just call `api.post/put/patch/delete` with a plain body object.

`httpGetAuthMe` and `httpPostAuthRefresh` in `$lib/requests/auth.ts` are the only exceptions — they call `fetch` directly to return a raw `Response` so `$lib/server/auth.ts` can inspect `Set-Cookie` headers.

**State**: Svelte stores in `$lib/stores/` hold client-side finance, auth, and banking state. Server-loaded data flows in via page `data` props; stores are initialized from that.

**UI components**: shadcn-svelte primitives in `$lib/components/ui/`; feature components directly in `$lib/components/`.

## Shared types

`packages/shared-types/src/index.ts` is the single source of truth for all request/response shapes, domain models (`FinanceEntry`, `BudgetPlan`, `BankTransaction`, etc.) and body types. Both apps import from `@finance-app/shared-types` (resolved directly to the TypeScript source — no compilation needed).

When adding a new API contract, define the types here first.

## Environment variables

Backend `.env` (see `src/config/env.ts` for full list):

- `DATABASE_URL` — required
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox`/`development`/`production`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `FRONTEND_ORIGIN` (default `http://localhost:5173`)

Frontend `.env`: `VITE_API_BASE_URL` (default `http://localhost:4000`).
