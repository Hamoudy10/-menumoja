-- AlterTable
ALTER TABLE "restaurant_tables" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "is_held" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_restaurant_id_idempotency_key_key" ON "payments"("restaurant_id", "idempotency_key");
