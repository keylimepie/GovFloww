-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'CONTRACTOR',
    "department_id" TEXT,
    "branch_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "signature_pin" TEXT,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "company_name" VARCHAR(200),
    "phone" VARCHAR(20),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "department_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stages" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "stageType" VARCHAR(20) NOT NULL DEFAULT 'SEQUENTIAL',
    "assigned_role" VARCHAR(30) NOT NULL,
    "sla_days" INTEGER NOT NULL DEFAULT 3,
    "allowed_actions" TEXT[],
    "required_docs" TEXT[],

    CONSTRAINT "workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parallel_stage_configs" (
    "id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "strategy" VARCHAR(30) NOT NULL,
    "quorum_count" INTEGER,

    CONSTRAINT "parallel_stage_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_routing_rules" (
    "id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "condition_field" VARCHAR(100) NOT NULL,
    "operator" VARCHAR(20) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "target_stage_id" TEXT NOT NULL,

    CONSTRAINT "stage_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_submissions" (
    "id" TEXT NOT NULL,
    "tracking_number" VARCHAR(50) NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "branch_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    "current_stage_id" TEXT,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_stages" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "assigned_to" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "sla_due_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parallel_approvals" (
    "id" TEXT NOT NULL,
    "file_stage_id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "decision" VARCHAR(20),
    "comment" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "author_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "comment_type" VARCHAR(20) NOT NULL DEFAULT 'COMMENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "metadata" JSONB NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "previous_hash" VARCHAR(64) NOT NULL,
    "row_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_signatures" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "tier" SMALLINT NOT NULL,
    "document_hash" VARCHAR(64) NOT NULL,
    "signature_data" TEXT NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "device_fingerprint" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_sequences" (
    "id" TEXT NOT NULL,
    "department_code" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tracking_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "workflow_definitions_department_id_idx" ON "workflow_definitions"("department_id");

-- CreateIndex
CREATE INDEX "workflow_definitions_status_idx" ON "workflow_definitions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_name_department_id_version_key" ON "workflow_definitions"("name", "department_id", "version");

-- CreateIndex
CREATE INDEX "workflow_stages_workflow_id_idx" ON "workflow_stages"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_stages_workflow_id_stage_order_key" ON "workflow_stages"("workflow_id", "stage_order");

-- CreateIndex
CREATE UNIQUE INDEX "parallel_stage_configs_stage_id_key" ON "parallel_stage_configs"("stage_id");

-- CreateIndex
CREATE INDEX "stage_routing_rules_stage_id_idx" ON "stage_routing_rules"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_submissions_tracking_number_key" ON "file_submissions"("tracking_number");

-- CreateIndex
CREATE INDEX "file_submissions_contractor_id_idx" ON "file_submissions"("contractor_id");

-- CreateIndex
CREATE INDEX "file_submissions_workflow_id_idx" ON "file_submissions"("workflow_id");

-- CreateIndex
CREATE INDEX "file_submissions_branch_id_idx" ON "file_submissions"("branch_id");

-- CreateIndex
CREATE INDEX "file_submissions_status_idx" ON "file_submissions"("status");

-- CreateIndex
CREATE INDEX "file_submissions_current_stage_id_idx" ON "file_submissions"("current_stage_id");

-- CreateIndex
CREATE INDEX "file_submissions_created_at_idx" ON "file_submissions"("created_at");

-- CreateIndex
CREATE INDEX "file_stages_submission_id_idx" ON "file_stages"("submission_id");

-- CreateIndex
CREATE INDEX "file_stages_stage_id_idx" ON "file_stages"("stage_id");

-- CreateIndex
CREATE INDEX "file_stages_assigned_to_idx" ON "file_stages"("assigned_to");

-- CreateIndex
CREATE INDEX "file_stages_status_idx" ON "file_stages"("status");

-- CreateIndex
CREATE INDEX "file_stages_sla_due_at_idx" ON "file_stages"("sla_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "parallel_approvals_file_stage_id_officer_id_key" ON "parallel_approvals"("file_stage_id", "officer_id");

-- CreateIndex
CREATE INDEX "comments_submission_id_idx" ON "comments"("submission_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "audit_logs_submission_id_idx" ON "audit_logs"("submission_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "digital_signatures_submission_id_idx" ON "digital_signatures"("submission_id");

-- CreateIndex
CREATE INDEX "digital_signatures_officer_id_idx" ON "digital_signatures"("officer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_sequences_department_code_year_key" ON "tracking_sequences"("department_code", "year");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_stage_configs" ADD CONSTRAINT "parallel_stage_configs_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_routing_rules" ADD CONSTRAINT "stage_routing_rules_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_submissions" ADD CONSTRAINT "file_submissions_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_submissions" ADD CONSTRAINT "file_submissions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_submissions" ADD CONSTRAINT "file_submissions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_stages" ADD CONSTRAINT "file_stages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_stages" ADD CONSTRAINT "file_stages_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_stages" ADD CONSTRAINT "file_stages_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_approvals" ADD CONSTRAINT "parallel_approvals_file_stage_id_fkey" FOREIGN KEY ("file_stage_id") REFERENCES "file_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_approvals" ADD CONSTRAINT "parallel_approvals_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
