import type { ScheduledTransaction, Transaction } from './types'

// ---------------------------------------------------------------------------
// Évolution du solde : historique (opérations) + prévision (échéancier)
// Tous les calculs sont faits en centimes pour éviter les erreurs d'arrondi.
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const DAY = 86_400_000

/** "2026-11-12" + 3 → "2026-11-15" */
export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * DAY)
}

/** Nombre de jours entre deux dates (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY)
}

/** Même date décalée de n mois ; 12/11/2026 − 1 an → 12/11/2025 (29/02 → 28/02) */
export function shiftMonths(iso: string, n: number): string {
  return advanceSchedule(iso, n, Number(iso.slice(8, 10)))
}

/**
 * Date suivante d'une échéance : + N mois en gardant le jour voulu
 * (31 → 28/29/30 selon le mois). Identique à la fonction SQL schedule_advance.
 */
export function advanceSchedule(iso: string, months: number, dayOfMonth: number): string {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7)) - 1 + months
  const year = y + Math.floor(m / 12)
  const mon = ((m % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate()
  return `${year}-${pad(mon + 1)}-${pad(Math.min(dayOfMonth, lastDay))}`
}

/** Opération prévue, issue d'une échéance */
export type ProjectedItem = {
  scheduleId: string
  account_id: string
  label: string
  amount: number
  /** Date utilisée pour la prévision (aujourd'hui si l'échéance est en retard) */
  date: string
  /** Date prévue par l'échéancier */
  dueDate: string
  overdue: boolean
}

/**
 * Toutes les occurrences des échéances jusqu'à `until` (inclus).
 * Les occurrences en retard (date passée, opération pas encore créée)
 * sont comptées aujourd'hui : elles n'ont pas encore touché le solde.
 */
export function projectSchedule(items: ScheduledTransaction[], today: string, until: string): ProjectedItem[] {
  const out: ProjectedItem[] = []
  if (until < today) return out
  for (const s of items) {
    let date = s.next_date
    // Garde-fou : 1 200 occurrences au plus par échéance
    for (let i = 0; date <= until && i < 1200; i++) {
      const overdue = date < today
      out.push({
        scheduleId: s.id,
        account_id: s.account_id,
        label: s.label,
        amount: s.amount,
        date: overdue ? today : date,
        dueDate: date,
        overdue,
      })
      date = advanceSchedule(date, s.frequency_months, s.day_of_month)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.dueDate.localeCompare(b.dueDate) || a.label.localeCompare(b.label))
}

/** Un point par jour : solde en fin de journée */
export type BalancePoint = {
  date: string
  /** Solde réel (opérations saisies) ; null après aujourd'hui */
  actual: number | null
  /** Solde prévisionnel (opérations saisies + échéancier) ; null avant aujourd'hui */
  forecast: number | null
}

/**
 * Construit la série jour par jour sur [from, to].
 * `balanceBeforeFrom` = solde à la fin de la veille de `from`.
 * `transactions` peut contenir des opérations hors période : elles sont ignorées.
 */
export function buildBalanceSeries(params: {
  from: string
  to: string
  today: string
  balanceBeforeFrom: number
  transactions: Pick<Transaction, 'date' | 'amount'>[]
  projected: Pick<ProjectedItem, 'date' | 'amount'>[]
}): BalancePoint[] {
  const { from, to, today } = params
  if (to < from) return []

  const real = new Map<string, number>()
  for (const t of params.transactions) {
    if (t.date < from || t.date > to) continue
    real.set(t.date, (real.get(t.date) ?? 0) + Math.round(t.amount * 100))
  }
  const planned = new Map<string, number>()
  let plan = 0 // cumul des échéances prévues
  for (const p of params.projected) {
    const cents = Math.round(p.amount * 100)
    // Période entièrement future : les échéances d'ici là comptent dès le départ
    if (p.date < from) plan += cents
    else if (p.date <= to) planned.set(p.date, (planned.get(p.date) ?? 0) + cents)
  }

  const points: BalancePoint[] = []
  let actual = Math.round(params.balanceBeforeFrom * 100)
  const n = daysBetween(from, to)
  for (let i = 0; i <= n; i++) {
    const date = addDays(from, i)
    actual += real.get(date) ?? 0
    plan += planned.get(date) ?? 0
    points.push({
      date,
      actual: date <= today ? actual / 100 : null,
      forecast: date >= today ? (actual + plan) / 100 : null,
    })
  }
  return points
}

/** Valeur affichée pour un point : le prévisionnel s'il existe, sinon le réel */
export function pointValue(p: BalancePoint): number {
  return p.forecast ?? p.actual ?? 0
}
