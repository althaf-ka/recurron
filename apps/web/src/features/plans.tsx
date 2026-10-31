import { planInput } from '@recurron/api/catalog'
import type { UseQueryResult } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, EyeIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormActions, FormSection, ReadOnlyNote } from '@/components/app/editor'
import { PageHeader } from '@/components/app/page-header'
import { QueryError } from '@/components/app/query-error'
import { TableSkeleton } from '@/components/app/table-skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import {
  Check,
  ConfirmArchive,
  editorTitle,
  Feedback,
  Field,
  Pagination,
  Search,
  Status,
} from '../components/shared'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import { displayDay } from '../lib/format'
import {
  checked,
  fieldAttributes,
  fieldErrors,
  optionalText,
  text,
} from '../lib/forms'

type Plan = Awaited<ReturnType<typeof apiClient.plan.get>>
type PlanInput = ReturnType<typeof planInput.parse>
type PlanList = Awaited<ReturnType<typeof apiClient.plan.list>>
type PlanSummary = PlanList['items'][number]

const intervals = {
  DAILY: 'Daily',
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  YEARLY: 'Yearly',
} as const

const PlanForm = ({
  record,
  readOnly,
  onCancel,
  onDone,
}: {
  onCancel: () => void
  onDone: (message: string) => void
  readOnly: boolean
  record?: Plan
}) => {
  const values = record ?? {
    allowEarlyClose: true,
    allowPause: true,
    allowRenewal: true,
    autoCloseOnExpiry: true,
    availableFrom: '',
    availableUntil: '',
    billingFrequency: 'MONTHLY',
    isActive: true,
    minimumQuantity: 1,
    name: '',
  }
  const client = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: async (data: PlanInput) =>
      record === undefined
        ? await apiClient.plan.create(data)
        : await apiClient.plan.update({ data, id: record.id }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.plan.key() })
      onDone(record === undefined ? 'Plan created.' : 'Plan updated.')
    },
  })
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (readOnly || mutation.isPending) {
          return
        }
        const form = new FormData(event.currentTarget)
        const result = planInput.safeParse({
          allowEarlyClose: checked(form, 'allowEarlyClose'),
          allowPause: checked(form, 'allowPause'),
          allowRenewal: checked(form, 'allowRenewal'),
          autoCloseOnExpiry: checked(form, 'autoCloseOnExpiry'),
          availableFrom: optionalText(form, 'availableFrom'),
          availableUntil: optionalText(form, 'availableUntil'),
          billingFrequency: text(form, 'billingFrequency'),
          isActive: checked(form, 'isActive'),
          minimumQuantity: Number(text(form, 'minimumQuantity')),
          name: text(form, 'name'),
        })
        setErrors(result.success ? {} : fieldErrors(result.error.issues))
        if (result.success) {
          mutation.mutate(result.data)
        }
      }}
    >
      <fieldset className="contents" disabled={readOnly || mutation.isPending}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <FormSection
              description="The billing rhythm and minimum commitment for this plan."
              title="Plan details"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field errors={errors} label="Plan name" name="name">
                  <Input
                    {...fieldAttributes(errors, 'name')}
                    autoComplete="off"
                    defaultValue={values.name}
                    maxLength={200}
                    name="name"
                    required
                  />
                </Field>
                <Field
                  errors={errors}
                  label="Billing interval"
                  name="billingFrequency"
                >
                  <Select
                    defaultValue={values.billingFrequency}
                    items={intervals}
                    name="billingFrequency"
                  >
                    <SelectTrigger
                      {...fieldAttributes(errors, 'billingFrequency')}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(intervals).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  errors={errors}
                  label="Minimum quantity"
                  name="minimumQuantity"
                >
                  <Input
                    {...fieldAttributes(errors, 'minimumQuantity')}
                    defaultValue={values.minimumQuantity}
                    min={1}
                    name="minimumQuantity"
                    required
                    step={1}
                    type="number"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              description="Leave either date empty to keep the plan available."
              title="Availability"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  errors={errors}
                  label="Available from"
                  name="availableFrom"
                >
                  <Input
                    {...fieldAttributes(errors, 'availableFrom')}
                    defaultValue={values.availableFrom ?? ''}
                    name="availableFrom"
                    type="date"
                  />
                </Field>
                <Field
                  errors={errors}
                  label="Available until"
                  name="availableUntil"
                >
                  <Input
                    {...fieldAttributes(errors, 'availableUntil')}
                    defaultValue={values.availableUntil ?? ''}
                    name="availableUntil"
                    type="date"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              description="Choose what customers and staff can do with this plan."
              title="Plan policies"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Check
                  checked={values.autoCloseOnExpiry}
                  description="Close the subscription when the expiry date passes."
                  label="Close automatically on expiry"
                  name="autoCloseOnExpiry"
                />
                <Check
                  checked={values.allowEarlyClose}
                  description="Allow the subscription to end before its expiry."
                  label="Allow early close"
                  name="allowEarlyClose"
                />
                <Check
                  checked={values.allowPause}
                  description="Let staff pause an active subscription."
                  label="Allow pause"
                  name="allowPause"
                />
                <Check
                  checked={values.allowRenewal}
                  description="Allow the subscription to be renewed."
                  label="Allow renewal"
                  name="allowRenewal"
                />
              </div>
            </FormSection>
          </div>

          <div className="space-y-6">
            <FormSection
              description="Inactive plans are hidden from new subscriptions."
              title="Status"
            >
              <Check
                checked={values.isActive}
                label="Plan is active"
                name="isActive"
              />
            </FormSection>
            {record === undefined ? null : (
              <FormSection
                description="Plan details at a glance."
                title="Summary"
              >
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Interval</dt>
                    <dd>{intervals[record.billingFrequency]}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Minimum</dt>
                    <dd className="tabular-nums">{record.minimumQuantity}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Availability</dt>
                    <dd>
                      {record.availableFrom === null
                        ? 'Any time'
                        : displayDay(record.availableFrom)}
                      {' → '}
                      {record.availableUntil === null
                        ? 'No end date'
                        : displayDay(record.availableUntil)}
                    </dd>
                  </div>
                </dl>
              </FormSection>
            )}
            {readOnly ? <ReadOnlyNote /> : null}
          </div>
        </div>

        {readOnly ? null : (
          <FormActions>
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit">
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {mutation.isPending ? 'Saving…' : 'Save plan'}
            </Button>
          </FormActions>
        )}
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const PlanEditor = ({
  id,
  readOnly,
  onCancel,
  onDone,
}: {
  id: string | null
  onCancel: () => void
  onDone: (message: string) => void
  readOnly: boolean
}) => {
  const query = useQuery(
    orpc.plan.get.queryOptions({
      enabled: id !== null,
      input: { id: id ?? '' },
    }),
  )
  if (id !== null && query.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading plan…
      </div>
    )
  }
  if (id !== null && query.isError) {
    return (
      <QueryError
        error={query.error}
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  return (
    <PlanForm
      onCancel={onCancel}
      onDone={onDone}
      readOnly={readOnly}
      record={id === null ? undefined : query.data}
    />
  )
}

const PlanTableHeader = () => (
  <TableHeader>
    <TableRow>
      <TableHead className="pl-5">Plan</TableHead>
      <TableHead>Min. quantity</TableHead>
      <TableHead>Availability</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="pr-5 text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
)

const PlanRow = ({
  canArchive,
  canEdit,
  item,
  onArchive,
  onEdit,
  pending,
}: {
  canArchive: boolean
  canEdit: boolean
  item: PlanSummary
  onArchive: (id: string) => void
  onEdit: (id: string) => void
  pending: boolean
}) => (
  <TableRow>
    <TableCell className="pl-5">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground">
          {intervals[item.billingFrequency]}
        </span>
      </div>
    </TableCell>
    <TableCell className="tabular-nums">{item.minimumQuantity}</TableCell>
    <TableCell className="text-muted-foreground">
      {item.availableFrom === null
        ? 'Any time'
        : displayDay(item.availableFrom)}
      {' → '}
      {item.availableUntil === null
        ? 'No end date'
        : displayDay(item.availableUntil)}
    </TableCell>
    <TableCell>
      <Status active={item.isActive} />
    </TableCell>
    <TableCell className="pr-5 text-right">
      <div className="flex items-center justify-end gap-1">
        <Button
          aria-label={`${canEdit ? 'Edit' : 'View'} ${item.name}`}
          onClick={() => {
            onEdit(item.id)
          }}
          size="sm"
          variant="ghost"
        >
          {canEdit ? (
            <PencilIcon data-icon="inline-start" />
          ) : (
            <EyeIcon data-icon="inline-start" />
          )}
          {canEdit ? 'Edit' : 'View'}
        </Button>
        {canArchive && item.isActive ? (
          <ConfirmArchive
            name={item.name}
            onConfirm={() => {
              onArchive(item.id)
            }}
            pending={pending}
          />
        ) : null}
      </div>
    </TableCell>
  </TableRow>
)

const PlansTable = ({
  canArchive,
  canCreate,
  canEdit,
  onArchive,
  onCreate,
  onEdit,
  pending,
  query,
  search,
}: {
  canArchive: boolean
  canCreate: boolean
  canEdit: boolean
  onArchive: (id: string) => void
  onCreate: () => void
  onEdit: (id: string) => void
  pending: boolean
  query: UseQueryResult<PlanList>
  search: string
}) => {
  if (query.isPending) {
    return (
      <Table>
        <PlanTableHeader />
        <TableSkeleton columns={5} />
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
    return (
      <Empty className="border-0 py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarRange />
          </EmptyMedia>
          <EmptyTitle>
            {search === '' ? 'No plans yet' : 'No matching plans'}
          </EmptyTitle>
          <EmptyDescription>
            {search === ''
              ? 'Create a plan to define how subscriptions are billed.'
              : 'Try a different plan name.'}
          </EmptyDescription>
        </EmptyHeader>
        {search === '' && canCreate ? (
          <EmptyContent>
            <Button onClick={onCreate}>
              <PlusIcon data-icon="inline-start" />
              New plan
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    )
  }
  return (
    <Table>
      <PlanTableHeader />
      <TableBody>
        {query.data.items.map((item) => (
          <PlanRow
            canArchive={canArchive}
            canEdit={canEdit}
            item={item}
            key={item.id}
            onArchive={onArchive}
            onEdit={onEdit}
            pending={pending}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export const PlansPage = ({ readOnly = false }: { readOnly?: boolean }) => {
  const access = useAccess()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ id: string | null }>()
  const query = useQuery(
    orpc.plan.list.queryOptions({ input: { page, search } }),
  )
  const archive = useMutation({
    ...orpc.plan.archive.mutationOptions(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.plan.key() })
      toast.success('Plan archived.')
    },
  })
  const editable = !readOnly && access({ plan: ['update'] })
  const canCreate = !readOnly && access({ plan: ['create'] })

  if (editor !== undefined) {
    const canEdit = editor.id === null ? canCreate : editable
    let description = 'Update the billing rhythm and policies for this plan.'
    if (editor.id === null) {
      description = 'Define a new billing plan and its policies.'
    } else if (!canEdit) {
      description = 'Billing rhythm and policies for this plan.'
    }
    return (
      <div className="space-y-6">
        <PageHeader
          actions={
            readOnly ? <Badge variant="outline">Read only</Badge> : undefined
          }
          back={{
            label: 'Back to plans',
            onClick: () => {
              setEditor(undefined)
            },
          }}
          description={description}
          eyebrow="Plans"
          title={editorTitle('plan', editor.id, editable)}
        />
        <PlanEditor
          id={editor.id}
          onCancel={() => {
            setEditor(undefined)
          }}
          onDone={(notice) => {
            setEditor(undefined)
            toast.success(notice)
          }}
          readOnly={!canEdit}
        />
      </div>
    )
  }

  const canArchive = !readOnly && access({ plan: ['archive'] })
  const hasItems = query.data !== undefined && query.data.items.length > 0
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setEditor({ id: null })
              }}
            >
              <PlusIcon data-icon="inline-start" />
              New plan
            </Button>
          ) : (
            <Badge variant="outline">Read only</Badge>
          )
        }
        description={
          readOnly
            ? 'Review billing intervals, availability, and plan policies.'
            : 'Set the availability and policies for your subscription plans.'
        }
        eyebrow="Plans"
        title="Plans"
      />
      <Feedback error={archive.error} />
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Search
            label="Search plan names"
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
            value={search}
          />
          <p className="text-xs text-muted-foreground">
            {query.data === undefined
              ? 'Loading plans…'
              : `${query.data.total} ${query.data.total === 1 ? 'plan' : 'plans'}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <PlansTable
            canArchive={canArchive}
            canCreate={canCreate}
            canEdit={editable}
            onArchive={(id) => {
              archive.mutate({ id })
            }}
            onCreate={() => {
              setEditor({ id: null })
            }}
            onEdit={(id) => {
              setEditor({ id })
            }}
            pending={archive.isPending}
            query={query}
            search={search}
          />
        </CardContent>
        {hasItems ? (
          <Pagination
            busy={query.isFetching}
            onPage={setPage}
            page={page}
            total={total}
          />
        ) : null}
      </Card>
    </div>
  )
}
