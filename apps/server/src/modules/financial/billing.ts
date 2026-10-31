import { ORPCError } from '@orpc/server'
import { addMinor } from '@recurron/api/money'
import { advanceBillingDate } from '@recurron/api/billing-date'
import { createDatabase } from '@recurron/db'
import { createTransactionDatabase } from '@recurron/db/transaction'
import {
  billingRun,
  customer,
  discountApplication,
  discountRule,
  discountRuleProduct,
  invoice,
  invoiceLine,
  product,
  subscription,
  subscriptionLine,
  subscriptionPlan,
  taxRule,
} from '@recurron/db/schema'
import { and, asc, count, eq, inArray, lte, sql } from 'drizzle-orm'
import { databaseOperation } from '../errors'
import { calculateBilling } from './billing-policy'
import type { BillingDiscountRule, BillingSourceLine } from './billing-policy'

interface BillingCandidate {
  autoCloseOnExpiry: boolean
  billingFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  customerId: string
  customerName: string
  expiryDate: string | null
  id: string
  lines: BillingSourceLine[]
  nextBillingDate: string | null
  paymentTermDays: number
  planName: string
  subscriptionNumber: string
}

interface PreviewRow {
  billingPeriodEnd: string
  billingPeriodStart: string
  customerName: string
  discountMinor: number
  planName: string
  subscriptionId: string
  subscriptionNumber: string
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  warnings: string[]
}

const taxRateFor = (
  taxRuleId: string | null,
  tax: { isActive: boolean; rateBps: number } | null,
) => {
  if (taxRuleId === null) {
    return 0
  }
  if (tax?.isActive === true) {
    return tax.rateBps
  }
  return null
}

const dueFilter = (billingDate: string) =>
  and(
    eq(subscription.status, 'ACTIVE'),
    lte(subscription.nextBillingDate, billingDate),
  )

const loadDueCandidates = async (databaseUrl: string, billingDate: string) => {
  const rows = await createDatabase(databaseUrl)
    .select({
      customerName: customer.name,
      line: subscriptionLine,
      plan: subscriptionPlan,
      productTaxRuleId: product.taxRuleId,
      sub: subscription,
      tax: taxRule,
    })
    .from(subscription)
    .innerJoin(customer, eq(customer.id, subscription.customerId))
    .innerJoin(
      subscriptionPlan,
      eq(subscriptionPlan.id, subscription.subscriptionPlanId),
    )
    .leftJoin(
      subscriptionLine,
      eq(subscriptionLine.subscriptionId, subscription.id),
    )
    .leftJoin(product, eq(product.id, subscriptionLine.productId))
    .leftJoin(taxRule, eq(taxRule.id, product.taxRuleId))
    .where(dueFilter(billingDate))
    .orderBy(
      asc(subscription.nextBillingDate),
      subscription.id,
      subscriptionLine.id,
    )

  const candidates = new Map<string, BillingCandidate>()
  for (const row of rows) {
    let candidate = candidates.get(row.sub.id)
    if (!candidate) {
      candidate = {
        autoCloseOnExpiry: row.plan.autoCloseOnExpiry,
        billingFrequency: row.plan.billingFrequency,
        customerId: row.sub.customerId,
        customerName: row.customerName,
        expiryDate: row.sub.expiryDate,
        id: row.sub.id,
        lines: [],
        nextBillingDate: row.sub.nextBillingDate,
        paymentTermDays: row.sub.paymentTermDays,
        planName: row.plan.name,
        subscriptionNumber: row.sub.subscriptionNumber,
      }
      candidates.set(row.sub.id, candidate)
    }
    if (row.line && row.productTaxRuleId !== undefined) {
      candidate.lines.push({
        description: row.line.description,
        productId: row.line.productId,
        quantity: row.line.quantity,
        taxRateBps: taxRateFor(row.productTaxRuleId, row.tax),
        unitPriceMinor: row.line.unitPriceMinor,
      })
    }
  }
  return [...candidates.values()]
}

