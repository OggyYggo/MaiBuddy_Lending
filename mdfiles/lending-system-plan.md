# Mai Lending: Admin Lending Management System, Phase-by-Phase Plan

Last updated: 2026-10-24

## Overview

One admin web app that staff use to manage a lending business. There is **no landing page, no client sign-up, no client login and no borrower portal**. Staff enter borrowers and loans themselves.

- **Stack:** Next.js (App Router, TypeScript), shadcn/ui, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage).
- **Loan product:** 5% interest per month, charged on the remaining (diminishing) balance.
- **Not in scope for now:** landing page, public calculator, client sign-up or login, borrower portal, online application, online payment gateway.

## Roadmap at a glance

| Phase | Name | What you can do when it is done | Rough effort |
| --- | --- | --- | --- |
| 1 | Foundation and loan engine | Staff sign in to an admin shell; the interest and schedule math is built and tested | 1 week |
| 2 | Borrowers, applications and loans | Add a borrower, approve a request, create a loan with its schedule, record disbursement | 1 to 2 weeks |
| 3 | Payments and ledger | Record payments, split them into penalty, interest and principal, pay off early, print receipts | 1 to 2 weeks |
| 4 | Collections, statistics and settings | See overdue loans, a full statistics dashboard, reports, settings and an audit log | 1 to 2 weeks |

Total: about 4 to 6 weeks for one full-time developer (an estimate). Each phase ends with something that works on its own, so you can start entering real data after Phase 3.

## Loan rules (apply in every phase)

- Monthly interest = remaining principal × 0.05.
- Interest never compounds: unpaid interest is tracked separately and is not added to principal.
- Each payment is applied in this order: penalties, then accrued interest, then principal.
- Early or partial payments lower the principal right away, which lowers the next interest charge.
- Rate, loan limits, term limits and penalty rules are rows in the `settings` table, not hard-coded.

### Two repayment styles (both diminishing-balance)

| Style | Monthly payment | Interest per month | Best for |
| --- | --- | --- | --- |
| Equal principal | Falls each month | Falls each month | Lowest total interest |
| Equal payment (amortized) | Same every month | Falls each month | Predictable budgeting |

### Worked example: ₱10,000 over 6 months at 5% per month

| Month | Interest (equal principal) | Payment (equal principal) | Balance after | Interest (equal payment) | Principal (equal payment) | Balance after |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 500.00 | 2,166.67 | 8,333.33 | 500.00 | 1,470.17 | 8,529.83 |
| 2 | 416.67 | 2,083.33 | 6,666.67 | 426.49 | 1,543.68 | 6,986.14 |
| 3 | 333.33 | 2,000.00 | 5,000.00 | 349.31 | 1,620.87 | 5,365.27 |
| 4 | 250.00 | 1,916.67 | 3,333.33 | 268.26 | 1,701.91 | 3,663.36 |
| 5 | 166.67 | 1,833.33 | 1,666.67 | 183.17 | 1,787.01 | 1,876.36 |
| 6 | 83.33 | 1,750.00 | 0.00 | 93.82 | 1,876.36 | 0.00 |

Total interest: ₱1,750.00 (equal principal) or ₱1,821.05 (equal payment, ₱1,970.17 per month).

### Open decisions to confirm before Phase 2

- Which repayment style is the default.
- Whether interest accrues daily (5% ÷ 30 per day) or only on monthly due dates.
- Processing or service fee, late-payment penalty, and any early-payoff fee.
- Currency, and minimum and maximum loan amount and term.

---

## Phase 1: Foundation and loan engine

**Goal:** a working admin shell with secure staff login, and a tested calculation module that every later phase relies on.

**Effort:** about 1 week.

### Build

- [ ] Create the Next.js app (TypeScript, Tailwind, App Router) and initialize shadcn/ui.
- [ ] Create two Supabase projects (development and staging) and link them with the Supabase CLI.
- [ ] Add the Supabase clients for browser, server and middleware using `@supabase/ssr`. Never expose the service role key to the browser.
- [ ] Build the login page and `middleware.ts` for session refresh and route protection.
- [ ] Build the admin layout: sidebar, top bar, breadcrumbs, and a role guard (admin, loan officer).
- [ ] Create the first migrations with Row Level Security turned on for every table.
- [ ] Add an audit-log helper that every later server action will call.
- [ ] Build the loan engine in `lib/loan/` as pure functions (see below) with unit tests.
- [ ] Set up CI (lint, type check, tests on every pull request), `.env.example`, and Sentry.

### Database

| Table | Key fields | Notes |
| --- | --- | --- |
| profiles | user id, full name, role, status | Staff only. Roles: admin, loan officer |
| settings | key, value, updated by | Seed: monthly rate 0.05, default repayment style, limits, grace days |
| audit_logs | actor id, action, entity, before, after, at | Written by the audit helper |

