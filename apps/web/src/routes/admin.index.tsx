import { createFileRoute } from '@tanstack/react-router'
import { Overview } from '../components/shell'

export const Route = createFileRoute('/admin/')({
  component: () => <Overview area="admin" />,
})
