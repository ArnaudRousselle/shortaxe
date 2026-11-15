import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { listAccounts } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import type { Account } from '../lib/types'

/** Données de référence partagées par tous les écrans : les comptes. */
type DataState = {
  accounts: Account[]
  accountById: Record<string, Account>
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useAsync(listAccounts, [])

  const value = useMemo<DataState>(() => {
    const accounts = data ?? []
    return {
      accounts,
      accountById: Object.fromEntries(accounts.map((a) => [a.id, a])),
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
