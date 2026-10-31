import { ArrowLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export const PageHeader = ({
  actions,
  back,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode
  back?: { label: string; onClick: () => void }
  description?: string
  eyebrow?: string
  title: string
}) => (
  <div className="flex flex-col gap-4">
    {back === undefined ? null : (
      <div>
        <Button
          className="-ml-2 text-muted-foreground"
          onClick={() => {
            back.onClick()
          }}
          size="sm"
          variant="ghost"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {back.label}
        </Button>
      </div>
    )}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {eyebrow === undefined ? null : (
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-[1.75rem]">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  </div>
)
