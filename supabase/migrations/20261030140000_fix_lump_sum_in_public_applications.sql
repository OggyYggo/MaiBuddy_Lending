-- Quick fix to add LUMP_SUM to the public application submission function
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.submit_public_application(text,date,text,text,text,numeric,text,text,numeric,integer,text,text,text)'::regprocedure
  ) INTO v_definition;
  v_definition := replace(
    v_definition,
    'p_repayment_style NOT IN (''EQUAL_PRINCIPAL'', ''EQUAL_PAYMENT'')',
    'p_repayment_style NOT IN (''EQUAL_PRINCIPAL'', ''EQUAL_PAYMENT'', ''LUMP_SUM'')'
  );
  EXECUTE v_definition;
END;
$$;

NOTIFY pgrst, 'reload schema';
