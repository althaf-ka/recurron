import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatMinor, parseMinor } from '@recurron/api/money'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup } from '@/components/ui/field'
import { Check, Feedback, Field, Pagination } from '@/components/shared'
import { apiClient, orpc } from '../lib/api'
import { checked, text } from '../lib/forms'
import { FinanceSelect } from './finance'

const percentBps = (value: string) => parseMinor(value)
const optionalAmount = (data: FormData, key: string) =>
  text(data, key) === '' ? null : parseMinor(text(data, key))
const optionalInteger = (data: FormData, key: string) =>
  text(data, key) === '' ? null : Number(text(data, key))
const optionalDate = (data: FormData, key: string) =>
  text(data, key) === '' ? null : `${text(data, key)}T00:00:00.000Z`
type Tax = Awaited<ReturnType<typeof apiClient.tax.get>>
type Discount = Awaited<ReturnType<typeof apiClient.discount.get>>

export const TaxesPage = () => {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Tax | null>(null)
  const [error, setError] = useState<unknown>(null)
  const query = useQuery(
    orpc.tax.list.queryOptions({ input: { page, pageSize: 20, search: '' } }),
  )
  const save = useMutation({
    mutationFn: async (data: Parameters<typeof apiClient.tax.create>[0]) =>
      editing
        ? await apiClient.tax.update({ id: editing.id, data })
        : await apiClient.tax.create(data),
    onSuccess: async () => {
      setEditing(null)
      toast.success('Tax saved')
      await client.invalidateQueries()
    },
  })
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Taxes</h1>
      <Feedback error={query.error ?? save.error ?? error} />
      <form
        key={editing?.id ?? 'new'}
        onSubmit={(event) => {
          event.preventDefault()
          if (save.isPending) {
            return
          }
          const data = new FormData(event.currentTarget)
          try {
            const rateBps = percentBps(text(data, 'rate'))
            setError(null)
            save.mutate({
              name: text(data, 'name'),
              rateBps,
              isActive: checked(data, 'active'),
            })
          } catch (error_) {
            setError(error_)
          }
        }}
      >
        <FieldGroup>
          <Field label="Name" name="name">
            <Input
              id="name"
              name="name"
              required
              maxLength={200}
              defaultValue={editing?.name ?? ''}
            />
          </Field>
          <Field label="Percentage" name="rate">
            <Input
              id="rate"
              name="rate"
              required
              inputMode="decimal"
              defaultValue={editing ? formatMinor(editing.rateBps) : '18'}
            />
          </Field>
          <Check
            name="active"
            label="Active"
            checked={editing?.isActive ?? true}
          />
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? 'Saving…' : 'Save tax'}
          </Button>
          {editing ? (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null)
              }}
            >
              New tax
            </Button>
          ) : null}
        </FieldGroup>
      </form>
      <ul className="divide-y">
        {query.data?.items.map((tax) => (
          <li
            key={tax.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span>
              {tax.name} · {tax.rateBps / 100}% ·{' '}
              {tax.isActive ? 'Active' : 'Inactive'}
            </span>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                setEditing(tax)
              }}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        total={query.data?.total ?? 0}
        onPage={setPage}
        busy={query.isFetching}
      />
    </section>
  )
}

const discountFieldDefaults = (rule: Discount | null) => ({
  value: rule
    ? formatMinor(rule.fixedAmountMinor ?? rule.percentageBps ?? 0)
    : '',
  minimumPurchase:
    rule === null || rule.minimumPurchaseMinor === null
      ? ''
      : formatMinor(rule.minimumPurchaseMinor),
  minimumQuantity: rule?.minimumQuantity ?? '',
  startsAt: rule?.startsAt?.slice(0, 10) ?? '',
  endsAt: rule?.endsAt?.slice(0, 10) ?? '',
  usageLimit: rule?.usageLimit ?? '',
})

