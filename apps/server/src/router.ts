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

const implementation = implement(apiContract).$context<RpcContext>()

export const router = implementation.router({
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
})
