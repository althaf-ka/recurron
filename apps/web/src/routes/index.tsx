import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { orpc } from '../lib/api'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const ping = useQuery(orpc.system.ping.queryOptions())

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm font-medium text-brand-600">Recurron</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Your starting point.
      </h1>
      <p className="mt-4 text-slate-600">
        API status:{' '}
        {ping.isPending
          ? 'Connecting…'
          : ping.isError
            ? 'Unavailable'
            : ping.data.message}
      </p>
    </main>
  )
}
