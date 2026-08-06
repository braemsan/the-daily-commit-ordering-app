import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react'
import { supabase } from '../lib'
import type { CartItem, MenuItem } from '../types'

export default function App() {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadMenu()
  }, [])

  async function loadMenu() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('sort_order')
    if (error) setError(error.message)
    else setMenu(data ?? [])
    setLoading(false)
  }

  function keyFor(item: MenuItem, sugar?: CartItem['sugar']) {
    return `${item.id}:${sugar ?? 'standard'}`
  }

  function adjust(item: MenuItem, delta: number, sugar?: CartItem['sugar']) {
    const key = keyFor(item, sugar)
    setCart(current => {
      const existing = current[key]
      const quantity = Math.max(0, (existing?.quantity ?? 0) + delta)
      const next = { ...current }
      if (quantity === 0) delete next[key]
      else {
        next[key] = {
          menu_item_id: item.id,
          name: item.name,
          quantity,
          sugar,
          price: item.price,
        }
      }
      return next
    })
  }

  const items = Object.values(cart)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const hasCompletePricing = items.length > 0 && items.every(item => item.price !== null)
  const total = hasCompletePricing
    ? items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0)
    : null

  const canSubmit = useMemo(
    () => name.trim().length > 0 && itemCount > 0 && !submitting,
    [name, itemCount, submitting],
  )

  async function submitOrder(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: name.trim(),
        customer_notes: notes.trim() || null,
        items,
        total,
      })
      .select('order_number')
      .single()

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    setSuccess(data.order_number)
    setCart({})
    setName('')
    setNotes('')
    setSubmitting(false)
  }

  if (success !== null) {
    return (
      <main className="customer-shell success-shell">
        <section className="success-card">
          <div className="success-icon"><Check size={42} /></div>
          <p className="eyebrow">Order received</p>
          <h1>Order #{success}</h1>
          <p>Please keep this number. Your drink will be prepared shortly.</p>
          <button className="primary-btn" onClick={() => setSuccess(null)}>Place another order</button>
        </section>
      </main>
    )
  }

  return (
    <main className="customer-shell">
      <header className="brand-header">
        <p className="eyebrow">Coffee booth ordering</p>
        <h1>The Daily Commit</h1>
        <p>Choose your drinks, enter your name, and submit your order.</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? <p>Loading menu…</p> : (
        <form onSubmit={submitOrder}>
          <section className="menu-grid">
            {menu.map(item => (
              <article className="menu-card" key={item.id}>
                <div>
                  <h2>{item.name}</h2>
                  <p className="price">{item.price === null ? 'Pay at booth' : `$${item.price.toFixed(2)}`}</p>
                </div>

                {item.sugar_option ? (
                  <div className="option-stack">
                    {(['sugar', 'no_sugar'] as const).map(option => {
                      const key = keyFor(item, option)
                      const quantity = cart[key]?.quantity ?? 0
                      return (
                        <div className="quantity-row" key={option}>
                          <span>{option === 'sugar' ? 'Add sugar' : 'No sugar'}</span>
                          <QuantityControl quantity={quantity} onMinus={() => adjust(item, -1, option)} onPlus={() => adjust(item, 1, option)} />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <QuantityControl quantity={cart[keyFor(item)]?.quantity ?? 0} onMinus={() => adjust(item, -1)} onPlus={() => adjust(item, 1)} />
                )}
              </article>
            ))}
          </section>

          <section className="checkout-card">
            <div className="checkout-title">
              <ShoppingBag size={22} />
              <h2>Your order</h2>
              <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
            </div>

            {items.length === 0 ? (
              <p className="muted">No drinks selected yet.</p>
            ) : (
              <div className="cart-list">
                {items.map((item, index) => (
                  <div className="cart-line" key={`${item.menu_item_id}-${item.sugar}-${index}`}>
                    <span>{item.quantity}× {item.name}{item.sugar ? ` · ${item.sugar === 'sugar' ? 'Add sugar' : 'No sugar'}` : ''}</span>
                    {item.price !== null && <strong>${(item.price * item.quantity).toFixed(2)}</strong>}
                  </div>
                ))}
                {total !== null && <div className="total-line"><span>Total</span><strong>${total.toFixed(2)}</strong></div>}
              </div>
            )}

            <label>
              Name / pickup name
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ibrahim" maxLength={50} required />
            </label>
            <label>
              Order remarks (optional)
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. less ice, takeaway" maxLength={200} />
            </label>
            <button className="primary-btn" type="submit" disabled={!canSubmit}>
              {submitting ? 'Submitting…' : 'Submit order'}
            </button>
          </section>
        </form>
      )}
    </main>
  )
}

function QuantityControl({ quantity, onMinus, onPlus }: { quantity: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="quantity-control">
      <button type="button" onClick={onMinus} disabled={quantity === 0} aria-label="Decrease quantity"><Minus size={18} /></button>
      <strong>{quantity}</strong>
      <button type="button" onClick={onPlus} aria-label="Increase quantity"><Plus size={18} /></button>
    </div>
  )
}