### Loan engine (`lib/loan/`)

With r = 0.05, P = principal, n = months, B = balance before the payment:

```text
Interest(t)           = r × B(t-1)
Equal principal:        Payment(t) = P / n + r × B(t-1)
Equal payment:          PMT = P × r / (1 − (1 + r)^−n)
```

```ts
generateSchedule(input: { principal: Decimal; rate: Decimal; months: number;
                         style: "EQUAL_PRINCIPAL" | "EQUAL_PAYMENT";
                         startDate: Date }): ScheduleItem[]

accrueInterest(loan: LoanState, asOf: Date): Decimal

allocatePayment(loan: LoanState, amount: Decimal, paidAt: Date): Allocation
  // order: penalties, interest, principal; returns ledger entries

payoffQuote(loan: LoanState, asOf: Date): Decimal

regenerateSchedule(loan: LoanState, fromDate: Date): ScheduleItem[]
```

Rules for the engine:

- Use decimal.js in the app and `numeric(14,2)` in the database. Never use floating-point numbers for money.
- Round to the centavo at each step with one fixed rule (half up). The last installment absorbs leftover cents.
- Interest is never charged on unpaid interest or on penalties.
- Every function takes the date as an input so results are repeatable.

### Pages

`/login`, the admin layout shell, and a placeholder `/dashboard`.

### shadcn components

button, input, label, form, card, sidebar, breadcrumb, dropdown-menu, avatar, skeleton, sonner.

### Tests

For ₱10,000 over 6 months, equal payment gives ₱1,970.17 per month and ₱1,821.05 total interest; equal principal gives ₱1,750.00 total interest and a first payment of ₱2,166.67. Also test a payment on the due date, a late payment, a partial payment, an early full payoff, a 1-month loan, and rounding across 29-day and 31-day months.

### Done when

- [ ] An admin can sign in and sees the shell; a loan officer cannot open Settings.
- [ ] All engine tests pass and match the worked example above.
- [ ] Migrations are in the repo and CI is green.

---

## Phase 2: Borrowers, applications and loans

**Goal:** take a loan from a borrower record to an active, disbursed loan with a correct schedule.

**Effort:** about 1 to 2 weeks.

### Build

- [ ] Borrower list with search, add and edit forms, and a borrower profile page showing loan history.
- [ ] Document upload to a private Supabase Storage bucket, opened with short-lived signed links.
- [ ] Application entry form: borrower, amount, term, purpose, repayment style, with a live schedule preview from the engine.
- [ ] Review page with automatic checks: payment as a share of income (flag above 20%, a setting), duplicate ID number or phone, documents complete.
- [ ] Approve or decline with a reason. Maker-checker: the person who approves is not the one who confirms the payout.
- [ ] A Postgres function `create_loan` that creates the loan and all `schedule_items` in one transaction.
- [ ] Disbursement recording (date, method, reference) that writes a `disbursement` ledger entry.
- [ ] Loans list with status filters, and a loan detail page with the full schedule.
- [ ] Built-in loan calculator page so staff can quote a borrower.
- [ ] Basic dashboard totals: active loans, outstanding principal, overdue count.
- [ ] Audit log entries on every create, update and decision.

### Database

| Table | Key fields | Notes |
| --- | --- | --- |
| borrowers | id, full name, birth date, phone, address, employer, monthly income, ID type and number (encrypted), notes | Created by staff |
| documents | id, borrower id, application id, type, storage path, verified by | Private bucket |
| applications | id, borrower id, amount, term months, purpose, repayment style, status, decided by, decision reason | Status: draft, in review, approved, declined, withdrawn |
| loans | id, application id, borrower id, principal, monthly rate, term months, repayment style, disbursed at, maturity date, status | Status: pending disbursement, active, overdue, paid, written off |
| schedule_items | loan id, installment no, due date, principal due, interest due, amounts paid, status | Regenerated after partial or early payments |
| ledger_entries | loan id, type, amount, balance after, payment id, created at | Append-only. Types: disbursement, interest, principal, penalty, fee, adjustment |

A borrower has many applications. An approved application becomes one loan. A loan has many schedule items and ledger entries.

### Pages

| Route | Purpose |
| --- | --- |
| `/borrowers`, `/borrowers/[id]` | Borrower records, documents, loan history |
| `/applications`, `/applications/[id]` | Review queue, checks, documents, approve or decline |
| `/loans`, `/loans/[id]` | Loan list, schedule, ledger, disbursement |
| `/calculator` | Quote a loan for a borrower |

### shadcn components

