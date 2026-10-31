import { createFileRoute } from '@tanstack/react-router'
import { CustomersPage } from '../features/customers'

export const Route = createFileRoute('/app/customers')({
  component: CustomersPage,
})
