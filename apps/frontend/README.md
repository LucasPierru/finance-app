# WealthFlow — Personal Finance Tracker

A SvelteKit app to track income, expenses, and project long-term investment growth.

## Stack

- **SvelteKit** — Framework
- **Express** — Separate backend API service
- **PostgreSQL** — Persistent data store for finance and Plaid state
- **TypeScript** — Type-safe stores and components
- **Tailwind CSS** — Utility-first styling
- **Chart.js** — Investment projection chart
- **Plaid** — Optional bank account and transaction sync

## Fonts

- **Bricolage Grotesque** — Display / headings
- **Plus Jakarta Sans** — Body / UI text

## Setup

```bash
npm install
cd ../finance-app-server && npm install
```

Run the frontend and backend in separate terminals:

```bash
npm run dev
npm run backend:dev
```

Open http://localhost:5173

The frontend talks to the backend over HTTP using `VITE_API_BASE_URL`.

## PostgreSQL setup

1. Create a PostgreSQL database.
2. Copy `../finance-app-server/.env.example` to `../finance-app-server/.env` and set `DATABASE_URL`.
3. Run the SQL in `../finance-app-server/sql/schema.sql` against that database.

Example connection string:

```bash
postgresql://postgres:postgres@localhost:5432/finance_app
```

## Plaid setup (optional)

1. Create a `.env` file based on `.env.example`
2. Create a `../finance-app-server/.env` file based on `../finance-app-server/.env.example`
3. Fill in your Plaid sandbox credentials in the backend env file
4. Restart the backend server

```bash
cp .env.example .env
```

Required variables:

- Frontend: `VITE_API_BASE_URL`
- Backend: `DATABASE_URL`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`

Then go to **Settings -> Bank Connection (Plaid)** and click **Connect Bank**.

## Build

```bash
npm run build
npm run preview
```

## How it works

1. **Income tab** — Add revenue sources (salary, freelance, etc.) with weekly/monthly/yearly frequency
2. **Expenses tab** — Add recurring costs (rent, subscriptions, etc.)
3. **Projection tab** — Configure expected annual return, time horizon, and starting amount to see compound growth

All values are normalized to monthly amounts. The projection uses standard compound interest + regular contribution formula.

## Backend notes

- The backend lives in `../finance-app-server/` as a separate project with its own dependencies and scripts.
- The current setup still uses a single demo user id by default for simplicity.
- Plaid state now persists in PostgreSQL instead of process memory.
- For production: add real authentication, encrypt stored Plaid access tokens, add webhook processing, and isolate records per authenticated user.

## Auth API contract (frontend expects)

The Svelte frontend now expects these backend endpoints:

- `POST /api/auth/login/request-code` with `{ email }`
- `POST /api/auth/login/verify-code` with `{ email, code }` -> `{ user, tokens }`
- `POST /api/auth/register/request-code` with `{ email, name, dateOfBirth, phoneNumber? }`
- `POST /api/auth/register/verify-code` with `{ email, name, dateOfBirth, phoneNumber?, code }` -> `{ user, tokens }`
- `POST /api/auth/refresh` with `{ refreshToken }` -> `{ accessToken, refreshToken }`
- `POST /api/auth/logout` with `{ refreshToken }`
- `GET /api/auth/me` with `Authorization: Bearer <accessToken>` -> `user`
