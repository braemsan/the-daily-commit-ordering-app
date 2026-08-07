import { z } from 'zod'
import { supabase } from '../lib'
import { orderStatuses } from '../types'
import type {
  AdminEventSettings,
  AdminMenuItem,
  AdminOrder,
  HistoryPage,
  StaffProfile,
} from './types'

const money = z.union([z.number(), z.string()]).transform(Number)
const staffSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  role: z.enum(['admin', 'staff']),
  is_active: z.boolean(),
})
const itemSchema = z.object({
  id: z.number(),
  item_name: z.string(),
  quantity: z.number(),
  sugar_option: z.enum(['sugar', 'no_sugar']).nullable(),
  unit_price: money,
  regular_unit_price: money,
  line_total: money,
})
const auditSchema = z.object({
  id: z.number(),
  previous_status: z.enum(orderStatuses),
  new_status: z.enum(orderStatuses),
  changed_by: z.uuid().nullable(),
  changed_at: z.string(),
})
const orderSchema = z.object({
  id: z.uuid(),
  order_number: z.string(),
  customer_name: z.string(),
  customer_notes: z.string().nullable(),
  status: z.enum(orderStatuses),
  total: money,
  regular_total: money,
  free_drinks_applied: z.boolean(),
  order_date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  order_items: z.array(itemSchema),
  order_status_audit: z.array(auditSchema),
})
const menuSchema = z.object({
  id: z.number(),
  category: z.enum(['Coffee', 'Chocolate']),
  name: z.string(),
  description: z.string(),
  price: money,
  requires_sugar: z.boolean(),
  available: z.boolean(),
  display_order: z.number(),
  updated_at: z.string(),
})
const eventSettingsSchema = z.object({
  ordering_enabled: z.boolean(),
  free_drinks_enabled: z.boolean(),
  event_title: z.string(),
  event_message: z.string(),
  paynow_number: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  updated_at: z.string(),
})

function db() {
  if (!supabase) throw new Error('Supabase configuration is missing. Check your .env file.')
  return supabase
}

function fail(error: { message: string } | null) {
  if (!error) return
  if (/jwt|session|refresh token/i.test(error.message))
    throw new Error('Your session has expired. Please sign in again.')
  if (/fetch|network|failed to fetch/i.test(error.message))
    throw new Error('Network connection failed. Please try again.')
  throw new Error(error.message)
}

function mapOrder(value: unknown): AdminOrder {
  const row = orderSchema.parse(value)
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerNotes: row.customer_notes,
    status: row.status,
    total: row.total,
    regularTotal: row.regular_total,
    freeDrinksApplied: row.free_drinks_applied,
    orderDate: row.order_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.order_items.map((item) => ({
      id: item.id,
      name: item.item_name,
      quantity: item.quantity,
      sugarOption: item.sugar_option,
      unitPrice: item.unit_price,
      regularUnitPrice: item.regular_unit_price,
      lineTotal: item.line_total,
      regularLineTotal: item.regular_unit_price * item.quantity,
    })),
    audit: row.order_status_audit.map((entry) => ({
      id: entry.id,
      previousStatus: entry.previous_status,
      newStatus: entry.new_status,
      changedBy: entry.changed_by,
      changedAt: entry.changed_at,
    })),
  }
}

const orderSelect = `
  id, order_number, customer_name, customer_notes, status, total,
  regular_total, free_drinks_applied,
  order_date, created_at, updated_at,
  order_items(id, item_name, quantity, sugar_option, unit_price, regular_unit_price, line_total),
  order_status_audit(id, previous_status, new_status, changed_by, changed_at)
`

