import { parseMinor, formatMinor } from '@recurron/api/money'

export const text = (data: FormData, name: string) => {
  const value = data.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
export const optionalText = (data: FormData, name: string) =>
  text(data, name) || null
export const checked = (data: FormData, name: string) => data.has(name)
export const moneyInput = (data: FormData, name: string) => {
  try {
    return parseMinor(text(data, name).replace(/^\+/u, ''))
  } catch {
    return Number.NaN
  }
}
export const displayMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-IN', { currency, style: 'currency' }).format(
    Number(formatMinor(minor)),
  )

export const fieldErrors = (
  issues: readonly { message: string; path: readonly PropertyKey[] }[],
) => {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.')
    errors[key] ??= issue.message
  }
  return errors
}

export const fieldAttributes = (
  errors: Record<string, string>,
  name: string,
) => ({
  'aria-describedby': errors[name] === undefined ? undefined : `${name}-error`,
  'aria-invalid': errors[name] !== undefined,
  id: name,
})
