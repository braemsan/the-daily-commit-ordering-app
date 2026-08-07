import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatMoney, sugarLabel } from '../lib/format'
import type { CartItem } from '../types'

export function CartPanel({
  items,
  regularSubtotal,
  freeDrinks,
  orderingEnabled,
  onChangeQuantity,
}: {
  items: CartItem[]
  regularSubtotal: number
  freeDrinks: boolean
  orderingEnabled: boolean
  onChangeQuantity: (key: string, quantity: number) => void
}) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <section className="cart-panel" aria-labelledby="cart-title">
      <div className="section-heading cart-heading">
        <span className="heading-icon">
          <ShoppingBag size={20} />
        </span>
        <div>
          <p>Your order</p>
          <h2 id="cart-title">Cart</h2>
        </div>
        <span className="cart-count">{count}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-cart">
          <CoffeeCup />
          <p>Your cart is empty</p>
          <span>Add a drink to get started.</span>
        </div>
      ) : (
        <div className="cart-items">
          {items.map((item) => (
            <article className="cart-item" key={item.key}>
              <div className="cart-item-top">
                <div>
                  <h3>{item.name}</h3>
                  {item.sugarOption && <p>{sugarLabel(item.sugarOption)}</p>}
                </div>
                {freeDrinks ? (
                  <div
                    className="cart-event-price"
                    aria-label={`${formatMoney(item.unitPrice * item.quantity)} normally, free today`}
                  >
                    <span>{formatMoney(item.unitPrice * item.quantity)}</span>
                    <strong>$0</strong>
                  </div>
                ) : (
                  <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                )}
              </div>
              <div className="cart-item-actions" aria-label={`Quantity for ${item.name}`}>
                <button
                  type="button"
                  onClick={() => onChangeQuantity(item.key, item.quantity - 1)}
                  aria-label={`Decrease ${item.name}`}
                >
                  {item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                </button>
                <span aria-live="polite">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onChangeQuantity(item.key, item.quantity + 1)}
                  disabled={!orderingEnabled || item.quantity >= 20}
                  aria-label={`Increase ${item.name}`}
                >
                  <Plus size={16} />
                </button>
              </div>
            </article>
          ))}
          {freeDrinks ? (
            <div className="event-totals">
              <div>
                <span>Regular total</span>
                <span className="regular-price-struck">{formatMoney(regularSubtotal)}</span>
              </div>
              <div>
                <strong>Today’s total</strong>
                <strong>$0</strong>
              </div>
            </div>
          ) : (
            <div className="subtotal-row">
              <span>Subtotal</span>
              <strong>{formatMoney(regularSubtotal)}</strong>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function CoffeeCup() {
  return (
    <span className="empty-cup" aria-hidden="true">
      ☕
    </span>
  )
}
