# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 16 (App Router) + Prisma 6 + PostgreSQL application (`provlos-crm`). It contains two integrated product areas under `/crm`: a B2B logistics **CRM** (accounts, contacts, activities, tasks, lead discovery) and a **delivery dispatch / live tracking** system (drivers, deliveries, maps). Standard commands live in `package.json` scripts and `README.md`; only non-obvious, durable notes are captured here.

### Services

- **Next.js app** — dev server on port `3000` via `npm run dev` (Turbopack). Serves both UI (`/crm/*`) and API routes (`/api/*`).
- **PostgreSQL** — the only required external service. Prisma connects via `DATABASE_URL`. Health check: `GET /api/health` returns `{"ok":true,"db":"connected"}` when the DB is reachable.

### Environment setup notes (non-obvious)

- **Local Postgres, not Neon.** The README targets Neon, but in the Cloud VM a local PostgreSQL 16 cluster is used. `.env` is git-ignored (see `.gitignore`), so it is not in the repo; it lives on the VM. If `.env` is missing, recreate it with:
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/provlos?schema=public"
  ADMIN_TOKEN="provlos-admin"
  ```
  The third-party API keys (`SERPER_API_KEY`, `HUNTER_API_KEY`, `INSTANTLY_API_KEY`, etc.) are all optional; features that use them degrade gracefully when the keys are absent.
- **Start Postgres before the app** (it is not auto-started on boot): `sudo pg_ctlcluster 16 main start`. The `provlos` database and the `postgres`/`postgres` credentials already exist in the VM.
- **Apply migrations** with `npm run prisma:deploy` (runs `prisma migrate deploy`). Use `npm run prisma:migrate` only when authoring a new migration. Do not hand-write SQL.
- `npm install` runs `prisma generate` automatically via the `postinstall` hook, so the Prisma client is regenerated on every install.
- `prisma.config.ts.bak` is intentionally disabled; Prisma uses the default `prisma/schema.prisma`.

### Lint / build / test

- Lint: `npm run lint` (ESLint). There is one pre-existing unused-var warning in `app/api/drivers/route.ts`; it is not an error.
- Build: `npm run build` (`next build`).
- **No automated test suite exists** — there is no `test` script and no test runner configured. Verify changes via lint, build, and manual testing against the running app.

### Write API auth

Write endpoints (`POST`/`PATCH`) check for an `x-admin-token` header, but `lib/admin.ts` currently returns `true` unconditionally, so any token (or none) is accepted. Read endpoints are open.
