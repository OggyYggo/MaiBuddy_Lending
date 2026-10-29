'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Payment = Database['public']['Tables']['payments']['Row'] & {
  loans: Database['public']['Tables']['loans']['Row'] & {
    borrowers: Database['public']['Tables']['borrowers']['Row']
  }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actingOnPaymentId, setActingOnPaymentId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    loan_id: '',
    amount: '',
    payment_type: 'principal' as 'principal' | 'interest' | 'penalty',
    method: 'cash' as 'cash' | 'bank' | 'e_wallet' | 'check',
    reference: '',
    received_at: new Date().toISOString().split('T')[0],
  })

  const [loans, setLoans] = useState<any[]>([])

  useEffect(() => {
    fetchPayments()
    fetchLoans()
  }, [statusFilter])

  const fetchPayments = async () => {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select('*, loans(borrowers(full_name))')
      .order('received_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching payments:', error)
    } else {
      setPayments(data || [])
    }
    setLoading(false)
  }

  const fetchLoans = async () => {
    const { data, error } = await supabase
      .from('loans')
      .select('id, principal, borrowers(full_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching loans:', error)
    } else {
      setLoans(data || [])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(formData.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({ type: 'error', message: 'Enter a valid payment amount greater than zero.' })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        loan_id: formData.loan_id,
        amount,
        payment_type: formData.payment_type,
        method: formData.method,
        reference: formData.reference || null,
        received_at: new Date(formData.received_at).toISOString(),
        recorded_by: user?.id,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating payment:', error)
      setNotice({ type: 'error', message: 'Failed to create payment.' })
    } else {
      // Auto-confirm for now (in production, use maker-checker)
      const { error: recordError } = await supabase.rpc('record_payment', {
        p_payment_id: payment.id,
        p_loan_id: formData.loan_id,
        p_amount: amount,
        p_received_at: new Date(formData.received_at).toISOString(),
      })

      if (recordError) {
        const errorMessage = formatSupabaseError(recordError)
        console.error(`Error posting payment to the loan ledger: ${errorMessage}`)
        setNotice({ type: 'error', message: `Payment saved as pending, but not posted: ${errorMessage}` })
        fetchPayments()
        return
      }

      setShowForm(false)
      setNotice({ type: 'success', message: `${formData.payment_type} payment recorded successfully.` })
      setFormData({
        loan_id: '',
        amount: '',
        payment_type: 'principal',
        method: 'cash',
        reference: '',
        received_at: new Date().toISOString().split('T')[0],
      })
      fetchPayments()
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const formatSupabaseError = (error: {
    message?: string
    code?: string
    details?: string
    hint?: string
  }) => [
    error.message || String(error),
    error.code && `code: ${error.code}`,
    error.details && `details: ${error.details}`,
    error.hint && `hint: ${error.hint}`,
  ].filter(Boolean).join(' | ')

  const voidPendingPayment = async (payment: Payment) => {
    const reason = window.prompt('Enter a reason for voiding this pending payment:')
    if (!reason?.trim()) return
    if (!window.confirm('Void this pending payment? It will be marked rejected and recorded in the audit log.')) return

    setActingOnPaymentId(payment.id)
    const { error } = await supabase.rpc('void_pending_payment', {
      p_payment_id: payment.id,
      p_reason: reason.trim(),
    })
    if (error) {
      console.error('Error voiding pending payment:', error)
      setNotice({ type: 'error', message: `Could not void payment: ${error.message}` })
    } else {
      setNotice({ type: 'success', message: 'Payment voided successfully.' })
      await fetchPayments()
    }
    setActingOnPaymentId(null)
  }

  const postPendingPayment = async (payment: Payment) => {
    setActingOnPaymentId(payment.id)
    const { error } = await supabase.rpc('record_payment', {
      p_payment_id: payment.id,
      p_loan_id: payment.loan_id,
      p_amount: payment.amount,
      p_received_at: payment.received_at,
    })

    if (error) {
      const errorMessage = formatSupabaseError(error)
      console.error(`Error posting pending payment: ${errorMessage}`)
      setNotice({ type: 'error', message: `Could not post payment: ${errorMessage}` })
    } else {
      setNotice({ type: 'success', message: `${payment.payment_type} payment posted to the loan ledger.` })
      await fetchPayments()
    }
    setActingOnPaymentId(null)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Record incoming payments and review their status.</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:w-auto"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 md:text-base"
          >
            Record Payment
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 mb-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">Record New Payment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan *
                </label>
                <select
                  required
                  value={formData.loan_id}
                  onChange={(e) => setFormData({ ...formData, loan_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a loan</option>
                  {loans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {(loan as any).borrowers?.full_name} - ₱{loan.principal.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₱) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={formData.amount ? `₱${Number(formData.amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}` : ''}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Type *
                </label>
                <select
                  required
                  value={formData.payment_type}
                  onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="principal">Principal</option>
                  <option value="interest">Interest</option>
                  <option value="penalty">Penalty</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method *
                </label>
                <select
                  required
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="e_wallet">E-Wallet</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Received Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.received_at}
                  onChange={(e) => setFormData({ ...formData, received_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Record Payment
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {notice && <div role="alert" className={`fixed right-5 top-5 z-50 max-w-md rounded-2xl border px-5 py-4 shadow-xl ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{notice.type === 'success' ? 'Success' : 'Something went wrong'}</p><p className="mt-1 text-sm">{notice.message}</p></div><button type="button" aria-label="Dismiss alert" onClick={() => setNotice(null)} className="font-bold">×</button></div></div>}

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
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Type
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Method
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Reference
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(payment as any).loans?.borrowers?.full_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900 capitalize">
                        {(payment as any).payment_type || 'principal'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ₱{payment.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900 capitalize">
                        {payment.method.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900">{payment.reference || '-'}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(payment.received_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${statusColors[payment.status]}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={`/loans/${payment.loan_id}`}
                        className="mr-3 text-indigo-600 hover:text-indigo-800"
                      >
                        View loan
                      </a>
                      {payment.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={actingOnPaymentId === payment.id}
                            onClick={() => postPendingPayment(payment)}
                            className="mr-3 text-green-600 hover:text-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actingOnPaymentId === payment.id ? 'Processing…' : 'Post'}
                          </button>
                          <button
                            type="button"
                            disabled={actingOnPaymentId === payment.id}
                            onClick={() => voidPendingPayment(payment)}
                            className="text-rose-600 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actingOnPaymentId === payment.id ? 'Processing…' : 'Void'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {payments.length === 0 && (
            <div className="text-center py-8 text-gray-500">No payments found</div>
          )}
        </div>
      )}
    </div>
  )
}
