import type { customerInput, directoryInput } from '@recurron/api/catalog'
import { createDatabase } from '@recurron/db'
import { customer } from '@recurron/db/schema'
import { count, desc, eq, ilike, or } from 'drizzle-orm'
import type { z } from 'zod'
import { databaseOperation, requireRecord, searchPattern } from '../errors'

type Input = z.output<typeof customerInput>

export const list = async (
  databaseUrl: string,
  input: z.output<typeof directoryInput>,
) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const pattern = searchPattern(input.search)
    const filter = or(
      ilike(customer.name, pattern),
      ilike(customer.email, pattern),
      ilike(customer.companyName, pattern),
    )
    const [items, totals] = await db.batch([
      db
        .select()
        .from(customer)
        .where(filter)
        .orderBy(desc(customer.createdAt), customer.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.select({ total: count() }).from(customer).where(filter),
    ])
    return { items, total: requireRecord(totals[0]).total }
  })

export const get = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .select()
      .from(customer)
      .where(eq(customer.id, id))
    return requireRecord(record)
  })

export const create = async (databaseUrl: string, data: Input) =>
  await databaseOperation(async () => {
    const id = crypto.randomUUID()
    await createDatabase(databaseUrl)
      .insert(customer)
      .values({ ...data, id })
    return { id }
  })

export const update = async (databaseUrl: string, id: string, data: Input) =>
  await databaseOperation(async () => {
    const [record] = await createDatabase(databaseUrl)
      .update(customer)
      .set(data)
      .where(eq(customer.id, id))
      .returning({ id: customer.id })
    return requireRecord(record)
  })
