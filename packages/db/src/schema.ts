import { roleNames } from '@recurron/api/access'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  pgSequence,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', roleNames)
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  role: userRole('role').default('CUSTOMER').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    impersonatedBy: text('impersonated_by'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const productType = pgEnum('product_type', ['GOODS', 'SERVICE'])

export const billingFrequency = pgEnum('billing_frequency', [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
])

export const subscriptionStatus = pgEnum('subscription_status', [
  'DRAFT',
  'QUOTATION',
  'CONFIRMED',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
])

export const discountType = pgEnum('discount_type', ['FIXED', 'PERCENTAGE'])

export const discountScope = pgEnum('discount_scope', [
  'SUBSCRIPTION',
  'PRODUCT',
])

export const invoiceStatus = pgEnum('invoice_status', [
  'DRAFT',
  'CONFIRMED',
  'PAID',
  'CANCELLED',
])

export const paymentMethod = pgEnum('payment_method', [
  'BANK_TRANSFER',
  'UPI',
  'CARD',
  'CASH',
  'OTHER',
])

export const billingRunStatus = pgEnum('billing_run_status', [
  'RUNNING',
  'COMPLETED',
  'FAILED',
])

export const invoiceNumberSequence = pgSequence('invoice_number_seq', {
  startWith: 1,
})

const money = (name: string) => bigint(name, { mode: 'number' })
const instant = (name: string) => timestamp(name, { withTimezone: true })

export const taxRule = pgTable(
  'tax_rule',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    rateBps: integer('rate_bps').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [check('tax_rule_rate_bps_range', sql`rate_bps BETWEEN 0 AND 10000`)],
)

export const customer = pgTable(
  'customer',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    companyName: text('company_name'),
    billingAddress: text('billing_address'),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('customer_user_unique').on(t.userId),
    unique('customer_email_unique').on(t.email),
    check(
      'customer_structure_0',
      sql`email = lower(btrim(email)) AND length(email) > 0`,
    ),
  ],
)

export const product = pgTable(
  'product',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    taxRuleId: text('tax_rule_id').references(() => taxRule.id, {
      onDelete: 'restrict',
    }),
    productType: productType('product_type').notNull(),
    salesPriceMinor: money('sales_price_minor').notNull(),
    costPriceMinor: money('cost_price_minor').notNull(),
    currencyCode: text('currency_code').notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check(
      'product_sales_price_minor_range',
      sql`sales_price_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'product_cost_price_minor_range',
      sql`cost_price_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check('product_structure_0', sql`currency_code ~ '^[A-Z]{3}$'`),
    index('product_tax_rule_id_idx').on(t.taxRuleId),
  ],
)

