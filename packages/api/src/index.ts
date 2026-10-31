import { oc } from '@orpc/contract'
import { z } from 'zod'
import { catalogContract } from './catalog'
import { subscriptionContract } from './subscription'

export const pingResponseSchema = z.object({
  message: z.literal('pong'),
})

export const apiContract = {
  ...catalogContract,
  ...subscriptionContract,
  system: {
    ping: oc.output(pingResponseSchema),
  },
}
