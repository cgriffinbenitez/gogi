CREATE TABLE IF NOT EXISTS public.cognitive_primitives (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cognitive_primitives (code, label, description) VALUES
  ('figurative_language_failure', 'Figurative language', 'Student misses nonliteral meaning, metaphor, symbolism, or connotation.'),
  ('mood_misreading', 'Mood', 'Student misreads the feeling created by text details.'),
  ('tone_misreading', 'Tone', 'Student misreads the author or speaker attitude.'),
  ('inferencing_literal', 'Literal inferencing', 'Student stays too literal when a reasonable inference is required.'),
  ('topic_vs_theme_confusion', 'Topic versus theme', 'Student names what the text is about but misses the message or lesson.'),
  ('inferencing_schema', 'Schema-based inferencing', 'Student lacks or does not activate background structure for the inference.'),
  ('evidence_retrieval_failure', 'Evidence retrieval', 'Student cannot find or use the detail needed to support an answer.'),
  ('vocabulary_gap', 'Vocabulary', 'Student misses meaning because key word knowledge is weak.'),
  ('structure_purpose_disconnect', 'Structure and purpose', 'Student misses how organization supports meaning or author purpose.'),
  ('no_metacognitive_strategy', 'Metacognitive strategy', 'Student does not monitor confusion or choose a repair strategy.'),
  ('comprehension_integration_failure', 'Comprehension integration', 'Student cannot combine details across the passage.'),
  ('morphology_gap', 'Morphology', 'Student misses meaning carried by word parts.'),
  ('syntax_barrier', 'Syntax', 'Student is blocked by sentence structure.'),
  ('inferencing_wm', 'Working-memory inference load', 'Student loses the thread when inference requires holding multiple details.')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.fast_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fl_student_id text NOT NULL,
  test_reason text NOT NULL CHECK (test_reason IN ('PM1', 'PM2', 'PM3')),
  test_label text,
  test_year integer NOT NULL,
  date_taken date,
  scale_score integer,
  achievement_level integer CHECK (achievement_level BETWEEN 1 AND 5),
  percentile_rank integer CHECK (percentile_rank BETWEEN 1 AND 99),
  raw_pdf_path text,
  parsed_at timestamptz,
  parse_status text NOT NULL DEFAULT 'parsed',
  parse_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fl_student_id, test_reason, test_year)
);

CREATE TABLE IF NOT EXISTS public.fast_category_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fast_assessment_id uuid NOT NULL REFERENCES public.fast_assessments(id) ON DELETE CASCADE,
  category_code text NOT NULL CHECK (category_code IN ('RP', 'RI', 'RGV')),
  category_name text NOT NULL,
  achievement_level text NOT NULL CHECK (achievement_level IN ('Below the Standard', 'At/Near the Standard', 'Above the Standard')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fast_assessment_id, category_code)
);

CREATE TABLE IF NOT EXISTS public.fast_item_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fast_assessment_id uuid NOT NULL REFERENCES public.fast_assessments(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  benchmark_code text NOT NULL,
  reporting_category text,
  benchmark_description text,
  points_earned numeric NOT NULL DEFAULT 0,
  points_possible numeric NOT NULL DEFAULT 1,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fast_assessment_id, question_number)
);

CREATE TABLE IF NOT EXISTS public.fast_benchmark_classification_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_code text NOT NULL,
  classification_code text NOT NULL REFERENCES public.cognitive_primitives(code),
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 1),
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (benchmark_code, classification_code)
);

CREATE TABLE IF NOT EXISTS public.student_cognitive_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  generated_from text NOT NULL DEFAULT 'fast_isr',
  source_assessment_ids uuid[] NOT NULL DEFAULT '{}',
  classification_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  benchmark_strengths jsonb NOT NULL DEFAULT '{}'::jsonb,
  benchmark_weaknesses jsonb NOT NULL DEFAULT '{}'::jsonb,
  trajectory_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_achievement_level integer,
  next_rung_target integer,
  points_to_next_rung integer,
  top_strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_fast_assessments_student ON public.fast_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_fast_items_assessment ON public.fast_item_responses(fast_assessment_id);
CREATE INDEX IF NOT EXISTS idx_student_cognitive_profiles_student ON public.student_cognitive_profiles(student_id, active);

