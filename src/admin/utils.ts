import type { OrderStatus } from '../types'

export const statusLabels: Record<OrderStatus, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready for Collection',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function singaporeDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function singaporeTime(value: string) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}
