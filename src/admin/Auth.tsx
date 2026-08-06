/* eslint-disable react-refresh/only-export-components */
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib'
import { getStaffProfile } from './api'
import type { StaffProfile } from './types'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: StaffProfile | null
  error: string | null
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    profile: null,
    error: null,
  })

  async function resolveSession(session: Session | null) {
    if (!session) {
      setState({ loading: false, session: null, profile: null, error: null })
      return
    }
    try {
      const profile = await getStaffProfile(session.user.id)
      setState({
        loading: false,
        session,
        profile,
        error: profile ? null : 'Your account does not have active staff access.',
      })
    } catch (error) {
      setState({
        loading: false,
        session,
        profile: null,
        error: error instanceof Error ? error.message : 'Unable to verify staff access.',
      })
    }
  }

  useEffect(() => {
    if (!supabase) {
      setState({
        loading: false,
        session: null,
        profile: null,
        error: 'Supabase configuration is missing. Check your .env file.',
      })
      return
    }
    void supabase.auth.getSession().then(({ data }) => resolveSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void resolveSession(session), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setState({ loading: false, session: null, profile: null, error: null })
  }

  async function refreshProfile() {
    await resolveSession(state.session)
  }

  const value = { ...state, signOut, refreshProfile }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useStaffAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useStaffAuth must be used within StaffAuthProvider.')
  return value
}
