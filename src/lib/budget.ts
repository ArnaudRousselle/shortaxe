import { advanceSchedule } from './balance'
import type { AnnualBudget, Budget, ScheduledTransaction } from './types'

// ---------------------------------------------------------------------------
// Budgets annuels
// Le budget est saisi et stocké par année et par catégorie (annual_budgets).
// Pour l'accueil et les rapports mensuels, il est réparti à parts égales sur
// les 12 mois. Tous les calculs sont faits en centimes.
// ---------------------------------------------------------------------------

/**
 * Répartit un montant annuel (en centimes) sur 12 mois.
 * Les centimes restants vont aux premiers mois : 1 000,00 € → 4 × 83,34 € + 8 × 83,33 € (somme exacte).
 */
export function spreadAnnualCents(cents: number): number[] {
  const base = Math.floor(cents / 12)
  const rest = cents - base * 12
  return Array.from({ length: 12 }, (_, i) => base + (i < rest ? 1 : 0))
}

/**
 * Parts mensuelles des budgets annuels pour les mois de [from, to[ (dates "YYYY-MM-01").
 * Un budget à 0 ne produit aucune ligne.
 */
export function monthlyBudgetsFromAnnual(annual: AnnualBudget[], from: string, to: string): Budget[] {
  const out: Budget[] = []
  for (const a of annual) {
    const cents = Math.round(a.amount * 100)
    if (cents <= 0) continue
    const parts = spreadAnnualCents(cents)
    parts.forEach((c, i) => {
      const month = `${a.year}-${String(i + 1).padStart(2, '0')}-01`
      if (month >= from && month < to) out.push({ id: `${a.id}-${month}`, category_id: a.category_id, month, amount: c / 100 })
    })
  }
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

/**
 * Budget complet de l'année calculé à partir de l'échéancier : chaque catégorie
 * de `categoryIds` absente de l'échéancier (ou en recette nette) est à 0.
 */
export function fullBudgetFromSchedule(items: ScheduledTransaction[], year: number, categoryIds: string[]): Record<string, number> {
  const computed = budgetsFromSchedule(items, year)
  const out: Record<string, number> = {}
  for (const id of categoryIds) out[id] = computed[id] ?? 0
  for (const [id, amount] of Object.entries(computed)) out[id] = amount
  return out
}
