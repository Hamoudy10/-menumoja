-- CreateEnum
CREATE TYPE "EtrSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "etr_submissions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'KRA_ETIMS',
    "status" "EtrSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "submitted_at" TIMESTAMP(3),
    "response_code" TEXT,
    "response_message" TEXT,
    "kra_invoice_number" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etr_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etr_submissions_receipt_id_key" ON "etr_submissions"("receipt_id");

-- CreateIndex
CREATE INDEX "etr_submissions_restaurant_id_idx" ON "etr_submissions"("restaurant_id");

-- CreateIndex
CREATE INDEX "etr_submissions_status_idx" ON "etr_submissions"("status");

-- AddForeignKey
ALTER TABLE "etr_submissions" ADD CONSTRAINT "etr_submissions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etr_submissions" ADD CONSTRAINT "etr_submissions_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

