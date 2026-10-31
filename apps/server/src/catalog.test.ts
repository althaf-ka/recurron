import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import type { apiContract } from '@recurron/api'
import { parseMinor } from '@recurron/api/money'
import { createDatabase } from '@recurron/db'
import {
  customer,
  product,
  productVariant,
  subscriptionPlan,
  user,
} from '@recurron/db/schema'
import { eq, like, sql } from 'drizzle-orm'
import { createAuth } from './auth'
import app from './index'

type Client = ContractRouterClient<typeof apiContract>
const productData = (name: string) => ({
  costPriceMinor: parseMinor('3000.00'),
  currencyCode: 'INR',
  isActive: true,
  name,
  notes: null,
  productType: 'SERVICE' as const,
  salesPriceMinor: parseMinor('4999.00'),
  variants: [
    {
      attributeName: 'Brand',
      isActive: true,
      price_delta_minor: parseMinor('560.00'),
      valueName: 'Odoo',
    },
    {
      attributeName: 'Edition',
      isActive: true,
      price_delta_minor: parseMinor('-120.50'),
      valueName: 'Basic',
    },
  ],
})
const planData = (name: string) => ({
  allowEarlyClose: true,
  allowPause: true,
  allowRenewal: true,
  autoCloseOnExpiry: true,
  availableFrom: '2026-01-01',
  availableUntil: '2026-12-31',
  billingFrequency: 'MONTHLY' as const,
  isActive: true,
  minimumQuantity: 1,
  name,
})
const customerData = (name: string, email: string) => ({
  billingAddress: '12 Example Street',
  companyName: 'Example Company',
  email,
  name,
  phone: '+919999999999',
})

const clientFor = (env: Env, headers: Headers): Client =>
  createORPCClient(
    new RPCLink({
      fetch: async (request, init) => {
        const req = new Request(request, init)
        for (const [key, value] of headers) {
          req.headers.set(key, value)
        }
        return await app.request(req, {}, env)
      },
      url: `${env.BETTER_AUTH_URL}/rpc`,
    }),
  )

