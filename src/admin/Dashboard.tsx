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
import {
  changeOrderStatus,
  getEventSettingsForAdmin,
  getTodayOrders,
  setOrderingEnabled,
} from './api'
import { useStaffAuth } from './Auth'
import { OrderCard } from './OrderCard'
import { createAudioContext, playCafeChime, resumeAudioContext } from './sound'
import type { AdminOrder, RealtimeState } from './types'
import { singaporeDate, statusLabels } from './utils'

type Filter = OrderStatus | 'active' | 'all'
type AudioState = 'locked' | 'enabled' | 'muted' | 'blocked'
const soundBlockedMessage =
  'Sound is blocked by your browser. Tap Enable sound and check your device volume.'
const filters: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All Today' },
]

function soundWasEnabled() {
  try {
    return window.localStorage.getItem('tdc-order-sound-enabled') === '1'
  } catch {
    return false
  }
}

function storeSoundPreference(enabled: boolean) {
  try {
    window.localStorage.setItem('tdc-order-sound-enabled', enabled ? '1' : '0')
    window.localStorage.removeItem('tdc-order-sound-muted')
  } catch {
    // Preference persistence is optional when browser storage is unavailable.
  }
}

function soundDebug(message: string, orderId?: string) {
  if (!import.meta.env.DEV) return
  console.info(`[The Daily Commit] ${message}`, orderId ? { orderId } : undefined)
}

