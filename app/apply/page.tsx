'use client'

import { useEffect, useState } from 'react'
import Decimal from 'decimal.js'
import { generateSchedule } from '@/lib/loan/engine'

type ApplicationForm = {
  full_name: string
  birth_date: string
  phone: string
  address: string
  monthly_income: string
  amount: string
  term_months: string
  purpose: string
  repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
  consent: boolean
  website: string
}

const initialForm: ApplicationForm = {
  full_name: '',
  birth_date: '',
  phone: '',
  address: '',
  monthly_income: '',
  amount: '',
  term_months: '',
  purpose: '',
  repayment_style: 'EQUAL_PRINCIPAL',
  consent: false,
  website: '',
}

const today = new Date().toISOString().slice(0, 10)

export default function PublicApplicationPage() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')
  const [monthlyRate, setMonthlyRate] = useState(0.05)

  useEffect(() => {
    fetch('/api/settings')
      .then((response) => response.ok ? response.json() : null)
      .then((settings) => {
        const configuredRate = Number(settings?.monthly_rate)
        if (Number.isFinite(configuredRate) && configuredRate >= 0) setMonthlyRate(configuredRate)
      })
      .catch((loadError) => console.error('Could not load the default interest rate:', loadError))
  }, [])

  const handleChange = <K extends keyof ApplicationForm>(field: K, value: ApplicationForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/public-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          term_months: Number(form.term_months),
          monthly_income: form.monthly_income.trim() ? Number(form.monthly_income) : null,
        }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(result.error || 'We could not submit your application. Please try again.')
        return
      }

      setReference(result.reference || 'Submitted')
      setForm(initialForm)
    } catch {
      setError('We could not reach the application service. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'
  const labelClass = 'block text-sm font-medium text-slate-700'
  const amount = Number(form.amount)
  const termMonths = Number(form.term_months)
  const estimate = Number.isFinite(amount) && amount > 0 && Number.isInteger(termMonths) && termMonths > 0
    ? generateSchedule({
        principal: new Decimal(amount),
        rate: new Decimal(monthlyRate),
        months: termMonths,
        style: form.repayment_style,
        startDate: new Date(),
      })
    : []

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">MaiBuddy Lending</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Loan Application</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Complete this form to send your loan request to our team for review. Submitting an application does not guarantee approval.
          </p>
        </header>

        {reference ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-9" aria-live="polite">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">✓</div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Application submitted</h2>
            <p className="mt-2 text-sm text-slate-600">Our team will review your request. Keep this reference number for your records:</p>
            <p className="mt-3 inline-flex rounded-lg bg-slate-100 px-4 py-2 font-mono text-lg font-semibold text-slate-800">{reference}</p>
            <p className="mt-4 text-xs text-slate-500">You may close this page. Contact MaiBuddy Lending if you have questions about your application.</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <section>
              <h2 className="text-base font-semibold text-slate-900">Your details</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  Full name
                  <input className={inputClass} autoComplete="name" required maxLength={150} value={form.full_name} onChange={(event) => handleChange('full_name', event.target.value)} />
                </label>
                <label className={labelClass}>
                  Date of birth
                  <input className={inputClass} type="date" autoComplete="bday" max={today} required value={form.birth_date} onChange={(event) => handleChange('birth_date', event.target.value)} />
                </label>
                <label className={labelClass}>
                  Phone number
                  <input className={inputClass} type="tel" autoComplete="tel" required minLength={7} maxLength={24} value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Home address
                  <input className={inputClass} autoComplete="street-address" required maxLength={300} value={form.address} onChange={(event) => handleChange('address', event.target.value)} />
                </label>
                <label className={labelClass}>
                  Monthly income <span className="font-normal text-slate-400">(optional)</span>
                  <input className={inputClass} type="number" min="0" max="999999999999.99" step="0.01" inputMode="decimal" value={form.monthly_income} onChange={(event) => handleChange('monthly_income', event.target.value)} />
                </label>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-base font-semibold text-slate-900">Loan request</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Amount requested (₱)
                  <input className={inputClass} type="number" min="0.01" max="999999999999.99" step="0.01" inputMode="decimal" required value={form.amount} onChange={(event) => handleChange('amount', event.target.value)} />
                </label>
                <label className={labelClass}>
                  Repayment term (months)
                  <input className={inputClass} type="number" min="1" max="120" step="1" required value={form.term_months} onChange={(event) => handleChange('term_months', event.target.value)} />
                </label>
                <label className={labelClass}>
                  Repayment style
                  <select className={inputClass} value={form.repayment_style} onChange={(event) => handleChange('repayment_style', event.target.value as ApplicationForm['repayment_style'])}>
                    <option value="EQUAL_PRINCIPAL">Installment</option>
                    <option value="LUMP_SUM">Lump Sum</option>
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  What will the loan be used for?
                  <textarea className={inputClass} required minLength={3} maxLength={500} rows={3} value={form.purpose} onChange={(event) => handleChange('purpose', event.target.value)} />
                </label>
              </div>
              {estimate.length > 0 && (
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4" aria-live="polite">
                  <p className="text-sm font-medium text-indigo-700">
                    {form.repayment_style === 'LUMP_SUM' ? 'Estimated amount due at maturity' : 'Estimated first monthly payment'}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {'₱'}{estimate[0].totalDue.toNumber().toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {form.repayment_style === 'LUMP_SUM'
                      ? `One payment after ${termMonths} months, based on a ${(monthlyRate * 100).toFixed(2)}% monthly interest rate.`
                      : `Estimated using a ${(monthlyRate * 100).toFixed(2)}% monthly interest rate. Installment payments may decrease over the term as the principal balance falls.`}
                    {' '}The final terms and payment amount are subject to review.
                  </p>
                </div>
              )}
            </section>

            <div className="sr-only" aria-hidden="true">
              <label>
                Leave this field blank
                <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => handleChange('website', event.target.value)} />
              </label>
            </div>

            <label className="flex items-start gap-3 border-t border-slate-100 pt-5 text-sm leading-5 text-slate-600">
              <input className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" type="checkbox" required checked={form.consent} onChange={(event) => handleChange('consent', event.target.checked)} />
              <span>I confirm that the information I provided is accurate and consent to MaiBuddy Lending using it to review this loan application.</span>
            </label>

            <p className="text-xs leading-5 text-slate-500">Please do not submit passwords or bank account credentials. Supporting document uploads can be provided to staff during review.</p>
            <button type="submit" disabled={submitting} className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Submitting application…' : 'Submit application'}
            </button>
            <p className="text-center text-xs text-slate-400">Your request will be marked In Review until an administrator checks it.</p>
          </form>
        )}
      </div>
    </main>
  )
}
