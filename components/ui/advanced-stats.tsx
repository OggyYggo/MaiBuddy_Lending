'use client'

import { useRef } from 'react'
import { ArrowDownRight, ArrowUpRight, Banknote, CircleAlert, Landmark, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClippedAreaChart, type CollectionTrendPoint } from '@/components/ui/advanced-stats-utils/charts'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'

type AdvancedStatsProps = {
  stats: {
    totalBorrowers: number
    activeLoans: number
    outstandingPrincipal: number
    overdueLoans: number
    overdueAmount: number
    collectedMonth: number
    pendingApplications: number
    portfolioAtRisk: number
  }
  trend: CollectionTrendPoint[]
  formatCurrency: (amount: number) => string
}

export default function AdvancedStats({ stats, trend, formatCurrency }: AdvancedStatsProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const cards = [
    { label: 'Outstanding principal', value: formatCurrency(stats.outstandingPrincipal), detail: `${stats.activeLoans.toLocaleString()} active loans`, Icon: Landmark, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Collected this month', value: formatCurrency(stats.collectedMonth), detail: 'Confirmed payments', Icon: Banknote, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Overdue balance', value: formatCurrency(stats.overdueAmount), detail: `${stats.overdueLoans.toLocaleString()} overdue loans`, Icon: CircleAlert, tone: 'text-rose-600 bg-rose-50' },
    { label: 'Borrowers', value: stats.totalBorrowers.toLocaleString(), detail: `${stats.pendingApplications.toLocaleString()} applications pending`, Icon: Users, tone: 'text-sky-600 bg-sky-50' },
  ]

  return (
    <section ref={timelineRef} className="mb-8 min-w-0" aria-label="Lending portfolio overview">
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <TimelineAnimation animationNum={1} timelineRef={timelineRef} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Collection trend</p>
              <p className="mt-1 text-xs text-slate-500">Confirmed payments over the last six months</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">This month: {formatCurrency(stats.collectedMonth)}</span>
          </div>
          <ClippedAreaChart data={trend} />
        </TimelineAnimation>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <TimelineAnimation animationNum={2} timelineRef={timelineRef} className="flex min-w-0 flex-col justify-between rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Portfolio at risk</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">30+ days overdue</h2>
            </div>
            <div className="mt-8">
              <div className="mb-2 flex items-end justify-between gap-2">
                <span className="text-4xl font-semibold tracking-tight">{stats.portfolioAtRisk.toFixed(1)}%</span>
                <span className="mb-1 text-xs text-slate-400">of portfolio</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-indigo-300 transition-[width] duration-700" style={{ width: `${Math.min(Math.max(stats.portfolioAtRisk, 0), 100)}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-400">{formatCurrency(stats.overdueAmount)} currently overdue</p>
            </div>
          </TimelineAnimation>

          <TimelineAnimation animationNum={3} timelineRef={timelineRef} className="flex min-w-0 flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Operations snapshot</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">Portfolio activity</h2>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">{stats.pendingApplications.toLocaleString()}</p>
                <p className="mt-1 text-sm text-slate-500">Applications awaiting review</p>
              </div>
              {stats.pendingApplications > 0 ? <ArrowUpRight className="h-5 w-5 shrink-0 text-amber-600" /> : <ArrowDownRight className="h-5 w-5 shrink-0 text-emerald-600" />}
            </div>
          </TimelineAnimation>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, detail, Icon, tone }, index) => (
          <TimelineAnimation key={label} animationNum={4 + index} timelineRef={timelineRef} className={cn('min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 sm:p-5')}>
            <div className="flex items-center gap-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone)}><Icon className="h-4 w-4" /></div>
              <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
            </div>
            <p className="mt-3 truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
          </TimelineAnimation>
        ))}
      </div>
    </section>
  )
}