const loadDiscountRules = async (databaseUrl: string) => {
  const db = createDatabase(databaseUrl)
  const rules = await db
    .select()
    .from(discountRule)
    .where(eq(discountRule.isActive, true))
  if (rules.length === 0) {
    return {
      rules: [] as BillingDiscountRule[],
      usageCounts: new Map<string, number>(),
    }
  }
  const ruleIds = rules.map((rule) => rule.id)
  const [applications, products] = await Promise.all([
    db
      .select({
        ruleId: discountApplication.discountRuleId,
        used: count(),
      })
      .from(discountApplication)
      .where(inArray(discountApplication.discountRuleId, ruleIds))
      .groupBy(discountApplication.discountRuleId),
    db
      .select({
        productId: discountRuleProduct.productId,
        ruleId: discountRuleProduct.discountRuleId,
      })
      .from(discountRuleProduct)
      .where(inArray(discountRuleProduct.discountRuleId, ruleIds)),
  ])
  const productIds = new Map<string, string[]>()
  for (const link of products) {
    const ids = productIds.get(link.ruleId) ?? []
    ids.push(link.productId)
    productIds.set(link.ruleId, ids)
  }
  const usageCounts = new Map(applications.map((row) => [row.ruleId, row.used]))
  return {
    rules: rules.map((rule) => ({
      discountScope: rule.discountScope,
      discountType: rule.discountType,
      endsAt: rule.endsAt,
      fixedAmountMinor: rule.fixedAmountMinor,
      id: rule.id,
      minimumPurchaseMinor: rule.minimumPurchaseMinor,
      minimumQuantity: rule.minimumQuantity,
      percentageBps: rule.percentageBps,
      productIds: productIds.get(rule.id) ?? [],
      startsAt: rule.startsAt,
      usageLimit: rule.usageLimit,
    })),
    usageCounts,
  }
}

const previousDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10)

const dateAfterDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10)

const candidatePreview = (
  candidate: BillingCandidate,
  rules: BillingDiscountRule[],
  usageCounts: Map<string, number>,
  billingDate: string,
): PreviewRow => {
  const start = candidate.nextBillingDate ?? billingDate
  const next = advanceBillingDate(start, candidate.billingFrequency)
  const warnings: string[] = []
  if (candidate.expiryDate !== null && start > candidate.expiryDate) {
    warnings.push('Billing period starts after the subscription expiry date.')
  }
  if (candidate.lines.length === 0) {
    warnings.push('Subscription has no billable lines.')
  }
  if (candidate.lines.some((line) => line.taxRateBps === null)) {
    warnings.push('A product tax rule is inactive or missing.')
  }
  if (warnings.length > 0) {
    return {
      billingPeriodEnd: previousDay(next),
      billingPeriodStart: start,
      customerName: candidate.customerName,
      discountMinor: 0,
      planName: candidate.planName,
      subscriptionId: candidate.id,
      subscriptionNumber: candidate.subscriptionNumber,
      subtotalMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
      warnings,
    }
  }
  const usageCopy = new Map(usageCounts)
  const calculation = calculateBilling(
    candidate.lines,
    rules,
    usageCopy,
    billingDate,
  )
  usageCounts.clear()
  for (const [id, used] of usageCopy) {
    usageCounts.set(id, used)
  }
  return {
    billingPeriodEnd: previousDay(next),
    billingPeriodStart: start,
    customerName: candidate.customerName,
    discountMinor: calculation.discountMinor,
    planName: candidate.planName,
    subscriptionId: candidate.id,
    subscriptionNumber: candidate.subscriptionNumber,
    subtotalMinor: calculation.subtotalMinor,
    taxMinor: calculation.taxMinor,
    totalMinor: calculation.totalMinor,
    warnings: calculation.warnings,
  }
}

