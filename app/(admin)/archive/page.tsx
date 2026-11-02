'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Borrower = Database['public']['Tables']['borrowers']['Row']
type ArchivedApplication = {
  id: string
  borrower_id: string
  amount: number
  status: string
  created_at: string
  archived_at: string | null
  borrowers: { full_name: string; archived_at: string | null } | null
}

export default function ArchivePage() {
  const [records, setRecords] = useState<Borrower[]>([])
  const [applications, setApplications] = useState<ArchivedApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchArchivedRecords = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sign in with an active super-admin account to view archived records.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()
    const authorized = profile?.role === 'super_admin' && profile.status === 'active'
    setIsSuperAdmin(authorized)
    if (!authorized) {
      setError('Only an active super admin can view or restore archived records.')
      setLoading(false)
      return
    }

    const { data, error: queryError } = await supabase
      .from('borrowers')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    if (queryError) {
      setError(queryError.message)
      setRecords([])
    } else {
      setError('')
      setRecords(data || [])
    }

    const { data: archivedApplications, error: applicationError } = await supabase
      .from('applications')
      .select('id, borrower_id, amount, status, created_at, archived_at, borrowers!applications_borrower_id_fkey(full_name, archived_at)')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    if (applicationError) {
      setError(applicationError.message)
      setApplications([])
    } else {
      setApplications(((archivedApplications || []) as unknown as ArchivedApplication[])
        .filter((application) => application.borrowers?.archived_at === null))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchArchivedRecords()
  }, [fetchArchivedRecords])

  const handleRestore = async (borrower: Borrower) => {
    if (!confirm(`Restore ${borrower.full_name} and their archived applications to the regular work lists?`)) return
    const { error: restoreError } = await supabase.rpc('restore_borrower_records', { p_borrower_id: borrower.id })
    if (restoreError) {
      alert(`Could not restore records: ${restoreError.message}`)
      return
    }
    await fetchArchivedRecords()
  }

  const handleRestoreApplication = async (application: ArchivedApplication) => {
    if (!confirm(`Restore this ${application.status.replace('_', ' ')} application to the regular application list?`)) return
    const { error: restoreError } = await supabase.rpc('restore_application_record', { p_application_id: application.id })
    if (restoreError) {
      alert(`Could not restore application: ${restoreError.message}`)
      return
    }
    await fetchArchivedRecords()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Archive History</h1>
        <p className="mt-1 text-sm text-slate-600">Archived borrower and application records are hidden from regular work lists. Loans and payment history stay available.</p>
      </div>

      {!isSuperAdmin && !loading && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
      )}
      {isSuperAdmin && error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load archive history: {error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Loading archived records…</div>
        ) : records.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No archived borrower records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Borrower</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Archived</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">{record.full_name}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{record.phone}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{record.archived_at ? new Date(record.archived_at).toLocaleString() : '—'}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRestore(record)}
                        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Archived Applications</h2>
          <p className="text-sm text-slate-600">Applications archived individually are listed here. Applications archived with a borrower appear with that borrower’s record above.</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading archived applications…</div>
          ) : applications.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No individually archived applications.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Borrower</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Archived</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td className="px-5 py-4 text-sm font-medium text-slate-900">{application.borrowers?.full_name || 'Unknown borrower'}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">₱{application.amount.toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm capitalize text-slate-600">{application.status.replace('_', ' ')}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{application.archived_at ? new Date(application.archived_at).toLocaleString() : '—'}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRestoreApplication(application)}
                          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