table with TanStack Table (data table), dialog, sheet, select, textarea, radio-group, checkbox, calendar with popover, badge, tabs, alert, command (search), pagination, slider.

### Tests

- The schedule created by `create_loan` equals the engine's schedule for the same inputs.
- An application above the income-ratio limit is flagged.
- A duplicate ID number or phone is flagged.
- Approval by the same person who confirms payout is blocked.

### Done when

- [ ] A loan can be created for a borrower and shows the correct schedule.
- [ ] Disbursement is recorded and appears in the ledger.
- [ ] Documents open only through signed links.

---

## Phase 3: Payments and ledger

**Goal:** record every payment correctly so balances can always be trusted. After this phase you can start entering real loans.

**Effort:** about 1 to 2 weeks.

### Build

- [ ] Record-payment form: loan, amount, date, method (cash, bank, e-wallet), reference number, proof upload.
- [ ] A Postgres function `record_payment` that applies the payment in this order (penalties, interest, principal), writes the ledger entries, and updates `schedule_items` in one transaction.
- [ ] Partial payments, and a clear rule for overpayment (shorten the term, or lower future installments; choose one per loan setting).
- [ ] Early payoff with a payoff quote (principal + accrued interest + penalties as of a date).
- [ ] Confirm or reject pending payments; reverse a wrong payment with an adjustment entry (never edit or delete ledger rows).
- [ ] Manual penalty and fee entries, with waive (requires admin role).
- [ ] Loan status updates automatically (paid when balance reaches zero).
- [ ] Payments list with filters (loan, borrower, method, date, status).
- [ ] Receipt PDF per payment and a loan statement PDF.
- [ ] Ledger tab on the loan page showing every entry with the running balance.

### Database

| Table | Key fields | Notes |
| --- | --- | --- |
| payments | id, loan id, amount, method, reference, proof file, status, received at, recorded by | Status: pending, confirmed, rejected |
| penalties_fees | loan id, kind, amount, reason, waived by | Late and processing fees |

A payment writes several ledger entries (penalty, interest, principal) in one database transaction.

### Pages

| Route | Purpose |
| --- | --- |
| `/payments` | All payments, record a new payment |
| `/loans/[id]` (new tabs) | Payments tab, Ledger tab, payoff quote, penalties |

### shadcn components

form, select, input, calendar with popover, dialog, alert-dialog (confirm reversals), tabs, table, badge, tooltip.

### Tests

- A test that replays a loan's full ledger and checks it equals the stored balance.
- Payment on the due date, late payment, partial payment, overpayment, early full payoff, and a reversed payment.
- A payment that fails halfway leaves no partial ledger entries.

### Done when

- [ ] A test loan goes from disbursement to fully paid with correct balances at every step.
- [ ] Receipts and statements print with the right figures.
- [ ] The ledger replay test passes on every test loan.

---

## Phase 4: Collections, statistics and settings

**Goal:** run the business day to day: know who is late, see how the lending is performing, and control the rules from settings.

**Effort:** about 1 to 2 weeks.

### Build

- [ ] Nightly job with pg_cron and an Edge Function: accrue interest (if daily accrual is chosen), mark loans overdue, add late penalties per the settings, and refresh statistics.
- [ ] Collections page: overdue list with aging buckets, contact log, and promise-to-pay dates.
- [ ] "Due this week" list with reminder text staff can copy and send (sending SMS from the system can come later).
- [ ] Statistics dashboard as the landing screen after login (metrics and charts below).
- [ ] Reports with CSV and PDF export: portfolio, interest earned, aging, cash in and out.
- [ ] Settings page: rate, loan limits, penalty rules, income-ratio limit, staff accounts and roles.
- [ ] Audit log page with filters (who, what, when).
- [ ] Daily reconciliation view: ledger totals against bank and e-wallet records.

### Database

| Table or view | Key fields | Notes |
| --- | --- | --- |
| collection_notes | loan id, note, promise date, created by, created at | Contact log |
| Statistics views | Built from `ledger_entries` and `schedule_items` | Cached; refreshed after each payment and by the nightly job |

### Statistics metrics

