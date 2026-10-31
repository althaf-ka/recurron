import { createDatabase } from '@recurron/db'
import { createTransactionDatabase } from '@recurron/db/transaction'
import {
  discountApplication,
  discountRule,
  discountRuleProduct,
  taxRule,
} from '@recurron/db/schema'
import { count, desc, eq, inArray } from 'drizzle-orm'
import { databaseOperation, requireRecord } from '../errors'

interface TaxInput {
  isActive: boolean
  name: string
  rateBps: number
}

interface DiscountInput {
  discountScope: 'PRODUCT' | 'SUBSCRIPTION'
  discountType: 'FIXED' | 'PERCENTAGE'
  endsAt: string | null
  fixedAmountMinor: number | null
  isActive: boolean
  minimumPurchaseMinor: number | null
  minimumQuantity: number | null
  name: string
  percentageBps: number | null
  productIds: string[]
  startsAt: string | null
  usageLimit: number | null
}

interface DirectoryInput {
  page: number
  pageSize: number
  search: string
}

const discountValues = (data: DiscountInput) => ({
  discountScope: data.discountScope,
  discountType: data.discountType,
  endsAt: data.endsAt === null ? null : new Date(data.endsAt),
  fixedAmountMinor: data.fixedAmountMinor,
  isActive: data.isActive,
  minimumPurchaseMinor: data.minimumPurchaseMinor,
  minimumQuantity: data.minimumQuantity,
  name: data.name,
  percentageBps: data.percentageBps,
  startsAt: data.startsAt === null ? null : new Date(data.startsAt),
  usageLimit: data.usageLimit,
})

const discountLinks = (id: string, productIds: string[]) =>
  productIds.map((productId) => ({
    discountRuleId: id,
    id: crypto.randomUUID(),
    productId,
  }))

const discountRecord = (
  rule: typeof discountRule.$inferSelect,
  productIds: string[],
  usageCount: number,
) => ({
  ...rule,
  endsAt: rule.endsAt?.toISOString() ?? null,
  productIds,
  startsAt: rule.startsAt?.toISOString() ?? null,
  usageCount,
})

export const listTaxes = async (databaseUrl: string, input: DirectoryInput) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [items, totals] = await db.batch([
      db
        .select({
          id: taxRule.id,
          isActive: taxRule.isActive,
          name: taxRule.name,
          rateBps: taxRule.rateBps,
        })
        .from(taxRule)
        .orderBy(desc(taxRule.createdAt), taxRule.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(taxRule),
    ])
    return { items, total: requireRecord(totals[0]).total }
  })

export const getTax = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .select({
        id: taxRule.id,
        isActive: taxRule.isActive,
        name: taxRule.name,
        rateBps: taxRule.rateBps,
      })
      .from(taxRule)
      .where(eq(taxRule.id, id))
    return requireRecord(record)
  })

export const createTax = async (databaseUrl: string, data: TaxInput) =>
  await databaseOperation(async () => {
    const id = crypto.randomUUID()
    await createDatabase(databaseUrl)
      .insert(taxRule)
      .values({ ...data, id })
    return { id }
  })

export const updateTax = async (
  databaseUrl: string,
  id: string,
  data: TaxInput,
) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .update(taxRule)
      .set(data)
      .where(eq(taxRule.id, id))
      .returning({ id: taxRule.id })
    return requireRecord(record)
  })

export const listDiscounts = async (
  databaseUrl: string,
  input: DirectoryInput,
) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [rules, totals] = await db.batch([
      db
        .select()
        .from(discountRule)
        .orderBy(desc(discountRule.createdAt), discountRule.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(discountRule),
    ])
    if (rules.length === 0) {
      return { items: [], total: requireRecord(totals[0]).total }
    }
    const ids = rules.map((rule) => rule.id)
    const [links, applications] = await Promise.all([
      db
        .select({
          productId: discountRuleProduct.productId,
          ruleId: discountRuleProduct.discountRuleId,
        })
        .from(discountRuleProduct)
        .where(inArray(discountRuleProduct.discountRuleId, ids)),
      db
        .select({ ruleId: discountApplication.discountRuleId, used: count() })
        .from(discountApplication)
        .where(inArray(discountApplication.discountRuleId, ids))
        .groupBy(discountApplication.discountRuleId),
    ])
    const productIds = new Map<string, string[]>()
    for (const link of links) {
      const idsForRule = productIds.get(link.ruleId) ?? []
      idsForRule.push(link.productId)
      productIds.set(link.ruleId, idsForRule)
    }
    const usageCounts = new Map(
      applications.map((item) => [item.ruleId, item.used]),
    )
    return {
      items: rules.map((rule) =>
        discountRecord(
          rule,
          productIds.get(rule.id) ?? [],
          usageCounts.get(rule.id) ?? 0,
        ),
      ),
      total: requireRecord(totals[0]).total,
    }
  })

export const getDiscount = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [rule] = await db
      .select()
      .from(discountRule)
      .where(eq(discountRule.id, id))
    const current = requireRecord(rule)
    const [links, usage] = await Promise.all([
      db
        .select({ productId: discountRuleProduct.productId })
        .from(discountRuleProduct)
        .where(eq(discountRuleProduct.discountRuleId, id)),
      db
        .select({ used: count() })
        .from(discountApplication)
        .where(eq(discountApplication.discountRuleId, id)),
    ])
    return discountRecord(
      current,
      links.map((link) => link.productId),
      requireRecord(usage[0]).used,
    )
  })

export const createDiscount = async (
  databaseUrl: string,
  data: DiscountInput,
) =>
  await databaseOperation(async () => {
    const connection = createTransactionDatabase(databaseUrl)
    const id = crypto.randomUUID()
    try {
      await connection.db.transaction(async (tx) => {
        await tx.insert(discountRule).values({ ...discountValues(data), id })
        if (data.productIds.length > 0) {
          await tx
            .insert(discountRuleProduct)
            .values(discountLinks(id, data.productIds))
        }
      })
    } finally {
      await connection.close()
    }
    return { id }
  })

export const updateDiscount = async (
  databaseUrl: string,
  id: string,
  data: DiscountInput,
) =>
  await databaseOperation(async () => {
    const connection = createTransactionDatabase(databaseUrl)
    try {
      await connection.db.transaction(async (tx) => {
        const [current] = await tx
          .select({ id: discountRule.id })
          .from(discountRule)
          .where(eq(discountRule.id, id))
          .for('update')
        requireRecord(current)
        await tx
          .update(discountRule)
          .set(discountValues(data))
          .where(eq(discountRule.id, id))
        await tx
          .delete(discountRuleProduct)
          .where(eq(discountRuleProduct.discountRuleId, id))
        if (data.productIds.length > 0) {
          await tx
            .insert(discountRuleProduct)
            .values(discountLinks(id, data.productIds))
        }
      })
    } finally {
      await connection.close()
    }
    return { id }
  })
