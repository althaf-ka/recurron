import { RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Brand = ({
  className,
  inverted = false,
  markOnly = false,
}: {
  className?: string
  inverted?: boolean
  markOnly?: boolean
}) => (
  <span className={cn('flex items-center gap-2.5', className)}>
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-[10px] shadow-sm',
        inverted
          ? 'bg-white text-neutral-950'
          : 'bg-foreground text-background',
      )}
    >
      <RefreshCwIcon aria-hidden="true" strokeWidth={2.4} />
    </span>
    {markOnly ? null : (
      <span className="text-[15px] font-semibold tracking-tight">recurron</span>
    )}
  </span>
)
