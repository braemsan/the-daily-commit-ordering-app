import { Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

function customerUrl(origin: string) {
  try {
    const value = new URL(origin)
    value.pathname = '/'
    value.search = ''
    value.hash = ''
    return value.toString()
  } catch {
    return `${window.location.origin}/`
  }
}

export function QrPage() {
  const [draft, setDraft] = useState(`${window.location.origin}/`)
  const [url, setUrl] = useState(`${window.location.origin}/`)
  return (
    <>
      <section className="qr-controls no-print">
        <label>
          Public ordering URL
          <input type="url" value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <button type="button" onClick={() => setUrl(customerUrl(draft))}>
          Update QR
        </button>
        <button type="button" onClick={() => window.print()}>
          <Printer />
          Print A4
        </button>
      </section>
      <section className="qr-print-sheet">
        <p className="qr-brand">The Daily Commit</p>
        <h1>Scan to Order</h1>
        <p>Freshly crafted coffee, just a few taps away.</p>
        <span className="qr-event-badge">☕ FREE COFFEE TODAY</span>
        <div className="qr-code-frame">
          <QRCodeSVG value={url} size={360} level="H" includeMargin />
        </div>
        <strong>{url}</strong>
        <small>SCAN • ORDER • COLLECT WHEN CALLED</small>
      </section>
    </>
  )
}
