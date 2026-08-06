import { LockKeyhole } from 'lucide-react'
import { BrandHeader } from '../components/BrandHeader'

export default function Admin() {
  return (
    <div className="tracking-page">
      <BrandHeader compact />
      <main className="tracking-main">
        <div className="state-card">
          <span className="state-icon">
            <LockKeyhole />
          </span>
          <h1>Staff dashboard</h1>
          <p>Secure staff access will be available in Phase 3.</p>
          <a className="secondary-button" href="/">
            Return to customer ordering
          </a>
        </div>
      </main>
    </div>
  )
}
