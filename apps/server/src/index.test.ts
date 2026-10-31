import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import type { apiContract } from '@recurron/api'
import app from './index'

// Synthetic configuration. These checks never connect to a database.
const env: Env = {
  WEB_ORIGIN: 'http://localhost:3000',
  BETTER_AUTH_URL: 'http://localhost:8787',
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  BETTER_AUTH_SECRET: 'synthetic-test-secret-with-at-least-32-characters',
}

test('health is a liveness check without database I/O', async () => {
  const response = await app.request('/health', {}, env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('contract client calls system.ping through the Hono fetch handler', async () => {
  const client: ContractRouterClient<typeof apiContract> = createORPCClient(
    new RPCLink({
      url: 'http://localhost/rpc',
      fetch: async (request, init) =>
        app.request(new Request(request, init), {}, env),
    }),
  )
  assert.deepEqual(await client.system.ping(), { message: 'pong' })
})

test('credentialed preflight permits the explicit web origin', async () => {
  for (const path of ['/rpc/system/ping', '/api/auth/sign-in/email']) {
    const response = await app.request(
      path,
      {
        method: 'OPTIONS',
        headers: {
          Origin: env.WEB_ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      },
      env,
    )
    assert.equal(response.status, 204)
    assert.equal(
      response.headers.get('Access-Control-Allow-Origin'),
      env.WEB_ORIGIN,
    )
    assert.equal(
      response.headers.get('Access-Control-Allow-Credentials'),
      'true',
    )
  }
})

test('CORS does not authorize an unrelated origin', async () => {
  const response = await app.request(
    '/health',
    {
      headers: { Origin: 'https://untrusted.example' },
    },
    env,
  )
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
})

test('Better Auth is mounted directly at its HTTP endpoint', async () => {
  const response = await app.request('/api/auth/ok', {}, env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
})

test('unknown RPC procedures return 404', async () => {
  const response = await app.request(
    '/rpc/does-not-exist',
    { method: 'POST' },
    env,
  )
  assert.equal(response.status, 404)
})
