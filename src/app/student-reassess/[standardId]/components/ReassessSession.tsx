'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { callClaude } from '@/lib/callClaude';
import { renderMarkdown } from '@/lib/renderMarkdown';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReassessView = 'loading' | 'error' | 'intro' | 'assessment' | 'results';

function parseReassessContent(text: string): { passage: string; questions: string[] } {
  const sections = text
    .split(/---(?:PASSAGE|QUESTION \d+)---/)
    .map((s) => s.trim())
    .filter(Boolean);
  const passage = sections[0] || '';
  const questions = sections.slice(1, 6);
  // Pad to exactly 5 if Claude returned fewer
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

  // Loaded from Supabase
  const [studentId, setStudentId] = useState('');
  const [reassessSessionId, setReassessSessionId] = useState('');
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');

  // Content from Claude
  const [passage, setPassage] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  // Assessment state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentResponse, setCurrentResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [masteredArr, setMasteredArr] = useState<boolean[]>([]);
  const [allFeedback, setAllFeedback] = useState<string[]>([]);

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

        // Create reassess session
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

        // Generate passage + 5 questions
        setContentLoading(true);
        try {
          const text = await callClaude('generate_reassess', {
            standardCode: standard.code,
            standardTitle: standard.title,
          });
          const parsed = parseReassessContent(text);
          setPassage(parsed.passage);
          setQuestions(parsed.questions);
        } catch (err) {
          console.error('[ReassessSession] Generate error:', err);
          setErrorMsg('Failed to generate your reassessment. Please try again.');
          setView('error');
          return;
        } finally {
          setContentLoading(false);
        }

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

      // Save to responses table
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

    // All questions answered — calculate score
    const finalMastered = [...masteredArr];
    const masteredCount = finalMastered.filter(Boolean).length;
    const total = questions.length;
    const pct = Math.round((masteredCount / total) * 100);
    const passed = pct >= 80;

    // Update reassess session
    try {
      await supabase
        .from('sessions')
        .update({
          mastery_achieved: passed,
          status: 'completed',
          completed_at: new Date().toISOString(),
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

  if (view === 'loading' || contentLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-emerald-300 text-sm">
            {contentLoading ? 'Generating your reassessment…' : 'Setting up your reassessment…'}
          </p>
        </div>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Reassessment</h2>
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

  if (view === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="bg-white/5 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-sm text-center">
            <div className="text-5xl mb-5">🎯</div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">
              Reassessment
            </div>
            <h1 className="text-white text-2xl font-extrabold mb-1">Mastery Check</h1>
            <p className="text-violet-300 font-mono text-sm mb-5">
              {standardCode} — {standardTitle}
            </p>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              This is a brand new passage you have never seen. Five questions. No scaffolds, no
              sentence stems, no hints. Just you applying the skill you worked on.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Questions', value: '5' },
                { label: 'Mastery', value: '80%' },
                { label: 'Format', value: 'Written' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-xl p-3">
                  <div className="text-white font-bold text-lg">{item.value}</div>
                  <div className="text-emerald-400 text-xs mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4 mb-6 text-left">
              <p className="text-emerald-400 text-xs font-semibold mb-1">
                You completed the intervention.
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">
                Everything you worked through — the explanation, the model, the attempts — prepared
                you for exactly this. Apply what you know.
              </p>
            </div>
            <button
              onClick={() => setView('assessment')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-emerald-500/30"
            >
              Begin Reassessment →
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900/80 border-b border-white/10 px-4 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">Reassessment</span>
                <span className="text-violet-400 text-xs font-mono">{standardCode}</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Mastery Check
                </span>
              </div>
              <span className="text-slate-400 text-xs">
                Q {currentQIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
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
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
                  Passage
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                  {passage}
                </p>
              </div>

              {/* Question Panel */}
              <div className="flex flex-col gap-4">
                <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      Q{currentQIndex + 1}
                    </span>
                    <span className="text-slate-500 text-xs">Written Response</span>
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
                      className="w-full bg-white/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none transition-all"
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={currentResponse.trim().length < 15 || submitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
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
                          ? 'bg-emerald-900/20 border-emerald-500/30'
                          : 'bg-slate-800/50 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-widest ${
                            masteredArr[masteredArr.length - 1]
                              ? 'text-emerald-400'
                              : 'text-violet-400'
                          }`}
                        >
                          {masteredArr[masteredArr.length - 1] ? '✓ Strong Response' : 'Q' + (currentQIndex + 1) + ' Feedback'}
                        </span>
                      </div>
                      <div className="space-y-0.5">{renderMarkdown(feedback)}</div>
                    </div>

                    <button
                      onClick={handleNext}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all"
                    >
                      {isLast ? 'View Results →' : 'Next Question →'}
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
