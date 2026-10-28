import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from './AdminSidebar'

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
    redirect('/login?error=account_not_active')
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      <AdminSidebar profile={profile} />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 mt-12 md:mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Mai Lending Admin</h2>
          </div>
        </header>

        {/* Main content area */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
