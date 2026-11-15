-- Customer visit tracking, refund bookkeeping and CRM query index.
--
-- `last_visit_counted_at` lets us count a visit at most once per Kenya
-- calendar day while still touching `last_visit` on bookings/payments.
-- Existing customers are backfilled from their last known visit so historical
-- data keeps working without inflating counts.
--
-- Idempotent on purpose: safe to apply by hand if a deployment skipped it.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_visit_counted_at" TIMESTAMP(3);
UPDATE "customers" SET "last_visit_counted_at" = "last_visit" WHERE "last_visit_counted_at" IS NULL;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_conversation_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "orders_restaurant_id_customer_phone_idx" ON "orders"("restaurant_id", "customer_phone");
