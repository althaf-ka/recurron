import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '../lib/access'
import { Shell } from '../components/shell'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    await requireSession({ customer: ['read'] })
  },
  component: () => <Shell area="app" />,
})
