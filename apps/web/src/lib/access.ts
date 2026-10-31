import { roleNames } from '@recurron/api/access'
import type { Permission } from '@recurron/api/access'
import { redirect } from '@tanstack/react-router'
import { authClient } from './auth'

export const can = (
  value: string | null | undefined,
  permissions: Permission,
) => {
  const role = roleNames.find((name) => name === value)
  return (
    role !== undefined &&
    authClient.admin.checkRolePermission({ permissions, role })
  )
}

export const homeFor = (role: string | null | undefined) => {
  if (can(role, { product: ['create'] })) {
    return '/admin' as const
  }
  return can(role, { customer: ['read'] })
    ? ('/app' as const)
    : ('/portal' as const)
}

export const getSession = async () => {
  const result = await authClient.getSession()
  if (result.error) {
    throw new Error('Unable to check your session. Please try again.')
  }
  return result.data
}

export const requireSession = async (
  permissions?: Permission,
): Promise<void> => {
  const session = await getSession()
  if (!session) {
    redirect({ throw: true, replace: true, to: '/login' })
    return
  }
  if (permissions !== undefined && !can(session.user.role, permissions)) {
    redirect({
      throw: true,
      replace: true,
      to: homeFor(session.user.role),
    })
  }
}

export const useAccess = () => {
  const session = authClient.useSession()
  return (permissions: Permission) => can(session.data?.user.role, permissions)
}