export const productVariant = pgTable(
  'product_variant',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .references(() => product.id, { onDelete: 'restrict' })
      .notNull(),
    attributeName: text('attribute_name').notNull(),
    valueName: text('value_name').notNull(),
    priceDeltaMinor: money('price_delta_minor').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('variant_product_unique').on(t.id, t.productId),
    unique('variant_attribute_unique').on(
      t.productId,
      t.attributeName,
      t.valueName,
    ),
    check(
      'product_variant_price_delta_minor_range',
      sql`price_delta_minor BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
    index('product_variant_product_id_idx').on(t.productId),
  ],
)

export const subscriptionPlan = pgTable(
  'subscription_plan',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    billingFrequency: billingFrequency('billing_frequency').notNull(),
    minimumQuantity: integer('minimum_quantity').notNull(),
    availableFrom: date('available_from'),
    availableUntil: date('available_until'),
    autoCloseOnExpiry: boolean('auto_close_on_expiry').default(true).notNull(),
    allowEarlyClose: boolean('allow_early_close').default(true).notNull(),
    allowPause: boolean('allow_pause').default(true).notNull(),
    allowRenewal: boolean('allow_renewal').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [
    check(
      'subscription_plan_minimum_quantity_positive',
      sql`minimum_quantity > 0`,
    ),
    check(
      'subscription_plan_structure_0',
      sql`available_until IS NULL OR available_from IS NULL OR available_until >= available_from`,
    ),
  ],
)

export const subscription = pgTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    subscriptionNumber: text('subscription_number').notNull(),
    customerId: text('customer_id')
      .references(() => customer.id, { onDelete: 'restrict' })
      .notNull(),
    subscriptionPlanId: text('subscription_plan_id')
      .references(() => subscriptionPlan.id, { onDelete: 'restrict' })
      .notNull(),
    status: subscriptionStatus('status').notNull(),
    startDate: date('start_date').notNull(),
    expiryDate: date('expiry_date'),
    quotationValidUntil: date('quotation_valid_until'),
    nextBillingDate: date('next_billing_date'),
    paymentTermDays: integer('payment_term_days').notNull(),
    activatedAt: instant('activated_at'),
    closedAt: instant('closed_at'),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('subscription_number_unique').on(t.subscriptionNumber),
    unique('subscription_customer_unique').on(t.id, t.customerId),
    check(
      'subscription_structure_0',
      sql`expiry_date IS NULL OR expiry_date >= start_date`,
    ),
    check('subscription_structure_1', sql`payment_term_days >= 0`),
    index('subscription_status_idx').on(t.status),
    index('subscription_next_billing_date_idx').on(t.nextBillingDate),
    index('subscription_customer_id_idx').on(t.customerId),
  ],
)

export const quotationTemplate = pgTable(
  'quotation_template',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    subscriptionPlanId: text('subscription_plan_id')
      .references(() => subscriptionPlan.id, { onDelete: 'restrict' })
      .notNull(),
    validityDays: integer('validity_days').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check('quotation_template_validity_days_positive', sql`validity_days > 0`),
    index('quotation_template_active_idx').on(t.isActive),
  ],
)

export const quotationTemplateLine = pgTable(
  'quotation_template_line',
  {
    id: text('id').primaryKey(),
    quotationTemplateId: text('quotation_template_id')
      .references(() => quotationTemplate.id, { onDelete: 'cascade' })
      .notNull(),
    productId: text('product_id')
      .references(() => product.id, { onDelete: 'restrict' })
      .notNull(),
    productVariantId: text('product_variant_id'),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: money('unit_price_minor').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.productVariantId, t.productId],
      foreignColumns: [productVariant.id, productVariant.productId],
    }).onDelete('restrict'),
    check('quotation_template_line_quantity_positive', sql`quantity > 0`),
    check(
      'quotation_template_line_price_range',
      sql`unit_price_minor BETWEEN 0 AND 9007199254740991`,
    ),
    index('quotation_template_line_template_id_idx').on(t.quotationTemplateId),
  ],
)

export const subscriptionLine = pgTable(
  'subscription_line',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .references(() => subscription.id, { onDelete: 'restrict' })
      .notNull(),
    productId: text('product_id')
      .references(() => product.id, { onDelete: 'restrict' })
      .notNull(),
    productVariantId: text('product_variant_id'),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: money('unit_price_minor').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.productVariantId, t.productId],
      foreignColumns: [productVariant.id, productVariant.productId],
    }).onDelete('restrict'),
    check('subscription_line_quantity_positive', sql`quantity > 0`),
    check(
      'subscription_line_unit_price_minor_range',
      sql`unit_price_minor BETWEEN 0 AND 9007199254740991`,
    ),
    index('subscription_line_subscription_id_idx').on(t.subscriptionId),
  ],
)

export const discountRule = pgTable(
  'discount_rule',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    discountType: discountType('discount_type').notNull(),
    fixedAmountMinor: money('fixed_amount_minor'),
    percentageBps: integer('percentage_bps'),
    minimumPurchaseMinor: money('minimum_purchase_minor'),
    minimumQuantity: integer('minimum_quantity'),
    startsAt: instant('starts_at'),
    endsAt: instant('ends_at'),
    usageLimit: integer('usage_limit'),
    discountScope: discountScope('discount_scope').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [
    check(
      'discount_rule_fixed_amount_minor_range',
      sql`fixed_amount_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'discount_rule_percentage_bps_range',
      sql`percentage_bps BETWEEN 0 AND 10000`,
    ),
    check(
      'discount_rule_minimum_purchase_minor_range',
      sql`minimum_purchase_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check('discount_rule_minimum_quantity_positive', sql`minimum_quantity > 0`),
    check('discount_rule_usage_limit_positive', sql`usage_limit > 0`),
    check(
      'discount_rule_structure_0',
      sql`(discount_type = 'FIXED' AND fixed_amount_minor IS NOT NULL AND percentage_bps IS NULL) OR (discount_type = 'PERCENTAGE' AND percentage_bps IS NOT NULL AND fixed_amount_minor IS NULL)`,
    ),
    check(
      'discount_rule_structure_1',
      sql`ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at`,
    ),
  ],
)

export const discountRuleProduct = pgTable(
  'discount_rule_product',
  {
    id: text('id').primaryKey(),
    discountRuleId: text('discount_rule_id')
      .references(() => discountRule.id, { onDelete: 'restrict' })
      .notNull(),
    productId: text('product_id')
      .references(() => product.id, { onDelete: 'restrict' })
      .notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (t) => [unique('discount_product_unique').on(t.discountRuleId, t.productId)],
)

export const invoice = pgTable(
  'invoice',
  {
    id: text('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull(),
    subscriptionId: text('subscription_id')
      .references(() => subscription.id, { onDelete: 'restrict' })
      .notNull(),
    customerId: text('customer_id').notNull(),
    billingPeriodStart: date('billing_period_start').notNull(),
    billingPeriodEnd: date('billing_period_end').notNull(),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date').notNull(),
    invoiceStatus: invoiceStatus('invoice_status').notNull(),
    subtotalMinor: money('subtotal_minor').notNull(),
    discountTotalMinor: money('discount_total_minor').notNull(),
    taxTotalMinor: money('tax_total_minor').notNull(),
    totalMinor: money('total_minor').notNull(),
    confirmedAt: instant('confirmed_at'),
    paidAt: instant('paid_at'),
    cancelledAt: instant('cancelled_at'),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('invoice_number_unique').on(t.invoiceNumber),
    unique('invoice_billing_period_unique').on(
      t.subscriptionId,
      t.billingPeriodStart,
      t.billingPeriodEnd,
    ),
    foreignKey({
      columns: [t.subscriptionId, t.customerId],
      foreignColumns: [subscription.id, subscription.customerId],
    }).onDelete('restrict'),
    check(
      'invoice_subtotal_minor_range',
      sql`subtotal_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_discount_total_minor_range',
      sql`discount_total_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_tax_total_minor_range',
      sql`tax_total_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_total_minor_range',
      sql`total_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_structure_0',
      sql`billing_period_end >= billing_period_start`,
    ),
    check('invoice_structure_1', sql`due_date >= issue_date`),
    check('invoice_structure_2', sql`discount_total_minor <= subtotal_minor`),
    check(
      'invoice_structure_3',
      sql`total_minor::numeric = subtotal_minor::numeric - discount_total_minor::numeric + tax_total_minor::numeric`,
    ),
    index('invoice_invoice_status_idx').on(t.invoiceStatus),
    index('invoice_due_date_idx').on(t.dueDate),
    index('invoice_customer_id_idx').on(t.customerId),
  ],
)

export const invoiceLine = pgTable(
  'invoice_line',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .references(() => invoice.id, { onDelete: 'restrict' })
      .notNull(),
    productId: text('product_id').references(() => product.id, {
      onDelete: 'restrict',
    }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: money('unit_price_minor').notNull(),
    subtotalMinor: money('subtotal_minor').notNull(),
    discountMinor: money('discount_minor').notNull(),
    taxRateBps: integer('tax_rate_bps').notNull(),
    taxMinor: money('tax_minor').notNull(),
    totalMinor: money('total_minor').notNull(),
  },
  (t) => [
    unique('invoice_line_invoice_unique').on(t.id, t.invoiceId),
    check('invoice_line_quantity_positive', sql`quantity > 0`),
    check(
      'invoice_line_unit_price_minor_range',
      sql`unit_price_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_line_subtotal_minor_range',
      sql`subtotal_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_line_discount_minor_range',
      sql`discount_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_line_tax_rate_bps_range',
      sql`tax_rate_bps BETWEEN 0 AND 10000`,
    ),
    check(
      'invoice_line_tax_minor_range',
      sql`tax_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'invoice_line_total_minor_range',
      sql`total_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check('invoice_line_structure_0', sql`discount_minor <= subtotal_minor`),
    check(
      'invoice_line_structure_1',
      sql`subtotal_minor::numeric = quantity::numeric * unit_price_minor::numeric`,
    ),
    check(
      'invoice_line_structure_2',
      sql`total_minor::numeric = subtotal_minor::numeric - discount_minor::numeric + tax_minor::numeric`,
    ),
    index('invoice_line_invoice_id_idx').on(t.invoiceId),
  ],
)

