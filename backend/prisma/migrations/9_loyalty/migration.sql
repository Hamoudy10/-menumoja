-- CreateEnum
CREATE TYPE "LoyaltyTriggerType" AS ENUM ('VISIT_COUNT', 'SPEND_THRESHOLD', 'ITEM_COUNT', 'CATEGORY_PURCHASE', 'INACTIVITY', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "LoyaltyRewardType" AS ENUM ('FREE_ITEM', 'DISCOUNT', 'FIXED_AMOUNT', 'PERCENTAGE', 'POINTS', 'BUNDLE');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');

-- CreateEnum
CREATE TYPE "LoyaltyRewardStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "date_of_birth" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Loyalty Points',
    "points_per_kes" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "points_expiry_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rules" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" "LoyaltyTriggerType" NOT NULL,
    "trigger_value" TEXT NOT NULL,
    "reward_type" "LoyaltyRewardType" NOT NULL,
    "reward_value" TEXT NOT NULL,
    "reward_item_id" UUID,
    "reward_quantity" INTEGER,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "total_redeemed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "rule_id" UUID,
    "reward_type" "LoyaltyRewardType" NOT NULL,
    "reward_value" TEXT NOT NULL,
    "item_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "LoyaltyRewardStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_restaurant_id_key" ON "loyalty_programs"("restaurant_id");

-- CreateIndex
CREATE INDEX "loyalty_rules_restaurant_id_idx" ON "loyalty_rules"("restaurant_id");

-- CreateIndex
CREATE INDEX "loyalty_rules_is_active_idx" ON "loyalty_rules"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_customer_id_key" ON "loyalty_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "loyalty_accounts_restaurant_id_idx" ON "loyalty_accounts"("restaurant_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_restaurant_id_idx" ON "loyalty_transactions"("restaurant_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_account_id_idx" ON "loyalty_transactions"("account_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_created_at_idx" ON "loyalty_transactions"("created_at");

-- CreateIndex
CREATE INDEX "loyalty_rewards_restaurant_id_idx" ON "loyalty_rewards"("restaurant_id");

-- CreateIndex
CREATE INDEX "loyalty_rewards_account_id_idx" ON "loyalty_rewards"("account_id");

-- CreateIndex
CREATE INDEX "loyalty_rewards_status_idx" ON "loyalty_rewards"("status");

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rules" ADD CONSTRAINT "loyalty_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
