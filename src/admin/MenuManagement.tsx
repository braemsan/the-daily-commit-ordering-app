import { CheckCircle2, Coffee, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatMoney } from '../lib/format'
import { getMenuForStaff, saveMenuItem } from './api'
import type { AdminMenuItem } from './types'

export function MenuManagement() {
  const [items, setItems] = useState<AdminMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    try {
      setItems(await getMenuForStaff())
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
