import { z } from 'zod'
import { envError } from '../env'
import type { CartItem, EventSettings, MenuItem, PlaceOrderResult, TrackedOrder } from '../types'
import { orderStatuses } from '../types'
import { supabase } from '../lib'

const money = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    context.addIssue({ code: 'custom', message: 'Invalid money value returned by the server.' })
    return z.NEVER
  }
  return parsed
})

const menuRowSchema = z.object({
  id: z.number(),
  category: z.enum(['Coffee', 'Chocolate']),
  name: z.string(),
  description: z.string(),
  price: money,
  requires_sugar: z.boolean(),
  available: z.boolean(),
  display_order: z.number(),
})

const eventSettingsSchema = z.object({
  free_drinks_enabled: z.boolean(),
  event_title: z.string(),
  event_message: z.string(),
  paynow_number: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
})

const placeOrderRowSchema = z.object({
  order_number: z.string(),
  tracking_token: z.uuid(),
  order_total: money,
  was_duplicate: z.boolean(),
})

const trackedOrderSchema = z.object({
  order_number: z.string(),
  customer_name: z.string(),
  customer_notes: z.string().nullable(),
  status: z.enum(orderStatuses),
  total: money,
  regular_total: money,
  free_drinks_applied: z.boolean(),
  event_title: z.string().nullable(),
  event_message: z.string().nullable(),
  paynow_number: z.string().nullable(),
  created_at: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      sugar_option: z.enum(['sugar', 'no_sugar']).nullable(),
      unit_price: money,
      regular_unit_price: money,
      line_total: money,
      regular_line_total: money,
    }),
  ),
})

export class ConfigurationError extends Error {}

function client() {
  if (!supabase) {
    throw new ConfigurationError(envError ?? 'Supabase is not configured.')
  }
  return supabase
}

function messageFor(error: { message: string }) {
  if (/fetch|network|failed to fetch/i.test(error.message)) {
    return 'We could not reach the ordering service. Check your connection and try again.'
  }
  return error.message || 'The ordering service returned an unexpected error.'
}

export async function fetchMenu(): Promise<MenuItem[]> {
  const { data, error } = await client()
    .from('menu_items')
    .select('id, category, name, description, price, requires_sugar, available, display_order')
    .eq('available', true)
    .order('display_order')

  if (error) throw new Error(messageFor(error))

  return z
    .array(menuRowSchema)
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
    }))
}

export async function fetchEventSettings(): Promise<EventSettings> {
  const { data, error } = await client()
    .from('event_settings')
    .select('free_drinks_enabled, event_title, event_message, paynow_number, starts_at, ends_at')
    .eq('id', 1)
    .single()

  if (error) throw new Error(messageFor(error))
  const row = eventSettingsSchema.parse(data)
  const now = Date.now()
  const afterStart = row.starts_at === null || now >= Date.parse(row.starts_at)
  const beforeEnd = row.ends_at === null || now < Date.parse(row.ends_at)
  return {
    freeDrinksEnabled: row.free_drinks_enabled,
    isActive: row.free_drinks_enabled && afterStart && beforeEnd,
    eventTitle: row.event_title,
    eventMessage: row.event_message,
    paynowNumber: row.paynow_number,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }
}

export async function submitOrder(input: {
  customerName: string
  customerNotes: string
  items: CartItem[]
  idempotencyKey: string
}): Promise<PlaceOrderResult> {
  const { data, error } = await client().rpc('place_order', {
    p_customer_name: input.customerName,
    p_customer_notes: input.customerNotes,
    p_idempotency_key: input.idempotencyKey,
    p_items: input.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      sugar_option: item.sugarOption,
    })),
  })

  if (error) throw new Error(messageFor(error))
  const row = placeOrderRowSchema.parse(z.array(z.unknown()).parse(data)[0])
  return {
    orderNumber: row.order_number,
    trackingToken: row.tracking_token,
    orderTotal: row.order_total,
    wasDuplicate: row.was_duplicate,
  }
}

export async function fetchTrackedOrder(trackingToken: string): Promise<TrackedOrder | null> {
  if (!z.uuid().safeParse(trackingToken).success) return null

  const { data, error } = await client().rpc('get_order_by_tracking_token', {
    p_tracking_token: trackingToken,
  })
  if (error) throw new Error(messageFor(error))
  if (data === null) return null

  const order = trackedOrderSchema.parse(data)
  return {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerNotes: order.customer_notes,
    status: order.status,
    total: order.total,
    regularTotal: order.regular_total,
    freeDrinksApplied: order.free_drinks_applied,
    eventTitle: order.event_title,
    eventMessage: order.event_message,
    paynowNumber: order.paynow_number,
    createdAt: order.created_at,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      sugarOption: item.sugar_option,
      unitPrice: item.unit_price,
      regularUnitPrice: item.regular_unit_price,
      lineTotal: item.line_total,
      regularLineTotal: item.regular_line_total,
    })),
  }
}
