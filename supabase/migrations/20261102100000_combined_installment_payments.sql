-- Allow one recorded payment to cover both parts of an installment while
-- keeping its principal and interest allocations separately auditable.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_type_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_check
    CHECK (payment_type IN ('principal', 'interest', 'penalty', 'installment')),
  ADD COLUMN IF NOT EXISTS principal_allocated NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_allocated NUMERIC(14, 2) NOT NULL DEFAULT 0;

UPDATE public.payments AS payment
SET principal_allocated = COALESCE((
      SELECT SUM(entry.amount)
      FROM public.ledger_entries AS entry
      WHERE entry.payment_id = payment.id AND entry.type = 'principal'
    ), 0),
    interest_allocated = COALESCE((
      SELECT SUM(entry.amount)
      FROM public.ledger_entries AS entry
      WHERE entry.payment_id = payment.id AND entry.type = 'interest'
    ), 0);

CREATE OR REPLACE FUNCTION public.record_payment(
  p_payment_id UUID,
  p_loan_id UUID,
  p_amount NUMERIC,
  p_received_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_payment public.payments%ROWTYPE;
  v_allocated NUMERIC;
  v_principal_allocated NUMERIC := 0;
  v_interest_allocated NUMERIC := 0;
  v_schedule_id UUID;
  v_principal_remaining NUMERIC := 0;
  v_interest_remaining NUMERIC := 0;
  v_installment_remaining NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND loan_id = p_loan_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending payment not found for this loan';
  END IF;
  IF p_amount <> v_payment.amount THEN
    RAISE EXCEPTION 'Payment amount does not match the pending payment';
  END IF;

  SELECT principal INTO v_balance
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  v_balance := v_balance - COALESCE((
    SELECT SUM(amount)
    FROM public.ledger_entries
    WHERE loan_id = p_loan_id AND type = 'principal'
  ), 0);

  IF v_payment.payment_type = 'principal' THEN
    IF p_amount > v_balance THEN
      RAISE EXCEPTION 'Principal payment exceeds the remaining principal balance';
    END IF;
    v_allocated := p_amount;
    v_principal_allocated := p_amount;
    v_balance := v_balance - v_allocated;

    UPDATE public.schedule_items
    SET principal_paid = LEAST(principal_due, principal_paid + v_allocated),
        status = CASE
          WHEN LEAST(principal_due, principal_paid + v_allocated) >= principal_due
           AND interest_paid >= interest_due THEN 'paid'
          ELSE 'partial'
        END
    WHERE id = (
      SELECT id FROM public.schedule_items
      WHERE loan_id = p_loan_id AND status <> 'paid'
      ORDER BY due_date ASC, installment_no ASC
      LIMIT 1
    );
  ELSIF v_payment.payment_type = 'interest' THEN
    v_allocated := p_amount;
    v_interest_allocated := p_amount;
    UPDATE public.schedule_items
    SET interest_paid = LEAST(interest_due, interest_paid + v_allocated),
        status = CASE
          WHEN principal_paid >= principal_due
           AND LEAST(interest_due, interest_paid + v_allocated) >= interest_due THEN 'paid'
          ELSE 'partial'
        END
    WHERE id = (
      SELECT id FROM public.schedule_items
      WHERE loan_id = p_loan_id AND status <> 'paid'
      ORDER BY due_date ASC, installment_no ASC
      LIMIT 1
    );
  ELSIF v_payment.payment_type = 'installment' THEN
    SELECT id,
           GREATEST(principal_due - COALESCE(principal_paid, 0), 0),
           GREATEST(interest_due - COALESCE(interest_paid, 0), 0)
    INTO v_schedule_id, v_principal_remaining, v_interest_remaining
    FROM public.schedule_items
    WHERE loan_id = p_loan_id
      AND status <> 'paid'
      AND (COALESCE(principal_paid, 0) < principal_due OR COALESCE(interest_paid, 0) < interest_due)
    ORDER BY due_date ASC, installment_no ASC
    LIMIT 1
    FOR UPDATE;

    IF v_schedule_id IS NULL THEN
      RAISE EXCEPTION 'No unpaid installment is available for this payment';
    END IF;

    v_installment_remaining := v_principal_remaining + v_interest_remaining;
    IF p_amount > v_installment_remaining THEN
      RAISE EXCEPTION 'Installment payment exceeds the next installment balance of %', v_installment_remaining;
    END IF;

    -- Apply interest first, then principal. Any extra principal must be
    -- recorded as a separate principal payment rather than silently applied.
    v_interest_allocated := LEAST(p_amount, v_interest_remaining);
    v_principal_allocated := LEAST(
      p_amount - v_interest_allocated,
      v_principal_remaining
    );
    IF v_principal_allocated > v_balance THEN
      RAISE EXCEPTION 'Installment principal allocation exceeds the remaining loan principal';
    END IF;

    UPDATE public.schedule_items
    SET interest_paid = COALESCE(interest_paid, 0) + v_interest_allocated,
        principal_paid = COALESCE(principal_paid, 0) + v_principal_allocated,
        status = CASE
          WHEN COALESCE(interest_paid, 0) + v_interest_allocated >= interest_due
           AND COALESCE(principal_paid, 0) + v_principal_allocated >= principal_due THEN 'paid'
          ELSE 'partial'
        END
    WHERE id = v_schedule_id;
  ELSE
    v_allocated := p_amount;
  END IF;

  IF v_payment.payment_type = 'installment' THEN
    IF v_interest_allocated > 0 THEN
      INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
      VALUES (p_loan_id, 'interest', v_interest_allocated, v_balance, p_payment_id, p_received_at);
    END IF;
    IF v_principal_allocated > 0 THEN
      v_balance := v_balance - v_principal_allocated;
      INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
      VALUES (p_loan_id, 'principal', v_principal_allocated, v_balance, p_payment_id, p_received_at);
    END IF;
  ELSE
    INSERT INTO public.ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, v_payment.payment_type, v_allocated, v_balance, p_payment_id, p_received_at);
  END IF;

  IF v_payment.payment_type IN ('principal', 'installment') AND v_balance = 0 THEN
    UPDATE public.loans SET status = 'paid', updated_at = NOW() WHERE id = p_loan_id;
  END IF;

  UPDATE public.payments
  SET status = 'confirmed',
      principal_allocated = v_principal_allocated,
      interest_allocated = v_interest_allocated
  WHERE id = p_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, UUID, NUMERIC, TIMESTAMPTZ) TO authenticated;
NOTIFY pgrst, 'reload schema';
