import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarRange,
  Package,
  PlusIcon,
  ReceiptText,
  RefreshCwIcon,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { QueryError } from '@/components/app/query-error'
import { PageHeader } from '@/components/app/page-header'
import { StatCard } from '@/components/app/stat-card'
import { SubscriptionStatusBadge } from '@/components/app/status-badge'
import { TableSkeleton } from '@/components/app/table-skeleton'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAccess } from '../lib/access'
import type { apiClient } from '../lib/api'
import { orpc } from '../lib/api'
import { FinanceOverview } from './finance'

type SubscriptionList = Awaited<ReturnType<typeof apiClient.subscription.list>>
type SubscriptionSummary = SubscriptionList['items'][number]
type Root = '/admin' | '/app'

interface Stat {
  error: boolean
  icon: LucideIcon
  key: string
  label: string
  loading: boolean
  to: string
  value: number
}

const areaCopy = {
  admin: {
    description:
      'A live view of your catalog, plans, customers, and subscription pipeline.',
    eyebrow: 'Business control',
    title: 'Administration overview',
  },
  app: {
    description:
      'Find customers, review the catalog, and keep subscriptions moving.',
    eyebrow: 'Daily operations',
    title: 'Operations overview',
  },
} as const

const quickLinks = [
  {
    description: 'Search contact and billing details.',
    icon: Users,
    key: 'customers',
    label: 'Customer directory',
  },
  {
    description: 'Review goods, services, and variants.',
    icon: Package,
    key: 'products',
    label: 'Product catalog',
  },
  {
    description: 'Check intervals, policies, and availability.',
    icon: CalendarRange,
    key: 'plans',
    label: 'Subscription plans',
  },
  {
    description: 'Follow every subscription through its lifecycle.',
    icon: ReceiptText,
    key: 'subscriptions',
    label: 'Subscriptions',
  },
] as const

const SubscriptionTableHeader = () => (
  <TableHeader>
    <TableRow>
      <TableHead className="pl-5">Subscription</TableHead>
      <TableHead>Customer</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="pr-5 hidden sm:table-cell">Start</TableHead>
    </TableRow>
  </TableHeader>
)

const SubscriptionRow = ({ item }: { item: SubscriptionSummary }) => (
  <TableRow>
    <TableCell className="pl-5">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{item.subscriptionNumber}</span>
        <span className="text-xs text-muted-foreground">{item.planName}</span>
      </div>
    </TableCell>
    <TableCell>{item.customerName}</TableCell>
    <TableCell>
      <SubscriptionStatusBadge status={item.status} />
    </TableCell>
    <TableCell className="pr-5 hidden text-muted-foreground sm:table-cell">
      {item.startDate}
    </TableCell>
  </TableRow>
)

const EmptySubscriptions = ({
  canCreate,
  root,
}: {
  canCreate: boolean
  root: Root
}) => (
  <Empty className="border-0 py-12">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <ReceiptText />
      </EmptyMedia>
      <EmptyTitle>No subscriptions yet</EmptyTitle>
      <EmptyDescription>
        Create a draft to start tracking a customer subscription.
      </EmptyDescription>
    </EmptyHeader>
    {canCreate ? (
      <EmptyContent>
        <Button
          nativeButton={false}
          render={<Link to={`${root}/subscriptions`} />}
        >
          <PlusIcon data-icon="inline-start" />
          New subscription
        </Button>
      </EmptyContent>
    ) : null}
  </Empty>
)

const RecentSubscriptions = ({
  canCreate,
  query,
  root,
}: {
  canCreate: boolean
  query: UseQueryResult<SubscriptionList>
  root: Root
}) => {
  if (query.isPending) {
    return (
      <Table>
        <SubscriptionTableHeader />
        <TableSkeleton columns={4} />
      </Table>
    )
  }
  if (query.isError) {
    return (
      <div className="p-5">
        <QueryError
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      </div>
    )
  }
  if (query.data.items.length === 0) {
    return <EmptySubscriptions canCreate={canCreate} root={root} />
  }
  return (
    <Table>
      <SubscriptionTableHeader />
      <TableBody>
        {query.data.items.map((item) => (
          <SubscriptionRow item={item} key={item.id} />
        ))}
      </TableBody>
    </Table>
  )
}

