import {
  ArrowDownUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatMoney } from '../lib/format'
import type { OrderStatus } from '../types'
import { getDrinkPerformance, getOrderHistory } from './api'
import { OrderCard } from './OrderCard'
import type { AdminOrder, DrinkPerformance } from './types'
import { singaporeDate, singaporeTime, statusLabels } from './utils'

const pageSize = 20
type DatePreset = 'today' | 'yesterday' | 'last7' | 'custom'
type SortKey = keyof DrinkPerformance
type SortDirection = 'asc' | 'desc'

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function HistoryPage() {
  const today = singaporeDate()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [count, setCount] = useState(0)
  const [preset, setPreset] = useState<DatePreset>('today')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<DrinkPerformance[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('cupsSold')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    let active = true
    setLoading(true)
    void getOrderHistory({ startDate, endDate, status, search: appliedSearch, page, pageSize })
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
  }, [startDate, endDate, status, appliedSearch, page])

  useEffect(() => {
    let active = true
    setAnalyticsLoading(true)
    void getDrinkPerformance(startDate, endDate)
      .then((result) => {
        if (active) {
          setAnalytics(result)
          setAnalyticsError(null)
        }
      })
      .catch((error: unknown) => {
        if (active)
          setAnalyticsError(
            error instanceof Error ? error.message : 'Drink insights could not be loaded.',
          )
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false)
      })
    return () => {
      active = false
    }
  }, [startDate, endDate])

  const chartRows = useMemo(
    () =>
      [...analytics].sort(
        (a, b) => b.cupsSold - a.cupsSold || a.drinkName.localeCompare(b.drinkName),
      ),
    [analytics],
  )
  const tableRows = useMemo(
    () =>
      [...analytics].sort((a, b) => {
        const left = a[sortKey]
        const right = b[sortKey]
        const result =
          typeof left === 'string'
            ? left.localeCompare(String(right))
            : Number(left) - Number(right)
        return sortDirection === 'asc' ? result : -result
      }),
    [analytics, sortDirection, sortKey],
  )

  function applyPreset(value: DatePreset) {
    setPreset(value)
    setPage(1)
    if (value === 'today') setStartDate(today)
    if (value === 'today') setEndDate(today)
    if (value === 'yesterday') setStartDate(shiftDate(today, -1))
    if (value === 'yesterday') setEndDate(shiftDate(today, -1))
    if (value === 'last7') setStartDate(shiftDate(today, -6))
    if (value === 'last7') setEndDate(today)
  }

  function changeSort(key: SortKey) {
    if (key === sortKey) setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDirection(key === 'drinkName' ? 'asc' : 'desc')
    }
  }

  function exportCsv() {
    const header = ['Drink', 'Cups Sold', 'Orders', 'Regular Menu Value', 'Revenue Charged']
    const rows = tableRows.map((row) => [
      row.drinkName,
      row.cupsSold,
      row.ordersCount,
      row.regularValue.toFixed(2),
      row.chargedValue.toFixed(2),
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    const blobUrl = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `drink-performance-${startDate}${startDate === endDate ? '' : `-to-${endDate}`}.csv`
    link.click()
    URL.revokeObjectURL(blobUrl)
  }

  const pages = Math.max(1, Math.ceil(count / pageSize))
  const insightTitle =
    startDate === today && endDate === today ? "Today's Drink Insights" : 'Drink Insights'
  const maxCups = chartRows[0]?.cupsSold ?? 0
  const rankNames = ['Best Seller', 'Second', 'Third']
  const rankMedals = ['🥇', '🥈', '🥉']

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
          Date range
          <select
            value={preset}
            onChange={(event) => applyPreset(event.target.value as DatePreset)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label>
              From
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setPage(1)
                }}
              />
            </label>
          </>
        )}
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

      <section className="drink-insights" aria-labelledby="drink-insights-title">
        <header>
          <div>
            <span>
              <BarChart3 /> Performance
            </span>
            <h2 id="drink-insights-title">{insightTitle}</h2>
            <p>
              {startDate === endDate ? startDate : `${startDate} – ${endDate}`} · Cancelled orders
              excluded
            </p>
          </div>
          <button
            type="button"
            className="export-button no-print"
            disabled={!tableRows.length}
            onClick={exportCsv}
          >
            <Download /> Export CSV
          </button>
        </header>
        {analyticsError && (
          <div className="admin-error" role="alert">
            {analyticsError}
          </div>
        )}
        {analyticsLoading ? (
          <div className="insights-skeleton">
            <i />
            <i />
            <i />
          </div>
        ) : analytics.length === 0 ? (
          <div className="insights-empty">
            No non-cancelled drinks were sold in this date range.
          </div>
        ) : (
          <>
            <div className="ranking-grid">
              {chartRows.slice(0, 3).map((drink, index) => (
                <article className={`ranking-card rank-${index + 1}`} key={drink.drinkName}>
                  <span>
                    {rankMedals[index]} {rankNames[index]}
                  </span>
                  <strong>{drink.drinkName}</strong>
                  <p>
                    {drink.cupsSold} {drink.cupsSold === 1 ? 'cup' : 'cups'}
                  </p>
                </article>
              ))}
            </div>
            <div className="drink-chart" aria-label="Cups sold by drink">
              {chartRows.map((drink, index) => (
                <div className="drink-chart-row" key={drink.drinkName}>
                  <strong>{drink.drinkName}</strong>
                  <div className="drink-bar-track">
                    <i
                      className={`drink-bar color-${index % 5}`}
                      style={{ width: `${Math.max(3, (drink.cupsSold / maxCups) * 100)}%` }}
                    />
                  </div>
                  <span>
                    {drink.cupsSold} {drink.cupsSold === 1 ? 'cup' : 'cups'}
                  </span>
                </div>
              ))}
            </div>
            <div className="history-table-wrap drink-table-wrap">
              <table className="history-table drink-performance-table">
                <thead>
                  <tr>
                    {(
                      [
                        ['drinkName', 'Drink'],
                        ['cupsSold', 'Cups Sold'],
                        ['ordersCount', 'Orders'],
                        ['regularValue', 'Regular Menu Value'],
                        ['chargedValue', 'Revenue Charged'],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th key={key} aria-sort={sortKey === key ? `${sortDirection}ending` : 'none'}>
                        <button type="button" onClick={() => changeSort(key)}>
                          {label}
                          <ArrowDownUp />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((drink) => (
                    <tr key={drink.drinkName}>
                      <td>
                        <strong>{drink.drinkName}</strong>
                      </td>
                      <td>{drink.cupsSold}</td>
                      <td>{drink.ordersCount}</td>
                      <td>{formatMoney(drink.regularValue)}</td>
                      <td>{formatMoney(drink.chargedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

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
            <ChevronLeft /> Previous
          </button>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next <ChevronRight />
          </button>
        </div>
      </div>
    </>
  )
}
