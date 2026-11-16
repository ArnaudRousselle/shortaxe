import { useData } from '../data/DataProvider'
import { formatEuro, formatRef } from '../lib/format'
import type { Transaction } from '../lib/types'
import { Amount, BudgetBadge } from './ui'
import { IconCheck, IconEye, IconPlus } from './Icons'

export function TransactionRow({
  transaction: t,
  onClick,
  onToggleChecked,
  onAddToBudget,
  onShowBudgetChildren,
  showDate,
}: {
  transaction: Transaction
  onClick: () => void
  onToggleChecked?: () => void
  /** Ligne de budget : bouton « + » pour saisir une opération rattachée à ce budget */
  onAddToBudget?: () => void
  /** Ligne de budget : bouton « œil » pour voir les opérations rattachées */
  onShowBudgetChildren?: () => void
  showDate?: boolean
}) {
  const isBudget = t.is_budget
  const { accountById } = useData()
  const account = t.account_id ? accountById[t.account_id] : undefined
  const allocs = t.transaction_budget_allocations
  // Montant de chaque part affiché sauf si une seule part couvre toute l'opération
  const showAllocAmounts = allocs.length > 1 || (allocs.length === 1 && allocs[0].amount !== t.amount)

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${isBudget ? 'bg-slate-100 hover:bg-slate-200/60' : 'hover:bg-slate-50'}`}>
      {onToggleChecked && isBudget && <span className="h-6 w-6 shrink-0" aria-hidden="true" />}
      {onToggleChecked && !isBudget && (
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
            {isBudget && <span className="mr-1.5 text-slate-500 tabular-nums">{formatRef(t.ref)}</span>}
            {t.label}
            {isBudget && <BudgetBadge />}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {showDate && <span>{t.date.split('-').reverse().join('/')}</span>}
            {t.account_id && <span className="truncate">{account?.name ?? '?'}</span>}
            {allocs.map((a) => (
              <span key={a.budget_id} className="inline-flex max-w-full items-center gap-1 text-slate-400" title="Rattachée à une ligne de budget">
                <span className="truncate">↳ {a.budget ? `${formatRef(a.budget.ref)} ${a.budget.label}` : 'Budget'}</span>
                {showAllocAmounts && <span className="shrink-0 tabular-nums">{formatEuro(Math.abs(a.amount))}</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Amount value={t.amount} className="font-semibold" />
          {isBudget && t.budget_overrun !== 0 && (
            <p className="text-xs font-medium text-red-600 tabular-nums">Dépassé de {formatEuro(Math.abs(t.budget_overrun))}</p>
          )}
        </div>
      </button>
      {onShowBudgetChildren && (
        <button
          onClick={onShowBudgetChildren}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700"
          aria-label={`Voir les opérations du budget ${t.label}`}
          title="Voir les opérations rattachées à ce budget"
        >
          <IconEye className="h-4 w-4" />
        </button>
      )}
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
