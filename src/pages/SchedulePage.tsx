import { useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { createTransactionsFromSchedule, listScheduled } from '../lib/api'
import { formatDateShort, formatEuro, formatFrequency, isScheduleDue, todayISO } from '../lib/format'
import { round2 } from '../lib/report'
import { errorMessage } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { ScheduledTransaction } from '../lib/types'
import { Amount, CategoryDot, EmptyState, ErrorBanner, Loading, PageHeader } from '../components/ui'
import { ScheduleModal } from '../components/ScheduleModal'
import { IconCheck, IconPlus, IconRepeat } from '../components/Icons'

export function SchedulePage() {
  const { accountById, categoryById, accounts } = useData()
  const { data, loading, error, reload } = useAsync(listScheduled, [])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ScheduledTransaction | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const today = todayISO()
  const items = useMemo(() => data ?? [], [data])
  const due = useMemo(() => items.filter((i) => isScheduleDue(i.next_date, today)), [items, today])
  const dueTotal = round2(due.reduce((s, i) => s + i.amount, 0))
  const selectedItems = items.filter((i) => selected.has(i.id))
  const allSelected = items.length > 0 && selectedItems.length === items.length

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function selectDue() {
    setSelected(new Set(due.map((i) => i.id)))
  }

  async function onCreate() {
    if (selectedItems.length === 0) return
    const notDue = selectedItems.filter((i) => !isScheduleDue(i.next_date, today)).length
    const msg =
      `Créer ${selectedItems.length} opération${selectedItems.length > 1 ? 's' : ''} ?` +
      (notDue > 0 ? `\n\nAttention : ${notDue} échéance${notDue > 1 ? 's ne sont' : ' n’est'} pas prévue${notDue > 1 ? 's' : ''} ce mois-ci.` : '')
    if (!confirm(msg)) return
    setBusy(true)
    setActionError(null)
    setInfo(null)
    try {
      const n = await createTransactionsFromSchedule(selectedItems.map((i) => i.id))
      setInfo(`${n} opération${n > 1 ? 's créées' : ' créée'}. Les prochaines échéances ont été décalées.`)
      setSelected(new Set())
      await reload()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function onSaved() {
    setEditing(null)
    setCreating(false)
    void reload()
  }

  const createLabel = `Créer les opérations${selectedItems.length ? ` (${selectedItems.length})` : ''}`

  return (
    <>
      <PageHeader
        title="Échéancier"
        actions={
          <>
            <button className="btn-secondary hidden md:inline-flex" onClick={() => setCreating(true)} disabled={accounts.length === 0}>
              <IconPlus /> Nouvelle échéance
            </button>
            <button className="btn-primary hidden md:inline-flex" onClick={() => void onCreate()} disabled={busy || selectedItems.length === 0}>
              <IconCheck /> {createLabel}
            </button>
          </>
        }
      />

      {/* Résumé du mois */}
      {items.length > 0 && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
            due.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-sm">
            {due.length > 0 ? (
              <>
                <strong className="text-orange-800">
                  {due.length} échéance{due.length > 1 ? 's' : ''} à créer ce mois-ci
                </strong>
                <span className="text-slate-600"> — total {formatEuro(dueTotal)}</span>
              </>
            ) : (
              <span className="text-slate-600">Aucune échéance à créer ce mois-ci.</span>
            )}
          </p>
          {due.length > 0 && (
            <button className="btn-secondary py-1.5" onClick={selectDue}>
              Sélectionner les échéances du mois
            </button>
          )}
        </div>
      )}

      <ErrorBanner message={error || actionError} />
      {info && <p className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{info}</p>}

      {loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState>
          Aucune échéance. Ajoute les opérations qui reviennent régulièrement (loyer, salaire, abonnements, impôts…).
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:px-4">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selectedItems.length > 0 && !allSelected
              }}
              onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
              aria-label="Tout sélectionner"
            />
            <span className="flex-1">{items.length} échéance{items.length > 1 ? 's' : ''}</span>
            <span className="hidden sm:inline">Prochaine échéance</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {items.map((i) => {
              const isDue = isScheduleDue(i.next_date, today)
              const late = i.next_date < today.slice(0, 8) + '01'
              const account = accountById[i.account_id]
              const splits = i.scheduled_transaction_splits
              return (
                <li
                  key={i.id}
                  className={`flex items-center gap-3 border-l-4 px-3 py-2.5 sm:px-4 ${
                    isDue ? 'border-l-orange-500 bg-orange-50 hover:bg-orange-100' : 'border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                    aria-label={`Sélectionner ${i.label}`}
                  />
                  <button onClick={() => setEditing(i)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${isDue ? 'text-orange-900' : ''}`}>{i.label}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <IconRepeat className="h-3.5 w-3.5" />
                          {formatFrequency(i.frequency_months)}
                        </span>
                        <span className="truncate">{account?.name ?? '?'}</span>
                        {splits.length === 0 && <span className="text-amber-700">Sans catégorie</span>}
                        {splits.map((s) => {
                          const c = categoryById[s.category_id]
                          return (
                            <span key={s.id ?? s.category_id} className="inline-flex items-center gap-1">
                              <CategoryDot color={c?.color ?? '#94a3b8'} className="h-2 w-2" />
                              {c?.name ?? '?'}
                              {splits.length > 1 && <span className="text-slate-400 tabular-nums">{formatEuro(Math.abs(s.amount))}</span>}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Amount value={i.amount} className="font-semibold" />
                      <p className={`text-xs tabular-nums ${isDue ? 'font-semibold text-orange-700' : 'text-slate-500'}`}>
                        {formatDateShort(i.next_date)}
                        {late && ' · en retard'}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Mobile : barre d'action quand des lignes sont sélectionnées, sinon bouton flottant */}
      {selectedItems.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-slate-200 bg-white p-3 shadow-lg md:hidden">
          <button className="btn-secondary" onClick={() => setSelected(new Set())}>Annuler</button>
          <button className="btn-primary flex-1" onClick={() => void onCreate()} disabled={busy}>
            <IconCheck /> {createLabel}
          </button>
        </div>
      ) : (
        <button
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg md:hidden"
          onClick={() => setCreating(true)}
          aria-label="Nouvelle échéance"
        >
          <IconPlus className="h-7 w-7" />
        </button>
      )}

      <ScheduleModal
        open={creating || editing !== null}
        item={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={onSaved}
      />
    </>
  )
}
