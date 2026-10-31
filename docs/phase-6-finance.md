# Phase 6 billing and payments

Ordinary reads retain Neon HTTP. Financial mutations use Drizzle's Neon serverless WebSocket adapter with a pool created and closed within the request. Each due subscription has its own interactive transaction. PostgreSQL is authoritative; there is no queue or second database.

An active subscription with a non-null next billing date at or before the requested date is due. Paused and closed subscriptions are excluded. Missing lines and inactive product tax rules cannot generate an invoice. Periods begin on the current next billing date and end on the day before the pure billing-date helper's next cycle date, inclusive. The same next-cycle result advances the subscription only after invoice, lines, and discount applications have been inserted in the transaction.

One run processes one current period per due subscription. Repeating a run can catch up additional overdue periods, but never creates the same period twice. A subscription row lock rechecks eligibility; the unique subscription/period constraint is the final boundary. A uniqueness conflict is a skip. Cancelled invoices still reserve their period. Subscription dates never advance if invoice creation rolls back.

A period beginning after expiry is not billed. Auto-close plans close when processing encounters a due period after expiry, or when billing at/after expiry reaches the final natural period. A period starting on or before expiry is billed in full; there is no proration. Preview is read-only, including expiry handling.

Invoices begin as drafts. Confirmation makes them collectible. Drafts may be cancelled; confirmed invoices may be cancelled only when no payments exist. Paid and cancelled invoices cannot be cancelled again or accept payments. Cancellation does not undo the subscription's billed period or discount usage.

Products optionally reference an active tax rule. No rule means zero tax. Inactive referenced rules block generation rather than silently removing tax. Rates use basis points, and invoice lines snapshot rates and amounts. Tax is rounded per line after discounts using shared exact money helpers.

Discounts must be active and valid on the requested billing date. Minimum purchase and quantity apply to eligible product subtotals/quantities for product rules and the remaining subscription subtotal/total quantity for subscription rules. The largest eligible product discount applies once per line; then the largest eligible subscription discount applies once to the remaining subtotal. Equal discounts use the rule ID as a deterministic tie-breaker. Fixed amounts are capped at the applicable base. Subscription discounts are allocated proportionally using integer arithmetic. Product usage limits count each actual discounted line; subscription usage limits count each actual invoice application. Rule rows are locked before usage is counted and recorded, preventing concurrent overuse. No mutable usage counter is authoritative. Validity date boundaries are inclusive UTC dates.

Manual payments lock the invoice, recompute paid amounts, reject non-positive payments and overpayments, and insert atomically. Full settlement sets status PAID and paid_at in the same transaction. Outstanding is total minus the sum of payments. Overdue is derived only for confirmed invoices with due_date before today and a positive balance. No overdue enum or redundant balance is stored.

Billing-run counts, totals, timestamps, and final status are persisted. A failed subscription rolls back independently; structured failure logs include run ID and subscription ID without SQL, credentials, or raw driver errors. Other subscriptions continue. Invoice numbers come from a PostgreSQL sequence; rollback can leave harmless gaps.

Admin and Staff use the official shadcn Sidebar with icon collapse and mobile sheet behavior. Operational billing, invoice and payment screens are shared. Taxes and discounts are Admin-only, enforced by server permissions. Customer accounts remain restricted to the portal. Payment recording uses the official shadcn Dialog. Invoices print through the browser with a print stylesheet; no server PDF pipeline is used. Payments and invoices use database pagination; finance overview totals use SQL aggregates.

Migration 0004 adds the invoice sequence, optional product tax reference/index, and billing failure count. It was applied to the configured Neon database. Existing migration history is preserved.

Manual verification on the local Vite/Worker apps used real Neon-backed Brightloop Admin, Staff and Customer accounts. INV-000001 contains five units at ₹1,560, ₹7,800 subtotal, ₹780 product discount, ₹1,263.60 tax, and ₹8,283.60 total. A repeated billing run produced no duplicate. Confirmation, ₹4,000 partial payment and ₹4,283.60 final payment resulted in PAID and zero outstanding. Browser print output was generated, and mobile invoice width was inspected. Staff operational access and configuration denial, Customer internal-route/API denial, and rejection of further payment on the paid invoice were verified. Credentials remain outside the repository.

Invoice email sending remains unimplemented. The UI does not claim that an email was sent. No automated tests were added or run for this phase.

The final manual pass verified corrected invoice-list balances: INV-000001 paid ₹8,283.60 with zero outstanding, and overdue INV-000002 paid ₹1,000 with ₹8,204 outstanding. The payment directory contains all three payments. Finance aggregates report two active subscriptions, ₹9,283.60 collected this month, ₹8,204 outstanding, and one overdue invoice.

An inactive-tax billing attempt generated zero invoices and left next_billing_date unchanged. After restoring the tax rule, two simultaneous billing requests produced exactly one invoice and one safe skip. The resulting INV-000003 was cancelled and its subscription paused for a useful cancelled-state demo. Cancelled-payment attempts were rejected. Final read-only Neon inspection found three invoices, no due active subscriptions, no inactive tax rules, and no unfinished RUNNING billing runs. Mobile sidebar navigation closed the sheet and changed route content.

Static verification passed: pnpm check, pnpm typecheck, production Vite build with the local API origin, and Worker dry-run build. The dry run was rerun outside the filesystem sandbox to permit Wrangler's external log file. No deployment occurred.
