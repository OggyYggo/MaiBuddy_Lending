'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Loan = Database['public']['Tables']['loans']['Row'] & {
  borrowers: Database['public']['Tables']['borrowers']['Row']
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'interest' | 'aging' | 'cashflow'>('portfolio')
  const [loans, setLoans] = useState<Loan[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData()
    }
  }, [activeTab, startDate, endDate])

  const fetchReportData = async () => {
    setLoading(true)

    if (activeTab === 'portfolio') {
      const { data, error } = await supabase
        .from('loans')
        .select('*, borrowers(*)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching portfolio:', error)
      } else {
        setLoans(data || [])
      }
    } else if (activeTab === 'interest') {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*, loans(borrowers(*))')
        .eq('type', 'interest')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching interest data:', error)
      } else {
        setLoans(data || [])
      }
    } else if (activeTab === 'aging') {
      const { data, error } = await supabase
        .from('loans')
        .select('*, borrowers(*)')
        .eq('status', 'overdue')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching aging data:', error)
      } else {
        setLoans(data || [])
      }
    } else if (activeTab === 'cashflow') {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*, loans(borrowers(*))')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching cashflow data:', error)
      } else {
        setLoans(data || [])
      }
    }

    setLoading(false)
  }

  const exportToCSV = () => {
    let csv = ''
    let filename = ''

    if (activeTab === 'portfolio') {
      csv = 'Borrower,Principal,Term,Rate,Style,Status,Disbursed,Maturity\n'
      loans.forEach((loan: any) => {
        csv += `"${loan.borrowers?.full_name}","${loan.principal}","${loan.term_months}","${(loan.monthly_rate * 100).toFixed(2)}%","${loan.repayment_style}","${loan.status}","${loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : '-'}","${loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : '-'}"\n`
      })
      filename = 'portfolio-report.csv'
    } else if (activeTab === 'interest') {
      csv = 'Date,Borrower,Type,Amount,Balance After\n'
      loans.forEach((entry: any) => {
        csv += `"${new Date(entry.created_at).toLocaleDateString()}","${entry.loans?.borrowers?.full_name}","${entry.type}","${entry.amount}","${entry.balance_after}"\n`
      })
      filename = 'interest-report.csv'
    } else if (activeTab === 'aging') {
      csv = 'Borrower,Principal,Phone,Status,Maturity\n'
      loans.forEach((loan: any) => {
        csv += `"${loan.borrowers?.full_name}","${loan.principal}","${loan.borrowers?.phone}","${loan.status}","${loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : '-'}"\n`
      })
      filename = 'aging-report.csv'
    } else if (activeTab === 'cashflow') {
      csv = 'Date,Borrower,Type,Amount,Balance After\n'
      loans.forEach((entry: any) => {
        csv += `"${new Date(entry.created_at).toLocaleDateString()}","${entry.loans?.borrowers?.full_name}","${entry.type}","${entry.amount}","${entry.balance_after}"\n`
      })
      filename = 'cashflow-report.csv'
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_disbursement: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      paid: 'bg-blue-100 text-blue-800',
      written_off: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      {/* Date Range Filter */}
      {(activeTab === 'interest' || activeTab === 'cashflow') && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
          <div className="flex items-end space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={fetchReportData}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'portfolio'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Portfolio
            </button>
            <button
              onClick={() => setActiveTab('interest')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'interest'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Interest Earned
            </button>
            <button
              onClick={() => setActiveTab('aging')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'aging'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Aging
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cashflow'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Cash Flow
            </button>
          </nav>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 capitalize">
              {activeTab.replace('_', ' ')} Report
            </h2>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {activeTab === 'portfolio' && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Principal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Term
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Style
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Disbursed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Maturity
                      </th>
                    </tr>
                  )}
                  {(activeTab === 'interest' || activeTab === 'cashflow') && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Balance After
                      </th>
                    </tr>
                  )}
                  {activeTab === 'aging' && (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Borrower
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Principal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Maturity
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeTab === 'portfolio' &&
                    loans.map((loan: any) => (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {loan.borrowers?.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₱{loan.principal.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loan.term_months} months
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(loan.monthly_rate * 100).toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loan.repayment_style.replace('_', ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${getStatusColor(loan.status)}`}
                          >
                            {loan.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  {(activeTab === 'interest' || activeTab === 'cashflow') &&
                    loans.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {entry.loans?.borrowers?.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm capitalize text-gray-900">
                          {entry.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₱{entry.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₱{entry.balance_after.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  {activeTab === 'aging' &&
                    loans.map((loan: any) => (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {loan.borrowers?.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₱{loan.principal.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loan.borrowers?.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${getStatusColor(loan.status)}`}
                          >
                            {loan.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {loans.length === 0 && (
                <div className="text-center py-8 text-gray-500">No data found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
