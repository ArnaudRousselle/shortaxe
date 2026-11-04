import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

type PgError = { code?: string; message?: string } | null | undefined

/** Traduit les erreurs Supabase/Postgres en messages lisibles. */
export function errorMessage(error: unknown): string {
  const e = error as PgError
  if (!e) return 'Erreur inconnue'
  switch (e.code) {
    case '23503':
      return 'Cet élément est utilisé ailleurs (opérations, budgets…). Archive-le plutôt que de le supprimer.'
    case '23505':
      return 'Ce nom existe déjà.'
    case '42501':
      return "Accès refusé. Vérifie que ton adresse e-mail fait partie des membres de la famille."
    default:
      return e.message || String(error)
  }
}
