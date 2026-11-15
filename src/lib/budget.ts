import { advanceSchedule } from './balance'
import type { Budget, ScheduledTransaction } from './types'

// ---------------------------------------------------------------------------
// Budgets annuels
// Le budget est saisi par année et par catégorie ; en base il est réparti sur
// les 12 mois (table budgets), ce qui permet aux rapports mensuels et à
// l'accueil de continuer à fonctionner sans changement.
// Tous les calculs sont faits en centimes.
// ---------------------------------------------------------------------------

/**
 * Répartit un montant annuel (en centimes) sur 12 mois.
 * Les centimes restants vont aux premiers mois : 1 000,00 € → 8 × 83,33 € + 4 × 83,34 €… (somme exacte).
 */
export function spreadAnnualCents(cents: number): number[] {
  const base = Math.floor(cents / 12)
  const rest = cents - base * 12
  return Array.from({ length: 12 }, (_, i) => base + (i < rest ? 1 : 0))
}

/** Budget annuel par catégorie (en euros) = somme des budgets mensuels de l'année */
export function annualBudgetsByCategory(budgets: Pick<Budget, 'category_id' | 'month' | 'amount'>[], year: number): Record<string, number> {
  const cents: Record<string, number> = {}
  const prefix = `${year}-`
  for (const b of budgets) {
    if (!b.month.startsWith(prefix)) continue
    cents[b.category_id] = (cents[b.category_id] ?? 0) + Math.round(b.amount * 100)
  }
  const out: Record<string, number> = {}
  for (const [id, c] of Object.entries(cents)) out[id] = c / 100
  return out
}

/**
 * Nombre d'occurrences d'une échéance pendant l'année civile, en suivant son
 * rythme (fréquence et jour du mois) de part et d'autre de la prochaine date.
 * Toute l'année est comptée, que les opérations aient déjà été créées ou non.
 */
export function scheduleOccurrencesInYear(s: Pick<ScheduledTransaction, 'next_date' | 'frequency_months' | 'day_of_month'>, year: number): number {
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const f = s.frequency_months
  if (!(f >= 1)) return 0
  // Recule jusqu'à la dernière occurrence avant l'année
  let date = s.next_date
  for (let i = 0; date >= from && i < 2000; i++) date = advanceSchedule(date, -f, s.day_of_month)
  // Avance et compte les occurrences de l'année
  let count = 0
  for (let i = 0; date <= to && i < 2000; i++) {
    if (date >= from) count++
    date = advanceSchedule(date, f, s.day_of_month)
  }
  return count
}

/**
 * Budget annuel par catégorie calculé à partir de l'échéancier (en euros).
 * Dépenses moins recettes ventilées sur chaque catégorie, sur toute l'année.
 * Seules les catégories dont le solde est une dépense reçoivent un budget.
 */
export function budgetsFromSchedule(items: ScheduledTransaction[], year: number): Record<string, number> {
  const cents: Record<string, number> = {}
  for (const s of items) {
    const n = scheduleOccurrencesInYear(s, year)
    if (n === 0) continue
    for (const sp of s.scheduled_transaction_splits) {
      cents[sp.category_id] = (cents[sp.category_id] ?? 0) - Math.round(sp.amount * 100) * n
    }
  }
  const out: Record<string, number> = {}
  for (const [id, c] of Object.entries(cents)) if (c > 0) out[id] = c / 100
  return out
}
