'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeachView = 'loading' | 'error' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5';

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTENCE_STEMS: Record<string, string> = {
  'ELA.9.R.1.1':
    'Based on the text, I can infer that _____ because the passage states "___", which suggests _____.',
  'ELA.9.R.1.2':
    'The universal theme of this text is _____ because the author shows _____ through _____.',
  'ELA.9.R.2.1':
    'The author structures this text by _____, which helps the reader understand _____ by _____.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePassageFromContent(content: string): string {
  const withoutCorrect = content.replace(/\nCORRECT:\s*[A-D][^\n]*/i, '').trim();
  const withoutChoices = withoutCorrect
    .replace(/^[A-D][.)]\s+.+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const paragraphs = withoutChoices.split(/\n\n+/).filter((p) => p.trim().length > 0);
  return paragraphs.slice(0, -1).join('\n\n').trim();
}

async function callClaude(action: string, params: Record<string, string>): Promise<string> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) throw new Error(`Claude API call failed: ${res.status}`);
  const data = await res.json();
  return (data.text as string) || '';
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;

    // Full-line bold headers: **Header:**
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      return (
        <p key={i} className="font-bold text-white mt-4 mb-1 text-sm">
          {line.replace(/\*\*/g, '')}
        </p>
      );
    }

    // Inline bold
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-slate-300 text-sm mt-1 leading-relaxed">
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="text-white font-semibold">
                {part}
              </strong>
            ) : (
              part
            ),
          )}
        </p>
      );
    }

    // Numbered list items like "1. text" or "2. text"
    if (/^\d+\.\s/.test(line)) {
      return (
        <p key={i} className="text-slate-300 text-sm mt-2 leading-relaxed ml-2">
          {line}
        </p>
      );
    }

    // Bullet points
    if (/^[-•]\s/.test(line)) {
      return (
        <li key={i} className="text-slate-300 text-sm mt-1 ml-4 list-disc leading-relaxed">
          {line.replace(/^[-•]\s/, '')}
        </li>
      );
    }

    return (
      <p key={i} className="text-slate-300 text-sm mt-1 leading-relaxed">
        {line}
      </p>
    );
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SpinnerBlock({ color = 'violet', label }: { color?: string; label: string }) {
  const ringColor =
    color === 'blue'
      ? 'border-blue-500'
      : color === 'amber'
        ? 'border-amber-500'
        : color === 'emerald'
          ? 'border-emerald-500'
          : 'border-violet-500';
  const textColor =
    color === 'blue'
      ? 'text-blue-300'
      : color === 'amber'
        ? 'text-amber-300'
        : color === 'emerald'
          ? 'text-emerald-300'
          : 'text-violet-300';
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full border-2 ${ringColor} border-t-transparent animate-spin mb-4`}
      />
      <p className={`${textColor} text-sm`}>{label}</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachSession() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();
  const standardId = params.standardId;

  const [view, setView] = useState<TeachView>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Loaded from Supabase
  const [studentId, setStudentId] = useState('');
  const [teachSessionId, setTeachSessionId] = useState('');
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');
  const [diagnosticClassification, setDiagnosticClassification] = useState('');
  const [diagnosticStudentResponse, setDiagnosticStudentResponse] = useState('');
  const [diagnosticPassage, setDiagnosticPassage] = useState('');

  // Step 1 & 2 — Claude content
  const [claudeContent, setClaudeContent] = useState('');
  const [claudeLoading, setClaudeLoading] = useState(false);

  // Step 3 — Guided Attempt
  const [step3Evidence, setStep3Evidence] = useState('');
  const [step3EvidenceLoaded, setStep3EvidenceLoaded] = useState(false);
  const [step3Response, setStep3Response] = useState('');
  const [step3Feedback, setStep3Feedback] = useState('');
  const [step3AttemptNum, setStep3AttemptNum] = useState(1);
  const [step3Mastered, setStep3Mastered] = useState(false);
  const [step3Submitting, setStep3Submitting] = useState(false);
  const [step3ShowFeedback, setStep3ShowFeedback] = useState(false);

  // Step 4 — Independent Attempt
  const [step4Passage, setStep4Passage] = useState('');
  const [step4Question, setStep4Question] = useState('');
  const [step4PassageLoaded, setStep4PassageLoaded] = useState(false);
  const [step4Response, setStep4Response] = useState('');
  const [step4Feedback, setStep4Feedback] = useState('');
  const [step4AttemptNum, setStep4AttemptNum] = useState(1);
  const [step4Mastered, setStep4Mastered] = useState(false);
  const [step4Submitting, setStep4Submitting] = useState(false);
  const [step4ShowFeedback, setStep4ShowFeedback] = useState(false);

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

        // Get most recent wrong response for this student + standard
        const { data: wrongResponse } = await supabase
          .from('responses')
          .select('diagnostic_classification, student_response, question_id, cognitive_skill_targeted')
          .eq('student_id', student.id)
          .eq('standard_id', standardId)
          .eq('mastery_achieved', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let classification = '';
        let studentResp = '';
        let passage = '';

        if (wrongResponse) {
          classification =
            wrongResponse.diagnostic_classification ||
            wrongResponse.cognitive_skill_targeted ||
            `applying the core reasoning skill for ${standard.title}`;
          studentResp = wrongResponse.student_response || '';
          setDiagnosticClassification(classification);
          setDiagnosticStudentResponse(studentResp);

          if (wrongResponse.question_id) {
            const { data: question } = await supabase
              .from('questions')
              .select('content')
              .eq('id', wrongResponse.question_id)
              .single();

            if (question?.content) {
              passage = parsePassageFromContent(question.content);
            }
          }
        } else {
          classification = `applying the core reasoning skill for ${standard.title}`;
          setDiagnosticClassification(classification);
        }

        setDiagnosticPassage(passage);

        // Create teach session
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            student_id: student.id,
            standard_id: standardId,
            phase: 'teach',
            status: 'in_progress',
          })
          .select('id')
          .single();

        if (sessionError || !session) {
          setErrorMsg('Failed to start your session. Please try again.');
          setView('error');
          return;
        }
        setTeachSessionId(session.id);

        // Transition to step 1 and load explanation
        setView('step1');
        setClaudeLoading(true);
        try {
          const text = await callClaude('explanation', {
            standardCode: standard.code,
            standardTitle: standard.title,
            diagnosticClassification: classification,
            studentResponse: studentResp || 'no response recorded',
          });
          setClaudeContent(text);
        } catch (err) {
          console.error('[TeachSession] Step 1 Claude error:', err);
          setClaudeContent(
            'We had trouble loading your personalized explanation right now. Please continue — your teacher can review your progress.',
          );
        } finally {
          setClaudeLoading(false);
        }
      } catch (err) {
        console.error('[TeachSession] Init error:', err);
        setErrorMsg('Something went wrong. Please refresh and try again.');
        setView('error');
      }
    }

    init();
  }, [standardId, router]);

  // ─── Step Transitions ──────────────────────────────────────────────────────

  const goToStep2 = useCallback(async () => {
    setView('step2');
    setClaudeContent('');
    setClaudeLoading(true);
    try {
      const text = await callClaude('worked_example', {
        standardCode,
        standardTitle,
      });
      setClaudeContent(text);
    } catch (err) {
      console.error('[TeachSession] Step 2 Claude error:', err);
      setClaudeContent(
        'We had trouble loading the worked example. Your teacher can assist. Please continue when ready.',
      );
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle]);

  const goToStep3 = useCallback(async () => {
    setView('step3');
    setStep3EvidenceLoaded(false);
    setStep3Evidence('');
    setStep3Response('');
    setStep3Feedback('');
    setStep3AttemptNum(1);
    setStep3Mastered(false);
    setStep3ShowFeedback(false);

    if (!diagnosticPassage) {
      setStep3Evidence(
        'No original passage was found. Use your understanding of the standard and the skill to write your response.',
      );
      setStep3EvidenceLoaded(true);
      return;
    }

    setClaudeLoading(true);
    try {
      const text = await callClaude('guided_evidence', {
        standardCode,
        standardTitle,
        passageText: diagnosticPassage,
      });
      setStep3Evidence(text);
      setStep3EvidenceLoaded(true);
    } catch (err) {
      console.error('[TeachSession] Step 3 evidence error:', err);
      setStep3Evidence(
        'Evidence could not be loaded. Use the passage above to find your own supporting details.',
      );
      setStep3EvidenceLoaded(true);
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle, diagnosticPassage]);

  const goToStep4 = useCallback(async () => {
    setView('step4');
    setStep4PassageLoaded(false);
    setStep4Passage('');
    setStep4Question('');
    setStep4Response('');
    setStep4Feedback('');
    setStep4AttemptNum(1);
    setStep4Mastered(false);
    setStep4ShowFeedback(false);
    setClaudeLoading(true);
    try {
      const text = await callClaude('generate_independent_passage', {
        standardCode,
        standardTitle,
      });
      // Parse **Passage:** and **Question:** blocks
      const passageMatch = text.match(/\*\*Passage:\*\*\s*([\s\S]+?)(?=\n\n\*\*Question:\*\*|$)/);
      const questionMatch = text.match(/\*\*Question:\*\*\s*([\s\S]+?)$/);
      setStep4Passage(passageMatch?.[1]?.trim() || text);
      setStep4Question(
        questionMatch?.[1]?.trim() ||
          'Apply this standard to the passage above. Write a complete response with a clear claim and textual evidence.',
      );
      setStep4PassageLoaded(true);
    } catch (err) {
      console.error('[TeachSession] Step 4 passage error:', err);
      setStep4Passage(
        'A passage could not be generated at this time. Please ask your teacher for assistance.',
      );
      setStep4Question('Demonstrate your understanding of this standard with a written response.');
      setStep4PassageLoaded(true);
    } finally {
      setClaudeLoading(false);
    }
  }, [standardCode, standardTitle]);

  const goToStep5 = useCallback(async () => {
    setView('step5');
    try {
      await supabase
        .from('sessions')
        .update({
          mastery_achieved: true,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', teachSessionId);
    } catch (err) {
      console.error('[TeachSession] Step 5 session update error:', err);
    }
    setTimeout(() => {
      router.push(`/student-reassess/${standardId}`);
    }, 3000);
  }, [teachSessionId, standardId, router]);

  // ─── Step 3 Handlers ──────────────────────────────────────────────────────

  const handleStep3Submit = useCallback(async () => {
    if (!step3Response.trim() || step3Submitting) return;
    setStep3Submitting(true);
    try {
      const text = await callClaude('evaluate_guided', {
        standardCode,
        standardTitle,
        passageText: diagnosticPassage,
        studentResponse: step3Response,
        attemptNumber: String(step3AttemptNum),
      });

      const mastered = text.startsWith('MASTERY: YES');
      const feedbackText = text.replace(/^MASTERY:\s*(YES|NO)\n+/, '').trim();

      try {
        await supabase.from('responses').insert({
          session_id: teachSessionId,
          student_id: studentId,
          standard_id: standardId,
          intervention_type: 'guided_attempt',
          intervention_content: diagnosticPassage,
          student_response: step3Response,
          mastery_achieved: mastered,
          attempt_number: step3AttemptNum,
          ai_feedback: feedbackText,
          diagnostic_classification: diagnosticClassification,
        });
      } catch (err) {
        console.error('[TeachSession] Step 3 response save error:', err);
      }

      setStep3Feedback(feedbackText);
      setStep3Mastered(mastered);
      setStep3ShowFeedback(true);
    } catch (err) {
      console.error('[TeachSession] Step 3 evaluate error:', err);
      setStep3Feedback(
        'Your response was submitted. Please continue when you are ready.',
      );
      setStep3Mastered(false);
      setStep3ShowFeedback(true);
    } finally {
      setStep3Submitting(false);
    }
  }, [
    step3Response,
    step3AttemptNum,
    step3Submitting,
    standardCode,
    standardTitle,
    diagnosticPassage,
    teachSessionId,
    studentId,
    standardId,
    diagnosticClassification,
  ]);

  const handleStep3Continue = useCallback(() => {
    if (step3Mastered || step3AttemptNum >= 3) {
      goToStep4();
      return;
    }
    setStep3AttemptNum((prev) => prev + 1);
    setStep3Response('');
    setStep3Feedback('');
    setStep3ShowFeedback(false);
  }, [step3Mastered, step3AttemptNum, goToStep4]);

  // ─── Step 4 Handlers ──────────────────────────────────────────────────────

  const handleStep4Submit = useCallback(async () => {
    if (!step4Response.trim() || step4Submitting) return;
    setStep4Submitting(true);
    try {
      const text = await callClaude('evaluate_independent', {
        standardCode,
        standardTitle,
        passageText: step4Passage,
        passageQuestion: step4Question,
        studentResponse: step4Response,
        attemptNumber: String(step4AttemptNum),
      });

      const mastered = text.startsWith('MASTERY: YES');
      const feedbackText = text.replace(/^MASTERY:\s*(YES|NO)\n+/, '').trim();

      try {
        await supabase.from('responses').insert({
          session_id: teachSessionId,
          student_id: studentId,
          standard_id: standardId,
          intervention_type: 'independent_attempt',
          intervention_content: step4Passage,
          student_response: step4Response,
          mastery_achieved: mastered,
          attempt_number: step4AttemptNum,
          ai_feedback: feedbackText,
          diagnostic_classification: diagnosticClassification,
        });
      } catch (err) {
        console.error('[TeachSession] Step 4 response save error:', err);
      }

      setStep4Feedback(feedbackText);
      setStep4Mastered(mastered);
      setStep4ShowFeedback(true);
    } catch (err) {
      console.error('[TeachSession] Step 4 evaluate error:', err);
      setStep4Feedback('Your response was submitted. Please continue when you are ready.');
      setStep4Mastered(false);
      setStep4ShowFeedback(true);
    } finally {
      setStep4Submitting(false);
    }
  }, [
    step4Response,
    step4AttemptNum,
    step4Submitting,
    standardCode,
    standardTitle,
    step4Passage,
    step4Question,
    teachSessionId,
    studentId,
    standardId,
    diagnosticClassification,
  ]);

  const handleStep4Continue = useCallback(() => {
    if (step4Mastered) {
      goToStep5();
      return;
    }
    if (step4AttemptNum >= 5) {
      router.push(`/student-teach/${standardId}/simplified`);
      return;
    }
    setStep4AttemptNum((prev) => prev + 1);
    setStep4Response('');
    setStep4Feedback('');
    setStep4ShowFeedback(false);
  }, [step4Mastered, step4AttemptNum, standardId, router, goToStep5]);

  // ─── Shared UI ────────────────────────────────────────────────────────────

  const STEP_LABELS = ['Explanation', 'Model', 'Guided', 'Independent', 'Complete'];
  const currentStepNum =
    view === 'step1'
      ? 1
      : view === 'step2'
        ? 2
        : view === 'step3'
          ? 3
          : view === 'step4'
            ? 4
            : view === 'step5'
              ? 5
              : 0;

  function Header() {
    return (
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
          <span className="text-violet-400 text-xs font-medium hidden sm:block">
            AI-Powered Literacy Platform
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-violet-400 font-mono">{standardCode}</span>
          <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
            Teach
          </span>
        </div>
      </header>
    );
  }

  function StepProgress() {
    return (
      <div className="px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-1">
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const isActive = currentStepNum === n;
            const isDone = currentStepNum > n;
            return (
              <React.Fragment key={label}>
                {idx > 0 && (
                  <div className={`h-px flex-1 ${isDone ? 'bg-emerald-500/60' : 'bg-white/10'}`} />
                )}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    isActive
                      ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                      : isDone
                        ? 'text-emerald-400'
                        : 'text-slate-600'
                  }`}
                >
                  <span>{isDone ? '✓' : n}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-violet-300 text-sm">Setting up your lesson…</p>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Lesson</h2>
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

  if (view === 'step5') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-xl w-full text-center">
            <div className="text-6xl mb-6">🎯</div>
            <h1 className="text-white text-3xl font-extrabold mb-3">Intervention Complete</h1>
            <p className="text-violet-300 text-sm mb-2">
              {standardCode} — {standardTitle}
            </p>
            <p className="text-slate-300 text-sm leading-relaxed mb-8 max-w-md mx-auto">
              You worked through the skill. Now it&apos;s time to show what you know — on a completely
              new passage, with no scaffolds, no hints. Just you and the text.
            </p>
            <div className="bg-violet-900/20 border border-violet-500/20 rounded-2xl p-5">
              <p className="text-violet-300 text-sm">Taking you to your Reassessment…</p>
              <div className="mt-3 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 1 — Explanation ─────────────────────────────────────────────────

  if (view === 'step1') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <StepProgress />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                🧠
              </div>
              <div>
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-0.5">
                  Step 1 of 5 — Explanation
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                  What happened and what it means
                </h1>
              </div>
            </div>

            {claudeLoading ? (
              <SpinnerBlock color="violet" label="Analyzing your response…" />
            ) : (
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-6 mb-6">
                <div className="space-y-0.5">{renderMarkdown(claudeContent)}</div>
              </div>
            )}

            {!claudeLoading && (
              <div className="flex justify-end mt-6">
                <button
                  onClick={goToStep2}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-violet-500/30"
                >
                  <span>Ready to Continue</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 2 — Worked Example ──────────────────────────────────────────────

  if (view === 'step2') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <StepProgress />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                👁️
              </div>
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-0.5">
                  Step 2 of 5 — Worked Example
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                  Watch the thinking in action
                </h1>
              </div>
            </div>

            {claudeLoading ? (
              <SpinnerBlock color="blue" label="Building your worked example…" />
            ) : (
              <div className="bg-white/5 border border-blue-500/20 rounded-2xl p-6 mb-6">
                <div className="space-y-0.5">{renderMarkdown(claudeContent)}</div>
              </div>
            )}

            {!claudeLoading && (
              <div className="flex justify-end mt-6">
                <button
                  onClick={goToStep3}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-blue-500/30"
                >
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 3 — Guided Attempt ──────────────────────────────────────────────

  if (view === 'step3') {
    const sentenceStem =
      SENTENCE_STEMS[standardCode] ||
      'The text shows that _____ because "_____", which means _____.';
    const attemptsLeft = 3 - step3AttemptNum;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <StepProgress />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-600/30 border border-amber-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                ✏️
              </div>
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-0.5">
                  Step 3 of 5 — Guided Attempt
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                  Your turn — with support
                </h1>
              </div>
            </div>

            {/* Original Passage */}
            {diagnosticPassage ? (
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 mb-5">
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
                  Original Passage
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                  {diagnosticPassage}
                </p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
                <p className="text-slate-500 text-sm italic">
                  No passage was available from your diagnostic. Use your knowledge of the standard to
                  guide your response.
                </p>
              </div>
            )}

            {/* Evidence */}
            {!step3EvidenceLoaded && claudeLoading ? (
              <SpinnerBlock color="amber" label="Finding relevant evidence…" />
            ) : step3EvidenceLoaded ? (
              <div className="bg-amber-900/10 border border-amber-500/20 rounded-2xl p-5 mb-5">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
                  Evidence to Consider
                </div>
                <div className="space-y-0.5">{renderMarkdown(step3Evidence)}</div>
              </div>
            ) : null}

            {/* Sentence Stem */}
            {step3EvidenceLoaded && !step3ShowFeedback && (
              <div className="bg-violet-900/20 border border-violet-500/20 rounded-2xl p-4 mb-4">
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-2">
                  Sentence Stem
                </div>
                <p className="text-violet-300 text-sm italic leading-relaxed">{sentenceStem}</p>
              </div>
            )}

            {/* Response Textarea */}
            {step3EvidenceLoaded && !step3ShowFeedback && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Your Response
                  </label>
                  {step3AttemptNum > 1 && (
                    <span className="text-xs text-amber-400">
                      Attempt {step3AttemptNum} of 3
                    </span>
                  )}
                </div>
                <textarea
                  value={step3Response}
                  onChange={(e) => setStep3Response(e.target.value)}
                  placeholder="Write your complete response here. Use the sentence stem as a starting point, then expand with your own thinking."
                  rows={5}
                  className="w-full bg-white/5 border border-violet-500/20 rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none transition-all"
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-slate-500">
                    {step3Response.length > 0 ? `${step3Response.length} characters` : ''}
                  </span>
                  <button
                    onClick={handleStep3Submit}
                    disabled={step3Response.trim().length < 15 || step3Submitting}
                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl text-sm transition-all flex items-center gap-2"
                  >
                    {step3Submitting ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Evaluating…</span>
                      </>
                    ) : (
                      'Submit Response'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Feedback */}
            {step3ShowFeedback && (
              <div
                className={`rounded-2xl p-5 mb-5 border ${
                  step3Mastered
                    ? 'bg-emerald-900/20 border-emerald-500/30'
                    : 'bg-slate-800/50 border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-widest ${
                      step3Mastered ? 'text-emerald-400' : 'text-violet-400'
                    }`}
                  >
                    {step3Mastered ? '✓ Mastery Demonstrated' : `Attempt ${step3AttemptNum} of 3`}
                  </span>
                </div>
                <div className="space-y-0.5">{renderMarkdown(step3Feedback)}</div>
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={handleStep3Continue}
                    className={`font-bold py-3 px-6 rounded-xl text-sm transition-all flex items-center gap-2 ${
                      step3Mastered
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30'
                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                    }`}
                  >
                    {step3Mastered
                      ? 'Continue to Independent Attempt →'
                      : step3AttemptNum >= 3
                        ? 'Continue to Next Step →'
                        : `Try Again (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left) →`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 4 — Independent Attempt ────────────────────────────────────────

  if (view === 'step4') {
    const attemptsLeft = 5 - step4AttemptNum;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
        <Header />
        <StepProgress />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                💪
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-0.5">
                  Step 4 of 5 — Independent Attempt
                </div>
                <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                  No scaffolds. Just you.
                </h1>
              </div>
            </div>

            {!step4PassageLoaded || claudeLoading ? (
              <SpinnerBlock color="emerald" label="Generating your passage…" />
            ) : (
              <>
                {/* New Passage */}
                <div className="bg-white/5 border border-emerald-500/20 rounded-2xl p-5 mb-5">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">
                    New Passage
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {step4Passage}
                  </p>
                </div>

                {/* Question */}
                <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-4 mb-5">
                  <p className="text-white text-sm font-medium leading-snug">{step4Question}</p>
                </div>

                {/* Response Textarea */}
                {!step4ShowFeedback && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Your Response
                      </label>
                      {step4AttemptNum > 1 && (
                        <span className="text-xs text-emerald-400">
                          Attempt {step4AttemptNum} of 5
                        </span>
                      )}
                    </div>
                    <textarea
                      value={step4Response}
                      onChange={(e) => setStep4Response(e.target.value)}
                      placeholder="Write a complete response. Make a specific claim about what this text means, support it with evidence from the passage, and explain your reasoning."
                      rows={5}
                      className="w-full bg-white/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none transition-all"
                    />
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs text-slate-500">
                        {step4Response.length > 0 ? `${step4Response.length} characters` : ''}
                      </span>
                      <button
                        onClick={handleStep4Submit}
                        disabled={step4Response.trim().length < 15 || step4Submitting}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl text-sm transition-all flex items-center gap-2"
                      >
                        {step4Submitting ? (
                          <>
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            <span>Evaluating…</span>
                          </>
                        ) : (
                          'Submit Response'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {step4ShowFeedback && (
                  <div
                    className={`rounded-2xl p-5 mb-5 border ${
                      step4Mastered
                        ? 'bg-emerald-900/20 border-emerald-500/30'
                        : 'bg-slate-800/50 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`text-xs font-bold uppercase tracking-widest ${
                          step4Mastered ? 'text-emerald-400' : 'text-violet-400'
                        }`}
                      >
                        {step4Mastered
                          ? '✓ Mastery Demonstrated'
                          : `Attempt ${step4AttemptNum} of 5`}
                      </span>
                    </div>
                    <div className="space-y-0.5">{renderMarkdown(step4Feedback)}</div>
                    <div className="mt-5 flex justify-end">
                      <button
                        onClick={handleStep4Continue}
                        className={`font-bold py-3 px-6 rounded-xl text-sm transition-all flex items-center gap-2 ${
                          step4Mastered
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/30'
                            : step4AttemptNum >= 5
                              ? 'bg-violet-600 hover:bg-violet-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {step4Mastered
                          ? 'Mastery Confirmed — Continue →'
                          : step4AttemptNum >= 5
                            ? 'Get Additional Support →'
                            : `Try Again (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left) →`}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
