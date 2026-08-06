import { Coffee } from 'lucide-react'

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={compact ? 'brand-bar brand-bar-compact' : 'brand-bar'}>
      <a className="brand-lockup" href="/" aria-label="The Daily Commit home">
        <span className="brand-mark">
          <Coffee size={22} strokeWidth={2.2} />
        </span>
        <span>
          <strong>The Daily Commit</strong>
          <small>Specialty coffee · Singapore</small>
        </span>
      </a>
      {!compact && (
        <span className="service-pill">
          <i /> Now serving
        </span>
      )}
    </header>
  )
}
