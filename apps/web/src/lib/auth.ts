import { ac, roles } from '@recurron/api/access'
import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { API_URL } from './env'

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/api/auth',
  plugins: [adminClient({ ac, roles })],
  fetchOptions: { credentials: 'include', timeout: 10_000 },
})
