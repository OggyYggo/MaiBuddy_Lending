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
    <div className="flex h-screen bg-[#f6f8fc] text-slate-800">
      <AdminSidebar profile={profile} />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="z-20 mt-14 border-b border-slate-100 bg-white px-5 py-4 md:mt-0 md:px-8">
          <div className="flex min-h-10 items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">MaiBuddy Lending</p>
              <h2 className="text-sm font-semibold text-slate-700">Admin workspace</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-700">{profile.full_name}</p>
                <p className="text-xs capitalize text-slate-400">{profile.role.replace('_', ' ')}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-7 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
