import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import type { apiContract } from '@recurron/api'
import { directoryInput, planInput, productInput } from '@recurron/api/catalog'
import { parseMinor } from '@recurron/api/money'
import { databaseOperation } from './modules/errors'
import app from './index'

const plan = {
  allowEarlyClose: true,
  allowPause: true,
  allowRenewal: true,
  autoCloseOnExpiry: true,
  availableFrom: '2026-01-01',
  availableUntil: '2026-12-31',
  billingFrequency: 'MONTHLY',
  isActive: true,
  minimumQuantity: 1,
  name: 'Monthly service',
}

await test('plan contract enforces valid dates, frequency and positive integer quantity', () => {
  assert.equal(planInput.safeParse(plan).success, true)
  assert.equal(
    planInput.safeParse({ ...plan, minimumQuantity: 0 }).success,
    false,
  )
  assert.equal(
    planInput.safeParse({ ...plan, minimumQuantity: 1.5 }).success,
    false,
  )
  assert.equal(
    planInput.safeParse({ ...plan, availableUntil: '2025-12-31' }).success,
    false,
  )
  assert.equal(
    planInput.safeParse({ ...plan, availableFrom: '2026-02-30' }).success,
    false,
  )
  assert.equal(
    planInput.safeParse({ ...plan, billingFrequency: 'QUARTERLY' }).success,
    false,
  )
  assert.equal(
    planInput.safeParse({ ...plan, availableUntil: null }).success,
    true,
  )
})

await test('product contract validates exact safe minor units and signed variant adjustments', () => {
  const data = {
    costPriceMinor: 0,
    currencyCode: 'INR',
    isActive: true,
    name: 'Service',
    notes: null,
    productType: 'SERVICE',
    salesPriceMinor: parseMinor('4999.00'),
    variants: [
      {
        attributeName: 'Brand',
        price_delta_minor: parseMinor('560.00'),
        valueName: 'Odoo',
      },
      {
        attributeName: 'Edition',
        price_delta_minor: parseMinor('-120.50'),
        valueName: 'Basic',
      },
    ],
  }
  const parsed = productInput.parse(data)
  assert.equal(parsed.salesPriceMinor, 499_900)
  assert.deepEqual(
    parsed.variants.map((variant) => variant.price_delta_minor),
    [56_000, -12_050],
  )
  assert.equal(parsed.variants[0]?.isActive, true)
  assert.equal(
    productInput.safeParse({ ...data, salesPriceMinor: -1 }).success,
    false,
  )
  assert.equal(
    productInput.safeParse({ ...data, salesPriceMinor: 1.1 }).success,
    false,
  )
  assert.equal(
    productInput.safeParse({
      ...data,
      costPriceMinor: Number.MAX_SAFE_INTEGER + 1,
    }).success,
    false,
  )
  assert.equal(
    productInput.safeParse({
      ...data,
      variants: [
        { ...data.variants[0], price_delta_minor: Number.MAX_SAFE_INTEGER + 1 },
      ],
    }).success,
    false,
  )
})

await test('directory contract bounds database page sizes and defaults', () => {
  assert.deepEqual(directoryInput.parse({}), {
    page: 1,
    pageSize: 20,
    search: '',
  })
  assert.equal(directoryInput.safeParse({ page: 0 }).success, false)
  assert.equal(directoryInput.safeParse({ pageSize: 101 }).success, false)
})

await test('database failures become sanitized typed errors', async () => {
  await assert.rejects(
    databaseOperation(
      async () =>
        await Promise.reject(
          new Error('sensitive SQL', {
            cause: Object.assign(new Error('duplicate secret'), {
              code: '23505',
            }),
          }),
        ),
    ),
    { code: 'CONFLICT', message: 'Record conflicts with existing data' },
  )
  await assert.rejects(
    databaseOperation(
      async () =>
        await Promise.reject(
          Object.assign(new Error('check detail'), { code: '23514' }),
        ),
    ),
    { code: 'BAD_REQUEST', message: 'Invalid record values' },
  )
  await assert.rejects(
    databaseOperation(
      async () => await Promise.reject(new Error('private connection string')),
    ),
    { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to complete request' },
  )
})

await test('wired internal procedures reject anonymous requests before database access', async () => {
  const env: Env = {
    BETTER_AUTH_SECRET: 'synthetic-test-secret-with-at-least-32-characters',
    BETTER_AUTH_URL: 'http://localhost:8787',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    WEB_ORIGIN: 'http://localhost:3000',
  }
  const client: ContractRouterClient<typeof apiContract> = createORPCClient(
    new RPCLink({
      fetch: async (request, init) =>
        await app.request(new Request(request, init), {}, env),
      url: `${env.BETTER_AUTH_URL}/rpc`,
    }),
  )
  await assert.rejects(client.product.list({}), {
    code: 'UNAUTHENTICATED',
    status: 401,
  })
  await assert.rejects(client.plan.list({}), {
    code: 'UNAUTHENTICATED',
    status: 401,
  })
  await assert.rejects(client.customer.list({}), {
    code: 'UNAUTHENTICATED',
    status: 401,
  })
})