const StatsGrid = ({ stats }: { stats: Stat[] }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {stats.map(({ error, icon, key, label, loading, to, value }) => (
      <StatCard
        error={error}
        footer={
          <Link
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            to={to}
          >
            View {label.toLowerCase()}
            <ArrowRightIcon className="size-3" />
          </Link>
        }
        icon={icon}
        key={key}
        label={label}
        loading={loading}
        value={value}
      />
    ))}
  </div>
)

const QuickActions = ({ root }: { root: Root }) => (
  <Card className="gap-0 py-0">
    <CardHeader className="border-b px-5 py-4">
      <CardTitle>Quick actions</CardTitle>
      <CardDescription>Jump to the work that matters now.</CardDescription>
    </CardHeader>
    <CardContent className="p-3">
      <ItemGroup>
        {quickLinks.map(({ description, icon: Icon, key, label }) => (
          <Link key={key} to={`${root}/${key}`}>
            <Item className="hover:bg-muted/60" size="sm" variant="default">
              <ItemMedia
                className="flex size-8 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
                variant="icon"
              >
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{label}</ItemTitle>
                <ItemDescription className="text-xs">
                  {description}
                </ItemDescription>
              </ItemContent>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="ml-auto size-3.5 shrink-0 text-muted-foreground"
              />
            </Item>
          </Link>
        ))}
      </ItemGroup>
    </CardContent>
  </Card>
)

export const OverviewPage = ({ area }: { area: 'admin' | 'app' }) => {
  const access = useAccess()
  const root = area === 'admin' ? '/admin' : '/app'
  const copy = areaCopy[area]
  const customers = useQuery(
    orpc.customer.list.queryOptions({
      input: { page: 1, pageSize: 1, search: '' },
    }),
  )
  const products = useQuery(
    orpc.product.list.queryOptions({
      input: { page: 1, pageSize: 1, search: '' },
    }),
  )
  const plans = useQuery(
    orpc.plan.list.queryOptions({
      input: { page: 1, pageSize: 1, search: '' },
    }),
  )
  const subscriptions = useQuery(
    orpc.subscription.list.queryOptions({
      input: { page: 1, pageSize: 5, search: '' },
    }),
  )

  const stats: Stat[] = [
    {
      error: customers.isError,
      icon: Users,
      key: 'customers',
      label: 'Customers',
      loading: customers.isPending,
      to: `${root}/customers`,
      value: customers.data?.total ?? 0,
    },
    {
      error: products.isError,
      icon: Package,
      key: 'products',
      label: 'Products',
      loading: products.isPending,
      to: `${root}/products`,
      value: products.data?.total ?? 0,
    },
    {
      error: plans.isError,
      icon: CalendarRange,
      key: 'plans',
      label: 'Plans',
      loading: plans.isPending,
      to: `${root}/plans`,
      value: plans.data?.total ?? 0,
    },
    {
      error: subscriptions.isError,
      icon: ReceiptText,
      key: 'subscriptions',
      label: 'Subscriptions',
      loading: subscriptions.isPending,
      to: `${root}/subscriptions`,
      value: subscriptions.data?.total ?? 0,
    },
  ]

  const refresh = () => {
    void Promise.all([
      customers.refetch(),
      products.refetch(),
      plans.refetch(),
      subscriptions.refetch(),
    ])
  }
  const refreshing =
    customers.isFetching ||
    products.isFetching ||
    plans.isFetching ||
    subscriptions.isFetching

  return (
    <div className="space-y-6">
      <FinanceOverview area={area} />
      <PageHeader
        actions={
          <>
            {access({ customer: ['create'] }) ? (
              <Button
                nativeButton={false}
                render={<Link to={`${root}/customers`} />}
                variant="outline"
              >
                <PlusIcon data-icon="inline-start" />
                Add customer
              </Button>
            ) : null}
            <Button disabled={refreshing} onClick={refresh} variant="outline">
              <RefreshCwIcon
                className={refreshing ? 'animate-spin' : undefined}
                data-icon="inline-start"
              />
              Refresh
            </Button>
          </>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      <StatsGrid stats={stats} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle>Recent subscriptions</CardTitle>
            <CardDescription>
              The latest records created in this workspace.
            </CardDescription>
            <CardAction>
              <Button
                nativeButton={false}
                render={<Link to={`${root}/subscriptions`} />}
                size="sm"
                variant="ghost"
              >
                View all
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <RecentSubscriptions
              canCreate={access({ subscription: ['create'] })}
              query={subscriptions}
              root={root}
            />
          </CardContent>
        </Card>

        <QuickActions root={root} />
      </div>
    </div>
  )
}
