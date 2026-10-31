import { createFileRoute } from '@tanstack/react-router'
import { InvoicesPage } from '../features/finance'

export const Route = createFileRoute('/app/invoices')({
  component: () => <InvoicesPage area="app" />,
})
