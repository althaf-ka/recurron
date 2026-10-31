import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addMinor,
  formatMinor,
  multiplyMinor,
  parseMinor,
  percentageMinor,
  subtractMinor,
} from '../../api/src/money'

await test('decimal input and formatting are exact, including signed variant price_delta_minor', () => {
  assert.equal(parseMinor('4999.50'), 499_950)
  assert.equal(parseMinor('0.01'), 1)
  assert.equal(parseMinor('-560'), -56_000)
  assert.equal(formatMinor(-56_000), '-560.00')
  assert.equal(formatMinor(1), '0.01')
  assert.equal(addMinor(100_000, parseMinor('-560')), 44_000)
  assert.equal(subtractMinor(100, 1), 99)
  assert.equal(multiplyMinor(101, 3), 303)
  assert.equal(parseMinor('90071992547409.91'), Number.MAX_SAFE_INTEGER)
  assert.throws(() => parseMinor('90071992547409.92'), RangeError)
  assert.throws(() => parseMinor('1.001'), TypeError)
  assert.throws(() => parseMinor('1e2'), TypeError)
  assert.throws(() => addMinor(Number.MAX_SAFE_INTEGER, 1), RangeError)
  assert.throws(() => multiplyMinor(1, 0.5), RangeError)
})
await test('basis points round nearest with ties away from zero', () => {
  assert.equal(percentageMinor(100, 1800), 18)
  assert.equal(percentageMinor(1, 4999), 0)
  assert.equal(percentageMinor(1, 5000), 1)
  assert.equal(percentageMinor(1, 5001), 1)
  assert.equal(percentageMinor(-1, 5000), -1)
  assert.equal(
    percentageMinor(Number.MAX_SAFE_INTEGER, 10_000),
    Number.MAX_SAFE_INTEGER,
  )
  assert.throws(() => percentageMinor(100, 10_001), RangeError)
})
