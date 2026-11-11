import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { countDueScheduled, getCategoryTotals, listBalances, listBudgets, listTransactions } from '../lib/api'
import { addMonths, currentMonth, formatEuro, formatMonth } from '../lib/format'
import { buildCategoryLines, round2 } from '../lib/report'
import { useAsync } from '../lib/useAsync'
import type { Transaction } from '../lib/types'
import { Amount, BudgetBar, CategoryDot, EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { TransactionModal } from '../components/TransactionModal'
import { TransactionRow } from '../components/TransactionRow'
import { IconChevronRight, IconPlus } from '../components/Icons'

export function DashboardPage() {
  const { accounts, categories, loading: refLoading, error: refError } = useData()
  const month = currentMonth()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const next = addMonths(month, 1)
    const [balances, budgets, totals, recent, dueCount] = await Promise.all([
      listBalances(),
      listBudgets(month, next),
      getCategoryTotals(month, next),
      listTransactions({ limit: 8 }),
      countDueScheduled(next).catch(() => 0),
    ])
    return { balances, budgets, totals, recent, dueCount }
  }, [month])
  const { data, loading, error, reload } = useAsync(load, [load])

  const activeAccounts = accounts.filter((a) => !a.is_archived)
  const total = round2(activeAccounts.reduce((s, a) => s + (data?.balances[a.id]?.balance ?? 0), 0))
  const lines = useMemo(
    () => (data ? buildCategoryLines(categories, data.budgets, data.totals).filter((l) => l.budget > 0) : []),
    [data, categories],
  )
  const totalBudget = round2(lines.reduce((s, l) => s + l.budget, 0))
  const totalSpent = round2(lines.reduce((s, l) => s + l.spent, 0))

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
          Bienvenue ! Commence par <Link className="font-medium text-brand-700 underline" to="/comptes">créer tes comptes bancaires</Link>, puis vérifie
          tes <Link className="font-medium text-brand-700 underline" to="/categories">catégories</Link>.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Soldes */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Soldes</h2>
              <Link to="/comptes" className="text-sm text-brand-700">Gérer</Link>
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
              <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                <span>Total</span>
                <Amount value={total} signed={false} />
              </div>
            </div>
          </section>

          {/* Budgets du mois */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Budgets — {formatMonth(month)}</h2>
              <Link to="/budgets" className="text-sm text-brand-700">Modifier</Link>
            </div>
            {lines.length === 0 ? (
              <EmptyState>
                Aucun budget ce mois-ci. <Link className="font-medium text-brand-700 underline" to="/budgets">Définir les budgets</Link>
              </EmptyState>
            ) : (
              <div className="card space-y-3 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Reste à dépenser</span>
                  <span className={`font-semibold tabular-nums ${totalBudget - totalSpent < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatEuro(round2(totalBudget - totalSpent))} sur {formatEuro(totalBudget)}
                  </span>
                </div>
                <BudgetBar spent={totalSpent} budget={totalBudget} />
                <ul className="space-y-3 pt-2">
                  {lines.map((l) => (
                    <li key={l.category.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <CategoryDot color={l.category.color} />
                          <span className="truncate">{l.category.name}</span>
                        </span>
                        <span className={`tabular-nums ${l.remaining < 0 ? 'font-semibold text-red-600' : 'text-slate-600'}`}>
                          {l.remaining < 0 ? `−${formatEuro(-l.remaining)}` : formatEuro(l.remaining)}
                        </span>
                      </div>
                      <BudgetBar spent={l.spent} budget={l.budget} color={l.category.color} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Dernières opérations */}
          <section className="lg:col-span-2">
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
