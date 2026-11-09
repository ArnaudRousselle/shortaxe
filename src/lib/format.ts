// ---------- Montants ----------

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export function formatEuro(value: number): string {
  return euro.format(value)
}

export function formatSignedEuro(value: number): string {
  const s = euro.format(Math.abs(value))
  if (value > 0) return `+${s}`
  if (value < 0) return `−${s}`
  return s
}

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

/** "1 234,56" / "1234.5" / "12" → centimes ; null si invalide */
export function parseEuroToCents(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, '').replace(',', '.')
  if (cleaned === '' || !/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** centimes → "12,50" pour pré-remplir un champ */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

// ---------- Dates (chaînes YYYY-MM-DD, sans fuseau) ----------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "2026-11-17" → "2026-11-01" */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function currentMonth(): string {
  return monthStart(todayISO())
}

/** Ajoute n mois à un mois "YYYY-MM-01" */
export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + n
  const year = y + Math.floor(m / 12)
  const mon = ((m % 12) + 12) % 12
  return `${year}-${pad(mon + 1)}-01`
}

export function yearStart(year: number): string {
  return `${year}-01-01`
}

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}-01`)
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatMonth(month: string): string {
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(parseISO(month)),
  )
}

export function formatMonthShort(month: string): string {
  return capitalize(new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(parseISO(month)).replace('.', ''))
}

export function formatDay(iso: string): string {
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(iso)),
  )
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseISO(iso))
}
