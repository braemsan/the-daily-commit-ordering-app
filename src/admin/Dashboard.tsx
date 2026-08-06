import {
  Bell,
  BellOff,
  CircleDollarSign,
  RefreshCw,
  Search,
  ShoppingBag,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib'
import { formatMoney } from '../lib/format'
import type { OrderStatus } from '../types'
import { changeOrderStatus, getTodayOrders } from './api'
import { OrderCard } from './OrderCard'
import type { AdminOrder, RealtimeState } from './types'
import { singaporeDate, statusLabels } from './utils'

type Filter = OrderStatus | 'active' | 'all'
const filters: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All Today' },
]

function soundIsMuted() {
  try {
    return window.localStorage.getItem('tdc-order-sound-muted') === '1'
  } catch {
    return false
  }
}

function storeSoundPreference(muted: boolean) {
  try {
    window.localStorage.setItem('tdc-order-sound-muted', muted ? '1' : '0')
  } catch {
    // Preference persistence is optional when browser storage is unavailable.
  }
}

export function Dashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [changing, setChanging] = useState<string | null>(null)
  const [realtime, setRealtime] = useState<RealtimeState>('reconnecting')
  const [muted, setMuted] = useState(soundIsMuted)
  const knownIds = useRef(new Set<string>())
  const loadedOnce = useRef(false)
  const refreshTimer = useRef<number | null>(null)
  const date = singaporeDate()

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true)
      try {
        const next = await getTodayOrders(date)
        setOrders(next)
        next.forEach((order) => knownIds.current.add(order.id))
        loadedOnce.current = true
        setError(null)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Orders could not be loaded.')
      } finally {
        setLoading(false)
      }
    },
    [date],
  )

  const notify = useCallback(() => {
    if (muted) return
    try {
      const AudioContextClass = window.AudioContext
      const context = new AudioContextClass()
      void context.resume()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.setValueAtTime(740, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.16)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.3)
      oscillator.addEventListener('ended', () => void context.close())
    } catch {
      /* Autoplay may be blocked until staff interacts with the page. */
    }
  }, [muted])

  useEffect(() => {
    void load(true)
  }, [load])

  useEffect(() => {
    const client = supabase
    if (!client) return
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      refreshTimer.current = window.setTimeout(() => void load(), 180)
    }
    const channel = client
      .channel('staff-orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const id = typeof payload.new.id === 'string' ? payload.new.id : null
        if (id && loadedOnce.current && !knownIds.current.has(id)) {
          knownIds.current.add(id)
          notify()
        }
        scheduleRefresh()
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtime('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtime('reconnecting')
        else if (status === 'CLOSED') setRealtime('disconnected')
      })
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      void client.removeChannel(channel)
    }
  }, [load, notify])

  useEffect(() => {
    function online() {
      setRealtime('reconnecting')
      void load()
    }
    function offline() {
      setRealtime('disconnected')
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [load])

  function toggleMuted() {
    setMuted((value) => {
      const next = !value
      storeSoundPreference(next)
      return next
    })
  }

  async function updateStatus(order: AdminOrder, status: OrderStatus) {
    if (
      status === 'cancelled' &&
      !window.confirm(`Cancel ${order.orderNumber}? This cannot be undone.`)
    )
      return
    setChanging(order.id)
    setError(null)
    setSuccess(null)
    try {
      await changeOrderStatus(order.id, status)
      await load()
      setSuccess(`${order.orderNumber} updated to ${statusLabels[status]}.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Status could not be updated.')
    } finally {
      setChanging(null)
    }
  }

  const visible = useMemo(
    () =>
      orders.filter((order) => {
        const filterMatch =
          filter === 'all' ||
          (filter === 'active'
            ? ['new', 'preparing', 'ready'].includes(order.status)
            : order.status === filter)
        const needle = search.trim().toLowerCase()
        return (
          filterMatch &&
          (!needle ||
            order.orderNumber.toLowerCase().includes(needle) ||
            order.customerName.toLowerCase().includes(needle))
        )
      }),
    [orders, filter, search],
  )
  const count = (status: OrderStatus) => orders.filter((order) => order.status === status).length
  const paid = orders.filter((order) => order.status !== 'cancelled')
  const revenue = paid.reduce((sum, order) => sum + order.total, 0)

  return (
    <>
      {!navigator.onLine && (
        <div className="offline-banner">
          <WifiOff /> You’re offline. Showing the last loaded orders.
        </div>
      )}
      <div className="dashboard-toolbar no-print">
        <span className={`realtime-pill realtime-${realtime}`}>
          {realtime === 'connected' ? <Wifi /> : <WifiOff />}
          {realtime === 'connected'
            ? 'Connected'
            : realtime === 'reconnecting'
              ? 'Reconnecting…'
              : 'Disconnected'}
        </span>
        <button type="button" onClick={toggleMuted}>
          {muted ? <BellOff /> : <Bell />}
          {muted ? 'Sound off' : 'Sound on'}
        </button>
        <button type="button" onClick={() => void load(true)}>
          <RefreshCw /> Refresh
        </button>
      </div>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="admin-success" role="status">
          {success}
        </div>
      )}
      <section className="metrics-grid" aria-label="Today's metrics">
        <Metric label="New" value={count('new')} tone="red" />
        <Metric label="Preparing" value={count('preparing')} tone="amber" />
        <Metric label="Ready" value={count('ready')} tone="green" />
        <Metric label="Completed" value={count('completed')} />
        <Metric label="Total orders" value={orders.length} icon={<ShoppingBag />} />
        <Metric label="Revenue" value={formatMoney(revenue)} icon={<CircleDollarSign />} />
        <Metric
          label="Average value"
          value={formatMoney(paid.length ? revenue / paid.length : 0)}
        />
      </section>
      <section className="order-controls no-print">
        <div className="filter-tabs">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? 'active' : ''}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="admin-search">
          <Search />
          <span className="sr-only">Search orders</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order number or customer"
          />
        </label>
        {(filter !== 'active' || search) && (
          <button
            className="clear-button"
            type="button"
            onClick={() => {
              setFilter('active')
              setSearch('')
            }}
          >
            Clear
          </button>
        )}
      </section>
      {loading ? (
        <OrderSkeletons />
      ) : visible.length === 0 ? (
        <div className="admin-empty">
          <ShoppingBag />
          <h2>No matching orders</h2>
          <p>New orders will appear here automatically.</p>
        </div>
      ) : (
        <section className="staff-orders-grid">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              changing={changing === order.id}
              onStatus={(status) => void updateStatus(order, status)}
            />
          ))}
        </section>
      )}
    </>
  )
}

function Metric({
  label,
  value,
  tone = '',
  icon,
}: {
  label: string
  value: string | number
  tone?: string
  icon?: React.ReactNode
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </article>
  )
}
function OrderSkeletons() {
  return (
    <div className="staff-orders-grid" role="status" aria-label="Loading orders">
      {[1, 2, 3].map((value) => (
        <div className="order-skeleton" key={value}>
          <i />
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  )
}
