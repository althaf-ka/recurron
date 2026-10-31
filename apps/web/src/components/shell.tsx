import {
  CalendarRange,
  LayoutDashboard,
  Package,
  ReceiptText,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link, Navigate, Outlet, useRouterState } from '@tanstack/react-router'
import { Brand } from '@/components/app/brand'
import { ModeToggle } from '@/components/app/mode-toggle'
import { QueryError } from '@/components/app/query-error'
import { UserMenu } from '@/components/app/user-menu'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { can, homeFor } from '../lib/access'
import { authClient } from '../lib/auth'
import { useLogout } from '../lib/use-logout'
import { Feedback } from './shared'

const navigation = [
  { icon: LayoutDashboard, key: 'overview', label: 'Overview' },
  { icon: Package, key: 'products', label: 'Products' },
  { icon: CalendarRange, key: 'plans', label: 'Plans' },
  { icon: Users, key: 'customers', label: 'Customers' },
  { icon: ReceiptText, key: 'subscriptions', label: 'Subscriptions' },
] as const

const pageLabels: Record<string, string> = {
  customers: 'Customers',
  overview: 'Overview',
  plans: 'Plans',
  products: 'Products',
  subscriptions: 'Subscriptions',
}

export const Logout = () => {
  const logout = useLogout()
  return (
    <div className="space-y-3">
      <Button
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate()
        }}
        variant="outline"
      >
        {logout.isPending ? 'Signing out…' : 'Log out'}
      </Button>
      <Feedback error={logout.error} />
    </div>
  )
}

const SessionError = () => (
  <main className="flex min-h-svh items-center justify-center p-6">
    <Card className="w-full max-w-md">
      <CardContent className="space-y-5">
        <Brand />
        <QueryError
          error={
            new Error('Unable to check your session. Reload to try again.')
          }
        />
        <Logout />
      </CardContent>
    </Card>
  </main>
)

export const Shell = ({ area }: { area: 'admin' | 'app' }) => {
  const session = authClient.useSession()
  const logout = useLogout()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (session.isPending) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Brand />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          <span>Loading your workspace…</span>
        </div>
      </div>
    )
  }
  if (session.error) {
    return <SessionError />
  }
  if (!session.data) {
    return <Navigate replace to="/login" />
  }

  const permissions =
    area === 'admin'
      ? { product: ['create' as const] }
      : { customer: ['read' as const] }
  if (!can(session.data.user.role, permissions)) {
    return <Navigate replace to={homeFor(session.data.user.role)} />
  }

  const root = area === 'admin' ? '/admin' : '/app'
  const areaLabel = area === 'admin' ? 'Administration' : 'Staff workspace'
  const currentKey =
    pathname === root || pathname === `${root}/`
      ? 'overview'
      : (pathname.slice(root.length + 1).split('/')[0] ?? 'overview')
  const pageLabel = pageLabels[currentKey] ?? 'Overview'

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="p-2">
          <Link
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            to={root}
          >
            <Brand markOnly />
            <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold tracking-tight">
                recurron
              </span>
              <span className="truncate text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {areaLabel}
              </span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map(({ icon: Icon, key, label }) => {
                  const readOnly =
                    area === 'app' && (key === 'products' || key === 'plans')
                  const to = key === 'overview' ? root : `${root}/${key}`
                  return (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton
                        isActive={currentKey === key}
                        render={<Link to={to} />}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                        {readOnly ? (
                          <SidebarMenuBadge className="text-[10px] font-normal text-muted-foreground">
                            Read only
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <UserMenu
            email={session.data.user.email}
            name={session.data.user.name ?? 'Account'}
            onSignOut={() => {
              logout.mutate(undefined, {
                onError: (error) => {
                  toast.error(error.message)
                },
              })
            }}
            role={session.data.user.role}
            signingOut={logout.isPending}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-svh overflow-x-clip">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-1 h-4" orientation="vertical" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink render={<Link to={root} />}>
                  {areaLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <Badge className="hidden sm:inline-flex" variant="outline">
              {area === 'admin' ? 'Admin' : 'Staff'}
            </Badge>
            <ModeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
