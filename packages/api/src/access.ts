import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

export const roleNames = ['ADMIN', 'STAFF', 'CUSTOMER'] as const

export const operationalStatements = {
  billing: ['preview', 'run'],
  customer: ['create', 'read', 'update'],
  discount: ['create', 'read', 'update'],
  invoice: ['create', 'read', 'confirm', 'cancel', 'send'],
  payment: ['create', 'read'],
  plan: ['create', 'read', 'update', 'archive'],
  portal: ['access'],
  product: ['create', 'read', 'update', 'archive'],
  quotationTemplate: ['create', 'read', 'update', 'archive'],
  report: ['read'],
  subscription: [
    'create',
    'read',
    'update',
    'quote',
    'confirm',
    'activate',
    'pause',
    'renew',
    'close',
  ],
  tax: ['create', 'read', 'update'],
} as const

export const statements = {
  ...defaultStatements,
  ...operationalStatements,
} as const
export const ac = createAccessControl(statements)
export const roles = {
  ADMIN: ac.newRole({ ...adminAc.statements, ...operationalStatements }),
  CUSTOMER: ac.newRole({ portal: ['access'] }),
  STAFF: ac.newRole({
    billing: operationalStatements.billing,
    customer: operationalStatements.customer,
    invoice: operationalStatements.invoice,
    payment: operationalStatements.payment,
    plan: ['read'],
    product: ['read'],
    quotationTemplate: ['read'],
    report: operationalStatements.report,
    subscription: operationalStatements.subscription,
  }),
}
export type Permission = {
  [
    Resource in keyof typeof statements
  ]?: (typeof statements)[Resource][number][]
}
