-- Optional, idempotent demo data for populating the dashboard and related
-- borrower, loan, payment, and collection screens. All records are labeled
-- SAMPLE and use fictional contact details.
-- Run manually in Supabase SQL Editor. Do not use as production customer data.

BEGIN;

-- The collection-notes migration may not have been applied to this project.
CREATE TABLE IF NOT EXISTS public.collection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  promise_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_notes_loan
  ON public.collection_notes(loan_id);
CREATE INDEX IF NOT EXISTS idx_collection_notes_created_at
  ON public.collection_notes(created_at);

ALTER TABLE public.collection_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collection_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.collection_notes TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_notes'
      AND policyname = 'Collection notes are viewable by authenticated users'
  ) THEN
    CREATE POLICY "Collection notes are viewable by authenticated users"
      ON public.collection_notes FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_notes'
      AND policyname = 'Collection notes are insertable by authenticated users'
  ) THEN
    CREATE POLICY "Collection notes are insertable by authenticated users"
      ON public.collection_notes FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_notes'
      AND policyname = 'Collection notes are updatable by authenticated users'
  ) THEN
    CREATE POLICY "Collection notes are updatable by authenticated users"
      ON public.collection_notes FOR UPDATE
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

INSERT INTO public.borrowers (
  id, full_name, birth_date, phone, address, employer, monthly_income,
  id_type, id_number, notes
) VALUES (
  '11000000-0000-4000-8000-000000000001', 'SAMPLE - Maria Demo',
  DATE '1990-01-15', 'DEMO-PHONE-001', 'DEMO ADDRESS ONLY', 'SAMPLE EMPLOYER',
  35000, 'SAMPLE', 'DEMO-ID-001', 'SAMPLE DATA - safe to remove'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  notes = EXCLUDED.notes;

INSERT INTO public.applications (
  id, borrower_id, amount, term_months, purpose, repayment_style, status,
  decision_reason, decision_at, created_at
) VALUES
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 5000, 6, 'SAMPLE - pending review', 'EQUAL_PRINCIPAL', 'in_review', NULL, NULL, now()),
  ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 10000, 12, 'SAMPLE - active loan', 'EQUAL_PRINCIPAL', 'approved', 'SAMPLE - approved', now(), now()),
  ('21000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', 6000, 12, 'SAMPLE - overdue loan', 'EQUAL_PRINCIPAL', 'approved', 'SAMPLE - approved', now(), now()),
  ('21000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000001', 3000, 6, 'SAMPLE - declined application', 'EQUAL_PAYMENT', 'declined', 'SAMPLE - declined', now(), now()),
  ('21000000-0000-4000-8000-000000000005', '11000000-0000-4000-8000-000000000001', 2500, 6, 'SAMPLE - written off loan', 'EQUAL_PRINCIPAL', 'approved', 'SAMPLE - approved', now(), now())
ON CONFLICT (id) DO UPDATE SET
  borrower_id = EXCLUDED.borrower_id,
  amount = EXCLUDED.amount,
  term_months = EXCLUDED.term_months,
  purpose = EXCLUDED.purpose,
  repayment_style = EXCLUDED.repayment_style,
  status = EXCLUDED.status,
  decision_reason = EXCLUDED.decision_reason,
  decision_at = EXCLUDED.decision_at;

INSERT INTO public.loans (
  id, application_id, borrower_id, principal, monthly_rate, term_months,
  repayment_style, disbursed_at, maturity_date, status
) VALUES
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 10000, 0.0300, 12, 'EQUAL_PRINCIPAL', now() - interval '1 day', (CURRENT_DATE + interval '11 months')::date, 'active'),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', 6000, 0.0300, 12, 'EQUAL_PRINCIPAL', now() - interval '60 days', (CURRENT_DATE + interval '10 months')::date, 'overdue'),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000005', '11000000-0000-4000-8000-000000000001', 2500, 0.0300, 6, 'EQUAL_PRINCIPAL', now() - interval '100 days', (CURRENT_DATE - interval '1 month')::date, 'written_off')
ON CONFLICT (id) DO UPDATE SET
  application_id = EXCLUDED.application_id,
  borrower_id = EXCLUDED.borrower_id,
  principal = EXCLUDED.principal,
  monthly_rate = EXCLUDED.monthly_rate,
  term_months = EXCLUDED.term_months,
  repayment_style = EXCLUDED.repayment_style,
  disbursed_at = EXCLUDED.disbursed_at,
  maturity_date = EXCLUDED.maturity_date,
  status = EXCLUDED.status;

INSERT INTO public.schedule_items (
  id, loan_id, installment_no, due_date, principal_due, interest_due,
  principal_paid, interest_paid, status
) VALUES
  ('41000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 1, CURRENT_DATE + 3, 833.33, 300, 0, 0, 'pending'),
  ('41000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 2, CURRENT_DATE + 20, 833.33, 275, 0, 0, 'pending'),
  ('41000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000002', 1, CURRENT_DATE - 45, 500, 150, 0, 0, 'overdue')
ON CONFLICT (id) DO UPDATE SET
  due_date = EXCLUDED.due_date,
  principal_due = EXCLUDED.principal_due,
  interest_due = EXCLUDED.interest_due,
  principal_paid = EXCLUDED.principal_paid,
  interest_paid = EXCLUDED.interest_paid,
  status = EXCLUDED.status;

INSERT INTO public.payments (
  id, loan_id, amount, method, reference, status, received_at, created_at
) VALUES
  ('51000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 2300, 'cash', 'SAMPLE-DEMO-PAYMENT-001', 'confirmed', now(), now()),
  ('51000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', 2000, 'bank', 'SAMPLE-DEMO-PAYMENT-002', 'confirmed', now() - interval '50 days', now() - interval '50 days')
ON CONFLICT (id) DO UPDATE SET
  loan_id = EXCLUDED.loan_id,
  amount = EXCLUDED.amount,
  method = EXCLUDED.method,
  reference = EXCLUDED.reference,
  status = EXCLUDED.status,
  received_at = EXCLUDED.received_at,
  created_at = EXCLUDED.created_at;

INSERT INTO public.ledger_entries (
  id, loan_id, type, amount, balance_after, payment_id, created_at
) VALUES
  ('61000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'disbursement', 10000, 10000, NULL, now() - interval '1 day'),
  ('61000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'principal', 2000, 8000, '51000000-0000-4000-8000-000000000001', now() - interval '1 hour'),
  ('61000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001', 'interest', 300, 8000, '51000000-0000-4000-8000-000000000001', now()),
  ('61000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000002', 'disbursement', 6000, 6000, NULL, now() - interval '60 days'),
  ('61000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000002', 'principal', 2000, 4000, '51000000-0000-4000-8000-000000000002', now() - interval '50 days'),
  ('61000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000003', 'disbursement', 2500, 2500, NULL, now() - interval '100 days'),
  ('61000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000003', 'adjustment', 2500, 0, NULL, now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  loan_id = EXCLUDED.loan_id,
  type = EXCLUDED.type,
  amount = EXCLUDED.amount,
  balance_after = EXCLUDED.balance_after,
  payment_id = EXCLUDED.payment_id,
  created_at = EXCLUDED.created_at;

INSERT INTO public.collection_notes (id, loan_id, note, promise_date, created_at)
VALUES (
  '71000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002',
  'SAMPLE DATA - borrower promised to pay; demo note only',
  CURRENT_DATE + 7,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  loan_id = EXCLUDED.loan_id,
  note = EXCLUDED.note,
  promise_date = EXCLUDED.promise_date,
  created_at = EXCLUDED.created_at;

COMMIT;
