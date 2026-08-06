import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import Admin from './pages/Admin'
import OrderTracking from './pages/OrderTracking'
import './styles.css'

const isAdminRoute = window.location.pathname === '/admin'
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
    <Route />
  </React.StrictMode>,
)
