-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_id" UUID,
    "receipt_number" TEXT NOT NULL,
    "serial_number" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "vat_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL,
    "cashier_id" UUID,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "order_number" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "restaurant_snapshot" JSONB NOT NULL,
    "is_refund" BOOLEAN NOT NULL DEFAULT false,
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "receipts_restaurant_id_idx" ON "receipts"("restaurant_id");

-- CreateIndex
CREATE INDEX "receipts_order_id_idx" ON "receipts"("order_id");

-- CreateIndex
CREATE INDEX "receipts_payment_id_idx" ON "receipts"("payment_id");

-- CreateIndex
CREATE INDEX "receipts_issue_date_idx" ON "receipts"("issue_date");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
