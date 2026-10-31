import { ORPCError } from '@orpc/server'
import { advanceBillingDate } from '@recurron/api/billing-date'
import { createDatabase } from '@recurron/db'
import {
  customer,
  product,
  productVariant,
  quotationTemplate,
  quotationTemplateLine,
  subscription,
  subscriptionLine,
  subscriptionPlan,
} from '@recurron/db/schema'
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import type { z } from 'zod'
import type { subscriptionInput } from '@recurron/api/subscription'
import { databaseOperation, requireRecord, searchPattern } from '../errors'
import { ensureTransition, initialBillingDate } from './lifecycle'

type CreateInput = z.output<typeof subscriptionInput> & {
  quotationTemplateId?: string | null
}
type SubscriptionStatus = (typeof subscription.status.enumValues)[number]
interface TemplateInput {
  lines: CreateInput['lines']
  name: string
  subscriptionPlanId: string
  validityDays: number
}
const unavailable = () =>
  new ORPCError('BAD_REQUEST', {
    message: 'Selected plan or product is unavailable',
  })
const dateValid = (start: string, expiry: string | null) =>
  expiry === null || expiry >= start
const validatePlanAndLines = async (
  db: ReturnType<typeof createDatabase>,
  input: CreateInput,
) => {
  const [plan] = await db
    .select()
    .from(subscriptionPlan)
    .where(
      and(
        eq(subscriptionPlan.id, input.subscriptionPlanId),
        eq(subscriptionPlan.isActive, true),
      ),
    )
  if (!plan) {
    throw unavailable()
  }
  const quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0)
  if (quantity < plan.minimumQuantity) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Plan minimum quantity not met',
    })
  }
  const productIds = [...new Set(input.lines.map((line) => line.productId))]
  const products = await db
    .select()
    .from(product)
    .where(and(inArray(product.id, productIds), eq(product.isActive, true)))
  if (products.length !== productIds.length) {
    throw unavailable()
  }
  const variantIds = input.lines.flatMap((line) =>
    line.productVariantId === null ? [] : [line.productVariantId],
  )
  const variants = variantIds.length
    ? await db
        .select()
        .from(productVariant)
        .where(
          and(
            inArray(productVariant.id, variantIds),
            eq(productVariant.isActive, true),
          ),
        )
    : []
  if (variants.length !== variantIds.length) {
    throw unavailable()
  }
  for (const line of input.lines) {
    if (!products.some((item) => item.id === line.productId)) {
      throw unavailable()
    }
    if (
      line.productVariantId !== null &&
      !variants.some(
        (variant) =>
          variant.id === line.productVariantId &&
          variant.productId === line.productId,
      )
    ) {
      throw unavailable()
    }
  }
}

export const list = async (
  url: string,
  input: {
    page: number
    pageSize: number
    search: string
    status?: SubscriptionStatus
  },
) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const pattern = searchPattern(input.search)
    const filters = [
      or(
        ilike(subscription.subscriptionNumber, pattern),
        ilike(customer.name, pattern),
        ilike(subscriptionPlan.name, pattern),
      ),
    ]
    if (input.status !== undefined) {
      filters.push(eq(subscription.status, input.status))
    }
    const filter = and(...filters)
    const [items, totals] = await db.batch([
      db
        .select({
          customerName: customer.name,
          plan: subscriptionPlan,
          record: subscription,
        })
        .from(subscription)
        .innerJoin(customer, eq(customer.id, subscription.customerId))
        .innerJoin(
          subscriptionPlan,
          eq(subscriptionPlan.id, subscription.subscriptionPlanId),
        )
        .where(filter)
        .orderBy(desc(subscription.createdAt), subscription.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db
        .select({ total: count() })
        .from(subscription)
        .innerJoin(customer, eq(customer.id, subscription.customerId))
        .innerJoin(
          subscriptionPlan,
          eq(subscriptionPlan.id, subscription.subscriptionPlanId),
        )
        .where(filter),
    ])
    const ids = items.map(({ record }) => record.id)
    const lines = ids.length
      ? await db
          .select({
            description: subscriptionLine.description,
            id: subscriptionLine.id,
            productId: subscriptionLine.productId,
            productVariantId: subscriptionLine.productVariantId,
            quantity: subscriptionLine.quantity,
            subscriptionId: subscriptionLine.subscriptionId,
            unitPriceMinor: subscriptionLine.unitPriceMinor,
          })
          .from(subscriptionLine)
          .where(inArray(subscriptionLine.subscriptionId, ids))
      : []
    const linesBySubscription = new Map<string, typeof lines>()
    for (const line of lines) {
      const subscriptionLines =
        linesBySubscription.get(line.subscriptionId) ?? []
      subscriptionLines.push(line)
      linesBySubscription.set(line.subscriptionId, subscriptionLines)
    }
    return {
      items: items.map(({ record, customerName, plan }) => ({
        ...record,
        allowEarlyClose: plan.allowEarlyClose,
        allowPause: plan.allowPause,
        allowRenewal: plan.allowRenewal,
        billingFrequency: plan.billingFrequency,
        customerName,
        lines: linesBySubscription.get(record.id) ?? [],
        planName: plan.name,
      })),
      total: requireRecord(totals[0]).total,
    }
  })