await test('Phase 4A catalog and customer workflows against Neon', async (t) => {
  const databaseUrl = process.env.DATABASE_URL
  assert.ok(
    databaseUrl !== undefined && databaseUrl !== '',
    'DATABASE_URL is required for Neon integration tests',
  )
  const env: Env = {
    BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
    BETTER_AUTH_URL: 'http://localhost:8787',
    DATABASE_URL: databaseUrl,
    WEB_ORIGIN: 'http://localhost:3000',
  }
  const db = createDatabase(databaseUrl)
  const auth = createAuth(env)
  const prefix = `phase4-${randomUUID()}`
  const password = randomUUID() + randomUUID()
  const email = (label: string) => `${prefix}-${label}@example.com`
  const signIn = async (address: string) => {
    const response = await auth.api.signInEmail({
      asResponse: true,
      body: { email: address, password },
    })
    assert.equal(response.status, 200)
    return new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; '),
    })
  }
  try {
    await auth.api.createUser({
      body: { email: email('admin'), name: prefix, password, role: 'ADMIN' },
    })
    const adminHeaders = await signIn(email('admin'))
    await auth.api.createUser({
      body: { email: email('staff'), name: prefix, password, role: 'STAFF' },
      headers: adminHeaders,
    })
    await auth.api.createUser({
      body: {
        email: email('portal'),
        name: prefix,
        password,
        role: 'CUSTOMER',
      },
      headers: adminHeaders,
    })
    const admin = clientFor(env, adminHeaders)
    const staff = clientFor(env, await signIn(email('staff')))
    const portal = clientFor(env, await signIn(email('portal')))
    const anonymous = clientFor(env, new Headers())
    const productInput = productData(`${prefix}-product`)
    const planInput = planData(`${prefix}-plan`)
    const createdProduct = await admin.product.create(productInput)
    const createdPlan = await admin.plan.create(planInput)
    const createdCustomer = await admin.customer.create(
      customerData(`${prefix}-customer`, email('business')),
    )

    await t.test(
      'ADMIN product creation persists exact money and signed variant deltas; STAFF reads',
      async () => {
        const record = await staff.product.get(createdProduct)
        assert.equal(record.salesPriceMinor, 499_900)
        assert.equal(record.costPriceMinor, 300_000)
        assert.deepEqual(
          new Set(record.variants.map((variant) => variant.price_delta_minor)),
          new Set([-12_050, 56_000]),
        )
        const [persisted] = await db
          .select()
          .from(product)
          .where(eq(product.id, createdProduct.id))
        assert.equal(persisted?.salesPriceMinor, 499_900)
        const persistedVariants = await db
          .select()
          .from(productVariant)
          .where(eq(productVariant.productId, createdProduct.id))
        assert.deepEqual(
          new Set(persistedVariants.map((variant) => variant.priceDeltaMinor)),
          new Set([-12_050, 56_000]),
        )
        await admin.product.update({
          data: {
            ...productInput,
            salesPriceMinor: parseMinor('5100.00'),
            variants: productInput.variants.filter(
              (variant) => variant.valueName === 'Odoo',
            ),
          },
          id: createdProduct.id,
        })
        const updated = await admin.product.get(createdProduct)
        assert.equal(updated.salesPriceMinor, 510_000)
        assert.equal(
          updated.variants.find((variant) => variant.valueName === 'Basic')
            ?.isActive,
          false,
        )
        const retained = await db
          .select()
          .from(productVariant)
          .where(eq(productVariant.productId, createdProduct.id))
        assert.equal(
          retained.find((variant) => variant.valueName === 'Odoo')?.id,
          persistedVariants.find((variant) => variant.valueName === 'Odoo')?.id,
        )
      },
    )

    await t.test(
      'product variant failures roll back the entire create/update transaction',
      async () => {
        const duplicate = productData(`${prefix}-rollback`)
        duplicate.variants.push(...duplicate.variants)
        await assert.rejects(admin.product.create(duplicate), {
          code: 'CONFLICT',
        })
        const result = await admin.product.list({ search: duplicate.name })
        assert.equal(result.total, 0)
        const before = await admin.product.get(createdProduct)
        await assert.rejects(
          admin.product.update({
            data: { ...duplicate, name: `${prefix}-changed` },
            id: createdProduct.id,
          }),
          { code: 'CONFLICT' },
        )
        const after = await admin.product.get(createdProduct)
        assert.deepEqual(after, before)
      },
    )

    await t.test(
      'STAFF reads catalog but cannot mutate products or plans',
      async () => {
        const result1 = await staff.product.list({ search: prefix })
        assert.equal(result1.total, 1)
        const result2 = await staff.plan.get(createdPlan)
        assert.equal(result2.billingFrequency, 'MONTHLY')
        const result3 = await staff.plan.list({ search: prefix })
        assert.equal(result3.total, 1)
        await assert.rejects(staff.product.create(productInput), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(
          staff.product.update({ data: productInput, id: createdProduct.id }),
          { code: 'FORBIDDEN' },
        )
        await assert.rejects(staff.product.archive(createdProduct), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(staff.plan.create(planInput), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(
          staff.plan.update({ data: planInput, id: createdPlan.id }),
          { code: 'FORBIDDEN' },
        )
        await assert.rejects(staff.plan.archive(createdPlan), {
          code: 'FORBIDDEN',
        })
      },
    )

    await t.test(
      'CUSTOMER and anonymous callers cannot access internal operations',
      async () => {
        await assert.rejects(portal.product.list({}), { code: 'FORBIDDEN' })
        await assert.rejects(portal.product.get(createdProduct), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(portal.product.create(productInput), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(portal.plan.list({}), { code: 'FORBIDDEN' })
        await assert.rejects(portal.plan.get(createdPlan), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(portal.plan.create(planInput), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(portal.customer.list({}), { code: 'FORBIDDEN' })
        await assert.rejects(portal.customer.get(createdCustomer), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(
          portal.customer.create(customerData(prefix, email('denied'))),
          { code: 'FORBIDDEN' },
        )
        await assert.rejects(anonymous.product.list({}), {
          code: 'UNAUTHENTICATED',
        })
        await assert.rejects(anonymous.plan.list({}), {
          code: 'UNAUTHENTICATED',
        })
        await assert.rejects(anonymous.customer.list({}), {
          code: 'UNAUTHENTICATED',
        })
      },
    )

    await t.test(
      'ADMIN updates plans; invalid quantity, dates and frequency are rejected',
      async () => {
        await admin.plan.update({
          data: { ...planInput, minimumQuantity: 3 },
          id: createdPlan.id,
        })
        const result4 = await staff.plan.get(createdPlan)
        assert.equal(result4.minimumQuantity, 3)
        await assert.rejects(
          admin.plan.create({ ...planInput, minimumQuantity: 0 }),
          { code: 'BAD_REQUEST' },
        )
        await assert.rejects(
          admin.plan.create({ ...planInput, availableUntil: '2025-01-01' }),
          { code: 'BAD_REQUEST' },
        )
        await assert.rejects(
          admin.plan.update({
            data: { ...planInput, minimumQuantity: -1 },
            id: createdPlan.id,
          }),
          { code: 'BAD_REQUEST' },
        )
        await assert.rejects(
          admin.plan.create({ ...planInput, availableFrom: '2026-02-30' }),
          { code: 'BAD_REQUEST' },
        )
      },
    )

    await t.test(
      'ADMIN and STAFF manage independent customers; duplicate emails conflict safely',
      async () => {
        const data = customerData(`${prefix}-updated`, email('business'))
        await admin.customer.update({ data, id: createdCustomer.id })
        await staff.customer.update({
          data: { ...data, companyName: `${prefix}-updated-company` },
          id: createdCustomer.id,
        })
        const result5 = await admin.customer.get(createdCustomer)
        assert.equal(result5.companyName, `${prefix}-updated-company`)
        const another = await staff.customer.create(
          customerData(`${prefix}-staff-customer`, email('staff-business')),
        )
        await admin.customer.update({
          data: customerData(
            `${prefix}-staff-updated`,
            email('staff-business'),
          ),
          id: another.id,
        })
        const [row] = await db
          .select()
          .from(customer)
          .where(eq(customer.id, another.id))
        assert.equal(row?.userId, null)
        await assert.rejects(staff.customer.create(data), { code: 'CONFLICT' })
        const result6 = await staff.customer.list({ search: email('business') })
        assert.equal(result6.total, 1)
        const result7 = await staff.customer.list({
          search: `${prefix}-updated-company`,
        })
        assert.equal(
          result7.items.some((item) => item.id === createdCustomer.id),
          true,
        )
      },
    )

    await t.test(
      'database pagination, literal search and not-found errors',
      async () => {
        await admin.product.create(productData(`${prefix}-second`))
        const first = await staff.product.list({
          page: 1,
          pageSize: 1,
          search: prefix,
        })
        const second = await staff.product.list({
          page: 2,
          pageSize: 1,
          search: prefix,
        })
        assert.equal(first.total, 2)
        assert.equal(first.items.length, 1)
        assert.equal(second.items.length, 1)
        assert.notEqual(first.items[0]?.id, second.items[0]?.id)
        const result8 = await staff.product.list({
          page: 3,
          pageSize: 1,
          search: prefix,
        })
        assert.equal(result8.items.length, 0)
        const result9 = await staff.product.list({ search: `${prefix}%` })
        assert.equal(result9.total, 0)
        await assert.rejects(admin.product.get({ id: randomUUID() }), {
          code: 'NOT_FOUND',
        })
        await assert.rejects(
          admin.product.update({ data: productInput, id: randomUUID() }),
          { code: 'NOT_FOUND' },
        )
        await assert.rejects(admin.plan.get({ id: randomUUID() }), {
          code: 'NOT_FOUND',
        })
        await assert.rejects(
          staff.customer.update({
            data: customerData(prefix, email('missing')),
            id: randomUUID(),
          }),
          { code: 'NOT_FOUND' },
        )
      },
    )

    await t.test(
      'ADMIN archives products and plans without deletion',
      async () => {
        await admin.product.archive(createdProduct)
        await admin.plan.archive(createdPlan)
        const result10 = await staff.product.get(createdProduct)
        assert.equal(result10.isActive, false)
        const result11 = await staff.plan.get(createdPlan)
        assert.equal(result11.isActive, false)
      },
    )
  } finally {
    // Restrict cleanup to this run's random prefix, including fixtures created before an assertion fails.
    await db.batch([
      db
        .delete(productVariant)
        .where(
          sql`${productVariant.productId} in (select ${product.id} from ${product} where ${product.name} like ${`${prefix}%`})`,
        ),
      db.delete(product).where(like(product.name, `${prefix}%`)),
      db
        .delete(subscriptionPlan)
        .where(like(subscriptionPlan.name, `${prefix}%`)),
      db.delete(customer).where(like(customer.email, `${prefix}%`)),
      db.delete(user).where(like(user.email, `${prefix}%`)),
    ])
  }
})
