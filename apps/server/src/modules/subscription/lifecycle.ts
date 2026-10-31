import { ORPCError } from '@orpc/server'

export { advanceBillingDate } from '@recurron/api/billing-date'

export const transitionError = () =>
  new ORPCError('BAD_REQUEST', { message: 'Invalid subscription transition' })

export const ensureTransition = (status: string, next: string) => {
  const allowed: Record<string, string[]> = {
    ACTIVE: ['CLOSED', 'PAUSED'],
    CONFIRMED: ['ACTIVE'],
    DRAFT: ['QUOTATION'],
    PAUSED: ['ACTIVE', 'CLOSED'],
    QUOTATION: ['CONFIRMED'],
  }
  if (allowed[status]?.includes(next) !== true) {
    throw transitionError()
  }
}

export const initialBillingDate = (startDate: string) => startDate
