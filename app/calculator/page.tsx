'use client'

import { useState, useEffect } from 'react'
import { generateSchedule } from '@/lib/loan/engine'
import Decimal from 'decimal.js'

export default function CalculatorPage() {
  const [amount, setAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [rate, setRate] = useState('5')
  const [repaymentStyle, setRepaymentStyle] = useState<'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'>('EQUAL_PRINCIPAL')
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Loan Calculator</h1>
          <p className="text-gray-600">Calculate your loan repayment schedule</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Loan Parameters</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loan Amount (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Term (months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    placeholder="Enter term"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={settings.minRate}
                    max={settings.maxRate}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Allowed range: {settings.minRate.toFixed(2)}% - {settings.maxRate.toFixed(2)}%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repayment Style
                  </label>
                  <select
                    value={repaymentStyle}
                    onChange={(e) => setRepaymentStyle(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="EQUAL_PRINCIPAL">Equal Principal</option>
                    <option value="EQUAL_PAYMENT">Equal Payment (Amortized)</option>
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
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-lg font-semibold mb-4">Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Principal:</span>
                    <span className="font-medium">₱{parseFloat(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Interest:</span>
                    <span className="font-medium text-indigo-600">₱{totalInterest.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Payment:</span>
                    <span className="font-medium text-gray-900">₱{totalPayment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Effective Rate:</span>
                    <span className="font-medium">{rate}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {schedule.length > 0 ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Payment Schedule</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Due Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Principal
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Interest
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{item.installmentNo}</td>
                          <td className="px-4 py-3 text-sm">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            ₱{item.principalDue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-indigo-600">
                            ₱{item.interestDue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            ₱{item.totalDue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            ₱{item.balanceAfter.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Generated</h3>
                <p className="text-gray-500">Enter loan parameters and click Calculate to see your payment schedule</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
