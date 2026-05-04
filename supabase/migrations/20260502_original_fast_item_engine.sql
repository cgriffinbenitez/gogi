CREATE TABLE IF NOT EXISTS public.original_item_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL DEFAULT 'gogi_original_fast_aligned'
    CHECK (source_type IN ('gogi_original_fast_aligned')),
  benchmark_code text NOT NULL,
  reporting_category text NOT NULL CHECK (reporting_category IN ('RP', 'RI', 'RGV')),
  grade integer NOT NULL DEFAULT 9 CHECK (grade BETWEEN 3 AND 12),
  passage_type text NOT NULL
    CHECK (passage_type IN ('literary', 'informational', 'paired', 'poetry', 'argument')),
  passage_title text NOT NULL,
  passage_text text NOT NULL,
  passage_word_count integer NOT NULL DEFAULT 0,
  item_type text NOT NULL
    CHECK (item_type IN ('multiple_choice', 'multi_select', 'evidence_based_2_part', 'table_completion')),
  stem_pattern text NOT NULL,
  prompt_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  correct_rationale text NOT NULL,
  distractor_rationales jsonb NOT NULL DEFAULT '{}'::jsonb,
  remediation_hint text NOT NULL,
  reassessment_plan text NOT NULL,
  difficulty_estimate integer NOT NULL DEFAULT 2 CHECK (difficulty_estimate BETWEEN 1 AND 4),
  generated_from_released_item_id uuid REFERENCES public.released_items(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'promoted', 'rejected')),
  promoted_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_original_item_drafts_benchmark
ON public.original_item_drafts(benchmark_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_original_item_drafts_source_item
ON public.original_item_drafts(generated_from_released_item_id);

ALTER TABLE public.original_item_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "released item managers manage original drafts" ON public.original_item_drafts;
CREATE POLICY "released item managers manage original drafts"
ON public.original_item_drafts FOR ALL
USING (
  public.get_my_role() IN ('teacher', 'admin')
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  public.get_my_role() IN ('teacher', 'admin')
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('teacher', 'admin')
  )
);

GRANT ALL ON TABLE public.original_item_drafts TO authenticated;
GRANT ALL ON TABLE public.original_item_drafts TO service_role;
