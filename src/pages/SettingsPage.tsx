import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/ui'
import { IconCalendar, IconChevronRight, IconLogout, IconTag, IconTrend, IconWallet } from '../components/Icons'

export function SettingsPage() {
  const { session, signOut } = useAuth()

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
          {link('/echeancier', 'Échéancier', IconCalendar)}
          {link('/evolution', 'Évolution du solde', IconTrend)}
          {link('/comptes', 'Comptes bancaires', IconWallet)}
          {link('/categories', 'Catégories', IconTag)}
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
