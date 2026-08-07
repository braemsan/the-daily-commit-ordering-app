import { ArrowRight, LockKeyhole } from 'lucide-react'
import type { FormEvent } from 'react'

export function CheckoutForm({
  name,
  notes,
  itemCount,
  submitting,
  orderingEnabled,
  error,
  onNameChange,
  onNotesChange,
  onSubmit,
}: {
  name: string
  notes: string
  itemCount: number
  submitting: boolean
  orderingEnabled: boolean
  error: string | null
  onNameChange: (value: string) => void
  onNotesChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const disabled = !orderingEnabled || itemCount === 0 || name.trim().length === 0 || submitting

  return (
    <form className="checkout-form" onSubmit={onSubmit} aria-labelledby="details-title">
      <div className="section-heading">
        <div>
          <p>Almost there</p>
          <h2 id="details-title">Pickup details</h2>
        </div>
      </div>
      <label htmlFor="customer-name">
        Name for the order <span>Required</span>
      </label>
      <input
        id="customer-name"
        name="customer-name"
        autoComplete="name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        maxLength={50}
        placeholder="What should we call out?"
        required
      />
      <label htmlFor="order-notes">
        Order remarks <small>Optional</small>
      </label>
      <textarea
        id="order-notes"
        name="order-notes"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        maxLength={300}
        placeholder="Anything else we should know?"
      />
      <div className="character-count">{notes.length}/300</div>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {!orderingEnabled && (
        <div className="ordering-closed-checkout" role="status">
          Ordering is currently closed. Your cart will stay here for later.
        </div>
      )}
      <button className="place-order-button" type="submit" disabled={disabled}>
        <span>
          {submitting ? 'Placing your order…' : orderingEnabled ? 'Place order' : 'Ordering closed'}
        </span>
        {!submitting && <ArrowRight size={20} />}
      </button>
      <p className="secure-note">
        <LockKeyhole size={14} /> Prices and availability are verified securely when you order.
      </p>
    </form>
  )
}
