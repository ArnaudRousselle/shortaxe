export type Account = {
  id: string
  name: string
  bank: string | null
  initial_balance: number
  is_archived: boolean
  position: number
  created_at: string
}

export type Category = {
  id: string
  name: string
  color: string
  is_archived: boolean
  created_at: string
}

export type Split = {
  id?: string
  transaction_id?: string
  category_id: string
  /** Même signe que l'opération */
  amount: number
}

export type Transaction = {
  id: string
  account_id: string
  date: string // YYYY-MM-DD
  label: string
  /** Négatif = dépense, positif = recette */
  amount: number
  notes: string | null
  is_checked: boolean
  created_at: string
  updated_at: string
  transaction_splits: Split[]
}

export type TransactionInput = {
  id: string | null
  account_id: string
  date: string
  label: string
  amount: number
  notes: string | null
  is_checked: boolean
  splits: { category_id: string; amount: number }[]
}

export type Budget = {
  id: string
  category_id: string
  month: string // YYYY-MM-01
  amount: number
}

export type CategoryMonthlyTotal = {
  month: string
  category_id: string
  total: number
}

export type AccountBalance = {
  account_id: string
  balance: number
  checked_balance: number
}

/** Échéance : modèle d'opération qui se répète tous les N mois */
export type ScheduledTransaction = {
  id: string
  account_id: string
  label: string
  /** Négatif = dépense, positif = recette */
  amount: number
  notes: string | null
  /** 1 = tous les mois, 12 = tous les ans */
  frequency_months: number
  /** Date de la prochaine opération à créer (YYYY-MM-DD) */
  next_date: string
  day_of_month: number
  created_at: string
  updated_at: string
  scheduled_transaction_splits: Split[]
}

export type ScheduledTransactionInput = {
  id: string | null
  account_id: string
  label: string
  amount: number
  notes: string | null
  frequency_months: number
  next_date: string
  splits: { category_id: string; amount: number }[]
}
