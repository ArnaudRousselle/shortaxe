import { useState, type FormEvent } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { Logo } from '../components/Logo'

export function SetPasswordPage() {
  const { clearNeedsPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.')
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else clearNeedsPassword()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 pb-2">
          <Logo className="h-12 w-12" />
          <h1 className="text-xl font-semibold">Choisis ton mot de passe</h1>
        </div>
        <div>
          <label className="label" htmlFor="pw">Nouveau mot de passe</label>
          <input id="pw" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw2">Confirmation</label>
          <input id="pw2" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          Enregistrer
        </button>
      </form>
    </div>
  )
}
