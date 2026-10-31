import { ORPCError } from '@orpc/server'
import { addMinor, subtractMinor } from '@recurron/api/money'
import { createDatabase } from '@recurron/db'
import { createTransactionDatabase } from '@recurron/db/transaction'
import {
  customer,
  invoice,
  invoiceLine,
  payment,
  subscription,
} from '@recurron/db/schema'
import { and, count, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { databaseOperation, requireRecord, searchPattern } from '../errors'

interface ListInput {
  page: number
  pageSize: number
  search: string
  status?: 'CANCELLED' | 'CONFIRMED' | 'DRAFT' | 'OVERDUE' | 'PAID'
}

const amountPaidExpression =
  sql<number>`coalesce((select sum(${payment.amountMinor}) from ${payment} where ${payment.invoiceId} = ${invoice.id}), 0)`.mapWith(
    Number,
  )
const today = () => new Date().toISOString().slice(0, 10)

const listFilter = (input: ListInput) => {
  const search = input.search.trim()
  const searchFilter =
    search.length > 0
      ? or(
          ilike(invoice.invoiceNumber, searchPattern(search)),
          ilike(customer.name, searchPattern(search)),
          ilike(subscription.subscriptionNumber, searchPattern(search)),
        )
      : undefined
  let statusFilter
  if (input.status === 'OVERDUE') {
    statusFilter = and(
      eq(invoice.invoiceStatus, 'CONFIRMED'),
      lt(invoice.dueDate, today()),
      sql`${invoice.totalMinor} > ${amountPaidExpression}`,
    )
  } else if (input.status) {
    statusFilter = eq(invoice.invoiceStatus, input.status)
  }
  return and(searchFilter, statusFilter)
}

export const list = async (databaseUrl: string, input: ListInput) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const filter = listFilter(input)
    const [rows, totals] = await db.batch([
      db
        .select({
          billingPeriodEnd: invoice.billingPeriodEnd,
          billingPeriodStart: invoice.billingPeriodStart,
          customerId: invoice.customerId,
          customerName: customer.name,
          dueDate: invoice.dueDate,
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceStatus: invoice.invoiceStatus,
          issueDate: invoice.issueDate,
          subscriptionId: invoice.subscriptionId,
          subscriptionNumber: subscription.subscriptionNumber,
          totalMinor: invoice.totalMinor,
        })
        .from(invoice)
        .innerJoin(customer, eq(customer.id, invoice.customerId))
        .innerJoin(subscription, eq(subscription.id, invoice.subscriptionId))
        .where(filter)
        .orderBy(desc(invoice.issueDate), desc(invoice.createdAt), invoice.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db
        .select({ total: count() })
        .from(invoice)
        .innerJoin(customer, eq(customer.id, invoice.customerId))
        .innerJoin(subscription, eq(subscription.id, invoice.subscriptionId))
        .where(filter),
    ])
    const ids = rows.map((row) => row.id)
    const paidRows =
      ids.length === 0
        ? []
        : await db
            .select({ amountPaidMinor: amountPaidExpression, id: invoice.id })
            .from(invoice)
            .where(inArray(invoice.id, ids))
    const amountsPaid = new Map(
      paidRows.map((row) => [row.id, row.amountPaidMinor]),
    )
    return {
      items: rows.map((row) => {
        const amountPaidMinor = amountsPaid.get(row.id) ?? 0
        const outstandingMinor = subtractMinor(row.totalMinor, amountPaidMinor)
        return {
          ...row,
          amountPaidMinor,
          outstandingMinor,
          overdue:
            row.invoiceStatus === 'CONFIRMED' &&
            row.dueDate < today() &&
            outstandingMinor > 0,
        }
      }),
      total: requireRecord(totals[0]).total,
    }
  })

