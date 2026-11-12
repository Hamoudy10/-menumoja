-- AlterTable
ALTER TABLE "orders" ADD COLUMN "device_id" TEXT,
ADD COLUMN "client_transaction_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_restaurant_id_device_id_client_transaction_id_key" ON "orders"("restaurant_id", "device_id", "client_transaction_id");

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "device_id" TEXT,
ADD COLUMN "client_transaction_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_restaurant_id_device_id_client_transaction_id_key" ON "payments"("restaurant_id", "device_id", "client_transaction_id");

-- CreateEnum
CREATE TYPE "SyncChangeStatus" AS ENUM ('PENDING', 'APPLIED');

-- CreateTable
CREATE TABLE "sync_changes" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "device_id" TEXT,
    "client_transaction_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "mutation_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncChangeStatus" NOT NULL DEFAULT 'PENDING',
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_changes_restaurant_id_device_id_client_transaction_id_key" ON "sync_changes"("restaurant_id", "device_id", "client_transaction_id");

-- CreateIndex
CREATE INDEX "sync_changes_restaurant_id_idx" ON "sync_changes"("restaurant_id");

-- CreateIndex
CREATE INDEX "sync_changes_restaurant_id_status_idx" ON "sync_changes"("restaurant_id", "status");

-- AddForeignKey
ALTER TABLE "sync_changes" ADD CONSTRAINT "sync_changes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
