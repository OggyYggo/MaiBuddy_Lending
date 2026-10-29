'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import AdvancedStats from '@/components/ui/advanced-stats'
import {
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  Repeat,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
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
    penaltyCollectedMonth: 0,
    interestEarnedMonth: 0,
    expectedInterest30Days: 0,
    approvalRate: 0,
    portfolioAtRisk: 0,
    writeOffs: 0,
    repeatBorrowers: 0,
  })
  const [dueThisWeek, setDueThisWeek] = useState<any[]>([])
  const [agingBuckets, setAgingBuckets] = useState<any[]>([])
  const [collectionTrend, setCollectionTrend] = useState<{ month: string; collected: number }[]>([])
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
        penaltyPaymentsMonth,
        interestEarnedMonth,
        expectedInterest30Days,
        approvalRate,
        portfolioAtRisk,
        writeOffs,
        repeatBorrowers,
        dueThisWeekData,
        agingBucketsData,
        collectionPayments,
      ] = await Promise.all([
        supabase.from('borrowers').select('id', { count: 'exact', head: true }),
        supabase.from('v_active_loans').select('*').single(),
        supabase.from('v_outstanding_principal').select('*').single(),
        supabase.from('v_overdue_loans').select('*').single(),
        supabase.from('v_pending_applications').select('*').single(),
        supabase.from('v_disbursed_month').select('*').single(),
        supabase.from('v_collected_month').select('*').single(),
        (() => {
          const monthStart = new Date()
          monthStart.setDate(1)
          monthStart.setHours(0, 0, 0, 0)
          const nextMonthStart = new Date(monthStart)
          nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)
          return supabase
            .from('payments')
            .select('amount')
            .eq('payment_type', 'penalty')
            .eq('status', 'confirmed')
            .gte('received_at', monthStart.toISOString())
            .lt('received_at', nextMonthStart.toISOString())
        })(),
        supabase.from('v_interest_earned_month').select('*').single(),
        supabase.from('v_expected_interest_30days').select('*').single(),
        supabase.from('v_approval_rate').select('*').single(),
        supabase.from('v_portfolio_at_risk').select('*').single(),
        supabase.from('v_write_offs').select('*').single(),
        supabase.from('v_repeat_borrowers').select('*').single(),
        supabase.from('v_due_this_week').select('*'),
        supabase.from('v_aging_buckets').select('*'),
        (() => {
          const periodStart = new Date()
          periodStart.setDate(1)
          periodStart.setHours(0, 0, 0, 0)
          periodStart.setMonth(periodStart.getMonth() - 5)
          return supabase
            .from('payments')
            .select('amount, received_at')
            .eq('status', 'confirmed')
            .gte('received_at', periodStart.toISOString())
            .order('received_at', { ascending: true })
        })(),
      ])

      const failedQuery = [
        borrowers,
        activeLoans,
        outstandingPrincipal,
        overdueLoans,
        pendingApplications,
        disbursedMonth,
        collectedMonth,
        penaltyPaymentsMonth,
        interestEarnedMonth,
        expectedInterest30Days,
        approvalRate,
        portfolioAtRisk,
        writeOffs,
        repeatBorrowers,
        dueThisWeekData,
        agingBucketsData,
        collectionPayments,
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
        penaltyCollectedMonth: (penaltyPaymentsMonth.data || []).reduce(
          (total, payment) => total + Number(payment.amount || 0),
          0,
        ),
        interestEarnedMonth: interestEarnedMonth.data?.total || 0,
        expectedInterest30Days: expectedInterest30Days.data?.total || 0,
        approvalRate: approvalRate.data?.percentage || 0,
        portfolioAtRisk: portfolioAtRisk.data?.percentage || 0,
        writeOffs: writeOffs.data?.percentage || 0,
        repeatBorrowers: repeatBorrowers.data?.percentage || 0,
      })

      setDueThisWeek(dueThisWeekData.data || [])
      setAgingBuckets(agingBucketsData.data || [])

      const monthLabels = Array.from({ length: 6 }, (_, index) => {
        const date = new Date()
        date.setDate(1)
        date.setMonth(date.getMonth() - (5 - index))
        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          month: date.toLocaleDateString('en-PH', { month: 'short' }),
          collected: 0,
        }
      })
      const totalsByMonth = new Map(monthLabels.map((item) => [item.key, item]))
      for (const payment of collectionPayments.data || []) {
        const date = new Date(payment.received_at)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const month = totalsByMonth.get(key)
        if (month) month.collected += Number(payment.amount || 0)
      }
      setCollectionTrend(monthLabels.map(({ month, collected }) => ({ month, collected })))
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

  const dueThisWeekTotal = dueThisWeek.reduce(
    (total, item) => total + Number(item.total_due || 0),
    0,
  )

  const monthlyMetrics = [
    { title: 'Disbursed This Month', value: formatCurrency(stats.disbursedMonth), href: '/loans', icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { title: 'Penalty Collected This Month', value: formatCurrency(stats.penaltyCollectedMonth), href: '/payments', icon: TriangleAlert, tone: 'bg-amber-50 text-amber-600' },
    { title: 'Interest Earned This Month', value: formatCurrency(stats.interestEarnedMonth), href: '/reports', icon: TrendingUp, tone: 'bg-violet-50 text-violet-600' },
    { title: 'Expected Interest (Next 30 Days)', value: formatCurrency(stats.expectedInterest30Days), href: '/reports', icon: Wallet, tone: 'bg-sky-50 text-sky-600' },
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
          <AdvancedStats stats={stats} trend={collectionTrend} formatCurrency={formatCurrency} />

          {/* Monthly Performance */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
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
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base md:text-lg font-semibold text-gray-900">Due This Week</h2>
                <p className="text-xs text-gray-500">Unpaid installments due in the next 7 days</p>
              </div>
              {dueThisWeek.length > 0 && (
                <p className="text-sm font-semibold text-indigo-700">
                  {formatCurrency(dueThisWeekTotal)} remaining across {dueThisWeek.length} installment{dueThisWeek.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
            {dueThisWeek.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No payments due this week</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full table-fixed divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-[24%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase md:px-4">
                        Borrower
                      </th>
                      <th className="hidden w-[15%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase lg:table-cell md:px-4">
                        Phone
                      </th>
                      <th className="w-[16%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase md:px-4">
                        Due Date
                      </th>
                      <th className="w-[19%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase md:px-4">
                        Remaining Due
                      </th>
                      <th className="hidden w-[12%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase xl:table-cell md:px-4">
                        Paid
                      </th>
                      <th className="w-[14%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase md:px-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dueThisWeek.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="break-words px-2 py-2 text-xs sm:text-sm md:px-4">
                          <div>{item.borrower_name}</div>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${Number(item.amount_paid) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                            {Number(item.amount_paid) > 0 ? 'Partially paid' : 'Due'}
                          </span>
                        </td>
                        <td className="hidden break-words px-2 py-2 text-sm lg:table-cell md:px-4">{item.phone}</td>
                        <td className="break-words px-2 py-2 text-xs sm:text-sm md:px-4">
                          {new Date(item.due_date).toLocaleDateString()}
                        </td>
                        <td className="break-words px-2 py-2 text-xs font-medium sm:text-sm md:px-4">
                          {formatCurrency(item.total_due)}
                        </td>
                        <td className="hidden break-words px-2 py-2 text-sm xl:table-cell md:px-4">{formatCurrency(item.amount_paid)}</td>
                        <td className="break-words px-2 py-2 text-xs md:px-4">
                          <button
                            onClick={() => copyReminderText(item)}
                            className="text-left text-indigo-600 hover:text-indigo-900"
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

        </>
      )}
    </div>
  )
}
