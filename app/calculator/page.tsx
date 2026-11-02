'use client'

import { useState } from 'react'
import Link from 'next/link'
import { generateSchedule } from '@/lib/loan/engine'
import Decimal from 'decimal.js'

const STANDARD_MONTHLY_RATE = 5

export default function CalculatorPage() {
  const [amount, setAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [repaymentStyle, setRepaymentStyle] = useState<'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'>('EQUAL_PRINCIPAL')
  const [schedule, setSchedule] = useState<any[]>([])

  const handleCalculate = () => {
    if (!amount || !termMonths) return

    try {
      const scheduleData = generateSchedule({
        principal: new Decimal(amount),
        rate: new Decimal(STANDARD_MONTHLY_RATE / 100),
        months: parseInt(termMonths),
        style: repaymentStyle,
        startDate: new Date(),
      })
      setSchedule(scheduleData)
    } catch (err) {
      console.error('Error generating schedule:', err)
      alert('Invalid input values')
    }
  }

  const totalInterest = schedule.reduce((sum, item) => sum.add(item.interestDue), new Decimal(0))
  const totalPayment = schedule.reduce((sum, item) => sum.add(item.totalDue), new Decimal(0))

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-slate-800 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="relative mb-7 overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-10">
          <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">Lending</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Plan your loan.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Explore an estimated repayment schedule using our standard monthly rate. Adjust the amount and term to see how payments change.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Standard rate: {STANDARD_MONTHLY_RATE.toFixed(2)}% monthly</div>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_55px_-30px_rgba(15,23,42,0.24)] sm:p-6">
              <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">01</span><div><h2 className="text-base font-semibold text-slate-900 md:text-lg">Loan details</h2><p className="mt-0.5 text-xs text-slate-500">Set your amount and repayment term.</p></div></div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Loan Amount (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Term (months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    placeholder="Enter term"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Standard Monthly Interest Rate
                  </label>
                  <div aria-label="Standard monthly interest rate, fixed at 5 percent" className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
                    <span>{STANDARD_MONTHLY_RATE.toFixed(2)}%</span>
                    <span className="text-xs font-medium text-gray-500">Fixed</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Repayment Style
                  </label>
                  <select
                    value={repaymentStyle}
                    onChange={(e) => setRepaymentStyle(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="EQUAL_PRINCIPAL">Installment</option>
                    <option value="LUMP_SUM">Lump Sum</option>
                  </select>
                </div>

                <button
                  onClick={handleCalculate}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                >
                  Calculate
                </button>
              </div>
            </div>

            {schedule.length > 0 && (
              <div className="mt-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900 md:text-lg">Estimate summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Principal:</span>
                    <span className="font-medium">₱{parseFloat(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Interest:</span>
                    <span className="font-medium text-indigo-700">₱{totalInterest.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Payment:</span>
                    <span className="font-medium text-gray-900">₱{totalPayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Effective Rate:</span>
                    <span className="font-medium">{STANDARD_MONTHLY_RATE.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-sm leading-5 text-slate-600">Ready to request this loan? Continue your application with these estimate details.</p>
                  <Link
                    href={`/apply?amount=${encodeURIComponent(amount)}&term_months=${encodeURIComponent(termMonths)}&repayment_style=${encodeURIComponent(repaymentStyle)}`}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                  >
                    Continue to application
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 lg:col-span-2">
            {schedule.length > 0 ? (
              <div className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_18px_55px_-30px_rgba(15,23,42,0.24)] sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Your estimate</p><h2 className="mt-1 text-base font-semibold text-slate-900 md:text-lg">Payment schedule</h2></div><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{termMonths} months</span></div>
                <div className="w-full max-w-full overflow-x-auto rounded-xl">
                  <table className="w-full min-w-[600px] divide-y divide-gray-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-4 md:py-3">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-4 md:py-3">
                          Due Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-4 md:py-3">
                          Principal
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-4 md:py-3">
                          Interest
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-4 md:py-3">
                          Total
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-4 md:py-3">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((item, idx) => (
                        <tr key={idx} className="transition hover:bg-slate-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 md:px-4 md:py-3">{item.installmentNo}</td>
                          <td className="px-3 py-2 text-sm text-gray-800 md:px-4 md:py-3">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-800 md:px-4 md:py-3">
                            ₱{item.principalDue.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-indigo-700 md:px-4 md:py-3">
                            ₱{item.interestDue.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 md:px-4 md:py-3">
                            ₱{item.totalDue.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 md:px-4 md:py-3">
                            ₱{item.balanceAfter.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm md:px-12">
                <div className="mb-4 text-indigo-300">
                  <svg className="mx-auto h-12 w-12 md:h-16 md:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900 md:text-lg">Your schedule will appear here</h3>
                <p className="mx-auto max-w-md text-sm leading-6 text-slate-500 md:text-base">Enter a loan amount and term, then select Calculate to see your estimated payments at the fixed 5% monthly rate.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
