-- Payments table
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'bank', 'e_wallet', 'check')),
  reference TEXT,
  proof_file TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  received_at TIMESTAMPTZ NOT NULL,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Penalties and fees table
CREATE TABLE penalties_fees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('late_payment', 'processing_fee', 'early_payoff_fee', 'other')),
  amount NUMERIC(14,2) NOT NULL,
  reason TEXT,
  waived_by UUID REFERENCES profiles(id),
  waived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_received_at ON payments(received_at);
CREATE INDEX idx_penalties_fees_loan ON penalties_fees(loan_id);

-- Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalties_fees ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Payments are viewable by authenticated users"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Payments are insertable by authenticated users"
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Payments are updatable by authenticated users"
  ON payments FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Penalties/fees policies
CREATE POLICY "Penalties/fees are viewable by authenticated users"
  ON penalties_fees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Penalties/fees are insertable by authenticated users"
  ON penalties_fees FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Penalties/fees are updatable by authenticated users"
  ON penalties_fees FOR UPDATE
  USING (auth.role() = 'authenticated');
