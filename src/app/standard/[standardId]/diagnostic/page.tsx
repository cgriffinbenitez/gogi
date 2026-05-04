'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiNav } from '@/components/nav/GogiNav';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { classifySession } from '@/lib/classify/classifySession';
import { analyzeSchemaDemand } from '@/lib/schema/SchemaDemandAnalyzer';
import { SchemaCard } from '@/components/schema/SchemaCard';
import { C, FONTS } from '@/lib/constants/design';
import {
  getFirstLayer0Complete,
  getLatestLayer0SessionCalibration,
} from '@/lib/layer0/sessionCalibration';
import type { SchemaPayload } from '@/lib/schema/types';
import {
  buildEla9R11DiagnosticInsight,
  ELA9R11_SEED_ITEMS,
  evaluateEla9R11ConstructedResponse,
  scoreEla9R11Diagnostic,
  type Layer0InsightInput,
  type Ela9R11StudentAnswer,
} from '@/lib/diagnostic/ela9r11';

// ─── Question parsing ─────────────────────────────────────────────────────────

interface ParsedQuestion {
  id: string;
  stem: string;
  choices: { letter: string; text: string }[];
  correctLetter: string;
  cognitiveSkill: string;
  classifications: Record<string, string>;
  passageText: string;
  title: string;
  author: string;
  pub_year: string;
  itemType?: string;
  studentFriendlyFeedback?: string;
  teacherRationale?: string;
  ela9r11ItemId?: string;
}

function parseOptions(content: string): Record<string, string> {
  const opts: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.trimStart().match(/^([A-D])[.)]\s*(.+)/);
    if (m) opts[m[1]] = m[2].trim();
  }
  return opts;
}

interface QuestionRow {
  id: string;
  content: string;
  cognitive_skill_targeted: string;
  title?: string;
  author?: string;
  pub_year?: string;
  keyword_flags?: string[];
  option_a_class?: string | null;
  option_b_class?: string | null;
  option_c_class?: string | null;
  option_d_class?: string | null;
}

function parseQuestionContent(
  row: QuestionRow
): Omit<ParsedQuestion, 'passageText' | 'title' | 'author' | 'pub_year'> {
  const raw = row.content;
  const lines = raw.split('\n');
  const get = (prefix: string) => {
    const line = lines.find((l) => l.trimStart().startsWith(prefix));
    return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : '';
  };

  const stem = get('QUESTION:');
  const optMap = parseOptions(raw);
  const choices = (['A', 'B', 'C', 'D'] as const).map((letter) => ({
    letter,
    text: optMap[letter] ?? '',
  }));
  const correctLetter = get('CORRECT:').replace(/[^A-D]/g, '');
  const cognitiveSkill = get('COGNITIVE_SKILL:');

  // Dual-source classification: column values take priority, content markers are fallback.
  // seed-sprint-o.ts stores classifications in option_x_class columns only.
  // buildPassageLibrary.ts and others embed DIAGNOSTIC_CLASSIFICATION_X: in the content string.
  const colMap: Record<string, string | null | undefined> = {
    A: row.option_a_class,
    B: row.option_b_class,
    C: row.option_c_class,
    D: row.option_d_class,
  };
  const classifications: Record<string, string> = {};
  for (const letter of ['A', 'B', 'C', 'D']) {
    const fromCol = colMap[letter];
    if (fromCol) {
      classifications[letter] = fromCol;
    } else {
      const fromContent = get(`DIAGNOSTIC_CLASSIFICATION_${letter}:`);
      if (fromContent) classifications[letter] = fromContent;
    }
  }

  return { id: row.id, stem, choices, correctLetter, cognitiveSkill, classifications };
}

