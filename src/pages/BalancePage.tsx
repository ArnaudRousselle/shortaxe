import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { listBalances, listScheduled, listTransactions } from '../lib/api'
import { buildBalanceSeries, pointValue, projectSchedule, shiftMonths, type BalancePoint } from '../lib/balance'
import { formatDateShort, formatEuro, todayISO } from '../lib/format'
import { round2 } from '../lib/report'
import { useAsync } from '../lib/useAsync'
import { Amount, EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { BalanceChart } from '../components/BalanceChart'

const ALL = ''
const MAX_ROWS = 60

/** Période par défaut : 1 an en arrière → 2 mois dans le futur */
function defaultRange(today: string) {
  return { from: shiftMonths(today, -12), to: shiftMonths(today, 2) }
}

function StatTile({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-slate-500">{label}</p>
      {value === null ? (
        <p className="text-lg font-semibold text-slate-400">—</p>
      ) : (
        <Amount value={value} signed={false} className={`text-lg font-semibold ${value < 0 ? 'text-red-600!' : ''}`} />
      )}
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function BalancePage() {
  const { accounts, accountById, loading: refLoading, error: refError } = useData()
  const today = todayISO()
  const def = defaultRange(today)
  const [from, setFrom] = useState(def.from)
  const [to, setTo] = useState(def.to)
  const [accountId, setAccountId] = useState<string>(ALL)

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.is_archived), [accounts])
  const rangeError = !from || !to ? 'Choisis une date de début et de fin.' : from > to ? 'La date de début doit précéder la date de fin.' : null

  const load = useCallback(async () => {
    const [balances, transactions, scheduled] = await Promise.all([
      listBalances(),
      // Toutes les opérations à partir du début de période (y compris celles datées dans le futur)
      listTransactions({ from, limit: 100_000 }),
      listScheduled(),
    ])
    return { balances, transactions, scheduled }
  }, [from])
  const { data, loading, error } = useAsync(load, [load])

  const view = useMemo(() => {
    if (!data || rangeError) return null
    const ids = new Set(accountId ? [accountId] : activeAccounts.map((a) => a.id))
    const txs = data.transactions.filter((t) => ids.has(t.account_id))
    // Solde actuel (toutes opérations) − opérations depuis le début de période = solde la veille du début
    const current = [...ids].reduce((s, id) => s + (data.balances[id]?.balance ?? 0), 0)
    const sinceFrom = txs.reduce((s, t) => s + t.amount, 0)
    const balanceBeforeFrom = round2(current - sinceFrom)

    const projected = projectSchedule(
      data.scheduled.filter((s) => ids.has(s.account_id)),
      today,
      to,
    )
    const points = buildBalanceSeries({ from, to, today, balanceBeforeFrom, transactions: txs, projected })
    const byDate = new Map<string, BalancePoint>(points.map((p) => [p.date, p]))

    let low: BalancePoint | null = null
    for (const p of points) if (!low || pointValue(p) < pointValue(low)) low = p

    return {
      points,
      byDate,
      low,
      first: points[0] ?? null,
      last: points[points.length - 1] ?? null,
      todayPoint: byDate.get(today) ?? null,
      upcoming: projected.filter((p) => p.date >= from),
      showAccount: ids.size > 1,
    }
  }, [data, rangeError, accountId, activeAccounts, from, to, today])

  const isDefault = from === def.from && to === def.to

  if (refLoading) return <Loading />

  return (
    <>
      <PageHeader
        title="Évolution du solde"
        actions={
          <select className="input w-auto" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Compte">
            <option value={ALL}>Tous les comptes</option>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        }
      />
      <ErrorBanner message={refError || error} />

      {activeAccounts.length === 0 ? (
        <EmptyState>
          Aucun compte. <Link className="font-medium text-brand-700 underline" to="/comptes">Créer un compte</Link>
        </EmptyState>
      ) : (
        <>
          <div className="card mb-4 p-4">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="balance-from">Du</label>
                <input id="balance-from" type="date" className="input w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="balance-to">Au</label>
                <input id="balance-to" type="date" className="input w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
              {!isDefault && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setFrom(def.from)
                    setTo(def.to)
                  }}
                >
                  Période par défaut
                </button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <svg width="22" height="6" aria-hidden="true"><line x1="0" x2="22" y1="3" y2="3" stroke="#0f766e" strokeWidth="2" /></svg>
                  Réel
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="22" height="6" aria-hidden="true"><line x1="0" x2="22" y1="3" y2="3" stroke="#0f766e" strokeWidth="2" strokeDasharray="5 4" /></svg>
                  Prévisionnel (échéancier)
                </span>
              </div>
            </div>
            <ErrorBanner message={rangeError} />
            {loading && !data ? <Loading /> : view && <BalanceChart points={view.points} today={today} />}
          </div>

          {view && view.first && view.last && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label={`Au ${formatDateShort(view.first.date)}`} value={pointValue(view.first)} />
                <StatTile label="Aujourd’hui" value={view.todayPoint?.actual ?? null} hint={view.todayPoint ? undefined : 'Hors période'} />
                <StatTile
                  label={`Au ${formatDateShort(view.last.date)}${view.last.forecast !== null ? ' (prévu)' : ''}`}
                  value={pointValue(view.last)}
                />
                <StatTile
                  label="Point bas"
                  value={view.low ? pointValue(view.low) : null}
                  hint={view.low ? `le ${formatDateShort(view.low.date)}${view.low.forecast !== null && view.low.date > today ? ' (prévu)' : ''}` : undefined}
                />
              </div>

              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Échéances prises en compte</h2>
                <Link to="/echeancier" className="text-sm text-brand-700">Échéancier</Link>
              </div>
              {view.upcoming.length === 0 ? (
                <EmptyState>
                  {to < today ? 'La période choisie est entièrement passée : pas de prévision.' : 'Aucune échéance prévue sur la période.'}
                </EmptyState>
              ) : (
                <div className="card overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {view.upcoming.slice(0, MAX_ROWS).map((p, i) => {
                      const after = view.byDate.get(p.date)?.forecast ?? null
                      return (
                        <li key={`${p.scheduleId}-${p.dueDate}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.label}</p>
                            <p className="truncate text-xs text-slate-500">
                              {formatDateShort(p.dueDate)}
                              {p.overdue && <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800">à créer</span>}
                              {view.showAccount && ` · ${accountById[p.account_id]?.name ?? ''}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <Amount value={p.amount} className="font-semibold" />
                            {after !== null && (
                              <p className={`text-xs tabular-nums ${after < 0 ? 'text-red-600' : 'text-slate-500'}`}>solde {formatEuro(after)}</p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {view.upcoming.length > MAX_ROWS && (
                    <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                      … et {view.upcoming.length - MAX_ROWS} autres échéances.
                    </p>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Le prévisionnel ajoute au solde réel les opérations déjà saisies avec une date future et chaque occurrence des échéances
                jusqu’à la fin de la période. Une échéance en retard (pas encore créée) est comptée aujourd’hui. Les comptes archivés ne sont
                pas inclus dans « Tous les comptes ».
              </p>
            </>
          )}
        </>
      )}
    </>
  )
}
