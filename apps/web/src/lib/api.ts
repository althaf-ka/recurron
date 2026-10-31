import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import type { apiContract } from '@recurron/api'
import { API_URL } from './env'

export const apiClient: ContractRouterClient<typeof apiContract> =
  createORPCClient(
    new RPCLink({
      url: `${API_URL}/rpc`,
      fetch: (request, init) =>
        fetch(request, { ...init, credentials: 'include' }),
    }),
  )

export const orpc = createTanstackQueryUtils(apiClient)
