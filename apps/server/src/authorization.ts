import { ORPCError, os } from '@orpc/server'
import type { Permission } from '@recurron/api/access'
import { createDatabase } from '@recurron/db'
import { findCustomerForUser, findOwnedCustomer } from '@recurron/db/ownership'
import type { createAuth } from './auth'

type Auth = ReturnType<typeof createAuth>
export interface RpcContext {
  auth: Auth
  databaseUrl: string
  headers: Headers
  session: Awaited<ReturnType<Auth['api']['getSession']>>
}

export const requireAuth = os
  .$context<RpcContext>()
  .middleware(({ context, next }) => {
    if (!context.session) {
      throw new ORPCError('UNAUTHENTICATED', {
        message: 'Authentication required',
        status: 401,
      })
    }
    return next({ context: { session: context.session } })
  })

export const requirePermission = (permissions: Permission) =>
  // oxlint-disable-next-line unicorn/prefer-spread -- oRPC middleware composition, not Array.concat.
  requireAuth.concat(async ({ context, next }) => {
    const result = await context.auth.api.userHasPermission({
      body: { permissions },
      headers: context.headers,
    })
    if (!result.success) {
      throw new ORPCError('FORBIDDEN', { message: 'Access denied' })
    }
    return await next()
  })

export const requireCustomer = async (context: RpcContext) => {
  if (!context.session) {
    throw new ORPCError('UNAUTHENTICATED', {
      message: 'Authentication required',
      status: 401,
    })
  }
  const result = await context.auth.api.userHasPermission({
    body: { permissions: { portal: ['access'] } },
    headers: context.headers,
  })
  if (!result.success) {
    throw new ORPCError('FORBIDDEN', { message: 'Access denied' })
  }
  const customer = await findCustomerForUser(
    createDatabase(context.databaseUrl),
    context.session.user.id,
  )
  if (!customer) {
    throw new ORPCError('FORBIDDEN', { message: 'Access denied' })
  }
  return customer
}

// Resolve the requested record with ownership in the SQL predicate.
export const requireOwnedCustomer = async (
  context: RpcContext,
  requestedCustomerId: string,
) => {
  const customer = await requireCustomer(context)
  const owned = await findOwnedCustomer(
    createDatabase(context.databaseUrl),
    requestedCustomerId,
    customer.id,
  )
  if (!owned) {
    throw new ORPCError('FORBIDDEN', { message: 'Access denied' })
  }
  return owned
}
