'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { GogiNav } from '@/components/nav/GogiNav';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { validateResponse } from '@/lib/validation/validateResponse';
import { getTeachRoute, CLASSIFICATION_TO_SKILL } from '@/lib/classify/getTeachRoute';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';

// ─── Types ────────────────────────────────────────────────────────────────────

type QRow = {
  id: string;
  content: string;
  cognitive_skill_targeted: string;
  title: string | null;
  author: string | null;
  pub_year: string | null;
};

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

type PracticeView = 'loading' | 'error' | 'practice' | 'retry-prompt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPassageFromContent(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  const raw = qIdx > 0 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Robust option parser — handles both "A)" and "A." formats line by line */
function parseOptions(content: string): Record<string, string> {
  const opts: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.trimStart().match(/^([A-D])[.)]\s*(.+)/);
    if (m) opts[m[1]] = m[2].trim();
  }
  return opts;
}

function parseQuestionContent(raw: string, id: string) {
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
  const classifications: Record<string, string> = {};
  for (const letter of ['A', 'B', 'C', 'D']) {
    const val = get(`DIAGNOSTIC_CLASSIFICATION_${letter}:`);
    if (val) classifications[letter] = val;
  }
  return { id, stem, choices, correctLetter, cognitiveSkill, classifications };
}

async function fetchPracticeFeedback(
  standardCode: string,
  passageText: string,
  questionStem: string,
  selectedOption: string,
  selectedOptionText: string,
  correctOption: string,
  isCorrect: boolean,
  attemptNumber: number,
): Promise<string> {
  try {
    const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'practice_feedback',
        standardCode,
        standardTitle: standard?.title ?? '',
        passageText,
        questionStem,
        selectedOption,
        selectedOptionText,
        correctOption,
        isCorrect: String(isCorrect),
        attemptNumber: String(attemptNumber),
      }),
    });
    if (!res.ok) return isCorrect ? "That's the move." : 'Look at the passage again. Try again.';
    const data = await res.json();
    return data.text ?? (isCorrect ? "That's the move." : 'Look again. Try again.');
  } catch {
    return isCorrect ? "That's the move." : 'Look at the passage again. Try again.';
  }
}

// ─── Classification-aware question fetching ───────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * getPracticeQuestions — 4-tier fallback chain.
 *
 * Tier 1: classification-matched skill + unseen passage
 * Tier 2: classification-matched skill, any passage
 * Tier 3: any approved questions from an unseen passage
 * Tier 4: any approved questions
 *
 * Title exclusion is done in JS (avoids complex PostgREST quoting for text arrays).
 * Returns both the selected questions and the student's current seen-title list
 * so finalizePractice can append the new title without a second DB read.
 */
