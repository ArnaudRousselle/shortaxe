import { describe, expect, it } from 'vitest'
import { buildCategoryLines, cashflow, round2, totalsFromTransactions } from './report'
import type { Budget, Category, Split, Transaction } from './types'

function category(id: string, name: string): Category {
  return { id, name, color: '#000', is_archived: false, created_at: '2026-01-01T00:00:00Z' }
}

function budget(category_id: string, amount: number, month = '2026-11-01'): Budget {
  return { id: `${category_id}-${month}-${amount}`, category_id, month, amount }
}

let txId = 0
function tx(date: string, amount: number, splits: Omit<Split, 'id' | 'transaction_id'>[] = []): Transaction {
  return {
    id: `t${txId++}`,
    account_id: 'a1',
    date,
    label: 'Opération',
    amount,
    notes: null,
    is_checked: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    transaction_splits: splits,
  }
}

describe('round2', () => {
  it('arrondit au centime', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(12.344)).toBe(12.34)
    expect(round2(12.346)).toBe(12.35)
    expect(round2(-3.333)).toBe(-3.33)
  })
})

describe('buildCategoryLines', () => {
  const alim = category('alim', 'Alimentation')
  const loisirs = category('loisirs', 'Loisirs')
  const sante = category('sante', 'Santé')
  const auto = category('auto', 'Auto')

  it('calcule budget, dépensé et reste ; les dépenses (négatives) deviennent positives', () => {
    const lines = buildCategoryLines([alim], [budget('alim', 400)], [{ category_id: 'alim', total: -150.25 }])
    expect(lines).toEqual([{ category: alim, budget: 400, spent: 150.25, remaining: 249.75 }])
  })

  it('déduit les remboursements du dépensé', () => {
    const [line] = buildCategoryLines([sante], [], [{ category_id: 'sante', total: 30 }])
    expect(line).toMatchObject({ budget: 0, spent: -30, remaining: 30 })
  })

  it('additionne plusieurs budgets et plusieurs totaux pour une même catégorie', () => {
    const [line] = buildCategoryLines(
      [alim],
      [budget('alim', 400, '2026-10-01'), budget('alim', 450, '2026-11-01')],
      [
        { category_id: 'alim', total: -300.1 },
        { category_id: 'alim', total: -200.2 },
      ],
    )
    expect(line).toMatchObject({ budget: 850, spent: 500.3, remaining: 349.7 })
  })

  it('ignore les catégories sans budget ni mouvement', () => {
    const lines = buildCategoryLines([alim, loisirs, sante], [budget('alim', 100)], [{ category_id: 'sante', total: -10 }])
    expect(lines.map((l) => l.category.id)).toEqual(['alim', 'sante'])
  })

  it('trie par budget, puis dépensé, puis nom', () => {
    const lines = buildCategoryLines(
      [sante, auto, alim, loisirs],
      [budget('alim', 400), budget('loisirs', 100)],
      [
        { category_id: 'sante', total: -50 },
        { category_id: 'auto', total: -50 },
        { category_id: 'loisirs', total: -20 },
      ],
    )
    expect(lines.map((l) => l.category.id)).toEqual(['alim', 'loisirs', 'auto', 'sante'])
  })

  it('trie les noms à la française (accents)', () => {
    const eco = category('eco', 'Économies')
    const fin = category('fin', 'Frais')
    const ent = category('ent', 'Entretien')
    const lines = buildCategoryLines(
      [fin, eco, ent],
      [],
      ['fin', 'eco', 'ent'].map((category_id) => ({ category_id, total: -10 })),
    )
    expect(lines.map((l) => l.category.name)).toEqual(['Économies', 'Entretien', 'Frais'])
  })
})

describe('totalsFromTransactions', () => {
  it('regroupe les ventilations par mois et par catégorie', () => {
    const totals = totalsFromTransactions([
      tx('2026-11-03', -50, [{ category_id: 'alim', amount: -50 }]),
      tx('2026-11-20', -80, [
        { category_id: 'alim', amount: -30 },
        { category_id: 'loisirs', amount: -50 },
      ]),
      tx('2026-12-01', -10, [{ category_id: 'alim', amount: -10 }]),
      tx('2026-11-25', 1000), // non ventilée : ignorée
    ])
    expect(totals).toHaveLength(3)
    expect(totals).toEqual(
      expect.arrayContaining([
        { month: '2026-11-01', category_id: 'alim', total: -80 },
        { month: '2026-11-01', category_id: 'loisirs', total: -50 },
        { month: '2026-12-01', category_id: 'alim', total: -10 },
      ]),
    )
  })

  it('renvoie une liste vide sans opération', () => {
    expect(totalsFromTransactions([])).toEqual([])
  })
})

describe('cashflow', () => {
  it('sépare recettes et dépenses et calcule le net', () => {
    const res = cashflow([
      tx('2026-11-01', 2500, [{ category_id: 'salaire', amount: 2500 }]),
      tx('2026-11-02', -800.1, [{ category_id: 'loyer', amount: -800.1 }]),
      tx('2026-11-03', -0.2),
      tx('2026-11-04', 0.1),
    ])
    expect(res).toEqual({ income: 2500.1, expense: -800.3, net: 1699.8, uncategorized: -0.1 })
  })

  it('renvoie des zéros sans opération', () => {
    expect(cashflow([])).toEqual({ income: 0, expense: 0, net: 0, uncategorized: 0 })
  })
})