export const preview = async (
  databaseUrl: string,
  input: { billingDate: string; page: number; pageSize: number },
) =>
  await databaseOperation(async () => {
    const candidates = await loadDueCandidates(databaseUrl, input.billingDate)
    const { rules, usageCounts } = await loadDiscountRules(databaseUrl)
    const rows = candidates.map((candidate) =>
      candidatePreview(candidate, rules, usageCounts, input.billingDate),
    )
    let candidateInvoiceCount = 0
    let subtotalMinor = 0
    let discountMinor = 0
    let taxMinor = 0
    let totalMinor = 0
    for (const row of rows) {
      if (row.warnings.length > 0) {
        continue
      }
      candidateInvoiceCount += 1
      subtotalMinor = addMinor(subtotalMinor, row.subtotalMinor)
      discountMinor = addMinor(discountMinor, row.discountMinor)
      taxMinor = addMinor(taxMinor, row.taxMinor)
      totalMinor = addMinor(totalMinor, row.totalMinor)
    }
    const offset = (input.page - 1) * input.pageSize
    return {
      billingDate: input.billingDate,
      candidateInvoiceCount,
      discountMinor,
      items: rows.slice(offset, offset + input.pageSize),
      page: input.page,
      pageSize: input.pageSize,
      subscriptionsDue: candidates.length,
      subtotalMinor,
      taxMinor,
      totalMinor,
    }
  })

const loadRulesForTransaction = async (
  tx: Parameters<
    Parameters<
      ReturnType<typeof createTransactionDatabase>['db']['transaction']
    >[0]
  >[0],
) => {
  const rules = await tx
    .select()
    .from(discountRule)
    .where(eq(discountRule.isActive, true))
    .orderBy(discountRule.id)
    .for('update')
  if (rules.length === 0) {
    return {
      rules: [] as BillingDiscountRule[],
      usageCounts: new Map<string, number>(),
    }
  }
  const ruleIds = rules.map((rule) => rule.id)
  const [applications, products] = await Promise.all([
    tx
      .select({ ruleId: discountApplication.discountRuleId, used: count() })
      .from(discountApplication)
      .where(inArray(discountApplication.discountRuleId, ruleIds))
      .groupBy(discountApplication.discountRuleId),
    tx
      .select({
        productId: discountRuleProduct.productId,
        ruleId: discountRuleProduct.discountRuleId,
      })
      .from(discountRuleProduct)
      .where(inArray(discountRuleProduct.discountRuleId, ruleIds)),
  ])
  const productIds = new Map<string, string[]>()
  for (const link of products) {
    const ids = productIds.get(link.ruleId) ?? []
    ids.push(link.productId)
    productIds.set(link.ruleId, ids)
  }
  return {
    rules: rules.map((rule) => ({
      discountScope: rule.discountScope,
      discountType: rule.discountType,
      endsAt: rule.endsAt,
      fixedAmountMinor: rule.fixedAmountMinor,
      id: rule.id,
      minimumPurchaseMinor: rule.minimumPurchaseMinor,
      minimumQuantity: rule.minimumQuantity,
      percentageBps: rule.percentageBps,
      productIds: productIds.get(rule.id) ?? [],
      startsAt: rule.startsAt,
      usageLimit: rule.usageLimit,
    })),
    usageCounts: new Map(applications.map((row) => [row.ruleId, row.used])),
  }
}

const reachedNaturalEnd = (
  expiry: string | null,
  billingDate: string,
  next: string,
) => expiry !== null && billingDate >= expiry && next > expiry

