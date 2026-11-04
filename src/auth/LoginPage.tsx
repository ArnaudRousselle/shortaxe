import { useState, type FormEvent } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(
        error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : errorMessage(error),
      )
    }
    setBusy(false)
  }

  async function onForgot() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError("Saisis d'abord ton adresse e-mail.")
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setInfo('Un e-mail de réinitialisation vient de t’être envoyé.')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 pb-2">
          <Logo className="h-12 w-12" />
          <h1 className="text-xl font-semibold">Shortaxe</h1>
          <p className="text-sm text-slate-500">Les comptes de la famille</p>
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{info}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          Se connecter
        </button>
        <button type="button" className="btn-ghost w-full" onClick={onForgot} disabled={busy}>
          Mot de passe oublié ?
        </button>
      </form>
    </div>
  )
}
