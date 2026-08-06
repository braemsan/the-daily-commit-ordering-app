import { ChevronDown, ChevronUp, Clock3, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { formatMoney, sugarLabel } from '../lib/format'
import type { OrderStatus } from '../types'
import type { AdminOrder } from './types'
import { singaporeTime, statusLabels } from './utils'

const nextAction: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'preparing', label: 'Start Preparing' },
  preparing: { status: 'ready', label: 'Mark Ready' },
  ready: { status: 'completed', label: 'Complete Order' },
}

export function OrderCard({
  order,
  changing,
  onStatus,
  readOnly = false,
}: {
  order: AdminOrder
  changing: boolean
  onStatus: (status: OrderStatus) => void
  readOnly?: boolean
}) {
  const [showAudit, setShowAudit] = useState(false)
  const action = nextAction[order.status]
  const canCancel = ['new', 'preparing', 'ready'].includes(order.status)
  return (
    <article className={`staff-order-card staff-status-${order.status}`}>
      <header>
        <div>
          <strong>{order.orderNumber}</strong>
          <h3>{order.customerName}</h3>
        </div>
        <time>
          <Clock3 />
          {singaporeTime(order.createdAt)}
        </time>
      </header>
      <div className="staff-order-items">
        {order.items.map((item) => (
          <div key={item.id}>
            <b>{item.quantity}×</b>
            <span>
              {item.name}
              {item.sugarOption && <small>{sugarLabel(item.sugarOption)}</small>}
            </span>
            <strong>{formatMoney(item.lineTotal)}</strong>
          </div>
        ))}
      </div>
      {order.customerNotes && (
        <div className="staff-order-note">
          <MessageSquareText />
          <span>
            <strong>Remarks</strong>
            {order.customerNotes}
          </span>
        </div>
      )}
      <div className="staff-order-total">
        <span>Total</span>
        <strong>{formatMoney(order.total)}</strong>
      </div>
      {!readOnly && (action || canCancel) && (
        <div className="staff-order-actions">
          {action && (
            <button
              className="workflow-button"
              type="button"
              disabled={changing}
              onClick={() => onStatus(action.status)}
            >
              {changing ? 'Updating…' : action.label}
            </button>
          )}
          {canCancel && (
            <button
              className="cancel-button"
              type="button"
              disabled={changing}
              onClick={() => onStatus('cancelled')}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      <button
        className="audit-toggle"
        type="button"
        aria-expanded={showAudit}
        onClick={() => setShowAudit((value) => !value)}
      >
        Status history {showAudit ? <ChevronUp /> : <ChevronDown />}
      </button>
      {showAudit && (
        <div className="audit-list">
          {order.audit.length === 0 ? (
            <p>No status changes yet.</p>
          ) : (
            order.audit.map((entry) => (
              <div key={entry.id}>
                <span>
                  {statusLabels[entry.previousStatus]} → {statusLabels[entry.newStatus]}
                </span>
                <time>{singaporeTime(entry.changedAt)}</time>
              </div>
            ))
          )}
        </div>
      )}
    </article>
  )
}
