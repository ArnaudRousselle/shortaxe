import { useEffect, useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteTransaction, recentLabels, saveTransaction } from '../lib/api'
import { centsToInput, formatEuro, parseEuroToCents, todayISO, toCents } from '../lib/format'
import { errorMessage } from '../lib/supabase'
import type { Transaction } from '../lib/types'
import { ErrorBanner, Modal, Segmented } from './ui'

type Kind = 'depense' | 'recette'

export function TransactionModal({
  open,
  transaction,
  budget,
  defaultAccountId,
  onClose,
  onSaved,
}: {
  open: boolean
  transaction: Transaction | null
  /**
   * Ligne de budget : en création, la nouvelle opération y sera imputée ;
   * en modification, budget sur lequel l'opération est déjà imputée (affichage).
   */
  budget?: Transaction | null
  defaultAccountId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const { accounts } = useData()
  const activeAccounts = accounts.filter((a) => !a.is_archived || a.id === transaction?.account_id)

  const [kind, setKind] = useState<Kind>('depense')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isChecked, setIsChecked] = useState(false)
  const [isBudget, setIsBudget] = useState(false)
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
      setIsBudget(transaction.is_budget)
    } else {
      setKind(budget && budget.amount > 0 ? 'recette' : 'depense')
      setAccountId(budget?.account_id || defaultAccountId || activeAccounts[0]?.id || '')
      setDate(todayISO())
      setLabel('')
      setAmount('')
      setNotes('')
      setIsChecked(false)
      setIsBudget(false)
    }
    recentLabels().then(setLabels).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  // Opération imputée sur un budget (nouvelle ou existante)
  const budgetId = transaction ? transaction.budget_id : (budget?.id ?? null)
  const linkedBudget = budget && budget.id === budgetId ? budget : null

  const totalCents = parseEuroToCents(amount)

  async function onSubmit() {
    setError(null)
    if (!accountId) return setError('Choisis un compte.')
    if (!label.trim()) return setError('Le libellé est obligatoire.')
    if (!date) return setError('La date est obligatoire.')
    if (totalCents === null || totalCents <= 0) return setError('Le montant doit être un nombre positif.')
    if (
      transaction?.is_budget &&
      !isBudget &&
      !confirm('Cette ligne ne sera plus un budget : les opérations imputées dessus n’y seront plus rattachées. Continuer ?')
    )
      return
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
        is_budget: budgetId ? false : isBudget,
        budget_id: budgetId,
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
    const detail = transaction.budget_id
      ? '\n\nSon montant sera rendu au budget.'
      : transaction.is_budget
        ? '\n\nLes opérations imputées sur ce budget sont conservées.'
        : ''
    if (!confirm(`Supprimer l’opération « ${transaction.label} » ?${detail}`)) return
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
        {budgetId && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            {linkedBudget ? (
              <>
                Imputée sur le budget <strong>« {linkedBudget.label} »</strong> — reste {formatEuro(Math.abs(linkedBudget.amount))}
                {linkedBudget.budget_overrun !== 0 && (
                  <span className="font-medium text-red-600"> · dépassé de {formatEuro(Math.abs(linkedBudget.budget_overrun))}</span>
                )}
              </>
            ) : (
              'Opération imputée sur une ligne de budget.'
            )}
          </p>
        )}

        {transaction?.is_budget && transaction.budget_overrun !== 0 && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Budget dépassé de {formatEuro(Math.abs(transaction.budget_overrun))}. Si tu modifies le montant restant, le dépassement repart de zéro.
          </p>
        )}

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

        <div>
          <label className="label" htmlFor="tx-notes">Note (facultatif)</label>
          <textarea id="tx-notes" rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
          Opération pointée (visible sur le relevé bancaire)
        </label>

        {!budgetId && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={isBudget} onChange={(e) => setIsBudget(e.target.checked)} />
            <span>
              Budget
              <span className="block text-xs text-slate-500">
                Enveloppe : les opérations ajoutées avec le bouton « + » de la ligne en seront déduites.
              </span>
            </span>
          </label>
        )}

        <ErrorBanner message={error} />
      </div>
    </Modal>
  )
}
