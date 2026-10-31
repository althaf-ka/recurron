import type { planInput, directoryInput } from '@recurron/api/catalog'
import { createDatabase } from '@recurron/db'
import { subscriptionPlan } from '@recurron/db/schema'
import { count, desc, eq, ilike } from 'drizzle-orm'
import type { z } from 'zod'
import { databaseOperation, requireRecord, searchPattern } from '../errors'

type Input = z.output<typeof planInput>

export const list = async (
  databaseUrl: string,
  input: z.output<typeof directoryInput>,
) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)

    const filter = ilike(subscriptionPlan.name, searchPattern(input.search))
    const [items, totals] = await db.batch([
      db
        .select()
        .from(subscriptionPlan)
        .where(filter)
        .orderBy(desc(subscriptionPlan.createdAt), subscriptionPlan.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(subscriptionPlan).where(filter),
    ])
    return { items, total: requireRecord(totals[0]).total }
  })

export const get = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, id))
    return requireRecord(record)
  })

export const create = async (databaseUrl: string, data: Input) =>
  await databaseOperation(async () => {
    const id = crypto.randomUUID()
    await createDatabase(databaseUrl)
      .insert(subscriptionPlan)
      .values({ ...data, id })
    return { id }
  })

export const update = async (databaseUrl: string, id: string, data: Input) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .update(subscriptionPlan)
      .set(data)
      .where(eq(subscriptionPlan.id, id))
      .returning({ id: subscriptionPlan.id })
    return requireRecord(record)
  })

export const archive = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .update(subscriptionPlan)
      .set({ isActive: false })
      .where(eq(subscriptionPlan.id, id))
      .returning({ id: subscriptionPlan.id })
    return requireRecord(record)
  })
