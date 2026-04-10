'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

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
  correct: number;
  total: number;
  pct: number;
}

type Phase = 'loading' | 'error' | 'intro' | 'assessment' | 'results';

// ─── Content Parser ───────────────────────────────────────────────────────────
// Expected format:
//   [Passage text paragraphs]
//
//   [Question text]
//
//   A. [choice]
//   B. [choice]
//   C. [choice]
//   D. [choice]
//
//   CORRECT: B

function parseQuestionContent(content: string) {
  // 1. Extract correct answer letter
  const correctMatch = content.match(/CORRECT:\s*([A-D])/i);
  const correctLetter = (correctMatch?.[1] ?? 'A').toUpperCase();

  // 2. Strip the CORRECT line — never shown to student
  const withoutCorrect = content.replace(/\nCORRECT:\s*[A-D][^\n]*/i, '').trim();

  // 3. Extract choices A–D
  const choices: Record<string, string> = {};
  const choiceRegex = /^([A-D])[.)]\s+(.+)$/gm;
  let m;
  while ((m = choiceRegex.exec(withoutCorrect)) !== null) {
    choices[m[1]] = m[2].trim();
  }

  // 4. Remove choice lines to isolate passage + question text
  const withoutChoices = withoutCorrect
    .replace(/^[A-D][.)]\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 5. Last paragraph = question; everything before = passage
  const paragraphs = withoutChoices.split(/\n\n+/).filter(p => p.trim().length > 0);
  const questionText = paragraphs[paragraphs.length - 1]?.trim() ?? '';
  const passageText = paragraphs.slice(0, -1).join('\n\n').trim();

  return {
    passageText,
    questionText,
    choices: ['A', 'B', 'C', 'D'].map(l => choices[l] ?? ''),
    correctLetter,
    correctIndex: ['A', 'B', 'C', 'D'].indexOf(correctLetter),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getScoreLevel(pct: number) {
  if (pct >= 80) return { label: 'Approaching Mastery', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' };
  if (pct >= 60) return { label: 'Developing', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' };
  return { label: 'Beginning', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiagnosticAssessment() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [sessionId, setSessionId] = useState('');
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

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        // 1. Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/sign-up-login-screen');
          return;
        }

        // 2. Student record
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

        // 3. Load all 3 pilot standards ordered by code
        const { data: standards, error: standardsError } = await supabase
          .from('standards')
          .select('id, code')
          .in('code', [...PILOT_CODES])
          .order('code');

        if (standardsError || !standards || standards.length === 0) {
          setErrorMsg('Standards not found. Please contact your administrator.');
          setPhase('error');
          return;
        }

        // Build lookup: id → code
        const codeById: Record<string, string> = {};
        standards.forEach(s => { codeById[s.id] = s.code; });

        // 4. Load questions for all 3 standards
        const standardIds = standards.map(s => s.id);
        const { data: dbQuestions, error: questionsError } = await supabase
          .from('questions')
          .select('id, standard_id, content, cognitive_skill_targeted, difficulty_level')
          .in('standard_id', standardIds)
          .order('difficulty_level');

        if (questionsError || !dbQuestions || dbQuestions.length === 0) {
          setErrorMsg('No questions available. Please contact your administrator.');
          setPhase('error');
          return;
        }

        // Sort: by PILOT_CODES order first, then by difficulty_level within each standard
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

        // 5. Create ONE session using the first standard's id (ELA.9.R.1.1)
        const firstStandardId = standards.find(s => s.code === 'ELA.9.R.1.1')?.id ?? standards[0].id;
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            student_id: student.id,
            standard_id: firstStandardId,
            phase: 'diagnose',
            status: 'in_progress',
          })
          .select('id')
          .single();

        if (sessionError || !session) {
          setErrorMsg('Failed to start your session. Please try again.');
          setPhase('error');
          return;
        }
        setSessionId(session.id);
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

    setSaving(true);

    try {
      const { error } = await supabase.from('responses').insert({
        session_id: sessionId,
        question_id: q.id,
        student_id: studentId,
        standard_id: q.standardId,
        cognitive_skill_targeted: q.cognitiveSkill,
        student_response: selectedLetter,
        mastery_achieved: isCorrect,
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

      // Last question — use updatedLog to avoid stale state in closure
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
        correct: stdMap[code].correct,
        total: stdMap[code].total,
        pct: stdMap[code].total > 0 ? Math.round((stdMap[code].correct / stdMap[code].total) * 100) : 0,
      }));

      const timeSpent = timerStartRef.current
        ? Math.floor((Date.now() - timerStartRef.current) / 1000)
        : elapsedSeconds;

      try {
        const { error } = await supabase
          .from('sessions')
          .update({
            status: 'completed',
            mastery_achieved: pct >= 80,
            completed_at: new Date().toISOString(),
            time_spent_seconds: timeSpent,
          })
          .eq('id', sessionId);
        if (error) console.error('[DiagnosticAssessment] Session update error:', error);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-violet-300 text-sm">Loading your assessment…</p>
        </div>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Assessment</h2>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push('/student-home')}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl text-sm transition-all duration-200"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── INTRO ────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => router.push('/student-home')}
            className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm mb-8 transition-colors"
          >
            ← Back to Home
          </button>

          <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-8 backdrop-blur-sm">
            <div className="mb-6">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Diagnostic Assessment</span>
              <h1 className="text-white text-2xl sm:text-3xl font-extrabold mt-2 leading-tight">
                ELA Reading Diagnostic
              </h1>
              <p className="text-violet-300 font-mono text-sm mt-1">ELA.9.R.1.1 · ELA.9.R.1.2 · ELA.9.R.2.1</p>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              This assessment will help GOGI understand your current reading skills so we can build a personalized learning plan just for you.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Standards', value: '3' },
                { label: 'Questions', value: String(totalQuestions) },
                { label: 'Format', value: 'Multiple Choice' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-white font-bold text-base">{item.value}</div>
                  <div className="text-violet-400 text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-6">
              {PILOT_CODES.map(code => (
                <div key={code} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                  <span className="text-violet-400 font-mono text-xs w-28 flex-shrink-0">{code}</span>
                  <span className="text-slate-300 text-sm">{STANDARD_LABELS[code]}</span>
                </div>
              ))}
            </div>

            <div className="bg-violet-900/30 border border-violet-500/20 rounded-xl p-4 mb-8">
              <h3 className="text-white font-semibold text-sm mb-2">Before you begin:</h3>
              <ul className="text-slate-300 text-sm space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Read each passage carefully before answering</li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Each question has one best answer</li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> You cannot go back to previous questions</li>
                <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5">•</span> Your results will personalize your learning path</li>
              </ul>
            </div>

            <button
              onClick={() => setPhase('assessment')}
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-violet-500/30"
            >
              Start Diagnostic →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────

  if (phase === 'results') {
    const mastered = finalScore.pct >= 80;
    const level = getScoreLevel(finalScore.pct);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{mastered ? '🏆' : '📊'}</div>
            <h1 className="text-white text-3xl font-extrabold mb-2">Diagnostic Complete!</h1>
            <p className="text-violet-300 text-sm">3 Standards · {finalScore.total} Questions</p>
          </div>

          {/* Overall Score */}
          <div className={`border rounded-2xl p-6 mb-6 text-center ${level.bg}`}>
            <div className={`text-5xl font-extrabold mb-1 ${level.color}`}>{finalScore.pct}%</div>
            <div className="text-white font-bold text-lg">{finalScore.correct} / {finalScore.total} Correct</div>
            <div className={`text-sm font-semibold mt-2 ${level.color}`}>{level.label}</div>
          </div>

          {/* Per-Standard Breakdown */}
          <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 mb-6">
            <h2 className="text-white font-bold text-sm mb-4">Score by Standard</h2>
            <div className="space-y-4">
              {standardResults.map(s => {
                const sLevel = getScoreLevel(s.pct);
                return (
                  <div key={s.code}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-violet-400 font-mono text-xs">{s.code}</span>
                        <span className="text-slate-400 text-xs ml-2">{STANDARD_LABELS[s.code]}</span>
                      </div>
                      <span className={`text-xs font-bold ${sLevel.color}`}>{s.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.correct} of {s.total} correct</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What's Next */}
          <div className={`border rounded-2xl p-5 mb-6 ${mastered ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <h2 className="text-white font-bold text-sm mb-2">
              {mastered ? '🎉 Mastery Achieved!' : '📚 Next Step: Guided Lesson'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {mastered
                ? `You scored ${finalScore.pct}% overall — above the 80% mastery threshold. You'll now move to the reassessment to confirm mastery.`
                : `You scored ${finalScore.pct}% overall — below the 80% mastery threshold. You'll go through guided lessons, targeted practice, and a reassessment to build your skills.`}
            </p>
          </div>

          <button
            onClick={() => router.push(mastered ? '/student-reassess' : '/student-teach')}
            className={`w-full font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg ${
              mastered
                ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/30 text-white'
                : 'bg-violet-600 hover:bg-violet-500 hover:shadow-violet-500/30 text-white'
            }`}
          >
            {mastered ? 'Continue to Reassessment →' : 'Start Guided Lesson →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── ASSESSMENT ───────────────────────────────────────────────────────────

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
      {/* Top Progress Bar */}
      <div className="bg-slate-900/80 border-b border-white/10 px-4 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">ELA Diagnostic</span>
              <span className="text-violet-400 text-xs font-mono">{currentQuestion.standardCode}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-violet-300 text-sm font-mono font-bold tabular-nums">{formatTime(elapsedSeconds)}</span>
              <span className="text-slate-400 text-xs">
                Q {currentIndex + 1} of {totalQuestions}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
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
            <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
              <div className="mb-4">
                <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Passage</span>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {currentQuestion.passageText || <span className="text-slate-500 italic">No passage for this question.</span>}
              </div>
            </div>

            {/* Question Panel */}
            <div className="flex flex-col gap-4">
              {/* Question */}
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    Q{currentIndex + 1} of {totalQuestions}
                  </span>
                  <span className="text-slate-500 text-xs">Multiple Choice</span>
                </div>
                <p className="text-white text-base font-medium leading-snug">
                  {currentQuestion.questionText}
                </p>
              </div>

              {/* Choices */}
              <div className="space-y-3">
                {currentQuestion.choices.map((choice, idx) => {
                  let optionStyle = 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-violet-500/40 cursor-pointer';

                  if (showFeedback) {
                    if (idx === selectedOption) {
                      optionStyle = 'bg-violet-600/30 border-violet-500 text-white cursor-default';
                    } else {
                      optionStyle = 'bg-white/5 border-white/10 text-slate-500 cursor-default opacity-60';
                    }
                  } else if (selectedOption === idx) {
                    optionStyle = 'bg-violet-600/30 border-violet-500 text-white cursor-pointer';
                  }

                  const letterStyle = (showFeedback || selectedOption === idx) && idx === selectedOption
                    ? 'border-violet-400 text-violet-400'
                    : 'border-slate-600 text-slate-500';

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

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmAnswer}
                  disabled={selectedOption === null || saving || showFeedback}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
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
    </div>
  );
}
