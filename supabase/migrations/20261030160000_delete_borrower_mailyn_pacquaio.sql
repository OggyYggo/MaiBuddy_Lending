-- Delete borrower "Mailyn Pacquaio" and all associated data
-- This migration performs a cascading deletion of:
-- - Loans and their dependent records (payments, penalties, schedule items, ledger entries, collection notes)
-- - Applications
-- - Documents
-- - The borrower record itself

DO $$
DECLARE
  v_borrower_id UUID;
  borrower_name TEXT := 'Mailyn Pacquiao';
BEGIN
  -- Find the borrower ID
  SELECT id INTO v_borrower_id
  FROM borrowers
  WHERE full_name = borrower_name;

  -- Check if borrower exists
  IF v_borrower_id IS NULL THEN
    RAISE NOTICE 'Borrower "%" not found. No records deleted.', borrower_name;
    RETURN;
  END IF;

  RAISE NOTICE 'Found borrower ID: % for "%"', v_borrower_id, borrower_name;

  -- Delete loans and their dependent records
  -- Note: payments, penalties_fees, schedule_items, ledger_entries, collection_notes
  -- have ON DELETE CASCADE, so deleting loans will automatically delete these

  DELETE FROM loans
  WHERE loans.borrower_id = v_borrower_id;

  RAISE NOTICE 'Deleted loans for borrower %', v_borrower_id;

  -- Delete applications (this must be done after loans since loans reference applications)
  DELETE FROM applications
  WHERE applications.borrower_id = v_borrower_id;

  RAISE NOTICE 'Deleted applications for borrower %', v_borrower_id;

  -- Delete documents (has ON DELETE CASCADE, but we delete explicitly for clarity)
  DELETE FROM documents
  WHERE documents.borrower_id = v_borrower_id;

  RAISE NOTICE 'Deleted documents for borrower %', v_borrower_id;

  -- Finally, delete the borrower record
  DELETE FROM borrowers
  WHERE borrowers.id = v_borrower_id;

  RAISE NOTICE 'Successfully deleted borrower "%" and all associated data', borrower_name;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting borrower "%" and associated data: %', borrower_name, SQLERRM;
END $$;
