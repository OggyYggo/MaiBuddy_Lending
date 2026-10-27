'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { generateSchedule } from '@/lib/loan/engine'
import Decimal from 'decimal.js'
import type { Database } from '@/types/supabase'

type Borrower = Database['public']['Tables']['borrowers']['Row']
type Application = Database['public']['Tables']['applications']['Row']

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const supabase = createClient()

  const [formData, setFormData] = useState({
    borrower_id: '',
    amount: '',
    term_months: '',
    purpose: '',
    repayment_style: 'EQUAL_PRINCIPAL' as 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT',
    custom_rate: '',
    rate_override_reason: '',
  })

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

    if (field === 'amount' || field === 'term_months' || field === 'repayment_style' || field === 'custom_rate') {
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
          startDate: new Date(),
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

    if (formData.custom_rate) {
      const rate = parseFloat(formData.custom_rate)
      const minRate = settings.min_rate ? parseFloat(settings.min_rate) : 0.01
      const maxRate = settings.max_rate ? parseFloat(settings.max_rate) : 0.10

      if (rate < minRate || rate > maxRate) {
        alert(`Custom rate must be between ${(minRate * 100).toFixed(2)}% and ${(maxRate * 100).toFixed(2)}%`)
        return
      }

      if (!formData.rate_override_reason.trim()) {
        alert('Please provide a reason for the rate override')
        return
      }
    }

    const applicationData = {
      borrower_id: formData.borrower_id,
      amount: parseFloat(formData.amount),
      term_months: parseInt(formData.term_months),
      purpose: formData.purpose || null,
      repayment_style: formData.repayment_style,
      custom_rate: formData.custom_rate ? parseFloat(formData.custom_rate) : null,
      rate_override_reason: formData.custom_rate ? formData.rate_override_reason : null,
    }
    const result = editingApplicationId
      ? await supabase.from('applications').update(applicationData).eq('id', editingApplicationId)
      : await supabase.from('applications').insert({ ...applicationData, status: 'draft' })
    const { error } = result

    if (error) {
      console.error('Error saving application:', error)
      alert(`Failed to ${editingApplicationId ? 'update' : 'create'} application: ${error.message}`)
    } else {
      setShowForm(false)
      setEditingApplicationId(null)
      setFormData({
        borrower_id: '',
        amount: '',
        term_months: '',
        purpose: '',
        repayment_style: 'EQUAL_PRINCIPAL',
        custom_rate: '',
        rate_override_reason: '',
      })
      setSchedulePreview([])
      fetchApplications()
    }
  }

  const handleEdit = (application: Application) => {
    setEditingApplicationId(application.id)
    setFormData({
      borrower_id: application.borrower_id,
      amount: application.amount.toString(),
      term_months: application.term_months.toString(),
      purpose: application.purpose || '',
      repayment_style: application.repayment_style,
      custom_rate: (application as any).custom_rate?.toString() || '',
      rate_override_reason: (application as any).rate_override_reason || '',
    })
    updateSchedulePreview({
      borrower_id: application.borrower_id,
      amount: application.amount.toString(),
      term_months: application.term_months.toString(),
      purpose: application.purpose || '',
      repayment_style: application.repayment_style,
      custom_rate: (application as any).custom_rate?.toString() || '',
      rate_override_reason: (application as any).rate_override_reason || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (application: Application) => {
    if (!window.confirm(`Delete this ${application.status.replace('_', ' ')} application?`)) return

    const { data, error } = await supabase
      .from('applications')
      .delete()
      .eq('id', application.id)
      .select('id')
    if (error) {
      console.error('Error deleting application:', error)
      alert(`Could not delete application: ${error.message}`)
      return
    }
    if (!data?.length) {
      alert('No application was deleted. Apply the admin record-management SQL migration in Supabase to enable deletes.')
      return
    }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <button
          onClick={() => {
            setEditingApplicationId(null)
            setFormData({ borrower_id: '', amount: '', term_months: '', purpose: '', repayment_style: 'EQUAL_PRINCIPAL', custom_rate: '', rate_override_reason: '' })
            setSchedulePreview([])
            setShowForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          New Application
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">{editingApplicationId ? 'Edit Loan Application' : 'New Loan Application'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Borrower *
                </label>
                <select
                  required
                  value={formData.borrower_id}
                  onChange={(e) => handleFormChange('borrower_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a borrower</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name} - {b.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₱) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  <option value="EQUAL_PRINCIPAL">Equal Principal</option>
                  <option value="EQUAL_PAYMENT">Equal Payment (Amortized)</option>
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

              <div className="col-span-2">
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
                <div className="col-span-2">
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
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedulePreview.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm">{item.installmentNo}</td>
                          <td className="px-4 py-2 text-sm">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-sm">
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

            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                {editingApplicationId ? 'Save Changes' : 'Create Application'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingApplicationId(null)
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
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Term
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Style
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {(app as any).borrowers?.full_name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      ₱{app.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{app.term_months} months</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {app.repayment_style.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${statusColors[app.status]}`}
                    >
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                          className="ml-3 text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(app)}
                          className="ml-3 text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {applications.length === 0 && (
            <div className="text-center py-8 text-gray-500">No applications found</div>
          )}
        </div>
      )}
    </div>
  )
}
