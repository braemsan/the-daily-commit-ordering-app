import type { SugarOption } from '../types'

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function sugarLabel(option: SugarOption | null) {
  if (option === 'sugar') return 'Sugar'
  if (option === 'no_sugar') return 'No Sugar'
  return null
}
