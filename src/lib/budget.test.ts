import { describe, expect, it } from 'vitest'
import { annualBudgetsByCategory, budgetsFromSchedule, scheduleOccurrencesInYear, spreadAnnualCents } from './budget'
import type { ScheduledTransaction } from './types'

function schedule(
  next_date: string,
  frequency_months: number,
  splits: { category_id: string; amount: number }[],
  day_of_month = Number(next_date.slice(8, 10)),
): ScheduledTransaction {
  const amount = splits.reduce((s, p) => s + p.amount, 0)
  return {
    id: `s-${next_date}-${frequency_months}`,
    account_id: 'a1',
    label: 'Échéance',
    amount,
    notes: null,
    frequency_months,
    next_date,
    day_of_month,
    created_at: '',
    updated_at: '',
    scheduled_transaction_splits: splits,
  }
}

describe('spreadAnnualCents', () => {
  it('répartit exactement sur 12 mois, les centimes restants sur les premiers mois', () => {
    const parts = spreadAnnualCents(100_000)
    expect(parts).toHaveLength(12)
    expect(parts.reduce((s, c) => s + c, 0)).toBe(100_000)
    expect(parts.slice(0, 4)).toEqual([8334, 8334, 8334, 8334])
    expect(parts.slice(4)).toEqual(Array(8).fill(8333))
  })

  it('gère les petits montants et zéro', () => {
    expect(spreadAnnualCents(5)).toEqual([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
    expect(spreadAnnualCents(0)).toEqual(Array(12).fill(0))
  })
})

describe('annualBudgetsByCategory', () => {
  it('additionne les mois de l’année demandée seulement', () => {
    const out = annualBudgetsByCategory(
      [
        { category_id: 'a', month: '2026-01-01', amount: 83.34 },
        { category_id: 'a', month: '2026-02-01', amount: 83.33 },
        { category_id: 'b', month: '2026-12-01', amount: 500 },
        { category_id: 'a', month: '2027-01-01', amount: 999 },
      ],
      2026,
    )
    expect(out).toEqual({ a: 166.67, b: 500 })
  })
})

describe('scheduleOccurrencesInYear', () => {
  it('mensuelle : 12 occurrences, quelle que soit la prochaine date', () => {
    expect(scheduleOccurrencesInYear(schedule('2026-11-05', 1, []), 2026)).toBe(12)
    expect(scheduleOccurrencesInYear(schedule('2026-11-05', 1, []), 2027)).toBe(12)
    expect(scheduleOccurrencesInYear(schedule('2024-03-05', 1, []), 2027)).toBe(12)
  })

  it('trimestrielle : 4, annuelle : 1', () => {
    expect(scheduleOccurrencesInYear(schedule('2026-02-15', 3, []), 2026)).toBe(4)
    expect(scheduleOccurrencesInYear(schedule('2026-12-15', 12, []), 2027)).toBe(1)
  })

  it('fréquence qui ne divise pas 12 : suit le rythme réel', () => {
    // Tous les 5 mois depuis janvier 2026 : janv., juin, nov. 2026 puis avr., sept. 2027
    expect(scheduleOccurrencesInYear(schedule('2026-01-10', 5, []), 2026)).toBe(3)
    expect(scheduleOccurrencesInYear(schedule('2026-01-10', 5, []), 2027)).toBe(2)
  })

  it('tous les 2 ans : 0 ou 1 selon l’année', () => {
    expect(scheduleOccurrencesInYear(schedule('2026-06-01', 24, []), 2026)).toBe(1)
    expect(scheduleOccurrencesInYear(schedule('2026-06-01', 24, []), 2027)).toBe(0)
    expect(scheduleOccurrencesInYear(schedule('2026-06-01', 24, []), 2028)).toBe(1)
  })

  it('jour 31 : ne dérive pas après les mois courts', () => {
    expect(scheduleOccurrencesInYear(schedule('2026-02-28', 1, [], 31), 2026)).toBe(12)
  })
})

describe('budgetsFromSchedule', () => {
  it('regroupe par catégorie sur l’année, ventilations comprises', () => {
    const out = budgetsFromSchedule(
      [
        schedule('2026-11-05', 1, [{ category_id: 'maison', amount: -800 }]),
        schedule('2026-03-10', 3, [{ category_id: 'voiture', amount: -120.5 }]),
        schedule('2026-09-01', 12, [
          { category_id: 'maison', amount: -300 },
          { category_id: 'voiture', amount: -650 },
        ]),
      ],
      2027,
    )
    expect(out).toEqual({ maison: 9900, voiture: 1132 })
  })

  it('déduit les recettes ventilées et ignore les catégories en recette nette', () => {
    const out = budgetsFromSchedule(
      [
        schedule('2026-11-01', 1, [{ category_id: 'revenus', amount: 2500 }]),
        schedule('2026-11-01', 1, [{ category_id: 'sante', amount: -50 }]),
        schedule('2026-06-01', 12, [{ category_id: 'sante', amount: 100 }]),
      ],
      2026,
    )
    expect(out).toEqual({ sante: 500 })
  })

  it('évite les erreurs d’arrondi', () => {
    const out = budgetsFromSchedule([schedule('2026-01-01', 1, [{ category_id: 'x', amount: -0.1 }])], 2026)
    expect(out).toEqual({ x: 1.2 })
  })
})
