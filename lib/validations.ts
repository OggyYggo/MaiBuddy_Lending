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
