'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { generateSchedule } from '@/lib/loan/engine'
import Decimal from 'decimal.js'
import type { Database } from '@/types/supabase'
import { Swal, showSweetAlert, showSweetToast } from '@/lib/sweet-alert'

type Borrower = Database['public']['Tables']['borrowers']['Row']
type Application = Database['public']['Tables']['applications']['Row']

const todayDateInput = () => {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return today.toISOString().slice(0, 10)
}

const dateInputToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [pendingLoanIds, setPendingLoanIds] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null)
  const [editingApprovedApplication, setEditingApprovedApplication] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const supabase = createClient()
  const router = useRouter()

  const [formData, setFormData] = useState({
    borrower_id: '',
    borrower_name: '',
    amount: '',
    borrowed_date: todayDateInput(),
    term_months: '',
    purpose: '',
    repayment_style: 'EQUAL_PRINCIPAL' as 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM',
    custom_rate: '',
    rate_override_reason: '',
  })
  const [borrowerSearch, setBorrowerSearch] = useState('')
  const [showBorrowerDropdown, setShowBorrowerDropdown] = useState(false)

  const [schedulePreview, setSchedulePreview] = useState<any[]>([])

  useEffect(() => {
    fetchApplications()
    fetchBorrowers()
    fetchSettings()
  }, [])

  const fetchApplications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('applications')
      .select('*, borrowers(full_name)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching applications:', error)
    } else {
      setApplications(data || [])
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('id, application_id, status, disbursed_at')
        .eq('status', 'pending_disbursement')
        .is('disbursed_at', null)
      if (loansError) {
        console.error('Error fetching pending application loans:', loansError)
      } else {
        const loanIdsByApplication: Record<string, string> = {}
        for (const loan of loans || []) {
          if (loan.application_id) loanIdsByApplication[loan.application_id] = loan.id
        }
        setPendingLoanIds(loanIdsByApplication)
      }
    }
    setLoading(false)
  }

  const fetchBorrowers = async () => {
    const { data, error } = await supabase
      .from('borrowers')
      .select('*')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching borrowers:', error)
    } else {
      setBorrowers(data || [])
    }
  }

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')

    if (error) {
      console.error('Error fetching settings:', error)
    } else {
      const settingsMap: Record<string, string> = {}
      data?.forEach((setting) => {
        settingsMap[setting.key] = setting.value
      })
      setSettings(settingsMap)
    }
  }

  const handleFormChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })

    if (field === 'amount' || field === 'term_months' || field === 'repayment_style' || field === 'custom_rate' || field === 'borrowed_date') {
      updateSchedulePreview({ ...formData, [field]: value })
    }
  }

  const updateSchedulePreview = (data: typeof formData) => {
    if (data.amount && data.term_months && data.repayment_style) {
      try {
        const rate = data.custom_rate ? parseFloat(data.custom_rate) : (settings.monthly_rate ? parseFloat(settings.monthly_rate) : 0.05)
        const schedule = generateSchedule({
          principal: new Decimal(data.amount),
          rate: new Decimal(rate),
          months: parseInt(data.term_months),
          style: data.repayment_style,
          startDate: dateInputToLocalDate(data.borrowed_date),
        })
        setSchedulePreview(schedule)
      } catch (err) {
        console.error('Error generating schedule:', err)
        setSchedulePreview([])
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const requestedAmount = Number(formData.amount)
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      void showSweetAlert('error', 'Invalid loan amount', 'Enter a valid amount greater than zero.')
      return
    }

    if (formData.custom_rate) {
      const rate = parseFloat(formData.custom_rate)
      const minRate = settings.min_rate ? parseFloat(settings.min_rate) : 0.01
      const maxRate = settings.max_rate ? parseFloat(settings.max_rate) : 0.10

      if (rate < minRate || rate > maxRate) {
        void showSweetAlert('warning', 'Rate outside allowed range', `Custom rate must be between ${(minRate * 100).toFixed(2)}% and ${(maxRate * 100).toFixed(2)}%.`)
        return
      }

      if (!formData.rate_override_reason.trim()) {
        void showSweetAlert('warning', 'Reason required', 'Please provide a reason for the rate override.')
        return
      }
    }

    const applicationData = {
      borrower_id: formData.borrower_id,
      amount: requestedAmount,
      borrowed_date: formData.borrowed_date,
      term_months: parseInt(formData.term_months),
      purpose: formData.purpose || null,
      repayment_style: formData.repayment_style,
      custom_rate: formData.custom_rate ? parseFloat(formData.custom_rate) : null,
      rate_override_reason: formData.custom_rate ? formData.rate_override_reason : null,
    }
    if (!applicationData.borrower_id || !applicationData.term_months) {
      void showSweetAlert('warning', 'Application incomplete', 'Select a borrower and enter the loan term.')
      return
    }

    setSaving(true)
    if (editingApplicationId && editingApprovedApplication) {
      const { data: loanId, error } = await supabase.rpc('update_pending_application_and_loan', {
        p_application_id: editingApplicationId,
        p_borrower_id: applicationData.borrower_id,
        p_amount: applicationData.amount,
        p_borrowed_date: applicationData.borrowed_date,
        p_term_months: applicationData.term_months,
        p_purpose: applicationData.purpose,
        p_repayment_style: applicationData.repayment_style,
        p_monthly_rate: applicationData.custom_rate ?? (settings.monthly_rate ? parseFloat(settings.monthly_rate) : 0.05),
        p_custom_rate: applicationData.custom_rate,
        p_rate_override_reason: applicationData.rate_override_reason,
      })
      setSaving(false)
      if (error || !loanId) {
        void showSweetAlert('error', 'Application not updated', error?.message || 'The linked loan could not be updated.')
        return
      }
      await showSweetAlert('success', 'Application updated', 'The application and pending loan schedule have been updated.')
      router.push(`/loans/${loanId}`)
      router.refresh()
      return
    }

    let applicationId = editingApplicationId
    if (applicationId) {
      const { error } = await supabase.from('applications').update(applicationData).eq('id', applicationId)
      if (error) {
        setSaving(false)
        void showSweetAlert('error', 'Application not saved', `Could not update this application: ${error.message}`)
        return
      }
    } else {
      const { data, error } = await supabase.from('applications').insert({ ...applicationData, status: 'draft' }).select('id').single()
      if (error || !data) {
        setSaving(false)
        void showSweetAlert('error', 'Application not saved', `Could not create this application: ${error?.message || 'No application ID returned.'}`)
        return
      }
      applicationId = data.id
    }

    const { data: loanId, error: approvalError } = await supabase.rpc('approve_application_and_create_loan', {
      p_application_id: applicationId,
      p_monthly_rate: applicationData.custom_rate ?? (settings.monthly_rate ? parseFloat(settings.monthly_rate) : 0.05),
    })
    setSaving(false)
    if (approvalError || !loanId) {
      console.error('Error approving application:', approvalError)
      void showSweetAlert('error', 'Application saved, approval failed', approvalError?.message || 'No loan was created. You can edit and save this application again.')
      await fetchApplications()
      return
    }

    await showSweetAlert('success', 'Application approved', 'The loan is ready for disbursement.')
    router.push(`/loans/${loanId}`)
    router.refresh()
  }

  const handleEdit = (application: Application) => {
    setEditingApprovedApplication(application.status === 'approved')
    const borrower = borrowers.find((b) => b.id === application.borrower_id)
    setEditingApplicationId(application.id)
    setFormData({
      borrower_id: application.borrower_id,
      borrower_name: borrower?.full_name || '',
      amount: application.amount.toString(),
      borrowed_date: (application as any).borrowed_date || todayDateInput(),
      term_months: application.term_months.toString(),
      purpose: application.purpose || '',
      repayment_style: application.repayment_style,
      custom_rate: (application as any).custom_rate?.toString() || '',
      rate_override_reason: (application as any).rate_override_reason || '',
    })
    setBorrowerSearch(borrower ? `${borrower.full_name} - ${borrower.phone}` : '')
    updateSchedulePreview({
      borrower_id: application.borrower_id,
      borrower_name: borrower?.full_name || '',
      amount: application.amount.toString(),
      borrowed_date: (application as any).borrowed_date || todayDateInput(),
      term_months: application.term_months.toString(),
      purpose: application.purpose || '',
      repayment_style: application.repayment_style,
      custom_rate: (application as any).custom_rate?.toString() || '',
      rate_override_reason: (application as any).rate_override_reason || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (application: Application) => {
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Delete application?',
      text: `This ${application.status.replace('_', ' ')} application will be deleted.`,
      showCancelButton: true,
      confirmButtonText: 'Delete application',
      cancelButtonText: 'Keep application',
      confirmButtonColor: '#dc2626',
    })
    if (!confirmation.isConfirmed) return

    const { data, error } = await supabase
      .from('applications')
      .delete()
      .eq('id', application.id)
      .select('id')
    if (error) {
      console.error('Error deleting application:', error)
      void showSweetAlert('error', 'Could not delete application', error.message)
      return
    }
    if (!data?.length) {
      void showSweetAlert('warning', 'Application was not deleted', 'Apply the admin record-management SQL migration in Supabase to enable deletes.')
      return
    }
    void showSweetToast('success', 'Application deleted')
    fetchApplications()
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    in_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    withdrawn: 'bg-gray-100 text-gray-800',
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">Applications</h1>
          <p className="mt-1 text-sm text-slate-500">Create and edit applications, then approve them straight to disbursement. Approved applications remain editable while their loan is pending disbursement.</p>
        </div>
        <button
          onClick={() => {
            setEditingApplicationId(null)
            setEditingApprovedApplication(false)
            setFormData({ borrower_id: '', borrower_name: '', amount: '', borrowed_date: todayDateInput(), term_months: '', purpose: '', repayment_style: 'EQUAL_PRINCIPAL', custom_rate: '', rate_override_reason: '' })
            setBorrowerSearch('')
            setSchedulePreview([])
            setShowForm(true)
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 md:text-base"
        >
          New Application
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 mb-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">{editingApplicationId ? 'Edit Loan Application' : 'New Loan Application'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Borrower *
                </label>
                <input
                  type="text"
                  required
                  value={borrowerSearch}
                  onChange={(e) => {
                    setBorrowerSearch(e.target.value)
                    setShowBorrowerDropdown(true)
                  }}
                  onFocus={() => setShowBorrowerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowBorrowerDropdown(false), 200)}
                  placeholder="Search borrower by name or phone..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {showBorrowerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {borrowers
                      .filter((b) =>
                        b.full_name.toLowerCase().includes(borrowerSearch.toLowerCase()) ||
                        b.phone.includes(borrowerSearch)
                      )
                      .map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setBorrowerSearch(`${b.full_name} - ${b.phone}`)
                            handleFormChange('borrower_id', b.id)
                            setShowBorrowerDropdown(false)
                          }}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                          {b.full_name} - {b.phone}
                        </div>
                      ))}
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
                  onChange={(e) => handleFormChange('amount', e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Borrowed Date *</label>
                <input type="date" required value={formData.borrowed_date} onChange={(e) => handleFormChange('borrowed_date', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term (months) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="36"
                  value={formData.term_months}
                  onChange={(e) => handleFormChange('term_months', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repayment Style *
                </label>
                <select
                  required
                  value={formData.repayment_style}
                  onChange={(e) => handleFormChange('repayment_style', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="EQUAL_PRINCIPAL">Installment</option>
                  <option value="LUMP_SUM">Lump Sum</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Monthly Rate (optional)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder={`Default: ${settings.monthly_rate ? (parseFloat(settings.monthly_rate) * 100).toFixed(2) : '5.00'}%`}
                  value={formData.custom_rate}
                  onChange={(e) => handleFormChange('custom_rate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use default rate. Range: {settings.min_rate ? (parseFloat(settings.min_rate) * 100).toFixed(2) : '1.00'}% - {settings.max_rate ? (parseFloat(settings.max_rate) * 100).toFixed(2) : '10.00'}%
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => handleFormChange('purpose', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {formData.custom_rate && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Override Reason *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formData.rate_override_reason}
                    onChange={(e) => handleFormChange('rate_override_reason', e.target.value)}
                    placeholder="Explain why this rate is being overridden..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {schedulePreview.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Schedule Preview</h3>
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                  <table className="w-full min-w-[760px] divide-y divide-slate-100">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          #
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Due Date
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                          Principal
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Interest
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {schedulePreview.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm">{item.installmentNo}</td>
                          <td className="px-4 py-2 text-sm">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm hidden sm:table-cell">
                            ₱{item.principalDue.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            ₱{item.interestDue.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">
                            ₱{item.totalDue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Total Interest: ₱
                  {schedulePreview
                    .reduce((sum, item) => sum.add(item.interestDue), new Decimal(0))
                    .toLocaleString()}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {saving ? 'Saving…' : editingApprovedApplication ? 'Save Changes' : 'Save & Approve'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingApplicationId(null)
                  setEditingApprovedApplication(false)
                  setSchedulePreview([])
                }}
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
                    Source
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrowed Date
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
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {applications.map((app) => (
                  <tr key={app.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(app as any).borrowers?.full_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 whitespace-nowrap sm:table-cell md:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${app.submission_source === 'online' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700'}`}>
                          {app.submission_source === 'online' ? 'Online' : 'Admin'}
                        </span>
                        {app.possible_duplicate && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800" title="Check for an existing borrower with matching details">
                            Possible duplicate
                          </span>
                        )}
                      </div>
                      {app.submission_source === 'online' && (
                        <span className="mt-1 block text-[11px] text-slate-500">
                          Ref: MB-{app.id.replaceAll('-', '').slice(0, 8).toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ₱{app.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(`${app.borrowed_date}T12:00:00`).toLocaleDateString()}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-sm text-gray-900">{app.term_months} months</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900">
                        {app.repayment_style === 'LUMP_SUM' ? 'Lump Sum' : 'Installment'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${statusColors[app.status]}`}
                      >
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={`/applications/${app.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Review
                      </a>
                      {(app.status === 'draft' || app.status === 'in_review') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(app)}
                            className="ml-2 md:ml-3 text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(app)}
                            className="ml-2 md:ml-3 text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </>
                      )}
                  {app.status === 'approved' && pendingLoanIds[app.id] && (
                    <button
                      type="button"
                      onClick={() => handleEdit(app)}
                      className="ml-2 md:ml-3 text-indigo-600 hover:text-indigo-900"
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

          {applications.length === 0 && (
            <div className="text-center py-8 text-gray-500">No applications found</div>
          )}
        </div>
      )}
    </div>
  )
}