| Metric | How it is calculated | What it tells you |
| --- | --- | --- |
| Active loans | Count of loans that are active or overdue | Size of the book |
| Outstanding principal | Sum of remaining principal on active loans | Money currently out |
| Disbursed (period) | Sum of disbursement entries | Lending volume |
| Collected (period) | Sum of confirmed payments | Cash in |
| Interest earned (period) | Interest portion of payments received in the period | Income, cash basis |
| Expected interest, next 30 days | Interest due on schedule items in the next 30 days | Income forecast |
| Collection rate | Collected on installments due ÷ total due in the period | Repayment health |
| Overdue amount and loans | Unpaid installments past their due date | Who to follow up |
| Aging buckets | Overdue loans by days late: 1-30, 31-60, 61-90, over 90 | Where collections effort goes |
| Portfolio at risk (30+ days) | Principal of loans more than 30 days late ÷ outstanding principal | Credit risk |
| Approval rate | Approved ÷ (approved + declined) | Underwriting pattern |
| Average time to decision | Request date to decision date | Service speed |
| Write-offs | Principal written off ÷ total disbursed | Losses |
| Repeat borrowers | Borrowers with 2 or more loans ÷ all borrowers | Customer loyalty |

**Charts:** disbursed versus collected per month (bars), interest earned per month (line), overdue amount by aging bucket (bars), due versus collected this month (progress bar), and a "due this week" list.

**Behavior:** filters for period, loan officer and status. Every number links to the filtered list behind it. Export to CSV or PDF. All figures come from the ledger and schedule so they always match the reports.

### Pages

| Route | Purpose |
| --- | --- |
| `/dashboard` | Statistics and what needs attention today |
| `/collections` | Overdue list, contact log, promise-to-pay notes |
| `/reports` | Portfolio, interest earned, aging, cash flow, export |
| `/settings` | Rate, limits, penalties, staff accounts |
| `/audit-log` | Who did what and when |

### shadcn components

card, chart (Recharts), progress, select, tabs, data table, sheet, dialog, switch, badge, calendar with popover, dropdown-menu.

### Tests

- The nightly job marks the right loans overdue and applies the penalty once per period (running it twice changes nothing).
- Every dashboard figure equals the same figure computed directly from the ledger.
- CSV exports match the on-screen totals.

### Done when

- [ ] Overdue loans are flagged automatically each night.
- [ ] Statistics match the ledger and the reports.
- [ ] Changing the rate or penalty in Settings affects only new loans or new periods, as designed, and is recorded in the audit log.

---

## Security and risk controls (build into every phase)

- Check the user's role on the server in every Server Action, in addition to middleware and Row Level Security.
- Require 2-step sign-in for staff, and rate-limit login attempts.
- Encrypt sensitive fields (ID numbers) at rest, and keep documents in a private bucket with signed links.
- Every money change writes a ledger entry and an audit log entry. Ledger rows are never edited, only reversed by a new entry.
- Keep secrets in environment variables. Never expose the Supabase service role key to the browser.
- **Legal:** rules differ by country, so confirm with a lawyer before launch. If you operate in the Philippines, check at least: lending company registration with the SEC, any ceiling on monthly interest and penalties for your loan type, disclosure of finance charges under the Truth in Lending Act, the Data Privacy Act for borrower data, and fair debt-collection rules.

## Folder structure

```text
lending-admin/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (admin)/
│  │  ├─ layout.tsx               # sidebar + top bar, role guard
│  │  ├─ dashboard/page.tsx       # statistics
│  │  ├─ applications/            # list + [id] review page
│  │  ├─ borrowers/               # list + [id] profile and documents
│  │  ├─ loans/                   # list + [id] schedule, ledger, payoff
│  │  ├─ payments/                # list + record payment
│  │  ├─ collections/page.tsx
│  │  ├─ reports/page.tsx
│  │  ├─ calculator/page.tsx
│  │  ├─ settings/page.tsx
│  │  └─ audit-log/page.tsx
│  └─ layout.tsx
├─ components/
│  ├─ ui/                         # shadcn components (generated)
│  ├─ admin/                      # data tables, review panel, stat cards, charts
│  └─ forms/
├─ lib/
│  ├─ loan/                       # interest, schedule, allocation (pure functions)
│  ├─ services/                   # applications, loans, payments, reports
│  ├─ supabase/                   # browser, server and middleware clients
│  ├─ validation/                 # zod schemas
│  └─ utils/                      # money formatting, dates
├─ supabase/
│  ├─ migrations/                 # tables, policies, functions
│  ├─ functions/                  # edge functions (nightly job)
│  └─ seed.sql
├─ tests/                         # unit (loan engine) and e2e
├─ middleware.ts                  # session refresh and route protection
└─ .env.example
```

## Go-live checklist (after Phase 4)

- [ ] Enter a few real loans in parallel with your current records, and compare balances for two weeks.
- [ ] Run a restore from a Supabase backup on staging (check your plan's backup options first).
- [ ] Confirm legal and compliance items with a lawyer.
- [ ] Turn on 2-step sign-in for every staff account and remove unused accounts.
- [ ] Set up monitoring: Sentry for errors, and an alert if the nightly job does not run.
- [ ] Run migrations on production by approval, never from a laptop.
