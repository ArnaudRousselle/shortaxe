import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { countDueScheduled, listBalances, listBudgets, listTransactions } from '../lib/api'
import { addMonths, currentMonth, round2 } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { Transaction } from '../lib/types'
import { Amount, EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { TransactionModal } from '../components/TransactionModal'
import { TransactionRow } from '../components/TransactionRow'
import { IconChevronRight, IconPlus } from '../components/Icons'

export function DashboardPage() {
  const { accounts, loading: refLoading, error: refError } = useData()
  const month = currentMonth()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const next = addMonths(month, 1)
    const [balances, budgets, recent, dueCount] = await Promise.all([
      listBalances(),
      listBudgets(),
      listTransactions({ limit: 8 }),
      countDueScheduled(next).catch(() => 0),
    ])
    return { balances, budgets, recent, dueCount }
  }, [month])
  const { data, loading, error, reload } = useAsync(load, [load])

  const activeAccounts = accounts.filter((a) => !a.is_archived)
  const accountsTotal = round2(activeAccounts.reduce((s, a) => s + (data?.balances[a.id]?.balance ?? 0), 0))
  // Reste des lignes de budget (sans compte) : dépenses encore prévues
  const budgetsLeft = round2((data?.budgets ?? []).reduce((s, b) => s + b.amount, 0))
  const total = round2(accountsTotal + budgetsLeft)

  function onSaved() {
    setCreating(false)
    setEditing(null)
    void reload()
  }

  if (refLoading || (loading && !data)) return <Loading />

  return (
    <>
      <PageHeader
        title="Accueil"
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)} disabled={activeAccounts.length === 0}>
            <IconPlus /> Nouvelle opération
          </button>
        }
      />
      <ErrorBanner message={refError || error} />

      {(data?.dueCount ?? 0) > 0 && (
        <Link
          to="/echeancier"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 hover:bg-orange-100"
        >
          <span>
            <strong>{data?.dueCount} échéance{(data?.dueCount ?? 0) > 1 ? 's' : ''}</strong> à créer ce mois-ci dans l’échéancier
          </span>
          <IconChevronRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {activeAccounts.length === 0 ? (
        <EmptyState>
          Bienvenue ! Commence par <Link className="font-medium text-brand-700 underline" to="/comptes">créer tes comptes bancaires</Link>.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Soldes */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Soldes</h2>
              <span className="flex gap-4">
                <Link to="/evolution" className="text-sm text-brand-700">Évolution</Link>
                <Link to="/comptes" className="text-sm text-brand-700">Gérer</Link>
              </span>
            </div>
            <div className="card overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {activeAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="truncate text-xs text-slate-500">{a.bank || '—'}</p>
                    </div>
                    <Amount value={data?.balances[a.id]?.balance ?? 0} signed={false} className="font-semibold" />
                  </li>
                ))}
              </ul>
              {budgetsLeft !== 0 ? (
                <div className="border-t border-slate-200 bg-slate-50 text-sm">
                  <div className="flex justify-between px-4 pt-3">
                    <span className="text-slate-500">Total des comptes</span>
                    <Amount value={accountsTotal} signed={false} />
                  </div>
                  <div className="flex justify-between px-4 pt-1">
                    <span className="text-slate-500">Reste des budgets</span>
                    <Amount value={budgetsLeft} />
                  </div>
                  <div className="flex justify-between px-4 pt-2 pb-3 text-base font-semibold">
                    <span>Total après budgets</span>
                    <Amount value={total} signed={false} />
                  </div>
                </div>
              ) : (
                <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                  <span>Total</span>
                  <Amount value={total} signed={false} />
                </div>
              )}
            </div>
          </section>

          {/* Dernières opérations */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Dernières opérations</h2>
              <Link to="/operations" className="text-sm text-brand-700">Tout voir</Link>
            </div>
            {data && data.recent.length > 0 ? (
              <ul className="card divide-y divide-slate-100 overflow-hidden">
                {data.recent.map((t) => (
                  <TransactionRow key={t.id} transaction={t} showDate onClick={() => setEditing(t)} />
                ))}
              </ul>
            ) : (
              <EmptyState>Aucune opération saisie.</EmptyState>
            )}
          </section>
        </div>
      )}

      <TransactionModal
        open={creating || editing !== null}
        transaction={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={onSaved}
      />
    </>
  )
}
