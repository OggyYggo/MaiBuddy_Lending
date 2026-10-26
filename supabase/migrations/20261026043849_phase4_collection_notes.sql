-- Collection notes table
CREATE TABLE collection_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  promise_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_collection_notes_loan ON collection_notes(loan_id);
CREATE INDEX idx_collection_notes_created_at ON collection_notes(created_at);

-- Row Level Security
ALTER TABLE collection_notes ENABLE ROW LEVEL SECURITY;

-- Collection notes policies
CREATE POLICY "Collection notes are viewable by authenticated users"
  ON collection_notes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Collection notes are insertable by authenticated users"
  ON collection_notes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Collection notes are updatable by authenticated users"
  ON collection_notes FOR UPDATE
  USING (auth.role() = 'authenticated');
