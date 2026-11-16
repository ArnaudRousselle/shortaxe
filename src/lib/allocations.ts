import { formatEuro, parseEuroToCents } from './format'

/** Ligne du formulaire de répartition : une part de l'opération sur une ligne de budget */
export type AllocationRow = { key: number; budgetId: string; value: string }

export type AllocationResult = {
  /** Parts en centimes (valeurs absolues) */
  allocations: { budgetId: string; cents: number }[]
  error: string | null
  /** Montant non rattaché à un budget, en centimes (négatif si la répartition dépasse) */
  remaining: number
}

/**
 * Calcule la répartition d'une opération sur ses lignes de budget, à partir
 * des montants saisis en euros (valeurs absolues).
 * - Une seule ligne laissée vide reçoit tout le montant.
 * - La somme des parts ne doit pas dépasser le montant de l'opération :
 *   le reste n'est rattaché à aucun budget.
 */
export function computeAllocations(totalCents: number, rows: AllocationRow[]): AllocationResult {
  if (rows.length === 0) return { allocations: [], error: null, remaining: totalCents }

  if (rows.some((r) => !r.budgetId)) {
    return { allocations: [], error: 'Choisis une ligne de budget pour chaque part.', remaining: totalCents }
  }
  const ids = rows.map((r) => r.budgetId)
  if (new Set(ids).size !== ids.length) {
    return { allocations: [], error: 'Un même budget apparaît deux fois dans la répartition.', remaining: totalCents }
  }

  const values = rows.map((r) => {
    if (r.value.trim() === '') return rows.length === 1 ? totalCents : 0
    return parseEuroToCents(r.value)
  })
  if (values.some((v) => v === null || v < 0)) {
    return { allocations: [], error: 'Un montant de la répartition est invalide.', remaining: totalCents }
  }
  const cents = values as number[]
  const remaining = totalCents - cents.reduce((s, v) => s + v, 0)

  if (cents.some((v) => v === 0)) {
    return { allocations: [], error: 'Chaque part doit avoir un montant non nul.', remaining }
  }
  if (remaining < 0) {
    return {
      allocations: [],
      error: `La répartition dépasse le montant de l’opération de ${formatEuro(-remaining / 100)}.`,
      remaining,
    }
  }
  return { allocations: rows.map((r, i) => ({ budgetId: r.budgetId, cents: cents[i] })), error: null, remaining }
}

/** Nombre de lignes de budget proposées dans la liste déroulante */
export const BUDGET_CHOICES_LIMIT = 10

/**
 * Lignes de budget proposées dans la répartition : les `limit` plus récentes
 * (la liste reçue est triée de la plus récente à la plus ancienne), plus celles
 * déjà choisies qui seraient plus anciennes, pour ne pas les perdre en modification.
 */
export function recentBudgetChoices<T extends { id: string }>(
  budgets: T[],
  selectedIds: string[],
  limit = BUDGET_CHOICES_LIMIT,
): T[] {
  const recent = budgets.slice(0, limit)
  const shown = new Set(recent.map((b) => b.id))
  const older = budgets.slice(limit).filter((b) => selectedIds.includes(b.id) && !shown.has(b.id))
  return [...recent, ...older]
}
