CREATE TABLE "quotation_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subscription_plan_id" text NOT NULL,
	"validity_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_template_validity_days_positive" CHECK (validity_days > 0)
);
--> statement-breakpoint
CREATE TABLE "quotation_template_line" (
	"id" text PRIMARY KEY NOT NULL,
	"quotation_template_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_variant_id" text,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	CONSTRAINT "quotation_template_line_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "quotation_template_line_price_range" CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "quotation_valid_until" date;--> statement-breakpoint
ALTER TABLE "quotation_template" ADD CONSTRAINT "quotation_template_subscription_plan_id_subscription_plan_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_template_line" ADD CONSTRAINT "quotation_template_line_quotation_template_id_quotation_template_id_fk" FOREIGN KEY ("quotation_template_id") REFERENCES "public"."quotation_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_template_line" ADD CONSTRAINT "quotation_template_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_template_line" ADD CONSTRAINT "quotation_template_line_product_variant_id_product_id_product_variant_id_product_id_fk" FOREIGN KEY ("product_variant_id","product_id") REFERENCES "public"."product_variant"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotation_template_active_idx" ON "quotation_template" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "quotation_template_line_template_id_idx" ON "quotation_template_line" USING btree ("quotation_template_id");