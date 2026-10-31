import { z } from 'zod'

const originSchema = z
  .url()
  .refine((value) => new URL(value).origin === value, {
    message: 'Expected an HTTP(S) origin without a trailing slash or path',
  })
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))

const authEnvironmentSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((value) =>
      ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    ),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: originSchema,
  WEB_ORIGIN: originSchema,
})

export function readAuthEnvironment(bindings: Env) {
  const result = authEnvironmentSchema.safeParse(bindings)
  if (!result.success) {
    // Do not include binding values or database URLs in errors.
    throw new Error(
      'Auth configuration is missing or invalid. Check server environment variables.',
    )
  }
  return result.data
}
