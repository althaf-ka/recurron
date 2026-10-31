import { subscriptionInput } from '@recurron/api/subscription'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Feedback, Field, Pagination, Search } from '../components/ui'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import { fieldAttributes, fieldErrors, optionalText, text } from '../lib/forms'

type Subscription = Awaited<ReturnType<typeof apiClient.subscription.get>>
type SubscriptionSummary = Awaited<
  ReturnType<typeof apiClient.subscription.list>
>['items'][number]
type SubscriptionStatus = Subscription['status']
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
const currentDate = new Date().toISOString().slice(0, 10)
const isSubscriptionStatus = (value: string): value is SubscriptionStatus =>
  Object.hasOwn(statusLabels, value)

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
  return (
    <div className="actions">
      {actions.map(({ label, operation }) => (
        <button
          disabled={pending}
          key={operation}
          onClick={() => {
            onAction(item.id, operation)
          }}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const SubscriptionForm = ({
  onDone,
}: {
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

  return (
    <form
      className="editor"
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
      <fieldset disabled={mutation.isPending || lookupsPending}>
        {lookupsError ? <Feedback error={lookupsError} /> : null}
        {lookupsPending ? (
          <output>Loading customers, plans, and products…</output>
        ) : null}
        <div className="form-grid">
          <Field errors={errors} label="Customer" name="customerId">
            <select
              {...fieldAttributes(errors, 'customerId')}
              defaultValue=""
              name="customerId"
              required
            >
              <option disabled value="">
                Choose a customer
              </option>
              {customers.data?.items.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field errors={errors} label="Plan" name="subscriptionPlanId">
            <select
              {...fieldAttributes(errors, 'subscriptionPlanId')}
              defaultValue=""
              name="subscriptionPlanId"
              required
            >
              <option disabled value="">
                Choose a plan
              </option>
              {plans.data?.items
                .filter((plan) => plan.isActive)
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.billingFrequency.toLowerCase()}
                  </option>
                ))}
            </select>
          </Field>
          <Field errors={errors} label="Product" name="productId">
            <select
              {...fieldAttributes(errors, 'productId')}
              defaultValue=""
              name="productId"
              required
            >
              <option disabled value="">
                Choose a product
              </option>
              {products.data?.items
                .filter((product) => product.isActive)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field errors={errors} label="Line description" name="description">
            <input
              {...fieldAttributes(errors, 'description')}
              defaultValue=""
              maxLength={500}
              name="description"
              required
            />
          </Field>
          <Field errors={errors} label="Quantity" name="quantity">
            <input
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
            errors={errors}
            label="Unit price (minor units)"
            name="unitPriceMinor"
          >
            <input
              {...fieldAttributes(errors, 'unitPriceMinor')}
              defaultValue={0}
              min={0}
              name="unitPriceMinor"
              required
              step={1}
              type="number"
            />
          </Field>
          <Field errors={errors} label="Start date" name="startDate">
            <input
              {...fieldAttributes(errors, 'startDate')}
              defaultValue={currentDate}
              name="startDate"
              required
              type="date"
            />
          </Field>
          <Field errors={errors} label="Expiry date" name="expiryDate">
            <input
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
            <input
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
        <div className="form-footer">
          <button
            className="primary"
            disabled={lookupsError !== undefined && lookupsError !== null}
            type="submit"
          >
            {mutation.isPending ? 'Saving…' : 'Create draft'}
          </button>
        </div>
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
  const [message, setMessage] = useState<string>()
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
      setMessage('Subscription updated.')
    },
  })
  const canCreate = access({ subscription: ['create'] })

  if (creating) {
    return (
      <section>
        <button
          className="back"
          onClick={() => {
            setCreating(false)
          }}
          type="button"
        >
          ← Back to subscriptions
        </button>
        <h1>New subscription</h1>
        <p className="muted">Create a draft with one product line.</p>
        <SubscriptionForm
          onDone={(notice) => {
            setCreating(false)
            setMessage(notice)
          }}
        />
      </section>
    )
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Subscriptions</h1>
          <p className="muted">
            Create drafts and move subscriptions through their lifecycle.
          </p>
        </div>
        {canCreate ? (
          <button
            className="primary"
            onClick={() => {
              setMessage(undefined)
              setCreating(true)
            }}
            type="button"
          >
            New subscription
          </button>
        ) : null}
      </div>
      <div className="filters">
        <Search
          label="Search subscription, customer, or plan"
          onSearch={(value) => {
            setSearch(value)
            setPage(1)
          }}
          value={search}
        />
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            onChange={(event) => {
              const { value } = event.currentTarget
              setStatus(
                value === '' || isSubscriptionStatus(value) ? value : '',
              )
              setPage(1)
            }}
            value={status}
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Feedback error={lifecycle.error} message={message} />
      {(() => {
        if (query.isPending) {
          return <output>Loading subscriptions…</output>
        }
        if (query.isError) {
          return (
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
        }
        return (
          <>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Subscriptions</caption>
                <thead>
                  <tr>
                    <th scope="col">Subscription</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.subscriptionNumber}</td>
                      <td>{item.customerName}</td>
                      <td>{item.planName}</td>
                      <td>
                        {item.startDate} → {item.expiryDate ?? 'No expiry'}
                      </td>
                      <td>
                        <span className="badge">
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td>
                        <SubscriptionActions
                          access={access}
                          item={item}
                          onAction={(id, operation) => {
                            lifecycle.mutate({ id, operation })
                          }}
                          pending={lifecycle.isPending}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {query.data.items.length === 0 ? (
                <p className="empty">
                  {search === '' && status === ''
                    ? 'No subscriptions yet. Create a draft to begin.'
                    : 'No subscriptions match these filters.'}
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
      })()}
    </section>
  )
}
