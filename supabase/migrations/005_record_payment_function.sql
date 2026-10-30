-- Function to record a payment and allocate it
CREATE OR REPLACE FUNCTION record_payment(
  p_payment_id UUID,
  p_loan_id UUID,
  p_amount NUMERIC,
  p_received_at TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
  v_remaining NUMERIC := p_amount;
  v_balance NUMERIC;
  v_penalties NUMERIC := 0;
  v_accrued_interest NUMERIC := 0;
  v_payment_item RECORD;
BEGIN
  -- Get current loan balance and calculate penalties
  SELECT COALESCE(SUM(amount), 0) INTO v_penalties
  FROM penalties_fees
  WHERE loan_id = p_loan_id AND waived_at IS NULL;

  -- Calculate accrued interest (simplified - in production use actual calculation)
  SELECT COALESCE(SUM(interest_due - interest_paid), 0) INTO v_accrued_interest
  FROM schedule_items
  WHERE loan_id = p_loan_id AND due_date <= p_received_at AND status != 'paid';

  -- Get current balance from ledger
  SELECT balance_after INTO v_balance
  FROM ledger_entries
  WHERE loan_id = p_loan_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_balance IS NULL THEN
    -- If no ledger entries, start with principal
    SELECT principal INTO v_balance FROM loans WHERE id = p_loan_id;
  END IF;

  -- Allocate to penalties first
  IF v_penalties > 0 AND v_remaining > 0 THEN
    v_payment_item := (LEAST(v_remaining, v_penalties), 'penalty');
    INSERT INTO ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, 'penalty', v_payment_item.column1, v_balance, p_payment_id, p_received_at);
    v_remaining := v_remaining - v_payment_item.column1;
  END IF;

  -- Allocate to interest second
  IF v_accrued_interest > 0 AND v_remaining > 0 THEN
    v_payment_item := (LEAST(v_remaining, v_accrued_interest), 'interest');
    INSERT INTO ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, 'interest', v_payment_item.column1, v_balance, p_payment_id, p_received_at);
    v_remaining := v_remaining - v_payment_item.column1;
  END IF;

  -- Allocate to principal last
  IF v_remaining > 0 THEN
    v_payment_item := (LEAST(v_remaining, v_balance), 'principal');
    v_balance := v_balance - v_payment_item.column1;
    INSERT INTO ledger_entries (loan_id, type, amount, balance_after, payment_id, created_at)
    VALUES (p_loan_id, 'principal', v_payment_item.column1, v_balance, p_payment_id, p_received_at);

    -- Update schedule items
    UPDATE schedule_items
    SET
      principal_paid = principal_paid + (v_payment_item.column1 * principal_due / (principal_due + interest_due)),
      interest_paid = interest_paid + (v_payment_item.column1 * interest_due / (principal_due + interest_due)),
      status = CASE
        WHEN (principal_paid + (v_payment_item.column1 * principal_due / (principal_due + interest_due))) >= principal_due
        AND (interest_paid + (v_payment_item.column1 * interest_due / (principal_due + interest_due))) >= interest_due
        THEN 'paid'
        ELSE 'partial'
      END
    WHERE id = (
      SELECT id
      FROM schedule_items
      WHERE loan_id = p_loan_id AND status != 'paid'
      ORDER BY due_date ASC
      LIMIT 1
    );
  END IF;

  -- Update loan status if fully paid
  IF v_balance = 0 THEN
    UPDATE loans SET status = 'paid', updated_at = NOW() WHERE id = p_loan_id;
  END IF;

  -- Mark payment as confirmed
  UPDATE payments SET status = 'confirmed' WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql;
