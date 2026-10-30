-- Drop all tables and views to start fresh
DROP VIEW IF EXISTS v_repeat_borrowers CASCADE;
DROP VIEW IF EXISTS v_write_offs CASCADE;
DROP VIEW IF EXISTS v_portfolio_at_risk CASCADE;
DROP VIEW IF EXISTS v_approval_rate CASCADE;
DROP VIEW IF EXISTS v_expected_interest_30days CASCADE;
DROP VIEW IF EXISTS v_interest_earned_month CASCADE;
DROP VIEW IF EXISTS v_collected_month CASCADE;
DROP VIEW IF EXISTS v_disbursed_month CASCADE;
DROP VIEW IF EXISTS v_pending_applications CASCADE;
DROP VIEW IF EXISTS v_overdue_loans CASCADE;
DROP VIEW IF EXISTS v_outstanding_principal CASCADE;
DROP VIEW IF EXISTS v_active_loans CASCADE;
DROP VIEW IF EXISTS v_due_this_week CASCADE;
DROP VIEW IF EXISTS v_aging_buckets CASCADE;

DROP TABLE IF EXISTS collection_notes CASCADE;
DROP TABLE IF EXISTS penalties_fees CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS borrowers CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
