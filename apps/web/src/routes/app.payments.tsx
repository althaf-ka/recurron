import { createFileRoute } from '@tanstack/react-router'
import { PaymentsPage } from '../features/finance'

export const Route = createFileRoute('/app/payments')({
  component: () => <PaymentsPage area="app" />,
})
