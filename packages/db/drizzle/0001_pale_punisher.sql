CREATE TYPE "public"."billing_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."billing_run_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."discount_scope" AS ENUM('SUBSCRIPTION', 'PRODUCT');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('FIXED', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('GOODS', 'SERVICE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'STAFF', 'CUSTOMER');--> statement-breakpoint
CREATE TABLE "billing_run" (
	"id" text PRIMARY KEY NOT NULL,
	"billing_date" date NOT NULL,
	"billing_run_status" "billing_run_status" NOT NULL,
	"subscriptions_scanned" integer NOT NULL,
	"invoices_created" integer NOT NULL,
	"subscriptions_skipped" integer NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "billing_run_subscriptions_scanned_nonnegative" CHECK (subscriptions_scanned >= 0),
	CONSTRAINT "billing_run_invoices_created_nonnegative" CHECK (invoices_created >= 0),
	CONSTRAINT "billing_run_subscriptions_skipped_nonnegative" CHECK (subscriptions_skipped >= 0),
	CONSTRAINT "billing_run_total_amount_minor_range" CHECK (total_amount_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "billing_run_structure_0" CHECK (completed_at IS NULL OR completed_at >= started_at)
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company_name" text,
	"billing_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_user_unique" UNIQUE("user_id"),
	CONSTRAINT "customer_email_unique" UNIQUE("email"),
	CONSTRAINT "customer_structure_0" CHECK (email = lower(btrim(email)) AND length(email) > 0)
);
--> statement-breakpoint
CREATE TABLE "discount_application" (
	"id" text PRIMARY KEY NOT NULL,
	"discount_rule_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"invoice_line_id" text,
	"applied_amount_minor" bigint NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	CONSTRAINT "discount_application_applied_amount_minor_range" CHECK (applied_amount_minor BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "discount_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"fixed_amount_minor" bigint,
	"percentage_bps" integer,
	"minimum_purchase_minor" bigint,
	"minimum_quantity" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"discount_scope" "discount_scope" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_rule_fixed_amount_minor_range" CHECK (fixed_amount_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "discount_rule_percentage_bps_range" CHECK (percentage_bps BETWEEN 0 AND 10000),
	CONSTRAINT "discount_rule_minimum_purchase_minor_range" CHECK (minimum_purchase_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "discount_rule_minimum_quantity_positive" CHECK (minimum_quantity > 0),
	CONSTRAINT "discount_rule_usage_limit_positive" CHECK (usage_limit > 0),
	CONSTRAINT "discount_rule_structure_0" CHECK ((discount_type = 'FIXED' AND fixed_amount_minor IS NOT NULL AND percentage_bps IS NULL) OR (discount_type = 'PERCENTAGE' AND percentage_bps IS NOT NULL AND fixed_amount_minor IS NULL)),
	CONSTRAINT "discount_rule_structure_1" CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
--> statement-breakpoint
CREATE TABLE "discount_rule_product" (
	"id" text PRIMARY KEY NOT NULL,
	"discount_rule_id" text NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_product_unique" UNIQUE("discount_rule_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"subscription_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"billing_period_start" date NOT NULL,
	"billing_period_end" date NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"invoice_status" "invoice_status" NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_total_minor" bigint NOT NULL,
	"tax_total_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"confirmed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoice_billing_period_unique" UNIQUE("subscription_id","billing_period_start","billing_period_end"),
	CONSTRAINT "invoice_subtotal_minor_range" CHECK (subtotal_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_discount_total_minor_range" CHECK (discount_total_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_tax_total_minor_range" CHECK (tax_total_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_total_minor_range" CHECK (total_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_structure_0" CHECK (billing_period_end >= billing_period_start),
	CONSTRAINT "invoice_structure_1" CHECK (due_date >= issue_date),
	CONSTRAINT "invoice_structure_2" CHECK (discount_total_minor <= subtotal_minor),
	CONSTRAINT "invoice_structure_3" CHECK (total_minor::numeric = subtotal_minor::numeric - discount_total_minor::numeric + tax_total_minor::numeric)
);
--> statement-breakpoint
CREATE TABLE "invoice_line" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"product_id" text,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"tax_rate_bps" integer NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	CONSTRAINT "invoice_line_invoice_unique" UNIQUE("id","invoice_id"),
	CONSTRAINT "invoice_line_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "invoice_line_unit_price_minor_range" CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_line_subtotal_minor_range" CHECK (subtotal_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_line_discount_minor_range" CHECK (discount_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_line_tax_rate_bps_range" CHECK (tax_rate_bps BETWEEN 0 AND 10000),
	CONSTRAINT "invoice_line_tax_minor_range" CHECK (tax_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_line_total_minor_range" CHECK (total_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "invoice_line_structure_0" CHECK (discount_minor <= subtotal_minor),
	CONSTRAINT "invoice_line_structure_1" CHECK (subtotal_minor::numeric = quantity::numeric * unit_price_minor::numeric),
	CONSTRAINT "invoice_line_structure_2" CHECK (total_minor::numeric = subtotal_minor::numeric - discount_minor::numeric + tax_minor::numeric)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"reference" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_amount_minor_range" CHECK (amount_minor BETWEEN 1 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"product_type" "product_type" NOT NULL,
	"sales_price_minor" bigint NOT NULL,
	"cost_price_minor" bigint NOT NULL,
	"currency_code" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sales_price_minor_range" CHECK (sales_price_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "product_cost_price_minor_range" CHECK (cost_price_minor BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "product_structure_0" CHECK (currency_code ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"attribute_name" text NOT NULL,
	"value_name" text NOT NULL,
	"price_delta_minor" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "variant_attribute_unique" UNIQUE("product_id","attribute_name","value_name"),
	CONSTRAINT "product_variant_price_delta_minor_range" CHECK (price_delta_minor BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"subscription_plan_id" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"start_date" date NOT NULL,
	"expiry_date" date,
	"next_billing_date" date,
	"payment_term_days" integer NOT NULL,
	"activated_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_number_unique" UNIQUE("subscription_number"),
	CONSTRAINT "subscription_customer_unique" UNIQUE("id","customer_id"),
	CONSTRAINT "subscription_structure_0" CHECK (expiry_date IS NULL OR expiry_date >= start_date),
	CONSTRAINT "subscription_structure_1" CHECK (payment_term_days >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscription_line" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_variant_id" text,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_line_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "subscription_line_unit_price_minor_range" CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "subscription_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"billing_frequency" "billing_frequency" NOT NULL,
	"minimum_quantity" integer NOT NULL,
	"available_from" date,
	"available_until" date,
	"auto_close_on_expiry" boolean DEFAULT true NOT NULL,
	"allow_early_close" boolean DEFAULT true NOT NULL,
	"allow_pause" boolean DEFAULT true NOT NULL,
	"allow_renewal" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plan_minimum_quantity_positive" CHECK (minimum_quantity > 0),
	CONSTRAINT "subscription_plan_structure_0" CHECK (available_until IS NULL OR available_from IS NULL OR available_until >= available_from)
);
--> statement-breakpoint
CREATE TABLE "tax_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rate_bps" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_rule_rate_bps_range" CHECK (rate_bps BETWEEN 0 AND 10000)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'CUSTOMER' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_application" ADD CONSTRAINT "discount_application_discount_rule_id_discount_rule_id_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "public"."discount_rule"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_application" ADD CONSTRAINT "discount_application_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_application" ADD CONSTRAINT "discount_application_invoice_line_id_invoice_id_invoice_line_id_invoice_id_fk" FOREIGN KEY ("invoice_line_id","invoice_id") REFERENCES "public"."invoice_line"("id","invoice_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_rule_product" ADD CONSTRAINT "discount_rule_product_discount_rule_id_discount_rule_id_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "public"."discount_rule"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_rule_product" ADD CONSTRAINT "discount_rule_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_subscription_id_customer_id_subscription_id_customer_id_fk" FOREIGN KEY ("subscription_id","customer_id") REFERENCES "public"."subscription"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_subscription_plan_id_subscription_plan_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_line" ADD CONSTRAINT "subscription_line_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_line" ADD CONSTRAINT "subscription_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_line" ADD CONSTRAINT "subscription_line_product_variant_id_product_id_product_variant_id_product_id_fk" FOREIGN KEY ("product_variant_id","product_id") REFERENCES "public"."product_variant"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_application_discount_rule_id_idx" ON "discount_application" USING btree ("discount_rule_id");--> statement-breakpoint
CREATE INDEX "discount_application_invoice_id_idx" ON "discount_application" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_invoice_status_idx" ON "invoice" USING btree ("invoice_status");--> statement-breakpoint
CREATE INDEX "invoice_due_date_idx" ON "invoice" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoice_customer_id_idx" ON "invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoice_line_invoice_id_idx" ON "invoice_line" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_invoice_id_idx" ON "payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_paid_at_idx" ON "payment" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "product_variant_product_id_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_next_billing_date_idx" ON "subscription" USING btree ("next_billing_date");--> statement-breakpoint
CREATE INDEX "subscription_customer_id_idx" ON "subscription" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscription_line_subscription_id_idx" ON "subscription_line" USING btree ("subscription_id");