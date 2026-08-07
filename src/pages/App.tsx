import { useEffect, useMemo, useRef, useState } from 'react'
import { BrandHeader } from '../components/BrandHeader'
import { CartPanel } from '../components/CartPanel'
import { CheckoutForm } from '../components/CheckoutForm'
import { EmptyMenuState, ErrorState, LoadingState } from '../components/AsyncState'
import { MenuCard } from '../components/MenuCard'
import { ConfigurationError, fetchEventSettings, fetchMenu, submitOrder } from '../lib/api'
import type { CartItem, EventSettings, MenuItem, SugarOption } from '../types'

type MenuState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: MenuItem[]; event: EventSettings }
  | { kind: 'error'; message: string; configuration: boolean }

export default function App() {
  const [menuState, setMenuState] = useState<MenuState>({ kind: 'loading' })
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const idempotencyKey = useRef(crypto.randomUUID())

  async function loadMenu() {
    setMenuState({ kind: 'loading' })
    try {
      const [items, event] = await Promise.all([fetchMenu(), fetchEventSettings()])
      setMenuState({ kind: 'ready', items, event })
    } catch (error) {
      setMenuState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'The menu could not be loaded.',
        configuration: error instanceof ConfigurationError,
      })
    }
  }

  useEffect(() => {
    void loadMenu()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchEventSettings()
        .then((event) => {
          setMenuState((current) => (current.kind === 'ready' ? { ...current, event } : current))
        })
        .catch(() => undefined)
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [])

  const items = useMemo(() => Object.values(cart), [cart])
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const freeDrinks = menuState.kind === 'ready' && menuState.event.isActive
  const orderingEnabled = menuState.kind !== 'ready' || menuState.event.orderingEnabled

  function addItem(menuItem: MenuItem, sugarOption: SugarOption | null) {
    if (!orderingEnabled) return
    const key = `${menuItem.id}:${sugarOption ?? 'standard'}`
    setCart((current) => {
      const existing = current[key]
      const quantity = Math.min(20, (existing?.quantity ?? 0) + 1)
      return {
        ...current,
        [key]: {
          key,
          menuItemId: menuItem.id,
          name: menuItem.name,
          unitPrice: menuItem.price,
          sugarOption,
          quantity,
        },
      }
    })
  }

  function changeQuantity(key: string, quantity: number) {
    setCart((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[key]
      else if (next[key]) {
        const currentQuantity = next[key].quantity
        if (!orderingEnabled && quantity > currentQuantity) return current
        next[key] = { ...next[key], quantity: Math.min(quantity, 20) }
      }
      return next
    })
  }

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !orderingEnabled || itemCount === 0 || !name.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await submitOrder({
        customerName: name.trim(),
        customerNotes: notes.trim(),
        items,
        idempotencyKey: idempotencyKey.current,
      })
      const duplicate = result.wasDuplicate ? '?duplicate=1' : ''
      window.location.assign(`/order/${result.trackingToken}${duplicate}`)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Your order could not be placed. Please try again.',
      )
      setSubmitting(false)
    }
  }

  const categories =
    menuState.kind === 'ready'
      ? (['Coffee', 'Chocolate'] as const)
          .map((category) => ({
            category,
            items: menuState.items.filter((item) => item.category === category),
          }))
          .filter((group) => group.items.length > 0)
      : []

  return (
    <div className="ordering-page">
      <BrandHeader />
      <main className="ordering-main">
        <section className="menu-column">
          <div className="hero-copy">
            <p className="eyebrow">Crafted fresh for you</p>
            <h1>
              Your daily ritual,
              <br />
              <em>made beautifully.</em>
            </h1>
            <p>Choose your favourites and we’ll have them ready at the bar.</p>
          </div>

          {menuState.kind === 'ready' && menuState.event.isActive && (
            <section className="event-banner" aria-label="Free drinks event">
              <span>Free today</span>
              <h2>{menuState.event.eventTitle}</h2>
              <p>{menuState.event.eventMessage}</p>
            </section>
          )}

          {menuState.kind === 'ready' && !menuState.event.orderingEnabled && (
            <section className="ordering-closed-banner" role="status">
              <h2>Ordering is currently closed.</h2>
              <p>Feel free to check out our menu — we’ll be back shortly ☕</p>
            </section>
          )}

          {menuState.kind === 'loading' && <LoadingState />}
          {menuState.kind === 'error' && (
            <ErrorState
              title={
                menuState.configuration ? 'Supabase setup required' : 'We could not load the menu'
              }
              message={menuState.message}
              configuration={menuState.configuration}
              onRetry={menuState.configuration ? undefined : () => void loadMenu()}
            />
          )}
          {menuState.kind === 'ready' && menuState.items.length === 0 && <EmptyMenuState />}
          {categories.map((group) => (
            <section
              className="menu-category"
              key={group.category}
              aria-labelledby={`category-${group.category}`}
            >
              <div className="category-title">
                <span>{group.category === 'Coffee' ? '01' : '02'}</span>
                <h2 id={`category-${group.category}`}>{group.category}</h2>
                <i />
              </div>
              <div className="menu-list">
                {group.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    freeDrinks={freeDrinks}
                    orderingEnabled={orderingEnabled}
                    onAdd={(sugar) => addItem(item, sugar)}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>

        <aside className="checkout-column">
          <CartPanel
            items={items}
            regularSubtotal={subtotal}
            freeDrinks={freeDrinks}
            orderingEnabled={orderingEnabled}
            onChangeQuantity={changeQuantity}
          />
          <CheckoutForm
            name={name}
            notes={notes}
            itemCount={itemCount}
            submitting={submitting}
            orderingEnabled={orderingEnabled}
            error={submitError}
            onNameChange={setName}
            onNotesChange={setNotes}
            onSubmit={(event) => void placeOrder(event)}
          />
        </aside>
      </main>
      <footer className="site-footer">
        <span>The Daily Commit</span>
        <p>Small batches. Thoughtful coffee. Made daily.</p>
      </footer>
    </div>
  )
}
