-- Customer visit tracking, refund bookkeeping and CRM query index.
--
-- `last_visit_counted_at` lets us count a visit at most once per Kenya
-- calendar day while still touching `last_visit` on bookings/payments.
-- Existing customers are backfilled from their last known visit so historical
-- data keeps working without inflating counts.

ALTER TABLE "customers" ADD COLUMN "last_visit_counted_at" TIMESTAMP(3);
UPDATE "customers" SET "last_visit_counted_at" = "last_visit";

ALTER TABLE "payments" ADD COLUMN "refund_conversation_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "refunded_at" TIMESTAMP(3);

CREATE INDEX "orders_restaurant_id_customer_phone_idx" ON "orders"("restaurant_id", "customer_phone");
