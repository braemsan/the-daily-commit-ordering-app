export const orderStatuses = ['new', 'preparing', 'ready', 'completed', 'cancelled'] as const
export type OrderStatus = (typeof orderStatuses)[number]
export type SugarOption = 'sugar' | 'no_sugar'

export interface MenuItem {
  id: number
  category: 'Coffee' | 'Chocolate'
  name: string
  description: string
  price: number
  requiresSugar: boolean
  available: boolean
  displayOrder: number
}

export interface CartItem {
  key: string
  menuItemId: number
  name: string
  quantity: number
  sugarOption: SugarOption | null
  unitPrice: number
}

export interface EventSettings {
  orderingEnabled: boolean
  freeDrinksEnabled: boolean
  isActive: boolean
  eventTitle: string
  eventMessage: string
  paynowNumber: string
  startsAt: string | null
  endsAt: string | null
}

export interface PlaceOrderResult {
  orderNumber: string
  trackingToken: string
  orderTotal: number
  wasDuplicate: boolean
}

export interface TrackedOrderItem {
  name: string
  quantity: number
  sugarOption: SugarOption | null
  unitPrice: number
  regularUnitPrice: number
  lineTotal: number
  regularLineTotal: number
}

export interface TrackedOrder {
  orderNumber: string
  customerName: string
  customerNotes: string | null
  status: OrderStatus
  total: number
  regularTotal: number
  freeDrinksApplied: boolean
  eventTitle: string | null
  eventMessage: string | null
  paynowNumber: string | null
  createdAt: string
  items: TrackedOrderItem[]
}
