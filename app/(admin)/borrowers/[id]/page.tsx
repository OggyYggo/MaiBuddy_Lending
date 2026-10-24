'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Borrower = Database['public']['Tables']['borrowers']['Row']
type Loan = Database['public']['Tables']['loans']['Row']

export default function BorrowerDetailPage() {
  const params = useParams()
  const [borrower, setBorrower] = useState<Borrower | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchBorrower()
    fetchLoans()
  }, [params.id])

  const fetchBorrower = async () => {
    const { data, error } = await supabase
      .from('borrowers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching borrower:', error)
    } else {
      setBorrower(data)
    }
    setLoading(false)
  }

  const fetchLoans = async () => {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('borrower_id', params.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching loans:', error)
    } else {
      setLoans(data || [])
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!borrower) {
    return <div className="text-center py-8">Borrower not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <a
          href="/borrowers"
          className="text-indigo-600 hover:text-indigo-900 text-sm"
        >
          ← Back to Borrowers
        </a>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{borrower.full_name}</h1>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Birth Date</p>
            <p className="text-gray-900">{borrower.birth_date}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="text-gray-900">{borrower.phone}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Address</p>
            <p className="text-gray-900">{borrower.address}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Employer</p>
            <p className="text-gray-900">{borrower.employer || '-'}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Monthly Income</p>
            <p className="text-gray-900">
              {borrower.monthly_income ? `₱${borrower.monthly_income.toLocaleString()}` : '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">ID Type</p>
            <p className="text-gray-900">{borrower.id_type || '-'}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">ID Number</p>
            <p className="text-gray-900">{borrower.id_number || '-'}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Created At</p>
            <p className="text-gray-900">
              {new Date(borrower.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {borrower.notes && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-gray-900">{borrower.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Loan History</h2>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Principal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Term
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Disbursed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loans.map((loan) => (
              <tr key={loan.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    ₱{loan.principal.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{loan.term_months} months</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    loan.status === 'active' ? 'bg-green-100 text-green-800' :
                    loan.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                    loan.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {loan.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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

        {loans.length === 0 && (
          <div className="text-center py-8 text-gray-500">No loans found</div>
        )}
      </div>
    </div>
  )
}
