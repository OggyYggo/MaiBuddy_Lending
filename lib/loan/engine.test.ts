import Decimal from "decimal.js"
import { generateSchedule, accrueInterest, allocatePayment, payoffQuote } from "./engine"
import type { LoanState } from "./types"

describe("Loan Engine", () => {
  describe("generateSchedule", () => {
    it("should generate equal principal schedule for ₱10,000 over 6 months at 5%", () => {
      const schedule = generateSchedule({
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        months: 6,
        style: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
      })

      expect(schedule).toHaveLength(6)

      expect(schedule[0].principalDue.toNumber()).toBeCloseTo(1667, 0)
      expect(schedule[0].interestDue.toNumber()).toBeCloseTo(500, 0)
      expect(schedule[0].totalDue.toNumber()).toBeCloseTo(2167, 0)

      expect(schedule[5].principalDue.toNumber()).toBeCloseTo(1667, 0)
      expect(schedule[5].interestDue.toNumber()).toBeCloseTo(83, 0)
      expect(schedule[5].totalDue.toNumber()).toBeCloseTo(1750, 0)

      const totalInterest = schedule.reduce((sum, item) => sum.add(item.interestDue), new Decimal(0))
      expect(totalInterest.toNumber()).toBeCloseTo(1750, 0)
    })

    it("should generate equal payment schedule for ₱10,000 over 6 months at 5%", () => {
      const schedule = generateSchedule({
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        months: 6,
        style: "EQUAL_PAYMENT",
        startDate: new Date("2026-01-01"),
      })

      expect(schedule).toHaveLength(6)

      expect(schedule[0].totalDue.toNumber()).toBeCloseTo(1970, 0)
      expect(schedule[5].totalDue.toNumber()).toBeCloseTo(1970, 0)

      const totalInterest = schedule.reduce((sum, item) => sum.add(item.interestDue), new Decimal(0))
      expect(totalInterest.toNumber()).toBeCloseTo(1820, 0)
    })

    it("should handle 1-month loan", () => {
      const schedule = generateSchedule({
        principal: new Decimal(5000),
        rate: new Decimal(0.05),
        months: 1,
        style: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
      })

      expect(schedule).toHaveLength(1)
      expect(schedule[0].principalDue.toNumber()).toBeCloseTo(5000, 0)
      expect(schedule[0].interestDue.toNumber()).toBeCloseTo(250, 0)
    })
  })

  describe("accrueInterest", () => {
    it("should calculate interest on remaining balance", () => {
      const loan: LoanState = {
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        termMonths: 6,
        repaymentStyle: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
        balance: new Decimal(8333.33),
        accruedInterest: new Decimal(0),
        penalties: new Decimal(0),
        schedule: [],
      }

      const interest = accrueInterest(loan, new Date("2026-02-01"))
      expect(interest.toNumber()).toBeCloseTo(417, 0)
    })
  })

  describe("allocatePayment", () => {
    it("should allocate payment in order: penalties, interest, principal", () => {
      const loan: LoanState = {
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        termMonths: 6,
        repaymentStyle: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
        balance: new Decimal(8333.33),
        accruedInterest: new Decimal(416.67),
        penalties: new Decimal(100),
        schedule: [],
      }

      const allocation = allocatePayment(loan, new Decimal(3000), new Date("2026-02-01"))

      expect(allocation.penaltyAmount.toNumber()).toBeCloseTo(100, 0)
      expect(allocation.interestAmount.toNumber()).toBeCloseTo(417, 0)
      expect(allocation.principalAmount.toNumber()).toBeCloseTo(2483, 0)
      expect(allocation.balanceAfter.toNumber()).toBeCloseTo(5850, 0)
      expect(allocation.ledgerEntries).toHaveLength(3)
    })

    it("should handle partial payment", () => {
      const loan: LoanState = {
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        termMonths: 6,
        repaymentStyle: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
        balance: new Decimal(8333.33),
        accruedInterest: new Decimal(416.67),
        penalties: new Decimal(0),
        schedule: [],
      }

      const allocation = allocatePayment(loan, new Decimal(500), new Date("2026-02-01"))

      expect(allocation.penaltyAmount.toNumber()).toBe(0)
      expect(allocation.interestAmount.toNumber()).toBeCloseTo(417, 0)
      expect(allocation.principalAmount.toNumber()).toBeCloseTo(83, 0)
      expect(allocation.balanceAfter.toNumber()).toBeCloseTo(8250, 0)
    })

    it("should handle early full payoff", () => {
      const loan: LoanState = {
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        termMonths: 6,
        repaymentStyle: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
        balance: new Decimal(5000),
        accruedInterest: new Decimal(250),
        penalties: new Decimal(0),
        schedule: [],
      }

      const allocation = allocatePayment(loan, new Decimal(5250), new Date("2026-03-01"))

      expect(allocation.principalAmount.toNumber()).toBeCloseTo(5000, 0)
      expect(allocation.balanceAfter.toNumber()).toBe(0)
    })
  })

  describe("payoffQuote", () => {
    it("should calculate payoff amount including accrued interest and penalties", () => {
      const loan: LoanState = {
        principal: new Decimal(10000),
        rate: new Decimal(0.05),
        termMonths: 6,
        repaymentStyle: "EQUAL_PRINCIPAL",
        startDate: new Date("2026-01-01"),
        balance: new Decimal(5000),
        accruedInterest: new Decimal(250),
        penalties: new Decimal(100),
        schedule: [],
      }

      const quote = payoffQuote(loan, new Date("2026-03-01"))
      expect(quote.toNumber()).toBeCloseTo(5350, 0)
    })
  })
})
