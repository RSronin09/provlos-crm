-- Create new enum type with CRM MVP stages.
CREATE TYPE "AccountStage_new" AS ENUM (
  'TARGET',
  'ENRICHING',
  'ENRICHED',
  'CONTACTED',
  'ENGAGED',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST'
);

-- Map legacy values into new stage values.
ALTER TABLE "Account"
ALTER COLUMN "stage" DROP DEFAULT,
ALTER COLUMN "stage" TYPE "AccountStage_new"
USING (
  CASE
    WHEN "stage"::text = 'OPPORTUNITY' THEN 'PROPOSAL'::"AccountStage_new"
    WHEN "stage"::text = 'CUSTOMER' THEN 'WON'::"AccountStage_new"
    ELSE "stage"::text::"AccountStage_new"
  END
);

DROP TYPE "AccountStage";
ALTER TYPE "AccountStage_new" RENAME TO "AccountStage";

ALTER TABLE "Account"
ALTER COLUMN "stage" SET DEFAULT 'TARGET';
