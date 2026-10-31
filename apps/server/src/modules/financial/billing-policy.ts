import {
  addMinor,
  multiplyMinor,
  percentageMinor,
  subtractMinor,
} from '@recurron/api/money'

export interface BillingSourceLine {
  description: string
  productId: string
  quantity: number
  taxRateBps: number | null
  unitPriceMinor: number
}

export interface BillingDiscountRule {
  discountScope: 'PRODUCT' | 'SUBSCRIPTION'
  discountType: 'FIXED' | 'PERCENTAGE'
  endsAt: Date | null
  fixedAmountMinor: number | null
  id: string
  minimumPurchaseMinor: number | null
  minimumQuantity: number | null
  percentageBps: number | null
  productIds: string[]
  startsAt: Date | null
  usageLimit: number | null
}

export interface DiscountUsage {
  amountMinor: number
  lineIndex: number | null
  ruleId: string
}

export interface CalculatedInvoiceLine {
  description: string
  discountMinor: number
  productId: string
  quantity: number
  subtotalMinor: number
  taxMinor: number
  taxRateBps: number
  totalMinor: number
  unitPriceMinor: number
}

export interface BillingCalculation {
  discountMinor: number
  lines: CalculatedInvoiceLine[]
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  usages: DiscountUsage[]
  warnings: string[]
}

interface Choice {
  amountMinor: number
  rule: BillingDiscountRule
}

const sumMinor = (values: number[]) => {
  let result = 0
  for (const value of values) {
    result = addMinor(result, value)
  }
  return result
}

const isActiveOn = (rule: BillingDiscountRule, billingDate: string) => {
  const start = rule.startsAt?.toISOString().slice(0, 10)
  const end = rule.endsAt?.toISOString().slice(0, 10)
  return (
    (start === undefined || start <= billingDate) &&
    (end === undefined || end >= billingDate)
  )
}

const isEligible = (
  rule: BillingDiscountRule,
  billingDate: string,
  quantity: number,
  subtotalMinor: number,
  used: number,
) =>
  isActiveOn(rule, billingDate) &&
  (rule.minimumQuantity === null || quantity >= rule.minimumQuantity) &&
  (rule.minimumPurchaseMinor === null ||
    subtotalMinor >= rule.minimumPurchaseMinor) &&
  (rule.usageLimit === null || used < rule.usageLimit)

const discountAmount = (rule: BillingDiscountRule, baseMinor: number) =>
  rule.discountType === 'PERCENTAGE'
    ? percentageMinor(baseMinor, rule.percentageBps ?? 0)
    : Math.min(baseMinor, rule.fixedAmountMinor ?? 0)

const choose = (current: Choice | undefined, next: Choice) => {
  if (
    current === undefined ||
    next.amountMinor > current.amountMinor ||
    (next.amountMinor === current.amountMinor && next.rule.id < current.rule.id)
  ) {
    return next
  }
  return current
}

const chooseProductDiscounts = (
  lines: BillingSourceLine[],
  subtotals: number[],
  rules: BillingDiscountRule[],
  usageCounts: Map<string, number>,
  billingDate: string,
) => {
  const eligibleRules = new Set<string>()
  for (const rule of rules) {
    if (rule.discountScope !== 'PRODUCT') {
      continue
    }
    let quantity = 0
    let subtotalMinor = 0
    for (const [index, line] of lines.entries()) {
      if (rule.productIds.includes(line.productId)) {
        quantity += line.quantity
        subtotalMinor = addMinor(subtotalMinor, subtotals[index] ?? 0)
      }
    }
    if (
      isEligible(
        rule,
        billingDate,
        quantity,
        subtotalMinor,
        usageCounts.get(rule.id) ?? 0,
      )
    ) {
      eligibleRules.add(rule.id)
    }
  }

  const discounts: number[] = []
  const usages: DiscountUsage[] = []
  for (const [index, line] of lines.entries()) {
    let best: Choice | undefined
    for (const rule of rules) {
      if (
        rule.discountScope === 'PRODUCT' &&
        eligibleRules.has(rule.id) &&
        rule.productIds.includes(line.productId)
      ) {
        best = choose(best, {
          amountMinor: discountAmount(rule, subtotals[index] ?? 0),
          rule,
        })
      }
    }
    const amountMinor = best?.amountMinor ?? 0
    discounts.push(amountMinor)
    if (best && amountMinor > 0) {
      usages.push({ amountMinor, lineIndex: index, ruleId: best.rule.id })
      usageCounts.set(best.rule.id, (usageCounts.get(best.rule.id) ?? 0) + 1)
    }
  }
  return { discounts, usages }
}

