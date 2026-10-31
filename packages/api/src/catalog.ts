import { oc } from '@orpc/contract'
import { z } from 'zod'

export const directoryInput = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(''),
})
const procedure = oc.errors({
  BAD_REQUEST: { message: 'Invalid input' },
  CONFLICT: { message: 'Record conflicts with existing data' },
  FORBIDDEN: { message: 'Access denied' },
  INTERNAL_SERVER_ERROR: { message: 'Unable to complete request' },
  NOT_FOUND: { message: 'Record not found' },
  UNAUTHENTICATED: { message: 'Authentication required' },
})
const name = z.string().trim().min(1).max(200)
const minor = z.number().int()
export const variantInput = z.object({
  attributeName: name,
  isActive: z.boolean().default(true),
  price_delta_minor: minor,
  valueName: name,
})
export const productInput = z.object({
  costPriceMinor: minor.nonnegative(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/u),
  isActive: z.boolean(),
  name,
  notes: z.string().max(10_000).nullable(),
  productType: z.enum(['GOODS', 'SERVICE']),
  salesPriceMinor: minor.nonnegative(),
  variants: z.array(variantInput).max(100),
})
export const planInput = z
  .object({
    allowEarlyClose: z.boolean(),
    allowPause: z.boolean(),
    allowRenewal: z.boolean(),
    autoCloseOnExpiry: z.boolean(),
    availableFrom: z.iso.date().nullable(),
    availableUntil: z.iso.date().nullable(),
    billingFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    isActive: z.boolean(),
    minimumQuantity: z.number().int().min(1).max(2_147_483_647),
    name,
  })
  .refine(
    (value) =>
      value.availableFrom === null ||
      value.availableUntil === null ||
      value.availableUntil >= value.availableFrom,
    {
      message: 'Available until must be on or after available from',
      path: ['availableUntil'],
    },
  )
export const customerInput = z.object({
  billingAddress: z.string().max(4000).nullable(),
  companyName: z.string().max(200).nullable(),
  email: z.email().trim().toLowerCase(),
  name,
  phone: z.string().max(100).nullable(),
})
const id = z.object({ id: z.string().min(1) })
const productRecord = productInput.extend({
  id: z.string(),
  // Retained inactive variants can exceed a single edit's input limit.
  variants: z.array(variantInput),
})
const planRecord = planInput.safeExtend({ id: z.string() })
const customerRecord = customerInput.extend({ id: z.string() })
export const catalogContract = {
  customer: {
    create: procedure.input(customerInput).output(id),
    get: procedure.input(id).output(customerRecord),
    list: procedure
      .input(directoryInput)
      .output(z.object({ items: z.array(customerRecord), total: z.number() })),
    update: procedure
      .input(z.object({ data: customerInput, id: z.string() }))
      .output(id),
  },
  plan: {
    archive: procedure.input(id).output(id),
    create: procedure.input(planInput).output(id),
    get: procedure.input(id).output(planRecord),
    list: procedure
      .input(directoryInput)
      .output(z.object({ items: z.array(planRecord), total: z.number() })),
    update: procedure
      .input(z.object({ data: planInput, id: z.string() }))
      .output(id),
  },
  product: {
    archive: procedure.input(id).output(id),
    create: procedure.input(productInput).output(id),
    get: procedure.input(id).output(productRecord),
    list: procedure.input(directoryInput).output(
      z.object({
        items: z.array(productRecord.omit({ variants: true })),
        total: z.number(),
      }),
    ),
    update: procedure
      .input(z.object({ data: productInput, id: z.string() }))
      .output(id),
  },
}
