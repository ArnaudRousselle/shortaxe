import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { exportAll } from '../lib/api'
import { todayISO } from '../lib/format'
import { errorMessage } from '../lib/supabase'
import { ErrorBanner, PageHeader } from '../components/ui'
import { IconChevronRight, IconDownload, IconLogout, IconTag, IconWallet } from '../components/Icons'

export function SettingsPage() {
  const { session, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onExport() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const backup = (await exportAll()) as { counts: Record<string, number> }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shortaxe-sauvegarde-${todayISO()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      const c = backup.counts
      setInfo(`Sauvegarde téléchargée : ${c.accounts} comptes, ${c.categories} catégories, ${c.transactions} opérations, ${c.budgets} budgets.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const link = (to: string, label: string, Icon: typeof IconWallet) => (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
      <Icon className="h-5 w-5 text-slate-500" />
      <span className="flex-1 font-medium">{label}</span>
      <IconChevronRight className="h-4 w-4 text-slate-400" />
    </Link>
  )

  return (
    <>
      <PageHeader title="Réglages" />
      <div className="space-y-6">
        <section className="card divide-y divide-slate-100 overflow-hidden">
          {link('/comptes', 'Comptes bancaires', IconWallet)}
          {link('/categories', 'Catégories', IconTag)}
        </section>

        <section className="card p-4">
          <h2 className="font-semibold">Sauvegarde</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Télécharge l’ensemble des données (comptes, catégories, opérations, ventilations, budgets) dans un fichier JSON.
          </p>
          <ErrorBanner message={error} />
          {info && <p className="mb-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{info}</p>}
          <button className="btn-primary" onClick={() => void onExport()} disabled={busy}>
            <IconDownload /> {busy ? 'Export en cours…' : 'Exporter en JSON'}
          </button>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold">Compte</h2>
          <p className="mt-1 mb-3 text-sm text-slate-600">Connecté en tant que {session?.user.email}</p>
          <button className="btn-secondary" onClick={() => void signOut()}>
            <IconLogout /> Se déconnecter
          </button>
        </section>
      </div>
    </>
  )
}
