-- DOR foundation: hierarchy, role metadata, tracking, Tok, Raye, Tippani.

ALTER TABLE "file_submissions"
  ALTER COLUMN "tracking_number" TYPE VARCHAR(100);

ALTER TABLE "branches"
  ADD COLUMN "branch_level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "parent_branch_id" TEXT,
  ADD COLUMN "cluster_type" VARCHAR(50),
  ADD COLUMN "nepali_name" VARCHAR(255),
  ADD COLUMN "is_dor_hq" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "branches"
  ADD CONSTRAINT "branches_parent_branch_id_fkey"
  FOREIGN KEY ("parent_branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "branches_parent_branch_id_idx" ON "branches"("parent_branch_id");
CREATE INDEX "branches_branch_level_idx" ON "branches"("branch_level");
CREATE INDEX "branches_cluster_type_idx" ON "branches"("cluster_type");

ALTER TABLE "users"
  ADD COLUMN "designation" VARCHAR(200),
  ADD COLUMN "employee_code" VARCHAR(50);

ALTER TABLE "workflow_definitions"
  ADD COLUMN "code" VARCHAR(50),
  ADD COLUMN "nepali_name" VARCHAR(255),
  ADD COLUMN "metadata_schema" JSONB,
  ADD COLUMN "is_publicly_trackable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "public_detail_level" VARCHAR(20) NOT NULL DEFAULT 'BASIC';

CREATE TABLE "dor_tracking_sequences" (
  "id" TEXT NOT NULL,
  "branch_code" VARCHAR(20) NOT NULL,
  "workflow_code" VARCHAR(20) NOT NULL,
  "fiscal_year" VARCHAR(20) NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "dor_tracking_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dor_tracking_sequences_branch_code_workflow_code_fiscal_year_key"
  ON "dor_tracking_sequences"("branch_code", "workflow_code", "fiscal_year");

CREATE TABLE "tok_assignments" (
  "id" TEXT NOT NULL,
  "file_stage_id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "tok_by" TEXT NOT NULL,
  "tok_to" TEXT NOT NULL,
  "task_description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "response_note" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "tok_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tok_assignments_file_stage_id_idx" ON "tok_assignments"("file_stage_id");
CREATE INDEX "tok_assignments_submission_id_idx" ON "tok_assignments"("submission_id");
CREATE INDEX "tok_assignments_tok_by_idx" ON "tok_assignments"("tok_by");
CREATE INDEX "tok_assignments_tok_to_idx" ON "tok_assignments"("tok_to");
CREATE INDEX "tok_assignments_status_idx" ON "tok_assignments"("status");

ALTER TABLE "tok_assignments"
  ADD CONSTRAINT "tok_assignments_file_stage_id_fkey"
  FOREIGN KEY ("file_stage_id") REFERENCES "file_stages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tok_assignments"
  ADD CONSTRAINT "tok_assignments_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tok_assignments"
  ADD CONSTRAINT "tok_assignments_tok_by_fkey"
  FOREIGN KEY ("tok_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tok_assignments"
  ADD CONSTRAINT "tok_assignments_tok_to_fkey"
  FOREIGN KEY ("tok_to") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "raye_requests" (
  "id" TEXT NOT NULL,
  "file_stage_id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "target_sakha" VARCHAR(20) NOT NULL,
  "target_branch_id" TEXT,
  "assigned_to" TEXT,
  "request_text" TEXT NOT NULL,
  "response_text" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "can_reassign" BOOLEAN NOT NULL DEFAULT true,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  "due_at" TIMESTAMP(3),

  CONSTRAINT "raye_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "raye_requests_file_stage_id_idx" ON "raye_requests"("file_stage_id");
CREATE INDEX "raye_requests_submission_id_idx" ON "raye_requests"("submission_id");
CREATE INDEX "raye_requests_requested_by_idx" ON "raye_requests"("requested_by");
CREATE INDEX "raye_requests_assigned_to_idx" ON "raye_requests"("assigned_to");
CREATE INDEX "raye_requests_target_branch_id_idx" ON "raye_requests"("target_branch_id");
CREATE INDEX "raye_requests_status_idx" ON "raye_requests"("status");

ALTER TABLE "raye_requests"
  ADD CONSTRAINT "raye_requests_file_stage_id_fkey"
  FOREIGN KEY ("file_stage_id") REFERENCES "file_stages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "raye_requests"
  ADD CONSTRAINT "raye_requests_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "raye_requests"
  ADD CONSTRAINT "raye_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "raye_requests"
  ADD CONSTRAINT "raye_requests_target_branch_id_fkey"
  FOREIGN KEY ("target_branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "raye_requests"
  ADD CONSTRAINT "raye_requests_assigned_to_fkey"
  FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tippani_metadata" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "file_stage_id" TEXT,
  "document_id" TEXT,
  "prepared_by" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "reference_documents" JSONB NOT NULL DEFAULT '[]',
  "prepared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tippani_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tippani_metadata_document_id_key" ON "tippani_metadata"("document_id");
CREATE INDEX "tippani_metadata_submission_id_idx" ON "tippani_metadata"("submission_id");
CREATE INDEX "tippani_metadata_file_stage_id_idx" ON "tippani_metadata"("file_stage_id");
CREATE INDEX "tippani_metadata_prepared_by_idx" ON "tippani_metadata"("prepared_by");

ALTER TABLE "tippani_metadata"
  ADD CONSTRAINT "tippani_metadata_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tippani_metadata"
  ADD CONSTRAINT "tippani_metadata_file_stage_id_fkey"
  FOREIGN KEY ("file_stage_id") REFERENCES "file_stages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tippani_metadata"
  ADD CONSTRAINT "tippani_metadata_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tippani_metadata"
  ADD CONSTRAINT "tippani_metadata_prepared_by_fkey"
  FOREIGN KEY ("prepared_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
