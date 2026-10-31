import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { orpc } from '../lib/api'

const Home = () => {
  const ping = useQuery(orpc.system.ping.queryOptions())
  let status: string
  if (ping.isPending) {
    status = 'Connecting…'
  } else if (ping.isError) {
    status = 'Unavailable'
  } else {
    status = ping.data.message
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm font-medium text-brand-600">Recurron</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Your starting point.
      </h1>
      <p className="mt-4 text-slate-600">API status: {status}</p>
    </main>
  )
}

export const Route = createFileRoute('/')({
  component: Home,
})
