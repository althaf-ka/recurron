import { LockIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const FormSection = ({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  description?: string
  title: string
}) => (
  <Card className="gap-0 py-0">
    <CardHeader className="flex flex-row items-start justify-between gap-3 border-b px-5 py-4">
      <div className="space-y-1">
        <CardTitle>{title}</CardTitle>
        {description === undefined ? null : (
          <CardDescription>{description}</CardDescription>
        )}
      </div>
      {action}
    </CardHeader>
    <CardContent className="p-5">{children}</CardContent>
  </Card>
)

export const FormActions = ({ children }: { children: ReactNode }) => (
  <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-2 rounded-xl border bg-background/90 p-3 shadow-sm backdrop-blur sm:flex-row sm:justify-end">
    {children}
  </div>
)

export const ReadOnlyNote = () => (
  <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
      <LockIcon aria-hidden="true" className="size-4" />
    </span>
    <div className="space-y-0.5">
      <p className="font-medium">View only</p>
      <p className="text-muted-foreground">
        Your role can review this record but not change it.
      </p>
    </div>
  </div>
)
