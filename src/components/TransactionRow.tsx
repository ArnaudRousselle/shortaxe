import { useData } from '../data/DataProvider'
import { formatEuro } from '../lib/format'
import type { Transaction } from '../lib/types'
import { Amount, BudgetBadge } from './ui'
import { IconCheck, IconPlus } from './Icons'

export function TransactionRow({
  transaction: t,
  onClick,
  onToggleChecked,
  onAddToBudget,
  showDate,
}: {
  transaction: Transaction
  onClick: () => void
  onToggleChecked?: () => void
  /** Ligne de budget : bouton « + » pour saisir une opération rattachée à ce budget */
  onAddToBudget?: () => void
  showDate?: boolean
}) {
  const muted = t.is_budget
  const { accountById } = useData()
  const account = t.account_id ? accountById[t.account_id] : undefined
  const allocs = t.transaction_budget_allocations
  // Montant de chaque part affiché sauf si une seule part couvre toute l'opération
  const showAllocAmounts = allocs.length > 1 || (allocs.length === 1 && allocs[0].amount !== t.amount)

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 sm:px-4 ${muted ? 'text-slate-400' : ''}`}>
      {onToggleChecked && muted && <span className="h-6 w-6 shrink-0" aria-hidden="true" />}
      {onToggleChecked && !muted && (
        <button
          onClick={onToggleChecked}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            t.is_checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-transparent hover:border-slate-400'
          }`}
          aria-label={t.is_checked ? 'Dépointer' : 'Pointer'}
          title={t.is_checked ? 'Pointée' : 'Non pointée'}
        >
          <IconCheck className="h-4 w-4" />
        </button>
      )}
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {t.label}
            {muted && <BudgetBadge />}
          </p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${muted ? 'text-slate-400' : 'text-slate-500'}`}>
            {showDate && <span>{t.date.split('-').reverse().join('/')}</span>}
            {t.account_id && <span className="truncate">{account?.name ?? '?'}</span>}
            {allocs.map((a) => (
              <span key={a.budget_id} className="inline-flex max-w-full items-center gap-1 text-slate-400" title="Rattachée à une ligne de budget">
                <span className="truncate">↳ {a.budget?.label ?? 'Budget'}</span>
                {showAllocAmounts && <span className="shrink-0 tabular-nums">{formatEuro(Math.abs(a.amount))}</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Amount value={t.amount} muted={muted} className="font-semibold" />
          {muted && t.budget_overrun !== 0 && (
            <p className="text-xs font-medium text-red-600 tabular-nums">Dépassé de {formatEuro(Math.abs(t.budget_overrun))}</p>
          )}
        </div>
      </button>
      {onAddToBudget && (
        <button
          onClick={onAddToBudget}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700"
          aria-label={`Ajouter une opération au budget ${t.label}`}
          title="Ajouter une opération à ce budget"
        >
          <IconPlus className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}
