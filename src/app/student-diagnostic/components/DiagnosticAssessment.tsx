'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const MASTERY_THRESHOLD = 0.8;

const PILOT_CODES = ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'] as const;

const STANDARD_LABELS: Record<string, string> = {
  'ELA.9.R.1.1': 'Inferencing & Textual Evidence',
  'ELA.9.R.1.2': 'Universal Themes in Literary Texts',
  'ELA.9.R.2.1': 'Text Structure & Purpose',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedQuestion {
  id: string;
  standardId: string;
  standardCode: string;
  passageText: string;
  questionText: string;
  choices: string[]; // index 0=A, 1=B, 2=C, 3=D
  correctLetter: string;
  correctIndex: number;
  cognitiveSkill: string | null;
  diagnosticClassifications: Record<string, string>; // keyed by A/B/C/D
}

interface AnswerRecord {
  questionId: string;
  standardId: string;
  standardCode: string;
  selectedIndex: number;
  isCorrect: boolean;
  selectedLetter: string;
  cognitiveSkill: string | null;
}

interface StandardResult {
  code: string;
  id: string;
  title: string;
  correct: number;
  total: number;
  pct: number;
}

type Phase = 'loading' | 'error' | 'intro' | 'assessment' | 'results';

// ─── Content Parser ───────────────────────────────────────────────────────────

const METADATA_PREFIXES = [
  'LAYER1_DISTRACTOR:',
  'LAYER2_DISTRACTOR:',
  'LAYER3_DISTRACTOR:',
  'DIAGNOSTIC_CLASSIFICATION_A:',
  'DIAGNOSTIC_CLASSIFICATION_B:',
  'DIAGNOSTIC_CLASSIFICATION_C:',
  'DIAGNOSTIC_CLASSIFICATION_D:',
  'COGNITIVE_SKILL:',
];

function parseQuestionContent(content: string) {
  const diagnosticClassifications: Record<string, string> = {};
  const classificationRegex = /^DIAGNOSTIC_CLASSIFICATION_([A-D]):\s*(.+)$/gm;
  let cm;
  while ((cm = classificationRegex.exec(content)) !== null) {
    diagnosticClassifications[cm[1]] = cm[2].trim();
  }

  const stripped = content
    .split('\n')
    .filter(line => !METADATA_PREFIXES.some(prefix => line.trimStart().startsWith(prefix)))
    .join('\n');

  const passageMarker = stripped.match(/^PASSAGE:\s*/im);
  const questionMarker = stripped.match(/^QUESTION:\s*/im);

  if (passageMarker && questionMarker) {
    const correctMatch = stripped.match(/^CORRECT:\s*([A-D])/im);
    if (!correctMatch) {
      return {
        passageText: stripped.trim(),
        questionText: '',
        choices: ['', '', '', ''],
        correctLetter: 'A',
        correctIndex: 0,
        diagnosticClassifications,
      };
    }
    const correctLetter = correctMatch[1].toUpperCase();

    const questionSplit = stripped.split(/^QUESTION:\s*/im);
    const passageBlock = questionSplit[0].replace(/^PASSAGE:\s*/i, '').trim();
    const afterQuestion = questionSplit[1] ?? '';

    const choices: Record<string, string> = {};
    const choiceRegex = /^([A-D])[).\s]\s*(.+)$/gm;
    let m;
    while ((m = choiceRegex.exec(afterQuestion)) !== null) {
      choices[m[1]] = m[2].trim();
    }

    const questionText = afterQuestion
      .replace(/^([A-D])[).\s]\s*.+$/gm, '')
      .replace(/\nCORRECT:\s*[A-D][^\n]*/gi, '')
      .trim();

    return {
      passageText: passageBlock,
      questionText,
      choices: ['A', 'B', 'C', 'D'].map(l => choices[l] ?? ''),
      correctLetter,
      correctIndex: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
      diagnosticClassifications,
    };
  }

  const correctMatch = stripped.match(/CORRECT:\s*([A-D])/i);
  if (!correctMatch) {
    return {
      passageText: stripped.trim(),
      questionText: '',
      choices: ['', '', '', ''],
      correctLetter: 'A',
      correctIndex: 0,
      diagnosticClassifications,
    };
  }
  const correctLetter = correctMatch[1].toUpperCase();

  const withoutCorrect = stripped.replace(/\nCORRECT:\s*[A-D][^\n]*/i, '').trim();

  const choices: Record<string, string> = {};
  const choiceRegex = /^([A-D])[.)]\s+(.+)$/gm;
  let m;
  while ((m = choiceRegex.exec(withoutCorrect)) !== null) {
    choices[m[1]] = m[2].trim();
  }

  const withoutChoices = withoutCorrect
    .replace(/^[A-D][.)]\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const paragraphs = withoutChoices.split(/\n\n+/).filter(p => p.trim().length > 0);
  const questionText = paragraphs[paragraphs.length - 1]?.trim() ?? '';
  const passageText = paragraphs.slice(0, -1).join('\n\n').trim();

  return {
    passageText,
    questionText,
    choices: ['A', 'B', 'C', 'D'].map(l => choices[l] ?? ''),
    correctLetter,
    correctIndex: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
    diagnosticClassifications,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiagnosticAssessment() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});
  const [studentId, setStudentId] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answerLog, setAnswerLog] = useState<AnswerRecord[]>([]);
  const [finalScore, setFinalScore] = useState({ correct: 0, total: 0, pct: 0 });
  const [standardResults, setStandardResults] = useState<StandardResult[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const standardsMetaRef = useRef<Record<string, { id: string; title: string }>>({});
  // Tracks when the current question became visible — reset on each question advance
  const questionStartRef = useRef<number>(0);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/sign-up-login-screen');
          return;
        }

        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (studentError || !student) {
          setErrorMsg('Student profile not found. Please contact your teacher.');
          setPhase('error');
          return;
        }
        setStudentId(student.id);

        const { data: standards, error: standardsError } = await supabase
          .from('standards')
          .select('id, code, title')
          .in('code', [...PILOT_CODES])
          .order('code');

        if (standardsError || !standards || standards.length === 0) {
          setErrorMsg('Standards not found. Please contact your administrator.');
          setPhase('error');
          return;
        }

        const codeById: Record<string, string> = {};
        const metaByCode: Record<string, { id: string; title: string }> = {};
        standards.forEach(s => {
          codeById[s.id] = s.code;
          metaByCode[s.code] = { id: s.id, title: s.title };
        });
        standardsMetaRef.current = metaByCode;

        const standardIds = standards.map(s => s.id);
        const { data: dbQuestions, error: questionsError } = await supabase
          .from('questions')
          .select('id, standard_id, content, cognitive_skill_targeted, difficulty_level')
          .in('standard_id', standardIds)
          .or('difficulty_level.is.null,difficulty_level.eq.0')
          .order('difficulty_level');

        if (questionsError || !dbQuestions || dbQuestions.length === 0) {
          setErrorMsg('No questions available. Please contact your administrator.');
          setPhase('error');
          return;
        }

        const sorted = [...dbQuestions].sort((a, b) => {
          const aIdx = PILOT_CODES.indexOf(codeById[a.standard_id] as typeof PILOT_CODES[number]);
          const bIdx = PILOT_CODES.indexOf(codeById[b.standard_id] as typeof PILOT_CODES[number]);
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.difficulty_level ?? 0) - (b.difficulty_level ?? 0);
        });

        const parsed: ParsedQuestion[] = sorted.map(q => ({
          id: q.id,
          standardId: q.standard_id,
          standardCode: codeById[q.standard_id],
          cognitiveSkill: q.cognitive_skill_targeted ?? null,
          ...parseQuestionContent(q.content),
        }));

        setQuestions(parsed);

        const sessionInserts = await Promise.all(
          standards.map(s =>
            supabase
              .from('sessions')
              .insert({
                student_id: student.id,
                standard_id: s.id,
                phase: 'diagnostic',
                status: 'in_progress',
              })
              .select('id')
              .single()
          )
        );

        const sessionMap: Record<string, string> = {};
        for (let i = 0; i < standards.length; i++) {
          const { data: sess, error: sessError } = sessionInserts[i];
          if (sessError || !sess) {
            setErrorMsg('Failed to start your session. Please try again.');
            setPhase('error');
            return;
          }
          sessionMap[standards[i].id] = sess.id;
        }
        setSessionIds(sessionMap);
        setPhase('intro');
      } catch (err) {
        console.error('[DiagnosticAssessment] Init error:', err);
        setErrorMsg('Something went wrong. Please refresh the page and try again.');
        setPhase('error');
      }
    }

    init();
  }, [router]);

  // ─── Timer ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === 'assessment') {
      timerStartRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - timerStartRef.current!) / 1000));
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [phase]);

  // Reset question timer each time a new question is shown
  useEffect(() => {
    if (phase === 'assessment') {
      questionStartRef.current = Date.now();
    }
  }, [currentIndex, phase]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectOption = (index: number) => {
    if (showFeedback || saving) return;
    setSelectedOption(index);
  };

  const handleConfirmAnswer = async () => {
    if (selectedOption === null || saving) return;

    const q = questions[currentIndex];
    const isCorrect = selectedOption === q.correctIndex;
    const selectedLetter = ['A', 'B', 'C', 'D'][selectedOption];
    const timeOnQuestionSeconds = questionStartRef.current
      ? Math.round((Date.now() - questionStartRef.current) / 1000)
      : 0;

    setSaving(true);

    try {
      const { error } = await supabase.from('responses').insert({
        session_id: sessionIds[q.standardId],
        question_id: q.id,
        student_id: studentId,
        standard_id: q.standardId,
        cognitive_skill_targeted: q.cognitiveSkill,
        diagnostic_classification: isCorrect ? null : (q.diagnosticClassifications[selectedLetter] ?? null),
        student_response: selectedLetter,
        mastery_achieved: isCorrect,
        attempt_number: 1,
        time_on_question_seconds: timeOnQuestionSeconds,
      });
      if (error) console.error('[DiagnosticAssessment] Response save error:', error);
    } catch (err) {
      console.error('[DiagnosticAssessment] Response save exception:', err);
    }

    const newRecord: AnswerRecord = {
      questionId: q.id,
      standardId: q.standardId,
      standardCode: q.standardCode,
      selectedIndex: selectedOption,
      isCorrect,
      selectedLetter,
      cognitiveSkill: q.cognitiveSkill,
    };
    const updatedLog = [...answerLog, newRecord];
    setAnswerLog(updatedLog);
    setSaving(false);
    setShowFeedback(true);

    const isLast = currentIndex === questions.length - 1;

    setTimeout(async () => {
      if (!isLast) {
        setShowFeedback(false);
        setSelectedOption(null);
        setCurrentIndex(prev => prev + 1);
        return;
      }

      const correct = updatedLog.filter(a => a.isCorrect).length;
      const total = questions.length;
      const pct = Math.round((correct / total) * 100);

      const stdMap: Record<string, { correct: number; total: number }> = {};
      for (const code of PILOT_CODES) {
        stdMap[code] = { correct: 0, total: 0 };
      }
      for (const a of updatedLog) {
        if (stdMap[a.standardCode]) {
          stdMap[a.standardCode].total++;
          if (a.isCorrect) stdMap[a.standardCode].correct++;
        }
      }
      const results: StandardResult[] = [...PILOT_CODES].map(code => ({
        code,
        id: standardsMetaRef.current[code]?.id ?? '',
        title: standardsMetaRef.current[code]?.title ?? '',
        correct: stdMap[code].correct,
        total: stdMap[code].total,
        pct: stdMap[code].total > 0 ? Math.round((stdMap[code].correct / stdMap[code].total) * 100) : 0,
      }));

      const timeSpent = timerStartRef.current
        ? Math.floor((Date.now() - timerStartRef.current) / 1000)
        : elapsedSeconds;

      try {
        const completedAt = new Date().toISOString();
        await Promise.all(
          results.map(s =>
            supabase
              .from('sessions')
              .update({
                status: 'completed',
                mastery_achieved: s.pct >= MASTERY_THRESHOLD * 100,
                completed_at: completedAt,
                time_spent_seconds: timeSpent,
              })
              .eq('id', sessionIds[s.id])
          )
        );
      } catch (err) {
        console.error('[DiagnosticAssessment] Session update exception:', err);
      }

      setFinalScore({ correct, total, pct });
      setStandardResults(results);
      setPhase('results');
    }, 1000);
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = answerLog.length;

  // ─── LOADING ──────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[#94A3B8] text-sm">Loading your assessment…</p>
        </div>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/[0.06] border border-red-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Assessment</h2>
          <p className="text-[#94A3B8] text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push('/student-home')}
            className="btn-primary w-full"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── INTRO ────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => router.push('/student-home')}
            className="flex items-center gap-2 text-[#94A3B8] hover:text-white text-sm mb-8 transition-colors"
          >
            ← Back to Home
          </button>

          <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-8">
            <div className="mb-6">
              <span className="text-xs font-bold text-[#1D9E75] uppercase tracking-widest">Diagnostic Assessment</span>
              <h1 className="text-white text-2xl sm:text-3xl font-extrabold mt-2 leading-tight">
                ELA Reading Diagnostic
              </h1>
              <p className="text-[#94A3B8] font-mono text-sm mt-1">ELA.9.R.1.1 · ELA.9.R.1.2 · ELA.9.R.2.1</p>
            </div>

            <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
              This assessment will help GOGI understand your current reading skills so we can build a personalized learning plan just for you.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Standards', value: '3' },
                { label: 'Questions', value: String(totalQuestions) },
                { label: 'Format', value: 'Multiple Choice' },
              ].map(item => (
                <div key={item.label} className="bg-white/[0.06] rounded-xl p-3 text-center">
                  <div className="text-white font-bold text-base">{item.value}</div>
                  <div className="text-[#94A3B8] text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-6">
              {PILOT_CODES.map(code => (
                <div key={code} className="flex items-center gap-3 bg-white/[0.06] rounded-xl px-4 py-2.5">
                  <span className="text-[#1D9E75] font-mono text-xs w-28 flex-shrink-0">{code}</span>
                  <span className="text-[#94A3B8] text-sm">{STANDARD_LABELS[code]}</span>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.06] border border-white/[0.08] rounded-xl p-4 mb-8">
              <h3 className="text-white font-semibold text-sm mb-2">Before you begin:</h3>
              <ul className="text-[#94A3B8] text-sm space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-[#1D9E75] mt-0.5">•</span> Read each passage carefully before answering</li>
                <li className="flex items-start gap-2"><span className="text-[#1D9E75] mt-0.5">•</span> Each question has one best answer</li>
                <li className="flex items-start gap-2"><span className="text-[#1D9E75] mt-0.5">•</span> You cannot go back to previous questions</li>
                <li className="flex items-start gap-2"><span className="text-[#1D9E75] mt-0.5">•</span> Your results will personalize your learning path</li>
              </ul>
            </div>

            <button
              onClick={() => setPhase('assessment')}
              className="btn-primary w-full py-4 text-base"
            >
              Start Diagnostic
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────

  if (phase === 'results') {
    const allPassed = standardResults.every(s => s.pct >= MASTERY_THRESHOLD * 100);

    return (
      <div className="min-h-screen bg-[#0d0f12] px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-white text-3xl font-extrabold mb-2">Diagnostic Complete</h1>
            <p className="text-[#94A3B8] text-sm">3 Standards · {finalScore.total} Questions · {finalScore.pct}% Overall</p>
          </div>

          {/* Per-Standard Results */}
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 mb-6">
            <h2 className="text-white font-bold text-sm mb-4">Results by Standard</h2>
            <div className="space-y-3">
              {standardResults.map(s => {
                const passed = s.pct >= MASTERY_THRESHOLD * 100;
                return (
                  <div
                    key={s.code}
                    className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${
                      passed
                        ? 'bg-[#1D9E75]/10 border-[#1D9E75]/20'
                        : 'bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[#1D9E75] font-mono text-xs">{s.code}</span>
                        <span className={`text-xs font-bold ${passed ? 'text-[#1D9E75]' : 'text-red-400'}`}>
                          {s.pct}%
                        </span>
                      </div>
                      <p className="text-[#94A3B8] text-sm">{s.title}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {passed ? (
                        <div className="w-8 h-8 rounded-full bg-[#1D9E75]/20 border border-[#1D9E75]/30 flex items-center justify-center">
                          <span className="text-[#1D9E75] font-bold text-sm">✓</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                            <span className="text-red-400 font-bold text-sm">✗</span>
                          </div>
                          <button
                            onClick={() => router.push(`/student-teach/${s.id}`)}
                            className="btn-primary px-4 py-2 text-xs"
                          >
                            Start Lesson
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {allPassed && (
            <div className="bg-[#1D9E75]/10 border border-[#1D9E75]/30 rounded-2xl p-5 text-center">
              <p className="text-white font-semibold text-sm mb-1">You&apos;ve demonstrated mastery on all standards.</p>
              <p className="text-[#94A3B8] text-sm">Your teacher can see your results.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── ASSESSMENT ───────────────────────────────────────────────────────────

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-[#0d0f12] flex flex-col">
      {/* Top Progress Bar */}
      <div className="bg-[#0d0f12] border-b border-white/[0.08] px-4 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">ELA Diagnostic</span>
              <span className="text-[#1D9E75] text-xs font-mono">{currentQuestion.standardCode}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#94A3B8] text-sm font-mono font-bold tabular-nums">{formatTime(elapsedSeconds)}</span>
              <span className="text-[#4B5563] text-xs">
                Q {currentIndex + 1} of {totalQuestions}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1D9E75] rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Passage Panel */}
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto scrollbar-thin">
              <div className="mb-4">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Passage</span>
              </div>
              <div className="text-[#94A3B8] text-sm leading-relaxed whitespace-pre-line">
                {currentQuestion.passageText || <span className="text-[#4B5563] italic">No passage for this question.</span>}
              </div>
            </div>

            {/* Question Panel */}
            <div className="flex flex-col gap-4">
              {/* Question */}
              <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#1D9E75]/20 text-[#1D9E75] text-xs font-bold px-2.5 py-1 rounded-full">
                    Q{currentIndex + 1} of {totalQuestions}
                  </span>
                  <span className="text-[#4B5563] text-xs">Multiple Choice</span>
                </div>
                <p className="text-white text-base font-medium leading-snug">
                  {currentQuestion.questionText}
                </p>
              </div>

              {/* Choices */}
              <div className="space-y-3">
                {currentQuestion.choices.map((choice, idx) => {
                  let optionStyle = 'bg-white/[0.06] border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.09] hover:border-[#1D9E75]/40 cursor-pointer';

                  if (showFeedback) {
                    if (idx === selectedOption) {
                      optionStyle = 'bg-[#1D9E75]/20 border-[#1D9E75] text-white cursor-default';
                    } else {
                      optionStyle = 'bg-white/[0.04] border-white/[0.06] text-[#4B5563] cursor-default opacity-60';
                    }
                  } else if (selectedOption === idx) {
                    optionStyle = 'bg-[#1D9E75]/20 border-[#1D9E75] text-white cursor-pointer';
                  }

                  const letterStyle = selectedOption === idx
                    ? 'border-[#1D9E75] text-[#1D9E75]'
                    : 'border-white/[0.16] text-[#4B5563]';

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      disabled={showFeedback || saving}
                      className={`w-full text-left border rounded-xl px-4 py-3.5 text-sm transition-all duration-150 flex items-start gap-3 ${optionStyle}`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5 ${letterStyle}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-snug">{choice}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action Button */}
              <button
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null || saving || showFeedback}
                className="btn-primary w-full py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Saving…
                  </>
                ) : showFeedback ? (
                  'Moving on…'
                ) : (
                  'Confirm Answer'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
