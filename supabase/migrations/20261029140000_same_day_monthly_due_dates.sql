CREATE OR REPLACE FUNCTION public.set_application_schedule_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_borrowed_date DATE;
BEGIN
  SELECT a.borrowed_date
  INTO v_borrowed_date
  FROM public.loans l
  JOIN public.applications a ON a.id = l.application_id
  WHERE l.id = NEW.loan_id;

  IF v_borrowed_date IS NOT NULL AND NEW.installment_no IS NOT NULL THEN
    NEW.due_date := (v_borrowed_date + MAKE_INTERVAL(months => NEW.installment_no))::DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_application_schedule_due_date ON public.schedule_items;
CREATE TRIGGER set_application_schedule_due_date
BEFORE INSERT ON public.schedule_items
FOR EACH ROW EXECUTE FUNCTION public.set_application_schedule_due_date();

-- Correct not-yet-disbursed schedules generated under the previous 30th-day rule.
UPDATE public.schedule_items si
SET due_date = (a.borrowed_date + MAKE_INTERVAL(months => si.installment_no))::DATE
FROM public.loans l
JOIN public.applications a ON a.id = l.application_id
WHERE si.loan_id = l.id
  AND l.status = 'pending_disbursement';

NOTIFY pgrst, 'reload schema';
