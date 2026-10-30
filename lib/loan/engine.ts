import Decimal from "decimal.js"
import type { RepaymentStyle, ScheduleItem, LoanState, Allocation, LedgerEntry } from "./types"

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export interface GenerateScheduleInput {
  principal: Decimal
  rate: Decimal
  months: number
  style: RepaymentStyle
  startDate: Date
}

export function generateSchedule(input: GenerateScheduleInput): ScheduleItem[] {
  const { principal, rate, months, style, startDate } = input
  const schedule: ScheduleItem[] = []
  let balance = principal

  if (style === "LUMP_SUM") {
    const dueDate = new Date(startDate)
    const dueDay = dueDate.getDate()
    dueDate.setDate(1)
    dueDate.setMonth(dueDate.getMonth() + months)
    const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
    dueDate.setDate(Math.min(dueDay, lastDay))
    const interest = rate.mul(principal).mul(months).toDecimalPlaces(2)

    return [{
      installmentNo: 1,
      dueDate,
      principalDue: principal.toDecimalPlaces(2),
      interestDue: interest,
      totalDue: principal.add(interest).toDecimalPlaces(2),
      principalPaid: new Decimal(0),
      interestPaid: new Decimal(0),
      balanceAfter: new Decimal(0),
      status: "PENDING",
    }]
  }

  for (let i = 0; i < months; i++) {
    const dueMonth = new Date(startDate)
    const dueDay = dueMonth.getDate()
    dueMonth.setDate(1)
    dueMonth.setMonth(dueMonth.getMonth() + i + 1)
    const lastDayOfDueMonth = new Date(
      dueMonth.getFullYear(),
      dueMonth.getMonth() + 1,
      0,
    ).getDate()
    dueMonth.setDate(Math.min(dueDay, lastDayOfDueMonth))

    const interest = rate.mul(balance)
    let principalDue: Decimal
    let totalDue: Decimal

    if (style === "EQUAL_PRINCIPAL") {
      principalDue = principal.div(months)
      totalDue = principalDue.add(interest)
    } else if (rate.isZero()) {
      principalDue = principal.div(months)
      totalDue = principalDue
    } else {
      const r = rate
      const n = months
      const pmt = principal.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)))
      principalDue = pmt.sub(interest)
      totalDue = pmt
    }

    schedule.push({
      installmentNo: i + 1,
      dueDate: dueMonth,
      principalDue: principalDue.toDecimalPlaces(2),
      interestDue: interest.toDecimalPlaces(2),
      totalDue: totalDue.toDecimalPlaces(2),
      principalPaid: new Decimal(0),
      interestPaid: new Decimal(0),
      balanceAfter: balance.sub(principalDue).toDecimalPlaces(2),
      status: "PENDING",
    })

    balance = balance.sub(principalDue)
  }

  return schedule
}

export function accrueInterest(loan: LoanState, asOf: Date): Decimal {
  const interest = loan.rate.mul(loan.balance)
  return interest.toDecimalPlaces(2)
}

export function allocatePayment(
  loan: LoanState,
  amount: Decimal,
  paidAt: Date
): Allocation {
  const ledgerEntries: LedgerEntry[] = []
  let remaining = amount
  let balance = loan.balance

  const penaltyAmount = Decimal.min(remaining, loan.penalties)
  if (penaltyAmount.gt(0)) {
    ledgerEntries.push({
      type: "PENALTY",
      amount: penaltyAmount,
      balanceAfter: balance,
      createdAt: paidAt,
    })
    remaining = remaining.sub(penaltyAmount)
  }

  const interestAmount = Decimal.min(remaining, loan.accruedInterest)
  if (interestAmount.gt(0)) {
    ledgerEntries.push({
      type: "INTEREST",
      amount: interestAmount,
      balanceAfter: balance,
      createdAt: paidAt,
    })
    remaining = remaining.sub(interestAmount)
  }

  const principalAmount = Decimal.min(remaining, balance)
  if (principalAmount.gt(0)) {
    balance = balance.sub(principalAmount)
    ledgerEntries.push({
      type: "PRINCIPAL",
      amount: principalAmount,
      balanceAfter: balance,
      createdAt: paidAt,
    })
  }

  return {
    penaltyAmount,
    interestAmount,
    principalAmount,
    balanceAfter: balance,
    ledgerEntries,
  }
}

export function payoffQuote(loan: LoanState, asOf: Date): Decimal {
  const interest = accrueInterest(loan, asOf)
  return loan.balance.add(interest).add(loan.penalties).toDecimalPlaces(2)
}

export function regenerateSchedule(loan: LoanState, fromDate: Date): ScheduleItem[] {
  const schedule = [...loan.schedule]
  const fromIndex = schedule.findIndex((item) => item.dueDate >= fromDate)

  if (fromIndex === -1) return schedule

  if (loan.repaymentStyle === "LUMP_SUM") {
    const item = schedule[fromIndex]
    const interest = loan.rate.mul(loan.principal).mul(loan.termMonths).toDecimalPlaces(2)
    schedule[fromIndex] = {
      ...item,
      principalDue: loan.principal.toDecimalPlaces(2),
      interestDue: interest,
      totalDue: loan.principal.add(interest).toDecimalPlaces(2),
      balanceAfter: new Decimal(0),
    }
    return schedule
  }

  let balance = loan.balance
  for (let i = fromIndex; i < schedule.length; i++) {
    const item = schedule[i]
    const interest = loan.rate.mul(balance)
    let principalDue: Decimal
    let totalDue: Decimal

    if (loan.repaymentStyle === "EQUAL_PRINCIPAL") {
      principalDue = loan.principal.div(loan.termMonths)
      totalDue = principalDue.add(interest)
    } else if (loan.rate.isZero()) {
      principalDue = loan.principal.div(loan.termMonths)
      totalDue = principalDue
    } else {
      const r = loan.rate
      const n = loan.termMonths
      const pmt = loan.principal.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)))
      principalDue = pmt.sub(interest)
      totalDue = pmt
    }

    schedule[i] = {
      ...item,
      principalDue: principalDue.toDecimalPlaces(2),
      interestDue: interest.toDecimalPlaces(2),
      totalDue: totalDue.toDecimalPlaces(2),
      balanceAfter: balance.sub(principalDue).toDecimalPlaces(2),
    }

    balance = balance.sub(principalDue)
  }

  return schedule
}
