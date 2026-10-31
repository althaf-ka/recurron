import type { directoryInput, productInput } from '@recurron/api/catalog'
import { createDatabase } from '@recurron/db'
import { product, productVariant } from '@recurron/db/schema'
import { count, desc, eq, ilike, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { databaseOperation, requireRecord, searchPattern } from '../errors'

type Input = z.output<typeof productInput>

export const list = async (
  databaseUrl: string,
  input: z.output<typeof directoryInput>,
) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const filter = ilike(product.name, searchPattern(input.search))
    const [items, totals] = await db.batch([
      db
        .select()
        .from(product)
        .where(filter)
        .orderBy(desc(product.createdAt), product.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(product).where(filter),
    ])
    return { items, total: requireRecord(totals[0]).total }
  })

export const get = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [records, variants] = await db.batch([
      db.select().from(product).where(eq(product.id, id)),
      db
        .select({
          attributeName: productVariant.attributeName,
          isActive: productVariant.isActive,
          price_delta_minor: productVariant.priceDeltaMinor,
          valueName: productVariant.valueName,
        })
        .from(productVariant)
        .where(eq(productVariant.productId, id))
        .orderBy(productVariant.attributeName, productVariant.valueName),
    ])
    return { ...requireRecord(records[0]), variants }
  })

const variantValues = (id: string, variants: Input['variants']) =>
  variants.map((variant) => ({
    attributeName: variant.attributeName,
    id: crypto.randomUUID(),
    isActive: variant.isActive,
    priceDeltaMinor: variant.price_delta_minor,
    productId: id,
    valueName: variant.valueName,
  }))

export const create = async (databaseUrl: string, data: Input) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const id = crypto.randomUUID()
    const { variants, ...fields } = data
    const insert = db.insert(product).values({ ...fields, id })
    if (variants.length === 0) {
      await insert
      return { id }
    }
    // Neon HTTP batch executes all statements in a single transaction.
    await db.batch([
      insert,
      db.insert(productVariant).values(variantValues(id, variants)),
    ])
    return { id }
  })

export const update = async (databaseUrl: string, id: string, data: Input) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [existing] = await db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.id, id))
    requireRecord(existing)
    const { variants, ...fields } = data
    const change = db
      .update(product)
      .set(fields)
      .where(eq(product.id, id))
      .returning({ id: product.id })
    const deactivate = db
      .update(productVariant)
      .set({ isActive: false })
      .where(eq(productVariant.productId, id))
    // The parent update locks the row, serializing concurrent variant replacements.
    if (variants.length === 0) {
      const [records] = await db.batch([change, deactivate])
      return requireRecord(records[0])
    }
    const [records] = await db.batch([
      change,
      deactivate,
      db
        .insert(productVariant)
        .values(variantValues(id, variants))
        .onConflictDoUpdate({
          set: {
            isActive: sql`excluded.is_active`,
            priceDeltaMinor: sql`excluded.price_delta_minor`,
            updatedAt: new Date(),
          },
          target: [
            productVariant.productId,
            productVariant.attributeName,
            productVariant.valueName,
          ],
        }),
    ])
    return requireRecord(records[0])
  })

export const archive = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .update(product)
      .set({ isActive: false })
      .where(eq(product.id, id))
      .returning({ id: product.id })
    return requireRecord(record)
  })
