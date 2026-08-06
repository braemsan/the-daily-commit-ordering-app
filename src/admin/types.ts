import type { OrderStatus, SugarOption } from '../types'

export type StaffRole = 'admin' | 'staff'

export interface StaffProfile {
  userId: string
  displayName: string
  role: StaffRole
  isActive: boolean
}

export interface AdminOrderItem {
  id: number
  name: string
  quantity: number
  sugarOption: SugarOption | null
  unitPrice: number
  lineTotal: number
}

export interface AuditEntry {
  id: number
  previousStatus: OrderStatus
  newStatus: OrderStatus
  changedBy: string | null
  changedAt: string
}

export interface AdminOrder {
  id: string
  orderNumber: string
  customerName: string
  customerNotes: string | null
  status: OrderStatus
  total: number
  orderDate: string
  createdAt: string
  updatedAt: string
  items: AdminOrderItem[]
  audit: AuditEntry[]
}

export interface AdminMenuItem {
  id: number
  category: 'Coffee' | 'Chocolate'
  name: string
  description: string
  price: number
  requiresSugar: boolean
  available: boolean
  displayOrder: number
  updatedAt: string
}

export interface HistoryPage {
  orders: AdminOrder[]
  count: number
}

export type RealtimeState = 'connected' | 'reconnecting' | 'disconnected'
