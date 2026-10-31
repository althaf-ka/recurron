import { oc } from '@orpc/contract'
import { z } from 'zod'
import { catalogContract } from './catalog'

export const pingResponseSchema = z.object({
  message: z.literal('pong'),
})

export const apiContract = {
  ...catalogContract,
  system: {
    ping: oc.output(pingResponseSchema),
  },
}
