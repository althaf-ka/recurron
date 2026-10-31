import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '../lib/access'
import { Shell } from '../components/shell'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    await requireSession({ product: ['create'] })
  },
  component: () => <Shell area="admin" />,
})
