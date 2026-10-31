import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const StatCard = ({
  className,
  error = false,
  footer,
  icon: Icon,
  label,
  loading = false,
  value,
}: {
  className?: string
  error?: boolean
  footer?: ReactNode
  icon: LucideIcon
  label: string
  loading?: boolean
  value: number
}) => (
  <Card className={cn('gap-0 py-0', className)}>
    <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 pb-1">
      <div className="space-y-1.5">
        <CardDescription className="text-xs font-medium tracking-wide uppercase">
          {label}
        </CardDescription>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-[1.65rem] leading-none font-semibold tracking-tight tabular-nums">
            {error ? '—' : value.toLocaleString('en-IN')}
          </p>
        )}
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
    </CardHeader>
    <CardContent className="px-5 pt-3 pb-4">
      {error ? (
        <p className="text-xs text-destructive">Could not load this total.</p>
      ) : (
        footer
      )}
    </CardContent>
  </Card>
)
