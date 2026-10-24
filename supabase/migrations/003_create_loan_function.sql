-- Function to create a loan with schedule
CREATE OR REPLACE FUNCTION create_loan(
  p_application_id UUID,
  p_borrower_id UUID,
  p_principal NUMERIC,
  p_monthly_rate NUMERIC,
  p_term_months INTEGER,
  p_repayment_style TEXT
)
RETURNS UUID AS $$
DECLARE
  v_loan_id UUID;
  v_start_date DATE := CURRENT_DATE;
  v_balance NUMERIC := p_principal;
  v_r NUMERIC := p_monthly_rate;
  v_n INTEGER := p_term_months;
  v_pmt NUMERIC;
  v_principal_due NUMERIC;
  v_interest_due NUMERIC;
  v_maturity_date DATE;
BEGIN
  -- Create the loan
  INSERT INTO loans (
    application_id,
    borrower_id,
    principal,
    monthly_rate,
    term_months,
    repayment_style,
    maturity_date,
    status
  ) VALUES (
    p_application_id,
    p_borrower_id,
    p_principal,
    p_monthly_rate,
    p_term_months,
    p_repayment_style,
    v_start_date + (p_term_months || ' months')::INTERVAL,
    'pending_disbursement'
  ) RETURNING id INTO v_loan_id;

  -- Calculate maturity date
  v_maturity_date := v_start_date + (p_term_months || ' months')::INTERVAL;

  -- Generate schedule items
  IF p_repayment_style = 'EQUAL_PRINCIPAL' THEN
    -- Equal principal: principal portion is constant
    v_principal_due := p_principal / p_term_months;

    FOR i IN 1..p_term_months LOOP
      v_interest_due := ROUND(v_r * v_balance, 2);

      INSERT INTO schedule_items (
        loan_id,
        installment_no,
        due_date,
        principal_due,
        interest_due,
        principal_paid,
        interest_paid,
        status
      ) VALUES (
        v_loan_id,
        i,
        v_start_date + (i || ' months')::INTERVAL,
        v_principal_due,
        v_interest_due,
        0,
        0,
        'pending'
      );

      v_balance := v_balance - v_principal_due;
    END LOOP;

  ELSE
    -- Equal payment (amortized)
    v_pmt := ROUND(p_principal * v_r / (1 - POWER(1 + v_r, -v_n)), 2);

    FOR i IN 1..p_term_months LOOP
      v_interest_due := ROUND(v_r * v_balance, 2);
      v_principal_due := v_pmt - v_interest_due;

      INSERT INTO schedule_items (
        loan_id,
        installment_no,
        due_date,
        principal_due,
        interest_due,
        principal_paid,
        interest_paid,
        status
      ) VALUES (
        v_loan_id,
        i,
        v_start_date + (i || ' months')::INTERVAL,
        v_principal_due,
        v_interest_due,
        0,
        0,
        'pending'
      );

      v_balance := v_balance - v_principal_due;
    END LOOP;
  END IF;

  RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql;
