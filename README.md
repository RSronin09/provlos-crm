# ProvLOS CRM (Next.js + Prisma + Neon)

Core CRM architecture v1 for account funneling, contact tracking, activities, and tasks.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL` to your Neon Postgres connection string. Optionally set a strong `ADMIN_TOKEN` to require authentication for write operations.

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
- `ADMIN_TOKEN`: optional. When set, write API routes require the token via the `x-admin-token` header or the `crm_admin_token` cookie (set automatically when you enter the token in the UI's Admin Token field). When unset, writes are open — only suitable for private/internal deployments.
- `APOLLO_API_KEY`: optional, primary provider for B2B contact search + email/phone enrichment.
- `APOLLO_PLAN_ENABLED`: set to `true` if your Apollo plan includes `people/match` (enables single-contact enrichment).
- `PDL_API_KEY`: optional, People Data Labs person-enrichment fallback (healthcare & non-B2B industries).
- `SERPER_API_KEY`: optional but recommended for live web search in discovery and decision-maker lookup.
- `HUNTER_API_KEY`: optional but recommended for domain email discovery in decision-maker lookup.
- `INSTANTLY_API_KEY`: optional, enables the Instantly SuperSearch lead finder.

Read endpoints are always open.

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

### Vercel (recommended)

1. In Vercel Project Settings → **Environment Variables**, add:
   - `DATABASE_URL` — your Neon Postgres connection string (include `?sslmode=require`, e.g. `postgresql://user:pass@host/db?sslmode=require`)
   - `ADMIN_TOKEN` — (recommended) a strong secret required for write operations
   - `APOLLO_API_KEY` / `PDL_API_KEY` — (optional) contact enrichment providers
   - `SERPER_API_KEY` — (optional) for live web search in lead discovery
   - `HUNTER_API_KEY` — (optional) for domain email discovery
   - `INSTANTLY_API_KEY` — (optional) for the Instantly SuperSearch lead finder

2. In Vercel Project Settings → **Build & Development Settings**, set the **Build Command** to:
   ```
   npm run vercel-build
   ```
   This runs `scripts/migrate-deploy.mjs` (then `next build`) so migrations are applied on every production deploy. The script:
   - only migrates on **production** builds (preview/branch builds skip migrations so they never race or mutate the production schema);
   - automatically uses Neon's **direct** (non-pooled) host for migrations — Prisma's migration advisory lock does not work through Neon's `-pooler` endpoint (error P1002). If `DIRECT_DATABASE_URL`, `DATABASE_URL_UNPOOLED`, or `POSTGRES_URL_NON_POOLING` is set it uses that; otherwise it derives the direct host by stripping `-pooler` from `DATABASE_URL`;
   - retries up to 3 times to ride out suspended Neon computes waking up.

3. Deploy. Migrations run against the production database before each production build.

> **Troubleshooting "Application error"**: If you see this on Vercel, the two most common causes are:
> - `DATABASE_URL` is not set → add it in Vercel env vars
> - Migrations have not been applied → set Build Command to `npm run vercel-build` and redeploy

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
