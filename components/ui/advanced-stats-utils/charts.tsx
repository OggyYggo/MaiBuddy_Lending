'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type CollectionTrendPoint = { month: string; collected: number }

function formatPeso(value: number) {
  return `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
}

export function ClippedAreaChart({ data }: { data: CollectionTrendPoint[] }) {
  if (data.length === 0 || data.every((point) => point.collected === 0)) {
    return <div className="flex h-64 items-center justify-center text-sm text-zinc-500">No confirmed collections in this period yet.</div>
  }

  return (
    <div className="h-64 w-full min-w-0 sm:h-72" role="img" aria-label="Confirmed collections for the last six months">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="collectionsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} width={66} tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(value: number) => formatPeso(value)} />
          <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Collected']} contentStyle={{ borderRadius: 12, borderColor: '#e4e4e7' }} />
          <Area type="monotone" dataKey="collected" stroke="#4f46e5" strokeWidth={2.5} fill="url(#collectionsFill)" activeDot={{ r: 5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
