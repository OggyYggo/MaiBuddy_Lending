-- Count repeat borrowers as a single scalar result so the dashboard view
-- works when several borrowers have multiple loans.
CREATE OR REPLACE VIEW public.v_repeat_borrowers AS
SELECT
  COALESCE(
    (SELECT COUNT(*)
     FROM (
       SELECT borrower_id
       FROM public.loans
       GROUP BY borrower_id
       HAVING COUNT(*) >= 2
     ) repeat_borrower_groups) /
    NULLIF(
      (SELECT COUNT(DISTINCT borrower_id) FROM public.loans),
      0
    ) * 100,
    0
  ) AS percentage;

NOTIFY pgrst, 'reload schema';
