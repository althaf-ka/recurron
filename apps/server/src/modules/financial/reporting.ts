import { createDatabase } from '@recurron/db'
import { customer, invoice, payment } from '@recurron/db/schema'
import { count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { databaseOperation, requireRecord, searchPattern } from '../errors'

export const listPaymentDirectory = async (
  url: string,
  input: { page: number; pageSize: number; search: string },
) =>
  await databaseOperation(async () => {
    const db = createDatabase(url)
    const filter = or(
      ilike(invoice.invoiceNumber, searchPattern(input.search)),
      ilike(customer.name, searchPattern(input.search)),
      ilike(payment.reference, searchPattern(input.search)),
    )
    const [items, totals] = await db.batch([
      db
        .select({
          amountMinor: payment.amountMinor,
          createdAt: payment.createdAt,
          customerName: customer.name,
          id: payment.id,
          invoiceId: payment.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          note: payment.note,
          paidAt: payment.paidAt,
          paymentMethod: payment.paymentMethod,
          reference: payment.reference,
        })
        .from(payment)
        .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
        .innerJoin(customer, eq(customer.id, invoice.customerId))
        .where(filter)
        .orderBy(desc(payment.paidAt), payment.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db
        .select({ total: count() })
        .from(payment)
        .innerJoin(invoice, eq(invoice.id, payment.invoiceId))
        .innerJoin(customer, eq(customer.id, invoice.customerId))
        .where(filter),
    ])
    return { items, total: requireRecord(totals[0]).total }
  })

export const financeSummary = async (url: string) =>
  await databaseOperation(async () => {
    const result = await createDatabase(url).execute(sql`
    with balances as (
      select i.id, i.due_date, i.total_minor - coalesce(p.paid, 0) as outstanding
      from invoice i
      left join (select invoice_id, sum(amount_minor) as paid from payment group by invoice_id) p on p.invoice_id = i.id
      where i.invoice_status = 'CONFIRMED'
    )
    select
      (select count(*) from subscription where status = 'ACTIVE') as active_count,
      (select count(*) from subscription where status = 'ACTIVE' and next_billing_date <= current_date and (expiry_date is null or next_billing_date <= expiry_date)) as due_count,
      (select coalesce(sum(amount_minor), 0) from payment where paid_at >= date_trunc('month', current_date) and paid_at < date_trunc('month', current_date) + interval '1 month') as collected,
      (select coalesce(sum(outstanding), 0) from balances where outstanding > 0) as outstanding,
      (select count(*) from balances where due_date < current_date and outstanding > 0) as overdue_count
  `)
    const row = requireRecord(result.rows[0])
    return {
      activeSubscriptions: Number(row.active_count),
      collectedMinor: Number(row.collected),
      outstandingMinor: Number(row.outstanding),
      overdueInvoices: Number(row.overdue_count),
      subscriptionsDue: Number(row.due_count),
    }
  })
