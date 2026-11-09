import { useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteTransaction, recentLabels, saveTransaction } from '../lib/api'
import { centsToInput, parseEuroToCents, todayISO, toCents } from '../lib/format'
import { computeSplits, type SplitRow } from '../lib/splits'
import { errorMessage } from '../lib/supabase'
import type { Transaction } from '../lib/types'
import { ErrorBanner, Modal, Segmented } from './ui'
import { newSplitKey, SplitEditor } from './SplitEditor'

type Kind = 'depense' | 'recette'
type Row = SplitRow

export function TransactionModal({
  open,
  transaction,
  defaultAccountId,
  onClose,
  onSaved,
}: {
  open: boolean
  transaction: Transaction | null
  defaultAccountId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const { accounts, categories } = useData()
  const activeAccounts = accounts.filter((a) => !a.is_archived || a.id === transaction?.account_id)
  const usedCategoryIds = new Set(transaction?.transaction_splits.map((s) => s.category_id) ?? [])
  const selectableCategories = categories.filter((c) => !c.is_archived || usedCategoryIds.has(c.id))

  const [kind, setKind] = useState<Kind>('depense')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isChecked, setIsChecked] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialisation à l'ouverture
  useEffect(() => {
    if (!open) return
    setError(null)
    if (transaction) {
      const total = Math.abs(toCents(transaction.amount))
      setKind(transaction.amount < 0 ? 'depense' : 'recette')
      setAccountId(transaction.account_id)
      setDate(transaction.date)
      setLabel(transaction.label)
      setAmount(centsToInput(total))
      setNotes(transaction.notes ?? '')
      setIsChecked(transaction.is_checked)
      setRows(
        transaction.transaction_splits.map((s) => ({
          key: newSplitKey(),
          categoryId: s.category_id,
          value: centsToInput(Math.abs(toCents(s.amount))),
        })),
      )
    } else {
      setKind('depense')
      setAccountId(defaultAccountId || activeAccounts[0]?.id || '')
      setDate(todayISO())
      setLabel('')
      setAmount('')
      setNotes('')
      setIsChecked(false)
      setRows([{ key: newSplitKey(), categoryId: '', value: '' }])
    }
    recentLabels().then(setLabels).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  const totalCents = parseEuroToCents(amount)
  const result = useMemo(() => computeSplits(totalCents ?? 0, rows), [totalCents, rows])

  async function onSubmit() {
    setError(null)
    if (!accountId) return setError('Choisis un compte.')
    if (!label.trim()) return setError('Le libellé est obligatoire.')
    if (!date) return setError('La date est obligatoire.')
    if (totalCents === null || totalCents <= 0) return setError('Le montant doit être un nombre positif.')
    if (result.error) return setError(result.error)
    const sign = kind === 'depense' ? -1 : 1
    setBusy(true)
    try {
      await saveTransaction({
        id: transaction?.id ?? null,
        account_id: accountId,
        date,
        label: label.trim(),
        amount: (sign * totalCents) / 100,
        notes: notes.trim() || null,
        is_checked: isChecked,
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
    if (!transaction) return
    if (!confirm(`Supprimer l’opération « ${transaction.label} » ?`)) return
    setBusy(true)
    try {
      await deleteTransaction(transaction.id)
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
      title={transaction ? 'Modifier l’opération' : 'Nouvelle opération'}
      onClose={onClose}
      footer={
        <>
          {transaction && (
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
            <label className="label" htmlFor="tx-amount">Montant (€)</label>
            <input
              id="tx-amount"
              className="input text-lg font-semibold tabular-nums"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus={!transaction}
            />
          </div>
          <div>
            <label className="label" htmlFor="tx-date">Date</label>
            <input id="tx-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="tx-label">Libellé</label>
          <input id="tx-label" className="input" list="tx-labels" placeholder="Intermarché" value={label} onChange={(e) => setLabel(e.target.value)} />
          <datalist id="tx-labels">{labels.map((l) => <option key={l} value={l} />)}</datalist>
        </div>

        <div>
          <label className="label" htmlFor="tx-account">Compte</label>
          <select id="tx-account" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {activeAccounts.length === 0 && <option value="">Crée d’abord un compte</option>}
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.bank ? ` — ${a.bank}` : ''}
              </option>
            ))}
          </select>
        </div>

        <SplitEditor
          rows={rows}
          setRows={setRows}
          totalCents={totalCents}
          result={result}
          categories={selectableCategories}
        />

        <div>
          <label className="label" htmlFor="tx-notes">Note (facultatif)</label>
          <textarea id="tx-notes" rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
          Opération pointée (visible sur le relevé bancaire)
        </label>

        <ErrorBanner message={error} />
      </div>
    </Modal>
  )
}
