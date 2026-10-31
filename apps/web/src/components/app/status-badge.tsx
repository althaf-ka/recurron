import { Badge } from '@/components/ui/badge'

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'CLOSED'
  | 'CONFIRMED'
  | 'DRAFT'
  | 'PAUSED'
  | 'QUOTATION'

const labels: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  CONFIRMED: 'Confirmed',
  DRAFT: 'Draft',
  PAUSED: 'Paused',
  QUOTATION: 'Quotation',
}

const variants = {
  ACTIVE: 'success',
  CLOSED: 'outline',
  CONFIRMED: 'info',
  DRAFT: 'secondary',
  PAUSED: 'warning',
  QUOTATION: 'warning',
} as const

export const isSubscriptionStatus = (
  value: string,
): value is SubscriptionStatus => Object.hasOwn(labels, value)

export const SubscriptionStatusBadge = ({
  status,
}: {
  status: SubscriptionStatus
}) => (
  <Badge variant={variants[status]}>
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {labels[status]}
  </Badge>
)
