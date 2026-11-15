import { supabase } from './supabase'
import type {
  Account,
  AccountBalance,
  ScheduledTransaction,
  ScheduledTransactionInput,
  Transaction,
  TransactionInput,
} from './types'

const PAGE = 1000

// PostgREST renvoie parfois les numeric sous forme de chaîne : on normalise.
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v))

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

// ---------------------------------------------------------------- Accès

export async function isFamilyMember(): Promise<boolean> {
  const res = await supabase.rpc('is_family_member')
  return Boolean(check(res))
}

// ---------------------------------------------------------------- Comptes

export async function listAccounts(): Promise<Account[]> {
  const rows = check(
    await supabase.from('accounts').select('*').order('position').order('name'),
  ) as Account[]
  return rows.map((a) => ({ ...a, initial_balance: num(a.initial_balance) }))
}

export async function saveAccount(
  a: Pick<Account, 'name' | 'bank' | 'initial_balance' | 'is_archived' | 'position'> & { id?: string },
): Promise<void> {
  if (a.id) {
    const { id, ...rest } = a
    check(await supabase.from('accounts').update(rest).eq('id', id))
  } else {
    check(await supabase.from('accounts').insert(a))
  }
}

export async function deleteAccount(id: string): Promise<void> {
  check(await supabase.from('accounts').delete().eq('id', id))
}

export async function listBalances(): Promise<Record<string, AccountBalance>> {
  const rows = check(await supabase.from('account_balances').select('*')) as AccountBalance[]
  const map: Record<string, AccountBalance> = {}
  for (const r of rows) {
    map[r.account_id] = { ...r, balance: num(r.balance), checked_balance: num(r.checked_balance) }
  }
  return map
}

// ---------------------------------------------------------------- Opérations

export type TransactionFilter = {
  from?: string // inclus
  to?: string // exclu
  accountId?: string
  limit?: number
}

function normalizeTx(t: Transaction): Transaction {
  return {
    ...t,
    amount: num(t.amount),
    budget_overrun: num(t.budget_overrun),
  }
}

export async function listTransactions(f: TransactionFilter = {}): Promise<Transaction[]> {
  const limit = f.limit ?? 10000
  const out: Transaction[] = []
  // Supabase renvoie au plus 1000 lignes par requête : on pagine.
  for (let offset = 0; offset < limit; offset += PAGE) {
    let q = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
    if (f.from) q = q.gte('date', f.from)
    if (f.to) q = q.lt('date', f.to)
    if (f.accountId) q = q.eq('account_id', f.accountId)
    const size = Math.min(PAGE, limit - offset)
    const rows = check(await q.range(offset, offset + size - 1)) as Transaction[]
    out.push(...rows.map(normalizeTx))
    if (rows.length < size) break
  }
  return out
}

export async function saveTransaction(t: TransactionInput): Promise<string> {
  const res = await supabase.rpc('save_transaction', {
    p_id: t.id,
    p_account_id: t.account_id,
    p_date: t.date,
    p_label: t.label,
    p_amount: t.amount,
    p_notes: t.notes,
    p_is_checked: t.is_checked,
    p_is_budget: t.is_budget,
    p_budget_id: t.budget_id,
  })
  return check(res) as string
}

/** Une opération (pour retrouver la ligne de budget d'une opération imputée) */
export async function getTransaction(id: string): Promise<Transaction | null> {
  const row = check(
    await supabase.from('transactions').select('*').eq('id', id).maybeSingle(),
  ) as Transaction | null
  return row ? normalizeTx(row) : null
}

export async function setTransactionChecked(id: string, checked: boolean): Promise<void> {
  check(await supabase.from('transactions').update({ is_checked: checked }).eq('id', id))
}

export async function deleteTransaction(id: string): Promise<void> {
  check(await supabase.from('transactions').delete().eq('id', id))
}

/** Libellés récents, pour l'autocomplétion */
export async function recentLabels(): Promise<string[]> {
  const rows = check(
    await supabase.from('transactions').select('label').order('date', { ascending: false }).limit(300),
  ) as { label: string }[]
  return Array.from(new Set(rows.map((r) => r.label)))
}

// ---------------------------------------------------------------- Échéancier

export async function listScheduled(): Promise<ScheduledTransaction[]> {
  const rows = check(
    await supabase
      .from('scheduled_transactions')
      .select('*')
      .order('next_date')
      .order('label'),
  ) as ScheduledTransaction[]
  return rows.map((t) => ({ ...t, amount: num(t.amount) }))
}

export async function saveScheduled(t: ScheduledTransactionInput): Promise<string> {
  const res = await supabase.rpc('save_scheduled_transaction', {
    p_id: t.id,
    p_account_id: t.account_id,
    p_label: t.label,
    p_amount: t.amount,
    p_notes: t.notes,
    p_frequency_months: t.frequency_months,
    p_next_date: t.next_date,
    p_is_budget: t.is_budget,
  })
  return check(res) as string
}

export async function deleteScheduled(id: string): Promise<void> {
  check(await supabase.from('scheduled_transactions').delete().eq('id', id))
}

/** Crée les opérations des échéances choisies et décale leur prochaine date. Renvoie le nombre créé. */
export async function createTransactionsFromSchedule(ids: string[]): Promise<number> {
  const res = await supabase.rpc('create_transactions_from_schedule', { p_ids: ids })
  return Number(check(res))
}

/** Nombre d'échéances à créer (prochaine date avant le mois suivant) */
export async function countDueScheduled(before: string): Promise<number> {
  const res = await supabase
    .from('scheduled_transactions')
    .select('id', { count: 'exact', head: true })
    .lt('next_date', before)
  if (res.error) throw res.error
  return res.count ?? 0
}
