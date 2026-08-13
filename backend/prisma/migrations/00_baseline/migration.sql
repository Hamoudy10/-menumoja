-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlatformAdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TRIAL', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LayoutStyle" AS ENUM ('GRID', 'LIST');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "SpiceLevel" AS ENUM ('NONE', 'MILD', 'MEDIUM', 'HOT', 'VERY_HOT');

-- CreateEnum
CREATE TYPE "QRType" AS ENUM ('TABLE', 'GENERAL', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('WAITER', 'CASHIER', 'KITCHEN', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'UNPAID', 'PARTIAL', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('MPESA', 'CASH', 'CARD', 'SPLIT', 'PENDING');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "CashStatus" AS ENUM ('OPEN', 'CLOSED', 'DISCREPANCY_FLAGGED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('CUSTOMER_CHAT', 'OWNER_SETUP');

-- CreateEnum
CREATE TYPE "AIContentType" AS ENUM ('MENU_DESCRIPTION', 'SOCIAL_POST', 'RESTAURANT_DESC', 'IMAGE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MOTION_AFTER_HOURS', 'UNATTENDED_TABLE', 'CASH_AREA_ACTIVITY', 'CAPACITY_HIGH', 'STAFF_ABSENT');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('OWNER', 'STAFF', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'LOW_STOCK', 'CAMERA_ALERT', 'SOCIAL_POST_PUBLISHED', 'REVIEW_RECEIVED', 'SUBSCRIPTION_EXPIRING');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('SPECIAL', 'OFFER', 'EVENT', 'GIVEAWAY');

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "PlatformAdminRole" NOT NULL,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly_kes" DECIMAL(10,2) NOT NULL,
    "price_yearly_kes" DECIMAL(10,2) NOT NULL,
    "max_menu_items" INTEGER,
    "max_tables" INTEGER,
    "has_ordering" BOOLEAN NOT NULL DEFAULT false,
    "has_analytics" BOOLEAN NOT NULL DEFAULT false,
    "has_surveillance" BOOLEAN NOT NULL DEFAULT false,
    "has_ussd" BOOLEAN NOT NULL DEFAULT false,
    "has_multi_branch" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "otp_code" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_step" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "description_sw" TEXT,
    "logo_url" TEXT,
    "cover_photo_url" TEXT,
    "cover_video_url" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Mombasa',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "kra_pin" TEXT,
    "business_reg_no" TEXT,
    "vat_reg_no" TEXT,
    "business_type" TEXT DEFAULT 'Restaurant',
    "county" TEXT DEFAULT 'Mombasa',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "is_halal_certified" BOOLEAN NOT NULL DEFAULT false,
    "dietary_options" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspension_reason" TEXT,
    "plan_id" UUID NOT NULL,
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trial_ends_at" TIMESTAMP(3),
    "plan_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_settings" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "primary_color" TEXT NOT NULL DEFAULT '#2563EB',
    "secondary_color" TEXT NOT NULL DEFAULT '#F59E0B',
    "font_family" TEXT NOT NULL DEFAULT 'Inter',
    "gradient_start" TEXT,
    "gradient_end" TEXT,
    "use_gradient" BOOLEAN NOT NULL DEFAULT false,
    "heading_font" TEXT,
    "body_font" TEXT,
    "accent_font" TEXT,
    "layout_style" "LayoutStyle" NOT NULL DEFAULT 'GRID',
    "welcome_message" TEXT,
    "welcome_message_sw" TEXT,
    "announcement" TEXT,
    "announcement_active" BOOLEAN NOT NULL DEFAULT false,
    "language_english" BOOLEAN NOT NULL DEFAULT true,
    "language_swahili" BOOLEAN NOT NULL DEFAULT false,
    "language_arabic" BOOLEAN NOT NULL DEFAULT false,
    "show_prices" BOOLEAN NOT NULL DEFAULT true,
    "allow_ordering" BOOLEAN NOT NULL DEFAULT false,
    "allow_cash_payment" BOOLEAN NOT NULL DEFAULT true,
    "allow_mpesa_payment" BOOLEAN NOT NULL DEFAULT false,
    "tip_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tip_percentages" INTEGER[],
    "service_charge_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "mpesa_shortcode" TEXT,
    "mpesa_passkey" TEXT,
    "mpesa_business_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_branches" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "manager_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_sw" TEXT,
    "name_ar" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_sw" TEXT,
    "name_ar" TEXT,
    "description" TEXT NOT NULL,
    "description_sw" TEXT,
    "description_ar" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "photo_url" TEXT,
    "photo_urls" TEXT[],
    "photo_generated_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_todays_special" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_new" BOOLEAN NOT NULL DEFAULT false,
    "preparation_time_minutes" INTEGER,
    "calories" INTEGER,
    "is_halal" BOOLEAN NOT NULL DEFAULT false,
    "is_vegetarian" BOOLEAN NOT NULL DEFAULT false,
    "is_vegan" BOOLEAN NOT NULL DEFAULT false,
    "is_gluten_free" BOOLEAN NOT NULL DEFAULT false,
    "spice_level" "SpiceLevel" NOT NULL DEFAULT 'NONE',
    "contains_nuts" BOOLEAN NOT NULL DEFAULT false,
    "contains_dairy" BOOLEAN NOT NULL DEFAULT false,
    "contains_seafood" BOOLEAN NOT NULL DEFAULT false,
    "allergen_notes" TEXT,
    "ingredients" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_suggestions" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "suggested_item_id" UUID NOT NULL,

    CONSTRAINT "menu_item_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_specials_schedule" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "special_price" DECIMAL(10,2),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_specials_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "type" "PromotionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "description_sw" TEXT,
    "menu_item_id" UUID,
    "special_price" DECIMAL(10,2),
    "image_url" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "table_number" INTEGER,
    "qr_type" "QRType" NOT NULL,
    "qr_image_url" TEXT,
    "qr_card_pdf_url" TEXT,
    "target_url" TEXT NOT NULL,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_scans" (
    "id" UUID NOT NULL,
    "qr_code_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_type" TEXT,
    "browser" TEXT,
    "ip_address" TEXT,
    "session_id" TEXT NOT NULL,
    "language_used" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "employee_number" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "national_id" TEXT,
    "kra_pin" TEXT,
    "nhif_number" TEXT,
    "nssf_number" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "address" TEXT,
    "emergency_name" TEXT,
    "emergency_phone" TEXT,
    "emergency_relation" TEXT,
    "next_of_kin" TEXT,
    "next_of_kin_phone" TEXT,
    "next_of_kin_relation" TEXT,
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "bank_account" TEXT,
    "monthly_salary" DECIMAL(10,2),
    "hourly_rate" DECIMAL(10,2),
    "leave_days" INTEGER DEFAULT 21,
    "start_date" TIMESTAMP(3),
    "notes" TEXT,
    "pin_hash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "clock_in" TIMESTAMP(3) NOT NULL,
    "clock_out" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "capacity" INTEGER,
    "status" "TableStatus" NOT NULL DEFAULT 'FREE',
    "area" TEXT,
    "shape" TEXT DEFAULT 'ROUND',
    "position_x" INTEGER NOT NULL DEFAULT 0,
    "position_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 2,
    "height" INTEGER NOT NULL DEFAULT 2,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "zone_id" UUID,
    "current_session_id" TEXT,
    "qr_code_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_zones" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#E2E8F0',
    "position_x" INTEGER NOT NULL DEFAULT 0,
    "position_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 12,
    "height" INTEGER NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_sessions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "guest_count" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_id" UUID,
    "table_number" INTEGER,
    "qr_code_id" UUID,
    "session_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_method" "OrderPaymentMethod" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "service_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tip_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "special_notes" TEXT,
    "estimated_prep_minutes" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "prepared_at" TIMESTAMP(3),
    "served_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "waiter_id" UUID,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "item_name" TEXT NOT NULL,
    "item_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "special_instructions" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "mpesa_transaction_id" TEXT,
    "mpesa_phone" TEXT,
    "mpesa_checkout_request_id" TEXT,
    "mpesa_receipt_number" TEXT,
    "cash_received" DECIMAL(10,2),
    "change_given" DECIMAL(10,2),
    "cashier_id" UUID,
    "processed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_reconciliation" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "shift_start" TIMESTAMP(3) NOT NULL,
    "shift_end" TIMESTAMP(3),
    "expected_cash" DECIMAL(10,2) NOT NULL,
    "actual_cash" DECIMAL(10,2),
    "discrepancy" DECIMAL(10,2),
    "status" "CashStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "conversation_type" "ConversationType" NOT NULL DEFAULT 'CUSTOMER_CHAT',
    "messages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_faq" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "question_sw" TEXT,
    "answer_sw" TEXT,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "times_triggered" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generated_content" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "content_type" "AIContentType" NOT NULL,
    "prompt_used" TEXT NOT NULL,
    "generated_content" TEXT NOT NULL,
    "image_url" TEXT,
    "was_used" BOOLEAN NOT NULL DEFAULT false,
    "was_modified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generated_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 554,
    "username" TEXT,
    "password_encrypted" TEXT,
    "stream_url" TEXT NOT NULL,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_alerts" (
    "id" UUID NOT NULL,
    "camera_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "clip_url" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total_scans" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_revenue_kes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revenue_mpesa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revenue_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "average_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "items_sold" INTEGER NOT NULL DEFAULT 0,
    "peak_hour" INTEGER,
    "new_customers" INTEGER NOT NULL DEFAULT 0,
    "ai_questions_asked" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_analytics" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_analytics" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "search_term" TEXT NOT NULL,
    "results_found" BOOLEAN NOT NULL,
    "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ussd_sessions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID,
    "session_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "current_menu" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ussd_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID,
    "phone" TEXT NOT NULL,
    "direction" "SmsDirection" NOT NULL,
    "message" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "status" "SmsStatus" NOT NULL DEFAULT 'SENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "recipient_type" "RecipientType" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "owners_email_key" ON "owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "owners_phone_key" ON "owners"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE INDEX "restaurants_owner_id_idx" ON "restaurants"("owner_id");

-- CreateIndex
CREATE INDEX "restaurants_plan_id_idx" ON "restaurants"("plan_id");

-- CreateIndex
CREATE INDEX "restaurants_slug_idx" ON "restaurants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_settings_restaurant_id_key" ON "restaurant_settings"("restaurant_id");

-- CreateIndex
CREATE INDEX "opening_hours_restaurant_id_idx" ON "opening_hours"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_restaurant_id_day_of_week_key" ON "opening_hours"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE INDEX "restaurant_branches_restaurant_id_idx" ON "restaurant_branches"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_categories_restaurant_id_idx" ON "menu_categories"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_items_restaurant_id_idx" ON "menu_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "menu_items"("category_id");

-- CreateIndex
CREATE INDEX "menu_item_suggestions_item_id_idx" ON "menu_item_suggestions"("item_id");

-- CreateIndex
CREATE INDEX "menu_item_suggestions_suggested_item_id_idx" ON "menu_item_suggestions"("suggested_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_suggestions_item_id_suggested_item_id_key" ON "menu_item_suggestions"("item_id", "suggested_item_id");

-- CreateIndex
CREATE INDEX "daily_specials_schedule_restaurant_id_idx" ON "daily_specials_schedule"("restaurant_id");

-- CreateIndex
CREATE INDEX "daily_specials_schedule_item_id_idx" ON "daily_specials_schedule"("item_id");

-- CreateIndex
CREATE INDEX "promotions_restaurant_id_idx" ON "promotions"("restaurant_id");

-- CreateIndex
CREATE INDEX "promotions_menu_item_id_idx" ON "promotions"("menu_item_id");

-- CreateIndex
CREATE INDEX "promotions_is_active_idx" ON "promotions"("is_active");

-- CreateIndex
CREATE INDEX "qr_codes_restaurant_id_idx" ON "qr_codes"("restaurant_id");

-- CreateIndex
CREATE INDEX "qr_scans_restaurant_id_idx" ON "qr_scans"("restaurant_id");

-- CreateIndex
CREATE INDEX "qr_scans_qr_code_id_idx" ON "qr_scans"("qr_code_id");

-- CreateIndex
CREATE INDEX "qr_scans_session_id_idx" ON "qr_scans"("session_id");

-- CreateIndex
CREATE INDEX "qr_scans_scanned_at_idx" ON "qr_scans"("scanned_at");

-- CreateIndex
CREATE INDEX "staff_restaurant_id_idx" ON "staff"("restaurant_id");

-- CreateIndex
CREATE INDEX "staff_shifts_staff_id_idx" ON "staff_shifts"("staff_id");

-- CreateIndex
CREATE INDEX "staff_shifts_restaurant_id_idx" ON "staff_shifts"("restaurant_id");

-- CreateIndex
CREATE INDEX "restaurant_tables_restaurant_id_idx" ON "restaurant_tables"("restaurant_id");

-- CreateIndex
CREATE INDEX "restaurant_tables_zone_id_idx" ON "restaurant_tables"("zone_id");

-- CreateIndex
CREATE INDEX "restaurant_tables_qr_code_id_idx" ON "restaurant_tables"("qr_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_restaurant_id_table_number_key" ON "restaurant_tables"("restaurant_id", "table_number");

-- CreateIndex
CREATE INDEX "table_zones_restaurant_id_idx" ON "table_zones"("restaurant_id");

-- CreateIndex
CREATE INDEX "table_sessions_table_id_idx" ON "table_sessions"("table_id");

-- CreateIndex
CREATE INDEX "table_sessions_ended_at_idx" ON "table_sessions"("ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_idx" ON "orders"("restaurant_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_session_id_idx" ON "orders"("session_id");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_waiter_id_idx" ON "orders"("waiter_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mpesa_transaction_id_key" ON "payments"("mpesa_transaction_id");

-- CreateIndex
CREATE INDEX "payments_restaurant_id_idx" ON "payments"("restaurant_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_cashier_id_idx" ON "payments"("cashier_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "cash_reconciliation_restaurant_id_idx" ON "cash_reconciliation"("restaurant_id");

-- CreateIndex
CREATE INDEX "cash_reconciliation_cashier_id_idx" ON "cash_reconciliation"("cashier_id");

-- CreateIndex
CREATE INDEX "ai_conversations_restaurant_id_idx" ON "ai_conversations"("restaurant_id");

-- CreateIndex
CREATE INDEX "ai_conversations_session_id_idx" ON "ai_conversations"("session_id");

-- CreateIndex
CREATE INDEX "restaurant_faq_restaurant_id_idx" ON "restaurant_faq"("restaurant_id");

-- CreateIndex
CREATE INDEX "ai_generated_content_restaurant_id_idx" ON "ai_generated_content"("restaurant_id");

-- CreateIndex
CREATE INDEX "cameras_restaurant_id_idx" ON "cameras"("restaurant_id");

-- CreateIndex
CREATE INDEX "camera_alerts_camera_id_idx" ON "camera_alerts"("camera_id");

-- CreateIndex
CREATE INDEX "camera_alerts_restaurant_id_idx" ON "camera_alerts"("restaurant_id");

-- CreateIndex
CREATE INDEX "camera_alerts_occurred_at_idx" ON "camera_alerts"("occurred_at");

-- CreateIndex
CREATE INDEX "analytics_daily_restaurant_id_idx" ON "analytics_daily"("restaurant_id");

-- CreateIndex
CREATE INDEX "analytics_daily_date_idx" ON "analytics_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_restaurant_id_date_key" ON "analytics_daily"("restaurant_id", "date");

-- CreateIndex
CREATE INDEX "menu_item_analytics_restaurant_id_idx" ON "menu_item_analytics"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_item_analytics_menu_item_id_idx" ON "menu_item_analytics"("menu_item_id");

-- CreateIndex
CREATE INDEX "menu_item_analytics_date_idx" ON "menu_item_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_analytics_menu_item_id_date_key" ON "menu_item_analytics"("menu_item_id", "date");

-- CreateIndex
CREATE INDEX "search_analytics_restaurant_id_idx" ON "search_analytics"("restaurant_id");

-- CreateIndex
CREATE INDEX "search_analytics_searched_at_idx" ON "search_analytics"("searched_at");

-- CreateIndex
CREATE UNIQUE INDEX "ussd_sessions_session_id_key" ON "ussd_sessions"("session_id");

-- CreateIndex
CREATE INDEX "ussd_sessions_restaurant_id_idx" ON "ussd_sessions"("restaurant_id");

-- CreateIndex
CREATE INDEX "ussd_sessions_session_id_idx" ON "ussd_sessions"("session_id");

-- CreateIndex
CREATE INDEX "ussd_sessions_phone_idx" ON "ussd_sessions"("phone");

-- CreateIndex
CREATE INDEX "sms_logs_restaurant_id_idx" ON "sms_logs"("restaurant_id");

-- CreateIndex
CREATE INDEX "sms_logs_phone_idx" ON "sms_logs"("phone");

-- CreateIndex
CREATE INDEX "notifications_restaurant_id_idx" ON "notifications"("restaurant_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

