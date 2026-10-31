import { createFileRoute } from '@tanstack/react-router'
import { PlansPage } from '../features/plans'

export const Route = createFileRoute('/app/plans')({
  component: () => <PlansPage readOnly />,
})
