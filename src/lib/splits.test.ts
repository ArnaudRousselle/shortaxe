import { describe, expect, it } from 'vitest'
import { computeSplits, type SplitRow } from './splits'

let key = 0
function row(categoryId: string, value = ''): SplitRow {
  return { key: key++, categoryId, value }
}

describe('computeSplits', () => {
  it('sans ligne : pas de ventilation, pas d’erreur', () => {
    expect(computeSplits(1250, [])).toEqual({ splits: [], error: null, remaining: 0 })
  })

  it('une seule ligne reçoit tout le montant, quelle que soit la saisie', () => {
    expect(computeSplits(1250, [row('alim', '3')])).toEqual({
      splits: [{ categoryId: 'alim', cents: 1250 }],
      error: null,
      remaining: 0,
    })
  })

  it('une seule ligne sans catégorie est signalée', () => {
    const res = computeSplits(1250, [row('')])
    expect(res.error).toBe('Choisis une catégorie pour chaque ligne de ventilation.')
  })

  it('répartit le montant quand la somme est exacte', () => {
    expect(computeSplits(1250, [row('alim', '10'), row('loisirs', '2,50')])).toEqual({
      splits: [
        { categoryId: 'alim', cents: 1000 },
        { categoryId: 'loisirs', cents: 250 },
      ],
      error: null,
      remaining: 0,
    })
  })

  it('indique le reste à répartir quand la somme ne tombe pas juste', () => {
    const res = computeSplits(1250, [row('alim', '10'), row('loisirs', '')])
    expect(res.splits).toEqual([])
    expect(res.remaining).toBe(250)
    expect(res.error).toMatch(/^La ventilation doit égaler le montant \(reste 2,50\s€\)\.$/)
  })

  it('indique un reste négatif quand on dépasse le montant', () => {
    const res = computeSplits(1000, [row('alim', '8'), row('loisirs', '3')])
    expect(res.remaining).toBe(-100)
    expect(res.error).toContain('-1,00')
  })

  it('refuse un montant invalide ou négatif', () => {
    for (const bad of ['abc', '-5', '1,234']) {
      expect(computeSplits(1000, [row('alim', bad), row('loisirs', '5')])).toEqual({
        splits: [],
        error: 'Un montant de ventilation est invalide.',
        remaining: 0,
      })
    }
  })

  it('refuse une catégorie manquante', () => {
    const res = computeSplits(1000, [row('alim', '5'), row('', '5')])
    expect(res.error).toBe('Choisis une catégorie pour chaque ligne de ventilation.')
    expect(res.splits).toEqual([])
  })

  it('refuse une catégorie en double', () => {
    const res = computeSplits(1000, [row('alim', '5'), row('alim', '5')])
    expect(res.error).toBe('Une même catégorie apparaît deux fois.')
    expect(res.splits).toEqual([])
  })

  it('l’erreur de catégorie passe avant celle du reste', () => {
    const res = computeSplits(1000, [row('alim', '1'), row('alim', '1')])
    expect(res.error).toBe('Une même catégorie apparaît deux fois.')
    expect(res.remaining).toBe(800)
  })

  it('refuse une ligne à zéro même si la somme est juste', () => {
    const res = computeSplits(1000, [row('alim', '10'), row('loisirs', '0')])
    expect(res.error).toBe('Chaque catégorie doit recevoir un montant non nul.')
    expect(res.remaining).toBe(0)
  })
})
