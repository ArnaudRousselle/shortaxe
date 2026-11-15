import { useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteTransaction, listBudgets, recentLabels, saveTransaction } from '../lib/api'
import { computeAllocations, recentBudgetChoices, type AllocationRow } from '../lib/allocations'
import { centsToInput, formatEuro, parseEuroToCents, todayISO, toCents } from '../lib/format'
import { errorMessage } from '../lib/supabase'
import type { BudgetLine, Transaction } from '../lib/types'
import { ErrorBanner, Modal, Segmented } from './ui'
import { AllocationEditor, newAllocationKey } from './AllocationEditor'

type Kind = 'depense' | 'recette'

export function TransactionModal({
  open,
  transaction,
  prefillBudget,
  defaultAccountId,
  onClose,
  onSaved,
}: {
  open: boolean
  transaction: Transaction | null
  /** Nouvelle opération : ligne de budget pré-remplie dans la répartition (bouton « + ») */
  prefillBudget?: Transaction | null
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
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [budgets, setBudgets] = useState<BudgetLine[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialisation à l'ouverture
  useEffect(() => {
    if (!open) return
    setError(null)
    if (transaction) {
      const total = Math.abs(toCents(transaction.amount))
      const allocs = transaction.transaction_budget_allocations
      setKind(transaction.amount < 0 ? 'depense' : 'recette')
      setAccountId(transaction.account_id ?? defaultAccountId ?? activeAccounts[0]?.id ?? '')
      setDate(transaction.date)
      setLabel(transaction.label)
      setAmount(centsToInput(total))
      setNotes(transaction.notes ?? '')
      setIsChecked(transaction.is_checked)
      setIsBudget(transaction.is_budget)
      setRows(
        allocs.map((a) => {
          const cents = Math.abs(toCents(a.amount))
          // Part unique égale au montant : laissée vide, elle suit le montant
          return { key: newAllocationKey(), budgetId: a.budget_id, value: allocs.length === 1 && cents === total ? '' : centsToInput(cents) }
        }),
      )
    } else {
      setKind(prefillBudget && prefillBudget.amount > 0 ? 'recette' : 'depense')
      setAccountId(defaultAccountId || activeAccounts[0]?.id || '')
      setDate(todayISO())
      setLabel('')
      setAmount('')
      setNotes('')
      setIsChecked(false)
      setIsBudget(false)
      setRows(prefillBudget ? [{ key: newAllocationKey(), budgetId: prefillBudget.id, value: '' }] : [])
    }
    listBudgets().then(setBudgets).catch(() => undefined)
    recentLabels().then(setLabels).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction, prefillBudget])

  const totalCents = parseEuroToCents(amount)
  const result = useMemo(() => computeAllocations(totalCents ?? 0, rows), [totalCents, rows])
  // Une ligne de budget ne peut pas être répartie sur elle-même
  // Liste limitée aux 10 plus récentes (plus celles déjà choisies)
  const selectableBudgets = useMemo(
    () =>
      recentBudgetChoices(
        budgets.filter((b) => b.id !== transaction?.id),
        rows.map((r) => r.budgetId),
      ),
    [budgets, transaction, rows],
  )

  function onBudgetChange(checked: boolean) {
    if (checked && rows.length > 0 && !confirm('Une ligne de budget ne peut pas être rattachée à un autre budget : la répartition sera retirée. Continuer ?')) return
    setIsBudget(checked)
    if (checked) setRows([])
  }

  async function onSubmit() {
    setError(null)
    if (!isBudget && !accountId) return setError('Choisis un compte.')
    if (!label.trim()) return setError('Le libellé est obligatoire.')
    if (!date) return setError('La date est obligatoire.')
    if (totalCents === null || totalCents <= 0) return setError('Le montant doit être un nombre positif.')
    if (!isBudget && result.error) return setError(result.error)
    const sign = kind === 'depense' ? -1 : 1
    setBusy(true)
    try {
      await saveTransaction({
        id: transaction?.id ?? null,
        account_id: isBudget ? null : accountId,
        date,
        label: label.trim(),
        amount: (sign * totalCents) / 100,
        notes: notes.trim() || null,
        is_checked: isBudget ? false : isChecked,
        is_budget: isBudget,
        allocations: isBudget ? [] : result.allocations.map((a) => ({ budget_id: a.budgetId, amount: (sign * a.cents) / 100 })),
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
    const detail =
      transaction.transaction_budget_allocations.length > 0
        ? '\n\nSes montants seront rendus aux budgets.'
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
      title={transaction ? (transaction.is_budget ? 'Modifier la ligne de budget' : 'Modifier l’opération') : 'Nouvelle opération'}
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
            <label className="label" htmlFor="tx-amount">{isBudget ? 'Reste du budget (€)' : 'Montant (€)'}</label>
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
          <input id="tx-label" className="input" list="tx-labels" placeholder={isBudget ? 'Courses' : 'Intermarché'} value={label} onChange={(e) => setLabel(e.target.value)} />
          <datalist id="tx-labels">{labels.map((l) => <option key={l} value={l} />)}</datalist>
        </div>

        {!isBudget && (
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
        )}

        {!isBudget && (
          <AllocationEditor rows={rows} setRows={setRows} totalCents={totalCents} result={result} budgets={selectableBudgets} />
        )}

        <div>
          <label className="label" htmlFor="tx-notes">Note (facultatif)</label>
          <textarea id="tx-notes" rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {!isBudget && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
            Opération pointée (visible sur le relevé bancaire)
          </label>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={isBudget} onChange={(e) => onBudgetChange(e.target.checked)} />
          <span>
            Ligne de budget
            <span className="block text-xs text-slate-500">
              Enveloppe sans compte : les opérations rattachées à ce budget en sont déduites. Le bouton « + » de la ligne
              pré-remplit une opération sur ce budget.
            </span>
          </span>
        </label>

        <ErrorBanner message={error} />
      </div>
    </Modal>
  )
}
