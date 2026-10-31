import { subscriptionInput } from '@recurron/api/subscription'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, PlusIcon, ReceiptText } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormActions, FormSection } from '@/components/app/editor'
import { PageHeader } from '@/components/app/page-header'
import { QueryError } from '@/components/app/query-error'
import {
  isSubscriptionStatus,
  SubscriptionStatusBadge,
} from '@/components/app/status-badge'
import type { SubscriptionStatus } from '@/components/app/status-badge'
import { TableSkeleton } from '@/components/app/table-skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Feedback, Field, Pagination, Search } from '../components/shared'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import { displayDay } from '../lib/format'
import { fieldAttributes, fieldErrors, optionalText, text } from '../lib/forms'

type SubscriptionSummary = Awaited<
  ReturnType<typeof apiClient.subscription.list>
>['items'][number]
type SubscriptionInput = ReturnType<typeof subscriptionInput.parse>
type LifecycleOperation =
  | 'activate'
  | 'close'
  | 'confirm'
  | 'createQuotation'
  | 'pause'
  | 'renew'
  | 'resume'

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  CONFIRMED: 'Confirmed',
  DRAFT: 'Draft',
  PAUSED: 'Paused',
  QUOTATION: 'Quotation',
}
const statusItems = { ALL: 'All statuses', ...statusLabels } as const
const currentDate = new Date().toISOString().slice(0, 10)

const getActiveActions = (
  item: SubscriptionSummary,
  access: ReturnType<typeof useAccess>,
) => {
  const actions: { label: string; operation: LifecycleOperation }[] = []
  const canCloseEarly =
    item.allowEarlyClose ||
    (item.expiryDate !== null && item.expiryDate < currentDate)
  if (item.allowPause && access({ subscription: ['pause'] })) {
    actions.push({ label: 'Pause', operation: 'pause' })
  }
  if (canCloseEarly && access({ subscription: ['close'] })) {
    actions.push({ label: 'Close', operation: 'close' })
  }
  if (item.allowRenewal && access({ subscription: ['renew'] })) {
    actions.push({ label: 'Renew', operation: 'renew' })
  }
  return actions
}

const getSubscriptionActions = (
  item: SubscriptionSummary,
  access: ReturnType<typeof useAccess>,
) => {
  if (item.status === 'CLOSED') {
    return []
  }
  switch (item.status) {
    case 'DRAFT': {
      return access({ subscription: ['quote'] })
        ? [{ label: 'Create quotation', operation: 'createQuotation' as const }]
        : []
    }
    case 'QUOTATION': {
      return access({ subscription: ['confirm'] })
        ? [{ label: 'Confirm', operation: 'confirm' as const }]
        : []
    }
    case 'CONFIRMED': {
      return access({ subscription: ['activate'] })
        ? [{ label: 'Activate', operation: 'activate' as const }]
        : []
    }
    case 'ACTIVE': {
      return getActiveActions(item, access)
    }
    case 'PAUSED': {
      const actions: { label: string; operation: LifecycleOperation }[] = []
      const canCloseEarly =
        item.allowEarlyClose ||
        (item.expiryDate !== null && item.expiryDate < currentDate)
      if (canCloseEarly && access({ subscription: ['close'] })) {
        actions.push({ label: 'Close', operation: 'close' })
      }
      if (access({ subscription: ['activate'] })) {
        actions.push({ label: 'Resume', operation: 'resume' })
      }
      return actions
    }
    default: {
      return []
    }
  }
}

