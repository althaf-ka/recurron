import { CircleAlertIcon, RefreshCwIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const QueryError = ({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) => (
  <Alert variant="destructive">
    <CircleAlertIcon />
    <AlertTitle>Unable to load this data</AlertTitle>
    <AlertDescription>
      <p>
        {error instanceof Error
          ? error.message
          : 'Something went wrong while loading this section.'}
      </p>
      {onRetry === undefined ? null : (
        <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
          <RefreshCwIcon data-icon="inline-start" />
          Try again
        </Button>
      )}
    </AlertDescription>
  </Alert>
)
