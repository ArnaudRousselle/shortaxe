export type Account = {
  id: string
  name: string
  bank: string | null
  initial_balance: number
  is_archived: boolean
  position: number
  created_at: string
}

/** Part d'une opération rattachée à une ligne de budget (même signe que l'opération) */
export type BudgetAllocation = {
  budget_id: string
  amount: number
  /** Ligne de budget (numéro et libellé), jointe à la lecture */
  budget?: { ref: number; label: string } | null
}

export type Transaction = {
  id: string
  /** Numéro court unique, attribué par la base (« #12 ») */
  ref: number
  /** Aucun compte pour une ligne de budget */
  account_id: string | null
  date: string // YYYY-MM-DD
  label: string
  /** Négatif = dépense, positif = recette */
  amount: number
  notes: string | null
  is_checked: boolean
  /** Ligne de budget (enveloppe) : les parts des opérations rattachées en sont retirées */
  is_budget: boolean
  /** Dépassement d'une ligne de budget (même signe que le budget, 0 sinon) : le budget reste alors à 0 */
  budget_overrun: number
  created_at: string
  updated_at: string
  /** Répartition de l'opération sur des lignes de budget */
  transaction_budget_allocations: BudgetAllocation[]
}

/** Ligne de budget proposée dans le formulaire de répartition */
export type BudgetLine = Pick<Transaction, 'id' | 'ref' | 'label' | 'date' | 'amount' | 'budget_overrun'>

/** Opération rattachée à une ligne de budget, avec la part imputée sur ce budget */
export type BudgetChild = {
  /** Part imputée sur le budget (même signe que l'opération) */
  amount: number
  transaction: Pick<Transaction, 'id' | 'ref' | 'account_id' | 'date' | 'label' | 'amount' | 'is_checked'>
}

export type TransactionInput = {
  id: string | null
  account_id: string | null
  date: string
  label: string
  amount: number
  notes: string | null
  is_checked: boolean
  is_budget: boolean
  allocations: { budget_id: string; amount: number }[]
}

export type AccountBalance = {
  account_id: string
  balance: number
  checked_balance: number
}

/** Échéance : modèle d'opération qui se répète tous les N mois */
export type ScheduledTransaction = {
  id: string
  /** Aucun compte pour une échéance « budget » */
  account_id: string | null
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
  account_id: string | null
  label: string
  amount: number
  notes: string | null
  frequency_months: number
  next_date: string
  is_budget: boolean
}
