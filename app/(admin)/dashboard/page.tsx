'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    activeLoans: 0,
    outstandingPrincipal: 0,
    overdueLoans: 0,
    overdueAmount: 0,
    pendingApplications: 0,
    disbursedMonth: 0,
    collectedMonth: 0,
    interestEarnedMonth: 0,
    expectedInterest30Days: 0,
    approvalRate: 0,
    portfolioAtRisk: 0,
    writeOffs: 0,
    repeatBorrowers: 0,
  })
  const [dueThisWeek, setDueThisWeek] = useState<any[]>([])
  const [agingBuckets, setAgingBuckets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchStatistics = async () => {
    setLoading(true)

    // Fetch all statistics in parallel
    const [
      activeLoans,
      outstandingPrincipal,
      overdueLoans,
      pendingApplications,
      disbursedMonth,
      collectedMonth,
      interestEarnedMonth,
      expectedInterest30Days,
      approvalRate,
      portfolioAtRisk,
      writeOffs,
      repeatBorrowers,
      dueThisWeekData,
      agingBucketsData,
    ] = await Promise.all([
      supabase.from('v_active_loans').select('*').single(),
      supabase.from('v_outstanding_principal').select('*').single(),
      supabase.from('v_overdue_loans').select('*').single(),
      supabase.from('v_pending_applications').select('*').single(),
      supabase.from('v_disbursed_month').select('*').single(),
      supabase.from('v_collected_month').select('*').single(),
      supabase.from('v_interest_earned_month').select('*').single(),
      supabase.from('v_expected_interest_30days').select('*').single(),
      supabase.from('v_approval_rate').select('*').single(),
      supabase.from('v_portfolio_at_risk').select('*').single(),
      supabase.from('v_write_offs').select('*').single(),
      supabase.from('v_repeat_borrowers').select('*').single(),
      supabase.from('v_due_this_week').select('*'),
      supabase.from('v_aging_buckets').select('*'),
    ])

    setStats({
      activeLoans: activeLoans.data?.count || 0,
      outstandingPrincipal: outstandingPrincipal.data?.total || 0,
      overdueLoans: overdueLoans.data?.count || 0,
      overdueAmount: overdueLoans.data?.total_amount || 0,
      pendingApplications: pendingApplications.data?.count || 0,
      disbursedMonth: disbursedMonth.data?.total || 0,
      collectedMonth: collectedMonth.data?.total || 0,
      interestEarnedMonth: interestEarnedMonth.data?.total || 0,
      expectedInterest30Days: expectedInterest30Days.data?.total || 0,
      approvalRate: approvalRate.data?.percentage || 0,
      portfolioAtRisk: portfolioAtRisk.data?.percentage || 0,
      writeOffs: writeOffs.data?.percentage || 0,
      repeatBorrowers: repeatBorrowers.data?.percentage || 0,
    })

    setDueThisWeek(dueThisWeekData.data || [])
    setAgingBuckets(agingBucketsData.data || [])
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const copyReminderText = (borrower: any) => {
    const text = `Hi ${borrower.borrower_name}, this is a friendly reminder that your loan payment of ₱${borrower.total_due.toLocaleString()} is due on ${new Date(borrower.due_date).toLocaleDateString()}. Please contact us if you have any questions.`
    navigator.clipboard.writeText(text)
    alert('Reminder text copied to clipboard')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Active Loans</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.activeLoans}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Outstanding Principal</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{formatCurrency(stats.outstandingPrincipal)}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Overdue Loans</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.overdueLoans}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats.overdueAmount)}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Pending Applications</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.pendingApplications}</p>
            </div>
          </div>

          {/* Monthly Performance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Disbursed This Month</h3>
              <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(stats.disbursedMonth)}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Collected This Month</h3>
              <p className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(stats.collectedMonth)}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Interest Earned This Month</h3>
              <p className="mt-2 text-2xl font-bold text-purple-600">{formatCurrency(stats.interestEarnedMonth)}</p>
            </div>
          </div>

          {/* Risk Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Portfolio at Risk (30+ days)</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.portfolioAtRisk.toFixed(1)}%</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Approval Rate</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.approvalRate.toFixed(1)}%</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Write-offs</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.writeOffs.toFixed(1)}%</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500">Repeat Borrowers</h3>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.repeatBorrowers.toFixed(1)}%</p>
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Overdue Aging</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {agingBuckets.map((bucket) => (
                <div key={bucket.bucket} className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600">{bucket.bucket}</h3>
                  <p className="text-xl font-bold text-gray-900 mt-1">{bucket.loan_count} loans</p>
                  <p className="text-sm text-gray-500">{formatCurrency(bucket.total_amount)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Due This Week */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Due This Week</h2>
            {dueThisWeek.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No payments due this week</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Borrower
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Due
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Paid
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dueThisWeek.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{item.borrower_name}</td>
                        <td className="px-4 py-2 text-sm">{item.phone}</td>
                        <td className="px-4 py-2 text-sm">
                          {new Date(item.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {formatCurrency(item.total_due)}
                        </td>
                        <td className="px-4 py-2 text-sm">{formatCurrency(item.amount_paid)}</td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => copyReminderText(item)}
                            className="text-indigo-600 hover:text-indigo-900 text-xs"
                          >
                            Copy Reminder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expected Interest */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Expected Interest (Next 30 Days)</h2>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.expectedInterest30Days)}</p>
          </div>
        </>
      )}
    </div>
  )
}
