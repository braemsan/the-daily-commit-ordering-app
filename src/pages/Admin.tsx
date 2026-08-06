import { ShieldX } from 'lucide-react'
import { AdminLayout } from '../admin/AdminLayout'
import { AdminLogin } from '../admin/AdminLogin'
import { StaffAuthProvider, useStaffAuth } from '../admin/Auth'
import { Dashboard } from '../admin/Dashboard'
import { HistoryPage } from '../admin/HistoryPage'
import { MenuManagement } from '../admin/MenuManagement'
import { QrPage } from '../admin/QrPage'

export default function Admin() {
  return (
    <StaffAuthProvider>
      <AdminRouter />
    </StaffAuthProvider>
  )
}

function AdminRouter() {
  const auth = useStaffAuth()
  const path = window.location.pathname.replace(/\/$/, '') || '/admin'
  if (auth.loading)
    return (
      <div className="admin-auth-loading" role="status">
        <i />
        <p>Verifying staff session…</p>
      </div>
    )
  if (path === '/admin/login') return <AdminLogin />
  if (!auth.session || !auth.profile) {
    window.location.replace('/admin/login')
    return (
      <div className="admin-auth-loading" role="status">
        <i />
        <p>Redirecting to sign in…</p>
      </div>
    )
  }
  if (path === '/admin/menu' && auth.profile.role !== 'admin') {
    return (
      <AdminLayout title="Access restricted" subtitle="Administrator permission required">
        <div className="admin-empty">
          <ShieldX />
          <h2>Admin access required</h2>
          <p>Your staff account cannot edit menu items.</p>
          <a href="/admin">Return to dashboard</a>
        </div>
      </AdminLayout>
    )
  }
  if (path === '/admin/menu')
    return (
      <AdminLayout title="Menu management" subtitle="Update prices, availability, and menu copy">
        <MenuManagement />
      </AdminLayout>
    )
  if (path === '/admin/history')
    return (
      <AdminLayout title="Order history" subtitle="Review bounded, paginated booth records">
        <HistoryPage />
      </AdminLayout>
    )
  if (path === '/admin/qr')
    return (
      <AdminLayout title="Customer QR code" subtitle="Print a scan-to-order sign for the booth">
        <QrPage />
      </AdminLayout>
    )
  return (
    <AdminLayout title="Today’s orders" subtitle="Live operations · Asia/Singapore">
      <Dashboard />
    </AdminLayout>
  )
}
