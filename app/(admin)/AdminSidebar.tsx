'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Banknote,
  Calculator,
  ClipboardList,
  FileBarChart,
  FileClock,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  WalletCards,
  X,
} from 'lucide-react'

const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Borrowers', href: '/borrowers', icon: Users },
  { label: 'Applications', href: '/applications', icon: ClipboardList },
  { label: 'Loans', href: '/loans', icon: Banknote },
  { label: 'Payments', href: '/payments', icon: WalletCards },
  { label: 'Collections', href: '/collections', icon: Activity },
  { label: 'Reports', href: '/reports', icon: FileBarChart },
  { label: 'Calculator', href: '/calculator', icon: Calculator },
  { label: 'Audit Log', href: '/audit-log', icon: FileClock },
]

export default function AdminSidebar({ profile }: { profile: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const items = profile.role === 'admin'
    ? [...navigation, { label: 'Settings', href: '/settings', icon: Settings }]
    : navigation

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 md:hidden"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-100 bg-white text-slate-700 shadow-sm transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm shadow-indigo-200">
            M
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-800">MaiBuddy</p>
            <p className="text-xs font-medium text-slate-400">Lending workspace</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Workspace
          </p>
          <div className="space-y-1">
            {items.map(({ label, href, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600" />}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{profile.full_name}</p>
              <p className="truncate text-xs capitalize text-slate-500">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post" className="mt-2">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
