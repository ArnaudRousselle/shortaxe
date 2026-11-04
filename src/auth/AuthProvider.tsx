import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isFamilyMember } from '../lib/api'

type AuthState = {
  session: Session | null
  loading: boolean
  /** null = pas encore vérifié */
  isMember: boolean | null
  /** Arrivée via un lien d'invitation ou de réinitialisation : il faut choisir un mot de passe */
  needsPassword: boolean
  clearNeedsPassword: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function hashHasPasswordFlow(): boolean {
  const h = window.location.hash
  return h.includes('type=recovery') || h.includes('type=invite')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState<boolean | null>(null)
  const [needsPassword, setNeedsPassword] = useState(hashHasPasswordFlow)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const email = session?.user.email ?? null
  useEffect(() => {
    if (!email) {
      setIsMember(null)
      return
    }
    let cancelled = false
    isFamilyMember()
      .then((ok) => !cancelled && setIsMember(ok))
      .catch(() => !cancelled && setIsMember(false))
    return () => {
      cancelled = true
    }
  }, [email])

  const value: AuthState = {
    session,
    loading,
    isMember,
    needsPassword,
    clearNeedsPassword: () => {
      setNeedsPassword(false)
      history.replaceState(null, '', window.location.pathname)
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
