import { Check, CheckCircle2, Clock3, Coffee, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { BrandHeader } from '../components/BrandHeader'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { ConfigurationError, fetchTrackedOrder } from '../lib/api'
import { formatMoney, sugarLabel } from '../lib/format'
import type { OrderStatus, TrackedOrder } from '../types'

const statusDetails: Record<OrderStatus, { label: string; detail: string }> = {
  new: { label: 'New', detail: 'Your order has been received.' },
  preparing: { label: 'Preparing', detail: 'Our baristas are working on your drinks.' },
  ready: { label: 'Ready for Collection', detail: 'Your order is ready at the bar.' },
  completed: { label: 'Completed', detail: 'Your order has been collected. Enjoy!' },
  cancelled: { label: 'Cancelled', detail: 'Please speak with our team for assistance.' },
}

type TrackingState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string; configuration: boolean }
  | { kind: 'ready'; order: TrackedOrder }

export default function OrderTracking({ trackingToken }: { trackingToken: string }) {
  const [state, setState] = useState<TrackingState>({ kind: 'loading' })
  const duplicate = new URLSearchParams(window.location.search).get('duplicate') === '1'

  const loadOrder = useCallback(
    async (showLoading = false) => {
      if (showLoading) setState({ kind: 'loading' })
      try {
        const order = await fetchTrackedOrder(trackingToken)
        setState(order ? { kind: 'ready', order } : { kind: 'not-found' })
      } catch (error) {
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'The order could not be loaded.',
          configuration: error instanceof ConfigurationError,
        })
      }
    },
    [trackingToken],
  )

  useEffect(() => {
    void loadOrder()
    const interval = window.setInterval(() => void loadOrder(), 10_000)
    return () => window.clearInterval(interval)
  }, [loadOrder])

  return (
    <div className="tracking-page">
      <BrandHeader compact />
      <main className="tracking-main">
        {state.kind === 'loading' && <LoadingState label="Finding your order…" />}
        {state.kind === 'not-found' && (
          <ErrorState
            title="Order not found"
            message="This tracking link is invalid or the order is no longer available. Check the link and try again."
          />
        )}
        {state.kind === 'error' && (
          <ErrorState
            title={
              state.configuration ? 'Supabase setup required' : 'We could not refresh your order'
            }
            message={state.message}
            configuration={state.configuration}
            onRetry={state.configuration ? undefined : () => void loadOrder(true)}
          />
        )}
        {state.kind === 'ready' && (
          <OrderConfirmation
            order={state.order}
            duplicate={duplicate}
            onRefresh={() => void loadOrder()}
          />
        )}
      </main>
    </div>
  )
}

function OrderConfirmation({
  order,
  duplicate,
  onRefresh,
}: {
  order: TrackedOrder
  duplicate: boolean
  onRefresh: () => void
}) {
  const status = statusDetails[order.status]
  const ready = order.status === 'ready'
  return (
    <div className="confirmation-wrap">
      {duplicate && (
        <div className="duplicate-notice" role="status">
          <Check size={18} /> This order was already submitted, so we didn’t create a duplicate.
        </div>
      )}
      <section className={ready ? 'status-hero is-ready' : `status-hero is-${order.status}`}>
        <div className="status-symbol">{ready ? <Sparkles size={34} /> : <Coffee size={34} />}</div>
        <p className="eyebrow">{ready ? 'Good news' : 'Order confirmed'}</p>
        <h1>{ready ? 'Ready for collection!' : order.orderNumber}</h1>
        {ready && <strong className="ready-number">{order.orderNumber}</strong>}
        <p>{status.detail}</p>
        <div className="live-status">
          <i /> {status.label}
        </div>
      </section>

      <section className="wait-message">
        <Clock3 size={22} />
        <div>
          <strong>Please wait for your order number to be called.</strong>
          <span>This page refreshes automatically.</span>
        </div>
        <button type="button" onClick={onRefresh} aria-label="Refresh order status">
          <RefreshCw size={18} />
        </button>
      </section>

      <section className="order-receipt">
        <div className="receipt-heading">
          <div>
            <p>Order for</p>
            <h2>{order.customerName}</h2>
          </div>
          <span>{order.orderNumber}</span>
        </div>
        <div className="receipt-items">
          {order.items.map((item, index) => (
            <div
              className="receipt-item"
              key={`${item.name}-${item.sugarOption ?? 'standard'}-${index}`}
            >
              <strong>{item.quantity}×</strong>
              <div>
                <h3>{item.name}</h3>
                {item.sugarOption && <p>{sugarLabel(item.sugarOption)}</p>}
              </div>
              <span>{formatMoney(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        {order.customerNotes && (
          <div className="receipt-notes">
            <strong>Order remarks</strong>
            <p>{order.customerNotes}</p>
          </div>
        )}
        <div className="receipt-total">
          <span>Total</span>
          <strong>{formatMoney(order.total)}</strong>
        </div>
      </section>
      <a className="secondary-button new-order-link" href="/">
        <CheckCircle2 size={18} /> Place another order
      </a>
      <p className="customer-thanks">Thank you for supporting The Daily Commit ☕</p>
    </div>
  )
}
