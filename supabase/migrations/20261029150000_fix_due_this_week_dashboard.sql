CREATE OR REPLACE VIEW public.v_due_this_week AS
SELECT
  si.id,
  l.principal,
  b.full_name AS borrower_name,
  b.phone,
  si.installment_no,
  si.due_date,
  GREATEST(si.principal_due - COALESCE(si.principal_paid, 0), 0)
    + GREATEST(si.interest_due - COALESCE(si.interest_paid, 0), 0) AS total_due,
  COALESCE(si.principal_paid, 0) + COALESCE(si.interest_paid, 0) AS amount_paid
FROM public.loans AS l
JOIN public.borrowers AS b ON b.id = l.borrower_id
JOIN public.schedule_items AS si ON si.loan_id = l.id
WHERE l.status IN ('active', 'overdue')
  AND si.due_date >= CURRENT_DATE
  AND si.due_date < CURRENT_DATE + INTERVAL '7 days'
  AND si.status <> 'paid'
  AND (
    GREATEST(si.principal_due - COALESCE(si.principal_paid, 0), 0)
    + GREATEST(si.interest_due - COALESCE(si.interest_paid, 0), 0)
  ) > 0
ORDER BY si.due_date;

NOTIFY pgrst, 'reload schema';