INSERT INTO public.fast_benchmark_classification_map (benchmark_code, classification_code, weight, rationale) VALUES
  ('ELA.9.R.1.1', 'figurative_language_failure', 0.40, 'Poetry and literary analysis require interpreting figurative language.'),
  ('ELA.9.R.1.1', 'mood_misreading', 0.20, 'Mood is often inferred through imagery and word choice.'),
  ('ELA.9.R.1.1', 'tone_misreading', 0.20, 'Tone errors can look like weak literary interpretation.'),
  ('ELA.9.R.1.1', 'inferencing_literal', 0.20, 'Students may remain literal when literary meaning is implied.'),
  ('ELA.9.R.1.2', 'topic_vs_theme_confusion', 0.50, 'Theme work requires separating subject from message.'),
  ('ELA.9.R.1.2', 'inferencing_schema', 0.30, 'Theme depends on schema for character/conflict patterns.'),
  ('ELA.9.R.1.2', 'evidence_retrieval_failure', 0.20, 'Students need support details to defend theme.'),
  ('ELA.9.R.1.3', 'inferencing_literal', 0.50, 'Character and plot analysis often fails when students stay literal.'),
  ('ELA.9.R.1.3', 'tone_misreading', 0.30, 'Speaker or character attitude affects interpretation.'),
  ('ELA.9.R.1.3', 'inferencing_schema', 0.20, 'Narrative schema supports motive and conflict inference.'),
  ('ELA.9.R.1.4', 'inferencing_schema', 0.40, 'Poetry interpretation requires applying genre schema.'),
  ('ELA.9.R.1.4', 'vocabulary_gap', 0.30, 'Poetic language often depends on precise word meaning.'),
  ('ELA.9.R.1.4', 'inferencing_literal', 0.30, 'Students can miss implied poetic meaning.'),
  ('ELA.9.R.2.1', 'structure_purpose_disconnect', 0.60, 'Central idea and development depend on text structure.'),
  ('ELA.9.R.2.1', 'no_metacognitive_strategy', 0.40, 'Students need monitoring strategies to track development.'),
  ('ELA.9.R.2.2', 'evidence_retrieval_failure', 0.60, 'Informational text questions often hinge on locating evidence.'),
  ('ELA.9.R.2.2', 'comprehension_integration_failure', 0.40, 'Students must combine details across paragraphs.'),
  ('ELA.9.R.2.3', 'figurative_language_failure', 0.50, 'Rhetorical meaning depends on figurative and connotative language.'),
  ('ELA.9.R.2.3', 'inferencing_literal', 0.30, 'Students must infer impact beyond surface wording.'),
  ('ELA.9.R.2.3', 'structure_purpose_disconnect', 0.20, 'Rhetoric connects to author purpose.'),
  ('ELA.9.R.2.4', 'comprehension_integration_failure', 0.50, 'Arguments require connecting claims, reasons, and evidence.'),
  ('ELA.9.R.2.4', 'evidence_retrieval_failure', 0.30, 'Argument analysis requires finding support.'),
  ('ELA.9.R.2.4', 'inferencing_schema', 0.20, 'Argument schema supports evaluation.'),
  ('ELA.9.R.3.1', 'mood_misreading', 0.50, 'Text features and image-word relationships can shape mood.'),
  ('ELA.9.R.3.1', 'figurative_language_failure', 0.40, 'Visual/verbal figurative cues can carry meaning.'),
  ('ELA.9.R.3.1', 'vocabulary_gap', 0.10, 'Domain language may block meaning.'),
  ('ELA.9.R.3.3', 'inferencing_schema', 0.70, 'Comparative reading depends on recognizing shared structures.'),
  ('ELA.9.R.3.3', 'comprehension_integration_failure', 0.30, 'Students must combine information across texts.'),
  ('ELA.9.R.3.4', 'figurative_language_failure', 0.40, 'Media and text analysis can require figurative interpretation.'),
  ('ELA.9.R.3.4', 'tone_misreading', 0.30, 'Tone shifts across media can drive meaning.'),
  ('ELA.9.R.3.4', 'inferencing_literal', 0.30, 'Students must infer meaning from presentation choices.'),
  ('ELA.9.V.1.2', 'morphology_gap', 1.00, 'Morphology benchmark directly measures word-part reasoning.'),
  ('ELA.9.V.1.3', 'vocabulary_gap', 0.50, 'Context vocabulary depends on word knowledge.'),
  ('ELA.9.V.1.3', 'inferencing_literal', 0.30, 'Students infer word meaning from context clues.'),
  ('ELA.9.V.1.3', 'figurative_language_failure', 0.20, 'Connotation and figurative use can affect vocabulary interpretation.')
