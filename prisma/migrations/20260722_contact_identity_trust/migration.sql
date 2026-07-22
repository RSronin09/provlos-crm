-- Data-trust flag, separate from isDoNotContact (a compliance opt-out).
-- Backfills true for every contact whose IDENTITY came from the retired
-- Serper name-guessing discovery (source IN 'serper_linkedin'/'serper_web'/
-- 'serper') — no employer/location validation was ever run on these.
-- Excludes 'serper_email_hunt' and 'hunter+serper': those are channel
-- enrichment (email lookup) for a contact whose identity came from a
-- trusted source (registry, Instantly, or Hunter domain search).
ALTER TABLE "Contact" ADD COLUMN "isUnverifiedIdentity" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Contact_isUnverifiedIdentity_idx" ON "Contact"("isUnverifiedIdentity");

UPDATE "Contact"
SET "isUnverifiedIdentity" = true
WHERE "source" IN ('serper_linkedin', 'serper_web', 'serper');
