import { createFileRoute } from '@tanstack/react-router'
import { PaymentsPage } from '../features/finance'

export const Route = createFileRoute('/admin/payments')({
  component: () => <PaymentsPage area="admin" />,
})
