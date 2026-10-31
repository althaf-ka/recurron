import { implement } from '@orpc/server'
import { apiContract } from '@recurron/api'
import type { RpcContext } from './authorization'

const implementation = implement(apiContract).$context<RpcContext>()

export const router = implementation.router({
  system: {
    ping: implementation.system.ping.handler(() => ({ message: 'pong' })),
  },
})
