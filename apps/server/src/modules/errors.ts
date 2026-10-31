import { ORPCError } from '@orpc/server'

export const requireRecord = <T>(record: T | undefined): T => {
  if (record === undefined) {
    throw new ORPCError('NOT_FOUND', { message: 'Record not found' })
  }
  return record
}

// Drizzle wraps driver errors. Inspect codes only; never send SQL or details to clients.
const postgresCode = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) {
    return undefined
  }
  if ('code' in error && typeof error.code === 'string') {
    return error.code
  }
  return postgresCode(error.cause)
}

export const databaseOperation = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ORPCError) {
      throw error
    }
    const code = postgresCode(error)
    if (code === '21000' || code === '23505' || code === '23503') {
      throw new ORPCError('CONFLICT', {
        message: 'Record conflicts with existing data',
      })
    }
    if (
      code === '23514' ||
      code === '22003' ||
      code === '22007' ||
      code === '22008'
    ) {
      throw new ORPCError('BAD_REQUEST', { message: 'Invalid record values' })
    }
    throw new ORPCError('INTERNAL_SERVER_ERROR', {
      message: 'Unable to complete request',
    })
  }
}

export const searchPattern = (search: string): string =>
  `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
