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
- `SERPER_API_KEY`: optional but recommended for live web search in decision-maker lookup.
- `HUNTER_API_KEY`: optional but recommended for domain email discovery in decision-maker lookup.

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

- UI: `/crm`, `/crm/accounts`, `/crm/accounts/[id]`, `/crm/discovery`, `/crm/tasks`, `/crm/import`, `/crm/settings`
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
  - `POST /api/discovery/enqueue` (admin)
  - `POST /api/discovery/process-next` (admin, processes one queued discovery job)
  - `GET /api/discovery/candidates`
  - `PATCH /api/discovery/candidates/[id]` (admin)
  - `POST /api/discovery/candidates/[id]/promote` (admin)
  - `POST /api/decision-makers/search` (admin; company lookup -> decision makers)
  - `GET /api/health`

## Decision Maker Search

Use `/crm/discovery` to search by company name and return likely decision makers with name, phone, email, and title.

- The endpoint uses live provider lookups (`SERPER_API_KEY`, `HUNTER_API_KEY`) with strict request timeouts.
- Existing contacts are returned immediately unless "force refresh" is enabled in UI.
- Results are persisted to `Contact` and deduplicated by email/name.
- If both provider keys are missing, the endpoint returns a configuration error.

The legacy discovery candidate routes remain available if you still want a separate net-new lead queue.
