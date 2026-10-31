# Phase 2 relational schema

PostgreSQL is the integrity boundary. This phase adds storage and pure money helpers only.

## Representation

All identifiers are text, supplied by the caller, matching Better Auth. Business instants use timestamptz; business calendar values use date, returned by Drizzle as strings. Existing auth timestamp conventions are preserved. updated_at defaults at insert and Drizzle updates it on ORM updates; raw SQL writers must set it themselves.

All money columns use PostgreSQL bigint with Drizzle number mode and CHECK bounds of 0 through 9007199254740991 minor units. Payments start at 1. price_delta_minor is signed, bounded by ±9007199254740991, and is added to a product's base price. At two decimals the maximum is 90071992547409.91. The database bigint storage range is larger, but the constraints deliberately restrict values to JSON-safe JavaScript integers. SQL arithmetic checks cast to numeric to avoid intermediate overflow.

The pure @recurron/api/money export accepts decimal strings with up to two fractional digits, rejects excess precision and scientific notation, and returns safe integer minor units. Internal arithmetic uses bigint, including overflow checks. Formatting is exact decimal formatting without currency symbols or locale grouping. Percentages are integer basis points in [0,10000], rounded nearest with exact ties away from zero. Quantities are positive whole units in storage; multiplication helpers also allow zero. Signed helpers support variant adjustments without relaxing nonnegative persisted price constraints.

## Relationships and normalization

A customer can exist without a user. user_id is optional and unique, allowing at most one customer per login. Deleting a login sets customer.user_id to NULL. Customer email is required, trimmed, lowercase, nonempty and unique across business customers. This is a separate business identity decision; it does not change Better Auth email semantics or infer a user link by email.

Products, variants, plans, tax rules, and discount rules are mutable master records. Product variants are unique per product/attribute/value. Composite foreign keys ensure a subscription line's variant belongs to its product, an invoice customer matches its subscription customer, and a discount application line belongs to its invoice. The invoice customer is deliberately retained as document ownership, with this consistency key rather than an unconstrained redundant field.

All new foreign keys except the optional customer login use ON DELETE RESTRICT and ON UPDATE NO ACTION. IDs are stable. Deactivate referenced masters instead of deleting them. Financial records do not cascade away. Existing Better Auth session/account cascading behavior is unchanged.

Subscription lines snapshot negotiated unit prices and descriptions. Invoice lines snapshot description, quantity, unit price, discount, tax basis points, tax and total independently of masters. No mutable tax/discount lookup is required to read an invoice. Document totals are intentionally persisted financial facts; row arithmetic is checked. Future transaction code must validate header totals against lines, tax rounding, and aggregate discounts/payments. No balance, customer counts or usage_count fields are stored. billing_run counters are operational observations of a run, not business balances.

Invoice lines have no update timestamps because they are intended as immutable commercial facts. SQL permissions or later service rules must enforce document immutability after confirmation; this schema does not claim to prevent privileged direct UPDATE operations.

Discount applications reference a rule and invoice, with optional invoice_line_id: NULL represents subscription scope, a line represents product scope. Scope matching, applicability, currency compatibility and usage limits require multirow transactional enforcement later. discount_rule_product is a unique rule/product relationship.

## Constraints and indexes

Primary keys and required columns are explicit in the catalogue below. Native enums constrain roles, product types, frequencies, statuses, discount types/scopes and payment methods. Public signup has a database CUSTOMER default and Better Auth role input disabled.

Money ranges, basis-point ranges, positive quantities/usage limits, nonnegative payment terms and audit counters, availability/expiry/period/due-date ordering, discount discriminated fields, line subtotal arithmetic and header/line total arithmetic are CHECK constraints. They contain no cross-table queries.

UNIQUE keys cover customer email/login, human subscription/invoice numbers, variant attribute identity, rule/product applicability, and invoice(subscription_id,billing_period_start,billing_period_end). The last key prevents duplicate committed invoices for exactly the same period, including concurrent attempts. It does not prevent overlapping nonidentical periods. Additional composite UNIQUE keys support ownership foreign keys.

Indexes cover subscription status, next_billing_date and customer; invoice status, due_date and customer; payment invoice and paid_at; subscription_line subscription; invoice_line invoice; variant product; discount_application rule and invoice. The invoice period UNIQUE index has subscription_id as its leading column and serves subscription invoice lookups. No duplicate single-column index is added for that path.

## Future transaction boundary and unresolved policies

Future billing must lock an eligible subscription row using SELECT FOR UPDATE, recheck eligibility, write invoice/lines/discount applications, advance next_billing_date and commit in one transaction. PostgreSQL READ COMMITTED plus row locks and uniqueness is sufficient as the starting model; no global SERIALIZABLE setting is introduced. Retry a whole transaction after relevant conflicts, and treat an existing period invoice as an idempotency result only after verifying its meaning.

Neon HTTP currently used by createDatabase and Better Auth does not support interactive transactions. The future billing service must use a transaction-capable Neon WebSocket/PostgreSQL connection for reads interleaved with writes. Do not execute those steps as independent HTTP statements. Static statement batches can use Neon HTTP transaction support. This phase does not implement that service or change the auth adapter.

