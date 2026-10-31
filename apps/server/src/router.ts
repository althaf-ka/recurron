import { implement } from '@orpc/server'
import { apiContract } from '@recurron/api'

const implementation = implement(apiContract)

export const router = implementation.router({
  system: {
    ping: implementation.system.ping.handler(() => ({ message: 'pong' })),
  },
})
