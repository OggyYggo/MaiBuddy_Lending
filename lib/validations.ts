import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const borrowerSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  birth_date: z.string().min(1, "Birth date is required"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  employer: z.string().optional(),
  monthly_income: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  notes: z.string().optional(),
})

export type BorrowerInput = z.infer<typeof borrowerSchema>

export const applicationSchema = z.object({
  borrower_id: z.string().uuid("Invalid borrower ID"),
  amount: z.string().min(1, "Amount is required"),
  term_months: z.string().min(1, "Term is required"),
  purpose: z.string().optional(),
  repayment_style: z.enum(["EQUAL_PRINCIPAL", "EQUAL_PAYMENT"]),
})

export type ApplicationInput = z.infer<typeof applicationSchema>

export const publicLoanApplicationSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the applicant’s full name').max(150),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid birth date').refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Enter a valid birth date').refine((value) => value < new Date().toISOString().slice(0, 10), 'Applicant must be born before today'),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(24).regex(/^[0-9+().\-\s]+$/, 'Enter a valid phone number').refine((value) => value.replace(/\D/g, '').length >= 7, 'Enter a valid phone number'),
  address: z.string().trim().min(5, 'Enter a complete address').max(300),
  employer: z.string().trim().max(150).nullable().optional(),
  monthly_income: z.number().finite().min(0).max(999999999999.99).nullable().optional(),
  id_type: z.string().trim().max(80).nullable().optional(),
  id_number: z.string().trim().max(100).nullable().optional(),
  amount: z.number().finite().positive().max(999999999999.99),
  term_months: z.number().int().min(1).max(120),
  purpose: z.string().trim().min(3, 'Tell us what the loan is for').max(500),
  repayment_style: z.enum(['EQUAL_PRINCIPAL', 'EQUAL_PAYMENT']),
  consent: z.literal(true, 'Consent is required to submit an application'),
})

export type PublicLoanApplicationInput = z.infer<typeof publicLoanApplicationSchema>
