import { ORPCError } from '@orpc/server'
import { subtractMinor } from '@recurron/api/money'
import { createTransactionDatabase } from '@recurron/db/transaction'
import { invoice, payment } from '@recurron/db/schema'
import { eq, sql } from 'drizzle-orm'
import { databaseOperation, requireRecord } from '../errors'

interface PaymentInput {
  amountMinor: number
  invoiceId: string
  note: string | null
  paidAt: string
  paymentMethod: 'BANK_TRANSFER' | 'CARD' | 'CASH' | 'OTHER' | 'UPI'
  reference: string | null
}

export const recordPayment = async (databaseUrl: string, input: PaymentInput) =>
  await databaseOperation(async () => {
    const connection = createTransactionDatabase(databaseUrl)
    try {
      return await connection.db.transaction(async (tx) => {
        const [invoiceRecord] = await tx
          .select({
            id: invoice.id,
            invoiceStatus: invoice.invoiceStatus,
            totalMinor: invoice.totalMinor,
          })
          .from(invoice)
          .where(eq(invoice.id, input.invoiceId))
          .for('update')
        const current = requireRecord(invoiceRecord)
        if (current.invoiceStatus !== 'CONFIRMED') {
          throw new ORPCError('BAD_REQUEST', {
            message: 'Only confirmed invoices can accept payments',
          })
        }
        const [paid] = await tx
          .select({
            amountMinor:
              sql<number>`coalesce(sum(${payment.amountMinor}), 0)`.mapWith(
                Number,
              ),
          })
          .from(payment)
          .where(eq(payment.invoiceId, input.invoiceId))
        const amountPaidMinor = requireRecord(paid).amountMinor
        const outstandingMinor = subtractMinor(
          current.totalMinor,
          amountPaidMinor,
        )
        if (input.amountMinor > outstandingMinor) {
          throw new ORPCError('BAD_REQUEST', {
            message: 'Payment cannot exceed the outstanding balance',
          })
        }
        const id = crypto.randomUUID()
        await tx.insert(payment).values({
          amountMinor: input.amountMinor,
          id,
          invoiceId: input.invoiceId,
          note: input.note,
          paidAt: new Date(`${input.paidAt}T12:00:00.000Z`),
          paymentMethod: input.paymentMethod,
          reference: input.reference,
        })
        if (input.amountMinor === outstandingMinor) {
          await tx
            .update(invoice)
            .set({ invoiceStatus: 'PAID', paidAt: new Date() })
            .where(eq(invoice.id, input.invoiceId))
        }
        return { id }
      })
    } finally {
      await connection.close()
    }
  })
