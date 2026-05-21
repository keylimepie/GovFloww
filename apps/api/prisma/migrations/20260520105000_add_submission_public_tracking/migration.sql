ALTER TABLE "file_submissions" ADD COLUMN "public_trackable" BOOLEAN NOT NULL DEFAULT false;

UPDATE "roles"
SET "permissions" = array_append("permissions", 'submission:manage_public_tracking')
WHERE "code" = 'DEPARTMENT_ADMIN'
  AND NOT ('submission:manage_public_tracking' = ANY("permissions"));
