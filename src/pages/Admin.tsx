import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Clock3, Coffee, LockKeyhole, QrCode, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { adminPin, supabase } from '../lib'
import type { Order, OrderStatus } from '../types'

const statuses: { value: OrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(sessionStorage.getItem('tdc_admin') === '1')
  const [pin, setPin] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<OrderStatus | 'active' | 'all'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const customerUrl = `${window.location.origin}/`

  useEffect(() => {
    if (!authenticated) return
    void loadOrders()
    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void loadOrders())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [authenticated])

  async function loadOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) setError(error.message)
    else setOrders(data ?? [])
    setLoading(false)
  }

  function login(event: FormEvent) {
    event.preventDefault()
    if (pin === adminPin) {
      sessionStorage.setItem('tdc_admin', '1')
      setAuthenticated(true)
      setError('')
    } else setError('Incorrect PIN')
  }

  async function updateStatus(id: string, status: OrderStatus) {
    const previous = orders
    setOrders(current => current.map(order => order.id === id ? { ...order, status } : order))
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) {
      setOrders(previous)
      setError(error.message)
    }
  }

  const visible = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'active') return orders.filter(order => order.status === 'new' || order.status === 'preparing')
    return orders.filter(order => order.status === filter)
  }, [orders, filter])

  if (!authenticated) {
    return (
      <main className="login-shell">
        <form className="login-card" onSubmit={login}>
          <LockKeyhole size={36} />
          <h1>Staff dashboard</h1>
          <p>Enter the admin PIN to view and update orders.</p>
          {error && <div className="error-banner">{error}</div>}
          <input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="Admin PIN" autoFocus />
          <button className="primary-btn" type="submit">Open dashboard</button>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Live order dashboard</p>
          <h1>The Daily Commit</h1>
        </div>
        <button className="icon-text-btn" onClick={() => void loadOrders()}><RefreshCw size={18} /> Refresh</button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="admin-summary">
        <div><Coffee size={21} /><strong>{orders.filter(o => o.status === 'new').length}</strong><span>New</span></div>
        <div><Clock3 size={21} /><strong>{orders.filter(o => o.status === 'preparing').length}</strong><span>Preparing</span></div>
        <div className="qr-panel"><QrCode size={21} /><span>Customer QR</span><QRCodeSVG value={customerUrl} size={112} /><small>{customerUrl}</small></div>
      </section>

      <nav className="filter-tabs">
        {(['active', 'new', 'preparing', 'completed', 'cancelled', 'all'] as const).map(value => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>
        ))}
      </nav>

      {loading ? <p>Loading orders…</p> : visible.length === 0 ? (
        <section className="empty-state"><Coffee size={42} /><h2>No orders here</h2><p>New customer orders will appear automatically.</p></section>
      ) : (
        <section className="orders-grid">
          {visible.map(order => (
            <article className={`order-card status-${order.status}`} key={order.id}>
              <div className="order-topline">
                <div><span className="order-number">#{order.order_number}</span><h2>{order.customer_name}</h2></div>
                <time>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
              <div className="order-items">
                {order.items.map((item, index) => (
                  <div key={index}><strong>{item.quantity}×</strong><span>{item.name}{item.sugar ? ` · ${item.sugar === 'sugar' ? 'Add sugar' : 'No sugar'}` : ''}</span></div>
                ))}
              </div>
              {order.customer_notes && <div className="notes-box"><strong>Remarks:</strong> {order.customer_notes}</div>}
              {order.total !== null && <div className="order-total">Total: ${Number(order.total).toFixed(2)}</div>}
              <div className="status-buttons">
                {statuses.map(status => (
                  <button key={status.value} className={order.status === status.value ? 'selected' : ''} onClick={() => void updateStatus(order.id, status.value)}>{status.label}</button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
