import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import Admin from './pages/Admin'
import './styles.css'

const isAdminRoute = window.location.pathname === '/admin'

if (!isAdminRoute && window.location.pathname !== '/') {
  window.history.replaceState(null, '', '/')
}

const Page = isAdminRoute ? Admin : App

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
)
