import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm font-medium text-brand-600">Recurron</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Your starting point.</h1>
      <p className="mt-4 text-slate-600">Ready to build.</p>
    </main>
  )
}