export const get = async (databaseUrl: string, id: string) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [record] = await db
      .select({
        billingPeriodEnd: invoice.billingPeriodEnd,
        billingPeriodStart: invoice.billingPeriodStart,
        cancelledAt: invoice.cancelledAt,
        confirmedAt: invoice.confirmedAt,
        customerId: invoice.customerId,
        customerName: customer.name,
        discountTotalMinor: invoice.discountTotalMinor,
        dueDate: invoice.dueDate,
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceStatus: invoice.invoiceStatus,
        issueDate: invoice.issueDate,
        paidAt: invoice.paidAt,
        subscriptionId: invoice.subscriptionId,
        subscriptionNumber: subscription.subscriptionNumber,
        subtotalMinor: invoice.subtotalMinor,
        taxTotalMinor: invoice.taxTotalMinor,
        totalMinor: invoice.totalMinor,
      })
      .from(invoice)
      .innerJoin(customer, eq(customer.id, invoice.customerId))
      .innerJoin(subscription, eq(subscription.id, invoice.subscriptionId))
      .where(eq(invoice.id, id))
    const invoiceRecord = requireRecord(record)
    const [lines, payments] = await Promise.all([
      db
        .select({
          description: invoiceLine.description,
          discountMinor: invoiceLine.discountMinor,
          id: invoiceLine.id,
          productId: invoiceLine.productId,
          quantity: invoiceLine.quantity,
          subtotalMinor: invoiceLine.subtotalMinor,
          taxMinor: invoiceLine.taxMinor,
          taxRateBps: invoiceLine.taxRateBps,
          totalMinor: invoiceLine.totalMinor,
          unitPriceMinor: invoiceLine.unitPriceMinor,
        })
        .from(invoiceLine)
        .where(eq(invoiceLine.invoiceId, id))
        .orderBy(invoiceLine.id),
      db
        .select({
          amountMinor: payment.amountMinor,
          createdAt: payment.createdAt,
          id: payment.id,
          invoiceId: payment.invoiceId,
          note: payment.note,
          paidAt: payment.paidAt,
          paymentMethod: payment.paymentMethod,
          reference: payment.reference,
        })
        .from(payment)
        .where(eq(payment.invoiceId, id))
        .orderBy(desc(payment.paidAt), desc(payment.createdAt)),
    ])
    let amountPaidMinor = 0
    for (const item of payments) {
      amountPaidMinor = addMinor(amountPaidMinor, item.amountMinor)
    }
    return {
      ...invoiceRecord,
      amountPaidMinor,
      lines,
      outstandingMinor: subtractMinor(
        invoiceRecord.totalMinor,
        amountPaidMinor,
      ),
      overdue:
        invoiceRecord.invoiceStatus === 'CONFIRMED' &&
        invoiceRecord.dueDate < today() &&
        invoiceRecord.totalMinor > amountPaidMinor,
      payments,
    }
  })

const transition = async (
  databaseUrl: string,
  id: string,
  operation: 'cancel' | 'confirm',
) => {
  const connection = createTransactionDatabase(databaseUrl)
  try {
    return await connection.db.transaction(async (tx) => {
      const [record] = await tx
        .select({ invoiceStatus: invoice.invoiceStatus })
        .from(invoice)
        .where(eq(invoice.id, id))
        .for('update')
      const current = requireRecord(record)
      if (operation === 'confirm') {
        if (current.invoiceStatus !== 'DRAFT') {
          throw new ORPCError('BAD_REQUEST', {
            message: 'Only draft invoices can be confirmed',
          })
        }
        await tx
          .update(invoice)
          .set({ confirmedAt: new Date(), invoiceStatus: 'CONFIRMED' })
          .where(eq(invoice.id, id))
        return { id }
      }
      if (
        current.invoiceStatus !== 'DRAFT' &&
        current.invoiceStatus !== 'CONFIRMED'
      ) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'This invoice cannot be cancelled',
        })
      }
      if (current.invoiceStatus === 'CONFIRMED') {
        const [payments] = await tx
          .select({ total: count() })
          .from(payment)
          .where(eq(payment.invoiceId, id))
        if (requireRecord(payments).total > 0) {
          throw new ORPCError('BAD_REQUEST', {
            message: 'Invoices with payments cannot be cancelled',
          })
        }
      }
      await tx
        .update(invoice)
        .set({ cancelledAt: new Date(), invoiceStatus: 'CANCELLED' })
        .where(eq(invoice.id, id))
      return { id }
    })
  } finally {
    await connection.close()
  }
}

export const confirm = async (databaseUrl: string, id: string) =>
  await databaseOperation(
    async () => await transition(databaseUrl, id, 'confirm'),
  )

export const cancel = async (databaseUrl: string, id: string) =>
  await databaseOperation(
    async () => await transition(databaseUrl, id, 'cancel'),
  )

export const listPayments = async (databaseUrl: string, invoiceId: string) =>
  await databaseOperation(async () => {
    const db = createDatabase(databaseUrl)
    const [record] = await db
      .select({ id: invoice.id })
      .from(invoice)
      .where(eq(invoice.id, invoiceId))
    requireRecord(record)
    return await db
      .select({
        amountMinor: payment.amountMinor,
        createdAt: payment.createdAt,
        id: payment.id,
        invoiceId: payment.invoiceId,
        note: payment.note,
        paidAt: payment.paidAt,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
      })
      .from(payment)
      .where(eq(payment.invoiceId, invoiceId))
      .orderBy(desc(payment.paidAt), desc(payment.createdAt))
  })