export function Dashboard() {
  const auth = useStaffAuth()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [changing, setChanging] = useState<string | null>(null)
  const [realtime, setRealtime] = useState<RealtimeState>('reconnecting')
  const [audioState, setAudioState] = useState<AudioState>('locked')
  const [soundBusy, setSoundBusy] = useState(false)
  const [orderingEnabled, setOrderingEnabledState] = useState<boolean | null>(null)
  const [orderingBusy, setOrderingBusy] = useState(false)
  const [soundMessage, setSoundMessage] = useState<string | null>(() =>
    soundWasEnabled() ? 'Tap Enable sound to restore notifications after this page refresh.' : null,
  )
  const audioStateRef = useRef<AudioState>('locked')
  const audioContextRef = useRef<AudioContext | null>(null)
  const knownIds = useRef(new Set<string>())
  const notifiedIds = useRef(new Set<string>())
  const loadedOnce = useRef(false)
  const refreshTimer = useRef<number | null>(null)
  const date = singaporeDate()

  const loadOrderingStatus = useCallback(async () => {
    try {
      const settings = await getEventSettingsForAdmin()
      setOrderingEnabledState(settings.orderingEnabled)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ordering status could not be loaded.')
    }
  }, [])

  const updateAudioState = useCallback((next: AudioState) => {
    audioStateRef.current = next
    setAudioState(next)
  }, [])

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

  const notify = useCallback(
    async (orderId: string) => {
      if (audioStateRef.current !== 'enabled') {
        soundDebug('Sound skipped: notifications are not enabled', orderId)
        return
      }
      soundDebug('Sound attempted', orderId)
      const context = audioContextRef.current
      if (!context) {
        updateAudioState('blocked')
        storeSoundPreference(false)
        setSoundMessage(soundBlockedMessage)
        soundDebug('Sound blocked: no unlocked AudioContext', orderId)
        return
      }
      try {
        await playCafeChime(context)
        soundDebug('Sound played', orderId)
      } catch {
        updateAudioState('blocked')
        storeSoundPreference(false)
        setSoundMessage(soundBlockedMessage)
        soundDebug('Sound blocked by browser', orderId)
      }
    },
    [updateAudioState],
  )

  const playUserInitiatedChime = useCallback(
    async (keepMuted = false) => {
      setSoundBusy(true)
      setSoundMessage(null)
      soundDebug('Sound attempted from staff interaction')
      try {
        let context = audioContextRef.current
        if (!context || context.state === 'closed') {
          context = createAudioContext()
          audioContextRef.current = context
        }
        await playCafeChime(context)
        if (keepMuted) {
          updateAudioState('muted')
          storeSoundPreference(false)
        } else {
          updateAudioState('enabled')
          storeSoundPreference(true)
        }
        soundDebug('Sound played from staff interaction')
      } catch {
        updateAudioState('blocked')
        storeSoundPreference(false)
        setSoundMessage(soundBlockedMessage)
        soundDebug('Sound blocked by browser')
      } finally {
        setSoundBusy(false)
      }
    },
    [updateAudioState],
  )

  function handleSoundControl() {
    if (audioStateRef.current === 'enabled') {
      updateAudioState('muted')
      storeSoundPreference(false)
      setSoundMessage(null)
      return
    }
    void playUserInitiatedChime()
  }

  function testSound() {
    void playUserInitiatedChime(audioStateRef.current === 'muted')
  }

  useEffect(() => {
    function visibilityChanged() {
      if (
        document.visibilityState !== 'visible' ||
        audioStateRef.current !== 'enabled' ||
        !audioContextRef.current
      )
        return
      void resumeAudioContext(audioContextRef.current)
        .then(() => soundDebug('AudioContext resumed after tab became visible'))
        .catch(() => {
          updateAudioState('blocked')
          storeSoundPreference(false)
          setSoundMessage(soundBlockedMessage)
          soundDebug('Sound blocked while resuming visible tab')
        })
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => document.removeEventListener('visibilitychange', visibilityChanged)
  }, [updateAudioState])

  useEffect(() => {
    return () => {
      const context = audioContextRef.current
      audioContextRef.current = null
      if (context && context.state !== 'closed') void context.close().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    void load(true)
    void loadOrderingStatus()
  }, [load, loadOrderingStatus])

  async function toggleOrdering() {
    if (orderingEnabled === null || orderingBusy || auth.profile?.role !== 'admin') return
    const next = !orderingEnabled
    if (!next && !window.confirm('Customers will no longer be able to place new orders. Continue?'))
      return
    setOrderingBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const saved = await setOrderingEnabled(next)
      setOrderingEnabledState(saved)
      setSuccess(`Ordering is now ${saved ? 'online' : 'offline'}.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ordering status could not be changed.')
    } finally {
      setOrderingBusy(false)
    }
  }

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
        if (!id) {
          soundDebug('New INSERT received without an order ID')
        } else if (!loadedOnce.current) {
          knownIds.current.add(id)
          soundDebug('New INSERT received before initial fetch; notification skipped', id)
        } else if (knownIds.current.has(id) || notifiedIds.current.has(id)) {
          soundDebug('Duplicate event ignored', id)
        } else {
          soundDebug('New INSERT received', id)
          knownIds.current.add(id)
          notifiedIds.current.add(id)
          void notify(id)
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
        if (status === 'SUBSCRIBED') {
          setRealtime('connected')
          soundDebug('Realtime connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtime('reconnecting')
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
  const regularValue = paid.reduce((sum, order) => sum + order.regularTotal, 0)

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
        <button
          className={`sound-control sound-${audioState}`}
          type="button"
          disabled={soundBusy}
          onClick={handleSoundControl}
        >
          {audioState === 'enabled' ? <Bell /> : <BellOff />}
          {audioState === 'locked'
            ? 'Enable sound'
            : audioState === 'enabled'
              ? 'Sound on'
              : audioState === 'muted'
                ? 'Sound muted'
                : 'Sound blocked'}
        </button>
        <button type="button" disabled={soundBusy} onClick={testSound}>
          Test sound
        </button>
        {auth.profile?.role === 'admin' && (
          <label className={`ordering-toggle ${orderingEnabled ? 'is-online' : 'is-offline'}`}>
            <span className="toggle-copy">
              <strong>
                {orderingEnabled === null ? 'Loading…' : orderingEnabled ? 'Online' : 'Offline'}
              </strong>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Customer ordering availability"
              checked={orderingEnabled ?? false}
              disabled={orderingEnabled === null || orderingBusy}
              onChange={() => void toggleOrdering()}
            />
            <span className="toggle-track" aria-hidden="true">
              <i />
            </span>
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            void load(true)
            void loadOrderingStatus()
          }}
        >
          <RefreshCw /> Refresh
        </button>
      </div>
      {soundMessage && (
        <div className="sound-message" role={audioState === 'blocked' ? 'alert' : 'status'}>
          {soundMessage}
        </div>
      )}
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
        <Metric label="Regular menu value" value={formatMoney(regularValue)} />
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
