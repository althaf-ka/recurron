import { implement } from '@orpc/server'
import { apiContract } from '@recurron/api'
import { requirePermission } from './authorization'
import type { RpcContext } from './authorization'
import {
  archive as archiveProduct,
  create as createProduct,
  get as getProduct,
  list as listProduct,
  update as updateProduct,
} from './modules/product/service'
import {
  archive as archivePlan,
  create as createPlan,
  get as getPlan,
  list as listPlan,
  update as updatePlan,
} from './modules/plan/service'
import {
  create as createCustomer,
  get as getCustomer,
  list as listCustomer,
  update as updateCustomer,
} from './modules/customer/service'
import {
  archiveTemplate,
  createTemplate,
  create as createSubscription,
  get as getSubscription,
  getTemplate,
  listTemplates,
  lifecycle as subscriptionLifecycle,
  list as listSubscriptions,
  updateTemplate,
  updateDraft as updateSubscriptionDraft,
} from './modules/subscription/service'
import {
  preview as previewBilling,
  run as runBilling,
} from './modules/financial/billing'
import {
  createDiscount,
  createTax,
  getDiscount,
  getTax,
  listDiscounts,
  listTaxes,
  updateDiscount,
  updateTax,
} from './modules/financial/configuration'
import {
  cancel as cancelInvoice,
  confirm as confirmInvoice,
  get as getInvoice,
  list as listInvoices,
  listPayments,
} from './modules/financial/invoice'
import { recordPayment } from './modules/financial/payment'
import {
  financeSummary,
  listPaymentDirectory,
} from './modules/financial/reporting'

const implementation = implement(apiContract).$context<RpcContext>()

