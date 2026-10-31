import { oc } from '@orpc/contract'
import { z } from 'zod'
import { catalogContract } from './catalog'
import { subscriptionContract } from './subscription'
import { financialContract } from './financial'

export const pingResponseSchema = z.object({
  message: z.literal('pong'),
})

export const apiContract = {
  ...catalogContract,
  ...subscriptionContract,
  ...financialContract,
  system: {
    ping: oc.output(pingResponseSchema),
  },
}
