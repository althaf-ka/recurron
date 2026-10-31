import type { ReactNode } from 'react'
import { productInput } from '@recurron/api/catalog'
import { formatMinor } from '@recurron/api/money'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ConfirmArchive,
  editorTitle,
  Feedback,
  Field,
  Check,
  Pagination,
  Search,
  Status,
} from '../components/ui'
import { useAccess } from '../lib/access'
import { apiClient, orpc } from '../lib/api'
import {
  checked,
  displayMoney,
  fieldAttributes,
  fieldErrors,
  moneyInput,
  optionalText,
  text,
} from '../lib/forms'

type Product = Awaited<ReturnType<typeof apiClient.product.get>>
type ProductInput = ReturnType<typeof productInput.parse>

const ProductForm = ({
  record,
  readOnly,
  onDone,
}: {
  onDone: (message: string) => void
  readOnly: boolean
  record?: Product
}) => {
  const client = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [variants, setVariants] = useState(() =>
    (record?.variants.filter((variant) => variant.isActive) ?? []).map(
      (variant) => ({ ...variant, key: crypto.randomUUID() }),
    ),
  )
  const mutation = useMutation({
    mutationFn: async (data: ProductInput) =>
      record === undefined
        ? await apiClient.product.create(data)
        : await apiClient.product.update({ data, id: record.id }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.product.key() })
      onDone(record === undefined ? 'Product created.' : 'Product updated.')
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
        const result = productInput.safeParse({
          costPriceMinor: moneyInput(form, 'costPriceMinor'),
          currencyCode: text(form, 'currencyCode').toUpperCase(),
          isActive: checked(form, 'isActive'),
          name: text(form, 'name'),
          notes: optionalText(form, 'notes'),
          productType: text(form, 'productType'),
          salesPriceMinor: moneyInput(form, 'salesPriceMinor'),
          variants: variants.map((variant, index) => ({
            attributeName: text(form, `variants.${index}.attributeName`),
            isActive: true,
            price_delta_minor: moneyInput(
              form,
              `variants.${index}.price_delta_minor`,
            ),
            valueName: text(form, `variants.${index}.valueName`),
          })),
        })
        setErrors(result.success ? {} : fieldErrors(result.error.issues))
        if (result.success) {
          mutation.mutate(result.data)
        }
      }}
    >
      <fieldset disabled={readOnly || mutation.isPending}>
        <div className="form-grid">
          <Field errors={errors} label="Product name" name="name">
            <input
              {...fieldAttributes(errors, 'name')}
              autoComplete="off"
              defaultValue={record?.name}
              maxLength={200}
              name="name"
              required
            />
          </Field>
          <Field errors={errors} label="Product type" name="productType">
            <select
              {...fieldAttributes(errors, 'productType')}
              defaultValue={record?.productType ?? 'SERVICE'}
              name="productType"
            >
              <option value="SERVICE">Service</option>
              <option value="GOODS">Goods</option>
            </select>
          </Field>
          <Field errors={errors} label="Sales price" name="salesPriceMinor">
            <input
              {...fieldAttributes(errors, 'salesPriceMinor')}
              defaultValue={formatMinor(record?.salesPriceMinor ?? 0)}
              inputMode="decimal"
              name="salesPriceMinor"
              required
            />
          </Field>
          <Field errors={errors} label="Cost price" name="costPriceMinor">
            <input
              {...fieldAttributes(errors, 'costPriceMinor')}
              defaultValue={formatMinor(record?.costPriceMinor ?? 0)}
              inputMode="decimal"
              name="costPriceMinor"
              required
            />
          </Field>
          <Field errors={errors} label="Currency code" name="currencyCode">
            <input
              {...fieldAttributes(errors, 'currencyCode')}
              defaultValue={record?.currencyCode ?? 'INR'}
              maxLength={3}
              minLength={3}
              name="currencyCode"
              required
            />
            <small>Three-letter code, for example INR or USD.</small>
          </Field>
        </div>
        <Field errors={errors} label="Notes" name="notes">
          <textarea
            {...fieldAttributes(errors, 'notes')}
            defaultValue={record?.notes ?? ''}
            maxLength={10_000}
            name="notes"
            rows={3}
          />
        </Field>
        <Check
          checked={record?.isActive ?? true}
          label="Product is active"
          name="isActive"
        />
        <div className="section-heading">
          <div>
            <h2>Variants</h2>
            <p className="muted">
              Adjust the sales price for a specific option. Use a negative
              amount to reduce it.
            </p>
          </div>
          {readOnly ? null : (
            <button
              disabled={variants.length >= 100}
              onClick={() => {
                setVariants((current) => [
                  ...current,
                  {
                    attributeName: '',
                    isActive: true,
                    key: crypto.randomUUID(),
                    price_delta_minor: 0,
                    valueName: '',
                  },
                ])
              }}
              type="button"
            >
              Add variant
            </button>
          )}
        </div>
        {variants.length === 0 ? (
          <p className="muted">No active variants.</p>
        ) : (
          variants.map((variant, index) => (
            <div className="variant-row" key={variant.key}>
              <Field
                errors={errors}
                label="Attribute name"
                name={`variants.${index}.attributeName`}
              >
                <input
                  {...fieldAttributes(
                    errors,
                    `variants.${index}.attributeName`,
                  )}
                  defaultValue={variant.attributeName}
                  maxLength={200}
                  name={`variants.${index}.attributeName`}
                  placeholder="Brand"
                  required
                />
              </Field>
              <Field
                errors={errors}
                label="Value name"
                name={`variants.${index}.valueName`}
              >
                <input
                  {...fieldAttributes(errors, `variants.${index}.valueName`)}
                  defaultValue={variant.valueName}
                  maxLength={200}
                  name={`variants.${index}.valueName`}
                  placeholder="Odoo"
                  required
                />
              </Field>
              <Field
                errors={errors}
                label="Price adjustment"
                name={`variants.${index}.price_delta_minor`}
              >
                <input
                  {...fieldAttributes(
                    errors,
                    `variants.${index}.price_delta_minor`,
                  )}
                  defaultValue={formatMinor(variant.price_delta_minor)}
                  inputMode="decimal"
                  name={`variants.${index}.price_delta_minor`}
                  placeholder="+560.00"
                  required
                />
              </Field>
              {readOnly ? null : (
                <button
                  aria-label={`Remove variant ${index + 1}`}
                  onClick={() => {
                    setVariants((current) =>
                      current.filter((item) => item.key !== variant.key),
                    )
                  }}
                  type="button"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
        {errors.variants === undefined ? null : (
          <p className="field-error" role="alert">
            {errors.variants}
          </p>
        )}
        {readOnly ? null : (
          <div className="form-footer">
            <button className="primary" type="submit">
              {mutation.isPending ? 'Saving…' : 'Save product'}
            </button>
          </div>
        )}
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const ProductEditor = ({
  id,
  readOnly,
  onDone,
}: {
  id: string | null
  onDone: (message: string) => void
  readOnly: boolean
}) => {
  const query = useQuery(
    orpc.product.get.queryOptions({
      enabled: id !== null,
      input: { id: id ?? '' },
    }),
  )
  if (id !== null && query.isPending) {
    return <output>Loading product…</output>
  }
  if (id !== null && query.isError) {
    return <Feedback error={query.error} />
  }
  return (
    <ProductForm
      onDone={onDone}
      readOnly={readOnly}
      record={id === null ? undefined : query.data}
    />
  )
}

export const ProductsPage = ({ readOnly = false }: { readOnly?: boolean }) => {
  const access = useAccess()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ id: string | null }>()
  const [message, setMessage] = useState<string>()
  const query = useQuery(
    orpc.product.list.queryOptions({ input: { page, search } }),
  )
  const archive = useMutation({
    ...orpc.product.archive.mutationOptions(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.product.key() })
      setMessage('Product archived.')
    },
  })
  const editable = !readOnly && access({ product: ['update'] })
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
          ← Back to products
        </button>
        <h1>{editorTitle('product', editor.id, editable)}</h1>
        <ProductEditor
          id={editor.id}
          onDone={(notice) => {
            setEditor(undefined)
            setMessage(notice)
          }}
          readOnly={
            editor.id === null ? !access({ product: ['create'] }) : !editable
          }
        />
      </section>
    )
  }
  let content: ReactNode
  if (query.isPending) {
    content = <output>Loading products…</output>
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
            <caption className="sr-only">Products</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Type</th>
                <th scope="col">Sales price</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.productType === 'GOODS' ? 'Goods' : 'Service'}</td>
                  <td className="number">
                    {displayMoney(item.salesPriceMinor, item.currencyCode)}
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
                      access({ product: ['archive'] }) ? (
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
                ? 'No products are available.'
                : 'No products match this search.'}
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
          <h1>Products</h1>
          <p className="muted">
            {readOnly
              ? 'Consult the current catalog and available variants.'
              : 'Manage goods, services, and their price adjustments.'}
          </p>
        </div>
        {!readOnly && access({ product: ['create'] }) ? (
          <button
            className="primary"
            onClick={() => {
              setMessage(undefined)
              setEditor({ id: null })
            }}
            type="button"
          >
            New product
          </button>
        ) : (
          <span className="badge">Read only</span>
        )}
      </div>
      <Search
        value={search}
        label="Search product names"
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
