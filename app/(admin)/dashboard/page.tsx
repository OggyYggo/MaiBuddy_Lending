'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  ClipboardCheck,
  Landmark,
  Repeat,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalBorrowers: 0,
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
  const [fetchError, setFetchError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchStatistics = async () => {
    setLoading(true)
    setFetchError(null)

    try {
      const [
        borrowers,
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
        supabase.from('borrowers').select('id', { count: 'exact', head: true }),
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

      const failedQuery = [
        borrowers,
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
      ].find((result) => result.error)

      if (failedQuery?.error) {
        const errorDetails = [
          failedQuery.error.message,
          failedQuery.error.details,
          failedQuery.error.hint,
          failedQuery.error.code ? `Code: ${failedQuery.error.code}` : null,
        ].filter(Boolean).join(' — ')
        console.error(
          `Error fetching dashboard statistics: ${errorDetails || 'Supabase returned an empty error object. Check the accompanying Supabase request log for its HTTP response.'}`
        )
        setFetchError(
          `${errorDetails || 'Supabase returned an empty error object.'} Check that the statistics views migration is applied and the logged-in user can read its views.`
        )
        return
      }

      setStats({
        totalBorrowers: borrowers.count || 0,
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
    } catch (error) {
      console.error('Unexpected error fetching dashboard statistics:', error)
      setFetchError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const copyReminderText = (borrower: any) => {
    const text = `Hi ${borrower.borrower_name}, this is a friendly reminder that your loan payment of ₱${borrower.total_due.toLocaleString()} is due on ${new Date(borrower.due_date).toLocaleDateString()}. Please contact us if you have any questions.`
    navigator.clipboard.writeText(text)
    alert('Reminder text copied to clipboard')
  }

  const primaryMetrics = [
    { title: 'Total Borrowers', value: stats.totalBorrowers.toLocaleString(), href: '/borrowers', icon: Users, tone: 'bg-indigo-50 text-indigo-600' },
    { title: 'Active Loans', value: stats.activeLoans.toLocaleString(), href: '/loans', icon: Landmark, tone: 'bg-sky-50 text-sky-600' },
    { title: 'Outstanding Principal', value: formatCurrency(stats.outstandingPrincipal), href: '/loans', icon: Wallet, tone: 'bg-violet-50 text-violet-600' },
    { title: 'Overdue Loans', value: stats.overdueLoans.toLocaleString(), detail: `${formatCurrency(stats.overdueAmount)} overdue`, href: '/loans?status=overdue', icon: TriangleAlert, tone: 'bg-rose-50 text-rose-600' },
    { title: 'Pending Applications', value: stats.pendingApplications.toLocaleString(), href: '/applications', icon: ClipboardCheck, tone: 'bg-amber-50 text-amber-600' },
  ]
  const monthlyMetrics = [
    { title: 'Disbursed This Month', value: formatCurrency(stats.disbursedMonth), href: '/loans', icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { title: 'Collected This Month', value: formatCurrency(stats.collectedMonth), href: '/payments', icon: Wallet, tone: 'bg-sky-50 text-sky-600' },
    { title: 'Interest Earned This Month', value: formatCurrency(stats.interestEarnedMonth), href: '/reports', icon: TrendingUp, tone: 'bg-violet-50 text-violet-600' },
  ]
  const riskMetrics = [
    { title: 'Portfolio at Risk (30+ days)', value: `${stats.portfolioAtRisk.toFixed(1)}%`, icon: ShieldAlert, tone: 'bg-rose-50 text-rose-600' },
    { title: 'Approval Rate', value: `${stats.approvalRate.toFixed(1)}%`, icon: BadgeCheck, tone: 'bg-emerald-50 text-emerald-600' },
    { title: 'Write-offs', value: `${stats.writeOffs.toFixed(1)}%`, icon: TriangleAlert, tone: 'bg-amber-50 text-amber-600' },
    { title: 'Repeat Borrowers', value: `${stats.repeatBorrowers.toFixed(1)}%`, icon: Repeat, tone: 'bg-indigo-50 text-indigo-600' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 md:text-2xl">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">A quick view of your lending portfolio and collections.</p>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : fetchError ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Could not load live dashboard statistics: {fetchError}</p>
          <button onClick={fetchStatistics} className="mt-3 font-medium underline">
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 md:gap-5">
            {primaryMetrics.map(({ title, value, detail, href, icon: Icon, tone }) => (
              <button
                key={title}
                type="button"
                onClick={() => router.push(href)}
                className="group min-w-0 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md md:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
                </div>
                <p className="mt-5 text-sm font-medium text-slate-500">{title}</p>
                <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-800 md:text-[1.75rem]">{value}</p>
                {detail && <p className="mt-1 text-xs font-medium text-rose-600">{detail}</p>}
              </button>
            ))}
          </div>

          {/* Monthly Performance */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
            {monthlyMetrics.map(({ title, value, href, icon: Icon, tone }) => (
              <button
                key={title}
                type="button"
                onClick={() => router.push(href)}
                className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-indigo-100 hover:shadow-md md:p-6"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-500">{title}</p>
                  <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-800 md:text-2xl">{value}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
              </button>
            ))}
          </div>

          {/* Risk Metrics */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
            {riskMetrics.map(({ title, value, icon: Icon, tone }) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">{title}</p>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Aging Buckets */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 mb-8">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Overdue Aging</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {agingBuckets.map((bucket) => (
                <div key={bucket.bucket} className="bg-gray-50 p-3 md:p-4 rounded-lg">
                  <h3 className="text-xs md:text-sm font-medium text-gray-600">{bucket.bucket}</h3>
                  <p className="text-lg md:text-xl font-bold text-gray-900 mt-1">{bucket.loan_count} loans</p>
                  <p className="text-xs md:text-sm text-gray-500">{formatCurrency(bucket.total_amount)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Due This Week */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200 mb-8">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Due This Week</h2>
            {dueThisWeek.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No payments due this week</div>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                <table className="min-w-[600px] divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Borrower
                      </th>
                      <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                        Phone
                      </th>
                      <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Due
                      </th>
                      <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                        Paid
                      </th>
                      <th className="px-3 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dueThisWeek.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 md:px-4 py-2 text-sm">{item.borrower_name}</td>
                        <td className="px-3 md:px-4 py-2 text-sm hidden sm:table-cell">{item.phone}</td>
                        <td className="px-3 md:px-4 py-2 text-sm">
                          {new Date(item.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-3 md:px-4 py-2 text-sm font-medium">
                          {formatCurrency(item.total_due)}
                        </td>
                        <td className="px-3 md:px-4 py-2 text-sm hidden md:table-cell">{formatCurrency(item.amount_paid)}</td>
                        <td className="px-3 md:px-4 py-2 text-sm">
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
          <div className="bg-white p-4 md:p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Expected Interest (Next 30 Days)</h2>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">{formatCurrency(stats.expectedInterest30Days)}</p>
          </div>
        </>
      )}
    </div>
  )
}