const chooseSubscriptionDiscount = (
  rules: BillingDiscountRule[],
  usageCounts: Map<string, number>,
  billingDate: string,
  quantity: number,
  subtotalMinor: number,
) => {
  let best: Choice | undefined
  for (const rule of rules) {
    if (
      rule.discountScope === 'SUBSCRIPTION' &&
      isEligible(
        rule,
        billingDate,
        quantity,
        subtotalMinor,
        usageCounts.get(rule.id) ?? 0,
      )
    ) {
      best = choose(best, {
        amountMinor: discountAmount(rule, subtotalMinor),
        rule,
      })
    }
  }
  return best
}

const allocateProportionally = (amountMinor: number, bases: number[]) => {
  const total = sumMinor(bases)
  if (total === 0 || amountMinor === 0) {
    return bases.map(() => 0)
  }
  let allocated = 0
  return bases.map((base, index) => {
    if (index === bases.length - 1) {
      return subtractMinor(amountMinor, allocated)
    }
    const share = Number((BigInt(amountMinor) * BigInt(base)) / BigInt(total))
    allocated = addMinor(allocated, share)
    return share
  })
}

export const calculateBilling = (
  sourceLines: BillingSourceLine[],
  rules: BillingDiscountRule[],
  usageCounts: Map<string, number>,
  billingDate: string,
): BillingCalculation => {
  const subtotals = sourceLines.map((line) =>
    multiplyMinor(line.unitPriceMinor, line.quantity),
  )
  const productResult = chooseProductDiscounts(
    sourceLines,
    subtotals,
    rules,
    usageCounts,
    billingDate,
  )
  const productBases = subtotals.map((subtotal, index) =>
    subtractMinor(subtotal, productResult.discounts[index] ?? 0),
  )
  let quantity = 0
  for (const line of sourceLines) {
    quantity += line.quantity
  }
  const subscriptionDiscount = chooseSubscriptionDiscount(
    rules,
    usageCounts,
    billingDate,
    quantity,
    sumMinor(productBases),
  )
  const subscriptionDiscountMinor = subscriptionDiscount?.amountMinor ?? 0
  const allocated = allocateProportionally(
    subscriptionDiscountMinor,
    productBases,
  )
  const usages = [...productResult.usages]
  if (subscriptionDiscount && subscriptionDiscountMinor > 0) {
    usages.push({
      amountMinor: subscriptionDiscountMinor,
      lineIndex: null,
      ruleId: subscriptionDiscount.rule.id,
    })
    usageCounts.set(
      subscriptionDiscount.rule.id,
      (usageCounts.get(subscriptionDiscount.rule.id) ?? 0) + 1,
    )
  }

  const lines = sourceLines.map((line, index) => {
    const discountMinor = addMinor(
      productResult.discounts[index] ?? 0,
      allocated[index] ?? 0,
    )
    const netMinor = subtractMinor(subtotals[index] ?? 0, discountMinor)
    const taxRateBps = line.taxRateBps ?? 0
    const taxMinor = percentageMinor(netMinor, taxRateBps)
    return {
      description: line.description,
      discountMinor,
      productId: line.productId,
      quantity: line.quantity,
      subtotalMinor: subtotals[index] ?? 0,
      taxMinor,
      taxRateBps,
      totalMinor: addMinor(netMinor, taxMinor),
      unitPriceMinor: line.unitPriceMinor,
    }
  })
  const subtotalMinor = sumMinor(lines.map((line) => line.subtotalMinor))
  const discountMinor = sumMinor(lines.map((line) => line.discountMinor))
  const taxMinor = sumMinor(lines.map((line) => line.taxMinor))
  const totalMinor = sumMinor(lines.map((line) => line.totalMinor))
  const warnings = sourceLines.some((line) => line.taxRateBps === null)
    ? ['One or more products reference an inactive tax rule.']
    : []
  return {
    discountMinor,
    lines,
    subtotalMinor,
    taxMinor,
    totalMinor,
    usages,
    warnings,
  }
}
