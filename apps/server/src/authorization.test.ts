import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { os } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { operationalStatements, roles } from '@recurron/api/access'
import { createDatabase } from '@recurron/db'
import { customer, user } from '@recurron/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { createAuth } from './auth'
import {
  requireCustomer,
  requireOwnedCustomer,
  requirePermission,
} from './authorization'
import { createRpcContext } from './context'
import app from './index'

await test('Better Auth Admin, permissions, RPC sessions and ownership against Neon', async (t) => {
  const databaseUrl = process.env.DATABASE_URL
  assert.ok(
    databaseUrl !== undefined && databaseUrl !== '',
    'DATABASE_URL is required',
  )
  const env: Env = {
    BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
    BETTER_AUTH_URL: 'http://localhost:8787',
    DATABASE_URL: databaseUrl,
    WEB_ORIGIN: 'http://localhost:3000',
  }
  const auth = createAuth(env)
  const db = createDatabase(databaseUrl)
  const prefix = randomUUID()
  const password = randomUUID() + randomUUID()
  const emails: string[] = []
  const customerIds: string[] = []
  const emailFor = (label: string) => {
    const email = `${prefix}-${label}@example.com`
    emails.push(email)
    return email
  }
  const signin = async (email: string) => {
    const response = await auth.api.signInEmail({
      asResponse: true,
      body: { email, password },
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
    const signupResults = await Promise.allSettled(
      [undefined, 'ADMIN', 'STAFF'].map(async (requestedRole) => {
        const email = emailFor(requestedRole ?? 'default')
        const response = await app.request(
          `${env.BETTER_AUTH_URL}/api/auth/sign-up/email`,
          {
            body: JSON.stringify({
              email,
              name: 'Signup test',
              password,
              role: requestedRole,
            }),
            headers: {
              'Content-Type': 'application/json',
              Origin: env.WEB_ORIGIN,
            },
            method: 'POST',
          },
          env,
        )
        assert.equal(response.status, requestedRole === undefined ? 200 : 400)
        const persisted = await db
          .select()
          .from(user)
          .where(eq(user.email, email))
        if (requestedRole === undefined) {
          assert.equal(persisted[0]?.role, 'CUSTOMER')
        } else {
          assert.equal(persisted.length, 0)
        }
        return { email, id: persisted[0]?.id ?? '' }
      }),
    )
    const customers = signupResults.map((result) => {
      if (result.status === 'rejected') {
        throw new Error('Signup verification failed', { cause: result.reason })
      }
      return result.value
    })
    // Supported trusted server-only bootstrap, never exposed as a route.
    const admin = await auth.api.createUser({
      body: {
        email: emailFor('admin'),
        name: 'Temporary admin',
        password,
        role: 'ADMIN',
      },
    })
    const adminHeaders = await signin(admin.user.email)
    const staff = await auth.api.createUser({
      body: {
        email: emailFor('staff'),
        name: 'Temporary staff',
        password,
        role: 'STAFF',
      },
      headers: adminHeaders,
    })
    assert.equal(staff.user.role, 'STAFF')
    const staffHeaders = await signin(staff.user.email)
    const [firstCustomer] = customers
    assert.ok(firstCustomer)
    const customerHeaders = await signin(firstCustomer.email)

    await t.test(
      'built-in admin permissions and Recurron permission matrix use persisted roles',
      async () => {
        await Promise.all(
          (
            [
              [adminHeaders, true],
              [staffHeaders, false],
              [customerHeaders, false],
            ] as const
          ).map(async ([headers, permitted]) => {
            const result = await auth.api.userHasPermission({
              body: {
                permissions: {
                  session: ['revoke'],
                  user: ['create', 'set-role', 'list'],
                },
              },
              headers,
            })
            assert.equal(result.success, permitted)
          }),
        )
        await Promise.all(
          Object.entries(operationalStatements).map(
            async ([resource, actions]) => {
              assert.equal(
                roles.ADMIN.authorize({ [resource]: [...actions] }).success,
                true,
              )
              const customerPermission = await auth.api.userHasPermission({
                body: { permissions: { [resource]: [...actions] } },
                headers: customerHeaders,
              })
              assert.equal(customerPermission.success, resource === 'portal')
            },
          ),
        )
        const result1 = await auth.api.userHasPermission({
          body: {
            permissions: {
              invoice: ['confirm'],
              payment: ['create'],
              report: ['read'],
              subscription: ['activate', 'pause', 'renew', 'close'],
            },
          },
          headers: staffHeaders,
        })
        assert.equal(result1.success, true)
        await Promise.all(
          [
            { tax: ['create' as const] },
            { discount: ['update' as const] },
            { product: ['update' as const] },
            { plan: ['create' as const] },
          ].map(async (permissions) => {
            const result2 = await auth.api.userHasPermission({
              body: { permissions },
              headers: staffHeaders,
            })
            assert.equal(result2.success, false)
          }),
        )
      },
    )
    const adminOperational = await auth.api.userHasPermission({
      body: {
        permissions: Object.fromEntries(
          Object.entries(operationalStatements).map(([resource, actions]) => [
            resource,
            [...actions],
          ]),
        ),
      },
      headers: adminHeaders,
    })
    assert.equal(adminOperational.success, true)
    await t.test(
      'non-admins cannot create staff, assign roles or invoke unauthenticated admin routes',
      async () => {
        await Promise.all(
          [staffHeaders, customerHeaders].map(async (headers) => {
            await assert.rejects(
              auth.api.createUser({
                body: {
                  email: emailFor(randomUUID()),
                  name: 'Denied',
                  password,
                  role: 'STAFF',
                },
                headers,
              }),
            )
            await assert.rejects(
              auth.api.setRole({
                body: { role: 'STAFF', userId: firstCustomer.id },
                headers,
              }),
            )
          }),
        )
        const response = await app.request(
          `${env.BETTER_AUTH_URL}/api/auth/admin/create-user`,
          {
            body: JSON.stringify({
              email: emailFor('anonymous'),
              name: 'Denied',
              password,
              role: 'ADMIN',
            }),
            headers: {
              'Content-Type': 'application/json',
              Origin: env.WEB_ORIGIN,
            },
            method: 'POST',
          },
          env,
        )
        assert.equal(response.status, 401)
      },
    )
    await t.test(
      'oRPC authenticates and checks Better Auth permissions, ignoring forged actor inputs',
      async () => {
        // Test-only router uses the same context factory and middleware as application procedures.
        const procedure = os
          .$context<Awaited<ReturnType<typeof createRpcContext>>>()
          .use(requirePermission({ product: ['update' as const] }))
          .input(
            z.object({
              permissions: z.unknown().optional(),
              role: z.string().optional(),
              userId: z.string().optional(),
            }),
          )
          .handler(({ context }) => ({ actor: context.session.user.id }))
        const handler = new RPCHandler({ probe: procedure })
        const clientFor = (headers: Headers) =>
          createORPCClient<{
            probe: (input: {
              role?: string
              userId?: string
              permissions?: unknown
            }) => Promise<{ actor: string }>
          }>(
            new RPCLink({
              fetch: async (request) => {
                const req = new Request(request, { headers })
                const result = await handler.handle(req, {
                  context: await createRpcContext(env, req.headers),
                  prefix: '/rpc',
                })
                return result.response ?? new Response(null, { status: 404 })
              },
              url: `${env.BETTER_AUTH_URL}/rpc`,
            }),
          )
        await assert.rejects(clientFor(new Headers()).probe({}), {
          code: 'UNAUTHENTICATED',
          status: 401,
        })
        await assert.rejects(
          clientFor(customerHeaders).probe({
            permissions: { product: ['update' as const] },
            role: 'ADMIN',
            userId: admin.user.id,
          }),
          { code: 'FORBIDDEN', status: 403 },
        )
        const result3 = await clientFor(adminHeaders).probe({
          role: 'CUSTOMER',
          userId: firstCustomer.id,
        })
        assert.equal(result3.actor, admin.user.id)
      },
    )
    await t.test(
      'customer ownership fails closed and scopes requested records',
      async () => {
        const context = await createRpcContext(env, customerHeaders)
        await assert.rejects(requireCustomer(context), { code: 'FORBIDDEN' })
        const ownId = randomUUID()
        const otherId = randomUUID()
        customerIds.push(ownId, otherId)
        await db.insert(customer).values([
          {
            email: emailFor('business-own'),
            id: ownId,
            name: 'Own customer',
            userId: firstCustomer.id,
          },
          {
            email: emailFor('business-other'),
            id: otherId,
            name: 'Other customer',
          },
        ])
        const result4 = await requireCustomer(context)
        assert.equal(result4.id, ownId)
        const result5 = await requireOwnedCustomer(context, ownId)
        assert.equal(result5.id, ownId)
        await assert.rejects(requireOwnedCustomer(context, otherId), {
          code: 'FORBIDDEN',
        })
        await assert.rejects(
          requireCustomer(await createRpcContext(env, staffHeaders)),
          { code: 'FORBIDDEN' },
        )
      },
    )
  } finally {
    if (customerIds.length > 0) {
      await db.delete(customer).where(inArray(customer.id, customerIds))
    }
    await db.delete(user).where(inArray(user.email, emails))
    const remaining = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, emails))
    assert.equal(remaining.length, 0)
  }
})