function extractPassageFromContent(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  const raw = qIdx > 0 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const PLACEHOLDER_QUESTIONS: ParsedQuestion[] = [
  {
    id: 'placeholder-1',
    stem: 'What is the main idea of the passage you just read?',
    choices: [
      {
        letter: 'A',
        text: 'The author mainly describes a sequence of events in chronological order.',
      },
      {
        letter: 'B',
        text: 'The author mainly develops a central argument using evidence from the text.',
      },
      { letter: 'C', text: 'The author mainly compares two contrasting perspectives on a theme.' },
      {
        letter: 'D',
        text: 'The author mainly provides background information about a historical period.',
      },
    ],
    correctLetter: 'B',
    cognitiveSkill: 'main_idea',
    classifications: { A: 'literal', B: 'inferential', C: 'analytical', D: 'literal' },
    passageText:
      'Your teacher has assigned this standard for diagnostic assessment. Read carefully and answer the questions that follow to the best of your ability.',
    title: 'Literary Selection',
    author: 'Public Domain',
    pub_year: '',
  },
];

function card11Questions(): ParsedQuestion[] {
  return ELA9R11_SEED_ITEMS.map((item) => {
    const correctOption = item.options.find((option) => option.correct);

    return {
      id: item.id,
      ela9r11ItemId: item.id,
      itemType: item.itemType,
      stem: item.stem,
      choices:
        item.itemType === 'constructed_response'
          ? []
          : item.options.map((option) => ({
              letter: option.letter,
              text: option.text,
            })),
      correctLetter: correctOption?.letter ?? 'A',
      cognitiveSkill: item.subskill,
      classifications: Object.fromEntries(
        item.options.map((option) => [
          option.letter,
          option.correct ? 'CORRECT' : (option.misconceptions[0] ?? 'element_not_identified'),
        ])
      ),
      passageText: item.passage,
      title: item.passageTitle,
      author: 'GOGI 9.R.1.1 diagnostic',
      pub_year: '',
      studentFriendlyFeedback: item.studentFriendlyFeedback,
      teacherRationale: item.teacherRationale ?? item.teacherNote,
    };
  });
}

// ─── State types ──────────────────────────────────────────────────────────────

type DiagnosticView = 'loading' | 'schema' | 'questioning' | 'error';

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  current,
  answered,
  total,
}: {
  current: number;
  answered: number;
  total: number;
}) {
  const pct = Math.round((answered / Math.max(total, 1)) * 100);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderTop: `0.5px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{ flex: 1, background: C.blueLight, height: 6, borderRadius: 3, overflow: 'hidden' }}
      >
        <div
          style={{
            height: 6,
            background: C.blue,
            width: `${pct}%`,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap' }}>
        Question {current + 1} of {total}
      </span>
    </div>
  );
}

// ─── Schema loading screen ────────────────────────────────────────────────────

function SchemaLoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.white,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.ui,
      }}
    >
      <GogiAvatar size={48} state="engaged" />
      <p style={{ color: C.gray, fontSize: 13, textAlign: 'center', marginTop: 12 }}>
        Getting the passage ready for you…
      </p>
      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: C.blueMid,
              animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiagnosticPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [view, setView] = useState<DiagnosticView>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [schemaGenerating, setSchemaGenerating] = useState(false);

  function changeView(next: DiagnosticView) {
    console.log('[Diagnostic] view changed to:', next);
    setView(next);
  }

  const [studentId, setStudentId] = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [layer0InsightInput, setLayer0InsightInput] = useState<Layer0InsightInput | null>(null);
  const [fontSize] = useState(17);

  // Schema state
  const [schemaPayload, setSchemaPayload] = useState<SchemaPayload | null>(null);
  const [schemaInterventionId, setSchemaInterventionId] = useState<string | null>(null);

  // Questioning state
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [card11Answers, setCard11Answers] = useState<Ela9R11StudentAnswer[]>([]);
  const [constructedResponse, setConstructedResponse] = useState('');
  const [constructedError, setConstructedError] = useState('');

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (initialized) return;
    setInitialized(true);

    console.log('[DiagnosticPage] init starting for user:', user.id, 'standard:', standardCode);

    const timeoutId = setTimeout(() => {
      console.error('[DiagnosticPage] ⏱ init timed out after 5s');
      setErrorMsg('Setup took too long. Check your connection and try again.');
      changeView('error');
    }, 5000);

    async function init() {
      try {
        const supabase = createClient();

        // ── Step 1: Get student record ──────────────────────────────────────
        const { data: student, error: sErr } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();
        if (sErr) console.error('[DiagnosticPage] step 1 ERROR:', sErr.message);
        const resolvedStudentId = student?.id ?? '';
        setStudentId(resolvedStudentId);
        if (resolvedStudentId) {
          const hasLayer0 = await getFirstLayer0Complete(supabase, resolvedStudentId);
          if (!hasLayer0) {
            clearTimeout(timeoutId);
            router.push('/layer0');
            return;
          }
        }

        // ── Step 2: Resolve standard UUID ──────────────────────────────────
        const { data: standard, error: stdErr } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();
        if (stdErr) console.error('[DiagnosticPage] step 2 ERROR:', stdErr.message);
        if (!standard) {
          clearTimeout(timeoutId);
          setErrorMsg(`Standard ${standardCode} not found in database.`);
          changeView('error');
          return;
        }
        setStandardUuid(standard.id);

        // ── Step 3: Get session number from standard_progress ───────────────
        let sessionNumber = 1;
        if (resolvedStudentId) {
          const { data: progress } = await supabase
            .from('standard_progress')
            .select('sessions_attempted')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', standard.id)
            .maybeSingle();
          const attempted =
            (progress as { sessions_attempted?: number } | null)?.sessions_attempted ?? 0;
          sessionNumber = Math.max(1, attempted + 1);
        }

        // ── Step 4: Create diagnostic session ──────────────────────────────
        let resolvedSessionId = '';
        if (resolvedStudentId) {
          const layer0 = await getLatestLayer0SessionCalibration(supabase, resolvedStudentId);
          const { data: layer0Profile } = layer0.layer0AssessmentId
            ? await supabase
                .from('layer0_assessments')
                .select('dsb_band, cpt_band, sdst_band, rtv_band')
                .eq('id', layer0.layer0AssessmentId)
                .maybeSingle()
            : { data: null };
          setLayer0InsightInput({
            layer0AssessmentId: layer0.layer0AssessmentId,
            loadCalibration: layer0.loadCalibration,
            teacherReviewFlag: layer0.teacherReviewFlag,
            dsbBand:
              (layer0Profile as { dsb_band?: Layer0InsightInput['dsbBand'] } | null)?.dsb_band ??
              null,
            cptBand:
              (layer0Profile as { cpt_band?: Layer0InsightInput['cptBand'] } | null)?.cpt_band ??
              null,
            sdstBand:
              (layer0Profile as { sdst_band?: Layer0InsightInput['sdstBand'] } | null)?.sdst_band ??
              null,
            rtvBand:
              (layer0Profile as { rtv_band?: Layer0InsightInput['rtvBand'] } | null)?.rtv_band ??
              null,
          });
          const { data: session, error: sessErr } = await supabase
            .from('sessions')
            .insert({
              student_id: resolvedStudentId,
              standard_id: standard.id,
              phase: 'diagnostic',
              status: 'in_progress',
              layer0_assessment_id: layer0.layer0AssessmentId,
              load_calibration_at_session: layer0.loadCalibration,
            })
            .select('id')
            .single();
          if (sessErr) {
            console.error('[DiagnosticPage] step 4 ERROR — session insert:', sessErr.message);
          } else {
            resolvedSessionId = session?.id ?? '';
          }
        }
        setSessionId(resolvedSessionId);

        // ── Step 5: Fetch questions ─────────────────────────────────────────
        // Card 11 is the pilot-grade 9.R.1.1 diagnostic model. It uses a fixed,
        // typed item set so routing is deterministic while the content pipeline
        // grows into this schema.
        const isCard11Diagnostic = standardCode === 'ELA.9.R.1.1';
        let shuffled: QuestionRow[] = [];
        let finalQuestions: ParsedQuestion[];

        if (isCard11Diagnostic) {
          finalQuestions = card11Questions();
        } else {
          const { data: qRows, error: qErr } = await supabase
            .from('questions')
            .select(
              'id, content, cognitive_skill_targeted, title, author, pub_year, keyword_flags, option_a_class, option_b_class, option_c_class, option_d_class'
            )
            .eq('standard_id', standard.id)
            .order('created_at', { ascending: false })
            .limit(10);
          if (qErr) console.error('[DiagnosticPage] step 5 ERROR:', qErr.message);

          shuffled = [...((qRows ?? []) as QuestionRow[])].sort(() => Math.random() - 0.5);

          const parsed: ParsedQuestion[] = shuffled.map((row) => ({
            ...parseQuestionContent(row),
            passageText: extractPassageFromContent(row.content),
            title: row.title ?? 'Literary Selection',
            author: row.author ?? 'Public Domain',
            pub_year: row.pub_year ?? '',
          }));

          finalQuestions = parsed.length > 0 ? parsed : PLACEHOLDER_QUESTIONS;
        }

        // ── Step 6: Store diagnostic question IDs ───────────────────────────
        if (resolvedSessionId && shuffled.length > 0) {
          const questionIds = shuffled.map((q) => q.id);
          const { error: updateErr } = await supabase
            .from('sessions')
            .update({
              diagnostic_question_id: shuffled[0].id,
              diagnostic_question_ids: questionIds,
            })
            .eq('id', resolvedSessionId);
          if (updateErr)
            console.warn('[DiagnosticPage] question IDs store failed:', updateErr.message);
        }

        // ── Critical path complete — clear timeout ──────────────────────────
        clearTimeout(timeoutId);
        setQuestions(finalQuestions);

        // ── Step 7: Schema demand analysis (after critical path) ────────────
        const firstQuestion = finalQuestions[0];
        const hasRealQuestion = firstQuestion && !firstQuestion.id.startsWith('placeholder');

        if (!isCard11Diagnostic && resolvedStudentId && resolvedSessionId && hasRealQuestion) {
          // ── Check if schema intervention already exists for this session ──
          const { data: existingSchema } = await supabase
            .from('schema_interventions')
            .select('id, generated_payload')
            .eq('session_id', resolvedSessionId)
            .eq('student_id', resolvedStudentId)
            .maybeSingle();

          if (existingSchema) {
            // Schema was already generated — check if student responded
            const { data: existingResponse } = await supabase
              .from('schema_responses')
              .select('id')
              .eq('schema_intervention_id', existingSchema.id)
              .maybeSingle();

            if (existingResponse) {
              // Already completed — skip schema entirely
              console.log('[DiagnosticPage] schema already completed — going to questioning');
              changeView('questioning');
              return;
            }

            // Generated but not yet responded — show cached card, no regeneration
            console.log('[DiagnosticPage] schema cached — resuming card');
            setSchemaPayload(existingSchema.generated_payload as SchemaPayload);
            setSchemaInterventionId(existingSchema.id as string);
            changeView('schema');
            return;
          }

          // No existing schema — run demand analysis and generate if needed
          const demand = await analyzeSchemaDemand(resolvedStudentId, standard.id, sessionNumber);
          console.log('[DiagnosticPage] schema demand:', demand);

          if (demand.shouldFire) {
            setSchemaGenerating(true);
            try {
              const schemaRes = await fetch('/api/schema/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: resolvedSessionId,
                  studentId: resolvedStudentId,
                  questionId: firstQuestion.id,
                  standardId: standard.id,
                  standardCode,
                }),
              });
              if (schemaRes.ok) {
                const schemaData = (await schemaRes.json()) as {
                  payload?: SchemaPayload;
                  interventionId?: string;
                };
                if (schemaData.payload) {
                  setSchemaPayload(schemaData.payload);
                  setSchemaInterventionId(schemaData.interventionId ?? null);
                  setSchemaGenerating(false);
                  changeView('schema');
                  return;
                }
              }
              console.warn(
                '[DiagnosticPage] schema generate returned no payload — proceeding to questioning'
              );
            } catch (err) {
              console.error('[DiagnosticPage] schema generate failed:', err);
            }
            setSchemaGenerating(false);
          }
        }

        changeView('questioning');
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('[DiagnosticPage] ❌ init threw:', err);
        setErrorMsg('Something went wrong. Please refresh.');
        changeView('error');
      }
    }

    init();
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, standardId]);

  // ── Answer selection ─────────────────────────────────────────────────────────

  async function handleSelect(letter: string) {
    if (locked || selectedLetter) return;
    setSelectedLetter(letter);
    setLocked(true);

    const q = questions[currentQ];
    const nextCard11Answers = q.ela9r11ItemId
      ? [
          ...card11Answers.filter((answer) => answer.itemId !== q.ela9r11ItemId),
          {
            itemId: q.ela9r11ItemId,
            selectedLetter: letter as Ela9R11StudentAnswer['selectedLetter'],
          },
        ]
      : card11Answers;

    if (q.ela9r11ItemId) setCard11Answers(nextCard11Answers);

    setTimeout(async () => {
      if (sessionId && studentId && standardUuid) {
        try {
          const responseQuestionId =
            q.ela9r11ItemId || q.id.startsWith('placeholder') ? null : q.id;
          console.log('[Diagnostic] writing response — question_id:', responseQuestionId);
          await fetch('/api/responses/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              question_id: responseQuestionId,
              student_id: studentId,
              standard_id: standardUuid,
              cognitive_skill_targeted: q.cognitiveSkill,
              diagnostic_classification:
                q.classifications[letter] && q.classifications[letter] !== 'CORRECT'
                  ? q.classifications[letter]
                  : null,
              student_response: q.ela9r11ItemId
                ? JSON.stringify({
                    model: 'ela9r11_card11',
                    item_id: q.ela9r11ItemId,
                    selected_letter: letter,
                    selected_text: q.choices.find((choice) => choice.letter === letter)?.text ?? '',
                    misconception_flags:
                      q.classifications[letter] && q.classifications[letter] !== 'CORRECT'
                        ? [q.classifications[letter]]
                        : [],
                  })
                : letter,
              mastery_achieved: letter === q.correctLetter,
              attempt_number: 1,
            }),
          });
        } catch (err) {
          console.error('[DiagnosticPage] response write error:', err);
        }
      }

      const nextQ = currentQ + 1;
      setAnswered(nextQ);

      if (nextQ >= questions.length) {
        if (sessionId) {
          try {
            const result =
              standardCode === 'ELA.9.R.1.1'
                ? await completeCard11Diagnostic(sessionId, nextCard11Answers)
                : await classifySession(sessionId);
            console.log('[DiagnosticPage] classification result:', result);

            // Persist all identified gaps before routing
            if (!result.skipTeach && studentId && standardUuid && result.allGaps.length > 0) {
              try {
                const supabaseGaps = createClient();
                await supabaseGaps.from('standard_progress').upsert(
                  {
                    student_id: studentId,
                    standard_id: standardUuid,
                    current_status: result.skipTeach ? 'mastered' : 'intervening',
                    gaps_identified: result.allGaps,
                    current_gap: result.dominant,
                    last_session_at: new Date().toISOString(),
                  },
                  { onConflict: 'student_id,standard_id' }
                );
              } catch (gapErr) {
                console.error('[DiagnosticPage] gaps upsert failed:', gapErr);
              }
            }

            router.push(`/standard/${standardId}/${result.skipTeach ? 'practice' : 'bridge'}`);
          } catch (err) {
            console.error('[DiagnosticPage] classifySession error:', err);
            router.push(`/standard/${standardId}/bridge`);
          }
        } else {
          router.push(`/standard/${standardId}/bridge`);
        }
      } else {
        setCurrentQ(nextQ);
        setSelectedLetter(null);
        setConstructedResponse('');
        setConstructedError('');
        setLocked(false);
      }
    }, 1500);
  }

  async function submitConstructedResponse() {
    if (locked) return;
    const q = questions[currentQ];
    const item = ELA9R11_SEED_ITEMS.find((seedItem) => seedItem.id === q.ela9r11ItemId);
    if (!item) return;

    const clean = constructedResponse.trim();
    if (clean.split(/\s+/).filter(Boolean).length < 8) {
      setConstructedError(
        'Write at least one clear sentence: name the element, use a detail, explain what it adds.'
      );
      return;
    }

    setConstructedError('');
    setLocked(true);
    const evaluation = evaluateEla9R11ConstructedResponse(clean, item);
    const answer: Ela9R11StudentAnswer = {
      itemId: item.id,
      constructedResponse: clean,
      constructedEvaluation: evaluation,
    };
    const nextCard11Answers = [
      ...card11Answers.filter((existing) => existing.itemId !== item.id),
      answer,
    ];
    setCard11Answers(nextCard11Answers);

    if (sessionId && studentId && standardUuid) {
      try {
        await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            question_id: null,
            student_id: studentId,
            standard_id: standardUuid,
            cognitive_skill_targeted: q.cognitiveSkill,
            diagnostic_classification: evaluation.accepted
              ? null
              : evaluation.primaryMisconceptionFlag,
            student_response: JSON.stringify({
              model: 'ela9r11_card11',
              item_id: item.id,
              constructed_response: clean,
              evaluation,
              student_feedback: evaluation.studentFeedback,
              teacher_note: evaluation.teacherNote,
            }),
            mastery_achieved: evaluation.accepted,
            attempt_number: 1,
          }),
        });
      } catch (err) {
        console.error('[DiagnosticPage] constructed response write error:', err);
      }
    }

    const nextQ = currentQ + 1;
    setAnswered(nextQ);

    if (nextQ >= questions.length) {
      if (sessionId) {
        try {
          const result = await completeCard11Diagnostic(sessionId, nextCard11Answers);
          console.log('[DiagnosticPage] Card 11 classification result:', result);
          router.push(`/standard/${standardId}/${result.skipTeach ? 'practice' : 'bridge'}`);
        } catch (err) {
          console.error('[DiagnosticPage] Card 11 classify error:', err);
          router.push(`/standard/${standardId}/bridge`);
        }
      } else {
        router.push(`/standard/${standardId}/bridge`);
      }
    } else {
      setCurrentQ(nextQ);
      setSelectedLetter(null);
      setConstructedResponse('');
      setConstructedError('');
      setLocked(false);
    }
  }

  async function completeCard11Diagnostic(sessionIdValue: string, answers: Ela9R11StudentAnswer[]) {
    const result = scoreEla9R11Diagnostic(ELA9R11_SEED_ITEMS, answers);
    const insight = buildEla9R11DiagnosticInsight(
      result,
      layer0InsightInput ?? {
        layer0AssessmentId: null,
        loadCalibration: null,
        teacherReviewFlag: false,
      }
    );
    const dominant = result.primaryMisconception ?? 'CORRECT';
    const allGaps = [
      ...(result.primaryMisconception ? [result.primaryMisconception] : []),
      ...result.secondaryMisconceptions,
    ];
    const skipTeach = result.correctItems >= result.totalItems;
    const supabase = createClient();

    const { error } = await supabase
      .from('sessions')
      .update({
        dominant_classification: skipTeach ? 'CORRECT' : dominant,
        gap_classifications: allGaps,
        classification_confidence: insight.confidenceScore,
        needs_teacher_review:
          insight.confidenceLabel !== 'strong_signal' ||
          insight.likelyDriver === 'cognitive_load_interaction',
        mastery_achieved: skipTeach,
        status: 'complete',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionIdValue);

    if (error) console.error('[DiagnosticPage] Card 11 session update failed:', error.message);

    if (studentId && standardUuid) {
      const { error: progressErr } = await supabase.from('standard_progress').upsert(
        {
          student_id: studentId,
          standard_id: standardUuid,
          current_status: skipTeach ? 'mastered' : 'intervening',
          gaps_identified: allGaps,
          current_gap: skipTeach ? null : dominant,
          last_session_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,standard_id' }
      );

      if (progressErr)
        console.error('[DiagnosticPage] Card 11 progress upsert failed:', progressErr.message);
    }

    try {
      const { error: insightErr } = await supabase.from('diagnostic_insights').upsert(
        {
          session_id: sessionIdValue,
          student_id: studentId,
          standard_id: standardUuid,
          layer0_assessment_id: insight.layer0AssessmentId,
          load_calibration: insight.loadCalibration,
          primary_misconception: insight.primaryMisconception,
          secondary_misconceptions: insight.secondaryMisconceptions,
          recommended_route: insight.recommendedRoute,
          confidence_label: insight.confidenceLabel,
          confidence_score: insight.confidenceScore,
          likely_driver: insight.likelyDriver,
          insight,
          growth_signal: 'not_measured',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      );

      if (insightErr) console.warn('[DiagnosticPage] insight save skipped:', insightErr.message);
    } catch (insightErr) {
      console.warn('[DiagnosticPage] insight save unavailable:', insightErr);
    }

    return {
      dominant: skipTeach ? 'CORRECT' : dominant,
      allGaps,
      gapCounts: result.itemResults.reduce<Record<string, number>>((counts, item) => {
        for (const flag of item.misconceptions) counts[flag] = (counts[flag] ?? 0) + 1;
        return counts;
      }, {}),
      skipTeach,
      confidence: insight.confidenceScore,
      confidenceLabel: insight.confidenceLabel,
      likelyDriver: insight.likelyDriver,
      recommendedRoute: result.recommendedRoute,
      diagnosticInsight: insight,
      teacherSummary: result.teacherSummary,
    };
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  if (schemaGenerating) return <SchemaLoadingScreen />;

  if (view === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.ui,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.gray, fontSize: 14, marginBottom: 8 }}>
            Setting up your diagnostic…
          </p>
          <p style={{ color: C.blueMid, fontSize: 11 }}>
            (check browser console if this takes more than 5 seconds)
          </p>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.ui,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <p style={{ color: C.red, fontSize: 15, marginBottom: 12 }}>{errorMsg}</p>
          <button
            onClick={() => router.push('/dashboard/student')}
            style={{
              background: C.navy,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONTS.ui,
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Schema view ─────────────────────────────────────────────────────────────

  if (view === 'schema' && schemaPayload) {
    return (
      <SchemaCard
        payload={schemaPayload}
        interventionId={schemaInterventionId}
        studentId={studentId}
        onUnlock={() => changeView('questioning')}
      />
    );
  }

  // ── Questioning view ─────────────────────────────────────────────────────────

  const q = questions[currentQ] ?? null;
  if (!q) return null;

  const questionProgress = Math.round(((currentQ + 1) / (questions.length || 10)) * 100);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: C.white,
        fontFamily: FONTS.ui,
      }}
    >
      <GogiNav
        subtitle={`${standardCode} | Diagnostic | Question ${currentQ + 1} of ${questions.length}`}
        showLogout
        showDashboardLink
      />

      {/* Blue progress bar */}
      <div style={{ height: 3, background: C.blueLight, flexShrink: 0 }}>
        <div
          style={{
            height: 3,
            background: C.blue,
            width: `${questionProgress}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="questioning-columns">
        {/* Left — 55%: passage */}
        <div
          style={{
            flex: '0 0 55%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          {/* Passage attribution header */}
          <div
            style={{ padding: '10px 16px', borderBottom: `0.5px solid ${C.border}`, flexShrink: 0 }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.gray,
                textTransform: 'uppercase' as const,
                letterSpacing: 1,
                marginBottom: 2,
              }}
            >
              PASSAGE REFERENCE
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{q.title}</div>
            {(q.author || q.pub_year) && (
              <div style={{ fontSize: 11, color: C.gray }}>
                {q.author}
                {q.pub_year ? ` (${q.pub_year})` : ''}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {q.passageText
              .split(/\n+/)
              .filter(Boolean)
              .map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: fontSize,
                    lineHeight: 1.75,
                    color: C.dark,
                    marginBottom: '1em',
                    fontFamily: FONTS.passage,
                  }}
                >
                  {para}
                </p>
              ))}
            <p
              style={{
                fontSize: 11,
                color: C.gray,
                fontStyle: 'italic',
                marginTop: 8,
                fontFamily: FONTS.ui,
              }}
            >
              Passage remains visible during all {questions.length} questions
            </p>
          </div>
        </div>

        {/* Right — 45%: question panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.gray,
                textTransform: 'uppercase' as const,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              QUESTION {currentQ + 1} OF {questions.length}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: C.dark,
                lineHeight: 1.55,
                marginBottom: 18,
              }}
            >
              {q.stem}
            </div>

            {q.choices.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    background: '#F7FAFC',
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.navy, marginBottom: 4 }}>
                    Build the answer
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                    Name one literary element. Point to one text detail. Explain what that detail
                    adds to meaning, mood, style, or theme.
                  </div>
                </div>
                <textarea
                  value={constructedResponse}
                  onChange={(e) => setConstructedResponse(e.target.value)}
                  disabled={locked}
                  placeholder="The author uses..."
                  style={{
                    width: '100%',
                    minHeight: 132,
                    resize: 'vertical',
                    borderRadius: 10,
                    border: constructedError ? `2px solid ${C.red}` : `1.5px solid ${C.border}`,
                    padding: 12,
                    fontFamily: FONTS.ui,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: C.dark,
                    outline: 'none',
                  }}
                />
                {constructedError && (
                  <div style={{ fontSize: 12, color: C.red, lineHeight: 1.4 }}>
                    {constructedError}
                  </div>
                )}
                <button
                  onClick={submitConstructedResponse}
                  disabled={locked}
                  style={{
                    minHeight: 46,
                    border: 'none',
                    borderRadius: 10,
                    background: locked ? C.gray : C.navy,
                    color: C.white,
                    fontFamily: FONTS.ui,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: locked ? 'default' : 'pointer',
                  }}
                >
                  Submit response
                </button>
              </div>
            ) : (
              q.choices.map(({ letter, text }) => {
                const isSelected = selectedLetter === letter;
                return (
                  <button
                    key={letter}
                    onClick={() => handleSelect(letter)}
                    disabled={locked}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      width: '100%',
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 10,
                      border: isSelected ? `2px solid ${C.gray}` : `1.5px solid ${C.border}`,
                      background: C.white,
                      cursor: locked ? 'default' : 'pointer',
                      textAlign: 'left',
                      fontFamily: FONTS.ui,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!locked && !isSelected) {
                        e.currentTarget.style.background = '#FAFAFA';
                        e.currentTarget.style.borderColor = C.gray;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!locked && !isSelected) {
                        e.currentTarget.style.background = C.white;
                        e.currentTarget.style.borderColor = C.border;
                      }
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: isSelected ? C.gray : C.navy,
                        color: C.white,
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {letter}
                    </div>
                    <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, paddingTop: 4 }}>
                      {text}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <ProgressBar current={currentQ} answered={answered} total={questions.length} />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .questioning-columns > div:first-child { display: none !important; }
          .questioning-columns > div:last-child { flex: 0 0 100% !important; }
        }
      `}</style>
    </div>
  );
}
