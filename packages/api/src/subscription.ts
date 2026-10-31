import { oc } from '@orpc/contract'
import { z } from 'zod'
import { directoryInput } from './catalog'

const errors = oc.errors({
  BAD_REQUEST: { message: 'Invalid subscription request' },
  CONFLICT: { message: 'Subscription conflicts with current data' },
  FORBIDDEN: { message: 'Access denied' },
  INTERNAL_SERVER_ERROR: { message: 'Unable to complete request' },
  NOT_FOUND: { message: 'Record not found' },
  UNAUTHENTICATED: { message: 'Authentication required' },
})
const lineInput = z.object({
  description: z.string().trim().min(1).max(500),
  productId: z.string().min(1),
  productVariantId: z.string().min(1).nullable(),
  quantity: z.number().int().min(1),
  unitPriceMinor: z.number().int().nonnegative(),
})
export const subscriptionInput = z.object({
  customerId: z.string().min(1),
  expiryDate: z.iso.date().nullable(),
  lines: z.array(lineInput).min(1).max(100),
  paymentTermDays: z.number().int().min(0).max(3650),
  startDate: z.iso.date(),
  subscriptionPlanId: z.string().min(1),
})
const id = z.object({ id: z.string().min(1) })
const resultId = z.object({ id: z.string() })
const templateLine = lineInput.extend({ id: z.string() })
const templateInput = z.object({
  lines: z.array(lineInput).min(1).max(100),
  name: z.string().trim().min(1).max(200),
  subscriptionPlanId: z.string().min(1),
  validityDays: z.number().int().min(1).max(3650),
})
const templateRecord = templateInput.extend({
  id: z.string(),
  isActive: z.boolean(),
})
const subscriptionRecord = z.object({
  activatedAt: z.date().nullable(),
  allowEarlyClose: z.boolean(),
  allowPause: z.boolean(),
  allowRenewal: z.boolean(),
  billingFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  closedAt: z.date().nullable(),
  customerId: z.string(),
  customerName: z.string(),
  expiryDate: z.iso.date().nullable(),
  id: z.string(),
  lines: z.array(templateLine),
  nextBillingDate: z.iso.date().nullable(),
  paymentTermDays: z.number(),
  planName: z.string(),
  quotationValidUntil: z.iso.date().nullable(),
  startDate: z.iso.date(),
  status: z.enum([
    'DRAFT',
    'QUOTATION',
    'CONFIRMED',
    'ACTIVE',
    'PAUSED',
    'CLOSED',
  ]),
  subscriptionNumber: z.string(),
  subscriptionPlanId: z.string(),
})
export const subscriptionContract = {
  quotationTemplate: {
    archive: errors.input(id).output(resultId),
    create: errors.input(templateInput).output(resultId),
    get: errors.input(id).output(templateRecord),
    list: errors
      .input(directoryInput)
      .output(z.object({ items: z.array(templateRecord), total: z.number() })),
    update: errors.input(id.extend({ data: templateInput })).output(resultId),
  },
  subscription: {
    activate: errors.input(id).output(resultId),
    close: errors.input(id).output(resultId),
    confirm: errors.input(id).output(resultId),
    create: errors
      .input(
        subscriptionInput.extend({
          quotationTemplateId: z.string().nullable().optional(),
        }),
      )
      .output(resultId),
    createQuotation: errors.input(id).output(resultId),
    get: errors.input(id).output(subscriptionRecord),
    list: errors
      .input(
        directoryInput.extend({
          status: z
            .enum([
              'DRAFT',
              'QUOTATION',
              'CONFIRMED',
              'ACTIVE',
              'PAUSED',
              'CLOSED',
            ])
            .optional(),
        }),
      )
      .output(
        z.object({ items: z.array(subscriptionRecord), total: z.number() }),
      ),
    pause: errors.input(id).output(resultId),
    renew: errors.input(id).output(resultId),
    resume: errors.input(id).output(resultId),
    updateDraft: errors
      .input(id.extend({ data: subscriptionInput }))
      .output(resultId),
  },
}
