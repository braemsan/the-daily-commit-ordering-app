export type OrderStatus = 'new' | 'preparing' | 'completed' | 'cancelled'

export interface MenuItem {
  id: number
  name: string
  price: number | null
  available: boolean
  sugar_option: boolean
  sort_order: number
}

export interface CartItem {
  menu_item_id: number
  name: string
  quantity: number
  sugar?: 'sugar' | 'no_sugar'
  price: number | null
}

export interface Order {
  id: string
  order_number: number
  customer_name: string
  customer_notes: string | null
  status: OrderStatus
  items: CartItem[]
  total: number | null
  created_at: string
  updated_at: string
}
