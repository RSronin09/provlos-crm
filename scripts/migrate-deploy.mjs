import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// Vercel builds preview branches too. Only the production deployment should
// run migrations — preview builds racing production for the migration
// advisory lock (and mutating the production schema from a branch) is
// exactly what this prevents.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(`Skipping prisma migrate deploy for ${process.env.VERCEL_ENV} build.`);
  process.exit(0);
}

// Prefer an explicitly-configured direct URL. DATABASE_URL_UNPOOLED and
// POSTGRES_URL_NON_POOLING are auto-created by the Neon Vercel integration.
const explicitDirect =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

let url = explicitDirect || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — cannot run migrations.");
  process.exit(1);
}

if (!explicitDirect && url.includes("-pooler")) {
  // prisma migrate holds a session-scoped Postgres advisory lock, which
  // Neon's pooled host (PgBouncer, transaction mode) cannot support — it
  // fails with P1002 "Timed out trying to acquire a postgres advisory lock".
  // Neon's direct host is the pooled host without the "-pooler" suffix.
  url = url.replace("-pooler", "");
  console.log("Pooled Neon connection string detected — using the direct host for migrations.");
}

const attempts = 3;
for (let attempt = 1; attempt <= attempts; attempt++) {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  if (result.status === 0) process.exit(0);
  if (attempt < attempts) {
    const delaySeconds = attempt * 10;
    console.log(
      `prisma migrate deploy failed (attempt ${attempt}/${attempts}) — retrying in ${delaySeconds}s ` +
        "(suspended Neon computes can take a few seconds to wake).",
    );
    await sleep(delaySeconds * 1000);
  }
}

console.error(`prisma migrate deploy failed after ${attempts} attempts.`);
process.exit(1);
