import { useData } from '../data/DataProvider'
import { formatEuro } from '../lib/format'
import type { Transaction } from '../lib/types'
import { Amount, BudgetBadge, CategoryDot } from './ui'
import { IconCheck, IconPlus } from './Icons'

export function TransactionRow({
  transaction: t,
  onClick,
  onToggleChecked,
  onAddToBudget,
  budgetLabel,
  showDate,
}: {
  transaction: Transaction
  onClick: () => void
  onToggleChecked?: () => void
  /** Ligne de budget : bouton « + » pour saisir une opération imputée dessus */
  onAddToBudget?: () => void
  /** Libellé du budget sur lequel l'opération est imputée */
  budgetLabel?: string
  showDate?: boolean
}) {
  const muted = t.is_budget
  const { accountById, categoryById } = useData()
  const account = accountById[t.account_id]

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 sm:px-4 ${muted ? 'text-slate-400' : ''}`}>
      {onToggleChecked && (
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
            <span className="truncate">{account?.name ?? '?'}</span>
            {t.budget_id && (
              <span className="truncate text-slate-400" title="Opération imputée sur un budget">
                ↳ {budgetLabel ? `Budget ${budgetLabel}` : 'Budget'}
              </span>
            )}
            {t.transaction_splits.length === 0 && <span className="text-amber-700">Sans catégorie</span>}
            {t.transaction_splits.map((s) => {
              const c = categoryById[s.category_id]
              const multi = t.transaction_splits.length > 1
              return (
                <span key={s.id ?? s.category_id} className="inline-flex items-center gap-1">
                  <CategoryDot color={c?.color ?? '#94a3b8'} className="h-2 w-2" />
                  {c?.name ?? '?'}
                  {multi && <span className="text-slate-400 tabular-nums">{formatEuro(Math.abs(s.amount))}</span>}
                </span>
              )
            })}
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