export const router = implementation.router({
  billing: {
    preview: implementation.billing.preview
      .use(requirePermission({ billing: ['preview'] }))
      .handler(
        async ({ context, input }) =>
          await previewBilling(context.databaseUrl, input),
      ),
    run: implementation.billing.run
      .use(requirePermission({ billing: ['run'] }))
      .handler(
        async ({ context, input }) =>
          await runBilling(context.databaseUrl, input.billingDate),
      ),
  },
  customer: {
    create: implementation.customer.create
      .use(requirePermission({ customer: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createCustomer(context.databaseUrl, input),
      ),
    get: implementation.customer.get
      .use(requirePermission({ customer: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getCustomer(context.databaseUrl, input.id),
      ),
    list: implementation.customer.list
      .use(requirePermission({ customer: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listCustomer(context.databaseUrl, input),
      ),
    update: implementation.customer.update
      .use(requirePermission({ customer: ['update'] }))
      .handler(
        async ({ context, input }) =>
          await updateCustomer(context.databaseUrl, input.id, input.data),
      ),
  },
  discount: {
    create: implementation.discount.create
      .use(requirePermission({ discount: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createDiscount(context.databaseUrl, input),
      ),
    get: implementation.discount.get
      .use(requirePermission({ discount: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getDiscount(context.databaseUrl, input.id),
      ),
    list: implementation.discount.list
      .use(requirePermission({ discount: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listDiscounts(context.databaseUrl, input),
      ),
    update: implementation.discount.update
      .use(requirePermission({ discount: ['update'] }))
      .handler(
        async ({ context, input }) =>
          await updateDiscount(context.databaseUrl, input.id, input.data),
      ),
  },
  finance: {
    summary: implementation.finance.summary
      .use(requirePermission({ report: ['read'] }))
      .handler(
        async ({ context }) => await financeSummary(context.databaseUrl),
      ),
  },
  invoice: {
    cancel: implementation.invoice.cancel
      .use(requirePermission({ invoice: ['cancel'] }))
      .handler(
        async ({ context, input }) =>
          await cancelInvoice(context.databaseUrl, input.id),
      ),
    confirm: implementation.invoice.confirm
      .use(requirePermission({ invoice: ['confirm'] }))
      .handler(
        async ({ context, input }) =>
          await confirmInvoice(context.databaseUrl, input.id),
      ),
    get: implementation.invoice.get
      .use(requirePermission({ invoice: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getInvoice(context.databaseUrl, input.id),
      ),
    list: implementation.invoice.list
      .use(requirePermission({ invoice: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listInvoices(context.databaseUrl, input),
      ),
  },
  payment: {
    list: implementation.payment.list
      .use(requirePermission({ payment: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listPaymentDirectory(context.databaseUrl, input),
      ),
    listForInvoice: implementation.payment.listForInvoice
      .use(requirePermission({ payment: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listPayments(context.databaseUrl, input.invoiceId),
      ),
    record: implementation.payment.record
      .use(requirePermission({ payment: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await recordPayment(context.databaseUrl, input),
      ),
  },
  plan: {
    archive: implementation.plan.archive
      .use(requirePermission({ plan: ['archive'] }))
      .handler(
        async ({ context, input }) =>
          await archivePlan(context.databaseUrl, input.id),
      ),
    create: implementation.plan.create
      .use(requirePermission({ plan: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createPlan(context.databaseUrl, input),
      ),
    get: implementation.plan.get
      .use(requirePermission({ plan: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getPlan(context.databaseUrl, input.id),
      ),
    list: implementation.plan.list
      .use(requirePermission({ plan: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listPlan(context.databaseUrl, input),
      ),
    update: implementation.plan.update
      .use(requirePermission({ plan: ['update'] }))
      .handler(
        async ({ context, input }) =>
          await updatePlan(context.databaseUrl, input.id, input.data),
      ),
  },
  product: {
    archive: implementation.product.archive
      .use(requirePermission({ product: ['archive'] }))
      .handler(
        async ({ context, input }) =>
          await archiveProduct(context.databaseUrl, input.id),
      ),
    create: implementation.product.create
      .use(requirePermission({ product: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createProduct(context.databaseUrl, input),
      ),
    get: implementation.product.get
      .use(requirePermission({ product: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getProduct(context.databaseUrl, input.id),
      ),
    list: implementation.product.list
      .use(requirePermission({ product: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listProduct(context.databaseUrl, input),
      ),
    update: implementation.product.update
      .use(requirePermission({ product: ['update'] }))
      .handler(
        async ({ context, input }) =>
          await updateProduct(context.databaseUrl, input.id, input.data),
      ),
  },
  quotationTemplate: {
    archive: implementation.quotationTemplate.archive
      .use(requirePermission({ quotationTemplate: ['archive'] }))
      .handler(
        async ({ context, input }) =>
          await archiveTemplate(context.databaseUrl, input.id),
      ),
    create: implementation.quotationTemplate.create
      .use(requirePermission({ quotationTemplate: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createTemplate(context.databaseUrl, input),
      ),
    get: implementation.quotationTemplate.get
      .use(requirePermission({ quotationTemplate: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getTemplate(context.databaseUrl, input.id),
      ),
    list: implementation.quotationTemplate.list
      .use(requirePermission({ quotationTemplate: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listTemplates(context.databaseUrl, input),
      ),
    update: implementation.quotationTemplate.update
      .use(requirePermission({ quotationTemplate: ['update'] }))
      .handler(
        async ({ context, input }) =>
          await updateTemplate(context.databaseUrl, input.id, input.data),
      ),
  },
  subscription: {
    activate: implementation.subscription.activate
      .use(requirePermission({ subscription: ['activate'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(
            context.databaseUrl,
            input.id,
            'activate',
          ),
      ),
    close: implementation.subscription.close
      .use(requirePermission({ subscription: ['close'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(context.databaseUrl, input.id, 'close'),
      ),
    confirm: implementation.subscription.confirm
      .use(requirePermission({ subscription: ['confirm'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(context.databaseUrl, input.id, 'confirm'),
      ),
    create: implementation.subscription.create
      .use(requirePermission({ subscription: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createSubscription(context.databaseUrl, input),
      ),
    createQuotation: implementation.subscription.createQuotation
      .use(requirePermission({ subscription: ['quote'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(
            context.databaseUrl,
            input.id,
            'createQuotation',
          ),
      ),
    get: implementation.subscription.get
      .use(requirePermission({ subscription: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getSubscription(context.databaseUrl, input.id),
      ),
    list: implementation.subscription.list
      .use(requirePermission({ subscription: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listSubscriptions(context.databaseUrl, input),
      ),
    pause: implementation.subscription.pause
      .use(requirePermission({ subscription: ['pause'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(context.databaseUrl, input.id, 'pause'),
      ),
    renew: implementation.subscription.renew
      .use(requirePermission({ subscription: ['renew'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(context.databaseUrl, input.id, 'renew'),
      ),
    resume: implementation.subscription.resume
      .use(requirePermission({ subscription: ['activate'] }))
      .handler(
        async ({ context, input }) =>
          await subscriptionLifecycle(context.databaseUrl, input.id, 'resume'),
      ),
    updateDraft: implementation.subscription.updateDraft
      .use(requirePermission({ subscription: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await updateSubscriptionDraft(
            context.databaseUrl,
            input.id,
            input.data,
          ),
      ),
  },
  system: {
    ping: implementation.system.ping.handler(() => ({ message: 'pong' })),
  },
  tax: {
    create: implementation.tax.create
      .use(requirePermission({ tax: ['create'] }))
      .handler(
        async ({ context, input }) =>
          await createTax(context.databaseUrl, input),
      ),
    get: implementation.tax.get
      .use(requirePermission({ tax: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await getTax(context.databaseUrl, input.id),
      ),
    list: implementation.tax.list
      .use(requirePermission({ tax: ['read'] }))
      .handler(
        async ({ context, input }) =>
          await listTaxes(context.databaseUrl, input),
      ),
    update: implementation.tax.update
      .use(requirePermission({ tax: ['update'] }))
      .handler(
        async ({ context, input }) =>
          await updateTax(context.databaseUrl, input.id, input.data),
      ),
  },
})