Resolve before workflows: currency policy and immutable document currency snapshots, tax-inclusive versus exclusive pricing, tax selection/stacking, discount ordering and allocation, whether cancelled invoices consume the period key, period endpoint semantics, billing timezone/month-end anchoring, fractional quantities, invoice/customer address snapshots, partial-payment status and overpayment policy. Current helpers support two-decimal currencies only; the product currency shape check is not an ISO currency registry or conversion facility. No mixed-currency billing is supported or implied. product_type currently means GOODS or SERVICE, a provisional catalogue classification.

Plan permissions currently default true; callers should explicitly choose plan policy. Subscription and invoice lifecycle transitions are deliberately unenforced beyond structural row checks. Human-readable number allocation must later be concurrency safe. Usage limits must serialize on the discount rule row and count actual applications under the same transaction, with a defined cancellation policy.

## Migration and verification

0000_auth.sql is unchanged. The additive 0001_pale_punisher.sql was generated using pnpm db:generate and reviewed before pnpm db:migrate against the development Neon database.

Run pnpm --filter @recurron/db test:money for pure arithmetic tests. Run DATABASE_URL from private environment with pnpm --filter @recurron/db test:integrity for real PostgreSQL constraints. That test uses a single DO statement with a nested exception block to roll back every fixture on success; any unexpected error rolls back the complete statement. No public endpoints or permanent test records are created. It checks period uniqueness and independence across subscriptions, quantity/payment/rate rejection, positive partial payments, foreign keys, enums and historical price independence.

## Final column catalogue

The generated migration is the authoritative full constraint/index definition. All physical identifiers are lowercase snake_case. A question mark indicates nullable.

| Table | Columns and PostgreSQL types |
| --- | --- |
| billing_run | id: text; billing_date: date; billing_run_status: "billing_run_status"; subscriptions_scanned: integer; invoices_created: integer; subscriptions_skipped: integer; total_amount_minor: bigint; started_at: timestamp with time zone; completed_at: timestamp with time zone ? |
| customer | id: text; user_id: text ?; name: text; email: text; phone: text ?; company_name: text ?; billing_address: text ?; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| discount_application | id: text; discount_rule_id: text; invoice_id: text; invoice_line_id: text ?; applied_amount_minor: bigint; applied_at: timestamp with time zone |
| discount_rule | id: text; name: text; discount_type: "discount_type"; fixed_amount_minor: bigint ?; percentage_bps: integer ?; minimum_purchase_minor: bigint ?; minimum_quantity: integer ?; starts_at: timestamp with time zone ?; ends_at: timestamp with time zone ?; usage_limit: integer ?; discount_scope: "discount_scope"; is_active: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| discount_rule_product | id: text; discount_rule_id: text; product_id: text; created_at: timestamp with time zone |
| invoice | id: text; invoice_number: text; subscription_id: text; customer_id: text; billing_period_start: date; billing_period_end: date; issue_date: date; due_date: date; invoice_status: "invoice_status"; subtotal_minor: bigint; discount_total_minor: bigint; tax_total_minor: bigint; total_minor: bigint; confirmed_at: timestamp with time zone ?; paid_at: timestamp with time zone ?; cancelled_at: timestamp with time zone ?; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| invoice_line | id: text; invoice_id: text; product_id: text ?; description: text; quantity: integer; unit_price_minor: bigint; subtotal_minor: bigint; discount_minor: bigint; tax_rate_bps: integer; tax_minor: bigint; total_minor: bigint |
| payment | id: text; invoice_id: text; payment_method: "payment_method"; amount_minor: bigint; paid_at: timestamp with time zone; reference: text ?; note: text ?; created_at: timestamp with time zone |
| product | id: text; name: text; product_type: "product_type"; sales_price_minor: bigint; cost_price_minor: bigint; currency_code: text; notes: text ?; is_active: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| product_variant | id: text; product_id: text; attribute_name: text; value_name: text; price_delta_minor: bigint; is_active: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| subscription | id: text; subscription_number: text; customer_id: text; subscription_plan_id: text; status: "subscription_status"; start_date: date; expiry_date: date ?; next_billing_date: date ?; payment_term_days: integer; activated_at: timestamp with time zone ?; closed_at: timestamp with time zone ?; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| subscription_line | id: text; subscription_id: text; product_id: text; product_variant_id: text ?; description: text; quantity: integer; unit_price_minor: bigint; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| subscription_plan | id: text; name: text; billing_frequency: "billing_frequency"; minimum_quantity: integer; available_from: date ?; available_until: date ?; auto_close_on_expiry: boolean; allow_early_close: boolean; allow_pause: boolean; allow_renewal: boolean; is_active: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| tax_rule | id: text; name: text; rate_bps: integer; is_active: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| user, existing auth table | Added role: user_role NOT NULL DEFAULT CUSTOMER; existing columns unchanged |

Existing account, session and verification tables are unchanged.