const processSubscription = async (
  tx: Parameters<
    Parameters<
      ReturnType<typeof createTransactionDatabase>['db']['transaction']
    >[0]
  >[0],
  id: string,
  billingDate: string,
) => {
  const [record] = await tx
    .select({
      customerId: subscription.customerId,
      expiryDate: subscription.expiryDate,
      nextBillingDate: subscription.nextBillingDate,
      paymentTermDays: subscription.paymentTermDays,
      plan: subscriptionPlan,
      status: subscription.status,
      subscriptionNumber: subscription.subscriptionNumber,
    })
    .from(subscription)
    .innerJoin(
      subscriptionPlan,
      eq(subscriptionPlan.id, subscription.subscriptionPlanId),
    )
    .where(eq(subscription.id, id))
    .for('update')
  if (
    !record ||
    record.status !== 'ACTIVE' ||
    record.nextBillingDate === null ||
    record.nextBillingDate > billingDate
  ) {
    return { amountMinor: 0, created: false }
  }
  const start = record.nextBillingDate
  const next = advanceBillingDate(start, record.plan.billingFrequency)
  if (record.expiryDate !== null && start > record.expiryDate) {
    if (record.plan.autoCloseOnExpiry && billingDate >= record.expiryDate) {
      await tx
        .update(subscription)
        .set({ closedAt: new Date(), status: 'CLOSED' })
        .where(eq(subscription.id, id))
    }
    return { amountMinor: 0, created: false }
  }

  const lines = await tx
    .select({
      line: subscriptionLine,
      productTaxRuleId: product.taxRuleId,
      tax: taxRule,
    })
    .from(subscriptionLine)
    .innerJoin(product, eq(product.id, subscriptionLine.productId))
    .leftJoin(taxRule, eq(taxRule.id, product.taxRuleId))
    .where(eq(subscriptionLine.subscriptionId, id))
    .orderBy(subscriptionLine.id)
  if (lines.length === 0) {
    return { amountMinor: 0, created: false }
  }
  const sourceLines: BillingSourceLine[] = lines.map(
    ({ line, productTaxRuleId, tax }) => ({
      description: line.description,
      productId: line.productId,
      quantity: line.quantity,
      taxRateBps: taxRateFor(productTaxRuleId, tax),
      unitPriceMinor: line.unitPriceMinor,
    }),
  )
  if (sourceLines.some((line) => line.taxRateBps === null)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'A product tax rule is inactive or unavailable',
    })
  }
  const existing = await tx
    .select({ id: invoice.id })
    .from(invoice)
    .where(
      and(
        eq(invoice.subscriptionId, id),
        eq(invoice.billingPeriodStart, start),
        eq(invoice.billingPeriodEnd, previousDay(next)),
      ),
    )
  if (existing.length > 0) {
    await tx
      .update(subscription)
      .set({ nextBillingDate: next })
      .where(eq(subscription.id, id))
    return { amountMinor: 0, created: false }
  }

  const { rules, usageCounts } = await loadRulesForTransaction(tx)
  const calculation = calculateBilling(
    sourceLines,
    rules,
    usageCounts,
    billingDate,
  )
  const sequenceResult = await tx.execute(
    sql`select nextval('invoice_number_seq') as value`,
  )
  const sequenceValue = sequenceResult.rows[0]?.value
  if (typeof sequenceValue !== 'string' && typeof sequenceValue !== 'number') {
    throw new TypeError('Invoice number sequence returned an invalid value')
  }
  const sequence = Number(sequenceValue)
  const invoiceId = crypto.randomUUID()
  const invoiceNumber = `INV-${String(sequence).padStart(6, '0')}`
  const periodEnd = previousDay(next)
  const paidAt = new Date()
  const shouldClose =
    record.plan.autoCloseOnExpiry &&
    reachedNaturalEnd(record.expiryDate, billingDate, next)
  const inserted = await tx
    .insert(invoice)
    .values({
      billingPeriodEnd: periodEnd,
      billingPeriodStart: start,
      customerId: record.customerId,
      discountTotalMinor: calculation.discountMinor,
      dueDate: dateAfterDays(billingDate, record.paymentTermDays),
      id: invoiceId,
      invoiceNumber,
      invoiceStatus: 'DRAFT',
      issueDate: billingDate,
      subscriptionId: id,
      subtotalMinor: calculation.subtotalMinor,
      taxTotalMinor: calculation.taxMinor,
      totalMinor: calculation.totalMinor,
    })
    .onConflictDoNothing({
      target: [
        invoice.subscriptionId,
        invoice.billingPeriodStart,
        invoice.billingPeriodEnd,
      ],
    })
    .returning({ id: invoice.id })
  if (inserted.length === 0) {
    return { amountMinor: 0, created: false }
  }
  const invoiceLines = calculation.lines.map((line) => ({
    ...line,
    id: crypto.randomUUID(),
    invoiceId,
  }))
  await tx.insert(invoiceLine).values(invoiceLines)
  if (calculation.usages.length > 0) {
    await tx.insert(discountApplication).values(
      calculation.usages.map((usage) => ({
        appliedAmountMinor: usage.amountMinor,
        appliedAt: paidAt,
        discountRuleId: usage.ruleId,
        id: crypto.randomUUID(),
        invoiceId,
        invoiceLineId:
          usage.lineIndex === null
            ? null
            : (invoiceLines[usage.lineIndex]?.id ?? null),
      })),
    )
  }
  await tx
    .update(subscription)
    .set({
      nextBillingDate: next,
      ...(shouldClose ? { closedAt: paidAt, status: 'CLOSED' as const } : {}),
    })
    .where(eq(subscription.id, id))
  return { amountMinor: calculation.totalMinor, created: true }
}

