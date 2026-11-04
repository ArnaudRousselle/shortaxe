import { useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteTransaction, recentLabels, saveTransaction } from '../lib/api'
import { centsToInput, formatEuro, parseEuroToCents, todayISO, toCents } from '../lib/format'
import { computeSplits, formatPct, type SplitMode, type SplitRow } from '../lib/splits'
import { errorMessage } from '../lib/supabase'
import type { Transaction } from '../lib/types'
import { CategoryDot, ErrorBanner, Modal, Segmented } from './ui'
import { IconPlus, IconTrash } from './Icons'

type Kind = 'depense' | 'recette'
type Mode = SplitMode
type Row = SplitRow

let nextKey = 1

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
  const { accounts, categories, categoryById } = useData()
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
  const [mode, setMode] = useState<Mode>('pct')
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
      setMode('eur')
      setRows(
        transaction.transaction_splits.map((s) => ({
          key: nextKey++,
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
      setMode('pct')
      setRows([{ key: nextKey++, categoryId: '', value: '100' }])
    }
    recentLabels().then(setLabels).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction])

  const totalCents = parseEuroToCents(amount)
  const result = useMemo(() => computeSplits(totalCents ?? 0, rows, mode), [totalCents, rows, mode])

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    const full = mode === 'pct' ? '100' : centsToInput(totalCents ?? 0)
    if (rows.length <= 1) {
      // Une seule ligne = 100 % du montant ; la nouvelle ligne reste à compléter
      setRows(
        rows.length === 0
          ? [{ key: nextKey++, categoryId: '', value: full }]
          : [...rows.map((r) => ({ ...r, value: '' })), { key: nextKey++, categoryId: '', value: '' }],
      )
      return
    }
    // Pré-remplit la nouvelle ligne avec ce qu'il reste à ventiler
    const value = result.remaining > 0 ? (mode === 'pct' ? formatPct(result.remaining) : centsToInput(result.remaining)) : ''
    setRows((rs) => [...rs, { key: nextKey++, categoryId: '', value }])
  }

  function switchMode(m: Mode) {
    if (m === mode) return
    // Convertit les valeurs saisies pour ne pas perdre la répartition
    const total = totalCents ?? 0
    if (rows.length > 1 && total > 0 && !result.error) {
      setRows(
        rows.map((r, i) => {
          const cents = result.splits[i].cents
          return { ...r, value: m === 'eur' ? centsToInput(cents) : formatPct((cents / total) * 100) }
        }),
      )
    } else {
      setRows(rows.map((r) => ({ ...r, value: '' })))
    }
    setMode(m)
  }

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

  const multi = rows.length > 1

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

        {/* Ventilation */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Catégories</span>
            {multi && (
              <Segmented<Mode>
                value={mode}
                onChange={switchMode}
                options={[
                  { value: 'pct', label: '%' },
                  { value: 'eur', label: '€' },
                ]}
              />
            )}
          </div>

          {rows.length === 0 && (
            <p className="mb-2 text-sm text-slate-500">Sans catégorie (par exemple un virement entre comptes).</p>
          )}

          <div className="space-y-2">
            {rows.map((r) => {
              const cat = categoryById[r.categoryId]
              return (
                <div key={r.key} className="flex items-center gap-2">
                  {cat && <CategoryDot color={cat.color} />}
                  <select
                    className="input min-w-0 flex-1"
                    value={r.categoryId}
                    onChange={(e) => updateRow(r.key, { categoryId: e.target.value })}
                    aria-label="Catégorie"
                  >
                    <option value="">Choisir…</option>
                    {selectableCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {multi && (
                    <div className="relative w-28 shrink-0">
                      <input
                        className="input pr-7 text-right tabular-nums"
                        inputMode="decimal"
                        value={r.value}
                        onChange={(e) => updateRow(r.key, { value: e.target.value })}
                        aria-label={mode === 'pct' ? 'Pourcentage' : 'Montant'}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">
                        {mode === 'pct' ? '%' : '€'}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    aria-label="Retirer la ligne"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-ghost text-brand-700" onClick={addRow}>
              <IconPlus className="h-4 w-4" /> {rows.length === 0 ? 'Ajouter une catégorie' : 'Répartir sur une autre catégorie'}
            </button>
            {multi && totalCents !== null && totalCents > 0 && result.remaining !== 0 && (
              <span className="text-sm text-amber-700">
                Reste : {mode === 'pct' ? `${formatPct(result.remaining)} %` : formatEuro(result.remaining / 100)}
              </span>
            )}
          </div>
          {multi && !result.error && totalCents !== null && totalCents > 0 && mode === 'pct' && (
            <p className="mt-2 text-xs text-slate-500">
              {result.splits.map((s) => `${categoryById[s.categoryId]?.name ?? '?'} : ${formatEuro(s.cents / 100)}`).join(' · ')}
            </p>
          )}
        </div>

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
