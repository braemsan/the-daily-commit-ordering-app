import { ChevronLeft, ChevronRight, History, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatMoney } from '../lib/format'
import type { OrderStatus } from '../types'
import { getOrderHistory } from './api'
import { OrderCard } from './OrderCard'
import type { AdminOrder } from './types'
import { singaporeDate, singaporeTime, statusLabels } from './utils'

const pageSize = 20
export function HistoryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [count, setCount] = useState(0)
  const [date, setDate] = useState(singaporeDate())
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void getOrderHistory({ date, status, search: appliedSearch, page, pageSize })
      .then((result) => {
        if (active) {
          setOrders(result.orders)
          setCount(result.count)
          setError(null)
        }
      })
      .catch((error: unknown) => {
        if (active)
          setError(error instanceof Error ? error.message : 'History could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [date, status, appliedSearch, page])

  const pages = Math.max(1, Math.ceil(count / pageSize))
  return (
    <>
      <form
        className="history-filters no-print"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setAppliedSearch(search)
        }}
      >
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | 'all')
              setPage(1)
            }}
          >
            <option value="all">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="history-search">
          Search
          <div>
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Number or customer"
            />
          </div>
        </label>
        <button type="submit">Search</button>
      </form>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="order-skeleton">
          <i />
          <i />
          <i />
        </div>
      ) : orders.length === 0 ? (
        <div className="admin-empty">
          <History />
          <h2>No order history</h2>
          <p>Try another date, status, or search.</p>
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Time</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td>{order.customerName}</td>
                  <td>{singaporeTime(order.createdAt)}</td>
                  <td>
                    <span className={`history-status ${order.status}`}>
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} drinks</td>
                  <td>{formatMoney(order.total)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setOpen(open === order.id ? null : order.id)}
                    >
                      {open === order.id ? 'Close' : 'Details'}
                    </button>
                    {open === order.id && (
                      <div className="history-detail">
                        <OrderCard
                          order={order}
                          changing={false}
                          onStatus={() => undefined}
                          readOnly
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination no-print">
        <span>
          {count} orders · Page {page} of {pages}
        </span>
        <div>
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
            <ChevronLeft />
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
            <ChevronRight />
          </button>
        </div>
      </div>
    </>
  )
}