const processCandidate = async (
  connection: ReturnType<typeof createTransactionDatabase>,
  runId: string,
  subscriptionId: string,
  billingDate: string,
) => {
  try {
    return await connection.db.transaction(
      async (tx) => await processSubscription(tx, subscriptionId, billingDate),
    )
  } catch (error) {
    console.error(
      JSON.stringify({
        billingRunId: runId,
        errorCode:
          error instanceof ORPCError ? 'BUSINESS_ERROR' : 'TRANSACTION_FAILED',
        event: 'billing.subscription.failed',
        subscriptionId,
      }),
    )
    return { amountMinor: 0, created: false, failed: true }
  }
}

export const run = async (databaseUrl: string, billingDate: string) =>
  await databaseOperation(async () => {
    const candidates = await createDatabase(databaseUrl)
      .select({ id: subscription.id })
      .from(subscription)
      .where(dueFilter(billingDate))
      .orderBy(subscription.nextBillingDate, subscription.id)
    if (candidates.length === 0) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'No subscriptions are due for billing on this date',
      })
    }
    const runId = crypto.randomUUID()
    const startedAt = new Date()
    await createDatabase(databaseUrl).insert(billingRun).values({
      billingDate,
      billingRunStatus: 'RUNNING',
      completedAt: null,
      failureCount: 0,
      id: runId,
      invoicesCreated: 0,
      startedAt,
      subscriptionsScanned: 0,
      subscriptionsSkipped: 0,
      totalAmountMinor: 0,
    })
    const connection = createTransactionDatabase(databaseUrl)
    let invoicesCreated = 0
    let subscriptionsSkipped = 0
    let failures = 0
    let totalAmountMinor = 0
    try {
      const results = await Promise.all(
        candidates.map(
          async (candidate) =>
            await processCandidate(
              connection,
              runId,
              candidate.id,
              billingDate,
            ),
        ),
      )
      for (const result of results) {
        if ('failed' in result) {
          failures += 1
          subscriptionsSkipped += 1
        } else if (result.created) {
          invoicesCreated += 1
          totalAmountMinor = addMinor(totalAmountMinor, result.amountMinor)
        } else {
          subscriptionsSkipped += 1
        }
      }
      await createDatabase(databaseUrl)
        .update(billingRun)
        .set({
          billingRunStatus: failures > 0 ? 'FAILED' : 'COMPLETED',
          completedAt: new Date(),
          failureCount: failures,
          invoicesCreated,
          subscriptionsScanned: candidates.length,
          subscriptionsSkipped,
          totalAmountMinor,
        })
        .where(eq(billingRun.id, runId))
    } catch (error) {
      await createDatabase(databaseUrl)
        .update(billingRun)
        .set({
          billingRunStatus: 'FAILED',
          completedAt: new Date(),
          failureCount:
            candidates.length - invoicesCreated - subscriptionsSkipped,
          invoicesCreated,
          subscriptionsScanned: candidates.length,
          subscriptionsSkipped,
          totalAmountMinor,
        })
        .where(eq(billingRun.id, runId))
      throw error
    } finally {
      await connection.close()
    }
    return {
      billingRunId: runId,
      failures,
      invoicesCreated,
      subscriptionsScanned: candidates.length,
      subscriptionsSkipped,
      totalAmountMinor,
    }
  })
