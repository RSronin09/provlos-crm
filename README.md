# ProvLOS CRM (Next.js + Prisma + Neon)

Core CRM architecture v1 for account funneling, contact tracking, activities, tasks, and enrichment job queueing.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL` to your Neon Postgres connection string and set a strong `ADMIN_TOKEN`.

4. Generate Prisma Client:

```bash
npm run prisma:generate
```

5. Run migrations:

```bash
npm run prisma:migrate -- --name crm_v1
```

6. Start dev server:

```bash
npm run dev
```

## Env Vars

- `DATABASE_URL`: required, Postgres connection string (Neon in local/dev/prod).
- `ADMIN_TOKEN`: required for write operations on API routes. Send via `x-admin-token` header.

Read endpoints are currently open. Write endpoints enforce `x-admin-token`.

## DB Migrate

Use Prisma migrations only (no ad-hoc SQL).

- Local development migration:

```bash
npm run prisma:migrate -- --name <migration_name>
```

- Deploy migrations in Vercel/CI:

```bash
npm run prisma:deploy
```

## Deploy Notes

- This app is Vercel-friendly: enrichment processing is request/job-based (`process-next` handles one queued job per request).
- Set `DATABASE_URL` and `ADMIN_TOKEN` in Vercel Project Settings.
- The Prisma datasource is configured to use only `env("DATABASE_URL")`; no localhost override should be used.
- Health check endpoint: `GET /api/health`.

## CRM Routes

- UI: `/crm`, `/crm/accounts`, `/crm/accounts/[id]`, `/crm/tasks`, `/crm/import`, `/crm/settings`
- API:
  - `GET /api/accounts`
  - `POST /api/accounts` (admin)
  - `GET /api/accounts/[id]`
  - `PATCH /api/accounts/[id]` (admin)
  - `GET /api/accounts/[id]/contacts`
  - `POST /api/accounts/[id]/contacts` (admin)
  - `PATCH /api/contacts/[id]` (admin)
  - `GET /api/accounts/[id]/activities`
  - `POST /api/accounts/[id]/activities` (admin)
  - `GET /api/tasks`
  - `POST /api/accounts/[id]/tasks` (admin)
  - `PATCH /api/tasks/[id]` (admin)
  - `POST /api/enrichment/enqueue` (admin)
  - `POST /api/enrichment/process-next` (admin)
  - `GET /api/health`
