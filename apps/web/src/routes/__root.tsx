import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => <main className="p-8">Page not found. <Link to="/">Go home</Link></main>,
  errorComponent: () => <main className="p-8">Something went wrong. Please reload the page.</main>,
})
