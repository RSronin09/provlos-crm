-- Remove legacy enrichment subsystem (status field + queue table + enums).
DROP TABLE IF EXISTS "EnrichmentJob";

DROP INDEX IF EXISTS "Account_enrichmentStatus_idx";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "enrichmentStatus";

DROP TYPE IF EXISTS "JobType";
DROP TYPE IF EXISTS "JobStatus";
DROP TYPE IF EXISTS "EnrichmentStatus";
