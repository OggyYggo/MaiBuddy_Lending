-- Keep the dashboard total consistent with the balance shown on each loan:
-- original principal less principal payments recorded in the ledger.
CREATE OR REPLACE VIEW public.v_outstanding_principal AS
SELECT COALESCE(
  SUM(GREATEST(l.principal - COALESCE(p.principal_paid, 0), 0)),
  0
) AS total
FROM public.loans l
LEFT JOIN (
  SELECT loan_id, SUM(amount) AS principal_paid
  FROM public.ledger_entries
  WHERE type = 'principal'
  GROUP BY loan_id
) p ON p.loan_id = l.id;

NOTIFY pgrst, 'reload schema';
