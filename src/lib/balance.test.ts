import { describe, expect, it } from 'vitest'
import {
  addDays,
  advanceSchedule,
  buildBalanceSeries,
  daysBetween,
  pointValue,
  projectSchedule,
  shiftMonths,
} from './balance'
import type { ScheduledTransaction } from './types'

function schedule(overrides: Partial<ScheduledTransaction> = {}): ScheduledTransaction {
  return {
    id: 's1',
    account_id: 'a1',
    label: 'Loyer',
    amount: -800,
    notes: null,
    frequency_months: 1,
    next_date: '2026-11-05',
    day_of_month: 5,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    scheduled_transaction_splits: [],
    ...overrides,
  }
}

describe('addDays / daysBetween', () => {
  it('ajoute des jours en franchissant mois et années', () => {
    expect(addDays('2026-11-12', 3)).toBe('2026-11-15')
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it("n'est pas perturbé par le passage à l'heure d'été / d'hiver", () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('compte les jours entre deux dates (b − a)', () => {
    expect(daysBetween('2026-11-12', '2026-11-12')).toBe(0)
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364)
    expect(daysBetween('2026-11-15', '2026-11-12')).toBe(-3)
  })
})

describe('advanceSchedule', () => {
  it('avance de N mois en gardant le jour', () => {
    expect(advanceSchedule('2026-11-05', 1, 5)).toBe('2026-12-05')
    expect(advanceSchedule('2026-11-05', 3, 5)).toBe('2027-02-05')
    expect(advanceSchedule('2026-11-05', 12, 5)).toBe('2027-11-05')
  })

  it('ramène le 29/30/31 au dernier jour des mois courts', () => {
    expect(advanceSchedule('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(advanceSchedule('2028-01-31', 1, 31)).toBe('2028-02-29')
    expect(advanceSchedule('2026-03-31', 1, 31)).toBe('2026-04-30')
    expect(advanceSchedule('2026-01-30', 1, 30)).toBe('2026-02-28')
  })

  it('retrouve le jour voulu après un mois court', () => {
    // 28/02 est une date « tronquée » : le mois suivant revient au 31
    expect(advanceSchedule('2026-02-28', 1, 31)).toBe('2026-03-31')
    expect(advanceSchedule('2026-04-30', 1, 31)).toBe('2026-05-31')
  })

  it('accepte un nombre de mois négatif', () => {
    expect(advanceSchedule('2026-01-15', -1, 15)).toBe('2025-12-15')
    expect(advanceSchedule('2026-03-31', -1, 31)).toBe('2026-02-28')
    expect(advanceSchedule('2026-11-12', -25, 12)).toBe('2024-10-12')
  })
})

describe('shiftMonths', () => {
  it('décale une date du même nombre de mois', () => {
    expect(shiftMonths('2026-11-12', -12)).toBe('2025-11-12')
    expect(shiftMonths('2026-11-12', -1)).toBe('2026-10-12')
    expect(shiftMonths('2026-11-12', 2)).toBe('2027-01-12')
  })

  it('ramène le 29/02 au 28/02 les années non bissextiles', () => {
    expect(shiftMonths('2028-02-29', -12)).toBe('2027-02-28')
    expect(shiftMonths('2026-05-31', -3)).toBe('2026-02-28')
  })
})

describe('projectSchedule', () => {
  const today = '2026-11-12'

  it('génère toutes les occurrences jusqu’à la date limite incluse', () => {
    const out = projectSchedule([schedule({ next_date: '2026-11-20', day_of_month: 20 })], today, '2027-01-20')
    expect(out.map((p) => p.date)).toEqual(['2026-11-20', '2026-12-20', '2027-01-20'])
    expect(out.every((p) => !p.overdue)).toBe(true)
    expect(out[0]).toMatchObject({ scheduleId: 's1', account_id: 'a1', label: 'Loyer', amount: -800 })
  })

  it('compte les échéances en retard à la date du jour', () => {
    const out = projectSchedule([schedule({ next_date: '2026-10-05' })], today, '2026-12-31')
    expect(out).toEqual([
      expect.objectContaining({ date: today, dueDate: '2026-10-05', overdue: true }),
      expect.objectContaining({ date: today, dueDate: '2026-11-05', overdue: true }),
      expect.objectContaining({ date: '2026-12-05', dueDate: '2026-12-05', overdue: false }),
    ])
  })

  it("une échéance prévue aujourd'hui n'est pas en retard", () => {
    const [p] = projectSchedule([schedule({ next_date: today, day_of_month: 12 })], today, today)
    expect(p).toMatchObject({ date: today, dueDate: today, overdue: false })
  })

  it('respecte la fréquence et la fin de mois', () => {
    const out = projectSchedule(
      [schedule({ next_date: '2026-11-30', day_of_month: 31, frequency_months: 3 })],
      today,
      '2027-12-31',
    )
    expect(out.map((p) => p.date)).toEqual(['2026-11-30', '2027-02-28', '2027-05-31', '2027-08-31', '2027-11-30'])
  })

  it('trie par date, puis date prévue, puis libellé', () => {
    const out = projectSchedule(
      [
        schedule({ id: 'b', label: 'Électricité', next_date: '2026-11-15', day_of_month: 15 }),
        schedule({ id: 'c', label: 'Assurance', next_date: '2026-11-15', day_of_month: 15 }),
        schedule({ id: 'a', label: 'Salaire', next_date: '2026-11-01', day_of_month: 1 }),
      ],
      today,
      '2026-11-30',
    )
    expect(out.map((p) => p.scheduleId)).toEqual(['a', 'c', 'b'])
  })

  it('ne renvoie rien si la limite est avant aujourd’hui', () => {
    expect(projectSchedule([schedule({ next_date: '2026-10-05' })], today, '2026-11-01')).toEqual([])
  })

  it('plafonne à 1 200 occurrences par échéance', () => {
    const out = projectSchedule([schedule({ next_date: '2026-01-01', day_of_month: 1 })], '2026-01-01', '2300-01-01')
    expect(out).toHaveLength(1200)
  })
})

describe('buildBalanceSeries', () => {
  it('renvoie une série vide si la période est inversée', () => {
    expect(
      buildBalanceSeries({
        from: '2026-11-10',
        to: '2026-11-01',
        today: '2026-11-05',
        balanceBeforeFrom: 0,
        transactions: [],
        projected: [],
      }),
    ).toEqual([])
  })

  it('cumule le réel jusqu’à aujourd’hui et le prévisionnel à partir d’aujourd’hui', () => {
    const series = buildBalanceSeries({
      from: '2026-11-10',
      to: '2026-11-14',
      today: '2026-11-12',
      balanceBeforeFrom: 100,
      transactions: [
        { date: '2026-11-10', amount: -20 },
        { date: '2026-11-12', amount: 50 },
        { date: '2026-11-12', amount: -5.5 },
        // hors période : ignorées
        { date: '2026-11-09', amount: 1000 },
        { date: '2026-11-15', amount: 1000 },
      ],
      projected: [
        { date: '2026-11-12', amount: -10 },
        { date: '2026-11-14', amount: -30 },
        { date: '2026-11-20', amount: -999 }, // après la période
      ],
    })
    expect(series).toEqual([
      { date: '2026-11-10', actual: 80, forecast: null },
      { date: '2026-11-11', actual: 80, forecast: null },
      { date: '2026-11-12', actual: 124.5, forecast: 114.5 },
      { date: '2026-11-13', actual: null, forecast: 114.5 },
      { date: '2026-11-14', actual: null, forecast: 84.5 },
    ])
  })

  it('compte dès le départ les échéances antérieures à une période future', () => {
    const series = buildBalanceSeries({
      from: '2026-12-01',
      to: '2026-12-02',
      today: '2026-11-12',
      balanceBeforeFrom: 500,
      transactions: [],
      projected: [
        { date: '2026-11-20', amount: -100 },
        { date: '2026-12-02', amount: 40 },
      ],
    })
    expect(series).toEqual([
      { date: '2026-12-01', actual: null, forecast: 400 },
      { date: '2026-12-02', actual: null, forecast: 440 },
    ])
  })

  it('évite les erreurs d’arrondi en calculant en centimes', () => {
    const series = buildBalanceSeries({
      from: '2026-11-12',
      to: '2026-11-12',
      today: '2026-11-12',
      balanceBeforeFrom: 0,
      transactions: [
        { date: '2026-11-12', amount: 0.1 },
        { date: '2026-11-12', amount: 0.2 },
      ],
      projected: [],
    })
    expect(series[0].actual).toBe(0.3)
  })

  it('a un point par jour, y compris sur une période d’un an', () => {
    const series = buildBalanceSeries({
      from: '2028-01-01',
      to: '2028-12-31',
      today: '2028-06-01',
      balanceBeforeFrom: 0,
      transactions: [],
      projected: [],
    })
    expect(series).toHaveLength(366)
    expect(series.at(-1)?.date).toBe('2028-12-31')
  })
})

describe('pointValue', () => {
  it('préfère le prévisionnel, puis le réel, puis 0', () => {
    expect(pointValue({ date: 'x', actual: 10, forecast: 20 })).toBe(20)
    expect(pointValue({ date: 'x', actual: 10, forecast: null })).toBe(10)
    expect(pointValue({ date: 'x', actual: null, forecast: null })).toBe(0)
    expect(pointValue({ date: 'x', actual: null, forecast: 0 })).toBe(0)
  })
})
