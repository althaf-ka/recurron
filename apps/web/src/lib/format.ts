export const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export const displayDate = (value: Date | string | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

export const displayDay = (value: string | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}
