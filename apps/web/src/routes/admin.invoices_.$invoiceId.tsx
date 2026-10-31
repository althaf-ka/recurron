import { createFileRoute } from '@tanstack/react-router'
import { InvoicePage } from '../features/finance'

const Detail = () => {
  const { invoiceId } = Route.useParams()
  return <InvoicePage id={invoiceId} />
}

export const Route = createFileRoute('/admin/invoices_/$invoiceId')({
  component: Detail,
})
