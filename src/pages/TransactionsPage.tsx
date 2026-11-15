import { useCallback, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { listTransactions, setTransactionChecked } from '../lib/api'
import { addMonths, currentMonth, formatDay, yearStart } from '../lib/format'
import { errorMessage } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Transaction } from '../lib/types'
import { Amount, EmptyState, ErrorBanner, Loading, MonthPicker, PageHeader, Segmented, YearPicker } from '../components/ui'
import { TransactionModal } from '../components/TransactionModal'
import { TransactionRow } from '../components/TransactionRow'
import { IconPlus, IconSearch } from '../components/Icons'

type Period = 'mois' | 'annee'

/** Filtre « Lignes de budget » (elles n'ont pas de compte) */
const BUDGETS = '__budgets__'

export function TransactionsPage() {
  const { accounts } = useData()
  const [period, setPeriod] = useState<Period>('mois')
  const [month, setMonth] = useState(currentMonth())
  const [year, setYear] = useState(Number(currentMonth().slice(0, 4)))
  const [accountId, setAccountId] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [creating, setCreating] = useState(false)
  // Ligne de budget pré-remplie dans la nouvelle opération (bouton « + »)
  const [budgetParent, setBudgetParent] = useState<Transaction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const from = period === 'mois' ? month : yearStart(year)
  const to = period === 'mois' ? addMonths(month, 1) : yearStart(year + 1)

  const budgetsOnly = accountId === BUDGETS
  const load = useCallback(
    () => listTransactions({ from, to, accountId: accountId && !budgetsOnly ? accountId : undefined, budgetsOnly }),
    [from, to, accountId, budgetsOnly],
  )
  const { data, loading, error, reload, setData } = useAsync(load, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((t) => {
      if (q && !t.label.toLowerCase().includes(q) && !(t.notes ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of filtered) {
      if (t.amount > 0) income += t.amount
      else expense += t.amount
    }
    return { income, expense, net: income + expense }
  }, [filtered])

  const byDay = useMemo(() => {
    const groups: { date: string; items: Transaction[] }[] = []
    for (const t of filtered) {
      const last = groups[groups.length - 1]
      if (last && last.date === t.date) last.items.push(t)
      else groups.push({ date: t.date, items: [t] })
    }
    return groups
  }, [filtered])

  async function toggleChecked(t: Transaction) {
    setActionError(null)
    // mise à jour optimiste
    setData((rows) => rows?.map((r) => (r.id === t.id ? { ...r, is_checked: !t.is_checked } : r)) ?? null)
    try {
      await setTransactionChecked(t.id, !t.is_checked)
    } catch (e) {
      setActionError(errorMessage(e))
      void reload()
    }
  }

  function onSaved() {
    setEditing(null)
    setCreating(false)
    setBudgetParent(null)
    void reload()
  }

  function addToBudget(t: Transaction) {
    setEditing(null)
    setBudgetParent(t)
    setCreating(true)
  }

  return (
    <>
      <PageHeader
        title="Opérations"
        actions={
          <button className="btn-primary hidden md:inline-flex" onClick={() => { setBudgetParent(null); setCreating(true) }}>
            <IconPlus /> Nouvelle opération
          </button>
        }
      />

      {/* Filtres */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'mois', label: 'Mois' },
              { value: 'annee', label: 'Année' },
            ]}
          />
          {period === 'mois' ? <MonthPicker month={month} onChange={setMonth} /> : <YearPicker year={year} onChange={setYear} />}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Compte">
            <option value="">Tous les comptes et budgets</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
            <option value={BUDGETS}>Lignes de budget</option>
          </select>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Totaux */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3">
          <p className="text-xs text-slate-500">Recettes</p>
          <Amount value={totals.income} className="font-semibold" />
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-500">Dépenses</p>
          <Amount value={totals.expense} className="font-semibold" />
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-500">Solde</p>
          <Amount value={totals.net} className="font-semibold" />
        </div>
      </div>

      <ErrorBanner message={error || actionError} />

      {loading && !data ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState>Aucune opération sur cette période.</EmptyState>
      ) : (
        <div className="space-y-4">
          {byDay.map((g) => (
            <section key={g.date}>
              <h2 className="mb-1 px-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{formatDay(g.date)}</h2>
              <ul className="card divide-y divide-slate-100 overflow-hidden">
                {g.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    onClick={() => setEditing(t)}
                    onToggleChecked={() => void toggleChecked(t)}
                    onAddToBudget={t.is_budget ? () => addToBudget(t) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Bouton flottant (mobile) */}
      <button
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg md:hidden"
        onClick={() => { setBudgetParent(null); setCreating(true) }}
        aria-label="Nouvelle opération"
      >
        <IconPlus className="h-7 w-7" />
      </button>

      <TransactionModal
        open={creating || editing !== null}
        transaction={editing}
        prefillBudget={editing ? null : budgetParent}
        defaultAccountId={accountId && !budgetsOnly ? accountId : undefined}
        onClose={() => {
          setCreating(false)
          setEditing(null)
          setBudgetParent(null)
        }}
        onSaved={onSaved}
      />
    </>
  )
}
