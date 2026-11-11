import { useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteScheduled, recentLabels, saveScheduled } from '../lib/api'
import { centsToInput, parseEuroToCents, todayISO, toCents } from '../lib/format'
import { computeSplits, type SplitRow } from '../lib/splits'
import { errorMessage } from '../lib/supabase'
import type { ScheduledTransaction } from '../lib/types'
import { ErrorBanner, Modal, Segmented } from './ui'
import { newSplitKey, SplitEditor } from './SplitEditor'

type Kind = 'depense' | 'recette'

const PRESETS = [
  { months: 1, label: 'Mensuel' },
  { months: 3, label: 'Trimestriel' },
  { months: 6, label: 'Semestriel' },
  { months: 12, label: 'Annuel' },
]

export function ScheduleModal({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean
  item: ScheduledTransaction | null
  onClose: () => void
  onSaved: () => void
}) {
  const { accounts, categories } = useData()
  const activeAccounts = accounts.filter((a) => !a.is_archived || a.id === item?.account_id)
  const usedCategoryIds = new Set(item?.scheduled_transaction_splits.map((s) => s.category_id) ?? [])
  const selectableCategories = categories.filter((c) => !c.is_archived || usedCategoryIds.has(c.id))

  const [kind, setKind] = useState<Kind>('depense')
  const [accountId, setAccountId] = useState('')
  const [nextDate, setNextDate] = useState(todayISO())
  const [frequency, setFrequency] = useState('1')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<SplitRow[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (item) {
      setKind(item.amount < 0 ? 'depense' : 'recette')
      setAccountId(item.account_id)
      setNextDate(item.next_date)
      setFrequency(String(item.frequency_months))
      setLabel(item.label)
      setAmount(centsToInput(Math.abs(toCents(item.amount))))
      setNotes(item.notes ?? '')
      setRows(
        item.scheduled_transaction_splits.map((s) => ({
          key: newSplitKey(),
          categoryId: s.category_id,
          value: centsToInput(Math.abs(toCents(s.amount))),
        })),
      )
    } else {
      setKind('depense')
      setAccountId(activeAccounts[0]?.id || '')
      setNextDate(todayISO())
      setFrequency('1')
      setLabel('')
      setAmount('')
      setNotes('')
      setRows([{ key: newSplitKey(), categoryId: '', value: '' }])
    }
    recentLabels().then(setLabels).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const totalCents = parseEuroToCents(amount)
  const result = useMemo(() => computeSplits(totalCents ?? 0, rows), [totalCents, rows])

  async function onSubmit() {
    setError(null)
    const freq = Number(frequency)
    if (!accountId) return setError('Choisis un compte.')
    if (!label.trim()) return setError('Le libellé est obligatoire.')
    if (!nextDate) return setError('La date de prochaine échéance est obligatoire.')
    if (!Number.isInteger(freq) || freq < 1 || freq > 120) return setError('La fréquence doit être un nombre entier de mois (de 1 à 120).')
    if (totalCents === null || totalCents <= 0) return setError('Le montant doit être un nombre positif.')
    if (result.error) return setError(result.error)
    const sign = kind === 'depense' ? -1 : 1
    setBusy(true)
    try {
      await saveScheduled({
        id: item?.id ?? null,
        account_id: accountId,
        label: label.trim(),
        amount: (sign * totalCents) / 100,
        notes: notes.trim() || null,
        frequency_months: freq,
        next_date: nextDate,
        splits: result.splits.map((s) => ({ category_id: s.categoryId, amount: (sign * s.cents) / 100 })),
      })
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!item) return
    if (!confirm(`Supprimer l’échéance « ${item.label} » ? Les opérations déjà créées sont conservées.`)) return
    setBusy(true)
    try {
      await deleteScheduled(item.id)
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={item ? 'Modifier l’échéance' : 'Nouvelle échéance'}
      onClose={onClose}
      footer={
        <>
          {item && (
            <button className="btn-danger mr-auto" onClick={onDelete} disabled={busy}>Supprimer</button>
          )}
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={onSubmit} disabled={busy}>Enregistrer</button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'depense', label: 'Dépense' },
            { value: 'recette', label: 'Recette' },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="st-amount">Montant (€)</label>
            <input
              id="st-amount"
              className="input text-lg font-semibold tabular-nums"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus={!item}
            />
          </div>
          <div>
            <label className="label" htmlFor="st-date">Prochaine échéance</label>
            <input id="st-date" type="date" className="input" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="st-label">Libellé</label>
          <input id="st-label" className="input" list="st-labels" placeholder="Loyer" value={label} onChange={(e) => setLabel(e.target.value)} />
          <datalist id="st-labels">{labels.map((l) => <option key={l} value={l} />)}</datalist>
        </div>

        <div>
          <label className="label" htmlFor="st-account">Compte</label>
          <select id="st-account" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {activeAccounts.length === 0 && <option value="">Crée d’abord un compte</option>}
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.bank ? ` — ${a.bank}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="st-frequency">Fréquence (se répète tous les … mois)</label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-28">
              <input
                id="st-frequency"
                type="number"
                min={1}
                max={120}
                step={1}
                inputMode="numeric"
                className="input pr-12 tabular-nums"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">mois</span>
            </div>
            {PRESETS.map((p) => (
              <button
                key={p.months}
                type="button"
                onClick={() => setFrequency(String(p.months))}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  frequency === String(p.months)
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <SplitEditor rows={rows} setRows={setRows} totalCents={totalCents} result={result} categories={selectableCategories} />

        <div>
          <label className="label" htmlFor="st-notes">Note (facultatif)</label>
          <textarea id="st-notes" rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <ErrorBanner message={error} />
      </div>
    </Modal>
  )
}
