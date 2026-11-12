import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addMonths,
  centsToInput,
  currentMonth,
  formatDateShort,
  formatDay,
  formatDayYear,
  formatEuro,
  formatFrequency,
  formatMonth,
  formatMonthShort,
  formatSignedEuro,
  fromCents,
  isScheduleDue,
  monthStart,
  monthsOfYear,
  parseEuroToCents,
  toCents,
  todayISO,
  yearStart,
} from './format'

// Intl en fr-FR utilise des espaces insécables : on les normalise
// pour garder des attentes lisibles.
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('formatEuro / formatSignedEuro', () => {
  it('formate en euros à la française', () => {
    expect(plain(formatEuro(1234.5))).toBe('1 234,50 €')
    expect(plain(formatEuro(0))).toBe('0,00 €')
    expect(plain(formatEuro(-12))).toBe('-12,00 €')
  })

  it('ajoute un signe explicite', () => {
    expect(plain(formatSignedEuro(12.5))).toBe('+12,50 €')
    expect(plain(formatSignedEuro(-12.5))).toBe('−12,50 €') // vrai signe moins (U+2212)
    expect(plain(formatSignedEuro(0))).toBe('0,00 €')
  })
})

describe('toCents / fromCents', () => {
  it('arrondit au centime', () => {
    expect(toCents(12.5)).toBe(1250)
    expect(toCents(0.29)).toBe(29) // 0.29 * 100 = 28.999…
    expect(toCents(-4.35)).toBe(-435)
    expect(fromCents(1250)).toBe(12.5)
  })
})

describe('parseEuroToCents', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['1 234,56', 123456],
    ['1 234,56', 123456],
    ['1 234,56', 123456],
    ['12,50 €', 1250],
    ['-12,50', -1250],
    [',5', 50],
    ['0,29', 29],
    ['  7  ', 700],
  ])('« %s » → %i centimes', (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents)
  })

  it.each(['', '   ', '-', ',', '.', 'abc', '12,345', '1.234,56', '12a', '--1', '1-2'])(
    '« %s » est invalide',
    (input) => {
      expect(parseEuroToCents(input)).toBeNull()
    },
  )
})

describe('centsToInput', () => {
  it('prépare la valeur d’un champ de saisie', () => {
    expect(centsToInput(1250)).toBe('12,50')
    expect(centsToInput(5)).toBe('0,05')
    expect(centsToInput(-1250)).toBe('-12,50')
    expect(centsToInput(0)).toBe('0,00')
  })

  it('fait l’aller-retour avec parseEuroToCents', () => {
    for (const c of [0, 1, 99, 1250, 123456, -789]) {
      expect(parseEuroToCents(centsToInput(c))).toBe(c)
    }
  })
})

describe('dates et mois', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('todayISO et currentMonth suivent la date locale', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 23, 30))
    expect(todayISO()).toBe('2026-01-05')
    expect(currentMonth()).toBe('2026-01-01')
  })

  it('monthStart / yearStart / monthsOfYear', () => {
    expect(monthStart('2026-11-17')).toBe('2026-11-01')
    expect(yearStart(2026)).toBe('2026-01-01')
    const months = monthsOfYear(2026)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01-01')
    expect(months[11]).toBe('2026-12-01')
  })

  it('addMonths franchit les années dans les deux sens', () => {
    expect(addMonths('2026-11-01', 1)).toBe('2026-12-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(addMonths('2026-03-01', -27)).toBe('2023-12-01')
    expect(addMonths('2026-03-01', 0)).toBe('2026-03-01')
  })

  it('formate les mois et les jours en français, avec une majuscule', () => {
    expect(formatMonth('2026-11-01')).toBe('Novembre 2026')
    expect(formatMonthShort('2026-02-01')).toBe('Févr')
    expect(formatMonthShort('2026-05-01')).toBe('Mai')
    expect(formatDay('2026-11-12')).toBe('Jeudi 12 novembre')
    expect(formatDayYear('2026-11-12')).toBe('Jeu. 12 novembre 2026')
    expect(formatDateShort('2026-03-05')).toBe('05/03/2026')
  })
})

describe('formatFrequency', () => {
  it.each([
    [1, 'Tous les mois'],
    [2, 'Tous les 2 mois'],
    [3, 'Tous les 3 mois'],
    [6, 'Tous les 6 mois'],
    [12, 'Tous les ans'],
    [18, 'Tous les 18 mois'],
    [24, 'Tous les 2 ans'],
  ])('%i → « %s »', (months, label) => {
    expect(formatFrequency(months)).toBe(label)
  })
})

describe('isScheduleDue', () => {
  const today = '2026-11-12'

  it('est due si elle tombe ce mois-ci ou avant', () => {
    expect(isScheduleDue('2026-11-30', today)).toBe(true)
    expect(isScheduleDue('2026-11-01', today)).toBe(true)
    expect(isScheduleDue('2026-09-15', today)).toBe(true)
  })

  it("n'est pas due à partir du mois prochain", () => {
    expect(isScheduleDue('2026-12-01', today)).toBe(false)
    expect(isScheduleDue('2027-01-15', today)).toBe(false)
  })

  it('gère le passage d’année', () => {
    expect(isScheduleDue('2026-12-31', '2026-12-01')).toBe(true)
    expect(isScheduleDue('2027-01-01', '2026-12-31')).toBe(false)
  })
})
