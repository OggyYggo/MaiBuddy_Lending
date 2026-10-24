import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CurrentDate } from '@/components/admin/CurrentDate'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active') {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-xl font-bold">Mai Lending</h1>
          <p className="text-sm text-gray-400 mt-1">Admin Portal</p>
        </div>

        <nav className="mt-6">
          <div className="px-4 space-y-2">
            <a
              href="/dashboard"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Dashboard
            </a>
            <a
              href="/borrowers"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Borrowers
            </a>
            <a
              href="/applications"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Applications
            </a>
            <a
              href="/loans"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Loans
            </a>
            <a
              href="/payments"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Payments
            </a>
            <a
              href="/collections"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Collections
            </a>
            <a
              href="/reports"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Reports
            </a>
            <a
              href="/calculator"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Calculator
            </a>
            {profile.role === 'admin' && (
              <a
                href="/settings"
                className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
              >
                Settings
              </a>
            )}
            <a
              href="/audit-log"
              className="block px-4 py-2 rounded-md hover:bg-gray-800 transition"
            >
              Audit Log
            </a>
          </div>
        </nav>

        <div className="absolute bottom-0 w-64 p-4 bg-gray-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-gray-400 capitalize">{profile.role.replace('_', ' ')}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
