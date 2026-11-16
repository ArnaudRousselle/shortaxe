import { describe, expect, it } from 'vitest'
import { computeAllocations, recentBudgetChoices, type AllocationRow } from './allocations'

let k = 0
const row = (budgetId: string, value = ''): AllocationRow => ({ key: k++, budgetId, value })

describe('computeAllocations', () => {
  it('sans part : tout le montant reste non rattaché', () => {
    expect(computeAllocations(15000, [])).toEqual({ allocations: [], error: null, remaining: 15000 })
  })

  it('une seule part laissée vide reçoit tout le montant', () => {
    expect(computeAllocations(15000, [row('courses')])).toEqual({
      allocations: [{ budgetId: 'courses', cents: 15000 }],
      error: null,
      remaining: 0,
    })
  })

  it('répartit sur plusieurs budgets (Intermarché 150 € : 50 € courses, 100 € loisirs)', () => {
    const r = computeAllocations(15000, [row('courses', '50'), row('loisirs', '100,00')])
    expect(r.error).toBeNull()
    expect(r.remaining).toBe(0)
    expect(r.allocations).toEqual([
      { budgetId: 'courses', cents: 5000 },
      { budgetId: 'loisirs', cents: 10000 },
    ])
  })

  it('accepte une répartition partielle : le reste est hors budget', () => {
    const r = computeAllocations(15000, [row('courses', '50')])
    expect(r.error).toBeNull()
    expect(r.remaining).toBe(10000)
    expect(r.allocations).toEqual([{ budgetId: 'courses', cents: 5000 }])
  })

  it('refuse une répartition qui dépasse le montant', () => {
    const r = computeAllocations(15000, [row('courses', '100'), row('loisirs', '60')])
    expect(r.allocations).toEqual([])
    expect(r.remaining).toBe(-1000)
    expect(r.error).toMatch(/dépasse/)
  })

  it('exige une ligne de budget pour chaque part', () => {
    expect(computeAllocations(15000, [row('courses', '50'), row('', '20')]).error).toMatch(/Choisis/)
  })

  it('refuse deux fois le même budget', () => {
    expect(computeAllocations(15000, [row('courses', '50'), row('courses', '20')]).error).toMatch(/deux fois/)
  })

  it('refuse une part vide ou nulle quand il y en a plusieurs', () => {
    expect(computeAllocations(15000, [row('courses', '50'), row('loisirs')]).error).toMatch(/non nul/)
    expect(computeAllocations(15000, [row('courses', '50'), row('loisirs', '0')]).error).toMatch(/non nul/)
  })

  it('refuse un montant invalide ou négatif', () => {
    expect(computeAllocations(15000, [row('courses', 'abc')]).error).toMatch(/invalide/)
    expect(computeAllocations(15000, [row('courses', '-5')]).error).toMatch(/invalide/)
  })
})

describe('recentBudgetChoices', () => {
  const budgets = Array.from({ length: 15 }, (_, i) => ({ id: `b${i}` }))
  const ids = (list: { id: string }[]) => list.map((b) => b.id)

  it('garde les 10 lignes les plus récentes', () => {
    expect(ids(recentBudgetChoices(budgets, []))).toEqual(budgets.slice(0, 10).map((b) => b.id))
  })

  it('ajoute à la fin une ligne plus ancienne déjà choisie', () => {
    expect(ids(recentBudgetChoices(budgets, ['b12', 'b3', '']))).toEqual([...budgets.slice(0, 10).map((b) => b.id), 'b12'])
  })

  it('renvoie toute la liste quand elle est courte', () => {
    expect(ids(recentBudgetChoices(budgets.slice(0, 4), ['b2']))).toEqual(['b0', 'b1', 'b2', 'b3'])
  })
})
