import { oc } from '@orpc/contract'
import { z } from 'zod'
import { directoryInput } from './catalog'

const errors = oc.errors({
  BAD_REQUEST: { message: 'Invalid financial operation' },
  CONFLICT: { message: 'Financial record conflicts with existing data' },
  FORBIDDEN: { message: 'Access denied' },
  INTERNAL_SERVER_ERROR: { message: 'Unable to complete financial operation' },
  NOT_FOUND: { message: 'Financial record not found' },
  UNAUTHENTICATED: { message: 'Authentication required' },
})
const id = z.object({ id: z.string().min(1) })
const resultId = z.object({ id: z.string() })
const taxInput = z.object({
  isActive: z.boolean(),
  name: z.string().trim().min(1).max(200),
  rateBps: z.number().int().min(0).max(10_000),
})
const taxRecord = taxInput.extend({ id: z.string() })
const discountInput = z
  .object({
    discountScope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
    discountType: z.enum(['FIXED', 'PERCENTAGE']),
    endsAt: z.iso.datetime().nullable(),
    fixedAmountMinor: z.number().int().nonnegative().nullable(),
    isActive: z.boolean(),
    minimumPurchaseMinor: z.number().int().nonnegative().nullable(),
    minimumQuantity: z.number().int().min(1).nullable(),
    name: z.string().trim().min(1).max(200),
    percentageBps: z.number().int().min(0).max(10_000).nullable(),
    productIds: z.array(z.string().min(1)).max(100),
    startsAt: z.iso.datetime().nullable(),
    usageLimit: z.number().int().min(1).nullable(),
  })
  .refine(
    (value) =>
      (value.discountType === 'FIXED' &&
        value.fixedAmountMinor !== null &&
        value.percentageBps === null) ||
      (value.discountType === 'PERCENTAGE' &&
        value.percentageBps !== null &&
        value.fixedAmountMinor === null),
    { message: 'Provide only the value matching the discount type' },
  )
  .refine(
    (value) =>
      value.discountScope === 'SUBSCRIPTION' || value.productIds.length > 0,
    { message: 'Select at least one product for a product discount' },
  )
const discountRecord = discountInput.extend({
  id: z.string(),
  usageCount: z.number(),
})
const billingDate = z.iso.date()
const invoiceStatus = z.enum(['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'])
const invoiceRow = z.object({
  amountPaidMinor: z.number(),
  billingPeriodEnd: z.iso.date(),
  billingPeriodStart: z.iso.date(),
  customerId: z.string(),
  customerName: z.string(),
  dueDate: z.iso.date(),
  id: z.string(),
  invoiceNumber: z.string(),
  invoiceStatus,
  issueDate: z.iso.date(),
  outstandingMinor: z.number(),
  overdue: z.boolean(),
  subscriptionId: z.string(),
  subscriptionNumber: z.string(),
  totalMinor: z.number(),
})
const invoiceLineRecord = z.object({
  description: z.string(),
  discountMinor: z.number(),
  id: z.string(),
  productId: z.string().nullable(),
  quantity: z.number(),
  subtotalMinor: z.number(),
  taxMinor: z.number(),
  taxRateBps: z.number(),
  totalMinor: z.number(),
  unitPriceMinor: z.number(),
})
const paymentRecord = z.object({
  amountMinor: z.number(),
  createdAt: z.date(),
  id: z.string(),
  invoiceId: z.string(),
  note: z.string().nullable(),
  paidAt: z.date(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'OTHER']),
  reference: z.string().nullable(),
})
const invoiceDetail = invoiceRow.extend({
  cancelledAt: z.date().nullable(),
  confirmedAt: z.date().nullable(),
  discountTotalMinor: z.number(),
  lines: z.array(invoiceLineRecord),
  paidAt: z.date().nullable(),
  payments: z.array(paymentRecord),
  subtotalMinor: z.number(),
  taxTotalMinor: z.number(),
})
const billingPreviewRow = z.object({
  billingPeriodEnd: z.iso.date(),
  billingPeriodStart: z.iso.date(),
  customerName: z.string(),
  discountMinor: z.number(),
  planName: z.string(),
  subscriptionId: z.string(),
  subscriptionNumber: z.string(),
  subtotalMinor: z.number(),
  taxMinor: z.number(),
  totalMinor: z.number(),
  warnings: z.array(z.string()),
})
const billingPreview = z.object({
  billingDate,
  candidateInvoiceCount: z.number(),
  discountMinor: z.number(),
  items: z.array(billingPreviewRow),
  page: z.number(),
  pageSize: z.number(),
  subscriptionsDue: z.number(),
  subtotalMinor: z.number(),
  taxMinor: z.number(),
  totalMinor: z.number(),
})
const invoiceFilter = z.enum([
  'DRAFT',
  'CONFIRMED',
  'PAID',
  'OVERDUE',
  'CANCELLED',
])

export const financialContract = {
  billing: {
    preview: errors
      .input(
        z.object({
          billingDate,
          page: directoryInput.shape.page,
          pageSize: directoryInput.shape.pageSize,
        }),
      )
      .output(billingPreview),
    run: errors.input(z.object({ billingDate })).output(
      z.object({
        billingRunId: z.string(),
        failures: z.number(),
        invoicesCreated: z.number(),
        subscriptionsScanned: z.number(),
        subscriptionsSkipped: z.number(),
        totalAmountMinor: z.number(),
      }),
    ),
  },
  discount: {
    create: errors.input(discountInput).output(resultId),
    get: errors.input(id).output(discountRecord),
    list: errors
      .input(directoryInput)
      .output(z.object({ items: z.array(discountRecord), total: z.number() })),
    update: errors
      .input(z.object({ data: discountInput, id: z.string() }))
      .output(resultId),
  },
  invoice: {
    cancel: errors.input(id).output(resultId),
    confirm: errors.input(id).output(resultId),
    get: errors.input(id).output(invoiceDetail),
    list: errors
      .input(directoryInput.extend({ status: invoiceFilter.optional() }))
      .output(z.object({ items: z.array(invoiceRow), total: z.number() })),
  },
  payment: {
    listForInvoice: errors
      .input(z.object({ invoiceId: z.string().min(1) }))
      .output(z.array(paymentRecord)),
    record: errors
      .input(
        z.object({
          amountMinor: z.number().int().positive(),
          invoiceId: z.string().min(1),
          note: z.string().max(1000).nullable(),
          paidAt: billingDate,
          paymentMethod: z.enum([
            'BANK_TRANSFER',
            'UPI',
            'CARD',
            'CASH',
            'OTHER',
          ]),
          reference: z.string().max(200).nullable(),
        }),
      )
      .output(resultId),
  },
  tax: {
    create: errors.input(taxInput).output(resultId),
    get: errors.input(id).output(taxRecord),
    list: errors
      .input(directoryInput)
      .output(z.object({ items: z.array(taxRecord), total: z.number() })),
    update: errors
      .input(z.object({ data: taxInput, id: z.string() }))
      .output(resultId),
  },
}
