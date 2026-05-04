CREATE TABLE IF NOT EXISTS public.released_test_booklets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booklet_name text NOT NULL,
  grade integer NOT NULL CHECK (grade BETWEEN 3 AND 12),
  subject text NOT NULL DEFAULT 'ELA Reading',
  release_year integer NOT NULL CHECK (release_year BETWEEN 2000 AND 2100),
  source_url text,
  raw_pdf_path text NOT NULL,
  total_items_expected integer,
  total_items_extracted integer NOT NULL DEFAULT 0,
  total_items_promoted integer NOT NULL DEFAULT 0,
  extraction_status text NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'extracting', 'extracted', 'extraction_failed')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  extracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.released_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booklet_id uuid NOT NULL REFERENCES public.released_test_booklets(id) ON DELETE CASCADE,
  passage_index integer NOT NULL,
  passage_title text,
  passage_type text NOT NULL
    CHECK (passage_type IN ('prose_fiction', 'prose_nonfiction', 'poetry', 'drama', 'informational_article', 'paired_set')),
  passage_text text NOT NULL,
  passage_word_count integer NOT NULL DEFAULT 0,
  paired_with_passage_id uuid REFERENCES public.released_passages(id),
  inferred_lexile integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booklet_id, passage_index)
);

CREATE TABLE IF NOT EXISTS public.released_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booklet_id uuid NOT NULL REFERENCES public.released_test_booklets(id) ON DELETE CASCADE,
  passage_id uuid REFERENCES public.released_passages(id) ON DELETE SET NULL,
  item_number integer NOT NULL,
  benchmark_code text NOT NULL,
  reporting_category text NOT NULL CHECK (reporting_category IN ('RP', 'RI', 'RGV')),
  item_type text NOT NULL
    CHECK (item_type IN ('multiple_choice', 'multi_select', 'evidence_based_2_part', 'table_completion', 'hot_text', 'drag_drop')),
  prompt_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  cognitive_complexity text,
  extraction_confidence numeric(3,2) NOT NULL DEFAULT 0.00 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booklet_id, item_number)
);

CREATE TABLE IF NOT EXISTS public.released_item_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  released_item_id uuid NOT NULL REFERENCES public.released_items(id) ON DELETE CASCADE,
  classification_code text NOT NULL REFERENCES public.cognitive_primitives(code),
  weight numeric(3,2) NOT NULL CHECK (weight > 0 AND weight <= 1),
  confidence numeric(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  distractor_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text NOT NULL,
  assigned_by text NOT NULL DEFAULT 'automated'
    CHECK (assigned_by IN ('automated', 'clinical_review', 'manual_override')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (released_item_id, classification_code, assigned_by)
);

CREATE TABLE IF NOT EXISTS public.released_item_tiers (
  id uuid PRIMARY KEY REFERENCES public.released_items(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('T1', 'T2', 'T3', 'T4')),
  tier_rationale text NOT NULL,
  passage_word_count integer NOT NULL DEFAULT 0,
  tagger_assigned_tier text NOT NULL CHECK (tagger_assigned_tier IN ('T1', 'T2', 'T3', 'T4')),
  wordcount_assigned_tier text NOT NULL CHECK (wordcount_assigned_tier IN ('T1', 'T2', 'T3', 'T4')),
  tier_override_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.released_item_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  released_item_id uuid NOT NULL REFERENCES public.released_items(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('practice', 'transfer', 'scaffold')),
  priority integer NOT NULL DEFAULT 1 CHECK (priority > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (released_item_id, role)
);

CREATE TABLE IF NOT EXISTS public.released_item_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  released_item_id uuid NOT NULL REFERENCES public.released_items(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'flagged_for_revision')),
  automated_classification_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'gogi_authored',
ADD COLUMN IF NOT EXISTS released_item_id uuid REFERENCES public.released_items(id),
ADD COLUMN IF NOT EXISTS is_released_item boolean NOT NULL DEFAULT false;

UPDATE public.questions
SET source = COALESCE(source, 'gogi_authored'),
    is_released_item = COALESCE(is_released_item, false)
WHERE source IS NULL OR is_released_item IS NULL;

CREATE INDEX IF NOT EXISTS idx_released_booklets_status
ON public.released_test_booklets(extraction_status, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_released_items_booklet
ON public.released_items(booklet_id, item_number);

CREATE INDEX IF NOT EXISTS idx_released_items_benchmark
ON public.released_items(benchmark_code);

CREATE INDEX IF NOT EXISTS idx_released_item_classifications_code
ON public.released_item_classifications(classification_code, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_released_item_review_queue_status
ON public.released_item_review_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_questions_released_item
ON public.questions(is_released_item, released_item_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('released-fast-booklets', 'released-fast-booklets', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.released_test_booklets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.released_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.released_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.released_item_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.released_item_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.released_item_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.released_item_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage released booklets" ON public.released_test_booklets;
CREATE POLICY "admins manage released booklets"
ON public.released_test_booklets FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins manage released passages" ON public.released_passages;
CREATE POLICY "admins manage released passages"
ON public.released_passages FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins manage released items" ON public.released_items;
CREATE POLICY "admins manage released items"
ON public.released_items FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins manage released item classifications" ON public.released_item_classifications;
CREATE POLICY "admins manage released item classifications"
ON public.released_item_classifications FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins manage released item tiers" ON public.released_item_tiers;
CREATE POLICY "admins manage released item tiers"
ON public.released_item_tiers FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins manage released item roles" ON public.released_item_roles;
CREATE POLICY "admins manage released item roles"
ON public.released_item_roles FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins manage released item review queue" ON public.released_item_review_queue;
CREATE POLICY "admins manage released item review queue"
ON public.released_item_review_queue FOR ALL
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "admins upload released fast booklets" ON storage.objects;
CREATE POLICY "admins upload released fast booklets"
ON storage.objects FOR ALL
USING (
  bucket_id = 'released-fast-booklets'
  AND public.get_my_role() = 'admin'
)
WITH CHECK (
  bucket_id = 'released-fast-booklets'
  AND public.get_my_role() = 'admin'
);

GRANT ALL ON TABLE public.released_test_booklets TO authenticated;
GRANT ALL ON TABLE public.released_passages TO authenticated;
GRANT ALL ON TABLE public.released_items TO authenticated;
GRANT ALL ON TABLE public.released_item_classifications TO authenticated;
GRANT ALL ON TABLE public.released_item_tiers TO authenticated;
GRANT ALL ON TABLE public.released_item_roles TO authenticated;
GRANT ALL ON TABLE public.released_item_review_queue TO authenticated;

GRANT ALL ON TABLE public.released_test_booklets TO service_role;
GRANT ALL ON TABLE public.released_passages TO service_role;
GRANT ALL ON TABLE public.released_items TO service_role;
GRANT ALL ON TABLE public.released_item_classifications TO service_role;
GRANT ALL ON TABLE public.released_item_tiers TO service_role;
GRANT ALL ON TABLE public.released_item_roles TO service_role;
GRANT ALL ON TABLE public.released_item_review_queue TO service_role;
