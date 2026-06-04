-- Dynamic file routing: track the live office on submissions and file-stage instances.

ALTER TABLE "file_submissions"
  ADD COLUMN "current_branch_id" TEXT;

UPDATE "file_submissions"
SET "current_branch_id" = "branch_id"
WHERE "current_branch_id" IS NULL;

ALTER TABLE "file_submissions"
  ADD CONSTRAINT "file_submissions_current_branch_id_fkey"
  FOREIGN KEY ("current_branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "file_submissions_current_branch_id_idx"
  ON "file_submissions"("current_branch_id");

ALTER TABLE "file_stages"
  ADD COLUMN "branch_id" TEXT;

UPDATE "file_stages" fs
SET "branch_id" = sub."current_branch_id"
FROM "file_submissions" sub
WHERE fs."submission_id" = sub."id"
  AND fs."branch_id" IS NULL;

ALTER TABLE "file_stages"
  ADD CONSTRAINT "file_stages_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "file_stages_branch_id_idx"
  ON "file_stages"("branch_id");
