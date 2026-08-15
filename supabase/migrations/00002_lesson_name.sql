-- Lessons get a real name; the old description column held the label and
-- now becomes an optional blurb. Backfill name from the existing label so
-- no lesson loses its text, then enforce NOT NULL on the new column.
ALTER TABLE "public"."LESSON" ADD COLUMN "name" character varying;

UPDATE "public"."LESSON" SET "name" = "description" WHERE "name" IS NULL;

ALTER TABLE "public"."LESSON" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "public"."LESSON" ALTER COLUMN "description" DROP NOT NULL;