export const discountApplication = pgTable(
  'discount_application',
  {
    id: text('id').primaryKey(),
    discountRuleId: text('discount_rule_id')
      .references(() => discountRule.id, { onDelete: 'restrict' })
      .notNull(),
    invoiceId: text('invoice_id')
      .references(() => invoice.id, { onDelete: 'restrict' })
      .notNull(),
    invoiceLineId: text('invoice_line_id'),
    appliedAmountMinor: money('applied_amount_minor').notNull(),
    appliedAt: instant('applied_at').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.invoiceLineId, t.invoiceId],
      foreignColumns: [invoiceLine.id, invoiceLine.invoiceId],
    }).onDelete('restrict'),
    check(
      'discount_application_applied_amount_minor_range',
      sql`applied_amount_minor BETWEEN 0 AND 9007199254740991`,
    ),
    index('discount_application_discount_rule_id_idx').on(t.discountRuleId),
    index('discount_application_invoice_id_idx').on(t.invoiceId),
  ],
)

export const payment = pgTable(
  'payment',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .references(() => invoice.id, { onDelete: 'restrict' })
      .notNull(),
    paymentMethod: paymentMethod('payment_method').notNull(),
    amountMinor: money('amount_minor').notNull(),
    paidAt: instant('paid_at').notNull(),
    reference: text('reference'),
    note: text('note'),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (t) => [
    check(
      'payment_amount_minor_range',
      sql`amount_minor BETWEEN 1 AND 9007199254740991`,
    ),
    index('payment_invoice_id_idx').on(t.invoiceId),
    index('payment_paid_at_idx').on(t.paidAt),
  ],
)

