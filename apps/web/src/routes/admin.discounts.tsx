import { createFileRoute } from '@tanstack/react-router'
import { DiscountsPage } from '../features/financial-configuration'

export const Route = createFileRoute('/admin/discounts')({
  component: DiscountsPage,
})
