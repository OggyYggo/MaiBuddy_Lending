'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Database } from '@/types/supabase'

type Loan = Database['public']['Tables']['loans']['Row'] & {
  borrowers: Database['public']['Tables']['borrowers']['Row']
}
type ScheduleItem = Database['public']['Tables']['schedule_items']['Row']
type Payment = Database['public']['Tables']['payments']['Row'] & {
  payment_type?: string | null
}
type LedgerEntry = Database['public']['Tables']['ledger_entries']['Row']

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPdfCurrency(value: number) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPaymentType(paymentType: string | null | undefined) {
  if (paymentType === 'installment') return 'Installment (principal + interest)'
  if (paymentType === 'principal') return 'Principal only'
  if (paymentType === 'interest') return 'Interest only'
  if (paymentType === 'penalty') return 'Penalty'
  return 'Principal only'
}

export default function LoanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [canExport, setCanExport] = useState(false)
  const [activeTab, setActiveTab] = useState<'schedule' | 'payments' | 'ledger'>('schedule')
  const [showDisburse, setShowDisburse] = useState(false)
  const [showPayoff, setShowPayoff] = useState(false)
  const [payoffQuote, setPayoffQuote] = useState<number>(0)
  const [disbursementData, setDisbursementData] = useState({
    date: new Date().toISOString().split('T')[0],
    method: '',
    reference: '',
  })
  const supabase = createClient()

  useEffect(() => {
    fetchLoan()
    fetchSchedule()
    fetchPayments()
    fetchLedger()
    const loadExportPermission = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error checking PDF export permission:', error)
        return
      }
      setCanExport(profile?.role === 'admin')
    }

    void loadExportPermission()
  }, [params.id])

  const exportActiveTable = () => {
    if (!loan || !canExport) return

    const borrowerName = loan.borrowers?.full_name || 'Borrower'
    const currency = (amount: number) => formatPdfCurrency(amount)
    let title = ''
    let headers: string[] = []
    let rows: Array<Array<string | number>> = []

    if (activeTab === 'schedule') {
      title = 'Repayment Schedule'
      headers = ['Installment', 'Due Date', 'Principal Remaining', 'Interest Remaining', 'Total Due', 'Status']
      rows = schedule.map((item) => {
        const principalRemaining = Math.max(Number(item.principal_due) - Number(item.principal_paid), 0)
        const interestRemaining = Math.max(Number(item.interest_due) - Number(item.interest_paid), 0)
        return [
          item.installment_no,
          new Date(`${item.due_date}T12:00:00`).toLocaleDateString(),
          currency(principalRemaining),
          currency(interestRemaining),
          currency(principalRemaining + interestRemaining),
          item.status,
        ]
      })
    } else if (activeTab === 'payments') {
      title = 'Payment History'
      headers = ['Date', 'Amount', 'Payment Type', 'Principal Applied', 'Interest Applied', 'Method', 'Reference', 'Status']
      rows = payments.map((payment) => [
        new Date(payment.received_at).toLocaleDateString(),
        currency(Number(payment.amount)),
        formatPaymentType(payment.payment_type),
        currency(Number(payment.principal_allocated || 0)),
        currency(Number(payment.interest_allocated || 0)),
        payment.method.replace('_', ' '),
        payment.reference || '—',
        payment.status,
      ])
    } else {
      title = 'Loan Ledger'
      headers = ['Date', 'Type', 'Amount', 'Running Balance']
      rows = ledger.map((entry) => [
        new Date(entry.created_at).toLocaleDateString(),
        entry.type,
        currency(Number(entry.amount)),
        currency(Number(entry.balance_after)),
      ])
    }

    const tableRows = rows.length
      ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}" class="empty">No ${escapeHtml(title.toLowerCase())} records.</td></tr>`
    const safeName = borrowerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'borrower'
    const fileTitle = `lending-update-${activeTab}-${safeName}-${String(loan.id).slice(0, 8)}`
    const printWindow = window.open('', '_blank', 'width=1000,height=750')

    if (!printWindow) {
      window.alert('Allow pop-ups for this site to export the PDF.')
      return
    }

    printWindow.opener = null
    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(fileTitle)}</title>
          <style>
            @page { size: landscape; margin: 14mm; }
            * { box-sizing: border-box; }
            body { color: #172033; font: 12px Arial, sans-serif; margin: 0; }
            header { border-bottom: 2px solid #4f46e5; margin-bottom: 20px; padding-bottom: 14px; }
            .brand { color: #4f46e5; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
            h1 { font-size: 22px; margin: 7px 0 12px; }
            .details { color: #475569; display: flex; flex-wrap: wrap; gap: 8px 24px; }
            .details strong { color: #172033; }
            table { border-collapse: collapse; margin-top: 14px; width: 100%; }
            th { background: #eef2ff; color: #312e81; font-size: 10px; text-align: left; text-transform: uppercase; }
            th, td { border: 1px solid #dbe1ea; padding: 8px; }
            tr { break-inside: avoid; }
            .empty { color: #64748b; padding: 18px; text-align: center; }
            footer { color: #64748b; font-size: 10px; margin-top: 18px; }
          </style>
        </head>
        <body>
          <header>
            <div class="brand">Lending Update!</div>
            <h1>${escapeHtml(title)}</h1>
            <div class="details">
              <span>Borrower: <strong>${escapeHtml(borrowerName)}</strong></span>
              <span>Loan principal: <strong>${escapeHtml(currency(Number(loan.principal)))}</strong></span>
              <span>Term: <strong>${escapeHtml(loan.term_months)} months</strong></span>
              <span>Monthly rate: <strong>${escapeHtml((Number(loan.monthly_rate) * 100).toFixed(2))}%</strong></span>
              <span>Loan status: <strong>${escapeHtml(loan.status.replace('_', ' '))}</strong></span>
              <span>Prepared: <strong>${escapeHtml(new Date().toLocaleDateString())}</strong></span>
            </div>
          </header>
          <table>
            <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <footer>Generated from the current loan records. This is not a payment receipt. Confidential borrower information; share only with the intended recipient.</footer>
        </body>
      </html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      if (!printWindow.closed) printWindow.print()
    }, 300)

  }

  const fetchLoan = async () => {
    const { data, error } = await supabase
      .from('loans')
      .select('*, borrowers(*)')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching loan:', error)
    } else {
      setLoan(data)
    }
    setLoading(false)
  }

  const fetchSchedule = async () => {
    const { data, error } = await supabase
      .from('schedule_items')
      .select('*')
      .eq('loan_id', params.id)
      .order('installment_no', { ascending: true })

    if (error) {
      console.error('Error fetching schedule:', error)
    } else {
      setSchedule(data || [])
    }
  }

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', params.id)
      .order('received_at', { ascending: false })

    if (error) {
      console.error('Error fetching payments:', error)
    } else {
      setPayments(data || [])
    }
  }

  const fetchLedger = async () => {
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('loan_id', params.id)
      .order('created_at', { ascending: true })
      .order('type', { ascending: true })

    if (error) {
      console.error('Error fetching ledger:', error)
    } else {
      setLedger(data || [])
    }
  }

  const handleDisbursement = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.rpc('record_loan_disbursement', {
      p_loan_id: params.id,
      p_disbursed_at: new Date(disbursementData.date).toISOString(),
    })

    if (error) {
      console.error('Error recording disbursement:', error.message, error)
      alert(`Failed to record disbursement: ${error.message}`)
      return
    }

    setShowDisburse(false)
    fetchLoan()
    fetchSchedule()
    fetchLedger()
  }

  const handlePayoffQuote = async () => {
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('amount')
      .eq('loan_id', params.id)
      .eq('type', 'principal')

    if (error) {
      console.error('Error fetching balance:', error)
      return
    }

    const principalPaid = (data || []).reduce((total, entry) => total + Number(entry.amount), 0)
    const balance = Math.max(Number(loan?.principal || 0) - principalPaid, 0)
    const accruedInterest = schedule
      .filter((item) => new Date(item.due_date) <= new Date() && item.status !== 'paid')
      .reduce((sum, item) => sum + (item.interest_due - item.interest_paid), 0)

    setPayoffQuote(balance + accruedInterest)
    setShowPayoff(true)
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!loan) {
    return <div className="text-center py-8">Loan not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <a
          href="/loans"
          className="text-indigo-600 hover:text-indigo-900 text-sm"
        >
          ← Back to Loans
        </a>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Loan Details</h2>
          <div className="space-y-2">
            <p>
              <span className="text-sm text-gray-500">Borrower:</span>{' '}
              <span className="text-gray-900">{loan.borrowers?.full_name}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Principal:</span>{' '}
              <span className="text-gray-900">₱{loan.principal.toLocaleString()}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Term:</span>{' '}
              <span className="text-gray-900">{loan.term_months} months</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Monthly Rate:</span>{' '}
              <span className="text-gray-900">{(loan.monthly_rate * 100).toFixed(2)}%</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Repayment Style:</span>{' '}
              <span className="text-gray-900">
                {loan.repayment_style === 'LUMP_SUM' ? 'Lump Sum' : loan.repayment_style === 'EQUAL_PRINCIPAL' ? 'Installment' : 'Equal Payment'}
              </span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Status:</span>{' '}
              <span className="text-gray-900 capitalize">
                {loan.status.replace('_', ' ')}
              </span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Disbursed:</span>{' '}
              <span className="text-gray-900">
                {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : 'Not yet'}
              </span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Maturity Date:</span>{' '}
              <span className="text-gray-900">
                {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : '-'}
              </span>
            </p>
          </div>

          {loan.status === 'pending_disbursement' && (
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setShowDisburse(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Record Disbursement
              </button>
            </div>
          )}

          {loan.status === 'active' && (
            <div className="mt-4 pt-4 border-t">
              {!ledger.some((entry) => entry.type === 'disbursement') && (
                <button
                  onClick={() => setShowDisburse(true)}
                  className="mr-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Complete Disbursement Record
                </button>
              )}
              <button
                onClick={handlePayoffQuote}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Get Payoff Quote
              </button>
            </div>
          )}
        </div>

        {showDisburse && (
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Record Disbursement</h2>
            <form onSubmit={handleDisbursement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disbursement Date *
                </label>
                <input
                  type="date"
                  required
                  value={disbursementData.date}
                  onChange={(e) =>
                    setDisbursementData({ ...disbursementData, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method *
                </label>
                <select
                  required
                  value={disbursementData.method}
                  onChange={(e) =>
                    setDisbursementData({ ...disbursementData, method: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="e_wallet">E-Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={disbursementData.reference}
                  onChange={(e) =>
                    setDisbursementData({ ...disbursementData, reference: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Confirm Disbursement
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisburse(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showPayoff && (
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Payoff Quote</h2>
            <div className="space-y-4">
              <p className="text-3xl font-bold text-gray-900">
                ₱{payoffQuote.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                This includes principal, accrued interest, and any penalties as of today.
              </p>
              <button
                onClick={() => setShowPayoff(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
            <nav className="flex min-w-0 flex-1 space-x-4 overflow-x-auto sm:space-x-8">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'schedule'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'payments'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Payments
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ledger'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Ledger
              </button>
            </nav>
            {canExport && (
              <button
                type="button"
                onClick={exportActiveTable}
                title="Opens the print dialog; choose Save as PDF to create a file"
                className="my-2 shrink-0 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 sm:px-3 sm:text-sm"
              >
                Export PDF
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'schedule' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Principal Due (Remaining)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Interest Due (Remaining)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Total Monthly Due (Remaining)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedule.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm">{item.installment_no}</td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(item.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {'\u20B1'}{Math.max(item.principal_due - item.principal_paid, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {'\u20B1'}{Math.max(item.interest_due - item.interest_paid, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        {'\u20B1'}{
                          (
                            Math.max(item.principal_due - item.principal_paid, 0) +
                            Math.max(item.interest_due - item.interest_paid, 0)
                          ).toLocaleString()
                        }
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            item.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : item.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Principal Applied</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Interest Applied</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Method
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Reference
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2 text-sm">
                        {new Date(payment.received_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        ₱{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">{formatPaymentType(payment.payment_type)}</td>
                      <td className="px-4 py-2 text-sm">{formatPdfCurrency(Number(payment.principal_allocated || 0))}</td>
                      <td className="px-4 py-2 text-sm">{formatPdfCurrency(Number(payment.interest_allocated || 0))}</td>
                      <td className="px-4 py-2 text-sm capitalize">
                        {payment.method.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-2 text-sm">{payment.reference || '-'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            payment.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && (
                <div className="text-center py-8 text-gray-500">No payments recorded</div>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Running Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-2 text-sm">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm capitalize">{entry.type}</td>
                      <td className="px-4 py-2 text-sm">
                        ₱{entry.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        ₱{entry.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledger.length === 0 && (
                <div className="text-center py-8 text-gray-500">No ledger entries</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
