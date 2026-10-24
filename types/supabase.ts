export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'admin' | 'loan_officer'
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          role: 'admin' | 'loan_officer'
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'admin' | 'loan_officer'
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          key: string
          value: string
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_by?: string | null
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity: string
          entity_id: string | null
          before_data: Json | null
          after_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity?: string
          entity_id?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
      }
      borrowers: {
        Row: {
          id: string
          full_name: string
          birth_date: string
          phone: string
          address: string
          employer: string | null
          monthly_income: number | null
          id_type: string | null
          id_number: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          birth_date: string
          phone: string
          address: string
          employer?: string | null
          monthly_income?: number | null
          id_type?: string | null
          id_number?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          birth_date?: string
          phone?: string
          address?: string
          employer?: string | null
          monthly_income?: number | null
          id_type?: string | null
          id_number?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          borrower_id: string
          amount: number
          term_months: number
          purpose: string | null
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'
          status: 'draft' | 'in_review' | 'approved' | 'declined' | 'withdrawn'
          decided_by: string | null
          decision_reason: string | null
          decision_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          borrower_id: string
          amount: number
          term_months: number
          purpose?: string | null
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'
          status?: 'draft' | 'in_review' | 'approved' | 'declined' | 'withdrawn'
          decided_by?: string | null
          decision_reason?: string | null
          decision_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          borrower_id?: string
          amount?: number
          term_months?: number
          purpose?: string | null
          repayment_style?: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'
          status?: 'draft' | 'in_review' | 'approved' | 'declined' | 'withdrawn'
          decided_by?: string | null
          decision_reason?: string | null
          decision_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loans: {
        Row: {
          id: string
          application_id: string | null
          borrower_id: string
          principal: number
          monthly_rate: number
          term_months: number
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'
          disbursed_at: string | null
          maturity_date: string | null
          status: 'pending_disbursement' | 'active' | 'overdue' | 'paid' | 'written_off'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id?: string | null
          borrower_id: string
          principal: number
          monthly_rate: number
          term_months: number
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'
          disbursed_at?: string | null
          maturity_date?: string | null
          status?: 'pending_disbursement' | 'active' | 'overdue' | 'paid' | 'written_off'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string | null
          borrower_id?: string
          principal?: number
          monthly_rate?: number
          term_months?: number
          repayment_style?: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT'
          disbursed_at?: string | null
          maturity_date?: string | null
          status?: 'pending_disbursement' | 'active' | 'overdue' | 'paid' | 'written_off'
          created_at?: string
          updated_at?: string
        }
      }
      schedule_items: {
        Row: {
          id: string
          loan_id: string
          installment_no: number
          due_date: string
          principal_due: number
          interest_due: number
          principal_paid: number
          interest_paid: number
          status: 'pending' | 'paid' | 'partial' | 'overdue'
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          installment_no: number
          due_date: string
          principal_due: number
          interest_due: number
          principal_paid?: number
          interest_paid?: number
          status?: 'pending' | 'paid' | 'partial' | 'overdue'
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          installment_no?: number
          due_date?: string
          principal_due?: number
          interest_due?: number
          principal_paid?: number
          interest_paid?: number
          status?: 'pending' | 'paid' | 'partial' | 'overdue'
          created_at?: string
        }
      }
      ledger_entries: {
        Row: {
          id: string
          loan_id: string
          type: 'disbursement' | 'interest' | 'principal' | 'penalty' | 'fee' | 'adjustment'
          amount: number
          balance_after: number
          payment_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          type: 'disbursement' | 'interest' | 'principal' | 'penalty' | 'fee' | 'adjustment'
          amount: number
          balance_after: number
          payment_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          type?: 'disbursement' | 'interest' | 'principal' | 'penalty' | 'fee' | 'adjustment'
          amount?: number
          balance_after?: number
          payment_id?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          loan_id: string
          amount: number
          method: 'cash' | 'bank' | 'e_wallet' | 'check'
          reference: string | null
          proof_file: string | null
          status: 'pending' | 'confirmed' | 'rejected'
          received_at: string
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          amount: number
          method: 'cash' | 'bank' | 'e_wallet' | 'check'
          reference?: string | null
          proof_file?: string | null
          status?: 'pending' | 'confirmed' | 'rejected'
          received_at: string
          recorded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          amount?: number
          method?: 'cash' | 'bank' | 'e_wallet' | 'check'
          reference?: string | null
          proof_file?: string | null
          status?: 'pending' | 'confirmed' | 'rejected'
          received_at?: string
          recorded_by?: string | null
          created_at?: string
        }
      }
      penalties_fees: {
        Row: {
          id: string
          loan_id: string
          kind: 'late_payment' | 'processing_fee' | 'early_payoff_fee' | 'other'
          amount: number
          reason: string | null
          waived_by: string | null
          waived_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          kind: 'late_payment' | 'processing_fee' | 'early_payoff_fee' | 'other'
          amount: number
          reason?: string | null
          waived_by?: string | null
          waived_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          kind?: 'late_payment' | 'processing_fee' | 'early_payoff_fee' | 'other'
          amount?: number
          reason?: string | null
          waived_by?: string | null
          waived_at?: string | null
          created_at?: string
        }
      }
    }
  }
}
