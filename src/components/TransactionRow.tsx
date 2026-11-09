import { useData } from '../data/DataProvider'
import { formatEuro } from '../lib/format'
import type { Transaction } from '../lib/types'
import { Amount, CategoryDot } from './ui'
import { IconCheck } from './Icons'

export function TransactionRow({
  transaction: t,
  onClick,
  onToggleChecked,
  showDate,
}: {
  transaction: Transaction
  onClick: () => void
  onToggleChecked?: () => void
  showDate?: boolean
}) {
  const { accountById, categoryById } = useData()
  const account = accountById[t.account_id]

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 sm:px-4">
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
          <p className="truncate font-medium">{t.label}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {showDate && <span>{t.date.split('-').reverse().join('/')}</span>}
            <span className="truncate">{account?.name ?? '?'}</span>
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
        <Amount value={t.amount} className="font-semibold" />
      </button>
    </li>
  )
}