const SubscriptionActions = ({
  access,
  item,
  onAction,
  pending,
}: {
  access: ReturnType<typeof useAccess>
  item: SubscriptionSummary
  onAction: (id: string, operation: LifecycleOperation) => void
  pending: boolean
}) => {
  const actions = getSubscriptionActions(item, access)
  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button disabled={pending} size="sm" variant="ghost" />}
      >
        Manage
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Lifecycle</DropdownMenuLabel>
        {actions.map(({ label, operation }) => (
          <DropdownMenuItem
            disabled={pending}
            key={operation}
            onClick={() => {
              onAction(item.id, operation)
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const SubscriptionForm = ({
  onCancel,
  onDone,
}: {
  onCancel: () => void
  onDone: (message: string) => void
}) => {
  const client = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const customers = useQuery(
    orpc.customer.list.queryOptions({ input: { page: 1, search: '' } }),
  )
  const plans = useQuery(
    orpc.plan.list.queryOptions({ input: { page: 1, search: '' } }),
  )
  const products = useQuery(
    orpc.product.list.queryOptions({ input: { page: 1, search: '' } }),
  )
  const mutation = useMutation({
    mutationFn: async (data: SubscriptionInput) =>
      await apiClient.subscription.create(data),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.subscription.key() })
      onDone('Subscription draft created.')
    },
  })
  const lookupsPending =
    customers.isPending || plans.isPending || products.isPending
  const lookupsError = customers.error ?? plans.error ?? products.error
  const customerOptions = customers.data?.items ?? []
  const planOptions = (plans.data?.items ?? []).filter((plan) => plan.isActive)
  const productOptions = (products.data?.items ?? []).filter(
    (product) => product.isActive,
  )

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (mutation.isPending || lookupsPending) {
          return
        }
        const form = new FormData(event.currentTarget)
        const result = subscriptionInput.safeParse({
          customerId: text(form, 'customerId'),
          expiryDate: optionalText(form, 'expiryDate'),
          lines: [
            {
              description: text(form, 'description'),
              productId: text(form, 'productId'),
              productVariantId: null,
              quantity: Number(text(form, 'quantity')),
              unitPriceMinor: Number(text(form, 'unitPriceMinor')),
            },
          ],
          paymentTermDays: Number(text(form, 'paymentTermDays')),
          startDate: text(form, 'startDate'),
          subscriptionPlanId: text(form, 'subscriptionPlanId'),
        })
        setErrors(result.success ? {} : fieldErrors(result.error.issues))
        if (result.success) {
          mutation.mutate(result.data)
        }
      }}
    >
      <fieldset
        className="contents"
        disabled={mutation.isPending || lookupsPending}
      >
        {lookupsError ? <Feedback error={lookupsError} /> : null}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <FormSection
              description="Choose who the subscription is for and which plan applies."
              title="Parties and plan"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field errors={errors} label="Customer" name="customerId">
                  <Select
                    items={customerOptions.map((customer) => ({
                      label: customer.name,
                      value: customer.id,
                    }))}
                    name="customerId"
                  >
                    <SelectTrigger
                      {...fieldAttributes(errors, 'customerId')}
                      className="w-full"
                    >
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerOptions.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field errors={errors} label="Plan" name="subscriptionPlanId">
                  <Select
                    items={planOptions.map((plan) => ({
                      label: `${plan.name} · ${plan.billingFrequency.toLowerCase()}`,
                      value: plan.id,
                    }))}
                    name="subscriptionPlanId"
                  >
                    <SelectTrigger
                      {...fieldAttributes(errors, 'subscriptionPlanId')}
                      className="w-full"
                    >
                      <SelectValue placeholder="Choose a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {planOptions.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} · {plan.billingFrequency.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field errors={errors} label="Product" name="productId">
                  <Select
                    items={productOptions.map((product) => ({
                      label: product.name,
                      value: product.id,
                    }))}
                    name="productId"
                  >
                    <SelectTrigger
                      {...fieldAttributes(errors, 'productId')}
                      className="w-full"
                    >
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormSection>

            <FormSection
              description="The draft starts with a single product line."
              title="Line item"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  errors={errors}
                  label="Line description"
                  name="description"
                >
                  <Input
                    {...fieldAttributes(errors, 'description')}
                    defaultValue=""
                    maxLength={500}
                    name="description"
                    required
                  />
                </Field>
                <Field errors={errors} label="Quantity" name="quantity">
                  <Input
                    {...fieldAttributes(errors, 'quantity')}
                    defaultValue={1}
                    min={1}
                    name="quantity"
                    required
                    step={1}
                    type="number"
                  />
                </Field>
                <Field
                  description="Enter the amount in the smallest currency unit."
                  errors={errors}
                  label="Unit price (minor units)"
                  name="unitPriceMinor"
                >
                  <Input
                    {...fieldAttributes(errors, 'unitPriceMinor')}
                    defaultValue={0}
                    min={0}
                    name="unitPriceMinor"
                    required
                    step={1}
                    type="number"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              description="Set the billing window and payment terms."
              title="Schedule"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field errors={errors} label="Start date" name="startDate">
                  <Input
                    {...fieldAttributes(errors, 'startDate')}
                    defaultValue={currentDate}
                    name="startDate"
                    required
                    type="date"
                  />
                </Field>
                <Field errors={errors} label="Expiry date" name="expiryDate">
                  <Input
                    {...fieldAttributes(errors, 'expiryDate')}
                    defaultValue=""
                    name="expiryDate"
                    type="date"
                  />
                </Field>
                <Field
                  errors={errors}
                  label="Payment terms (days)"
                  name="paymentTermDays"
                >
                  <Input
                    {...fieldAttributes(errors, 'paymentTermDays')}
                    defaultValue={0}
                    max={3650}
                    min={0}
                    name="paymentTermDays"
                    required
                    step={1}
                    type="number"
                  />
                </Field>
              </div>
            </FormSection>
          </div>

          <div className="space-y-6">
            <FormSection
              description="A draft does not bill the customer yet."
              title="What happens next"
            >
              <ol className="space-y-3 text-sm text-muted-foreground">
                {[
                  'Create the draft with the customer, plan, and line item.',
                  'Create a quotation, then confirm it.',
                  'Activate the subscription to begin billing.',
                ].map((step, index) => (
                  <li className="flex gap-3" key={step}>
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </FormSection>
            {lookupsPending ? (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Loading customers, plans, and products…
              </div>
            ) : null}
          </div>
        </div>

        <FormActions>
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={lookupsError !== undefined && lookupsError !== null}
            type="submit"
          >
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            {mutation.isPending ? 'Saving…' : 'Create draft'}
          </Button>
        </FormActions>
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const runLifecycle = async (id: string, operation: LifecycleOperation) => {
  switch (operation) {
    case 'activate': {
      return await apiClient.subscription.activate({ id })
    }
    case 'close': {
      return await apiClient.subscription.close({ id })
    }
    case 'confirm': {
      return await apiClient.subscription.confirm({ id })
    }
    case 'createQuotation': {
      return await apiClient.subscription.createQuotation({ id })
    }
    case 'pause': {
      return await apiClient.subscription.pause({ id })
    }
    case 'renew': {
      return await apiClient.subscription.renew({ id })
    }
    case 'resume': {
      return await apiClient.subscription.resume({ id })
    }
    default: {
      throw new Error('Unsupported subscription lifecycle operation')
    }
  }
}

export const SubscriptionsPage = () => {
  const access = useAccess()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SubscriptionStatus | ''>('')
  const [creating, setCreating] = useState(false)
  const query = useQuery(
    orpc.subscription.list.queryOptions({
      input: { page, search, ...(status === '' ? {} : { status }) },
    }),
  )
  const lifecycle = useMutation({
    mutationFn: async ({
      id,
      operation,
    }: {
      id: string
      operation: LifecycleOperation
    }) => await runLifecycle(id, operation),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.subscription.key() })
      toast.success('Subscription updated.')
    },
  })
  const canCreate = access({ subscription: ['create'] })
  const setStatusFilter = (value: string | null) => {
    setStatus(
      value === null || value === 'ALL' || !isSubscriptionStatus(value)
        ? ''
        : value,
    )
    setPage(1)
  }

  if (creating) {
    return (
      <div className="space-y-6">
        <PageHeader
          back={{
            label: 'Back to subscriptions',
            onClick: () => {
              setCreating(false)
            },
          }}
          description="Create a draft with one product line, then move it through the lifecycle."
          eyebrow="Subscriptions"
          title="New subscription"
        />
        <SubscriptionForm
          onCancel={() => {
            setCreating(false)
          }}
          onDone={(notice) => {
            setCreating(false)
            toast.success(notice)
          }}
        />
      </div>
    )
  }

  let content: ReactNode
  if (query.isPending) {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Subscription</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableSkeleton columns={5} />
      </Table>
    )
  } else if (query.isError) {
    content = (
      <div className="p-5">
        <QueryError
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      </div>
    )
  } else if (query.data.items.length === 0) {
    content = (
      <Empty className="border-0 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ReceiptText />
          </EmptyMedia>
          <EmptyTitle>
            {search === '' && status === ''
              ? 'No subscriptions yet'
              : 'No matching subscriptions'}
          </EmptyTitle>
          <EmptyDescription>
            {search === '' && status === ''
              ? 'Create a draft to begin tracking a customer subscription.'
              : 'Try a different search or status filter.'}
          </EmptyDescription>
        </EmptyHeader>
        {search === '' && status === '' && canCreate ? (
          <EmptyContent>
            <Button
              onClick={() => {
                setCreating(true)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              New subscription
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    )
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Subscription</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="pl-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{item.subscriptionNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.planName}
                  </span>
                </div>
              </TableCell>
              <TableCell>{item.customerName}</TableCell>
              <TableCell className="text-muted-foreground">
                {displayDay(item.startDate)}
                {' → '}
                {item.expiryDate === null
                  ? 'No expiry'
                  : displayDay(item.expiryDate)}
              </TableCell>
              <TableCell>
                <SubscriptionStatusBadge status={item.status} />
              </TableCell>
              <TableCell className="pr-5 text-right">
                <SubscriptionActions
                  access={access}
                  item={item}
                  onAction={(id, operation) => {
                    lifecycle.mutate({ id, operation })
                  }}
                  pending={lifecycle.isPending}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setCreating(true)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              New subscription
            </Button>
          ) : undefined
        }
        description="Create drafts and move subscriptions through their lifecycle."
        eyebrow="Billing"
        title="Subscriptions"
      />
      <Feedback error={lifecycle.error} />
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Search
              label="Search subscriptions"
              onSearch={(value) => {
                setSearch(value)
                setPage(1)
              }}
              value={search}
            />
            <Select
              items={statusItems}
              onValueChange={setStatusFilter}
              value={status === '' ? 'ALL' : status}
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="w-full sm:w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {query.data === undefined
              ? 'Loading subscriptions…'
              : `${query.data.total} ${query.data.total === 1 ? 'subscription' : 'subscriptions'}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">{content}</CardContent>
        {query.data !== undefined && query.data.items.length > 0 ? (
          <Pagination
            busy={query.isFetching}
            onPage={setPage}
            page={page}
            total={query.data.total}
          />
        ) : null}
      </Card>
    </div>
  )
}