ON CONFLICT (benchmark_code, classification_code) DO UPDATE
SET weight = EXCLUDED.weight,
    rationale = EXCLUDED.rationale;

ALTER TABLE public.cognitive_primitives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fast_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fast_category_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fast_item_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fast_benchmark_classification_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cognitive_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read cognitive primitives" ON public.cognitive_primitives;
CREATE POLICY "authenticated read cognitive primitives"
ON public.cognitive_primitives FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated read fast benchmark map" ON public.fast_benchmark_classification_map;
CREATE POLICY "authenticated read fast benchmark map"
ON public.fast_benchmark_classification_map FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "teachers manage own fast assessments" ON public.fast_assessments;
CREATE POLICY "teachers manage own fast assessments"
ON public.fast_assessments FOR ALL
USING (
  public.get_my_role() = 'admin'
  OR student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
)
WITH CHECK (
  public.get_my_role() = 'admin'
  OR student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers manage own fast categories" ON public.fast_category_performance;
CREATE POLICY "teachers manage own fast categories"
ON public.fast_category_performance FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.fast_assessments fa
    JOIN public.students s ON s.id = fa.student_id
    WHERE fa.id = fast_assessment_id
      AND (public.get_my_role() = 'admin' OR s.teacher_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fast_assessments fa
    JOIN public.students s ON s.id = fa.student_id
    WHERE fa.id = fast_assessment_id
      AND (public.get_my_role() = 'admin' OR s.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "teachers manage own fast items" ON public.fast_item_responses;
CREATE POLICY "teachers manage own fast items"
ON public.fast_item_responses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.fast_assessments fa
    JOIN public.students s ON s.id = fa.student_id
    WHERE fa.id = fast_assessment_id
      AND (public.get_my_role() = 'admin' OR s.teacher_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fast_assessments fa
    JOIN public.students s ON s.id = fa.student_id
    WHERE fa.id = fast_assessment_id
      AND (public.get_my_role() = 'admin' OR s.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "teachers and students read cognitive profiles" ON public.student_cognitive_profiles;
CREATE POLICY "teachers and students read cognitive profiles"
ON public.student_cognitive_profiles FOR SELECT
USING (
  public.get_my_role() = 'admin'
  OR student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
  OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers manage own cognitive profiles" ON public.student_cognitive_profiles;
CREATE POLICY "teachers manage own cognitive profiles"
ON public.student_cognitive_profiles FOR ALL
USING (
  public.get_my_role() = 'admin'
  OR student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
)
WITH CHECK (
  public.get_my_role() = 'admin'
  OR student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('fast-reports', 'fast-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "teachers upload fast reports" ON storage.objects;
CREATE POLICY "teachers upload fast reports"
ON storage.objects FOR ALL
USING (
  bucket_id = 'fast-reports'
  AND public.get_my_role() IN ('teacher', 'admin')
)
WITH CHECK (
  bucket_id = 'fast-reports'
  AND public.get_my_role() IN ('teacher', 'admin')
);

GRANT SELECT ON TABLE public.cognitive_primitives TO authenticated;
GRANT ALL ON TABLE public.fast_assessments TO authenticated;
GRANT ALL ON TABLE public.fast_category_performance TO authenticated;
GRANT ALL ON TABLE public.fast_item_responses TO authenticated;
GRANT SELECT ON TABLE public.fast_benchmark_classification_map TO authenticated;
GRANT ALL ON TABLE public.student_cognitive_profiles TO authenticated;
GRANT ALL ON TABLE public.cognitive_primitives TO service_role;
GRANT ALL ON TABLE public.fast_assessments TO service_role;
GRANT ALL ON TABLE public.fast_category_performance TO service_role;
GRANT ALL ON TABLE public.fast_item_responses TO service_role;
GRANT ALL ON TABLE public.fast_benchmark_classification_map TO service_role;
GRANT ALL ON TABLE public.student_cognitive_profiles TO service_role;
