'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { generateSchedule } from '@/lib/loan/engine'
import Decimal from 'decimal.js'
import type { Database } from '@/types/supabase'

type Application = Database['public']['Tables']['applications']['Row'] & {
  borrowers: Database['public']['Tables']['borrowers']['Row']
}
type Document = Database['public']['Tables']['documents']['Row']

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [application, setApplication] = useState<Application | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [checks, setChecks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<'approved' | 'declined' | null>(null)
  const [reason, setReason] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchApplication()
    fetchDocuments()
  }, [params.id])

  const fetchApplication = async () => {
    const { data, error } = await supabase
      .from('applications')
      .select('*, borrowers(*)')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching application:', error)
    } else {
      setApplication(data)
      generateSchedulePreview(data)
      runAutomaticChecks(data)
    }
    setLoading(false)
  }

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('application_id', params.id)

    if (error) {
      console.error('Error fetching documents:', error)
    } else {
      setDocuments(data || [])
    }
  }

  const generateSchedulePreview = (app: Application) => {
    try {
      const rate = (app as any).custom_rate || 0.05
      const scheduleData = generateSchedule({
        principal: new Decimal(app.amount),
        rate: new Decimal(rate),
        months: app.term_months,
        style: app.repayment_style,
        startDate: new Date(),
      })
      setSchedule(scheduleData)
    } catch (err) {
      console.error('Error generating schedule:', err)
    }
  }

  const runAutomaticChecks = async (app: Application) => {
    const results: any[] = []

    const monthlyPayment = schedule.length > 0 ? schedule[0].totalDue : new Decimal(0)
    const monthlyIncome = app.borrowers.monthly_income || 0
    const ratio = monthlyIncome > 0 ? monthlyPayment.div(monthlyIncome).toNumber() : 0

    if (ratio > 0.20) {
      results.push({
        type: 'warning',
        message: `Payment is ${Math.round(ratio * 100)}% of monthly income (limit: 20%)`,
      })
    }

    const { data: duplicatePhone } = await supabase
      .from('borrowers')
      .select('id, full_name')
      .eq('phone', app.borrowers.phone)
      .neq('id', app.borrower_id)

    if (duplicatePhone && duplicatePhone.length > 0) {
      results.push({
        type: 'error',
        message: `Duplicate phone number found: ${duplicatePhone[0].full_name}`,
      })
    }

    if (app.borrowers.id_number) {
      const { data: duplicateId } = await supabase
        .from('borrowers')
        .select('id, full_name')
        .eq('id_number', app.borrowers.id_number)
        .neq('id', app.borrower_id)

      if (duplicateId && duplicateId.length > 0) {
        results.push({
          type: 'error',
          message: `Duplicate ID number found: ${duplicateId[0].full_name}`,
        })
      }
    }

    if (documents.length === 0) {
      results.push({
        type: 'warning',
        message: 'No documents uploaded',
      })
    }

    setChecks(results)
  }

  const handleDecision = async () => {
    if (!decision || !application) return

    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: decision,
        decided_by: user?.id,
        decision_reason: reason || null,
        decision_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Error updating application:', updateError)
      alert('Failed to update application')
      return
    }

    if (decision === 'approved') {
      let monthlyRate = (application as any).custom_rate
      if (!monthlyRate) {
        const { data: settings } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'monthly_rate')
          .single()
        monthlyRate = settings?.value ? parseFloat(settings.value) : 0.05
      }

      const { error: loanError } = await supabase.rpc('create_loan', {
        p_application_id: params.id,
        p_borrower_id: application.borrower_id,
        p_principal: application.amount,
        p_monthly_rate: monthlyRate,
        p_term_months: application.term_months,
        p_repayment_style: application.repayment_style,
      })

      if (loanError) {
        console.error('Error creating loan:', loanError)
        alert('Application approved but failed to create loan')
      }
    }

    router.push('/applications')
    router.refresh()
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!application) {
    return <div className="text-center py-8">Application not found</div>
  }

  return (
    <div>
      <div className="mb-6">
        <a
          href="/applications"
          className="text-indigo-600 hover:text-indigo-900 text-sm"
        >
          ← Back to Applications
        </a>
      </div>

      {checks.length > 0 && (
        <div className="mb-6 space-y-2">
          {checks.map((check, idx) => (
            <div
              key={idx}
              className={`px-4 py-3 rounded-md ${
                check.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              }`}
            >
              {check.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Borrower Information</h2>
          <div className="space-y-2">
            <p>
              <span className="text-sm text-gray-500">Name:</span>{' '}
              <span className="text-gray-900">{application.borrowers.full_name}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Phone:</span>{' '}
              <span className="text-gray-900">{application.borrowers.phone}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Address:</span>{' '}
              <span className="text-gray-900">{application.borrowers.address}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Employer:</span>{' '}
              <span className="text-gray-900">{application.borrowers.employer || '-'}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Monthly Income:</span>{' '}
              <span className="text-gray-900">
                {application.borrowers.monthly_income
                  ? `₱${application.borrowers.monthly_income.toLocaleString()}`
                  : '-'}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Loan Details</h2>
          <div className="space-y-2">
            <p>
              <span className="text-sm text-gray-500">Amount:</span>{' '}
              <span className="text-gray-900">₱{application.amount.toLocaleString()}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Term:</span>{' '}
              <span className="text-gray-900">{application.term_months} months</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Monthly Rate:</span>{' '}
              <span className="text-gray-900">
                {(application as any).custom_rate
                  ? `${((application as any).custom_rate * 100).toFixed(2)}% (Custom)`
                  : 'Default Rate'}
              </span>
            </p>
            {(application as any).rate_override_reason && (
              <p>
                <span className="text-sm text-gray-500">Rate Override Reason:</span>{' '}
                <span className="text-gray-900 text-sm italic">
                  {(application as any).rate_override_reason}
                </span>
              </p>
            )}
            <p>
              <span className="text-sm text-gray-500">Repayment Style:</span>{' '}
              <span className="text-gray-900">
                {application.repayment_style.replace('_', ' ')}
              </span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Purpose:</span>{' '}
              <span className="text-gray-900">{application.purpose || '-'}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Status:</span>{' '}
              <span className="text-gray-900 capitalize">
                {application.status.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold mb-4">Payment Schedule</h2>
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
              {schedule.map((item, idx) => (
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
        <div className="mt-4 text-sm text-gray-600">
          Total Interest: ₱
          {schedule
            .reduce((sum, item) => sum.add(item.interestDue), new Decimal(0))
            .toLocaleString()}
        </div>
      </div>

      {application.status === 'draft' || application.status === 'in_review' ? (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Decision</h2>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={() => setDecision('approved')}
                className={`px-4 py-2 rounded-md ${
                  decision === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Approve
              </button>
              <button
                onClick={() => setDecision('declined')}
                className={`px-4 py-2 rounded-md ${
                  decision === 'declined'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Decline
              </button>
            </div>

            {decision === 'declined' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Decline
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {decision && (
              <button
                onClick={handleDecision}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Confirm Decision
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <p className="text-gray-600">
            This application has been{' '}
            <span className="font-semibold capitalize">
              {application.status.replace('_', ' ')}
            </span>
            {application.decision_reason && `: ${application.decision_reason}`}
          </p>
        </div>
      )}
    </div>
  )
}
