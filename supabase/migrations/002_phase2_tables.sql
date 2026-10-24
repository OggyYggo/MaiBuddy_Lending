-- Borrowers table
CREATE TABLE borrowers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  employer TEXT,
  monthly_income NUMERIC(14,2),
  id_type TEXT,
  id_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  application_id UUID,
  type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications table
CREATE TABLE applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  borrower_id UUID NOT NULL REFERENCES borrowers(id),
  amount NUMERIC(14,2) NOT NULL,
  term_months INTEGER NOT NULL,
  purpose TEXT,
  repayment_style TEXT NOT NULL CHECK (repayment_style IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'declined', 'withdrawn')),
  decided_by UUID REFERENCES profiles(id),
  decision_reason TEXT,
  decision_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loans table
CREATE TABLE loans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID REFERENCES applications(id),
  borrower_id UUID NOT NULL REFERENCES borrowers(id),
  principal NUMERIC(14,2) NOT NULL,
  monthly_rate NUMERIC(5,4) NOT NULL,
  term_months INTEGER NOT NULL,
  repayment_style TEXT NOT NULL CHECK (repayment_style IN ('EQUAL_PRINCIPAL', 'EQUAL_PAYMENT')),
  disbursed_at TIMESTAMPTZ,
  maturity_date DATE,
  status TEXT NOT NULL DEFAULT 'pending_disbursement' CHECK (status IN ('pending_disbursement', 'active', 'overdue', 'paid', 'written_off')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule items table
CREATE TABLE schedule_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_due NUMERIC(14,2) NOT NULL,
  interest_due NUMERIC(14,2) NOT NULL,
  principal_paid NUMERIC(14,2) DEFAULT 0,
  interest_paid NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loan_id, installment_no)
);

-- Ledger entries table
CREATE TABLE ledger_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('disbursement', 'interest', 'principal', 'penalty', 'fee', 'adjustment')),
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  payment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_borrowers_phone ON borrowers(phone);
CREATE INDEX idx_borrowers_id_number ON borrowers(id_number);
CREATE INDEX idx_documents_borrower ON documents(borrower_id);
CREATE INDEX idx_documents_application ON documents(application_id);
CREATE INDEX idx_applications_borrower ON applications(borrower_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_loans_borrower ON loans(borrower_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_schedule_items_loan ON schedule_items(loan_id);
CREATE INDEX idx_schedule_items_due_date ON schedule_items(due_date);
CREATE INDEX idx_ledger_entries_loan ON ledger_entries(loan_id);
CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);

-- Row Level Security
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Borrowers policies
CREATE POLICY "Borrowers are viewable by authenticated users"
  ON borrowers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Borrowers are insertable by authenticated users"
  ON borrowers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Borrowers are updatable by authenticated users"
  ON borrowers FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Documents policies
CREATE POLICY "Documents are viewable by authenticated users"
  ON documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Documents are insertable by authenticated users"
  ON documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Documents are updatable by authenticated users"
  ON documents FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Applications policies
CREATE POLICY "Applications are viewable by authenticated users"
  ON applications FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Applications are insertable by authenticated users"
  ON applications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Applications are updatable by authenticated users"
  ON applications FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Loans policies
CREATE POLICY "Loans are viewable by authenticated users"
  ON loans FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Loans are insertable by authenticated users"
  ON loans FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Loans are updatable by authenticated users"
  ON loans FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Schedule items policies
CREATE POLICY "Schedule items are viewable by authenticated users"
  ON schedule_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Schedule items are insertable by authenticated users"
  ON schedule_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Schedule items are updatable by authenticated users"
  ON schedule_items FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Ledger entries policies
CREATE POLICY "Ledger entries are viewable by authenticated users"
  ON ledger_entries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Ledger entries are insertable by authenticated users"
  ON ledger_entries FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Ledger entries are append-only (no updates)
CREATE POLICY "Ledger entries are not updatable"
  ON ledger_entries FOR UPDATE
  USING (false);
