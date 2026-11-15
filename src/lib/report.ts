import type { Category, CategoryMonthlyTotal, Transaction } from './types'
import { monthStart } from './format'

export type CategoryLine = {
  category: Category
  /** Dépensé net (dépenses − remboursements) : positif quand on a dépensé */
  spent: number
}

/**
 * Dépensé par catégorie pour une période donnée.
 * Inclut les catégories qui ont des mouvements sur la période, triées par dépensé décroissant.
 */
export function buildCategoryLines(categories: Category[], totals: { category_id: string; total: number }[]): CategoryLine[] {
  const spentBy = new Map<string, number>()
  for (const t of totals) spentBy.set(t.category_id, (spentBy.get(t.category_id) ?? 0) - t.total)

  return categories
    .filter((c) => spentBy.has(c.id))
    .map((c) => ({ category: c, spent: round2(spentBy.get(c.id) ?? 0) }))
    .sort((a, b) => b.spent - a.spent || a.category.name.localeCompare(b.category.name, 'fr'))
}

/** Totaux par catégorie et par mois, calculés à partir des opérations */
export function totalsFromTransactions(txs: Transaction[]): CategoryMonthlyTotal[] {
  const map = new Map<string, CategoryMonthlyTotal>()
  for (const t of txs) {
    const month = monthStart(t.date)
    for (const s of t.transaction_splits) {
      const key = `${month}|${s.category_id}`
      const cur = map.get(key)
      if (cur) cur.total += s.amount
      else map.set(key, { month, category_id: s.category_id, total: s.amount })
    }
  }
  return [...map.values()]
}

export function cashflow(txs: Transaction[]) {
  let income = 0
  let expense = 0
  let uncategorized = 0
  for (const t of txs) {
    if (t.amount > 0) income += t.amount
    else expense += t.amount
    if (t.transaction_splits.length === 0) uncategorized += t.amount
  }
  return { income: round2(income), expense: round2(expense), net: round2(income + expense), uncategorized: round2(uncategorized) }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
