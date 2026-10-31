import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { formatMinor, parseMinor } from '@recurron/api/money'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FieldGroup } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Feedback, Field, Pagination, Search } from '@/components/shared'
import { apiClient, orpc } from '../lib/api'
import { displayDay } from '../lib/format'
import { text } from '../lib/forms'

const today = () => new Date().toISOString().slice(0, 10)
const money = (value: number) => `₹${formatMinor(value)}`
const invoiceStatuses = [
  'DRAFT',
  'CONFIRMED',
  'PAID',
  'CANCELLED',
  'OVERDUE',
] as const
type InvoiceStatus = (typeof invoiceStatuses)[number]
const paymentMethods = [
  'BANK_TRANSFER',
  'UPI',
  'CARD',
  'CASH',
  'OTHER',
] as const

export const FinanceSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) => (
  <Select
    items={options.map((option) => ({ label: option, value: option }))}
    value={value}
    onValueChange={(next) => {
      if (next !== null) {
        onChange(next)
      }
    }}
  >
    <SelectTrigger aria-label={label}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
)

export const BillingPage = () => {
  const [billingDate, setBillingDate] = useState(today)
  const [page, setPage] = useState(1)
  const client = useQueryClient()
  const submitting = useRef(false)
  const preview = useQuery(
    orpc.billing.preview.queryOptions({
      input: { billingDate, page, pageSize: 20 },
    }),
  )
  const run = useMutation({
    mutationFn: async () => await apiClient.billing.run({ billingDate }),
    onSuccess: async (result) => {
      toast.success(
        `${result.invoicesCreated} invoices generated; ${result.subscriptionsSkipped} skipped; ${result.failures} failed`,
      )
      await client.invalidateQueries()
    },
    onSettled: () => {
      submitting.current = false
    },
  })
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Billing run</h1>
      <p className="text-sm text-muted-foreground">
        Preview one current period per due active subscription. Preview never
        changes billing dates. Repeated runs can catch up older periods.
      </p>
      <Field label="Billing date" name="billing-date">
        <Input
          id="billing-date"
          type="date"
          value={billingDate}
          disabled={run.isPending}
          onChange={(event) => {
            setBillingDate(event.target.value)
            setPage(1)
          }}
        />
      </Field>
      <Feedback error={preview.error ?? run.error} />
      {preview.isPending ? <p>Preparing preview…</p> : null}
      {preview.data ? (
        <>
          <p>
            {preview.data.subscriptionsDue} subscriptions due ·{' '}
            {preview.data.candidateInvoiceCount} candidate invoices · Expected
            value <strong>{money(preview.data.totalMinor)}</strong>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'Customer / subscription',
                  'Plan / period',
                  'Subtotal',
                  'Discount',
                  'Tax',
                  'Total',
                ].map((title) => (
                  <TableHead key={title}>{title}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.data.items.map((row) => (
                <TableRow key={row.subscriptionId}>
                  <TableCell>
                    {row.customerName}
                    <p>{row.subscriptionNumber}</p>
                    {row.warnings.map((warning) => (
                      <p key={warning} className="text-destructive">
                        {warning}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell>
                    {row.planName}
                    <p>
                      {displayDay(row.billingPeriodStart)} –{' '}
                      {displayDay(row.billingPeriodEnd)}
                    </p>
                  </TableCell>
                  <TableCell>{money(row.subtotalMinor)}</TableCell>
                  <TableCell>−{money(row.discountMinor)}</TableCell>
                  <TableCell>{money(row.taxMinor)}</TableCell>
                  <TableCell>{money(row.totalMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={preview.data.subscriptionsDue}
            onPage={setPage}
            busy={preview.isFetching || run.isPending}
          />
          <Button
            disabled={
              run.isPending ||
              preview.isFetching ||
              preview.data.candidateInvoiceCount === 0
            }
            onClick={() => {
              if (!submitting.current) {
                submitting.current = true
                run.mutate()
              }
            }}
          >
            {run.isPending ? 'Processing billing…' : 'Run billing'}
          </Button>
        </>
      ) : null}
      {run.data ? (
        <Feedback
          message={`${run.data.invoicesCreated} invoices generated · ${run.data.subscriptionsSkipped} skipped · ${run.data.failures} failed · ${money(run.data.totalAmountMinor)} invoiced. Already processed periods are skipped. Review failures before retrying.`}
        />
      ) : null}
    </section>
  )
}

export const InvoicesPage = ({
  area,
  payments = false,
}: {
  area: 'admin' | 'app'
  payments?: boolean
}) => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | undefined>()
  const query = useQuery(
    orpc.invoice.list.queryOptions({
      input: { page, pageSize: 20, search, status },
    }),
  )
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">
        {payments ? 'Payments' : 'Invoices'}
      </h1>
      {payments ? (
        <p>
          Open an invoice to review its payment history or record a payment.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Search
          label="Search invoice, customer or subscription"
          value={search}
          onSearch={(value) => {
            setSearch(value)
            setPage(1)
          }}
        />
        <FinanceSelect
          label="Invoice status"
          value={status ?? 'ALL'}
          options={[
            'ALL',
            'DRAFT',
            'CONFIRMED',
            'PAID',
            'OVERDUE',
            'CANCELLED',
          ]}
          onChange={(value) => {
            setStatus(invoiceStatuses.find((item) => item === value))
            setPage(1)
          }}
        />
      </div>
      <Feedback error={query.error} />
      {query.isPending ? <p>Loading invoices…</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            {[
              'Invoice',
              'Customer',
              'Subscription',
              'Issued',
              'Due',
              'Total',
              'Paid',
              'Outstanding',
              'Status',
            ].map((title) => (
              <TableHead key={title}>{title}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  className="underline"
                  to={
                    area === 'admin'
                      ? '/admin/invoices/$invoiceId'
                      : '/app/invoices/$invoiceId'
                  }
                  params={{ invoiceId: row.id }}
                >
                  {row.invoiceNumber}
                </Link>
              </TableCell>
              <TableCell>{row.customerName}</TableCell>
              <TableCell>{row.subscriptionNumber}</TableCell>
              <TableCell>{displayDay(row.issueDate)}</TableCell>
              <TableCell>{displayDay(row.dueDate)}</TableCell>
              <TableCell>{money(row.totalMinor)}</TableCell>
              <TableCell>{money(row.amountPaidMinor)}</TableCell>
              <TableCell>{money(row.outstandingMinor)}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {row.overdue ? 'OVERDUE' : row.invoiceStatus}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {query.data?.total === 0 ? <p>No invoices match these filters.</p> : null}
      <Pagination
        page={page}
        total={query.data?.total ?? 0}
        onPage={setPage}
        busy={query.isFetching}
      />
    </section>
  )
}

export const InvoicePage = ({ id }: { id: string }) => {
  const client = useQueryClient()
  const query = useQuery(orpc.invoice.get.queryOptions({ input: { id } }))
  const [recording, setRecording] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)
  const [method, setMethod] = useState('BANK_TRANSFER')
  const mutation = useMutation({
    mutationFn: async (operation: 'confirm' | 'cancel') =>
      await apiClient.invoice[operation]({ id }),
    onSuccess: async () => {
      toast.success('Invoice updated')
      await client.invalidateQueries()
    },
  })
  const payment = useMutation({
    mutationFn: async (input: Parameters<typeof apiClient.payment.record>[0]) =>
      await apiClient.payment.record(input),
    onSuccess: async () => {
      await client.invalidateQueries()
      setRecording(false)
      toast.success('Payment recorded')
    },
  })
  const invoice = query.data
  if (!invoice) {
    return (
      <>
        <Feedback error={query.error} />
        <p>Loading invoice…</p>
      </>
    )
  }
  return (
    <article className="invoice-print flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Recurron / Brightloop</p>
          <h1 className="text-3xl font-semibold">{invoice.invoiceNumber}</h1>
          <p>{invoice.customerName}</p>
        </div>
        <Badge variant="outline">
          {invoice.overdue ? 'OVERDUE' : invoice.invoiceStatus}
        </Badge>
      </div>
      <div>
        <p>{invoice.subscriptionNumber}</p>
        <p>
          Billing period {displayDay(invoice.billingPeriodStart)} –{' '}
          {displayDay(invoice.billingPeriodEnd)}
        </p>
        <p>
          Issued {displayDay(invoice.issueDate)} · Due{' '}
          {displayDay(invoice.dueDate)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        {invoice.invoiceStatus === 'DRAFT' ? (
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              mutation.mutate('confirm')
            }}
          >
            Confirm invoice
          </Button>
        ) : null}
        {invoice.invoiceStatus === 'CONFIRMED' ? (
          <Button
            disabled={payment.isPending || mutation.isPending}
            onClick={() => {
              setRecording(true)
            }}
          >
            Record payment
          </Button>
        ) : null}
        {invoice.invoiceStatus === 'DRAFT' ||
        (invoice.invoiceStatus === 'CONFIRMED' &&
          invoice.payments.length === 0) ? (
          <Button
            variant="outline"
            disabled={mutation.isPending || payment.isPending}
            onClick={() => {
              mutation.mutate('cancel')
            }}
          >
            Cancel invoice
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => {
            window.print()
          }}
        >
          Print / Save as PDF
        </Button>
      </div>
      <Feedback error={mutation.error} />
      <Table>
        <TableHeader>
          <TableRow>
            {[
              'Description',
              'Quantity',
              'Unit price',
              'Subtotal',
              'Discount',
              'Tax',
              'Total',
            ].map((title) => (
              <TableHead key={title}>{title}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell>{line.description}</TableCell>
              <TableCell>{line.quantity}</TableCell>
              <TableCell>{money(line.unitPriceMinor)}</TableCell>
              <TableCell>{money(line.subtotalMinor)}</TableCell>
              <TableCell>{money(line.discountMinor)}</TableCell>
              <TableCell>
                {line.taxRateBps / 100}% · {money(line.taxMinor)}
              </TableCell>
              <TableCell>{money(line.totalMinor)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <dl className="ml-auto grid grid-cols-2 gap-x-12 gap-y-2">
        {[
          ['Subtotal', invoice.subtotalMinor],
          ['Discount', -invoice.discountTotalMinor],
          ['Tax', invoice.taxTotalMinor],
          ['Total', invoice.totalMinor],
          ['Paid', invoice.amountPaidMinor],
          ['Outstanding', invoice.outstandingMinor],
        ].map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="text-right font-medium">{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <Dialog
        open={recording}
        onOpenChange={(open) => {
          if (!payment.isPending) {
            setRecording(open)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Record a partial or full manual payment against this confirmed
              invoice.
            </DialogDescription>
          </DialogHeader>
          <form
            className="rounded border p-4 print:hidden"
            onSubmit={(event) => {
              event.preventDefault()
              if (payment.isPending) {
                return
              }
              const data = new FormData(event.currentTarget)
              try {
                const amountMinor = parseMinor(text(data, 'amount'))
                if (
                  amountMinor <= 0 ||
                  amountMinor > invoice.outstandingMinor
                ) {
                  setFormError(
                    new Error(
                      'Enter a positive amount within the outstanding balance',
                    ),
                  )
                  return
                }
                setFormError(null)
                payment.mutate({
                  amountMinor,
                  invoiceId: id,
                  note: text(data, 'note') || null,
                  reference: text(data, 'reference') || null,
                  paidAt: text(data, 'paidAt'),
                  paymentMethod:
                    paymentMethods.find((item) => item === method) ??
                    'BANK_TRANSFER',
                })
              } catch (error) {
                setFormError(error)
              }
            }}
          >
            <FieldGroup>
              <Feedback error={payment.error ?? formError} />
              <Field label="Amount" name="amount">
                <Input
                  id="amount"
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={formatMinor(invoice.outstandingMinor)}
                />
              </Field>
              <FinanceSelect
                label="Payment method"
                value={method}
                onChange={setMethod}
                options={['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'OTHER']}
              />
              <Field label="Payment date" name="paidAt">
                <Input
                  id="paidAt"
                  name="paidAt"
                  type="date"
                  required
                  defaultValue={today()}
                />
              </Field>
              <Field label="Reference" name="reference">
                <Input id="reference" name="reference" maxLength={200} />
              </Field>
              <Field label="Note" name="note">
                <Input id="note" name="note" maxLength={1000} />
              </Field>
              <Button type="submit" disabled={payment.isPending}>
                {payment.isPending ? 'Recording…' : 'Save payment'}
              </Button>
              <Button
                variant="outline"
                disabled={payment.isPending}
                onClick={() => {
                  setRecording(false)
                }}
              >
                Dismiss
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
      <section>
        <h2 className="text-lg font-semibold">Payment history</h2>
        {invoice.payments.length === 0 ? (
          <p>No payments recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {['Date', 'Method', 'Reference', 'Amount', 'Note'].map(
                  (title) => (
                    <TableHead key={title}>{title}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.payments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {displayDay(item.paidAt.toISOString().slice(0, 10))}
                  </TableCell>
                  <TableCell>{item.paymentMethod}</TableCell>
                  <TableCell>{item.reference ?? '—'}</TableCell>
                  <TableCell>{money(item.amountMinor)}</TableCell>
                  <TableCell>{item.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </article>
  )
}

export const PaymentsPage = ({ area }: { area: 'admin' | 'app' }) => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const query = useQuery(
    orpc.payment.list.queryOptions({ input: { page, pageSize: 20, search } }),
  )
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <Search
        label="Search invoice, customer or reference"
        value={search}
        onSearch={(value) => {
          setSearch(value)
          setPage(1)
        }}
      />
      <Feedback error={query.error} />
      {query.isPending ? <p>Loading payments…</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            {[
              'Invoice',
              'Customer',
              'Date',
              'Method',
              'Amount',
              'Reference',
            ].map((title) => (
              <TableHead key={title}>{title}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data?.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link
                  className="underline"
                  to={
                    area === 'admin'
                      ? '/admin/invoices/$invoiceId'
                      : '/app/invoices/$invoiceId'
                  }
                  params={{ invoiceId: item.invoiceId }}
                >
                  {item.invoiceNumber}
                </Link>
              </TableCell>
              <TableCell>{item.customerName}</TableCell>
              <TableCell>
                {displayDay(item.paidAt.toISOString().slice(0, 10))}
              </TableCell>
              <TableCell>{item.paymentMethod}</TableCell>
              <TableCell>{money(item.amountMinor)}</TableCell>
              <TableCell>{item.reference ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={page}
        total={query.data?.total ?? 0}
        onPage={setPage}
        busy={query.isFetching}
      />
    </section>
  )
}

export const FinanceOverview = ({ area }: { area: 'admin' | 'app' }) => {
  const query = useQuery(orpc.finance.summary.queryOptions({ input: {} }))
  const { data } = query
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Finance · current month</h2>
      <Feedback error={query.error} />
      {data ? (
        <>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Active subscriptions', String(data.activeSubscriptions)],
              ['Collected', money(data.collectedMinor)],
              ['Outstanding', money(data.outstandingMinor)],
              ['Overdue invoices', String(data.overdueInvoices)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            Needs attention:{' '}
            <Link
              className="underline"
              to={area === 'admin' ? '/admin/billing' : '/app/billing'}
            >
              {data.subscriptionsDue} subscriptions due for billing
            </Link>{' '}
            · {data.overdueInvoices} overdue invoices
          </p>
        </>
      ) : (
        <p>Loading financial summary…</p>
      )}
    </section>
  )
}
