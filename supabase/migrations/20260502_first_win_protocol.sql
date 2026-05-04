ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS first_win_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.first_win_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strength_classification_code text NOT NULL UNIQUE,
  bridge_classification_code text NOT NULL,
  protocol_name text NOT NULL,
  phase_a_item_count integer NOT NULL DEFAULT 5,
  phase_b_item_count integer NOT NULL DEFAULT 1,
  phase_a_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  phase_b_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  closing_copy text NOT NULL,
  clinical_rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.first_win_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  protocol_id uuid NOT NULL REFERENCES public.first_win_protocols(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  phase_a_correct_count integer NOT NULL DEFAULT 0,
  phase_a_total_count integer NOT NULL DEFAULT 0,
  phase_b_success boolean,
  self_efficacy_response text,
  total_duration_seconds integer,
  abandoned boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.first_win_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.first_win_sessions(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('A', 'B')),
  item_index integer NOT NULL,
  item_content jsonb NOT NULL,
  student_response text NOT NULL,
  is_correct boolean NOT NULL,
  scaffold_used boolean NOT NULL DEFAULT false,
  time_on_item_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, phase, item_index)
);

CREATE INDEX IF NOT EXISTS idx_first_win_sessions_student
ON public.first_win_sessions(student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_first_win_responses_session
ON public.first_win_responses(session_id, phase, item_index);

ALTER TABLE public.first_win_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_win_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_win_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read first win protocols" ON public.first_win_protocols;
CREATE POLICY "authenticated read first win protocols"
ON public.first_win_protocols FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "students manage own first win sessions" ON public.first_win_sessions;
CREATE POLICY "students manage own first win sessions"
ON public.first_win_sessions FOR ALL
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
)
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers read own students first win sessions" ON public.first_win_sessions;
CREATE POLICY "teachers read own students first win sessions"
ON public.first_win_sessions FOR SELECT
USING (
  student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "students manage own first win responses" ON public.first_win_responses;
CREATE POLICY "students manage own first win responses"
ON public.first_win_responses FOR ALL
USING (
  session_id IN (
    SELECT fws.id
    FROM public.first_win_sessions fws
    JOIN public.students s ON s.id = fws.student_id
    WHERE s.user_id = auth.uid()
  )
)
WITH CHECK (
  session_id IN (
    SELECT fws.id
    FROM public.first_win_sessions fws
    JOIN public.students s ON s.id = fws.student_id
    WHERE s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "teachers read own students first win responses" ON public.first_win_responses;
CREATE POLICY "teachers read own students first win responses"
ON public.first_win_responses FOR SELECT
USING (
  session_id IN (
    SELECT fws.id
    FROM public.first_win_sessions fws
    JOIN public.students s ON s.id = fws.student_id
    WHERE s.teacher_id = auth.uid()
  )
);

GRANT SELECT ON TABLE public.first_win_protocols TO authenticated;
GRANT ALL ON TABLE public.first_win_sessions TO authenticated;
GRANT ALL ON TABLE public.first_win_responses TO authenticated;
GRANT ALL ON TABLE public.first_win_protocols TO service_role;
GRANT ALL ON TABLE public.first_win_sessions TO service_role;
GRANT ALL ON TABLE public.first_win_responses TO service_role;

INSERT INTO public.first_win_protocols (
  strength_classification_code,
  bridge_classification_code,
  protocol_name,
  phase_a_item_count,
  phase_b_item_count,
  phase_a_content,
  phase_b_content,
  closing_copy,
  clinical_rationale
)
VALUES
(
  'morphology_strength',
  'vocabulary_gap',
  'Morphology as Engine',
  5,
  1,
  '[
    {
      "item_id": "morph_a1",
      "prompt": "The word ''transformation'' breaks into three parts. What does the root ''form'' mean?",
      "response_type": "multiple_choice",
      "options": ["shape", "speed", "place", "color"],
      "correct_answer": "shape",
      "scaffold_text": "Think about words like ''formation'' or ''reform''. What''s common to them?",
      "feedback_correct": "Yes. ''Form'' = shape. So ''transformation'' = a change of shape.",
      "feedback_incorrect": "Look at words like ''formation'' or ''reform'' — what''s the common idea?",
      "cognitive_focus": "root meaning"
    },
    {
      "item_id": "morph_a2",
      "prompt": "What does the prefix ''trans-'' add to ''transformation''?",
      "response_type": "multiple_choice",
      "options": ["across or beyond", "before", "without", "again"],
      "correct_answer": "across or beyond",
      "scaffold_text": "Think about ''transport'', ''translate'', ''transcontinental''. What''s common?",
      "feedback_correct": "Right. ''Trans-'' = across or beyond. So ''transformation'' = a shape-change that crosses from one form to another.",
      "feedback_incorrect": "Try this: ''transport'' = carry across. ''Translate'' = carry meaning across. What does ''trans-'' do?",
      "cognitive_focus": "prefix meaning"
    },
    {
      "item_id": "morph_a3",
      "prompt": "Now do this one on your own. What does ''inevitable'' mean, based on its parts?",
      "response_type": "multiple_choice",
      "options": ["cannot be avoided", "easy to see", "happens often", "fully expected"],
      "correct_answer": "cannot be avoided",
      "scaffold_text": "''In-'' = not. ''-evit-'' comes from a Latin root meaning ''avoid''. ''-able'' = able to be.",
      "feedback_correct": "Exactly. ''In-evit-able'' = not-avoid-able. Cannot be avoided.",
      "feedback_incorrect": "Break it apart: ''in-'' = not. ''-evit-'' relates to avoiding. ''-able'' = able to be. Put it together.",
      "cognitive_focus": "independent decomposition"
    },
    {
      "item_id": "morph_a4",
      "prompt": "Try ''benevolent''. What''s the closest meaning?",
      "response_type": "multiple_choice",
      "options": ["wishing good for others", "very wealthy", "extremely careful", "easily fooled"],
      "correct_answer": "wishing good for others",
      "scaffold_text": "''Bene-'' = good. ''-vol-'' relates to wanting or wishing. ''-ent'' = a quality.",
      "feedback_correct": "Right. ''Bene-vol-ent'' = the quality of wishing good. We say someone benevolent is kind, generous, wanting good things for others.",
      "feedback_incorrect": "''Bene-'' as in ''beneficial'' or ''benefit'' — it means good. ''-vol-'' as in ''volunteer'' or ''voluntary'' — it means wanting or willing. Now combine.",
      "cognitive_focus": "independent decomposition"
    },
    {
      "item_id": "morph_a5",
      "prompt": "Last one. What does ''precarious'' mean?",
      "response_type": "multiple_choice",
      "options": ["unstable, risky", "carefully planned", "extremely old", "perfectly balanced"],
      "correct_answer": "unstable, risky",
      "scaffold_text": "''Pre-'' = before. ''-car-'' relates to praying or asking. The word originally meant ''held by prayer'' — like something so unstable you have to pray it holds.",
      "feedback_correct": "Yes. ''Precarious'' literally means held by prayer — so unstable that survival depends on luck. Risky. Unstable.",
      "feedback_incorrect": "The root is unusual. ''Precarious'' literally meant ''held by prayer'' in Latin — so unstable you''d pray for it to hold. That gives you the modern meaning.",
      "cognitive_focus": "morphological etymology"
    }
  ]'::jsonb,
  '[
    {
      "item_id": "morph_b1",
      "prompt": "Read this sentence: ''After years of struggle, Maria''s transformation from withdrawn child to confident leader was inevitable.'' Based on the words you just broke apart — ''transformation'' and ''inevitable'' — what does the author want you to feel about Maria?",
      "context": "After years of struggle, Maria''s transformation from withdrawn child to confident leader was inevitable.",
      "response_type": "multiple_choice",
      "options": [
        "That her change was earned and was always going to happen",
        "That she got lucky and changed by accident",
        "That nothing about her is different",
        "That she might still go back to who she was"
      ],
      "correct_answer": "That her change was earned and was always going to happen",
      "scaffold_text": "You already know ''transformation'' = a complete change of shape. You already know ''inevitable'' = cannot be avoided. The author chose those exact words instead of softer ones. What''s that telling you?",
      "feedback_correct": "Exactly. The words you decoded — ''transformation'' and ''inevitable'' — carry weight. They tell you Maria''s change was complete and unstoppable. That''s the author''s word choice doing the work. You just used your morphology to do inferential reading.",
      "feedback_incorrect": "Look at the words you decoded: ''transformation'' (a complete change) and ''inevitable'' (cannot be avoided). The author could have written ''her growth was likely'' but chose stronger words. What''s that doing to your sense of Maria?",
      "cognitive_focus": "morphology-to-connotation transfer"
    }
  ]'::jsonb,
  'You just did something specific: you used word-structure — your strongest area — as the engine for inferential reading. Two different skills connected by one engine. We''re going to keep using your word-structure capacity that way. Tomorrow, something a little harder.',
  'Students with strong morphological decoding can decompose word structure but often fail to deploy that capacity inferentially in context. This protocol exercises the morphological strength on isolated words, then explicitly transfers it to connotative inference in a sentence-level context.'
)
ON CONFLICT (strength_classification_code) DO UPDATE
SET
  bridge_classification_code = EXCLUDED.bridge_classification_code,
  protocol_name = EXCLUDED.protocol_name,
  phase_a_item_count = EXCLUDED.phase_a_item_count,
  phase_b_item_count = EXCLUDED.phase_b_item_count,
  phase_a_content = EXCLUDED.phase_a_content,
  phase_b_content = EXCLUDED.phase_b_content,
  closing_copy = EXCLUDED.closing_copy,
  clinical_rationale = EXCLUDED.clinical_rationale;

INSERT INTO public.first_win_protocols (
  strength_classification_code,
  bridge_classification_code,
  protocol_name,
  phase_a_item_count,
  phase_b_item_count,
  phase_a_content,
  phase_b_content,
  closing_copy,
  clinical_rationale
)
VALUES
  ('structural_reading_strength', 'inferencing_literal', 'Structural Reading as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Structure-reading muscle can support inferring author intent from organization.'),
  ('evidence_retrieval_strength', 'comprehension_integration_failure', 'Evidence Retrieval as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Locating evidence can support synthesizing evidence into claims.'),
  ('informational_text_strength', 'inferencing_schema', 'Informational Reading as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Surface comprehension can support schema-mediated inference.'),
  ('theme_strength', 'topic_vs_theme_confusion', 'Theme as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Theme-finding capacity can support distinguishing topic from theme in unfamiliar texts.'),
  ('mood_strength', 'tone_misreading', 'Mood as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Mood recognition can support sensitivity to author stance.'),
  ('tone_strength', 'inferencing_literal', 'Tone as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Tone perception can support ironic or satirical inference.'),
  ('figurative_strength', 'mood_misreading', 'Figurative Reading as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Figurative recognition can support mood-creation through figuration.'),
  ('rhetoric_strength', 'structure_purpose_disconnect', 'Rhetoric as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Rhetorical pattern recognition can support structural purpose.'),
  ('argument_comparison_strength', 'comprehension_integration_failure', 'Argument Comparison as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Argument compare and contrast can support multi-source synthesis.'),
  ('classical_text_strength', 'inferencing_schema', 'Classical Text as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Genre schema strength can support schema deployment in unfamiliar text.'),
  ('perspective_strength', 'tone_misreading', 'Perspective as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Narrator perspective can support tonal sensitivity.'),
  ('context_clue_strength', 'figurative_language_failure', 'Context Clues as Engine', 5, 1, '[]'::jsonb, '[]'::jsonb, 'You used a real reading strength as an engine. Tomorrow, we connect it to something harder.', 'Vocabulary-from-context can support figurative meaning recognition.')
ON CONFLICT (strength_classification_code) DO NOTHING;
