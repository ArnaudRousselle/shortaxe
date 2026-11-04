import { useEffect, type ReactNode } from 'react'
import { addMonths, formatMonth, formatSignedEuro, formatEuro } from '../lib/format'
import { IconChevronLeft, IconChevronRight, IconX } from './Icons'

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-slate-500">Chargement…</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card p-8 text-center text-sm text-slate-500">{children}</div>
}

export function Amount({ value, signed = true, className = '' }: { value: number; signed?: boolean; className?: string }) {
  const color = value > 0 ? 'text-emerald-700' : value < 0 ? 'text-slate-900' : 'text-slate-500'
  return (
    <span className={`tabular-nums whitespace-nowrap ${color} ${className}`}>
      {signed ? formatSignedEuro(value) : formatEuro(value)}
    </span>
  )
}

export function CategoryDot({ color, className = 'h-2.5 w-2.5' }: { color: string; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
      <button className="btn-ghost rounded-r-none" onClick={() => onChange(addMonths(month, -1))} aria-label="Mois précédent">
        <IconChevronLeft />
      </button>
      <span className="min-w-36 text-center text-sm font-medium">{formatMonth(month)}</span>
      <button className="btn-ghost rounded-l-none" onClick={() => onChange(addMonths(month, 1))} aria-label="Mois suivant">
        <IconChevronRight />
      </button>
    </div>
  )
}

export function YearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
      <button className="btn-ghost rounded-r-none" onClick={() => onChange(year - 1)} aria-label="Année précédente">
        <IconChevronLeft />
      </button>
      <span className="min-w-20 text-center text-sm font-medium">{year}</span>
      <button className="btn-ghost rounded-l-none" onClick={() => onChange(year + 1)} aria-label="Année suivante">
        <IconChevronRight />
      </button>
    </div>
  )
}

/** Barre de consommation du budget */
export function BudgetBar({ spent, budget, color }: { spent: number; budget: number; color?: string }) {
  const ratio = budget > 0 ? spent / budget : spent > 0 ? 1.01 : 0
  const pct = Math.max(0, Math.min(100, ratio * 100))
  const over = ratio > 1
  const warn = !over && ratio > 0.85
  const fill = over ? '#dc2626' : warn ? '#d97706' : (color ?? '#0d9488')
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: fill }} />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Fermer">
            <IconX />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
