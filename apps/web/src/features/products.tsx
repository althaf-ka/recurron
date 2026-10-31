import type { Dispatch, SetStateAction, SyntheticEvent } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { productInput } from '@recurron/api/catalog'
import { formatMinor } from '@recurron/api/money'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EyeIcon,
  Package,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
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
type ProductList = Awaited<ReturnType<typeof apiClient.product.list>>
type ProductInput = ReturnType<typeof productInput.parse>
type Variant = Product['variants'][number]
type VariantDraft = Variant & { key: string }

const newVariant = (): VariantDraft => ({
  attributeName: '',
  isActive: true,
  key: crypto.randomUUID(),
  price_delta_minor: 0,
  valueName: '',
})

const productTypes = {
  GOODS: 'Goods',
  SERVICE: 'Service',
} as const

const ProductDetailsFields = ({
  errors,
  record,
}: {
  errors: Record<string, string>
  record?: Product
}) => (
  <FormSection
    description="Name the product and choose how it is sold."
    title="Product details"
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <Field errors={errors} label="Product name" name="name">
        <Input
          {...fieldAttributes(errors, 'name')}
          autoComplete="off"
          defaultValue={record?.name}
          maxLength={200}
          name="name"
          required
        />
      </Field>
      <Field errors={errors} label="Product type" name="productType">
        <Select
          defaultValue={record?.productType ?? 'SERVICE'}
          items={productTypes}
          name="productType"
        >
          <SelectTrigger
            {...fieldAttributes(errors, 'productType')}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SERVICE">Service</SelectItem>
            <SelectItem value="GOODS">Goods</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  </FormSection>
)

const PricingFields = ({
  errors,
  record,
}: {
  errors: Record<string, string>
  record?: Product
}) => (
  <FormSection
    description="Prices are entered in major currency units."
    title="Pricing"
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <Field errors={errors} label="Sales price" name="salesPriceMinor">
        <Input
          {...fieldAttributes(errors, 'salesPriceMinor')}
          defaultValue={formatMinor(record?.salesPriceMinor ?? 0)}
          inputMode="decimal"
          name="salesPriceMinor"
          required
        />
      </Field>
      <Field errors={errors} label="Cost price" name="costPriceMinor">
        <Input
          {...fieldAttributes(errors, 'costPriceMinor')}
          defaultValue={formatMinor(record?.costPriceMinor ?? 0)}
          inputMode="decimal"
          name="costPriceMinor"
          required
        />
      </Field>
      <Field
        description="Three-letter code, for example INR or USD."
        errors={errors}
        label="Currency code"
        name="currencyCode"
      >
        <Input
          {...fieldAttributes(errors, 'currencyCode')}
          autoComplete="off"
          className="uppercase"
          defaultValue={record?.currencyCode ?? 'INR'}
          maxLength={3}
          minLength={3}
          name="currencyCode"
          required
        />
      </Field>
    </div>
  </FormSection>
)

