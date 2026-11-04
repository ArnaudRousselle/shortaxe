import { useCallback, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { listBudgets, listTransactions } from '../lib/api'
import { addMonths, currentMonth, formatEuro, formatMonthShort, monthsOfYear, yearStart } from '../lib/format'
import { buildCategoryLines, cashflow, round2, totalsFromTransactions, type CategoryLine } from '../lib/report'
import { useAsync } from '../lib/useAsync'
import { Amount, BudgetBar, CategoryDot, EmptyState, ErrorBanner, Loading, MonthPicker, PageHeader, Segmented, YearPicker } from '../components/ui'

type Period = 'mois' | 'annee'

function SummaryCards({ income, expense, net, uncategorized }: ReturnType<typeof cashflow>) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="card p-3">
        <p className="text-xs text-slate-500">Recettes</p>
        <Amount value={income} className="text-lg font-semibold" />
      </div>
      <div className="card p-3">
        <p className="text-xs text-slate-500">Dépenses</p>
        <Amount value={expense} className="text-lg font-semibold" />
      </div>
      <div className="card p-3">
        <p className="text-xs text-slate-500">Solde de la période</p>
        <Amount value={net} className="text-lg font-semibold" />
      </div>
      <div className="card p-3">
        <p className="text-xs text-slate-500">Sans catégorie</p>
        <Amount value={uncategorized} className="text-lg font-semibold" />
      </div>
    </div>
  )
}

