-- Statistics views for dashboard metrics

-- View: Active loans count
CREATE OR REPLACE VIEW v_active_loans AS
SELECT COUNT(*) as count
FROM loans
WHERE status IN ('active', 'overdue');

-- View: Outstanding principal
CREATE OR REPLACE VIEW v_outstanding_principal AS
SELECT COALESCE(SUM(balance_after), 0) as total
FROM (
  SELECT DISTINCT ON (loan_id) balance_after
  FROM ledger_entries
  ORDER BY loan_id, created_at DESC
) latest_balances
WHERE balance_after > 0;

-- View: Overdue loans
CREATE OR REPLACE VIEW v_overdue_loans AS
SELECT
  COUNT(*) as count,
  COALESCE(SUM(balance_after), 0) as total_amount
FROM loans l
JOIN (
  SELECT DISTINCT ON (loan_id) loan_id, balance_after
  FROM ledger_entries
  ORDER BY loan_id, created_at DESC
) le ON l.id = le.loan_id
JOIN schedule_items si ON l.id = si.loan_id
WHERE l.status = 'overdue'
AND si.due_date < CURRENT_DATE
AND si.status != 'paid';

-- View: Aging buckets for overdue loans
CREATE OR REPLACE VIEW v_aging_buckets AS
SELECT
  CASE
    WHEN days_late BETWEEN 1 AND 30 THEN '1-30 days'
    WHEN days_late BETWEEN 31 AND 60 THEN '31-60 days'
    WHEN days_late BETWEEN 61 AND 90 THEN '61-90 days'
    WHEN days_late > 90 THEN 'Over 90 days'
  END as bucket,
  COUNT(*) as loan_count,
  COALESCE(SUM(balance_after), 0) as total_amount
FROM (
  SELECT
    l.id,
    le.balance_after,
    (CURRENT_DATE - MIN(si.due_date))::INTEGER as days_late
  FROM loans l
  JOIN (
    SELECT DISTINCT ON (loan_id) loan_id, balance_after
    FROM ledger_entries
    ORDER BY loan_id, created_at DESC
  ) le ON l.id = le.loan_id
  JOIN schedule_items si ON l.id = si.loan_id
  WHERE l.status = 'overdue'
  AND si.due_date < CURRENT_DATE
  AND si.status != 'paid'
  GROUP BY l.id, le.balance_after
) overdue_loans
GROUP BY bucket
ORDER BY MIN(days_late);

-- View: Portfolio at risk (30+ days overdue)
CREATE OR REPLACE VIEW v_portfolio_at_risk AS
SELECT
  COALESCE(
    (SELECT COALESCE(SUM(balance_after), 0)
     FROM (
       SELECT DISTINCT ON (loan_id) loan_id, balance_after
       FROM ledger_entries
       ORDER BY loan_id, created_at DESC
     ) le
     JOIN loans l ON le.loan_id = l.id
     JOIN schedule_items si ON l.id = si.loan_id
     WHERE l.status = 'overdue'
     AND si.due_date < CURRENT_DATE - INTERVAL '30 days'
     AND si.status != 'paid'
    ) / NULLIF(
      (SELECT COALESCE(SUM(balance_after), 0)
       FROM (
         SELECT DISTINCT ON (loan_id) loan_id, balance_after
         FROM ledger_entries
         ORDER BY loan_id, created_at DESC
       ) latest_balances
       WHERE balance_after > 0
      ), 0
    ) * 100, 0
  ) as percentage;

-- View: Pending applications count
CREATE OR REPLACE VIEW v_pending_applications AS
SELECT COUNT(*) as count
FROM applications
WHERE status IN ('draft', 'in_review');

-- View: Disbursed amount (current month)
CREATE OR REPLACE VIEW v_disbursed_month AS
SELECT COALESCE(SUM(amount), 0) as total
FROM ledger_entries
WHERE type = 'disbursement'
AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

-- View: Collected amount (current month)
CREATE OR REPLACE VIEW v_collected_month AS
SELECT COALESCE(SUM(amount), 0) as total
FROM ledger_entries
WHERE type = 'principal'
AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

-- View: Interest earned (current month)
CREATE OR REPLACE VIEW v_interest_earned_month AS
SELECT COALESCE(SUM(amount), 0) as total
FROM ledger_entries
WHERE type = 'interest'
AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

-- View: Expected interest next 30 days
CREATE OR REPLACE VIEW v_expected_interest_30days AS
SELECT COALESCE(SUM(interest_due - interest_paid), 0) as total
FROM schedule_items
WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
AND status != 'paid';

-- View: Approval rate
CREATE OR REPLACE VIEW v_approval_rate AS
SELECT
  COALESCE(
    (SELECT COUNT(*) FROM applications WHERE status = 'approved')::NUMERIC /
    NULLIF(
      (SELECT COUNT(*) FROM applications WHERE status IN ('approved', 'declined')),
      0
    ) * 100, 0
  ) as percentage;

-- View: Write-offs
CREATE OR REPLACE VIEW v_write_offs AS
SELECT
  COALESCE(
    (SELECT COALESCE(SUM(principal), 0) FROM loans WHERE status = 'written_off') /
    NULLIF(
      (SELECT COALESCE(SUM(principal), 0) FROM loans),
      0
    ) * 100, 0
  ) as percentage;

-- View: Repeat borrowers
CREATE OR REPLACE VIEW v_repeat_borrowers AS
SELECT
  COALESCE(
    (SELECT COUNT(*)
     FROM (
       SELECT borrower_id
       FROM loans
       GROUP BY borrower_id
       HAVING COUNT(*) >= 2
     ) repeat_borrower_groups) /
    NULLIF(
      (SELECT COUNT(DISTINCT borrower_id) FROM loans),
      0
    ) * 100, 0
  ) as percentage;

-- View: Due this week
CREATE OR REPLACE VIEW v_due_this_week AS
SELECT
  l.id,
  l.principal,
  b.full_name as borrower_name,
  b.phone,
  si.installment_no,
  si.due_date,
  si.principal_due + si.interest_due as total_due,
  si.principal_paid + si.interest_paid as amount_paid
FROM loans l
JOIN borrowers b ON l.borrower_id = b.id
JOIN schedule_items si ON l.id = si.loan_id
WHERE l.status = 'active'
AND si.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
AND si.status != 'paid'
ORDER BY si.due_date;


-- Restrict dashboard aggregates to signed-in application users.
REVOKE ALL ON public.v_active_loans, public.v_outstanding_principal, public.v_overdue_loans, public.v_aging_buckets, public.v_portfolio_at_risk, public.v_pending_applications, public.v_disbursed_month, public.v_collected_month, public.v_interest_earned_month, public.v_expected_interest_30days, public.v_approval_rate, public.v_write_offs, public.v_repeat_borrowers, public.v_due_this_week FROM PUBLIC, anon;
GRANT SELECT ON public.v_active_loans, public.v_outstanding_principal, public.v_overdue_loans, public.v_aging_buckets, public.v_portfolio_at_risk, public.v_pending_applications, public.v_disbursed_month, public.v_collected_month, public.v_interest_earned_month, public.v_expected_interest_30days, public.v_approval_rate, public.v_write_offs, public.v_repeat_borrowers, public.v_due_this_week TO authenticated;

-- Refresh PostgREST after creating or replacing the views.
NOTIFY pgrst, 'reload schema';
