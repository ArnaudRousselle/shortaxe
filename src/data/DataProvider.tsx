import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { listAccounts, listCategories } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import type { Account, Category } from '../lib/types'

/** Données de référence partagées par tous les écrans : comptes et catégories. */
type DataState = {
  accounts: Account[]
  categories: Category[]
  accountById: Record<string, Account>
  categoryById: Record<string, Category>
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const load = useCallback(async () => {
    const [accounts, categories] = await Promise.all([listAccounts(), listCategories()])
    return { accounts, categories }
  }, [])
  const { data, loading, error, reload } = useAsync(load, [load])

  const value = useMemo<DataState>(() => {
    const accounts = data?.accounts ?? []
    const categories = data?.categories ?? []
    return {
      accounts,
      categories,
      accountById: Object.fromEntries(accounts.map((a) => [a.id, a])),
      categoryById: Object.fromEntries(categories.map((c) => [c.id, c])),
      loading,
      error,
      reload,
    }
  }, [data, loading, error, reload])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>')
  return ctx
}
