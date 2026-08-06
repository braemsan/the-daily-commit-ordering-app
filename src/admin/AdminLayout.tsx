import { ClipboardList, Coffee, History, LogOut, Menu, QrCode } from 'lucide-react'
import { useStaffAuth } from './Auth'

const navigation = [
  { href: '/admin', label: 'Dashboard', icon: ClipboardList },
  { href: '/admin/menu', label: 'Menu', icon: Menu, adminOnly: true },
  { href: '/admin/history', label: 'History', icon: History },
  { href: '/admin/qr', label: 'QR Code', icon: QrCode },
]

export function AdminLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle: string
}) {
  const auth = useStaffAuth()
  const path = window.location.pathname.replace(/\/$/, '') || '/admin'
  return (
    <div className="admin-app-shell">
      <aside className="admin-sidebar no-print">
        <a className="admin-brand" href="/admin">
          <span>
            <Coffee />
          </span>
          <div>
            <strong>The Daily Commit</strong>
            <small>Staff Operations</small>
          </div>
        </a>
        <nav aria-label="Staff dashboard navigation">
          {navigation
            .filter((item) => !item.adminOnly || auth.profile?.role === 'admin')
            .map((item) => {
              const Icon = item.icon
              return (
                <a key={item.href} className={path === item.href ? 'active' : ''} href={item.href}>
                  <Icon />
                  <span>{item.label}</span>
                </a>
              )
            })}
        </nav>
        <div className="admin-user-card">
          <div className="admin-avatar">{auth.profile?.displayName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{auth.profile?.displayName}</strong>
            <small>{auth.profile?.role}</small>
          </div>
          <button type="button" onClick={() => void auth.signOut()} aria-label="Log out">
            <LogOut />
          </button>
        </div>
      </aside>
      <div className="admin-content-shell">
        <header className="admin-mobile-header no-print">
          <a className="admin-brand" href="/admin">
            <span>
              <Coffee />
            </span>
            <strong>The Daily Commit</strong>
          </a>
          <button type="button" onClick={() => void auth.signOut()} aria-label="Log out">
            <LogOut />
          </button>
        </header>
        <nav className="admin-mobile-nav no-print" aria-label="Staff dashboard navigation">
          {navigation
            .filter((item) => !item.adminOnly || auth.profile?.role === 'admin')
            .map((item) => {
              const Icon = item.icon
              return (
                <a key={item.href} className={path === item.href ? 'active' : ''} href={item.href}>
                  <Icon />
                  <span>{item.label}</span>
                </a>
              )
            })}
        </nav>
        <main className="admin-main">
          <header className="admin-page-heading no-print">
            <div>
              <p>Staff operations</p>
              <h1>{title}</h1>
              <span>{subtitle}</span>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  )
}