const VariantFields = ({
  errors,
  index,
  readOnly,
  variant,
  onRemove,
}: {
  errors: Record<string, string>
  index: number
  onRemove: () => void
  readOnly: boolean
  variant: VariantDraft
}) => (
  <div className="rounded-lg border bg-muted/20 p-4">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto] sm:items-end">
      <Field
        errors={errors}
        label="Attribute name"
        name={`variants.${index}.attributeName`}
      >
        <Input
          {...fieldAttributes(errors, `variants.${index}.attributeName`)}
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
        <Input
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
        <Input
          {...fieldAttributes(errors, `variants.${index}.price_delta_minor`)}
          defaultValue={formatMinor(variant.price_delta_minor)}
          inputMode="decimal"
          name={`variants.${index}.price_delta_minor`}
          placeholder="+560.00"
          required
        />
      </Field>
      {readOnly ? null : (
        <Button
          aria-label={`Remove variant ${index + 1}`}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  </div>
)

const VariantsSection = ({
  errors,
  readOnly,
  setVariants,
  variants,
}: {
  errors: Record<string, string>
  readOnly: boolean
  setVariants: Dispatch<SetStateAction<VariantDraft[]>>
  variants: VariantDraft[]
}) => (
  <FormSection
    action={
      readOnly ? undefined : (
        <Button
          disabled={variants.length >= 100}
          onClick={() => {
            setVariants((current) => [...current, newVariant()])
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon data-icon="inline-start" />
          Add variant
        </Button>
      )
    }
    description="Adjust the sales price for a specific option. Use a negative amount to reduce it."
    title="Variants"
  >
    {variants.length === 0 ? (
      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No active variants. Add one to price a specific option differently.
      </div>
    ) : (
      <div className="space-y-3">
        {variants.map((variant, index) => (
          <VariantFields
            errors={errors}
            index={index}
            key={variant.key}
            onRemove={() => {
              setVariants((current) =>
                current.filter((item) => item.key !== variant.key),
              )
            }}
            readOnly={readOnly}
            variant={variant}
          />
        ))}
      </div>
    )}
    {errors.variants === undefined ? null : (
      <p className="text-sm text-destructive" role="alert">
        {errors.variants}
      </p>
    )}
  </FormSection>
)

const NotesField = ({
  errors,
  record,
}: {
  errors: Record<string, string>
  record?: Product
}) => (
  <FormSection
    description="Internal context that helps your team sell this product."
    title="Notes"
  >
    <Field errors={errors} label="Notes" name="notes">
      <Textarea
        {...fieldAttributes(errors, 'notes')}
        className="min-h-24"
        defaultValue={record?.notes ?? ''}
        maxLength={10_000}
        name="notes"
        rows={4}
      />
    </Field>
  </FormSection>
)

const ProductSummary = ({ record }: { record?: Product }) => {
  if (record === undefined) {
    return null
  }
  return (
    <FormSection description="Catalog details at a glance." title="Summary">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{record.productType === 'GOODS' ? 'Goods' : 'Service'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Sales price</dt>
          <dd className="tabular-nums">
            {displayMoney(record.salesPriceMinor, record.currencyCode)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Variants</dt>
          <dd className="tabular-nums">
            {record.variants.filter((variant) => variant.isActive).length}
          </dd>
        </div>
      </dl>
    </FormSection>
  )
}

const ProductSidebar = ({
  readOnly,
  record,
}: {
  readOnly: boolean
  record?: Product
}) => (
  <div className="space-y-6">
    <FormSection
      description="Inactive products are hidden from new subscriptions."
      title="Availability"
    >
      <Check
        checked={record?.isActive ?? true}
        label="Product is active"
        name="isActive"
      />
    </FormSection>
    <ProductSummary record={record} />
    {readOnly ? <ReadOnlyNote /> : null}
  </div>
)

const ProductForm = ({
  record,
  readOnly,
  onCancel,
  onDone,
}: {
  onCancel: () => void
  onDone: (message: string) => void
  readOnly: boolean
  record?: Product
}) => {
  const client = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
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

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
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
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <fieldset className="contents" disabled={readOnly || mutation.isPending}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <ProductDetailsFields errors={errors} record={record} />
            <PricingFields errors={errors} record={record} />
            <VariantsSection
              errors={errors}
              readOnly={readOnly}
              setVariants={setVariants}
              variants={variants}
            />
            <NotesField errors={errors} record={record} />
          </div>
          <ProductSidebar readOnly={readOnly} record={record} />
        </div>

        {readOnly ? null : (
          <FormActions>
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit">
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {mutation.isPending ? 'Saving…' : 'Save product'}
            </Button>
          </FormActions>
        )}
      </fieldset>
      <Feedback error={mutation.error} />
    </form>
  )
}

const ProductEditor = ({
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
    orpc.product.get.queryOptions({
      enabled: id !== null,
      input: { id: id ?? '' },
    }),
  )
  if (id !== null && query.isPending) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading product…
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
    <ProductForm
      onCancel={onCancel}
      onDone={onDone}
      readOnly={readOnly}
      record={id === null ? undefined : query.data}
    />
  )
}

const ProductTableHeader = () => (
  <TableHeader>
    <TableRow>
      <TableHead className="pl-5">Product</TableHead>
      <TableHead>Sales price</TableHead>
      <TableHead>Cost price</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="pr-5 text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
)

const ProductRow = ({
  canArchive,
  canEdit,
  item,
  onArchive,
  onEdit,
  pending,
}: {
  canArchive: boolean
  canEdit: boolean
  item: ProductList['items'][number]
  onArchive: (id: string) => void
  onEdit: (id: string) => void
  pending: boolean
}) => (
  <TableRow>
    <TableCell className="pl-5">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
          <Package aria-hidden="true" className="size-4" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{item.name}</span>
          <Badge
            className="w-fit"
            variant={item.productType === 'GOODS' ? 'info' : 'secondary'}
          >
            {item.productType === 'GOODS' ? 'Goods' : 'Service'}
          </Badge>
        </div>
      </div>
    </TableCell>
    <TableCell className="tabular-nums">
      {displayMoney(item.salesPriceMinor, item.currencyCode)}
    </TableCell>
    <TableCell className="tabular-nums text-muted-foreground">
      {displayMoney(item.costPriceMinor, item.currencyCode)}
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

const ProductsTable = ({
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
  query: UseQueryResult<ProductList>
  search: string
}) => {
  if (query.isPending) {
    return (
      <Table>
        <ProductTableHeader />
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
            <Package />
          </EmptyMedia>
          <EmptyTitle>
            {search === '' ? 'No products yet' : 'No matching products'}
          </EmptyTitle>
          <EmptyDescription>
            {search === ''
              ? 'Add your first good or service to start building subscriptions.'
              : 'Try a different product name.'}
          </EmptyDescription>
        </EmptyHeader>
        {search === '' && canCreate ? (
          <EmptyContent>
            <Button onClick={onCreate}>
              <PlusIcon data-icon="inline-start" />
              New product
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    )
  }
  return (
    <Table>
      <ProductTableHeader />
      <TableBody>
        {query.data.items.map((item) => (
          <ProductRow
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

export const ProductsPage = ({ readOnly = false }: { readOnly?: boolean }) => {
  const access = useAccess()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ id: string | null }>()
  const query = useQuery(
    orpc.product.list.queryOptions({ input: { page, search } }),
  )
  const archive = useMutation({
    ...orpc.product.archive.mutationOptions(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orpc.product.key() })
      toast.success('Product archived.')
    },
  })
  const editable = !readOnly && access({ product: ['update'] })
  const canCreate = !readOnly && access({ product: ['create'] })
  const canArchive = !readOnly && access({ product: ['archive'] })

  if (editor !== undefined) {
    const canEdit = editor.id === null ? canCreate : editable
    let description = 'Update the catalog details for this product.'
    if (editor.id === null) {
      description = 'Add a new good or service to your catalog.'
    } else if (!canEdit) {
      description = 'Catalog details for this product.'
    }
    return (
      <div className="space-y-6">
        <PageHeader
          actions={
            readOnly ? <Badge variant="outline">Read only</Badge> : undefined
          }
          back={{
            label: 'Back to products',
            onClick: () => {
              setEditor(undefined)
            },
          }}
          description={description}
          eyebrow="Catalog"
          title={editorTitle('product', editor.id, editable)}
        />
        <ProductEditor
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
              New product
            </Button>
          ) : (
            <Badge variant="outline">Read only</Badge>
          )
        }
        description={
          readOnly
            ? 'Consult the current catalog and available variants.'
            : 'Manage goods, services, and their price adjustments.'
        }
        eyebrow="Catalog"
        title="Products"
      />
      <Feedback error={archive.error} />
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Search
            label="Search product names"
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
            value={search}
          />
          <p className="text-xs text-muted-foreground">
            {query.data === undefined
              ? 'Loading catalog…'
              : `${total} ${total === 1 ? 'product' : 'products'}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ProductsTable
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
