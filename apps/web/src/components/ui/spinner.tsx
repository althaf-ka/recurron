import { cn } from 'cn'
import { Loader2Icon } from 'lucide-react'

const Spinner = ({ className, ...props }: React.ComponentProps<'output'>) => (
  <output
    data-slot="spinner"
    aria-label="Loading"
    className={cn('inline-flex', className)}
    {...props}
  >
    <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
  </output>
)

export { Spinner }
