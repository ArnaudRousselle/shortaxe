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
