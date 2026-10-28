'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Loan = Database['public']['Tables']['loans']['Row'] & {
  borrowers: Database['public']['Tables']['borrowers']['Row']
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchLoans()
  }, [statusFilter])

  const fetchLoans = async () => {
    setLoading(true)
    let query = supabase
      .from('loans')
      .select('*, borrowers(full_name)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching loans:', error)
    } else {
      setLoans(data || [])
    }
    setLoading(false)
  }

  const statusColors: Record<string, string> = {
    pending_disbursement: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    paid: 'bg-blue-100 text-blue-800',
    written_off: 'bg-gray-100 text-gray-800',
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Loans</h1>
        <div className="flex space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
          >
            <option value="all">All Status</option>
            <option value="pending_disbursement">Pending Disbursement</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="written_off">Written Off</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <table className="w-full min-w-[900px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Term
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Style
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Disbursed
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(loan as any).borrowers?.full_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ₱{loan.principal.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900">{loan.term_months} months</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900">
                        {loan.repayment_style.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${statusColors[loan.status]}`}
                      >
                        {loan.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900">
                        {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={`/loans/${loan.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loans.length === 0 && (
            <div className="text-center py-8 text-gray-500">No loans found</div>
          )}
        </div>
      )}
    </div>
  )
}