function CategoryLines({ lines }: { lines: CategoryLine[] }) {
  if (lines.length === 0) return <EmptyState>Aucune dépense ni budget sur cette période.</EmptyState>
  const budgeted = lines.filter((l) => l.budget > 0)
  const totalBudget = round2(budgeted.reduce((s, l) => s + l.budget, 0))
  const totalSpent = round2(budgeted.reduce((s, l) => s + l.spent, 0))
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-slate-100">
        {lines.map((l) => (
          <li key={l.category.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <CategoryDot color={l.category.color} />
                <span className="truncate">{l.category.name}</span>
              </span>
              {l.budget > 0 ? (
                <span className={`text-sm font-semibold tabular-nums ${l.remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {l.remaining < 0 ? `Dépassé de ${formatEuro(-l.remaining)}` : `Reste ${formatEuro(l.remaining)}`}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Sans budget</span>
              )}
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
              <span>{l.spent < 0 ? `Recettes ${formatEuro(-l.spent)}` : `Dépensé ${formatEuro(l.spent)}`}</span>
              {l.budget > 0 && <span>Budget {formatEuro(l.budget)}</span>}
            </div>
            {l.budget > 0 && (
              <div className="mt-2">
                <BudgetBar spent={l.spent} budget={l.budget} color={l.category.color} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {budgeted.length > 0 && (
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">
          <span>Catégories budgétées</span>
          <span className="tabular-nums">
            {formatEuro(totalSpent)} / {formatEuro(totalBudget)} ·{' '}
            <span className={totalBudget - totalSpent < 0 ? 'text-red-600' : 'text-emerald-700'}>
              reste {formatEuro(round2(totalBudget - totalSpent))}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

function MonthReport({ month }: { month: string }) {
  const { categories } = useData()
  const load = useCallback(async () => {
    const next = addMonths(month, 1)
    const [txs, budgets] = await Promise.all([listTransactions({ from: month, to: next }), listBudgets(month, next)])
    return { txs, budgets }
  }, [month])
  const { data, loading, error } = useAsync(load, [load])

  const lines = useMemo(
    () => (data ? buildCategoryLines(categories, data.budgets, totalsFromTransactions(data.txs)) : []),
    [data, categories],
  )

  if (error) return <ErrorBanner message={error} />
  if (loading && !data) return <Loading />
  return (
    <>
      <SummaryCards {...cashflow(data?.txs ?? [])} />
      <CategoryLines lines={lines} />
    </>
  )
}

function YearReport({ year }: { year: number }) {
  const { categories } = useData()
  const months = useMemo(() => monthsOfYear(year), [year])
  const load = useCallback(async () => {
    const from = yearStart(year)
    const to = yearStart(year + 1)
    const [txs, budgets] = await Promise.all([listTransactions({ from, to }), listBudgets(from, to)])
    return { txs, budgets }
  }, [year])
  const { data, loading, error } = useAsync(load, [load])

  const view = useMemo(() => {
    if (!data) return null
    const totals = totalsFromTransactions(data.txs)
    const lines = buildCategoryLines(categories, data.budgets, totals)
    // Matrice catégorie × mois : dépensé et budget
    const cell = new Map<string, { spent: number; budget: number }>()
    const key = (c: string, m: string) => `${c}|${m}`
    for (const t of totals) {
      const k = key(t.category_id, t.month)
      const cur = cell.get(k) ?? { spent: 0, budget: 0 }
      cur.spent = round2(cur.spent - t.total)
      cell.set(k, cur)
    }
    for (const b of data.budgets) {
      const k = key(b.category_id, b.month)
      const cur = cell.get(k) ?? { spent: 0, budget: 0 }
      cur.budget = round2(cur.budget + b.amount)
      cell.set(k, cur)
    }
    const perMonth = months.map((m) => cashflow(data.txs.filter((t) => t.date.startsWith(m.slice(0, 7)))))
    return { lines, cell, key, perMonth }
  }, [data, categories, months])

  if (error) return <ErrorBanner message={error} />
  if (loading || !view) return <Loading />

  return (
    <>
      <SummaryCards {...cashflow(data?.txs ?? [])} />

      <h2 className="mb-2 text-lg font-semibold">Bilan annuel par catégorie</h2>
      <div className="mb-6">
        <CategoryLines lines={view.lines} />
      </div>

      <h2 className="mb-2 text-lg font-semibold">Détail mois par mois</h2>
      <p className="mb-2 text-xs text-slate-500">Montants dépensés ; en rouge quand le budget du mois est dépassé.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Catégorie</th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">{formatMonthShort(m)}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.lines.map((l) => (
              <tr key={l.category.id}>
                <td className="sticky left-0 bg-white px-3 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <CategoryDot color={l.category.color} />
                    {l.category.name}
                  </span>
                </td>
                {months.map((m) => {
                  const c = view.cell.get(view.key(l.category.id, m))
                  const over = c && c.budget > 0 && c.spent > c.budget
                  return (
                    <td
                      key={m}
                      className={`px-2 py-2 text-right whitespace-nowrap ${over ? 'font-semibold text-red-600' : c?.spent ? '' : 'text-slate-300'}`}
                      title={c?.budget ? `Budget ${formatEuro(c.budget)}` : undefined}
                    >
                      {c?.spent ? Math.round(c.spent).toLocaleString('fr-FR') : '—'}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatEuro(l.spent)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs">
            {(
              [
                ['Recettes', 'income'],
                ['Dépenses', 'expense'],
                ['Solde', 'net'],
              ] as const
            ).map(([label, field]) => (
              <tr key={field}>
                <td className="sticky left-0 bg-slate-50 px-3 py-1.5 font-semibold">{label}</td>
                {view.perMonth.map((p, i) => (
                  <td key={i} className={`px-2 py-1.5 text-right whitespace-nowrap ${p[field] < 0 && field === 'net' ? 'text-red-600' : ''}`}>
                    {p[field] ? Math.round(p[field]).toLocaleString('fr-FR') : '—'}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                  {formatEuro(round2(view.perMonth.reduce((s, p) => s + p[field], 0)))}
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </>
  )
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('mois')
  const [month, setMonth] = useState(currentMonth())
  const [year, setYear] = useState(Number(currentMonth().slice(0, 4)))

  return (
    <>
      <PageHeader
        title="Rapports"
        actions={
          <>
            <Segmented<Period>
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'mois', label: 'Mois' },
                { value: 'annee', label: 'Année' },
              ]}
            />
            {period === 'mois' ? <MonthPicker month={month} onChange={setMonth} /> : <YearPicker year={year} onChange={setYear} />}
          </>
        }
      />
      {period === 'mois' ? <MonthReport month={month} /> : <YearReport year={year} />}
    </>
  )
}
