import { useCallback } from 'react'
import { useData } from '../data/DataProvider'
import { listBudgetChildren } from '../lib/api'
import { formatDateShort, formatEuro, formatRef, fromCents, toCents } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { Transaction } from '../lib/types'
import { Amount, EmptyState, ErrorBanner, Loading, Modal } from './ui'

/** Popup « œil » d'une ligne de budget : opérations qui lui sont rattachées. */
export function BudgetChildrenModal({ budget, onClose }: { budget: Transaction | null; onClose: () => void }) {
  const open = budget !== null
  return (
    <Modal open={open} title={budget ? `${formatRef(budget.ref)} - ${budget.label}` : ''} onClose={onClose}>
      {budget && <BudgetChildrenList budget={budget} />}
    </Modal>
  )
}

function BudgetChildrenList({ budget }: { budget: Transaction }) {
  const { accountById } = useData()
  const load = useCallback(() => listBudgetChildren(budget.id), [budget.id])
  const { data, loading, error } = useAsync(load, [load])

  // Total imputé sur le budget, en centimes
  const totalCents = (data ?? []).reduce((sum, c) => sum + toCents(c.amount), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-100 p-3">
          <p className="text-xs text-slate-500">Reste du budget</p>
          <Amount value={budget.amount} className="font-semibold" />
          {budget.budget_overrun !== 0 && (
            <p className="text-xs font-medium text-red-600 tabular-nums">Dépassé de {formatEuro(Math.abs(budget.budget_overrun))}</p>
          )}
        </div>
        <div className="rounded-lg bg-slate-100 p-3">
          <p className="text-xs text-slate-500">Déjà imputé</p>
          <Amount value={fromCents(totalCents)} className="font-semibold" />
        </div>
      </div>

      <ErrorBanner message={error} />

      {loading && !data ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <EmptyState>Aucune opération rattachée à ce budget.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {data.map(({ amount, transaction: t }) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.label}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span>{formatDateShort(t.date)}</span>
                  {t.account_id && <span className="truncate">{accountById[t.account_id]?.name ?? '?'}</span>}
                  {!t.is_checked && <span className="text-slate-400">Non pointée</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Amount value={amount} className="font-semibold" />
                {amount !== t.amount && (
                  <p className="text-xs text-slate-400 tabular-nums">sur {formatEuro(Math.abs(t.amount))}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
