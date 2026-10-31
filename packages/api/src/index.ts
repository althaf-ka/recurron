import { oc } from '@orpc/contract'
import { z } from 'zod'

export const pingResponseSchema = z.object({
  message: z.literal('pong'),
})

export const apiContract = {
  system: {
    ping: oc.output(pingResponseSchema),
  },
}
