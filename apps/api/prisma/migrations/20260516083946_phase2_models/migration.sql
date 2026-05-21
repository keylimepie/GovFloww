/*
  Warnings:

  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_role` on the `workflow_stages` table. All the data in the column will be lost.
  - Added the required column `role_id` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `assigned_role_id` to the `workflow_stages` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "workflow_stages" DROP COLUMN "assigned_role",
ADD COLUMN     "assigned_role_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "hierarchy_level" INTEGER NOT NULL,
    "permissions" TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_key" VARCHAR(1000) NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_alerts" (
    "id" TEXT NOT NULL,
    "file_stage_id" TEXT NOT NULL,
    "alertType" VARCHAR(20) NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "sla_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "documents_submission_id_idx" ON "documents"("submission_id");

-- CreateIndex
CREATE INDEX "documents_uploader_id_idx" ON "documents"("uploader_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "sla_alerts_file_stage_id_idx" ON "sla_alerts"("file_stage_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_assigned_role_id_fkey" FOREIGN KEY ("assigned_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "file_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_alerts" ADD CONSTRAINT "sla_alerts_file_stage_id_fkey" FOREIGN KEY ("file_stage_id") REFERENCES "file_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
