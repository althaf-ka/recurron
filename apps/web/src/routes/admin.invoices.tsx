import { createFileRoute } from '@tanstack/react-router'
import { InvoicesPage } from '../features/finance'

export const Route = createFileRoute('/admin/invoices')({
  component: () => <InvoicesPage area="admin" />,
})
