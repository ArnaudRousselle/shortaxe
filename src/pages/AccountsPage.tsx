import { useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteAccount, listBalances, saveAccount } from '../lib/api'
import { centsToInput, formatEuro, parseEuroToCents, toCents } from '../lib/format'
import { errorMessage } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Account } from '../lib/types'
import { Amount, EmptyState, ErrorBanner, Loading, Modal, PageHeader } from '../components/ui'
import { IconPlus } from '../components/Icons'

const BANKS = ['Fortuneo', 'Crédit Agricole', 'BforBank', 'Boursorama', 'BNP Paribas', 'Société Générale', 'LCL', 'Caisse d’Épargne', 'Banque Populaire', 'Crédit Mutuel', 'La Banque Postale', 'Revolut']

type Draft = { id?: string; name: string; bank: string; initial: string; is_archived: boolean; position: number }

export function AccountsPage() {
  const { accounts, loading, error, reload } = useData()
  const balances = useAsync(listBalances, [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openNew() {
    setFormError(null)
    setDraft({ name: '', bank: '', initial: '0,00', is_archived: false, position: accounts.length })
  }
  function openEdit(a: Account) {
    setFormError(null)
    setDraft({
      id: a.id,
      name: a.name,
      bank: a.bank ?? '',
      initial: centsToInput(toCents(a.initial_balance)),
      is_archived: a.is_archived,
      position: a.position,
    })
  }

  async function onSave() {
    if (!draft) return
    const cents = parseEuroToCents(draft.initial)
    if (!draft.name.trim()) return setFormError('Le nom est obligatoire.')
    if (cents === null) return setFormError('Le solde initial est invalide.')
    setBusy(true)
    try {
      await saveAccount({
        id: draft.id,
        name: draft.name.trim(),
        bank: draft.bank.trim() || null,
        initial_balance: cents / 100,
        is_archived: draft.is_archived,
        position: draft.position,
      })
      setDraft(null)
      await Promise.all([reload(), balances.reload()])
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!draft?.id) return
    if (!confirm(`Supprimer le compte « ${draft.name} » ?`)) return
    setBusy(true)
    try {
      await deleteAccount(draft.id)
      setDraft(null)
      await reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const active = accounts.filter((a) => !a.is_archived)
  const archived = accounts.filter((a) => a.is_archived)
  const total = active.reduce((s, a) => s + (balances.data?.[a.id]?.balance ?? 0), 0)

  const row = (a: Account) => {
    const b = balances.data?.[a.id]
    return (
      <li key={a.id}>
        <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => openEdit(a)}>
          <div className="min-w-0">
            <p className="truncate font-medium">{a.name}</p>
            <p className="truncate text-sm text-slate-500">{a.bank || '—'}</p>
          </div>
          <div className="text-right">
            <Amount value={b?.balance ?? 0} signed={false} className="font-semibold" />
            {b && b.checked_balance !== b.balance && (
              <p className="text-xs text-slate-500">Pointé : {formatEuro(b.checked_balance)}</p>
            )}
          </div>
        </button>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        title="Comptes"
        actions={
          <button className="btn-primary" onClick={openNew}>
            <IconPlus /> Nouveau compte
          </button>
        }
      />
      <ErrorBanner message={error || balances.error} />
      {loading ? (
        <Loading />
      ) : accounts.length === 0 ? (
        <EmptyState>Aucun compte pour l’instant. Commence par créer tes comptes bancaires.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <ul className="divide-y divide-slate-100">{active.map(row)}</ul>
            <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
              <span>Total</span>
              <Amount value={total} signed={false} />
            </div>
          </div>
          {archived.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-500">Comptes archivés</h2>
              <div className="card overflow-hidden opacity-75">
                <ul className="divide-y divide-slate-100">{archived.map(row)}</ul>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Modifier le compte' : 'Nouveau compte'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id && (
              <button className="btn-danger mr-auto" onClick={onDelete} disabled={busy}>Supprimer</button>
            )}
            <button className="btn-secondary" onClick={() => setDraft(null)}>Annuler</button>
            <button className="btn-primary" onClick={onSave} disabled={busy}>Enregistrer</button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="acc-name">Nom du compte</label>
              <input id="acc-name" className="input" placeholder="Compte joint" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="acc-bank">Banque</label>
              <input id="acc-bank" className="input" list="banks" value={draft.bank} onChange={(e) => setDraft({ ...draft, bank: e.target.value })} />
              <datalist id="banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
            </div>
            <div>
              <label className="label" htmlFor="acc-initial">Solde initial (€)</label>
              <input id="acc-initial" className="input" inputMode="decimal" value={draft.initial} onChange={(e) => setDraft({ ...draft, initial: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Le solde du compte avant la première opération saisie (peut être négatif).</p>
            </div>
            <div>
              <label className="label" htmlFor="acc-pos">Ordre d’affichage</label>
              <input id="acc-pos" type="number" className="input" value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={draft.is_archived} onChange={(e) => setDraft({ ...draft, is_archived: e.target.checked })} />
              Compte archivé (clôturé)
            </label>
            <ErrorBanner message={formError} />
          </div>
        )}
      </Modal>
    </>
  )
}