export const billingRun = pgTable(
  'billing_run',
  {
    id: text('id').primaryKey(),
    billingDate: date('billing_date').notNull(),
    billingRunStatus: billingRunStatus('billing_run_status').notNull(),
    subscriptionsScanned: integer('subscriptions_scanned').notNull(),
    invoicesCreated: integer('invoices_created').notNull(),
    failureCount: integer('failure_count').notNull().default(0),
    subscriptionsSkipped: integer('subscriptions_skipped').notNull(),
    totalAmountMinor: money('total_amount_minor').notNull(),
    startedAt: instant('started_at').notNull(),
    completedAt: instant('completed_at'),
  },
  () => [
    check(
      'billing_run_subscriptions_scanned_nonnegative',
      sql`subscriptions_scanned >= 0`,
    ),
    check(
      'billing_run_invoices_created_nonnegative',
      sql`invoices_created >= 0`,
    ),
    check('billing_run_failure_count_nonnegative', sql`failure_count >= 0`),
    check(
      'billing_run_subscriptions_skipped_nonnegative',
      sql`subscriptions_skipped >= 0`,
    ),
    check(
      'billing_run_total_amount_minor_range',
      sql`total_amount_minor BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      'billing_run_structure_0',
      sql`completed_at IS NULL OR completed_at >= started_at`,
    ),
  ],
)
