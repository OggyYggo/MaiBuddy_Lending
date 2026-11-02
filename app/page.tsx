import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, ClipboardList, FileCheck2, HandCoins } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Lending home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">M</span>
          <span>
            <span className="block text-base font-bold tracking-tight">Lending</span>
          </span>
        </Link>
        <Link
          href="/apply"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Apply for a loan <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:pb-28 md:pt-20">
        <div className="absolute -left-44 top-12 h-96 w-96 rounded-full bg-indigo-100/70 blur-3xl" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
            A thoughtful start to your loan request
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Take the first step with <span className="text-indigo-600">Lending.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            Tell us what you need and choose a repayment term that works for you. Our team will review your request and follow up about the next steps.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              Apply for a Loan <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
            >
              Estimate a payment
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Submitting a request does not guarantee approval. Final terms are subject to review.</p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -right-5 -top-5 h-24 w-24 rounded-3xl bg-amber-200/70" />
          <div className="absolute -bottom-6 -left-5 h-28 w-28 rounded-full bg-indigo-200/70" />
          <div className="relative rounded-[2rem] border border-white bg-white p-6 shadow-[0_30px_80px_-35px_rgba(39,50,100,0.35)] sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Your application journey</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Simple steps, clear progress</h2>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <HandCoins className="h-6 w-6" />
              </span>
            </div>

            <div className="mt-8 space-y-6">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><ClipboardList className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold">Share your request</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Provide your contact details and the amount and term you’re considering.</p>
                </div>
              </div>
              <div className="ml-5 h-5 border-l-2 border-dashed border-indigo-200" />
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileCheck2 className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold">Our team reviews it</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Your request is marked for review while staff checks the details.</p>
                </div>
              </div>
              <div className="ml-5 h-5 border-l-2 border-dashed border-indigo-200" />
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Check className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold">Discuss next steps</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">The team will follow up after reviewing your application.</p>
                </div>
              </div>
            </div>

            <Link href="/apply" className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Lending</span>
          <span>Review the estimated payment and final loan terms before proceeding.</span>
        </div>
      </footer>
    </main>
  )
}
