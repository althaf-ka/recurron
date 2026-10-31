import { and, eq } from 'drizzle-orm'
import type { createDatabase } from './index'
import { customer } from './schema'

type Database = ReturnType<typeof createDatabase>

export const findCustomerForUser = async (db: Database, userId: string) => {
  const [record] = await db
    .select()
    .from(customer)
    .where(eq(customer.userId, userId))
    .limit(1)
  return record
}

export const findOwnedCustomer = async (
  db: Database,
  requestedId: string,
  currentCustomerId: string,
) => {
  const [record] = await db
    .select()
    .from(customer)
    .where(
      and(eq(customer.id, requestedId), eq(customer.id, currentCustomerId)),
    )
    .limit(1)
  return record
}
