import { Coffee, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib'
import { useStaffAuth } from './Auth'

export function AdminLogin() {
  const auth = useStaffAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (auth.profile) window.location.replace('/admin')
  }, [auth.profile])

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError('Supabase configuration is missing. Check your .env file.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Invalid email or password.'
          : error.message,
      )
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-brand">
          <span>
            <Coffee />
          </span>
          <div>
            <p>The Daily Commit</p>
            <small>Staff operations</small>
          </div>
        </div>
        <div className="admin-login-heading">
          <span>
            <LockKeyhole />
          </span>
          <h1>Welcome back</h1>
          <p>Sign in to manage today’s booth operations.</p>
        </div>
        {auth.error && !auth.session && (
          <div className="admin-error" role="alert">
            {auth.error}
          </div>
        )}
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        {auth.session && !auth.profile && !auth.loading && (
          <div className="admin-error" role="alert">
            {auth.error}
            <button type="button" onClick={() => void auth.signOut()}>
              Sign out
            </button>
          </div>
        )}
        <form onSubmit={(event) => void signIn(event)}>
          <label htmlFor="staff-email">Email address</label>
          <input
            id="staff-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="staff-password">Password</label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            className="admin-primary-button"
            type="submit"
            disabled={submitting || auth.loading}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
