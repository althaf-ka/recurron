import { createFileRoute } from '@tanstack/react-router'
import { ProductsPage } from '../features/products'

export const Route = createFileRoute('/admin/products')({
  component: ProductsPage,
})
