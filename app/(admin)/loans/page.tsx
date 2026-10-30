'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Loan = Database['public']['Tables']['loans']['Row'] & {
  borrowers: Database['public']['Tables']['borrowers']['Row']
  outstandingBalance: number
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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    setCurrentPage(1)
    fetchLoans()
  }, [statusFilter])

  useEffect(() => {
    fetchLoans()
  }, [currentPage])

  const fetchLoans = async () => {
    setLoading(true)
    const from = (currentPage - 1) * itemsPerPage
    const to = from + itemsPerPage - 1

    let query = supabase
      .from('loans')
      .select('*, borrowers(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching loans:', error)
    } else {
      const fetchedLoans = data || []
      const loanIds = fetchedLoans.map((loan) => loan.id)
      const principalPaidByLoan = new Map<string, number>()

      if (loanIds.length > 0) {
        const { data: ledgerEntries, error: ledgerError } = await supabase
          .from('ledger_entries')
          .select('loan_id, amount, type')
          .in('loan_id', loanIds)

        if (ledgerError) {
          console.error('Error fetching loan ledger balances:', ledgerError)
        } else {
          for (const entry of ledgerEntries || []) {
            if (entry.type === 'principal') {
              principalPaidByLoan.set(
                entry.loan_id,
                (principalPaidByLoan.get(entry.loan_id) || 0) + Number(entry.amount),
              )
            }
          }
        }
      }

      setLoans(fetchedLoans.map((loan) => ({
        ...loan,
        outstandingBalance: Math.max(
          0,
          Number(loan.principal) - (principalPaidByLoan.get(loan.id) || 0),
        ),
      })))
      setTotalCount(count || 0)
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

  const totalLoanAmount = loans.reduce((total, loan) => total + Number(loan.principal || 0), 0)
  const totalOutstandingBalance = loans.reduce(
    (total, loan) => total + Number(loan.outstandingBalance ?? loan.principal ?? 0),
    0,
  )
  const activeLoans = loans.filter(loan => loan.status === 'active').length
  const overdueLoans = loans.filter(loan => loan.status === 'overdue').length
  const formatCurrency = (amount: number) => `\u20B1${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.72 2.13-1.71 0-2.69-4.52-2.32-4.52-5.52 0-1.76 1.36-3.12 3.17-3.43V3.99h2.67v1.93c1.38.34 2.76 1.4 2.84 3.17h-1.92c-.09-.83-.93-1.63-2.15-1.63-1.1 0-1.84.58-1.84 1.47 0 2.68 4.52 2.27 4.52 5.53 0 1.95-1.54 3.34-3.45 3.63z"/>
            </svg>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Total Loan Amount</p>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '...' : formatCurrency(totalLoanAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {loans.length} {loans.length === 1 ? 'loan' : 'loans'} total
            </p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.72 2.13-1.71 0-2.69-4.52-2.32-4.52-5.52 0-1.76 1.36-3.12 3.17-3.43V3.99h2.67v1.93c1.38.34 2.76 1.4 2.84 3.17h-1.92c-.09-.83-.93-1.63-2.15-1.63-1.1 0-1.84.58-1.84 1.47 0 2.68 4.52 2.27 4.52 5.53 0 1.95-1.54 3.34-3.45 3.63z"/>
            </svg>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Outstanding Balance</p>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '...' : formatCurrency(totalOutstandingBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Latest ledger balances</p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.72 2.13-1.71 0-2.69-4.52-2.32-4.52-5.52 0-1.76 1.36-3.12 3.17-3.43V3.99h2.67v1.93c1.38.34 2.76 1.4 2.84 3.17h-1.92c-.09-.83-.93-1.63-2.15-1.63-1.1 0-1.84.58-1.84 1.47 0 2.68 4.52 2.27 4.52 5.53 0 1.95-1.54 3.34-3.45 3.63z"/>
            </svg>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Active Loans</p>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '...' : activeLoans}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {loans.length > 0 ? `${((activeLoans / loans.length) * 100).toFixed(0)}% of total` : 'No loans'}
            </p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.72 2.13-1.71 0-2.69-4.52-2.32-4.52-5.52 0-1.76 1.36-3.12 3.17-3.43V3.99h2.67v1.93c1.38.34 2.76 1.4 2.84 3.17h-1.92c-.09-.83-.93-1.63-2.15-1.63-1.1 0-1.84.58-1.84 1.47 0 2.68 4.52 2.27 4.52 5.53 0 1.95-1.54 3.34-3.45 3.63z"/>
            </svg>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <svg className="h-5 w-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">Overdue Loans</p>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '...' : overdueLoans}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {loans.length > 0 ? `${((overdueLoans / loans.length) * 100).toFixed(0)}% of total` : 'No loans'}
            </p>
          </div>
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
        <>
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <table className="w-full min-w-[900px] divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Amount
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding Balance
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Term
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Type
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
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {'₱'}{(Number(loan.outstandingBalance ?? loan.principal) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        {totalCount > itemsPerPage && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100 sm:px-6">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                Page {currentPage} of {Math.ceil(totalCount / itemsPerPage)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount / itemsPerPage)))}
                disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}
