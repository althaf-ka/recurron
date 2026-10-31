const decimalPattern = /^(?<sign>-?)(?<whole>\d+)(?:\.(?<fraction>\d{1,2}))?$/u
const safe = (minor: bigint): number => {
  const result = Number(minor)
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Money exceeds the safe integer range')
  }
  return result
}
const exact = (minor: number): bigint => {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError('Expected integer minor units')
  }
  return BigInt(minor)
}

// Two-decimal currencies only. Reject excess precision rather than silently round input.
export const parseMinor = (input: string): number => {
  const match = decimalPattern.exec(input)
  if (!match) {
    throw new TypeError(
      'Expected a decimal string with at most two decimal places',
    )
  }
  const magnitude =
    BigInt(match.groups?.whole ?? '0') * 100n +
    BigInt((match.groups?.fraction ?? '').padEnd(2, '0'))
  return safe(match.groups?.sign === '-' ? -magnitude : magnitude)
}

export const formatMinor = (minor: number): string => {
  const integer = exact(minor)
  const magnitude = integer < 0n ? -integer : integer
  return `${integer < 0n ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`
}

export const addMinor = (left: number, right: number): number =>
  safe(exact(left) + exact(right))
export const subtractMinor = (left: number, right: number): number =>
  safe(exact(left) - exact(right))
export const multiplyMinor = (minor: number, quantity: number): number => {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError('Expected a nonnegative integer quantity')
  }
  return safe(exact(minor) * BigInt(quantity))
}

// Round nearest, with exact ties away from zero.
export const percentageMinor = (minor: number, rateBps: number): number => {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new RangeError('Expected basis points between 0 and 10000')
  }
  const numerator = exact(minor) * BigInt(rateBps)
  const magnitude = numerator < 0n ? -numerator : numerator
  const rounded = (magnitude + 5000n) / 10_000n
  return safe(numerator < 0n ? -rounded : rounded)
}
