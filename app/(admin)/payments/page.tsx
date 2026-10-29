'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'
import { Swal, showSweetAlert, showSweetToast } from '@/lib/sweet-alert'

type Payment = Database['public']['Tables']['payments']['Row'] & {
  loans: Database['public']['Tables']['loans']['Row'] & {
    borrowers: Database['public']['Tables']['borrowers']['Row']
  }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingOnPaymentId, setActingOnPaymentId] = useState<string | null>(null)
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
  const selectedLoan = loans.find((loan) => loan.id === formData.loan_id)
  const enteredAmount = Number(formData.amount)
  const projectedBalance = selectedLoan?.outstandingBalance != null
    && Number.isFinite(enteredAmount)
    && enteredAmount > 0
    ? Math.max(
        0,
        selectedLoan.outstandingBalance - (formData.payment_type === 'principal' ? enteredAmount : 0),
      )
    : null

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
      const activeLoans = data || []
      const loanIds = activeLoans.map((loan) => loan.id)
      const latestBalances = new Map<string, number>()
      let balanceQueryFailed = false

      if (loanIds.length > 0) {
        const { data: ledgerEntries, error: ledgerError } = await supabase
          .from('ledger_entries')
          .select('id, loan_id, balance_after, created_at')
          .in('loan_id', loanIds)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

        if (ledgerError) {
          console.error('Error fetching outstanding loan balances:', ledgerError)
          balanceQueryFailed = true
        } else {
          for (const entry of ledgerEntries || []) {
            if (!latestBalances.has(entry.loan_id)) {
              latestBalances.set(entry.loan_id, Number(entry.balance_after))
            }
          }
        }
      }

      setLoans(activeLoans.map((loan) => ({
        ...loan,
        outstandingBalance: balanceQueryFailed
          ? null
          : latestBalances.get(loan.id) ?? Number(loan.principal),
      })))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(formData.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      void showSweetAlert('error', 'Invalid payment amount', 'Enter a valid payment amount greater than zero.')
      return
    }

    const receivedAt = new Date(formData.received_at).toISOString()
    const { data: { user } } = await supabase.auth.getUser()

    if (editingPaymentId) {
      const payment = payments.find((item) => item.id === editingPaymentId)
      if (!payment || payment.status !== 'pending') {
        void showSweetAlert('error', 'Payment cannot be edited', 'Only pending payments can be changed.')
        setShowForm(false)
        setEditingPaymentId(null)
        return
      }

      const updatedPayment = {
        loan_id: formData.loan_id,
        amount,
        payment_type: formData.payment_type,
        method: formData.method,
        reference: formData.reference || null,
        received_at: receivedAt,
      }
      const { data, error } = await supabase
        .from('payments')
        .update(updatedPayment)
        .eq('id', editingPaymentId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (error) {
        console.error('Error updating pending payment:', error)
        void showSweetAlert('error', 'Payment not updated', error.message)
        return
      }
      if (!data) {
        void showSweetAlert('error', 'Payment cannot be edited', 'It may have been posted or voided by another admin. Refresh and try again.')
        setShowForm(false)
        setEditingPaymentId(null)
        await fetchPayments()
        return
      }

      const { error: auditError } = await supabase.from('audit_logs').insert({
        actor_id: user?.id ?? null,
        action: 'edit_pending_payment',
        entity: 'payment',
        entity_id: payment.id,
        before_data: {
          loan_id: payment.loan_id,
          amount: payment.amount,
          payment_type: payment.payment_type,
          method: payment.method,
          reference: payment.reference,
          received_at: payment.received_at,
        },
        after_data: updatedPayment,
      })

      setShowForm(false)
      setEditingPaymentId(null)
      await fetchPayments()
      if (auditError) {
        console.error('Payment updated, but its audit entry could not be saved:', auditError)
        void showSweetAlert('warning', 'Payment updated', 'The payment was updated, but its audit entry could not be saved.')
      } else {
        void showSweetToast('success', 'Pending payment updated successfully')
      }
      return
    }

    const { error } = await supabase
      .from('payments')
      .insert({
        loan_id: formData.loan_id,
        amount,
        payment_type: formData.payment_type,
        method: formData.method,
        reference: formData.reference || null,
        received_at: receivedAt,
        recorded_by: user?.id,
        status: 'pending',
      })

    if (error) {
      console.error('Error creating payment:', error)
      void showSweetAlert('error', 'Payment not saved', error.message)
    } else {
      setShowForm(false)
      setEditingPaymentId(null)
      void showSweetToast('success', 'Payment saved as pending. Review it and post it when ready.')
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

  const startEditingPayment = (payment: Payment) => {
    if (payment.status !== 'pending') return
    setEditingPaymentId(payment.id)
    setFormData({
      loan_id: payment.loan_id,
      amount: String(payment.amount),
      payment_type: payment.payment_type || 'principal',
      method: payment.method,
      reference: payment.reference || '',
      received_at: new Date(payment.received_at).toISOString().split('T')[0],
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingPaymentId(null)
    setFormData({
      loan_id: '',
      amount: '',
      payment_type: 'principal',
      method: 'cash',
      reference: '',
      received_at: new Date().toISOString().split('T')[0],
    })
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
    const confirmation = await Swal.fire<string>({
      icon: 'warning',
      title: 'Void pending payment?',
      text: 'The payment will be rejected and the reason will be recorded in the audit log.',
      input: 'textarea',
      inputLabel: 'Reason for voiding',
      inputPlaceholder: 'Enter a reason...',
      inputValidator: (value) => !value?.trim() ? 'Please provide a reason.' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Void payment',
      cancelButtonText: 'Keep payment',
      confirmButtonColor: '#dc2626',
    })
    if (!confirmation.isConfirmed || !confirmation.value?.trim()) return
    const reason = confirmation.value.trim()

    setActingOnPaymentId(payment.id)
    const { error } = await supabase.rpc('void_pending_payment', {
      p_payment_id: payment.id,
      p_reason: reason.trim(),
    })
    if (error) {
      console.error('Error voiding pending payment:', error)
      void showSweetAlert('error', 'Could not void payment', error.message)
    } else {
      void showSweetToast('success', 'Payment voided successfully')
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
      void showSweetAlert('error', 'Could not post payment', errorMessage)
    } else {
      void showSweetToast('success', `${payment.payment_type} payment posted to the loan ledger`)
      await fetchPayments()
      await fetchLoans()
    }
    setActingOnPaymentId(null)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Record payments, correct pending entries, and post them to the loan ledger.</p>
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
            <h2 className="text-base md:text-lg font-semibold mb-4">
              {editingPaymentId ? 'Edit Pending Payment' : 'Record New Payment'}
            </h2>
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
                {selectedLoan && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-indigo-700">Current outstanding principal</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {selectedLoan.outstandingBalance == null
                            ? 'Balance unavailable'
                            : `₱${selectedLoan.outstandingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                      </div>
                      {projectedBalance != null && (
                        <div>
                          <p className="text-xs font-medium text-indigo-700">Estimated principal after payment</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            ₱{projectedBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Estimate is based on the selected payment type. The posted ledger determines the final balance.
                    </p>
                  </div>
                )}
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
                {editingPaymentId ? 'Save Changes' : 'Record Payment'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
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
                            onClick={() => startEditingPayment(payment)}
                            className="mr-3 text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Edit
                          </button>
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
