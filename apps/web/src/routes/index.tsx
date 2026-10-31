import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession, homeFor } from '../lib/access'

export const Route = createFileRoute('/')({
  beforeLoad: async (): Promise<void> => {
    const session = await getSession()
    redirect({
      throw: true,
      replace: true,
      to: session ? homeFor(session.user.role) : '/login',
    })
  },
})
