import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

const App = lazy(() => import('./pages/App'))
const Admin = lazy(() => import('./pages/Admin'))
const OrderTracking = lazy(() => import('./pages/OrderTracking'))

const isAdminRoute =
  window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const trackingMatch = window.location.pathname.match(/^\/order\/([^/]+)\/?$/)

if (!isAdminRoute && !trackingMatch && window.location.pathname !== '/') {
  window.history.replaceState(null, '', '/')
}

export function Route() {
  if (isAdminRoute) return <Admin />
  if (trackingMatch) return <OrderTracking trackingToken={trackingMatch[1]} />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          Loading The Daily Commit…
        </div>
      }
    >
      <Route />
    </Suspense>
  </React.StrictMode>,
)
