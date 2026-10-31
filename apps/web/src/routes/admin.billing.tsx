import { createFileRoute } from '@tanstack/react-router'
import { BillingPage } from '../features/finance'

export const Route = createFileRoute('/admin/billing')({
  component: () => <BillingPage />,
})
