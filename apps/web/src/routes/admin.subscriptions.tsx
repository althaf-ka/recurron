import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionsPage } from '../features/subscriptions'

export const Route = createFileRoute('/admin/subscriptions')({
  component: SubscriptionsPage,
})
