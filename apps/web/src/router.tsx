import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { routeTree } from './routeTree.gen'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

export const router = createRouter({
  routeTree,
  defaultPendingMs: 0,
  defaultPendingMinMs: 0,
  defaultPendingComponent: () => (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Spinner className="size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading your workspace…</p>
    </div>
  ),
  context: { queryClient },
  defaultPreload: false,
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
