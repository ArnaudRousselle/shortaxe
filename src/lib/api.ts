import { supabase } from './supabase'
import type {
  Account,
  AccountBalance,
  Budget,
  Category,
  CategoryMonthlyTotal,
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

// ---------------------------------------------------------------- Catégories

export async function listCategories(): Promise<Category[]> {
  return check(await supabase.from('categories').select('*').order('name')) as Category[]
}

export async function saveCategory(
  c: Pick<Category, 'name' | 'color' | 'is_archived'> & { id?: string },
): Promise<void> {
  if (c.id) {
    const { id, ...rest } = c
    check(await supabase.from('categories').update(rest).eq('id', id))
  } else {
    check(await supabase.from('categories').insert(c))
  }
}

export async function deleteCategory(id: string): Promise<void> {
  check(await supabase.from('categories').delete().eq('id', id))
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
    transaction_splits: (t.transaction_splits ?? []).map((s) => ({ ...s, amount: num(s.amount) })),
  }
}

export async function listTransactions(f: TransactionFilter = {}): Promise<Transaction[]> {
  const limit = f.limit ?? 10000
  const out: Transaction[] = []
  // Supabase renvoie au plus 1000 lignes par requête : on pagine.
  for (let offset = 0; offset < limit; offset += PAGE) {
    let q = supabase
      .from('transactions')
      .select('*, transaction_splits(*)')
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
    p_splits: t.splits,
  })
  return check(res) as string
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
      .select('*, scheduled_transaction_splits(*)')
      .order('next_date')
      .order('label'),
  ) as ScheduledTransaction[]
  return rows.map((t) => ({
    ...t,
    amount: num(t.amount),
    scheduled_transaction_splits: (t.scheduled_transaction_splits ?? []).map((s) => ({ ...s, amount: num(s.amount) })),
  }))
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
    p_splits: t.splits,
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

// ---------------------------------------------------------------- Budgets

export async function listBudgets(from: string, to: string): Promise<Budget[]> {
  const rows = check(
    await supabase.from('budgets').select('*').gte('month', from).lt('month', to),
  ) as Budget[]
  return rows.map((b) => ({ ...b, amount: num(b.amount) }))
}

/** Enregistre les budgets d'un ou plusieurs mois. amount = null supprime le budget. */
export async function upsertBudgets(
  rows: { category_id: string; month: string; amount: number | null }[],
): Promise<void> {
  const toUpsert = rows.filter((r) => r.amount !== null) as { category_id: string; month: string; amount: number }[]
  const toDelete = rows.filter((r) => r.amount === null)
  if (toUpsert.length) {
    check(await supabase.from('budgets').upsert(toUpsert, { onConflict: 'category_id,month' }))
  }
  for (const r of toDelete) {
    check(await supabase.from('budgets').delete().eq('category_id', r.category_id).eq('month', r.month))
  }
}

export async function getCategoryTotals(from: string, to: string): Promise<CategoryMonthlyTotal[]> {
  const rows = check(
    await supabase.from('category_monthly_totals').select('*').gte('month', from).lt('month', to),
  ) as CategoryMonthlyTotal[]
  return rows.map((r) => ({ ...r, total: num(r.total) }))
}

// ---------------------------------------------------------------- Export

async function fetchAll(table: string): Promise<unknown[]> {
  const out: unknown[] = []
  for (let offset = 0; ; offset += PAGE) {
    const rows = check(
      await supabase.from(table).select('*').order('id').range(offset, offset + PAGE - 1),
    ) as unknown[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export async function exportAll(): Promise<object> {
  const [
    accounts,
    categories,
    transactions,
    transaction_splits,
    budgets,
    scheduled_transactions,
    scheduled_transaction_splits,
  ] = await Promise.all([
    fetchAll('accounts'),
    fetchAll('categories'),
    fetchAll('transactions'),
    fetchAll('transaction_splits'),
    fetchAll('budgets'),
    fetchAll('scheduled_transactions'),
    fetchAll('scheduled_transaction_splits'),
  ])
  return {
    app: 'shortaxe',
    format_version: 2,
    exported_at: new Date().toISOString(),
    counts: {
      accounts: accounts.length,
      categories: categories.length,
      transactions: transactions.length,
      transaction_splits: transaction_splits.length,
      budgets: budgets.length,
      scheduled_transactions: scheduled_transactions.length,
      scheduled_transaction_splits: scheduled_transaction_splits.length,
    },
    data: {
      accounts,
      categories,
      transactions,
      transaction_splits,
      budgets,
      scheduled_transactions,
      scheduled_transaction_splits,
    },
  }
}
