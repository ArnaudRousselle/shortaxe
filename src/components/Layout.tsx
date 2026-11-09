import { NavLink, Outlet } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from './Logo'
import { IconCalendar, IconChart, IconHome, IconList, IconLogout, IconSettings, IconTag, IconTarget, IconWallet } from './Icons'

type NavItem = { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }

const mainNav: NavItem[] = [
  { to: '/', label: 'Accueil', icon: IconHome },
  { to: '/operations', label: 'Opérations', icon: IconList },
  { to: '/echeancier', label: 'Échéancier', icon: IconCalendar },
  { to: '/budgets', label: 'Budgets', icon: IconTarget },
  { to: '/rapports', label: 'Rapports', icon: IconChart },
]

const secondaryNav: NavItem[] = [
  { to: '/comptes', label: 'Comptes', icon: IconWallet },
  { to: '/categories', label: 'Catégories', icon: IconTag },
  { to: '/reglages', label: 'Réglages', icon: IconSettings },
]

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <Icon />
      {item.label}
    </NavLink>
  )
}

export function Layout() {
  const { session, signOut } = useAuth()
  // Sur mobile, "Réglages" regroupe aussi Échéancier, Comptes et Catégories
  const bottomNav: NavItem[] = [
    ...mainNav.filter((i) => i.to !== '/echeancier'),
    { to: '/reglages', label: 'Réglages', icon: IconSettings },
  ]

  return (
    <div className="min-h-dvh md:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Logo />
          <span className="text-lg font-semibold">Shortaxe</span>
        </div>
        <nav className="space-y-1">
          {mainNav.map((i) => <SideLink key={i.to} item={i} />)}
        </nav>
        <div className="my-4 border-t border-slate-200" />
        <nav className="space-y-1">
          {secondaryNav.map((i) => <SideLink key={i.to} item={i} />)}
        </nav>
        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="truncate px-3 text-xs text-slate-500">{session?.user.email}</p>
          <button className="btn-ghost mt-1 w-full justify-start" onClick={() => void signOut()}>
            <IconLogout /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <Logo className="h-7 w-7" />
          <span className="font-semibold">Shortaxe</span>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Barre de navigation (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {bottomNav.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
