import type { ReactNode } from 'react'
import { planInput } from '@recurron/api/catalog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Check,
  ConfirmArchive,
  editorTitle,
  Feedback,
  Field,
  Pagination,
  Search,
  Status,
} from '../components/ui'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import {
  checked,
  fieldAttributes,
  fieldErrors,
  optionalText,
  text,
} from '../lib/forms'

type Plan = Awaited<ReturnType<typeof apiClient.plan.get>>
type PlanInput = ReturnType<typeof planInput.parse>
const intervals = {
  DAILY: 'Daily',
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  YEARLY: 'Yearly',
} as const

const PlanForm = ({
  record,
  readOnly,
  onDone,
}: {
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
      className="editor"
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
      <fieldset disabled={readOnly || mutation.isPending}>
        <div className="form-grid">
          <Field errors={errors} label="Plan name" name="name">
            <input
              {...fieldAttributes(errors, 'name')}
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
            <select
              {...fieldAttributes(errors, 'billingFrequency')}
              defaultValue={values.billingFrequency}
              name="billingFrequency"
            >
              {Object.entries(intervals).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            errors={errors}
            label="Minimum quantity"
            name="minimumQuantity"
          >
            <input
              {...fieldAttributes(errors, 'minimumQuantity')}
              defaultValue={values.minimumQuantity}
              min={1}
              name="minimumQuantity"
              required
              step={1}
              type="number"
            />
          </Field>
          <Field errors={errors} label="Available from" name="availableFrom">
            <input
              {...fieldAttributes(errors, 'availableFrom')}
              defaultValue={values.availableFrom ?? ''}
              name="availableFrom"
              type="date"
            />
          </Field>
          <Field errors={errors} label="Available until" name="availableUntil">
            <input
              {...fieldAttributes(errors, 'availableUntil')}
              defaultValue={values.availableUntil ?? ''}
              name="availableUntil"
              type="date"
            />
          </Field>
        </div>
        <h2>Plan policies</h2>
        <div className="checks">
          <Check
            checked={values.autoCloseOnExpiry}
            label="Close automatically when the plan expires"
            name="autoCloseOnExpiry"
          />
          <Check
            checked={values.allowEarlyClose}
            label="Customers can close this plan early"
            name="allowEarlyClose"
          />
          <Check
            checked={values.allowPause}
            label="Customers can pause this plan"
            name="allowPause"
          />
          <Check
            checked={values.allowRenewal}
            label="Customers can renew this plan"
            name="allowRenewal"
          />
          <Check
            checked={values.isActive}
            label="Plan is active"
            name="isActive"
          />
        </div>
        {readOnly ? null : (
          <div className="form-footer">
            <button className="primary" type="submit">
              {mutation.isPending ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        )}
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const PlanEditor = ({
  id,
  readOnly,
  onDone,
}: {
  id: string | null
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
    return <output>Loading plan…</output>
  }
  if (id !== null && query.isError) {
    return <Feedback error={query.error} />
  }
  return (
    <PlanForm
      onDone={onDone}
      readOnly={readOnly}
      record={id === null ? undefined : query.data}
    />
  )
}

export const PlansPage = ({ readOnly = false }: { readOnly?: boolean }) => {
  const access = useAccess()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ id: string | null }>()
  const [message, setMessage] = useState<string>()
  const query = useQuery(
    orpc.plan.list.queryOptions({ input: { page, search } }),
  )
  const archive = useMutation({
    ...orpc.plan.archive.mutationOptions(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.plan.key() })
      setMessage('Plan archived.')
    },
  })
  const editable = !readOnly && access({ plan: ['update'] })
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
          ← Back to plans
        </button>
        <h1>{editorTitle('plan', editor.id, editable)}</h1>
        <PlanEditor
          id={editor.id}
          onDone={(notice) => {
            setEditor(undefined)
            setMessage(notice)
          }}
          readOnly={
            editor.id === null ? !access({ plan: ['create'] }) : !editable
          }
        />
      </section>
    )
  }
  let content: ReactNode
  if (query.isPending) {
    content = <output>Loading plans…</output>
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
            <caption className="sr-only">Plans</caption>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Interval</th>
                <th scope="col">Min. quantity</th>
                <th scope="col">Availability</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{intervals[item.billingFrequency]}</td>
                  <td>{item.minimumQuantity}</td>
                  <td>
                    {item.availableFrom ?? 'Any time'} →{' '}
                    {item.availableUntil ?? 'No end date'}
                  </td>
                  <td>
                    <Status active={item.isActive} />
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        aria-label={`${editable ? 'Edit' : 'View'} ${item.name}`}
                        onClick={() => {
                          setEditor({ id: item.id })
                        }}
                        type="button"
                      >
                        {editable ? 'Edit' : 'View'}
                      </button>
                      {!readOnly &&
                      item.isActive &&
                      access({ plan: ['archive'] }) ? (
                        <ConfirmArchive
                          name={item.name}
                          onConfirm={() => {
                            archive.mutate({ id: item.id })
                          }}
                          pending={archive.isPending}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data.items.length === 0 ? (
            <p className="empty">
              {search === ''
                ? 'No plans are available.'
                : 'No plans match this search.'}
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
          <h1>Plans</h1>
          <p className="muted">
            {readOnly
              ? 'Review billing intervals, availability, and plan policies.'
              : 'Set the availability and policies for your subscription plans.'}
          </p>
        </div>
        {!readOnly && access({ plan: ['create'] }) ? (
          <button
            className="primary"
            onClick={() => {
              setMessage(undefined)
              setEditor({ id: null })
            }}
            type="button"
          >
            New plan
          </button>
        ) : (
          <span className="badge">Read only</span>
        )}
      </div>
      <Search
        value={search}
        label="Search plan names"
        onSearch={(value) => {
          setSearch(value)
          setPage(1)
        }}
      />
      <Feedback message={message} />
      <Feedback error={archive.error} />
      {content}
    </section>
  )
}