export async function getStaffProfile(userId: string): Promise<StaffProfile | null> {
  const { data, error } = await db()
    .from('staff_profiles')
    .select('user_id, display_name, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  fail(error)
  if (!data) return null
  const row = staffSchema.parse(data)
  return {
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
  }
}

export async function getTodayOrders(orderDate: string): Promise<AdminOrder[]> {
  const { data, error } = await db()
    .from('orders')
    .select(orderSelect)
    .eq('order_date', orderDate)
    .order('created_at', { ascending: false })
    .limit(500)
  fail(error)
  return z.array(z.unknown()).parse(data).map(mapOrder)
}

export async function changeOrderStatus(orderId: string, status: AdminOrder['status']) {
  const { data, error } = await db().rpc('update_order_status', {
    p_order_id: orderId,
    p_new_status: status,
  })
  fail(error)
  return z
    .object({ id: z.uuid(), status: z.enum(orderStatuses), updated_at: z.string() })
    .parse(data)
}

export async function getMenuForStaff(): Promise<AdminMenuItem[]> {
  const { data, error } = await db()
    .from('menu_items')
    .select(
      'id, category, name, description, price, requires_sugar, available, display_order, updated_at',
    )
    .order('display_order')
  fail(error)
  return z
    .array(menuSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      category: row.category,
      name: row.name,
      description: row.description,
      price: row.price,
      requiresSugar: row.requires_sugar,
      available: row.available,
      displayOrder: row.display_order,
      updatedAt: row.updated_at,
    }))
}

export async function saveMenuItem(item: AdminMenuItem): Promise<AdminMenuItem> {
  const { data, error } = await db().rpc('update_menu_item', {
    p_item_id: item.id,
    p_name: item.name,
    p_description: item.description,
    p_price: item.price,
    p_available: item.available,
    p_category: item.category,
    p_display_order: item.displayOrder,
  })
  fail(error)
  const row = menuSchema.parse(data)
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    price: row.price,
    requiresSugar: row.requires_sugar,
    available: row.available,
    displayOrder: row.display_order,
    updatedAt: row.updated_at,
  }
}

function mapEventSettings(value: unknown): AdminEventSettings {
  const row = eventSettingsSchema.parse(value)
  return {
    orderingEnabled: row.ordering_enabled,
    freeDrinksEnabled: row.free_drinks_enabled,
    eventTitle: row.event_title,
    eventMessage: row.event_message,
    paynowNumber: row.paynow_number,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    updatedAt: row.updated_at,
  }
}

export async function getEventSettingsForAdmin(): Promise<AdminEventSettings> {
  const { data, error } = await db()
    .from('event_settings')
    .select(
      'ordering_enabled, free_drinks_enabled, event_title, event_message, paynow_number, starts_at, ends_at, updated_at',
    )
    .eq('id', 1)
    .single()
  fail(error)
  return mapEventSettings(data)
}

export async function setOrderingEnabled(orderingEnabled: boolean): Promise<boolean> {
  const { data, error } = await db().rpc('set_ordering_enabled', {
    p_ordering_enabled: orderingEnabled,
  })
  fail(error)
  return z.object({ ordering_enabled: z.boolean() }).parse(data).ordering_enabled
}

export async function saveEventSettings(settings: AdminEventSettings): Promise<AdminEventSettings> {
  const { data, error } = await db().rpc('update_event_settings', {
    p_free_drinks_enabled: settings.freeDrinksEnabled,
    p_event_title: settings.eventTitle,
    p_event_message: settings.eventMessage,
    p_paynow_number: settings.paynowNumber,
    p_starts_at: settings.startsAt,
    p_ends_at: settings.endsAt,
  })
  fail(error)
  return mapEventSettings(data)
}

export async function getOrderHistory(input: {
  date: string
  status: AdminOrder['status'] | 'all'
  search: string
  page: number
  pageSize: number
}): Promise<HistoryPage> {
  let query = db()
    .from('orders')
    .select(orderSelect, { count: 'exact' })
    .eq('order_date', input.date)
  if (input.status !== 'all') query = query.eq('status', input.status)
  const safeSearch = input.search.trim().replace(/[%_,().]/g, '')
  if (safeSearch)
    query = query.or(`order_number.ilike.%${safeSearch}%,customer_name.ilike.%${safeSearch}%`)
  const from = (input.page - 1) * input.pageSize
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + input.pageSize - 1)
  fail(error)
  return { orders: z.array(z.unknown()).parse(data).map(mapOrder), count: count ?? 0 }
}