export const create = async (url: string, input: CreateInput) =>
  await databaseOperation(async () => {
    if (!dateValid(input.startDate, input.expiryDate)) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Expiry must be on or after start date',
      })
    }
    const db = createDatabase(url)
    await validatePlanAndLines(db, input)
    const id = crypto.randomUUID()
    const number = `SUB-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
    await db.batch([
      db.insert(subscription).values({
        customerId: input.customerId,
        expiryDate: input.expiryDate,
        id,
        paymentTermDays: input.paymentTermDays,
        startDate: input.startDate,
        status: 'DRAFT',
        subscriptionNumber: number,
        subscriptionPlanId: input.subscriptionPlanId,
      }),
      db.insert(subscriptionLine).values(
        input.lines.map((line) => ({
          ...line,
          id: crypto.randomUUID(),
          subscriptionId: id,
        })),
      ),
    ])
    return { id }
  })

export const lifecycle = async (
  url: string,
  id: string,
  operation:
    | 'createQuotation'
    | 'confirm'
    | 'activate'
    | 'pause'
    | 'resume'
    | 'renew'
    | 'close',
) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const [record] = await db
      .select({ plan: subscriptionPlan, sub: subscription })
      .from(subscription)
      .innerJoin(
        subscriptionPlan,
        eq(subscription.subscriptionPlanId, subscriptionPlan.id),
      )
      .where(eq(subscription.id, id))
    const current = requireRecord(record)
    const nextByOperation = {
      activate: 'ACTIVE',
      close: 'CLOSED',
      confirm: 'CONFIRMED',
      createQuotation: 'QUOTATION',
      pause: 'PAUSED',
      renew: 'ACTIVE',
      resume: 'ACTIVE',
    } as const satisfies Record<typeof operation, SubscriptionStatus>
    const next = nextByOperation[operation]
    if (operation === 'renew') {
      if (!current.plan.allowRenewal) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Plan does not allow renewal',
        })
      }
      if (current.sub.status !== 'ACTIVE') {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Only active subscriptions can be renewed',
        })
      }
      const from = current.sub.expiryDate ?? current.sub.startDate
      const expiryDate = advanceBillingDate(from, current.plan.billingFrequency)
      await db
        .update(subscription)
        .set({ expiryDate })
        .where(eq(subscription.id, id))
      return { id }
    }
    ensureTransition(current.sub.status, next)
    if (operation === 'pause' && !current.plan.allowPause) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Plan does not allow pause',
      })
    }
    if (
      operation === 'close' &&
      current.sub.expiryDate !== null &&
      current.sub.expiryDate >= new Date().toISOString().slice(0, 10) &&
      !current.plan.allowEarlyClose
    ) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Plan does not allow early close',
      })
    }
    await db
      .update(subscription)
      .set({
        status: next,
        ...(operation === 'activate'
          ? {
              activatedAt: new Date(),
              nextBillingDate: initialBillingDate(current.sub.startDate),
            }
          : {}),
        ...(operation === 'close' ? { closedAt: new Date() } : {}),
      })
      .where(eq(subscription.id, id))
    return { id }
  })

export const get = async (url: string, id: string) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const [record] = await db
      .select({
        customerName: customer.name,
        plan: subscriptionPlan,
        sub: subscription,
      })
      .from(subscription)
      .innerJoin(customer, eq(customer.id, subscription.customerId))
      .innerJoin(
        subscriptionPlan,
        eq(subscriptionPlan.id, subscription.subscriptionPlanId),
      )
      .where(eq(subscription.id, id))
    const current = requireRecord(record)
    const lines = await db
      .select({
        description: subscriptionLine.description,
        id: subscriptionLine.id,
        productId: subscriptionLine.productId,
        productVariantId: subscriptionLine.productVariantId,
        quantity: subscriptionLine.quantity,
        unitPriceMinor: subscriptionLine.unitPriceMinor,
      })
      .from(subscriptionLine)
      .where(eq(subscriptionLine.subscriptionId, id))
    return {
      ...current.sub,
      allowEarlyClose: current.plan.allowEarlyClose,
      allowPause: current.plan.allowPause,
      allowRenewal: current.plan.allowRenewal,
      billingFrequency: current.plan.billingFrequency,
      customerName: current.customerName,
      lines,
      planName: current.plan.name,
    }
  })

export const updateDraft = async (
  url: string,
  id: string,
  input: CreateInput,
) =>
  await databaseOperation(async () => {
    if (!dateValid(input.startDate, input.expiryDate)) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Expiry must be on or after start date',
      })
    }
    const db = createDatabase(url)
    const [current] = await db
      .select({ status: subscription.status })
      .from(subscription)
      .where(eq(subscription.id, id))
    if (requireRecord(current).status !== 'DRAFT') {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Only draft subscriptions can be updated',
      })
    }
    await validatePlanAndLines(db, input)
    const [updated] = await db
      .update(subscription)
      .set({
        customerId: input.customerId,
        expiryDate: input.expiryDate,
        paymentTermDays: input.paymentTermDays,
        startDate: input.startDate,
        subscriptionPlanId: input.subscriptionPlanId,
      })
      .where(and(eq(subscription.id, id), eq(subscription.status, 'DRAFT')))
      .returning({ id: subscription.id })
    requireRecord(updated)
    await db
      .delete(subscriptionLine)
      .where(eq(subscriptionLine.subscriptionId, id))
    await db.insert(subscriptionLine).values(
      input.lines.map((line) => ({
        ...line,
        id: crypto.randomUUID(),
        subscriptionId: id,
      })),
    )
    return { id }
  })

export const listTemplates = async (
  url: string,
  input: { page: number; pageSize: number; search: string },
) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const pattern = searchPattern(input.search)
    const filter = ilike(quotationTemplate.name, pattern)
    const [items, totals] = await db.batch([
      db
        .select()
        .from(quotationTemplate)
        .where(filter)
        .orderBy(desc(quotationTemplate.createdAt), quotationTemplate.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(quotationTemplate).where(filter),
    ])
    const ids = items.map((item) => item.id)
    const lines = ids.length
      ? await db
          .select()
          .from(quotationTemplateLine)
          .where(inArray(quotationTemplateLine.quotationTemplateId, ids))
      : []
    const linesByTemplate = new Map<string, typeof lines>()
    for (const line of lines) {
      const templateLines = linesByTemplate.get(line.quotationTemplateId) ?? []
      templateLines.push(line)
      linesByTemplate.set(line.quotationTemplateId, templateLines)
    }
    return {
      items: items.map((item) => ({
        ...item,
        lines: linesByTemplate.get(item.id) ?? [],
      })),
      total: requireRecord(totals[0]).total,
    }
  })

export const getTemplate = async (url: string, id: string) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const [record] = await db
      .select()
      .from(quotationTemplate)
      .where(eq(quotationTemplate.id, id))
    const item = requireRecord(record)
    const lines = await db
      .select()
      .from(quotationTemplateLine)
      .where(eq(quotationTemplateLine.quotationTemplateId, id))
    return { ...item, lines }
  })

export const createTemplate = async (url: string, input: TemplateInput) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const [plan] = await db
      .select({ id: subscriptionPlan.id })
      .from(subscriptionPlan)
      .where(
        and(
          eq(subscriptionPlan.id, input.subscriptionPlanId),
          eq(subscriptionPlan.isActive, true),
        ),
      )
    if (!plan) {
      throw unavailable()
    }
    const id = crypto.randomUUID()
    await db.batch([
      db.insert(quotationTemplate).values({
        id,
        name: input.name,
        subscriptionPlanId: input.subscriptionPlanId,
        validityDays: input.validityDays,
      }),
      db.insert(quotationTemplateLine).values(
        input.lines.map((line) => ({
          ...line,
          id: crypto.randomUUID(),
          quotationTemplateId: id,
        })),
      ),
    ])
    return { id }
  })

export const updateTemplate = async (
  url: string,
  id: string,
  input: TemplateInput,
) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const [plan] = await db
      .select({ id: subscriptionPlan.id })
      .from(subscriptionPlan)
      .where(
        and(
          eq(subscriptionPlan.id, input.subscriptionPlanId),
          eq(subscriptionPlan.isActive, true),
        ),
      )
    if (!plan) {
      throw unavailable()
    }
    const [updated] = await db
      .update(quotationTemplate)
      .set({
        name: input.name,
        subscriptionPlanId: input.subscriptionPlanId,
        validityDays: input.validityDays,
      })
      .where(eq(quotationTemplate.id, id))
      .returning({ id: quotationTemplate.id })
    requireRecord(updated)
    await db
      .delete(quotationTemplateLine)
      .where(eq(quotationTemplateLine.quotationTemplateId, id))
    await db.insert(quotationTemplateLine).values(
      input.lines.map((line) => ({
        ...line,
        id: crypto.randomUUID(),
        quotationTemplateId: id,
      })),
    )
    return { id }
  })

export const archiveTemplate = async (url: string, id: string) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(url)
      .update(quotationTemplate)
      .set({ isActive: false })
      .where(eq(quotationTemplate.id, id))
      .returning({ id: quotationTemplate.id })
    return requireRecord(record)
  })
