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
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
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
      documents: {
        Row: {
          id: string
          borrower_id: string | null
          application_id: string | null
          type: string
          storage_path: string
          verified_by: string | null
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          borrower_id?: string | null
          application_id?: string | null
          type: string
          storage_path: string
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          borrower_id?: string | null
          application_id?: string | null
          type?: string
          storage_path?: string
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          borrower_id: string
          amount: number
          borrowed_date: string
          term_months: number
          purpose: string | null
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
          status: 'draft' | 'in_review' | 'approved' | 'declined' | 'withdrawn'
          decided_by: string | null
          decision_reason: string | null
          decision_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          custom_rate: number | null
          rate_override_reason: string | null
          submission_source: 'admin' | 'online'
          possible_duplicate: boolean
        }
        Insert: {
          id?: string
          borrower_id: string
          amount: number
          borrowed_date?: string
          term_months: number
          purpose?: string | null
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
          status?: 'draft' | 'in_review' | 'approved' | 'declined' | 'withdrawn'
          decided_by?: string | null
          decision_reason?: string | null
          decision_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          custom_rate?: number | null
          rate_override_reason?: string | null
          submission_source?: 'admin' | 'online'
          possible_duplicate?: boolean
        }
        Update: {
          id?: string
          borrower_id?: string
          amount?: number
          borrowed_date?: string
          term_months?: number
          purpose?: string | null
          repayment_style?: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
          status?: 'draft' | 'in_review' | 'approved' | 'declined' | 'withdrawn'
          decided_by?: string | null
          decision_reason?: string | null
          decision_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          custom_rate?: number | null
          rate_override_reason?: string | null
          submission_source?: 'admin' | 'online'
          possible_duplicate?: boolean
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
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
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
          repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
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
          repayment_style?: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
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
          payment_type: 'principal' | 'interest' | 'penalty'
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
          payment_type?: 'principal' | 'interest' | 'penalty'
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
          payment_type?: 'principal' | 'interest' | 'penalty'
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
      collection_notes: {
        Row: {
          id: string
          loan_id: string
          note: string
          promise_date: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          note: string
          promise_date?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          note?: string
          promise_date?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      submit_public_application: {
        Args: {
          p_full_name: string
          p_birth_date: string
          p_phone: string
          p_address: string
          p_employer: string | null
          p_monthly_income: number | null
          p_id_type: string | null
          p_id_number: string | null
          p_amount: number
          p_term_months: number
          p_purpose: string
          p_repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
          p_submission_fingerprint: string
        }
        Returns: { application_reference: string }[]
      }
      approve_application_and_create_loan: {
        Args: { p_application_id: string; p_monthly_rate: number }
        Returns: string
      }
      update_pending_application_and_loan: {
        Args: {
          p_application_id: string
          p_borrower_id: string
          p_amount: number
          p_borrowed_date: string
          p_term_months: number
          p_purpose: string | null
          p_repayment_style: 'EQUAL_PRINCIPAL' | 'EQUAL_PAYMENT' | 'LUMP_SUM'
          p_monthly_rate: number
          p_custom_rate: number | null
          p_rate_override_reason: string | null
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_payment_id: string
          p_loan_id: string
          p_amount: number
          p_received_at: string
        }
        Returns: undefined
      }
      record_loan_disbursement: {
        Args: { p_loan_id: string; p_disbursed_at: string }
        Returns: undefined
      }
    }
    Views: {
      v_active_loans: { Row: { count: number }; Relationships: [] }
      v_outstanding_principal: { Row: { total: number }; Relationships: [] }
      v_overdue_loans: { Row: { count: number; total_amount: number }; Relationships: [] }
      v_aging_buckets: {
        Row: { bucket: string | null; loan_count: number; total_amount: number }
        Relationships: []
      }
      v_portfolio_at_risk: { Row: { percentage: number }; Relationships: [] }
      v_pending_applications: { Row: { count: number }; Relationships: [] }
      v_disbursed_month: { Row: { total: number }; Relationships: [] }
      v_collected_month: { Row: { total: number }; Relationships: [] }
      v_interest_earned_month: { Row: { total: number }; Relationships: [] }
      v_expected_interest_30days: { Row: { total: number }; Relationships: [] }
      v_approval_rate: { Row: { percentage: number }; Relationships: [] }
      v_write_offs: { Row: { percentage: number }; Relationships: [] }
      v_repeat_borrowers: { Row: { percentage: number }; Relationships: [] }
      v_due_this_week: {
        Row: {
          id: string
          principal: number
          borrower_name: string
          phone: string
          installment_no: number
          due_date: string
          total_due: number
          amount_paid: number
        }
        Relationships: []
      }
    }
  }
}
