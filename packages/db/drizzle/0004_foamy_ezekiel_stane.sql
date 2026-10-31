CREATE SEQUENCE "public"."invoice_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "billing_run" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tax_rule_id" text;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tax_rule_id_tax_rule_id_fk" FOREIGN KEY ("tax_rule_id") REFERENCES "public"."tax_rule"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_tax_rule_id_idx" ON "product" USING btree ("tax_rule_id");--> statement-breakpoint
ALTER TABLE "billing_run" ADD CONSTRAINT "billing_run_failure_count_nonnegative" CHECK (failure_count >= 0);