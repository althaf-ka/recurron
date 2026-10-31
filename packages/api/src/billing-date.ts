export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

export const advanceBillingDate = (
  date: string,
  frequency: Frequency,
): string => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  if (frequency === 'DAILY') {
    return new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10)
  }
  if (frequency === 'WEEKLY') {
    return new Date(Date.UTC(year, month - 1, day + 7))
      .toISOString()
      .slice(0, 10)
  }
  const nextYear =
    frequency === 'YEARLY' ? year + 1 : year + Math.floor(month / 12)
  const nextMonth = frequency === 'YEARLY' ? month - 1 : month % 12
  const targetDay = Math.min(day, daysInMonth(nextYear, nextMonth))
  return new Date(Date.UTC(nextYear, nextMonth, targetDay))
    .toISOString()
    .slice(0, 10)
}
