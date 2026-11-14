-- Phase D: multi-step plans.
-- A plan is a group of PENDING AiAction rows sharing workflow_id/step_order.
-- Steps are still confirmed explicitly; nothing auto-runs.
ALTER TYPE "AiActionStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

ALTER TABLE "ai_actions" ADD COLUMN "workflow_id" UUID;
ALTER TABLE "ai_actions" ADD COLUMN "step_order" INTEGER;
ALTER TABLE "ai_actions" ADD COLUMN "workflow_title" TEXT;

CREATE INDEX "ai_actions_workflow_id_idx" ON "ai_actions"("workflow_id");
