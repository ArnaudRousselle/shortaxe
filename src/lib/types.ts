export type Account = {
  id: string
  name: string
  bank: string | null
  initial_balance: number
  is_archived: boolean
  position: number
  created_at: string
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
  /** Ligne de budget (enveloppe) : les opérations imputées en sont retirées */
  is_budget: boolean
  /** Ligne de budget sur laquelle l'opération est imputée */
  budget_id: string | null
  /** Dépassement d'une ligne de budget (même signe que le budget, 0 sinon) : le budget reste alors à 0 */
  budget_overrun: number
  created_at: string
  updated_at: string
}

export type TransactionInput = {
  id: string | null
  account_id: string
  date: string
  label: string
  amount: number
  notes: string | null
  is_checked: boolean
  is_budget: boolean
  budget_id: string | null
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
  /** Échéance « budget » : les opérations créées sont des lignes de budget */
  is_budget: boolean
  created_at: string
  updated_at: string
}

export type ScheduledTransactionInput = {
  id: string | null
  account_id: string
  label: string
  amount: number
  notes: string | null
  frequency_months: number
  next_date: string
  is_budget: boolean
}
