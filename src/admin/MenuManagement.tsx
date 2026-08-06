import { CheckCircle2, Coffee, Gift, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatMoney } from '../lib/format'
import { getEventSettingsForAdmin, getMenuForStaff, saveEventSettings, saveMenuItem } from './api'
import type { AdminEventSettings, AdminMenuItem } from './types'

function localDateTime(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function isoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null
}

export function MenuManagement() {
  const [items, setItems] = useState<AdminMenuItem[]>([])
  const [eventSettings, setEventSettings] = useState<AdminEventSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    try {
      const [menu, event] = await Promise.all([getMenuForStaff(), getEventSettingsForAdmin()])
      setItems(menu)
      setEventSettings(event)
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Menu could not be loaded.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  function patch(id: number, changes: Partial<AdminMenuItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }
  async function save(item: AdminMenuItem) {
    if (!item.name.trim()) {
      setError('Menu item names cannot be empty.')
      return
    }
    if (item.price < 0) {
      setError('Price must be zero or greater.')
      return
    }
    if (
      !item.available &&
      !window.confirm(`Disable ${item.name}? Customers will no longer see it.`)
    )
      return
    setSaving(item.id)
    setError(null)
    setSuccess(null)
    try {
      const saved = await saveMenuItem(item)
      patch(item.id, saved)
      setSuccess(`${saved.name} saved successfully.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Menu item could not be saved.')
    } finally {
      setSaving(null)
    }
  }

  async function saveEvent() {
    if (!eventSettings) return
    if (!eventSettings.eventTitle.trim() || !eventSettings.eventMessage.trim()) {
      setError('Event title and message are required.')
      return
    }
    if (!eventSettings.paynowNumber.trim()) {
      setError('PayNow number is required.')
      return
    }
    if (
      !eventSettings.freeDrinksEnabled &&
      !window.confirm('Disable free-drinks mode and resume normal server pricing?')
    )
      return
    setSavingEvent(true)
    setError(null)
    setSuccess(null)
    try {
      const saved = await saveEventSettings(eventSettings)
      setEventSettings(saved)
      setSuccess(
        saved.freeDrinksEnabled
          ? 'Free-drinks event settings saved.'
          : 'Free-drinks mode disabled. Normal pricing has resumed.',
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Event settings could not be saved.')
    } finally {
      setSavingEvent(false)
    }
  }
  if (loading)
    return (
      <div className="menu-admin-grid">
        {[1, 2, 3, 4].map((value) => (
          <div className="order-skeleton" key={value}>
            <i />
            <i />
            <i />
          </div>
        ))}
      </div>
    )
  return (
    <>
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="admin-success" role="status">
          <CheckCircle2 />
          {success}
        </div>
      )}
      {eventSettings && (
        <section className="event-settings-card" aria-labelledby="event-settings-title">
          <header>
            <div className="event-settings-icon">
              <Gift />
            </div>
            <div>
              <p>Event pricing</p>
              <h2 id="event-settings-title">Free-drinks mode</h2>
              <span>Normal menu prices are preserved while charged prices become $0.</span>
            </div>
            <label className="availability-toggle event-toggle">
              <input
                type="checkbox"
                checked={eventSettings.freeDrinksEnabled}
                onChange={(event) =>
                  setEventSettings({
                    ...eventSettings,
                    freeDrinksEnabled: event.target.checked,
                  })
                }
              />
              <span />
              {eventSettings.freeDrinksEnabled ? 'Enabled' : 'Disabled'}
            </label>
          </header>
          <div className="event-settings-form">
            <label>
              Event title
              <input
                value={eventSettings.eventTitle}
                maxLength={100}
                onChange={(event) =>
                  setEventSettings({ ...eventSettings, eventTitle: event.target.value })
                }
              />
            </label>
            <label>
              PayNow number
              <input
                value={eventSettings.paynowNumber}
                maxLength={30}
                inputMode="numeric"
                onChange={(event) =>
                  setEventSettings({ ...eventSettings, paynowNumber: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Event message
              <textarea
                value={eventSettings.eventMessage}
                maxLength={300}
                onChange={(event) =>
                  setEventSettings({ ...eventSettings, eventMessage: event.target.value })
                }
              />
            </label>
            <label>
              Starts (optional)
              <input
                type="datetime-local"
                value={localDateTime(eventSettings.startsAt)}
                onChange={(event) =>
                  setEventSettings({ ...eventSettings, startsAt: isoDateTime(event.target.value) })
                }
              />
            </label>
            <label>
              Ends (optional)
              <input
                type="datetime-local"
                value={localDateTime(eventSettings.endsAt)}
                onChange={(event) =>
                  setEventSettings({ ...eventSettings, endsAt: isoDateTime(event.target.value) })
                }
              />
            </label>
          </div>
          <footer>
            <p>The database applies the toggle and time window when each order is submitted.</p>
            <button
              className="admin-primary-button"
              type="button"
              disabled={savingEvent}
              onClick={() => void saveEvent()}
            >
              <Save />
              {savingEvent ? 'Saving…' : 'Save event settings'}
            </button>
          </footer>
        </section>
      )}
      {items.length === 0 ? (
        <div className="admin-empty">
          <Coffee />
          <h2>No menu items</h2>
        </div>
      ) : (
        <section className="menu-admin-grid">
          {items.map((item) => (
            <article className="menu-admin-card" key={item.id}>
              <header>
                <div>
                  <span>{item.category}</span>
                  <h2>{item.name || 'Untitled item'}</h2>
                </div>
                <strong>{formatMoney(item.price)}</strong>
              </header>
              <div className="menu-form-grid">
                <label>
                  Name
                  <input
                    value={item.name}
                    maxLength={100}
                    onChange={(event) => patch(item.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={item.category}
                    onChange={(event) =>
                      patch(item.id, { category: event.target.value as AdminMenuItem['category'] })
                    }
                  >
                    <option>Coffee</option>
                    <option>Chocolate</option>
                  </select>
                </label>
                <label className="wide">
                  Description
                  <textarea
                    value={item.description}
                    maxLength={240}
                    onChange={(event) => patch(item.id, { description: event.target.value })}
                  />
                </label>
                <label>
                  Price (SGD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(event) => patch(item.id, { price: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.displayOrder}
                    onChange={(event) =>
                      patch(item.id, { displayOrder: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <div className="menu-card-footer">
                <label className="availability-toggle">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(event) => patch(item.id, { available: event.target.checked })}
                  />
                  <span />
                  {item.available ? 'Available' : 'Unavailable'}
                </label>
                <span className="sugar-badge">
                  Sugar choice: {item.requiresSugar ? 'Required' : 'Not required'}
                </span>
                <button
                  className="admin-primary-button"
                  type="button"
                  disabled={saving === item.id}
                  onClick={() => void save(item)}
                >
                  <Save />
                  {saving === item.id ? 'Saving…' : 'Save'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  )
}
