import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { countDueScheduled, getCategoryTotals, listBalances, listTransactions } from '../lib/api'
import { addMonths, currentMonth, formatEuro, formatMonth } from '../lib/format'
import { buildCategoryLines, round2 } from '../lib/report'
import { useAsync } from '../lib/useAsync'
import type { Transaction } from '../lib/types'
import { Amount, CategoryDot, EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
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
    const [balances, totals, recent, dueCount] = await Promise.all([
      listBalances(),
      getCategoryTotals(month, next),
      listTransactions({ limit: 8 }),
      countDueScheduled(next).catch(() => 0),
    ])
    return { balances, totals, recent, dueCount }
  }, [month])
  const { data, loading, error, reload } = useAsync(load, [load])

  const activeAccounts = accounts.filter((a) => !a.is_archived)
  const total = round2(activeAccounts.reduce((s, a) => s + (data?.balances[a.id]?.balance ?? 0), 0))
  const lines = useMemo(
    () => (data ? buildCategoryLines(categories, data.totals).filter((l) => l.spent > 0) : []),
    [data, categories],
  )
  const totalSpent = round2(lines.reduce((s, l) => s + l.spent, 0))
  const maxSpent = lines.reduce((m, l) => Math.max(m, l.spent), 0)

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
              <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                <span>Total</span>
                <Amount value={total} signed={false} />
              </div>
            </div>
          </section>

          {/* Dépenses du mois par catégorie */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Dépenses — {formatMonth(month)}</h2>
              <Link to="/rapports" className="text-sm text-brand-700">Rapports</Link>
            </div>
            {lines.length === 0 ? (
              <EmptyState>Aucune dépense catégorisée ce mois-ci.</EmptyState>
            ) : (
              <div className="card space-y-3 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total dépensé</span>
                  <span className="font-semibold tabular-nums">{formatEuro(totalSpent)}</span>
                </div>
                <ul className="space-y-3 pt-2">
                  {lines.map((l) => (
                    <li key={l.category.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <CategoryDot color={l.category.color} />
                          <span className="truncate">{l.category.name}</span>
                        </span>
                        <span className="tabular-nums text-slate-600">{formatEuro(l.spent)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${maxSpent > 0 ? (l.spent / maxSpent) * 100 : 0}%`, backgroundColor: l.category.color }}
                        />
                      </div>
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
