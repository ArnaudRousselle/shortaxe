import type { Dispatch, SetStateAction } from 'react'
import type { AllocationResult, AllocationRow } from '../lib/allocations'
import { budgetTone, centsToInput, formatBudgetOption, formatEuro } from '../lib/format'
import type { BudgetLine } from '../lib/types'
import { IconPlus, IconTrash } from './Icons'

let nextKey = 1

/** Couleur du libellé d'un budget dans la liste de choix (vert = reste, rouge = dépassé) */
const TONE_CLASS = { positive: 'text-green-700', negative: 'text-red-600', neutral: '' } as const

/** Nouvelle clé unique pour une ligne de répartition */
export function newAllocationKey(): number {
  return nextKey++
}

/** Répartition d'une opération sur une ou plusieurs lignes de budget. */
export function AllocationEditor({
  rows,
  setRows,
  totalCents,
  result,
  budgets,
}: {
  rows: AllocationRow[]
  setRows: Dispatch<SetStateAction<AllocationRow[]>>
  totalCents: number | null
  result: AllocationResult
  /** Lignes de budget proposées, de la plus récente à la plus ancienne */
  budgets: BudgetLine[]
}) {
  function updateRow(key: number, patch: Partial<AllocationRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    const added = { key: newAllocationKey(), budgetId: '', value: '' }
    // Première part : laissée vide, elle reçoit tout le montant
    if (rows.length === 0) return setRows([added])
    // Une seule part vide recevait tout le montant : on l'écrit pour la garder, la nouvelle est à compléter
    if (rows.length === 1 && rows[0].value.trim() === '' && totalCents) {
      return setRows([{ ...rows[0], value: centsToInput(totalCents) }, added])
    }
    // Sinon, la nouvelle part reçoit ce qui reste hors budget
    const left = Math.max(result.remaining, 0)
    setRows([...rows, { ...added, value: left > 0 ? centsToInput(left) : '' }])
  }

  const single = rows.length === 1
  const hasTotal = totalCents !== null && totalCents > 0

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2">
        <span className="text-sm font-medium text-slate-700">Budgets</span>
        <p className="text-xs text-slate-500">
          {rows.length === 0
            ? 'Opération rattachée à aucune ligne de budget.'
            : 'Chaque part est déduite de son budget. La somme ne peut pas dépasser le montant.'}
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const selected = budgets.find((b) => b.id === r.budgetId)
          return (
            <div key={r.key} className="flex items-center gap-2">
              <select
                className={`input min-w-0 flex-1 ${selected ? TONE_CLASS[budgetTone(selected)] : ''}`}
                value={r.budgetId}
                onChange={(e) => updateRow(r.key, { budgetId: e.target.value })}
                aria-label="Ligne de budget"
              >
                <option value="" className="text-slate-900">Choisir un budget…</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id} className={TONE_CLASS[budgetTone(b)] || 'text-slate-900'}>
                    {formatBudgetOption(b)}
                  </option>
                ))}
              </select>
              <div className="relative w-28 shrink-0">
                <input
                  className="input pr-7 text-right tabular-nums"
                  inputMode="decimal"
                  value={r.value}
                  onChange={(e) => updateRow(r.key, { value: e.target.value })}
                  placeholder={single && hasTotal ? centsToInput(totalCents) : '0,00'}
                  aria-label="Montant de la part"
                  title={single ? 'Laisse vide pour rattacher tout le montant' : undefined}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                aria-label="Retirer cette part"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost text-brand-700" onClick={addRow} disabled={budgets.length === 0}>
          <IconPlus className="h-4 w-4" /> {rows.length === 0 ? 'Rattacher à un budget' : 'Ajouter un budget'}
        </button>
        {rows.length > 0 && hasTotal && result.remaining !== 0 && (
          <span className={`text-sm ${result.remaining < 0 ? 'font-medium text-red-600' : 'text-slate-500'}`}>
            {result.remaining > 0 ? 'Hors budget' : 'Dépassement'} : {formatEuro(Math.abs(result.remaining) / 100)}
          </span>
        )}
      </div>
      {budgets.length === 0 && <p className="mt-1 text-xs text-slate-500">Aucune ligne de budget pour l’instant.</p>}
    </div>
  )
}
