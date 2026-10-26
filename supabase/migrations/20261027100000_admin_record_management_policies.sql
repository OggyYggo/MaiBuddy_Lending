-- Allow admins and loan officers to maintain borrower and collection-note
-- records, and only remove applications that are still in progress.
CREATE TABLE IF NOT EXISTS public.collection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  promise_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_notes_loan
  ON public.collection_notes(loan_id);
CREATE INDEX IF NOT EXISTS idx_collection_notes_created_at
  ON public.collection_notes(created_at);

ALTER TABLE public.collection_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collection_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_notes TO authenticated;
GRANT DELETE ON public.borrowers, public.applications TO authenticated;

DROP POLICY IF EXISTS "Collection notes are viewable by authenticated users"
  ON public.collection_notes;
CREATE POLICY "Collection notes are viewable by authenticated users"
  ON public.collection_notes FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Collection notes are insertable by authenticated users"
  ON public.collection_notes;
CREATE POLICY "Collection notes are insertable by authenticated users"
  ON public.collection_notes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Collection notes are updatable by authenticated users"
  ON public.collection_notes;
CREATE POLICY "Collection notes are updatable by authenticated users"
  ON public.collection_notes FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Borrowers are deletable by authenticated users"
  ON public.borrowers;
CREATE POLICY "Borrowers are deletable by authenticated users"
  ON public.borrowers FOR DELETE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "In-progress applications are deletable by authenticated users"
  ON public.applications;
CREATE POLICY "In-progress applications are deletable by authenticated users"
  ON public.applications FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND status IN ('draft', 'in_review')
  );

DROP POLICY IF EXISTS "Collection notes are deletable by authenticated users"
  ON public.collection_notes;
CREATE POLICY "Collection notes are deletable by authenticated users"
  ON public.collection_notes FOR DELETE
  USING (auth.role() = 'authenticated');
