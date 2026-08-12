-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID,
    "user_id" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "sensitivity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_restaurant_id_idx" ON "audit_logs"("restaurant_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
