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
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [savingLoan, setSavingLoan] = useState(false)
  const [editValues, setEditValues] = useState({
    principal: '',
    monthly_rate: '',
    term_months: '',
    repayment_style: 'EQUAL_PRINCIPAL' as 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM',
  })
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

  const startEditing = (loan: Loan) => {
    setEditingLoan(loan)
    setEditValues({
      principal: String(loan.principal),
      monthly_rate: String(loan.monthly_rate),
      term_months: String(loan.term_months),
      repayment_style: loan.repayment_style,
    })
  }

  const saveLoanEdits = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingLoan) return

    setSavingLoan(true)
    const { error } = await supabase.rpc('update_pending_loan', {
      p_loan_id: editingLoan.id,
      p_principal: Number(editValues.principal),
      p_monthly_rate: Number(editValues.monthly_rate),
      p_term_months: Number(editValues.term_months),
      p_repayment_style: editValues.repayment_style,
    })

    if (error) {
      console.error('Error updating pending loan:', error)
      alert(`Could not update loan: ${error.message}. Confirm the safe loan actions migration has been applied.`)
    } else {
      setEditingLoan(null)
      await fetchLoans()
    }
    setSavingLoan(false)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">Loans</h1>
          <p className="mt-1 text-sm text-slate-500">View loan balances, terms, and repayment status.</p>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:w-auto"
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

      {editingLoan && (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Edit pending loan</h2>
              <p className="mt-1 text-sm text-slate-500">The repayment schedule will be recalculated when you save.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingLoan(null)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={saveLoanEdits} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-slate-600">
              Principal amount
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={editValues.principal}
                onChange={(event) => setEditValues({ ...editValues, principal: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Monthly rate (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={Number(editValues.monthly_rate) * 100}
                onChange={(event) => setEditValues({ ...editValues, monthly_rate: String(Number(event.target.value) / 100) })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Term (months)
              <input
                type="number"
                min="1"
                max="120"
                step="1"
                required
                value={editValues.term_months}
                onChange={(event) => setEditValues({ ...editValues, term_months: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Repayment style
              <select
                value={editValues.repayment_style}
                onChange={(event) => setEditValues({ ...editValues, repayment_style: event.target.value as typeof editValues.repayment_style })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="EQUAL_PRINCIPAL">Installment</option>
                <option value="EQUAL_PAYMENT">Equal payment (legacy)</option>
                <option value="LUMP_SUM">Lump Sum</option>
              </select>
            </label>
            <div className="flex gap-3 sm:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={savingLoan}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingLoan ? 'Saving…' : 'Save loan changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingLoan(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <table className="w-full min-w-[900px] divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
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
              <tbody className="divide-y divide-slate-100 bg-white">
                {loans.map((loan) => (
                  <tr key={loan.id} className="transition-colors hover:bg-slate-50/70">
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
                        className="mr-3 text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </a>
                      {loan.status === 'pending_disbursement' && !loan.disbursed_at && (
                        <button
                          type="button"
                          onClick={() => startEditing(loan)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                      )}
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
