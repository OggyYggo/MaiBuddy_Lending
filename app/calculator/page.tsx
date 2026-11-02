'use client'

import { useState, useEffect } from 'react'
import { generateSchedule } from '@/lib/loan/engine'
import Decimal from 'decimal.js'

export default function CalculatorPage() {
  const [amount, setAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [rate, setRate] = useState('5')
  const [repaymentStyle, setRepaymentStyle] = useState<'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'>('EQUAL_PRINCIPAL')
  const [schedule, setSchedule] = useState<any[]>([])
  const [settings, setSettings] = useState({ minRate: 1, maxRate: 10, defaultRate: 5 })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings({
          minRate: data.min_rate ? parseFloat(data.min_rate) * 100 : 1,
          maxRate: data.max_rate ? parseFloat(data.max_rate) * 100 : 10,
          defaultRate: data.monthly_rate ? parseFloat(data.monthly_rate) * 100 : 5,
        })
        setRate(data.monthly_rate ? (parseFloat(data.monthly_rate) * 100).toString() : '5')
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleCalculate = () => {
    if (!amount || !termMonths || !rate) return

    try {
      const scheduleData = generateSchedule({
        principal: new Decimal(amount),
        rate: new Decimal(parseFloat(rate) / 100),
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
    <div className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 md:py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">Loan Calculator</h1>
          <p className="text-sm text-gray-700 md:text-base">Calculate your loan repayment schedule</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <h2 className="mb-4 text-base font-semibold text-gray-900 md:text-lg">Loan Parameters</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    Loan Amount (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full rounded-md border border-gray-400 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    Term (months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    placeholder="Enter term"
                    className="w-full rounded-md border border-gray-400 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    Monthly Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={settings.minRate}
                    max={settings.maxRate}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full rounded-md border border-gray-400 px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-700">
                    Allowed range: {settings.minRate.toFixed(2)}% - {settings.maxRate.toFixed(2)}%
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    Repayment Style
                  </label>
                  <select
                    value={repaymentStyle}
                    onChange={(e) => setRepaymentStyle(e.target.value as any)}
                    className="w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="EQUAL_PRINCIPAL">Installment</option>
                    <option value="LUMP_SUM">Lump Sum</option>
                  </select>
                </div>

                <button
                  onClick={handleCalculate}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                >
                  Calculate
                </button>
              </div>
            </div>

            {schedule.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4 md:p-6 mt-4 md:mt-6">
                <h2 className="mb-4 text-base font-semibold text-gray-900 md:text-lg">Summary</h2>
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
                    <span className="font-medium">{rate}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {schedule.length > 0 ? (
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <h2 className="mb-4 text-base font-semibold text-gray-900 md:text-lg">Payment Schedule</h2>
                <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                  <table className="min-w-[600px] divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-700 md:px-4 md:py-3">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-700 md:px-4 md:py-3">
                          Due Date
                        </th>
                        <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase text-gray-700 sm:table-cell md:px-4 md:py-3">
                          Principal
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-700 md:px-4 md:py-3">
                          Interest
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-700 md:px-4 md:py-3">
                          Total
                        </th>
                        <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase text-gray-700 md:table-cell md:px-4 md:py-3">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 md:px-4 md:py-3">{item.installmentNo}</td>
                          <td className="px-3 py-2 text-sm text-gray-800 md:px-4 md:py-3">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </td>
                          <td className="hidden px-3 py-2 text-sm text-gray-800 sm:table-cell md:px-4 md:py-3">
                            ₱{item.principalDue.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-indigo-700 md:px-4 md:py-3">
                            ₱{item.interestDue.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900 md:px-4 md:py-3">
                            ₱{item.totalDue.toLocaleString()}
                          </td>
                          <td className="hidden px-3 py-2 text-sm text-gray-700 md:table-cell md:px-4 md:py-3">
                            ₱{item.balanceAfter.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 md:p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12 md:h-16 md:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No Schedule Generated</h3>
                <p className="text-sm text-gray-700 md:text-base">Enter loan parameters and click Calculate to see your payment schedule</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
