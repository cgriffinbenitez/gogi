'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiNav } from '@/components/nav/GogiNav';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { classifySession } from '@/lib/classify/classifySession';
import { analyzeSchemaDemand } from '@/lib/schema/SchemaDemandAnalyzer';
import { SchemaCard } from '@/components/schema/SchemaCard';
import { C, FONTS } from '@/lib/constants/design';
import type { SchemaPayload } from '@/lib/schema/types';

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
  approved?: boolean | null;
}

function parseQuestionContent(row: QuestionRow): Omit<ParsedQuestion, 'passageText' | 'title' | 'author' | 'pub_year'> {
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

function isClassifiedDiagnosticQuestion(q: ParsedQuestion): boolean {
  return (
    Boolean(q.stem) &&
    Boolean(q.correctLetter) &&
    q.choices.every((choice) => Boolean(choice.text)) &&
    ['A', 'B', 'C', 'D'].every((letter) => Boolean(q.classifications[letter]))
  );
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
      { letter: 'A', text: 'The author mainly describes a sequence of events in chronological order.' },
      { letter: 'B', text: 'The author mainly develops a central argument using evidence from the text.' },
      { letter: 'C', text: 'The author mainly compares two contrasting perspectives on a theme.' },
      { letter: 'D', text: 'The author mainly provides background information about a historical period.' },
    ],
    correctLetter: 'B',
    cognitiveSkill: 'main_idea',
    classifications: { A: 'literal', B: 'inferential', C: 'analytical', D: 'literal' },
    passageText: 'Your teacher has assigned this standard for diagnostic assessment. Read carefully and answer the questions that follow to the best of your ability.',
    title: 'Literary Selection',
    author: 'Public Domain',
    pub_year: '',
  },
];

// ─── State types ──────────────────────────────────────────────────────────────