const DiscountForm = ({
  rule,
  onDone,
}: {
  rule: Discount | null
  onDone: () => void
}) => {
  const defaults = discountFieldDefaults(rule)
  const values = rule ?? {
    discountType: 'PERCENTAGE' as const,
    discountScope: 'SUBSCRIPTION' as const,
    name: '',
    minimumPurchaseMinor: null,
    minimumQuantity: null,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    isActive: true,
    productIds: [],
    fixedAmountMinor: null,
    percentageBps: null,
  }
  const [type, setType] = useState(values.discountType)
  const [scope, setScope] = useState(values.discountScope)
  const [error, setError] = useState<unknown>(null)
  const [productPage, setProductPage] = useState(1)
  const [productIds, setProductIds] = useState<string[]>(values.productIds)
  const products = useQuery(
    orpc.product.list.queryOptions({
      input: { page: productPage, pageSize: 20, search: '' },
    }),
  )
  const save = useMutation({
    mutationFn: async (
      data: Parameters<typeof apiClient.discount.create>[0],
    ) =>
      rule
        ? await apiClient.discount.update({ id: rule.id, data })
        : await apiClient.discount.create(data),
    onSuccess: onDone,
  })
  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (save.isPending) {
      return
    }
    const data = new FormData(event.currentTarget)
    try {
      setError(null)
      save.mutate({
        name: text(data, 'name'),
        discountType: type,
        discountScope: scope,
        fixedAmountMinor:
          type === 'FIXED' ? parseMinor(text(data, 'value')) : null,
        percentageBps:
          type === 'PERCENTAGE' ? percentBps(text(data, 'value')) : null,
        minimumPurchaseMinor: optionalAmount(data, 'minimumPurchase'),
        minimumQuantity: optionalInteger(data, 'minimumQuantity'),
        startsAt: optionalDate(data, 'startsAt'),
        endsAt: optionalDate(data, 'endsAt'),
        usageLimit: optionalInteger(data, 'usageLimit'),
        productIds: scope === 'PRODUCT' ? productIds : [],
        isActive: checked(data, 'active'),
      })
    } catch (error_) {
      setError(error_)
    }
  }
  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Feedback error={save.error ?? error ?? products.error} />
        <Field label="Name" name="name">
          <Input id="name" name="name" required defaultValue={values.name} />
        </Field>
        <FinanceSelect
          label="Discount type"
          value={type}
          options={['FIXED', 'PERCENTAGE']}
          onChange={(value) => {
            setType(value === 'FIXED' ? 'FIXED' : 'PERCENTAGE')
          }}
        />
        <FinanceSelect
          label="Discount scope"
          value={scope}
          options={['PRODUCT', 'SUBSCRIPTION']}
          onChange={(value) => {
            setScope(value === 'PRODUCT' ? 'PRODUCT' : 'SUBSCRIPTION')
          }}
        />
        <Field
          label={type === 'FIXED' ? 'Amount (₹)' : 'Percentage'}
          name="value"
        >
          <Input
            id="value"
            name="value"
            required
            inputMode="decimal"
            defaultValue={defaults.value}
          />
        </Field>
        <Field label="Minimum purchase (₹), optional" name="minimumPurchase">
          <Input
            id="minimumPurchase"
            name="minimumPurchase"
            inputMode="decimal"
            defaultValue={defaults.minimumPurchase}
          />
        </Field>
        <Field label="Minimum quantity, optional" name="minimumQuantity">
          <Input
            id="minimumQuantity"
            name="minimumQuantity"
            type="number"
            min={1}
            defaultValue={defaults.minimumQuantity}
          />
        </Field>
        <Field label="Start date, optional" name="startsAt">
          <Input
            id="startsAt"
            name="startsAt"
            type="date"
            defaultValue={defaults.startsAt}
          />
        </Field>
        <Field label="End date, optional" name="endsAt">
          <Input
            id="endsAt"
            name="endsAt"
            type="date"
            defaultValue={defaults.endsAt}
          />
        </Field>
        <Field label="Usage limit, optional" name="usageLimit">
          <Input
            id="usageLimit"
            name="usageLimit"
            type="number"
            min={1}
            defaultValue={defaults.usageLimit}
          />
        </Field>
        {scope === 'PRODUCT' ? (
          <fieldset className="flex flex-col gap-2">
            <legend>Applicable products</legend>
            {products.data?.items.map((product) => (
              <label key={product.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={productIds.includes(product.id)}
                  onChange={(event) => {
                    setProductIds(
                      event.target.checked
                        ? [...productIds, product.id]
                        : productIds.filter((id) => id !== product.id),
                    )
                  }}
                />
                {product.name}
              </label>
            ))}
            <Pagination
              page={productPage}
              total={products.data?.total ?? 0}
              onPage={setProductPage}
              busy={products.isFetching}
            />
          </fieldset>
        ) : null}
        <Check name="active" label="Active" checked={values.isActive} />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save discount'}
        </Button>
      </FieldGroup>
    </form>
  )
}

export const DiscountsPage = () => {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [rule, setRule] = useState<Discount | null>(null)
  const query = useQuery(
    orpc.discount.list.queryOptions({
      input: { page, pageSize: 20, search: '' },
    }),
  )
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Discounts</h1>
      <p>
        The best eligible product discount applies per line, then the best
        subscription discount applies to the remaining subtotal. Tax applies
        after discounts. Usage is recorded per actual application.
      </p>
      <Feedback error={query.error} />
      <DiscountForm
        key={rule?.id ?? 'new'}
        rule={rule}
        onDone={() => {
          setRule(null)
          toast.success('Discount saved')
          void client.invalidateQueries()
        }}
      />
      <Button
        variant="outline"
        onClick={() => {
          setRule(null)
        }}
      >
        New discount
      </Button>
      <ul className="divide-y">
        {query.data?.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span>
              {item.name} ·{' '}
              {item.discountType === 'PERCENTAGE'
                ? `${(item.percentageBps ?? 0) / 100}%`
                : `₹${formatMinor(item.fixedAmountMinor ?? 0)}`}{' '}
              · {item.discountScope} · {item.usageCount} uses ·{' '}
              {item.isActive ? 'Active' : 'Inactive'}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setRule(item)
              }}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        total={query.data?.total ?? 0}
        onPage={setPage}
        busy={query.isFetching}
      />
    </section>
  )
}
