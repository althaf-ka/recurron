import type { ReactNode } from 'react'
import { customerInput } from '@recurron/api/catalog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  editorTitle,
  Feedback,
  Field,
  Pagination,
  Search,
} from '../components/ui'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import { fieldAttributes, fieldErrors, optionalText, text } from '../lib/forms'

type Customer = Awaited<ReturnType<typeof apiClient.customer.get>>
type CustomerInput = ReturnType<typeof customerInput.parse>

const CustomerForm = ({
  record,
  readOnly,
  onDone,
}: {
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
      className="editor"
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
      <fieldset disabled={readOnly || mutation.isPending}>
        <div className="form-grid">
          <Field errors={errors} label="Customer name" name="name">
            <input
              {...fieldAttributes(errors, 'name')}
              autoComplete="name"
              defaultValue={record?.name}
              maxLength={200}
              name="name"
              required
            />
          </Field>
          <Field errors={errors} label="Email" name="email">
            <input
              {...fieldAttributes(errors, 'email')}
              autoComplete="email"
              defaultValue={record?.email}
              name="email"
              required
              type="email"
            />
          </Field>
          <Field errors={errors} label="Phone" name="phone">
            <input
              {...fieldAttributes(errors, 'phone')}
              autoComplete="tel"
              defaultValue={record?.phone ?? ''}
              maxLength={100}
              name="phone"
              type="tel"
            />
          </Field>
          <Field errors={errors} label="Company name" name="companyName">
            <input
              {...fieldAttributes(errors, 'companyName')}
              autoComplete="organization"
              defaultValue={record?.companyName ?? ''}
              maxLength={200}
              name="companyName"
            />
          </Field>
        </div>
        <Field errors={errors} label="Billing address" name="billingAddress">
          <textarea
            {...fieldAttributes(errors, 'billingAddress')}
            autoComplete="street-address"
            defaultValue={record?.billingAddress ?? ''}
            maxLength={4000}
            name="billingAddress"
            rows={4}
          />
        </Field>
        {readOnly ? null : (
          <div className="form-footer">
            <button className="primary" type="submit">
              {mutation.isPending ? 'Saving…' : 'Save customer'}
            </button>
          </div>
        )}
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const CustomerEditor = ({
  id,
  readOnly,
  onDone,
}: {
  id: string | null
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
    return <output>Loading customer…</output>
  }
  if (id !== null && query.isError) {
    return <Feedback error={query.error} />
  }
  return (
    <CustomerForm
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
  const [message, setMessage] = useState<string>()
  const query = useQuery(
    orpc.customer.list.queryOptions({ input: { page, search } }),
  )
  const editable = access({ customer: ['update'] })
  if (editor !== undefined) {
    return (
      <section>
        <button
          className="back"
          onClick={() => {
            setEditor(undefined)
          }}
          type="button"
        >
          ← Back to customers
        </button>
        <h1>{editorTitle('customer', editor.id, editable)}</h1>
        <CustomerEditor
          id={editor.id}
          onDone={(notice) => {
            setEditor(undefined)
            setMessage(notice)
          }}
          readOnly={
            editor.id === null ? !access({ customer: ['create'] }) : !editable
          }
        />
      </section>
    )
  }
  let content: ReactNode
  if (query.isPending) {
    content = <output>Loading customers…</output>
  } else if (query.isError) {
    content = (
      <>
        <Feedback error={query.error} />
        <button
          onClick={() => {
            void query.refetch()
          }}
          type="button"
        >
          Try again
        </button>
      </>
    )
  } else {
    content = (
      <>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Customers</caption>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Email</th>
                <th scope="col">Company</th>
                <th scope="col">Phone</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.companyName ?? '—'}</td>
                  <td>{item.phone ?? '—'}</td>
                  <td>
                    <button
                      aria-label={`${editable ? 'Edit' : 'View'} ${item.name}`}
                      onClick={() => {
                        setEditor({ id: item.id })
                      }}
                      type="button"
                    >
                      {editable ? 'Edit' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data.items.length === 0 ? (
            <p className="empty">
              {search === ''
                ? 'No customers yet. Add a customer to start your directory.'
                : 'No customers match this search.'}
            </p>
          ) : null}
        </div>
        <Pagination
          busy={query.isFetching}
          onPage={setPage}
          page={page}
          total={query.data.total}
        />
      </>
    )
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Customers</h1>
          <p className="muted">
            Find customers and keep their contact and billing details up to
            date.
          </p>
        </div>
        {access({ customer: ['create'] }) ? (
          <button
            className="primary"
            onClick={() => {
              setMessage(undefined)
              setEditor({ id: null })
            }}
            type="button"
          >
            New customer
          </button>
        ) : null}
      </div>
      <Search
        value={search}
        label="Search name, email, or company"
        onSearch={(value) => {
          setSearch(value)
          setPage(1)
        }}
      />
      <Feedback message={message} />
      {content}
    </section>
  )
}
