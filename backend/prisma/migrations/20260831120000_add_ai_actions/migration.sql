-- CreateEnum
CREATE TYPE "AiActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_actions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "tool" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
    "executed_by_id" UUID,
    "result" JSONB,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_actions_restaurant_id_idx" ON "ai_actions"("restaurant_id");

-- CreateIndex
CREATE INDEX "ai_actions_status_idx" ON "ai_actions"("status");

-- AddForeignKey
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
