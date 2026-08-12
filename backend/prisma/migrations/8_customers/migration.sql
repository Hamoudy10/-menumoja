-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('QR', 'POS', 'SMS', 'USSD', 'MANUAL');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "source" "CustomerSource" NOT NULL DEFAULT 'QR',
    "consent_marketing" BOOLEAN NOT NULL DEFAULT false,
    "consent_collected_at" TIMESTAMP(3),
    "preferred_channel" TEXT,
    "first_visit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_visit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_visits" INTEGER NOT NULL DEFAULT 1,
    "total_spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "average_spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_opted_out" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_restaurant_id_phone_key" ON "customers"("restaurant_id", "phone");

-- CreateIndex
CREATE INDEX "customers_restaurant_id_idx" ON "customers"("restaurant_id");

-- CreateIndex
CREATE INDEX "customers_last_visit_idx" ON "customers"("last_visit");

-- CreateIndex
CREATE INDEX "customers_total_spend_idx" ON "customers"("total_spend");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
