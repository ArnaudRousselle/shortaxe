import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { SetPasswordPage } from './auth/SetPasswordPage'
import { DataProvider } from './data/DataProvider'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { Logo } from './components/Logo'
import { isSupabaseConfigured } from './lib/supabase'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { ReportsPage } from './pages/ReportsPage'
import { AccountsPage } from './pages/AccountsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { SettingsPage } from './pages/SettingsPage'

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="card w-full max-w-md space-y-3 p-6 text-center">
        <Logo className="mx-auto h-12 w-12" />
        {children}
      </div>
    </div>
  )
}

function Gate() {
  const { session, loading, isMember, needsPassword, signOut } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <Centered>
        <h1 className="text-lg font-semibold">Configuration manquante</h1>
        <p className="text-sm text-slate-600">
          Les variables <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> ne sont pas définies.
          Voir le README.
        </p>
      </Centered>
    )
  }
  if (loading) return <Loading />
  if (!session) return <LoginPage />
  if (needsPassword) return <SetPasswordPage />
  if (isMember === null) return <Loading />
  if (!isMember) {
    return (
      <Centered>
        <h1 className="text-lg font-semibold">Accès non autorisé</h1>
        <p className="text-sm text-slate-600">
          L’adresse <strong>{session.user.email}</strong> ne fait pas partie des membres de la famille.
        </p>
        <button className="btn-secondary" onClick={() => void signOut()}>Se déconnecter</button>
      </Centered>
    )
  }

  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="operations" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="rapports" element={<ReportsPage />} />
          <Route path="comptes" element={<AccountsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
