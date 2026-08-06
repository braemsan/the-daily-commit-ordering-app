import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { formatMoney } from '../lib/format'
import type { MenuItem, SugarOption } from '../types'

export function MenuCard({
  item,
  onAdd,
}: {
  item: MenuItem
  onAdd: (sugar: SugarOption | null) => void
}) {
  const [sugar, setSugar] = useState<SugarOption | null>(null)
  const [added, setAdded] = useState(false)

  function add() {
    if (item.requiresSugar && !sugar) return
    onAdd(sugar)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 900)
  }

  return (
    <article className="menu-item-card">
      <div className="menu-item-copy">
        <div className="menu-title-row">
          <h3>{item.name}</h3>
          <strong>{formatMoney(item.price)}</strong>
        </div>
        <p>{item.description}</p>
      </div>

      {item.requiresSugar && (
        <fieldset className="sugar-selector">
          <legend>
            Sugar choice <span>Required</span>
          </legend>
          <div>
            {(['sugar', 'no_sugar'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={sugar === option}
                className={sugar === option ? 'selected' : ''}
                onClick={() => setSugar(option)}
              >
                {sugar === option && <Check size={15} />}
                {option === 'sugar' ? 'Sugar' : 'No Sugar'}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <button
        className={added ? 'add-button added' : 'add-button'}
        type="button"
        disabled={item.requiresSugar && !sugar}
        onClick={add}
      >
        {added ? <Check size={19} /> : <Plus size={19} />}
        {added
          ? 'Added to order'
          : item.requiresSugar && !sugar
            ? 'Choose sugar first'
            : 'Add to order'}
      </button>
    </article>
  )
}
