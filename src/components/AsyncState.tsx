import { AlertTriangle, Coffee, RefreshCw, Settings } from 'lucide-react'

export function LoadingState({ label = 'Brewing your menu…' }: { label?: string }) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true">
        <Coffee />
      </span>
      <h2>{label}</h2>
      <p>Just a moment.</p>
    </div>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
  configuration = false,
}: {
  title: string
  message: string
  onRetry?: () => void
  configuration?: boolean
}) {
  const Icon = configuration ? Settings : AlertTriangle
  return (
    <div className="state-card state-card-error" role="alert">
      <span className="state-icon">
        <Icon />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button className="secondary-button" type="button" onClick={onRetry}>
          <RefreshCw size={18} /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyMenuState() {
  return (
    <div className="state-card">
      <span className="state-icon">
        <Coffee />
      </span>
      <h2>The bar is taking a short pause</h2>
      <p>No drinks are available right now. Please check back shortly.</p>
    </div>
  )
}
