import type { ReactNode } from 'react'
import { customerInput } from '@recurron/api/catalog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, EyeIcon, PencilIcon, PlusIcon, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormActions, FormSection, ReadOnlyNote } from '@/components/app/editor'
import { PageHeader } from '@/components/app/page-header'
import { QueryError } from '@/components/app/query-error'
import { TableSkeleton } from '@/components/app/table-skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  editorTitle,
  Feedback,
  Field,
  Pagination,
  Search,
} from '../components/shared'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import { initials } from '../lib/format'
import { fieldAttributes, fieldErrors, optionalText, text } from '../lib/forms'

type Customer = Awaited<ReturnType<typeof apiClient.customer.get>>
type CustomerInput = ReturnType<typeof customerInput.parse>

const CustomerForm = ({
  record,
  readOnly,
  onCancel,
  onDone,
}: {
  onCancel: () => void
  onDone: (message: string) => void
  readOnly: boolean
  record?: Customer
}) => {
  const client = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    mutationFn: async (data: CustomerInput) =>
      record === undefined
        ? await apiClient.customer.create(data)
        : await apiClient.customer.update({ data, id: record.id }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.customer.key() })
      onDone(record === undefined ? 'Customer created.' : 'Customer updated.')
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
        const result = customerInput.safeParse({
          billingAddress: optionalText(form, 'billingAddress'),
          companyName: optionalText(form, 'companyName'),
          email: text(form, 'email'),
          name: text(form, 'name'),
          phone: optionalText(form, 'phone'),
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
              description="The primary contact details used across billing and the portal."
              title="Contact details"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field errors={errors} label="Customer name" name="name">
                  <Input
                    {...fieldAttributes(errors, 'name')}
                    autoComplete="name"
                    defaultValue={record?.name}
                    maxLength={200}
                    name="name"
                    required
                  />
                </Field>
                <Field errors={errors} label="Email" name="email">
                  <Input
                    {...fieldAttributes(errors, 'email')}
                    autoComplete="email"
                    defaultValue={record?.email}
                    name="email"
                    required
                    type="email"
                  />
                </Field>
                <Field errors={errors} label="Phone" name="phone">
                  <Input
                    {...fieldAttributes(errors, 'phone')}
                    autoComplete="tel"
                    defaultValue={record?.phone ?? ''}
                    maxLength={100}
                    name="phone"
                    type="tel"
                  />
                </Field>
                <Field errors={errors} label="Company name" name="companyName">
                  <Input
                    {...fieldAttributes(errors, 'companyName')}
                    autoComplete="organization"
                    defaultValue={record?.companyName ?? ''}
                    maxLength={200}
                    name="companyName"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              description="Shown on quotations and invoices for this customer."
              title="Billing address"
            >
              <Field
                errors={errors}
                label="Billing address"
                name="billingAddress"
              >
                <Textarea
                  {...fieldAttributes(errors, 'billingAddress')}
                  autoComplete="street-address"
                  className="min-h-28"
                  defaultValue={record?.billingAddress ?? ''}
                  maxLength={4000}
                  name="billingAddress"
                  placeholder="Street, city, state, postal code"
                  rows={5}
                />
              </Field>
            </FormSection>
          </div>

          <div className="space-y-6">
            {record === undefined ? (
              <FormSection
                description="A few details to get right."
                title="Before you save"
              >
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {[
                    'Use the customer’s legal or trading name.',
                    'Add a billing address so invoices are complete.',
                    'Double-check the email used for portal access.',
                  ].map((item) => (
                    <li className="flex gap-2" key={item}>
                      <CheckIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-success"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </FormSection>
            ) : (
              <FormSection
                description="Contact details at a glance."
                title="Summary"
              >
                <dl className="space-y-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="truncate">{record.email}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{record.phone ?? '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Company</dt>
                    <dd>{record.companyName ?? '—'}</dd>
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
              {mutation.isPending ? 'Saving…' : 'Save customer'}
            </Button>
          </FormActions>
        )}
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const CustomerEditor = ({
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
    orpc.customer.get.queryOptions({
      enabled: id !== null,
      input: { id: id ?? '' },
    }),
  )
  if (id !== null && query.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading customer…
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
    <CustomerForm
      onCancel={onCancel}
      onDone={onDone}
      readOnly={readOnly}
      record={id === null ? undefined : query.data}
    />
  )
}

export const CustomersPage = () => {
  const access = useAccess()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ id: string | null }>()
  const query = useQuery(
    orpc.customer.list.queryOptions({ input: { page, search } }),
  )
  const editable = access({ customer: ['update'] })
  const canCreate = access({ customer: ['create'] })

  if (editor !== undefined) {
    const readOnly = editor.id === null ? !canCreate : !editable
    let description = 'Update contact and billing details for this customer.'
    if (editor.id === null) {
      description = 'Add contact and billing details for a new customer.'
    } else if (readOnly) {
      description = 'Contact and billing details for this customer.'
    }
    return (
      <div className="space-y-6">
        <PageHeader
          back={{
            label: 'Back to customers',
            onClick: () => {
              setEditor(undefined)
            },
          }}
          description={description}
          eyebrow="Customers"
          title={editorTitle('customer', editor.id, editable)}
        />
        <CustomerEditor
          id={editor.id}
          onCancel={() => {
            setEditor(undefined)
          }}
          onDone={(notice) => {
            setEditor(undefined)
            toast.success(notice)
          }}
          readOnly={readOnly}
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
            <TableHead className="pl-5">Customer</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableSkeleton columns={4} />
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
            <Users />
          </EmptyMedia>
          <EmptyTitle>
            {search === '' ? 'No customers yet' : 'No matching customers'}
          </EmptyTitle>
          <EmptyDescription>
            {search === ''
              ? 'Add your first customer to start building your directory.'
              : 'Try a different name, email, or company.'}
          </EmptyDescription>
        </EmptyHeader>
        {search === '' && canCreate ? (
          <EmptyContent>
            <Button
              onClick={() => {
                setEditor({ id: null })
              }}
            >
              <PlusIcon data-icon="inline-start" />
              New customer
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
            <TableHead className="pl-5">Customer</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="pl-5">
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] font-medium">
                      {initials(item.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.email}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {item.companyName ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {item.phone ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="pr-5 text-right">
                <Button
                  aria-label={`${editable ? 'Edit' : 'View'} ${item.name}`}
                  onClick={() => {
                    setEditor({ id: item.id })
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {editable ? (
                    <PencilIcon data-icon="inline-start" />
                  ) : (
                    <EyeIcon data-icon="inline-start" />
                  )}
                  {editable ? 'Edit' : 'View'}
                </Button>
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
                setEditor({ id: null })
              }}
            >
              <PlusIcon data-icon="inline-start" />
              New customer
            </Button>
          ) : undefined
        }
        description="Find customers and keep their contact and billing details up to date."
        eyebrow="Directory"
        title="Customers"
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Search
            label="Search name, email, or company"
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
            value={search}
          />
          <p className="text-xs text-muted-foreground">
            {query.data === undefined
              ? 'Loading directory…'
              : `${query.data.total} ${query.data.total === 1 ? 'customer' : 'customers'}`}
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
