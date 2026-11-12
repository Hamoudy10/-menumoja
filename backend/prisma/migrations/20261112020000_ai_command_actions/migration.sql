-- AI command layer: provenance + undo metadata on ai_actions.
ALTER TABLE "ai_actions" ADD COLUMN "conversation_id" UUID;
-- Raw args (as spoken/selected) are kept in `args`; resolved IDs in
-- `resolved_args`, so confirmation can safely re-resolve from the originals.
ALTER TABLE "ai_actions" ADD COLUMN "resolved_args" JSONB;
ALTER TABLE "ai_actions" ADD COLUMN "ui_context" JSONB;
ALTER TABLE "ai_actions" ADD COLUMN "before_state" JSONB;
ALTER TABLE "ai_actions" ADD COLUMN "undo_expires_at" TIMESTAMP(3);
ALTER TABLE "ai_actions" ADD COLUMN "undone_at" TIMESTAMP(3);

CREATE INDEX "ai_actions_conversation_id_idx" ON "ai_actions"("conversation_id");

ALTER TABLE "ai_actions"
  ADD CONSTRAINT "ai_actions_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
