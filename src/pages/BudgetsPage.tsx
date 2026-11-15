import { useCallback, useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { getCategoryTotals, listBudgets, listScheduled, saveYearBudgets } from '../lib/api'
import { annualBudgetsByCategory, budgetsFromSchedule } from '../lib/budget'
import { centsToInput, formatEuro, parseEuroToCents, toCents, yearStart } from '../lib/format'
import { round2 } from '../lib/report'
import { errorMessage } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import { Amount, BudgetBar, CategoryDot, EmptyState, ErrorBanner, Loading, PageHeader, YearPicker } from '../components/ui'

export function BudgetsPage() {
  const { categories } = useData()
  const [year, setYear] = useState(new Date().getFullYear())
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const load = useCallback(async () => {
    const from = yearStart(year)
    const to = yearStart(year + 1)
    const [budgets, totals] = await Promise.all([listBudgets(from, to), getCategoryTotals(from, to)])
    return { budgets, totals }
  }, [year])
  const { data, loading, error, reload } = useAsync(load, [load])

  const saved = useMemo(() => annualBudgetsByCategory(data?.budgets ?? [], year), [data, year])

  const spent = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of data?.totals ?? []) m[t.category_id] = round2((m[t.category_id] ?? 0) - t.total)
    return m
  }, [data])

  // Réinitialise le brouillon quand les données de l'année changent
  useEffect(() => {
    const d: Record<string, string> = {}
    for (const [id, amount] of Object.entries(saved)) d[id] = centsToInput(toCents(amount))
    setDraft(d)
    setInfo(null)
    setActionError(null)
  }, [saved])

  const visibleCategories = categories.filter((c) => !c.is_archived || saved[c.id] !== undefined || spent[c.id] !== undefined)

  const parsed = useMemo(() => {
    const out: Record<string, number | null | 'invalid'> = {}
    for (const c of visibleCategories) {
      const raw = (draft[c.id] ?? '').trim()
      if (raw === '') out[c.id] = null
      else {
        const cents = parseEuroToCents(raw)
        out[c.id] = cents === null || cents < 0 ? 'invalid' : cents / 100
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, categories, saved, spent])

  const changes = visibleCategories
    .filter((c) => parsed[c.id] !== 'invalid' && (parsed[c.id] ?? null) !== (saved[c.id] ?? null))
    .map((c) => ({ category_id: c.id, amount: parsed[c.id] as number | null }))
  const hasInvalid = Object.values(parsed).includes('invalid')

  const totalBudget = round2(visibleCategories.reduce((s, c) => s + (typeof parsed[c.id] === 'number' ? (parsed[c.id] as number) : 0), 0))
  const totalSpent = round2(visibleCategories.filter((c) => typeof parsed[c.id] === 'number').reduce((s, c) => s + (spent[c.id] ?? 0), 0))

  async function onSave() {
    if (hasInvalid) return setActionError('Certains montants sont invalides.')
    setBusy(true)
    setActionError(null)
    try {
      await saveYearBudgets(year, changes)
      await reload()
      setInfo(`Budget ${year} enregistré.`)
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function computeFromSchedule() {
    setActionError(null)
    setBusy(true)
    try {
      const computed = budgetsFromSchedule(await listScheduled(), year)
      const ids = Object.keys(computed)
      if (ids.length === 0) return setInfo(`Aucune dépense de l’échéancier ne tombe en ${year}.`)
      const names = categories.filter((c) => ids.includes(c.id)).map((c) => c.name)
      if (
        !confirm(
          `Calculer le budget ${year} à partir de l’échéancier ?\n\n` +
            `Les montants actuels de ces catégories seront remplacés : ${names.join(', ')}.\n\n` +
            'Les autres catégories ne sont pas modifiées. Rien n’est enregistré tant que tu ne cliques pas sur « Enregistrer ».',
        )
      )
        return
      const d = { ...draft }
      for (const [id, amount] of Object.entries(computed)) d[id] = centsToInput(toCents(amount))
      setDraft(d)
      const total = round2(Object.values(computed).reduce((s, v) => s + v, 0))
      setInfo(`Budget calculé à partir de l’échéancier : ${formatEuro(total)} sur ${ids.length} catégorie${ids.length > 1 ? 's' : ''}. Vérifie puis enregistre.`)
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Budgets" actions={<YearPicker year={year} onChange={setYear} />} />

      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => void computeFromSchedule()} disabled={busy || loading}>
          Calculer le budget en fonction de l’échéancier
        </button>
        <button className="btn-primary ml-auto" onClick={() => void onSave()} disabled={busy || changes.length === 0}>
          Enregistrer{changes.length > 0 ? ` (${changes.length})` : ''}
        </button>
      </div>

      <ErrorBanner message={error || actionError} />
      {info && <div className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{info}</div>}

      {loading && !data ? (
        <Loading />
      ) : visibleCategories.length === 0 ? (
        <EmptyState>Crée d’abord des catégories.</EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1fr_8rem_7rem_7rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 uppercase sm:grid">
            <span>Catégorie</span>
            <span className="text-right">Budget {year}</span>
            <span className="text-right">Dépensé</span>
            <span className="text-right">Reste</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {visibleCategories.map((c) => {
              const p = parsed[c.id]
              const budget = typeof p === 'number' ? p : null
              const s = spent[c.id] ?? 0
              const remaining = budget !== null ? round2(budget - s) : null
              return (
                <li key={c.id} className="px-4 py-3">
                  <div className="grid grid-cols-[1fr_7rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[1fr_8rem_7rem_7rem]">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <CategoryDot color={c.color} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <div className="relative">
                      <input
                        className={`input py-1.5 pr-7 text-right tabular-nums ${p === 'invalid' ? 'border-red-400' : ''}`}
                        inputMode="decimal"
                        placeholder="—"
                        value={draft[c.id] ?? ''}
                        onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
                        aria-label={`Budget ${year} ${c.name}`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">€</span>
                    </div>
                    <span className="text-sm text-slate-500 sm:text-right">
                      <span className="sm:hidden">Dépensé </span>
                      <Amount value={s} signed={false} className="text-slate-700" />
                    </span>
                    <span className="text-right text-sm">
                      {remaining === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`font-semibold tabular-nums ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          <span className="font-normal text-slate-500 sm:hidden">Reste </span>
                          {formatEuro(remaining)}
                        </span>
                      )}
                    </span>
                  </div>
                  {budget !== null && (
                    <div className="mt-2">
                      <BudgetBar spent={s} budget={budget} color={c.color} />
                      <p className="mt-1 text-xs text-slate-400">soit {formatEuro(round2(budget / 12))} par mois</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="grid grid-cols-[1fr_7rem] gap-x-3 border-t border-slate-200 bg-slate-50 px-4 py-3 font-semibold sm:grid-cols-[1fr_8rem_7rem_7rem]">
            <span>Total budgété</span>
            <span className="pr-7 text-right tabular-nums">{formatEuro(totalBudget)}</span>
            <span className="text-sm sm:text-right"><span className="font-normal text-slate-500 sm:hidden">Dépensé </span><Amount value={totalSpent} signed={false} /></span>
            <span className={`text-right text-sm tabular-nums ${totalBudget - totalSpent < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              <span className="font-normal text-slate-500 sm:hidden">Reste </span>
              {formatEuro(round2(totalBudget - totalSpent))}
            </span>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Le budget est annuel ; il est réparti à parts égales sur les 12 mois pour l’accueil et les rapports mensuels.
        « Dépensé » correspond aux dépenses moins les remboursements ventilés sur la catégorie pendant l’année. Laisser un budget vide le supprime.
      </p>
    </>
  )
}
