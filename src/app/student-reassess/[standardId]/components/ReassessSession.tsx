'use client';

// ─── SUPABASE MIGRATION REQUIRED ─────────────────────────────────────────────
// Carlos: run this SQL in the Supabase SQL editor before deploying this file.
//
// CREATE TABLE reassess_passages (
//   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   student_id  uuid REFERENCES students(id),
//   standard_id uuid REFERENCES standards(id),
//   passage_text text NOT NULL,
//   questions   jsonb NOT NULL,
//   created_at  timestamptz DEFAULT now(),
//   UNIQUE(student_id, standard_id)
// );
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { callClaude } from '@/lib/callClaude';
import { renderMarkdown } from '@/lib/renderMarkdown';
import GogiAvatar from '@/components/GogiAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReassessView = 'loading' | 'error' | 'intro' | 'assessment' | 'results';

function parseReassessContent(text: string): { passage: string; questions: string[] } {
  const sections = text
    .split(/---(?:PASSAGE|QUESTION \d+)---/)
    .map((s) => s.trim())
    .filter(Boolean);
  const passage = sections[0] || '';
  const questions = sections.slice(1, 6);
  while (questions.length < 5) {
    questions.push('Apply the standard skill to the passage above in a complete written response.');
  }
  return { passage, questions };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReassessSession() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();
  const standardId = params.standardId;

  const [view, setView] = useState<ReassessView>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [studentId, setStudentId] = useState('');
  const [reassessSessionId, setReassessSessionId] = useState('');
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');

  const [passage, setPassage] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentResponse, setCurrentResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [masteredArr, setMasteredArr] = useState<boolean[]>([]);
  const [allFeedback, setAllFeedback] = useState<string[]>([]);

  // Rotating loading messages for the generation wait screen
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const reassessStartRef = useRef<number>(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!standardId) return;

    async function init() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
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
          setView('error');
          return;
        }
        setStudentId(student.id);

        const { data: standard, error: standardError } = await supabase
          .from('standards')
          .select('code, title')
          .eq('id', standardId)
          .single();

        if (standardError || !standard) {
          setErrorMsg('Standard not found.');
          setView('error');
          return;
        }
        setStandardCode(standard.code);
        setStandardTitle(standard.title);

        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            student_id: student.id,
            standard_id: standardId,
            phase: 'reassess',
            status: 'in_progress',
          })
          .select('id')
          .single();

        if (sessionError || !session) {
          setErrorMsg('Failed to start your reassessment. Please try again.');
          setView('error');
          return;
        }
        setReassessSessionId(session.id);

        setContentLoading(true);
        setLoadingMsgIndex(0);
        setLoadingProgress(0);

        // Rotate messages every 4 seconds while Claude generates
        const LOADING_MESSAGES = [
          'Getting your reading ready...',
          'Building your questions...',
          'Almost there...',
          'One more second...',
        ];
        loadingIntervalRef.current = setInterval(() => {
          setLoadingMsgIndex(prev => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
        }, 4_000);

        // Fill progress bar over 25 seconds (Claude typically takes 15–25s)
        const PROGRESS_TICK_MS = 250;
        const PROGRESS_TOTAL_MS = 25_000;
        progressIntervalRef.current = setInterval(() => {
          setLoadingProgress(prev => Math.min(prev + (PROGRESS_TICK_MS / PROGRESS_TOTAL_MS) * 100, 95));
        }, PROGRESS_TICK_MS);

        try {
          // ── Check pool first ────────────────────────────────────────────────
          // Every student gets one stable passage+questions per standard so
          // repeated attempts measure growth against the same instrument.
          const { data: stored } = await supabase
            .from('reassess_passages')
            .select('passage_text, questions')
            .eq('student_id', student.id)
            .eq('standard_id', standardId)
            .maybeSingle();

          if (stored) {
            // Reuse the stored instrument — no Claude call needed.
            setPassage(stored.passage_text);
            setQuestions(stored.questions as string[]);
          } else {
            // First attempt: generate fresh content and persist it.
            const text = await callClaude('generate_reassess', {
              standardCode: standard.code,
              standardTitle: standard.title,
            });
            const parsed = parseReassessContent(text);
            setPassage(parsed.passage);
            setQuestions(parsed.questions);

            // Fire-and-forget save — don't block or fail the session if this
            // insert errors (e.g., table not yet created in this environment).
            supabase
              .from('reassess_passages')
              .insert({
                student_id: student.id,
                standard_id: standardId,
                passage_text: parsed.passage,
                questions: parsed.questions,
              })
              .then(({ error }) => {
                if (error) {
                  console.warn('[ReassessSession] Pool save failed:', error.message);
                }
              });
          }
        } catch (err) {
          console.error('[ReassessSession] Generate error:', err);
          setErrorMsg('Failed to generate your reassessment. Please try again.');
          setView('error');
          return;
        } finally {
          // Clear both intervals and snap progress to 100% when done
          if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          setLoadingProgress(100);
          setContentLoading(false);
        }

        reassessStartRef.current = Date.now();
        setView('intro');
      } catch (err) {
        console.error('[ReassessSession] Init error:', err);
        setErrorMsg('Something went wrong. Please refresh and try again.');
        setView('error');
      }
    }

    init();
  }, [standardId, router]);

  // ─── Submit Handler ────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!currentResponse.trim() || submitting) return;
    setSubmitting(true);
    try {
      const text = await callClaude('evaluate_reassess_response', {
        standardCode,
        standardTitle,
        passageText: passage,
        questionText: questions[currentQIndex] || '',
        studentResponse: currentResponse,
        questionNumber: String(currentQIndex + 1),
      });

      const mastered = text.startsWith('MASTERY: YES');
      const feedbackText = text.replace(/^MASTERY:\s*(YES|NO)\n+/, '').trim();

      try {
        await supabase.from('responses').insert({
          session_id: reassessSessionId,
          student_id: studentId,
          standard_id: standardId,
          intervention_type: 'reassess',
          intervention_content: passage,
          student_response: currentResponse,
          mastery_achieved: mastered,
          attempt_number: 1,
          ai_feedback: feedbackText,
        });
      } catch (err) {
        console.error('[ReassessSession] Response save error:', err);
      }

      setMasteredArr((prev) => [...prev, mastered]);
      setAllFeedback((prev) => [...prev, feedbackText]);
      setFeedback(feedbackText);
      setShowFeedback(true);
    } catch (err) {
      console.error('[ReassessSession] Submit error:', err);
      setMasteredArr((prev) => [...prev, false]);
      setAllFeedback((prev) => [...prev, 'Response submitted.']);
      setFeedback('Your response was submitted.');
      setShowFeedback(true);
    } finally {
      setSubmitting(false);
    }
  }, [
    currentResponse,
    submitting,
    standardCode,
    standardTitle,
    passage,
    questions,
    currentQIndex,
    reassessSessionId,
    studentId,
    standardId,
  ]);

  const handleNext = useCallback(async () => {
    const isLast = currentQIndex === questions.length - 1;

    if (!isLast) {
      setCurrentQIndex((prev) => prev + 1);
      setCurrentResponse('');
      setFeedback('');
      setShowFeedback(false);
      return;
    }

    const finalMastered = [...masteredArr];
    const masteredCount = finalMastered.filter(Boolean).length;
    const total = questions.length;
    const pct = Math.round((masteredCount / total) * 100);
    const passed = pct >= 80;

    try {
      const timeSpent = reassessStartRef.current
        ? Math.floor((Date.now() - reassessStartRef.current) / 1000)
        : 0;
      await supabase
        .from('sessions')
        .update({
          mastery_achieved: passed,
          status: 'completed',
          completed_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
        })
        .eq('id', reassessSessionId);
    } catch (err) {
      console.error('[ReassessSession] Session update error:', err);
    }

    if (passed) {
      router.push(`/student-mastery/${standardId}`);
    } else {
      router.push(`/student-teach/${standardId}/simplified`);
    }
  }, [currentQIndex, questions.length, masteredArr, reassessSessionId, standardId, router]);

  // ─── LOADING ──────────────────────────────────────────────────────────────

  const LOADING_MESSAGES = [
    'Getting your reading ready...',
    'Building your questions...',
    'Almost there...',
    'One more second...',
  ];

  if (view === 'loading' || contentLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Gogi avatar + message */}
          <div className="flex items-start gap-3 mb-8">
            <GogiAvatar />
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
              <p className="text-white text-sm font-medium leading-snug transition-all duration-500">
                {contentLoading
                  ? LOADING_MESSAGES[loadingMsgIndex]
                  : 'Setting up your reassessment…'}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {contentLoading && (
            <div className="space-y-2">
              <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1D9E75] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-[#4B5563] text-xs text-center">
                This usually takes about 20 seconds
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/[0.06] border border-red-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Reassessment</h2>
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

  if (view === 'intro') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-8 text-center">
            <div className="text-xs font-bold text-[#1D9E75] uppercase tracking-widest mb-2">
              Reassessment
            </div>
            <h1 className="text-white text-2xl font-extrabold mb-1">Mastery Check</h1>
            <p className="text-[#94A3B8] font-mono text-sm mb-5">
              {standardCode} — {standardTitle}
            </p>
            <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
              This is a brand new passage you have never seen. Five questions. No scaffolds, no
              sentence stems, no hints. Just you applying the skill you worked on.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Questions', value: '5' },
                { label: 'Mastery', value: '80%' },
                { label: 'Format', value: 'Written' },
              ].map((item) => (
                <div key={item.label} className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-white font-bold text-lg">{item.value}</div>
                  <div className="text-[#1D9E75] text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#1D9E75]/10 border border-[#1D9E75]/20 rounded-xl p-4 mb-6 text-left">
              <p className="text-[#1D9E75] text-xs font-semibold mb-1">
                You completed the intervention.
              </p>
              <p className="text-[#94A3B8] text-xs leading-relaxed">
                Everything you worked through — the explanation, the model, the attempts — prepared
                you for exactly this. Apply what you know.
              </p>
            </div>
            <button
              onClick={() => setView('assessment')}
              className="btn-primary w-full py-4 text-base"
            >
              Begin Reassessment
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ASSESSMENT ───────────────────────────────────────────────────────────

  if (view === 'assessment') {
    const isLast = currentQIndex === questions.length - 1;

    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col">
        {/* Header */}
        <div className="bg-[#0d0f12] border-b border-white/[0.08] px-4 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">Reassessment</span>
                <span className="text-[#1D9E75] text-xs font-mono">{standardCode}</span>
                <span className="bg-[#1D9E75]/20 text-[#1D9E75] text-xs font-bold px-2 py-0.5 rounded-full border border-[#1D9E75]/30">
                  Mastery Check
                </span>
              </div>
              <span className="text-[#4B5563] text-xs">
                Q {currentQIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1D9E75] rounded-full transition-all duration-300"
                style={{
                  width: `${((currentQIndex + (showFeedback ? 1 : 0)) / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Passage Panel */}
              <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto scrollbar-thin">
                <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-3">
                  Passage
                </div>
                <p className="text-[#94A3B8] text-sm leading-relaxed whitespace-pre-line">
                  {passage}
                </p>
              </div>

              {/* Question Panel */}
              <div className="flex flex-col gap-4">
                <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-[#1D9E75]/20 text-[#1D9E75] text-xs font-bold px-2.5 py-1 rounded-full">
                      Q{currentQIndex + 1}
                    </span>
                    <span className="text-[#4B5563] text-xs">Written Response</span>
                  </div>
                  <p className="text-white text-base font-medium leading-snug">
                    {questions[currentQIndex]}
                  </p>
                </div>

                {/* Textarea */}
                {!showFeedback && (
                  <>
                    <textarea
                      value={currentResponse}
                      onChange={(e) => setCurrentResponse(e.target.value)}
                      placeholder="Write your complete response. Make a specific claim, support it with evidence from the passage, and explain your reasoning."
                      rows={6}
                      className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm leading-relaxed placeholder:text-[#4B5563] focus:outline-none focus:border-[#1D9E75]/50 resize-none transition-all"
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={currentResponse.trim().length < 15 || submitting}
                      className="btn-primary w-full py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Evaluating…</span>
                        </>
                      ) : (
                        'Submit Response'
                      )}
                    </button>
                  </>
                )}

                {/* Feedback */}
                {showFeedback && (
                  <>
                    <div
                      className={`rounded-2xl p-4 border ${
                        masteredArr[masteredArr.length - 1]
                          ? 'bg-[#1D9E75]/10 border-[#1D9E75]/30'
                          : 'bg-white/[0.06] border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-widest ${
                            masteredArr[masteredArr.length - 1]
                              ? 'text-[#1D9E75]'
                              : 'text-[#94A3B8]'
                          }`}
                        >
                          {masteredArr[masteredArr.length - 1] ? 'Strong Response' : 'Q' + (currentQIndex + 1) + ' Feedback'}
                        </span>
                      </div>
                      <div className="space-y-0.5">{renderMarkdown(feedback)}</div>
                    </div>

                    <button
                      onClick={handleNext}
                      className="btn-primary w-full py-3.5"
                    >
                      {isLast ? 'View Results' : 'Next Question'}
                      <span>→</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
