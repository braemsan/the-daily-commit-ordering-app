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
      <section className="qr-print-sheet" aria-label="Printable scan-to-order poster">
        <div className="qr-poster-artwork">
          <img
            src="/assets/scan-to-order-sign-20260809.png"
            alt="The Daily Commit at Samsudin's Farmers' Market Party — Scan to Order"
            width="1054"
            height="1492"
          />
          <div className="qr-poster-code" aria-label={`QR code for ${url}`}>
            <QRCodeSVG value={url} size={420} level="H" includeMargin />
          </div>
          <strong className="qr-poster-url">{url}</strong>
        </div>
      </section>
    </>
  )
}
