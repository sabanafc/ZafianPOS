import type { Settings } from '../types'

export interface Totals { service: number; tax: number; total: number }

export function calcTotals(subtotal: number, discount: number, s?: Settings | null): Totals {
  const service = Math.round(subtotal * (s?.service_percent || 0) / 100)
  const tax = Math.round((subtotal - discount + service) * (s?.tax_percent || 0) / 100)
  const total = Math.max(0, subtotal - discount + service + tax)
  return { service, tax, total }
}