async function getPracticeQuestions(
  supabase: ReturnType<typeof createClient>,
  standardId: string,
  studentId: string,
  classification: string,
  excludeIds: string[],
): Promise<{ questions: QRow[]; seenTitles: string[] }> {
  const skill =
    CLASSIFICATION_TO_SKILL[classification] ??
    'characterization → layers of meaning';

  // Fetch seen passage titles for this student + standard
  const { data: progress } = await supabase
    .from('standard_progress')
    .select('seen_passage_titles')
    .eq('student_id', studentId)
    .eq('standard_id', standardId)
    .maybeSingle();

  const seenTitles: string[] =
    (progress as { seen_passage_titles?: string[] } | null)
      ?.seen_passage_titles ?? [];

  // Base query builder — always excludes already-seen diagnostic questions
  const baseQuery = () => {
    let q = supabase
      .from('questions')
      .select('id, content, cognitive_skill_targeted, title, author, pub_year')
      .eq('standard_id', standardId)
      .eq('approved', true);
    if (excludeIds.length > 0) {
      q = q.not('id', 'in', `(${excludeIds.join(',')})`);
    }
    return q;
  };

  const pick = (rows: QRow[], excludeTitles: string[]): QRow[] => {
    const filtered = excludeTitles.length > 0
      ? rows.filter((r) => !excludeTitles.includes(r.title ?? ''))
      : rows;
    return shuffleArray(filtered).slice(0, 5);
  };

  // ── Tier 1: skill match + unseen passage ───────────────────────────────────
  if (seenTitles.length > 0) {
    const { data: t1 } = await baseQuery()
      .eq('cognitive_skill_targeted', skill)
      .limit(30);
    const t1picked = pick(t1 ?? [], seenTitles);
    if (t1picked.length >= 5) {
      console.log(`[Practice] Tier 1 — skill="${skill}" unseen passage`);
      return { questions: t1picked, seenTitles };
    }
  }

  // ── Tier 2: skill match, any passage ──────────────────────────────────────
  {
    const { data: t2 } = await baseQuery()
      .eq('cognitive_skill_targeted', skill)
      .limit(30);
    const t2picked = shuffleArray(t2 ?? []).slice(0, 5);
    if (t2picked.length >= 5) {
      console.log(`[Practice] Tier 2 — skill="${skill}" any passage`);
      return { questions: t2picked, seenTitles };
    }
  }

  // ── Tier 3: any approved from unseen passage ───────────────────────────────
  if (seenTitles.length > 0) {
    const { data: t3 } = await baseQuery().limit(50);
    const t3picked = pick(t3 ?? [], seenTitles);
    if (t3picked.length >= 5) {
      console.log(`[Practice] Tier 3 — any skill, unseen passage`);
      return { questions: t3picked, seenTitles };
    }
  }

  // ── Tier 4: any approved questions ────────────────────────────────────────
  const { data: t4 } = await baseQuery().limit(50);
  const t4picked = shuffleArray(t4 ?? []).slice(0, 5);
  console.log(`[Practice] Tier 4 fallback — any approved (${t4picked.length} questions)`);
  return { questions: t4picked, seenTitles };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PracticePage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];

  // ── DB context ──────────────────────────────────────────────────────────────
  const [studentId, setStudentId] = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId, setSessionId] = useState('');
  // Current classification drives reclassification routing
  const [currentClassification, setCurrentClassification] = useState('vocabulary_gap');

  // ── Content ─────────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  // Seen passage titles — fetched during init, used to track rotation
  const [seenTitles, setSeenTitles] = useState<string[]>([]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [view, setView] = useState<PracticeView>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  // Accumulate per-question mastery results to evaluate at the end
  const questionResultsRef = useRef<boolean[]>([]);

  // ── Per-question interaction state ──────────────────────────────────────────
  const [lockedLetters, setLockedLetters] = useState<string[]>([]);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [restatText, setRestatText] = useState('');
  const [restatValid, setRestatValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    const timeoutId = setTimeout(() => {
      setErrorMsg('Setup took too long. Check your connection and try again.');
      setView('error');
    }, 8000);

    async function init() {
      try {
        const supabase = createClient();

        // Student
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();
        const resolvedStudentId = student?.id ?? '';
        setStudentId(resolvedStudentId);

        // Standard UUID
        const { data: std } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();
        if (!std?.id) {
          clearTimeout(timeoutId);
          setErrorMsg(`Standard ${standardCode} not found.`);
          setView('error');
          return;
        }
        setStandardUuid(std.id);

        // Fetch current classification from most recent session with one
        if (resolvedStudentId) {
          const { data: clsSession } = await supabase
            .from('sessions')
            .select('dominant_classification')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', std.id)
            .not('dominant_classification', 'is', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const cls = (clsSession as { dominant_classification?: string | null } | null)
            ?.dominant_classification;
          if (cls && cls !== 'CORRECT') {
            setCurrentClassification(cls);
          }
        }

        // Session — reuse in-progress practice session or create one
        let resolvedSessionId = '';
        if (resolvedStudentId) {
          const { data: existing } = await supabase
            .from('sessions')
            .select('id')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', std.id)
            .eq('phase', 'practice')
            .eq('status', 'in_progress')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            resolvedSessionId = existing.id;
          } else {
            const { data: created } = await supabase
              .from('sessions')
              .insert({
                student_id: resolvedStudentId,
                standard_id: std.id,
                phase: 'practice',
                status: 'in_progress',
              })
              .select('id')
              .single();
            resolvedSessionId = created?.id ?? '';
          }
        }
        setSessionId(resolvedSessionId);

        // ── Get all diagnostic question IDs to exclude from practice ─────────
        let diagnosticQIds: string[] = [];
        if (resolvedStudentId) {
          const { data: diagSession } = await supabase
            .from('sessions')
            .select('diagnostic_question_ids, diagnostic_question_id')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', std.id)
            .eq('phase', 'diagnostic')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const ds = diagSession as {
            diagnostic_question_ids?: string[] | null;
            diagnostic_question_id?:  string  | null;
          } | null;

          if (ds?.diagnostic_question_ids?.length) {
            diagnosticQIds = ds.diagnostic_question_ids;
          } else if (ds?.diagnostic_question_id) {
            diagnosticQIds = [ds.diagnostic_question_id];
          }
          console.log('[Practice] diagnostic question IDs to exclude:', diagnosticQIds.length);
        }

        // ── Fetch practice questions — classification-aware, passage-rotating ──
        // Uses 4-tier fallback: skill+unseen → skill+any → unseen+any → any
        const { questions: qRows, seenTitles: fetchedSeenTitles } =
          await getPracticeQuestions(
            supabase,
            std.id,
            resolvedStudentId,
            currentClassification,   // set above from most recent session
            diagnosticQIds,
          );

        setSeenTitles(fetchedSeenTitles);

        if (!qRows.length) {
          clearTimeout(timeoutId);
          setErrorMsg('No questions found for this standard.');
          setView('error');
          return;
        }

        const parsedQuestions = qRows.map((row) => ({
          ...parseQuestionContent(row.content, row.id),
          passageText: extractPassageFromContent(row.content),
          title:    row.title    ?? 'Literary Passage',
          author:   row.author   ?? 'Public Domain',
          pub_year: row.pub_year ?? '',
        }));

        clearTimeout(timeoutId);
        setQuestions(parsedQuestions);
        setView('practice');
        console.log('[Practice] init complete — questions:', parsedQuestions.length);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('[Practice] init error:', err);
        setErrorMsg('Something went wrong. Please refresh.');
        setView('error');
      }
    }

    init();
    return () => clearTimeout(timeoutId);
  }, [user, authLoading, standardId, standardCode, router]);

  // ── Answer selection ─────────────────────────────────────────────────────────

  async function handleSelect(letter: string) {
    if (isCorrect !== null) return;
    if (lockedLetters.includes(letter)) return;

    const q = questions[currentQ];
    const correct = letter === q.correctLetter;

    setSelectedLetter(letter);
    setIsCorrect(correct);
    setFeedbackLoading(true);

    if (!correct) {
      setLockedLetters((prev) => [...prev, letter]);
    }

    const selectedChoice = q.choices.find((c) => c.letter === letter);

    const msg = await fetchPracticeFeedback(
      standardCode,
      q.passageText,
      q.stem,
      letter,
      selectedChoice?.text ?? '',
      q.correctLetter,
      correct,
      attemptNumber,
    );
    setFeedbackMsg(msg);
    setFeedbackLoading(false);
  }

  // ── Try Again ────────────────────────────────────────────────────────────────

  function handleTryAgain() {
    setSelectedLetter(null);
    setIsCorrect(null);
    setFeedbackMsg(null);
    setAttemptNumber((n) => n + 1);
  }

  // ── Got It → ─────────────────────────────────────────────────────────────────

  async function handleGotIt() {
    if (submitting) return;
    const q = questions[currentQ];
    const finalCorrect = isCorrect === true;

    setSubmitting(true);

    // Write response
    try {
      if (sessionId && studentId && standardUuid) {
        await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            question_id: q.id.startsWith('placeholder') ? null : q.id,
            student_id: studentId,
            standard_id: standardUuid,
            cognitive_skill_targeted: q.cognitiveSkill,
            diagnostic_classification: q.classifications[selectedLetter ?? ''] ?? null,
            student_response: isCorrect ? selectedLetter : restatText || selectedLetter,
            mastery_achieved: finalCorrect,
            attempt_number: attemptNumber,
            ai_feedback: feedbackMsg,
          }),
        });
      }
    } catch (err) {
      console.error('[Practice] response write error:', err);
    }

    // Track result
    const updatedResults = [...questionResultsRef.current, finalCorrect];
    questionResultsRef.current = updatedResults;

    const isLastQuestion = currentQ >= questions.length - 1;

    if (isLastQuestion) {
      await finalizePractice(updatedResults);
    } else {
      setCurrentQ((q) => q + 1);
      setLockedLetters([]);
      setSelectedLetter(null);
      setIsCorrect(null);
      setAttemptNumber(1);
      setFeedbackMsg(null);
      setRestatText('');
      setRestatValid(false);
      setSubmitting(false);
    }
  }

  // ── Multi-session mastery evaluation ─────────────────────────────────────────

  async function finalizePractice(results: boolean[]) {
    const correctCount = results.filter(Boolean).length;
    console.log(`[Practice] session complete — correct: ${correctCount}/${results.length}`);

    // ── Record seen passage for rotation ─────────────────────────────────────
    // Runs regardless of pass/fail so the next session uses a fresh passage.
    const passageTitle = questions[0]?.title ?? null;
    if (passageTitle && studentId && standardUuid) {
      try {
        const supabaseForTracking = createClient();
        const updatedTitles = Array.from(new Set([...seenTitles, passageTitle]));
        const { error: trackErr } = await supabaseForTracking
          .from('standard_progress')
          .upsert(
            {
              student_id:           studentId,
              standard_id:          standardUuid,
              seen_passage_titles:  updatedTitles,
            },
            { onConflict: 'student_id,standard_id' },
          );
        if (trackErr) {
          console.warn('[Practice] seen passage update failed:', trackErr.message);
        } else {
          console.log(`[Practice] recorded seen passage: "${passageTitle}" (total: ${updatedTitles.length})`);
        }
      } catch (err) {
        console.warn('[Practice] seen passage tracking error:', err);
      }
    }

    if (sessionId && studentId && standardUuid) {
      try {
        const res = await fetch('/api/standard-progress/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id:             studentId,
            standard_id:            standardUuid,
            session_id:             sessionId,
            correct_count:          correctCount,
            total_questions:        results.length,
            current_classification: currentClassification,
          }),
        });

        if (res.ok) {
          const data = await res.json() as {
            result: 'mastered' | 'reinforcing' | 'practicing' | 'failed' | 'reclassified' | 'needs_teacher_review';
            sessions_passed?: number;
            failedTurns?: number;
            newClassification?: string;
            reclassificationCount?: number;
          };

          console.log(`[Practice] evaluate result=${data.result}`, data);

          switch (data.result) {
            case 'mastered':
              router.push(`/standard/${standardId}/mastery`);
              return;

            case 'reinforcing':
              router.push(`/standard/${standardId}/progress?sessions=2`);
              return;

            case 'practicing':
              router.push(`/standard/${standardId}/progress?sessions=1`);
              return;

            case 'failed':
              // Same intervention, retry — route back to teach
              setView('retry-prompt');
              setTimeout(() => {
                router.push(`/standard/${standardId}/teach/${getTeachRoute(currentClassification)}`);
              }, 2500);
              return;

            case 'reclassified': {
              const newCls   = data.newClassification   ?? currentClassification;
              const reclassN = data.reclassificationCount ?? 1;
              // Route to reclassify transition screen
              router.push(
                `/standard/${standardId}/teach/reclassify` +
                `?from=${encodeURIComponent(currentClassification)}` +
                `&to=${encodeURIComponent(newCls)}` +
                `&count=${reclassN}`,
              );
              return;
            }

            case 'needs_teacher_review':
              router.push(`/standard/${standardId}/teach/reclassify?flagged=true`);
              return;

            default:
              setView('retry-prompt');
              setTimeout(() => {
                router.push(`/standard/${standardId}/teach/${getTeachRoute(currentClassification)}`);
              }, 2500);
              return;
          }
        }
      } catch (err) {
        console.error('[Practice] evaluate error:', err);
      }
    }

    // Fallback if API unavailable — use local threshold (4 of 5)
    const passThreshold = Math.round(results.length * 0.8);
    const masteryAchieved = correctCount >= passThreshold;
    console.warn('[Practice] evaluate API unavailable — using local fallback');
    if (masteryAchieved) {
      router.push(`/standard/${standardId}/mastery`);
    } else {
      setView('retry-prompt');
      setTimeout(() => {
        router.push(`/standard/${standardId}/teach/${getTeachRoute(currentClassification)}`);
      }, 2500);
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const totalQ = Math.max(questions.length, 5);
  const progressPct = Math.round(((currentQ + 1) / totalQ) * 100);
  const q = questions[currentQ] ?? null;

  const gotItEnabled =
    isCorrect === true ||
    (isCorrect === false && attemptNumber >= 3 && restatValid);

  // ── Views ────────────────────────────────────────────────────────────────────

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
        <p style={{ color: C.gray, fontSize: 14 }}>Setting up practice…</p>
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
        <div style={{ maxWidth: 400, textAlign: 'center', padding: 24 }}>
          <p style={{ color: C.red, fontSize: 15, marginBottom: 12 }}>{errorMsg}</p>
          <button
            onClick={() => router.back()}
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
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'retry-prompt') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.navy,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: FONTS.ui,
        }}
      >
        <GogiAvatar size={72} state="engaged" />
        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: '18px 24px',
            textAlign: 'center',
            maxWidth: 300,
            fontSize: 17,
            fontWeight: 700,
            color: C.white,
            lineHeight: 1.5,
          }}
        >
          Let&rsquo;s go over that one more time.
        </div>
        <p style={{ fontSize: 12, color: C.blueMid }}>Returning to teach phase…</p>
      </div>
    );
  }

  if (!q) return null;

  // ── PRACTICE VIEW ────────────────────────────────────────────────────────────

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
        subtitle={`${standardCode} | Practice Phase | New passage`}
        showLogout
        showDashboardLink
      />

      {/* Green progress bar */}
      <div style={{ height: 3, background: C.greenLight, flexShrink: 0 }}>
        <div
          style={{
            height: 3,
            background: C.green,
            width: `${progressPct}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Two-column layout */}
      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}
        className="practice-columns"
      >
        {/* ── LEFT PANEL — Passage (55%) ──────────────────────────────────── */}
        <div
          style={{
            flex: '0 0 55%',
            borderRight: `1px solid ${C.border}`,
            padding: '20px 20px',
            overflowY: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.green,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            PRACTICE PASSAGE
          </div>
          <div style={{ fontSize: 10, color: C.gray, marginBottom: 12 }}>
            (new text — same skill)
          </div>

          {/* Passage box */}
          <div
            style={{
              background: C.light,
              borderLeft: `3px solid ${C.blue}`,
              borderRadius: '0 8px 8px 0',
              padding: '14px 16px',
              marginBottom: 14,
            }}
          >
            {q.passageText.split(/\n+/).filter(Boolean).map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 15,
                  fontFamily: FONTS.passage,
                  fontStyle: 'italic',
                  lineHeight: 1.75,
                  color: C.dark,
                  marginBottom: '0.75em',
                  margin: i === 0 ? '0 0 0.75em' : '0.75em 0',
                }}
              >
                {para}
              </p>
            ))}
            <div style={{ fontSize: 13, color: C.gray, marginTop: 8 }}>
              — {q.title}
              {q.author ? `, ${q.author}` : ''}
              {q.pub_year ? ` (${q.pub_year})` : ''}
            </div>
          </div>

          {/* Skill reminder box */}
          <div
            style={{
              background: C.light,
              borderLeft: `3px solid ${C.green}`,
              borderRadius: '0 8px 8px 0',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.green,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 4,
              }}
            >
              SKILL BEING PRACTICED
            </div>
            <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>
              {q.cognitiveSkill || standard?.title || 'Applying the target standard'}
            </div>
            <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>
              {standardCode}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — Question + Feedback (45%) ─────────────────────── */}
        <div
          style={{
            flex: 1,
            padding: '20px 18px',
            overflowY: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.gray,
              textTransform: 'uppercase',
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
              marginBottom: 16,
            }}
          >
            {q.stem}
          </div>

          {/* Answer options */}
          {q.choices.map(({ letter, text }) => {
            const isPermanentlyLocked = lockedLetters.includes(letter);
            const isSelected = selectedLetter === letter;
            const answerRevealed = isCorrect !== null;

            let bg: string = C.white;
            let border: string = `1.5px solid ${C.border}`;
            let letterBg: string = C.navy;

            if (answerRevealed && isSelected) {
              if (isCorrect) {
                bg = C.greenLight;
                border = `2px solid ${C.green}`;
                letterBg = C.green;
              } else {
                bg = C.redLight;
                border = `2px solid ${C.red}`;
                letterBg = C.red;
              }
            }

            const isClickable = !answerRevealed && !isPermanentlyLocked;

            return (
              <button
                key={letter}
                onClick={() => handleSelect(letter)}
                disabled={!isClickable}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 10,
                  border,
                  background: bg,
                  cursor: isPermanentlyLocked ? 'not-allowed' : isClickable ? 'pointer' : 'default',
                  textAlign: 'left',
                  fontFamily: FONTS.ui,
                  opacity: isPermanentlyLocked ? 0.38 : 1,
                  transition: 'border-color 0.12s, background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (isClickable) {
                    e.currentTarget.style.background = '#FAFAFA';
                    e.currentTarget.style.borderColor = C.blueMid;
                  }
                }}
                onMouseLeave={(e) => {
                  if (isClickable) {
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
                    background: letterBg,
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
          })}

          {/* Gogi feedback row */}
          {(feedbackLoading || feedbackMsg) && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${C.light}`,
              }}
            >
              <GogiAvatar size={36} state={isCorrect ? 'celebrate' : 'engaged'} />
              <div style={{ flex: 1 }}>
                <GogiBubble state={isCorrect ? 'celebrate' : 'engaged'}>
                  {feedbackLoading ? '…' : feedbackMsg}
                </GogiBubble>

                {/* Attempt 3 wrong — restate field */}
                {!isCorrect && attemptNumber >= 3 && feedbackMsg && (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      value={restatText}
                      onChange={(e) => {
                        setRestatText(e.target.value);
                        setRestatValid(validateResponse(e.target.value));
                      }}
                      placeholder="Put that in your own words…"
                      style={{
                        background: C.light,
                        border: `1px solid ${restatValid ? C.green : C.blueMid}`,
                        borderRadius: 4,
                        padding: '6px 8px',
                        fontSize: 12.5,
                        width: '100%',
                        resize: 'none',
                        minHeight: 52,
                        fontFamily: FONTS.ui,
                        color: C.dark,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {isCorrect !== null && !feedbackLoading && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isCorrect === false && attemptNumber < 3 && (
                <button
                  onClick={handleTryAgain}
                  style={{
                    width: '100%',
                    background: C.white,
                    color: C.navy,
                    border: `1.5px solid ${C.navy}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: FONTS.ui,
                  }}
                >
                  Try again →
                </button>
              )}

              {(isCorrect === true || attemptNumber >= 3) && (
                <button
                  onClick={handleGotIt}
                  disabled={!gotItEnabled || submitting}
                  style={{
                    width: '100%',
                    background: C.navy,
                    color: C.white,
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: gotItEnabled && !submitting ? 'pointer' : 'not-allowed',
                    fontFamily: FONTS.ui,
                    opacity: gotItEnabled && !submitting ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                  }}
                >
                  Got it  →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .practice-columns {
            flex-direction: column !important;
          }
          .practice-columns > div:first-child {
            flex: 0 0 auto !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid ${C.border};
            max-height: 40vh;
          }
          .practice-columns > div:last-child {
            flex: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
