import Decimal from "decimal.js"

export type RepaymentStyle = "EQUAL_PRINCIPAL" | "EQUAL_PAYMENT"

export interface ScheduleItem {
  installmentNo: number
  dueDate: Date
  principalDue: Decimal
  interestDue: Decimal
  totalDue: Decimal
  principalPaid: Decimal
  interestPaid: Decimal
  balanceAfter: Decimal
  status: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE"
}

export interface LoanState {
  principal: Decimal
  rate: Decimal
  termMonths: number
  repaymentStyle: RepaymentStyle
  startDate: Date
  balance: Decimal
  accruedInterest: Decimal
  penalties: Decimal
  schedule: ScheduleItem[]
}

export interface Allocation {
  penaltyAmount: Decimal
  interestAmount: Decimal
  principalAmount: Decimal
  balanceAfter: Decimal
  ledgerEntries: LedgerEntry[]
}

export interface LedgerEntry {
  type: "DISBURSEMENT" | "INTEREST" | "PRINCIPAL" | "PENALTY" | "FEE" | "ADJUSTMENT"
  amount: Decimal
  balanceAfter: Decimal
  paymentId?: string
  createdAt: Date
}