type DiagnosticView = 'loading' | 'schema' | 'questioning' | 'error';

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, answered, total }: { current: number; answered: number; total: number }) {
  const pct = Math.round((answered / Math.max(total, 1)) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: `0.5px solid ${C.border}`, flexShrink: 0 }}>
      <div style={{ flex: 1, background: C.blueLight, height: 6, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: 6, background: C.blue, width: `${pct}%`, borderRadius: 3, transition: 'width 0.3s ease' }} />
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
    <div style={{
      minHeight: '100vh', background: C.white,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: FONTS.ui,
    }}>
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
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: C.blueMid,
            animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiagnosticPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [view,        setView]        = useState<DiagnosticView>('loading');
  const [errorMsg,    setErrorMsg]    = useState('');
  const initialized = useRef(false);
  const [schemaGenerating, setSchemaGenerating] = useState(false);

  function changeView(next: DiagnosticView) {
    console.log('[Diagnostic] view changed to:', next);
    setView(next);
  }

  const [studentId,    setStudentId]    = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId,    setSessionId]    = useState('');
  const [sessionNumber, setSessionNumber] = useState(1);
  const [questions,    setQuestions]    = useState<ParsedQuestion[]>([]);
  const [fontSize] = useState(17);

  // Schema state
  const [schemaPayload,        setSchemaPayload]        = useState<SchemaPayload | null>(null);
  const [schemaInterventionId, setSchemaInterventionId] = useState<string | null>(null);

  // Questioning state
  const [currentQ,        setCurrentQ]        = useState(0);
  const [selectedLetter,  setSelectedLetter]  = useState<string | null>(null);
  const [locked,          setLocked]          = useState(false);
  const [answered,        setAnswered]        = useState(0);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (initialized.current) return;
    initialized.current = true;

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
        let resolvedSessionNumber = 1;
        if (resolvedStudentId) {
          const { data: progress } = await supabase
            .from('standard_progress')
            .select('sessions_attempted')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', standard.id)
            .maybeSingle();
          const attempted = (progress as { sessions_attempted?: number } | null)?.sessions_attempted ?? 0;
          resolvedSessionNumber = Math.max(1, attempted + 1);
        }
        setSessionNumber(resolvedSessionNumber);

        // ── Step 4: Resolve diagnostic session ─────────────────────────────
        let resolvedSessionId = '';
        if (resolvedStudentId) {
          const { data: completedSession } = await supabase
            .from('sessions')
            .select('id, dominant_classification')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', standard.id)
            .eq('phase', 'diagnostic')
            .eq('status', 'complete')
            .not('dominant_classification', 'is', null)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          if (completedSession?.id) {
            clearTimeout(timeoutId);
            router.push(`/standard/${standardId}/bridge`);
            return;
          }

          const { data: existingSession } = await supabase
            .from('sessions')
            .select('id')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', standard.id)
            .eq('phase', 'diagnostic')
            .eq('status', 'in_progress')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingSession?.id) {
            resolvedSessionId = existingSession.id;
          } else {
            const { data: session, error: sessErr } = await supabase
            .from('sessions')
            .insert({ student_id: resolvedStudentId, standard_id: standard.id, phase: 'diagnostic', status: 'in_progress' })
            .select('id')
            .single();
            if (sessErr) {
              console.error('[DiagnosticPage] step 4 ERROR — session insert:', sessErr.message);
            } else {
              resolvedSessionId = session?.id ?? '';
            }
          }
        }
        setSessionId(resolvedSessionId);

        // ── Step 5: Fetch questions ─────────────────────────────────────────
        const { data: qRows, error: qErr } = await supabase
          .from('questions')
          .select('id, content, cognitive_skill_targeted, title, author, pub_year, keyword_flags, option_a_class, option_b_class, option_c_class, option_d_class, approved')
          .eq('standard_id', standard.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (qErr) console.error('[DiagnosticPage] step 5 ERROR:', qErr.message);

        const parsedRows = (qRows ?? []).map((row) => ({
          row,
          question: {
          ...parseQuestionContent(row as QuestionRow),
          passageText: extractPassageFromContent(row.content),
          title:       row.title    ?? 'Literary Selection',
          author:      row.author   ?? 'Public Domain',
          pub_year:    row.pub_year ?? '',
          },
        }));

        const classifiedRows = parsedRows.filter(({ question }) => isClassifiedDiagnosticQuestion(question));
        const approvedClassifiedRows = classifiedRows.filter(({ row }) => row.approved === true);
        const diagnosticRows = approvedClassifiedRows.length > 0 ? approvedClassifiedRows : classifiedRows;
        const shuffled = [...diagnosticRows].sort(() => Math.random() - 0.5).slice(0, 10);
        const parsed: ParsedQuestion[] = shuffled.map(({ question }) => question);

        const finalQuestions = parsed.length > 0 ? parsed : PLACEHOLDER_QUESTIONS;

        // ── Step 6: Store diagnostic question IDs ───────────────────────────
        if (resolvedSessionId && shuffled.length > 0) {
          const questionIds = shuffled.map(({ row }) => row.id);
          const { error: updateErr } = await supabase
            .from('sessions')
            .update({ diagnostic_question_id: shuffled[0].row.id, diagnostic_question_ids: questionIds })
            .eq('id', resolvedSessionId);
          if (updateErr) console.warn('[DiagnosticPage] question IDs store failed:', updateErr.message);
        }

        // ── Critical path complete — clear timeout ──────────────────────────
        clearTimeout(timeoutId);
        setQuestions(finalQuestions);

        // ── Step 7: Schema demand analysis (after critical path) ────────────
        const firstQuestion = finalQuestions[0];
        const hasRealQuestion = firstQuestion && !firstQuestion.id.startsWith('placeholder');

        if (resolvedStudentId && resolvedSessionId && hasRealQuestion) {
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
          const demand = await analyzeSchemaDemand(resolvedStudentId, standard.id, resolvedSessionNumber);
          console.log('[DiagnosticPage] schema demand:', demand);

          if (demand.shouldFire) {
            setSchemaGenerating(true);
            try {
              const schemaRes = await fetch('/api/schema/generate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId:    resolvedSessionId,
                  studentId:    resolvedStudentId,
                  questionId:   firstQuestion.id,
                  standardId:   standard.id,
                  standardCode,
                }),
              });
              if (schemaRes.ok) {
                const schemaData = await schemaRes.json() as { payload?: SchemaPayload; interventionId?: string };
                if (schemaData.payload) {
                  setSchemaPayload(schemaData.payload);
                  setSchemaInterventionId(schemaData.interventionId ?? null);
                  setSchemaGenerating(false);
                  changeView('schema');
                  return;
                }
              }
              console.warn('[DiagnosticPage] schema generate returned no payload — proceeding to questioning');
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

    setTimeout(async () => {
      if (sessionId && studentId && standardUuid) {
        try {
          console.log('[Diagnostic] writing response — question_id:', q.id.startsWith('placeholder') ? null : q.id);
          await fetch('/api/responses/create', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id:                sessionId,
              question_id:               q.id.startsWith('placeholder') ? null : q.id,
              student_id:                studentId,
              standard_id:               standardUuid,
              cognitive_skill_targeted:  q.cognitiveSkill,
              diagnostic_classification: (q.classifications[letter] && q.classifications[letter] !== 'CORRECT') ? q.classifications[letter] : null,
              student_response:          letter,
              mastery_achieved:          letter === q.correctLetter,
              attempt_number:            1,
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
            const result = await classifySession(sessionId);
            console.log('[DiagnosticPage] classification result:', result);

            // Persist all identified gaps before routing
            if (studentId && standardUuid) {
              try {
                const supabaseGaps = createClient();
                const gapsIdentified = result.skipTeach
                  ? []
                  : (result.allGaps.length > 0 ? result.allGaps : [result.dominant]);
                await supabaseGaps.from('standard_progress').upsert({
                  student_id:          studentId,
                  standard_id:         standardUuid,
                  current_status:      result.skipTeach ? 'practicing' : 'intervening',
                  sessions_attempted:  sessionNumber,
                  sessions_passed:     result.skipTeach ? 1 : 0,
                  last_session_at:     new Date().toISOString(),
                  gaps_identified:     gapsIdentified,
                  current_gap:         result.skipTeach ? null : result.dominant,
                }, { onConflict: 'student_id,standard_id' });
              } catch (gapErr) {
                console.error('[DiagnosticPage] standard_progress upsert failed:', gapErr);
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
        setLocked(false);
      }
    }, 1500);
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  if (schemaGenerating) return <SchemaLoadingScreen />;

  if (view === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.gray, fontSize: 14, marginBottom: 8 }}>Setting up your diagnostic…</p>
          <p style={{ color: C.blueMid, fontSize: 11 }}>(check browser console if this takes more than 5 seconds)</p>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <p style={{ color: C.red, fontSize: 15, marginBottom: 12 }}>{errorMsg}</p>
          <button
            onClick={() => router.push('/dashboard/student')}
            style={{ background: C.navy, color: C.white, border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui }}
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <GogiNav subtitle={`${standardCode} | Diagnostic | Question ${currentQ + 1} of ${questions.length}`} showLogout showDashboardLink />

      {/* Blue progress bar */}
      <div style={{ height: 3, background: C.blueLight, flexShrink: 0 }}>
        <div style={{ height: 3, background: C.blue, width: `${questionProgress}%`, transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="questioning-columns">
        {/* Left — 55%: passage */}
        <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {/* Passage attribution header */}
          <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 2 }}>
              PASSAGE REFERENCE
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{q.title}</div>
            {(q.author || q.pub_year) && (
              <div style={{ fontSize: 11, color: C.gray }}>
                {q.author}{q.pub_year ? ` (${q.pub_year})` : ''}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {q.passageText.split(/\n+/).filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: fontSize, lineHeight: 1.75, color: C.dark, marginBottom: '1em', fontFamily: FONTS.passage }}>
                {para}
              </p>
            ))}
            <p style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginTop: 8, fontFamily: FONTS.ui }}>
              Passage remains visible during all {questions.length} questions
            </p>
          </div>
        </div>

        {/* Right — 45%: question panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 }}>
              QUESTION {currentQ + 1} OF {questions.length}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.dark, lineHeight: 1.55, marginBottom: 18 }}>
              {q.stem}
            </div>

            {q.choices.map(({ letter, text }) => {
              const isSelected = selectedLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => handleSelect(letter)}
                  disabled={locked}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    width: '100%', padding: 12, marginBottom: 8,
                    borderRadius: 10,
                    border: isSelected ? `2px solid ${C.gray}` : `1.5px solid ${C.border}`,
                    background: C.white,
                    cursor: locked ? 'default' : 'pointer',
                    textAlign: 'left', fontFamily: FONTS.ui,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!locked && !isSelected) { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.borderColor = C.gray; } }}
                  onMouseLeave={(e) => { if (!locked && !isSelected) { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.border; } }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: isSelected ? C.gray : C.navy, color: C.white, fontSize: 12, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {letter}
                  </div>
                  <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, paddingTop: 4 }}>{text}</span>
                </button>
              );
            })}
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
