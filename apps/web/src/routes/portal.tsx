import { createFileRoute } from '@tanstack/react-router'
import { ShieldCheckIcon } from 'lucide-react'
import { Brand } from '@/components/app/brand'
import { ModeToggle } from '@/components/app/mode-toggle'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Logout } from '../components/shell'
import { requireSession } from '../lib/access'

const Portal = () => (
  <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6">
    <div className="absolute top-4 right-4">
      <ModeToggle />
    </div>
    <Card className="w-full max-w-md">
      <CardHeader className="gap-4 border-b">
        <Brand />
        <div className="space-y-1.5">
          <Badge className="w-fit" variant="outline">
            Customer portal
          </Badge>
          <h1 className="text-xl font-semibold tracking-tight">
            You’re signed in
          </h1>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
            <ShieldCheckIcon aria-hidden="true" className="size-4" />
          </span>
          <p className="leading-relaxed text-muted-foreground">
            The customer portal is not available yet. Your account does not
            provide access to the internal workspace.
          </p>
        </div>
        <Logout />
      </CardContent>
    </Card>
  </main>
)

export const Route = createFileRoute('/portal')({
  beforeLoad: async () => {
    await requireSession()
  },
  component: Portal,
})
