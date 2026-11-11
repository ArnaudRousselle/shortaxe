import type { Dispatch, SetStateAction } from 'react'
import { useData } from '../data/DataProvider'
import { centsToInput, formatEuro } from '../lib/format'
import type { computeSplits, SplitRow } from '../lib/splits'
import type { Category } from '../lib/types'
import { CategoryDot } from './ui'
import { IconPlus, IconTrash } from './Icons'

let nextKey = 1

/** Nouvelle clé unique pour une ligne de ventilation */
export function newSplitKey(): number {
  return nextKey++
}

/** Ventilation d'un montant sur une ou plusieurs catégories (opérations et échéancier). */
export function SplitEditor({
  rows,
  setRows,
  totalCents,
  result,
  categories,
}: {
  rows: SplitRow[]
  setRows: Dispatch<SetStateAction<SplitRow[]>>
  totalCents: number | null
  result: ReturnType<typeof computeSplits>
  /** Catégories proposées */
  categories: Category[]
}) {
  const { categoryById } = useData()

  function updateRow(key: number, patch: Partial<SplitRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    if (rows.length === 0) {
      setRows([{ key: newSplitKey(), categoryId: '', value: '' }])
      return
    }
    if (rows.length === 1) {
      // Une seule ligne recevait tout le montant : on le lui laisse, la nouvelle ligne est à compléter
      setRows([
        { ...rows[0], value: centsToInput(totalCents ?? 0) },
        { key: newSplitKey(), categoryId: '', value: '' },
      ])
      return
    }
    // Pré-remplit la nouvelle ligne avec ce qu'il reste à ventiler
    const value = result.remaining > 0 ? centsToInput(result.remaining) : ''
    setRows((rs) => [...rs, { key: newSplitKey(), categoryId: '', value }])
  }

  const multi = rows.length > 1

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-3">
        <span className="text-sm font-medium text-slate-700">Catégories</span>
      </div>

      {rows.length === 0 && (
        <p className="mb-2 text-sm text-slate-500">Sans catégorie (par exemple un virement entre comptes).</p>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const cat = categoryById[r.categoryId]
          return (
            <div key={r.key} className="flex items-center gap-2">
              {cat && <CategoryDot color={cat.color} />}
              <select
                className="input min-w-0 flex-1"
                value={r.categoryId}
                onChange={(e) => updateRow(r.key, { categoryId: e.target.value })}
                aria-label="Catégorie"
              >
                <option value="">Choisir…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {multi && (
                <div className="relative w-28 shrink-0">
                  <input
                    className="input pr-7 text-right tabular-nums"
                    inputMode="decimal"
                    value={r.value}
                    onChange={(e) => updateRow(r.key, { value: e.target.value })}
                    placeholder="0,00"
                    aria-label="Montant"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
                </div>
              )}
              <button
                type="button"
                className="btn-ghost shrink-0"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                aria-label="Retirer la ligne"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost text-brand-700" onClick={addRow}>
          <IconPlus className="h-4 w-4" /> {rows.length === 0 ? 'Ajouter une catégorie' : 'Répartir sur une autre catégorie'}
        </button>
        {multi && totalCents !== null && totalCents > 0 && result.remaining !== 0 && (
          <span className="text-sm text-amber-700">
            {result.remaining > 0 ? 'Reste à répartir' : 'Dépassement'} : {formatEuro(Math.abs(result.remaining) / 100)}
          </span>
        )}
      </div>
    </div>
  )
}
