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

  IF v_borrowed_date IS NULL OR NEW.installment_no IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.due_date := (v_borrowed_date + MAKE_INTERVAL(months => NEW.installment_no))::DATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_application_schedule_due_date ON public.schedule_items;
CREATE TRIGGER set_application_schedule_due_date
BEFORE INSERT ON public.schedule_items
FOR EACH ROW EXECUTE FUNCTION public.set_application_schedule_due_date();

-- Correct schedules for loans that have not yet been disbursed. Posted loan
-- schedules remain unchanged so their historical due dates are preserved.
UPDATE public.schedule_items si
SET due_date = target.due_date
FROM (
  SELECT si2.id,
         (a.borrowed_date + MAKE_INTERVAL(months => si2.installment_no))::DATE AS due_date
  FROM public.schedule_items si2
  JOIN public.loans l ON l.id = si2.loan_id
  JOIN public.applications a ON a.id = l.application_id
  WHERE l.status = 'pending_disbursement'
) target
WHERE si.id = target.id;

NOTIFY pgrst, 'reload schema';
