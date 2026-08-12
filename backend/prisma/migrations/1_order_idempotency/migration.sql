-- AlterTable
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_restaurant_id_idempotency_key_key" ON "orders"("restaurant_id", "idempotency_key");
