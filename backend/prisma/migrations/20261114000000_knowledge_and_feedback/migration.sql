-- Phase E2/E3: product knowledge retrieval + command feedback.

-- CreateEnum
CREATE TYPE "CommandFeedbackRating" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_content_hash_key" ON "knowledge_chunks"("content_hash");

-- CreateIndex
CREATE INDEX "knowledge_chunks_restaurant_id_idx" ON "knowledge_chunks"("restaurant_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_category_idx" ON "knowledge_chunks"("category");

-- Full-text index for lexical retrieval (safe, no external embedding key required).
CREATE INDEX "knowledge_chunks_fts_idx" ON "knowledge_chunks"
  USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')));

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ai_command_feedback" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "user_id" UUID,
    "conversation_id" UUID,
    "tool" TEXT,
    "rating" "CommandFeedbackRating" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_command_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_command_feedback_restaurant_id_idx" ON "ai_command_feedback"("restaurant_id");

-- CreateIndex
CREATE INDEX "ai_command_feedback_rating_idx" ON "ai_command_feedback"("rating");

-- CreateIndex
CREATE INDEX "ai_command_feedback_created_at_idx" ON "ai_command_feedback"("created_at");

-- AddForeignKey
ALTER TABLE "ai_command_feedback" ADD CONSTRAINT "ai_command_feedback_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_command_feedback" ADD CONSTRAINT "ai_command_feedback_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
