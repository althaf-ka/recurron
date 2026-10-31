import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from '@tanstack/react-router'
import { CompassIcon, TriangleAlertIcon } from 'lucide-react'
import { Brand } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

const NotFound = () => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
    <Brand />
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CompassIcon />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>
          The page you are looking for does not exist or may have moved.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Go to your workspace
        </Button>
      </EmptyContent>
    </Empty>
  </main>
)

const RootError = ({ error, reset }: { error: unknown; reset: () => void }) => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
    <Brand />
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          {error instanceof Error && error.message
            ? error.message
            : 'The page could not be loaded. Please try again.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button
            onClick={() => {
              window.location.reload()
            }}
            variant="outline"
          >
            Reload page
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  </main>
)

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: Outlet,
    notFoundComponent: NotFound,
    errorComponent: ({ error, reset }) => (
      <RootError error={error} reset={reset} />
    ),
  },
)
