'use client';

// PracticeSession.tsx
// Confidence Builder — 3 progressive practice questions after the Teach phase.
// Q1: scaffolded (one support active)
// Q2: reduced (direction given, no frame)
// Q3: independent (no scaffold)
// Formative only — Q3 failure is encouraged, not blocking. Routes to Reassess after all 3.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { callClaude } from '@/lib/callClaude';
import { useStreamingClaude } from '@/lib/useStreamingClaude';
import GogiAvatar from '@/components/GogiAvatar';
import { cleanPassageText } from '@/lib/passageUtils';
import MultipleChoiceStep from '@/app/student-teach/[standardId]/interactions/MultipleChoiceStep';
import FillInStep from '@/app/student-teach/[standardId]/interactions/FillInStep';
import ShortResponseStep from '@/app/student-teach/[standardId]/interactions/ShortResponseStep';
import StructuredResponseStep from '@/app/student-teach/[standardId]/interactions/StructuredResponseStep';
import PassageAnnotatorStep from '@/components/protocol/steps/PassageAnnotatorStep';
import DragAndDropStep from '@/components/protocol/steps/DragAndDropStep';

// ─── Types ────────────────────────────────────────────────────────────────────

type PracticeView = 'loading' | 'error' | 'generating' | 'question' | 'evaluating' | 'feedback' | 'complete' | 'transitioning';
type QNum = 1 | 2 | 3;
type ScaffoldLevel = 'full' | 'reduced' | 'none';
type InteractionType =
  | 'multiple_choice'
  | 'fill_in'
  | 'short_response'
  | 'structured_response'
  | 'passage_annotation'
  | 'drag_and_drop';

interface GeneratedQuestion {
  instruction: string;
  choices?: string[];
  items?: string[];
  categories?: string[];
}

interface PracticeEval {
  mastery_achieved: boolean;
  feedback: string;
  scaffold_level_cleared: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCAFFOLD_LABELS: Record<QNum, string> = {
  1: 'Guided',
  2: 'Almost there',
  3: 'On your own',
};

const SCAFFOLD_LEVELS: Record<QNum, ScaffoldLevel> = {
  1: 'full',
  2: 'reduced',
  3: 'none',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInteractionType(standardCode: string, qNum: QNum): InteractionType {
  if (standardCode === 'ELA.9.R.1.1') return 'passage_annotation';
  if (standardCode === 'ELA.9.R.2.1') {
    if (qNum === 1) return 'drag_and_drop';
    if (qNum === 2) return 'passage_annotation';
    return 'structured_response';
  }
  // ELA.9.R.1.2
  if (qNum === 1) return 'multiple_choice';
  if (qNum === 2) return 'fill_in';
  return 'short_response';
}

function buildContent(q: GeneratedQuestion, interactionType: InteractionType, passage: string): string {
  switch (interactionType) {
    case 'passage_annotation':
      return `${q.instruction}\n---\n${passage}`;
    case 'drag_and_drop':
      if (!q.items?.length || !q.categories?.length) return q.instruction;
      return `${q.instruction}\n---\nITEMS: ${q.items.join(' | ')}\nCATEGORIES: ${q.categories.join(' | ')}`;
    case 'multiple_choice':
      if (!q.choices || q.choices.length < 4) return q.instruction;
      return `${q.instruction}\nA) ${q.choices[0]}\nB) ${q.choices[1]}\nC) ${q.choices[2]}\nD) ${q.choices[3]}`;
    default:
      return q.instruction;
  }
}

function parseJsonSafe<T>(raw: string): T | null {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PracticeSession() {
  const router = useRouter();
  const params = useParams<{ standardId: string }>();
  const standardId = params.standardId;

  const [view, setView] = useState<PracticeView>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [studentId, setStudentId] = useState('');
  const [practiceSessionId, setPracticeSessionId] = useState('');
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');
  const [passage, setPassage] = useState('');
  const [protocolName, setProtocolName] = useState('');
  const [cognitiveSkillTargeted, setCognitiveSkillTargeted] = useState('');

  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [qNum, setQNum] = useState<QNum>(1);
  const [currentFeedback, setCurrentFeedback] = useState('');
  const [q3Passed, setQ3Passed] = useState(false);

  const sessionStartRef = useRef<number>(0);
  const submittingRef = useRef(false);
  // Tracks when the current question became visible — reset on each 'question' view
  const questionStartRef = useRef<number>(0);
  const feedbackStreaming = useStreamingClaude();

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!standardId) return;

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
          setErrorMsg('Something is off on our end. Let your teacher know — they can fix it in 2 minutes.');
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
          setErrorMsg('We could not load your lesson. Try refreshing — if it keeps happening, let your teacher know.');
          setView('error');
          return;
        }
        setStandardCode(standard.code);
        setStandardTitle(standard.title);

        const { data: teachResponse } = await supabase
          .from('responses')
          .select('intervention_type, cognitive_skill_targeted')
          .eq('student_id', student.id)
          .eq('standard_id', standardId)
          .not('intervention_type', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const pName = teachResponse?.intervention_type ?? '';
        const skill = teachResponse?.cognitive_skill_targeted ?? '';
        setProtocolName(pName);
        setCognitiveSkillTargeted(skill);

        let passageText = '';
        const { data: interventionPassage } = await supabase
          .from('questions')
          .select('content')
          .eq('standard_id', standardId)
          .gt('difficulty_level', 0)
          .limit(1)
          .maybeSingle();

        if (interventionPassage?.content) {
          passageText = interventionPassage.content;
        } else {
          const { data: wrongResponse } = await supabase
            .from('responses')
            .select('question_id')
            .eq('student_id', student.id)
            .eq('standard_id', standardId)
            .eq('mastery_achieved', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (wrongResponse?.question_id) {
            const { data: question } = await supabase
              .from('questions')
              .select('content')
              .eq('id', wrongResponse.question_id)
              .single();
            passageText = question?.content ?? '';
          }
        }
        setPassage(passageText);

        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            student_id: student.id,
            standard_id: standardId,
            phase: 'practice',
            status: 'in_progress',
          })
          .select('id')
          .single();

        if (sessionError || !session) {
          setErrorMsg('We had trouble saving your progress. Try refreshing the page.');
          setView('error');
          return;
        }
        setPracticeSessionId(session.id);
        sessionStartRef.current = Date.now();

        setView('generating');
        const raw = await callClaude('generate_practice_questions', {
          standardCode: standard.code,
          standardTitle: standard.title,
          protocolName: pName,
          cognitiveSkillTargeted: skill,
          passageText,
        });

        const parsed = parseJsonSafe<{ q1: GeneratedQuestion; q2: GeneratedQuestion; q3: GeneratedQuestion }>(raw);
        if (!parsed || !parsed.q1 || !parsed.q2 || !parsed.q3) {
          setErrorMsg('We had trouble building your questions. Try refreshing the page.');
          setView('error');
          return;
        }

        setQuestions([parsed.q1, parsed.q2, parsed.q3]);
        setView('question');
      } catch (err) {
        console.error('[PracticeSession] Init error:', err);
        setErrorMsg('Something went wrong on our end. Try refreshing — your progress is saved.');
        setView('error');
      }
    }

    init();
  }, [standardId, router]);

  // Reset question timer each time a new question becomes visible
  useEffect(() => {
    if (view === 'question') {
      questionStartRef.current = Date.now();
    }
  }, [view]);

  // ─── Handle question submit ───────────────────────────────────────────────

  const handleQuestionSubmit = useCallback(async (response: string) => {
    if (submittingRef.current) return;
    const text = response.trim();
    if (!text) return;

    submittingRef.current = true;
    setView('evaluating');

    const q = questions[qNum - 1];
    const scaffoldLevel = SCAFFOLD_LEVELS[qNum];
    const timeOnQuestionSeconds = questionStartRef.current
      ? Math.round((Date.now() - questionStartRef.current) / 1000)
      : 0;

    try {
      const rawEval = await callClaude('evaluate_practice_response', {
        standardCode,
        standardTitle,
        question: q.instruction,
        studentResponse: text,
        scaffoldLevel,
        cognitiveSkillTargeted,
      });

      const eval_ = parseJsonSafe<PracticeEval>(rawEval);
      const mastery = eval_?.mastery_achieved ?? false;

      if (qNum === 3) setQ3Passed(mastery);

      try {
        await supabase.from('responses').insert({
          session_id: practiceSessionId,
          student_id: studentId,
          standard_id: standardId,
          cognitive_skill_targeted: cognitiveSkillTargeted,
          intervention_type: `practice_q${qNum}_${scaffoldLevel}`,
          attempt_number: qNum,
          mastery_achieved: mastery,
          student_response: text,
          ai_feedback: eval_?.feedback ?? null,
          time_on_question_seconds: timeOnQuestionSeconds,
        });
      } catch (saveErr) {
        console.error('[PracticeSession] Response save error:', saveErr);
      }

      // Switch to feedback view immediately, then stream Gogi feedback
      setView('feedback');
      const streamedFeedback = await feedbackStreaming.startStreaming('generate_protocol_feedback', {
        standardCode,
        standardTitle,
        studentResponse: text.substring(0, 400),
        passageContext: passage.substring(0, 150),
        masteryAchieved: String(mastery),
        feedbackContext: `Practice Q${qNum}, scaffold level: ${scaffoldLevel}`,
      });
      setCurrentFeedback(streamedFeedback);
    } catch (err) {
      console.error('[PracticeSession] Evaluate error:', err);
      setCurrentFeedback('Something went wrong evaluating your response. Keep going.');
      setView('feedback');
    } finally {
      submittingRef.current = false;
    }
  }, [questions, qNum, standardCode, standardTitle, cognitiveSkillTargeted, practiceSessionId, studentId, standardId]);

  // ─── Advance after feedback ───────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (qNum < 3) {
      setQNum((prev) => (prev + 1) as QNum);
      setCurrentFeedback('');
      setView('question');
      return;
    }

    const timeSpent = sessionStartRef.current
      ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
      : 0;

    if (practiceSessionId) {
      try {
        await supabase
          .from('sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            time_spent_seconds: timeSpent,
          })
          .eq('id', practiceSessionId);
      } catch (err) {
        console.error('[PracticeSession] Session close error:', err);
      }
    }

    setView('transitioning');
  }, [qNum, practiceSessionId]);

  // Auto-route to reassess after 3 seconds on the transition screen
  useEffect(() => {
    if (view !== 'transitioning') return;
    const t = setTimeout(() => router.push(`/student-reassess/${standardId}`), 3_000);
    return () => clearTimeout(t);
  }, [view, router, standardId]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const currentQuestion = questions[qNum - 1];
  const interactionType = standardCode ? getInteractionType(standardCode, qNum) : 'short_response';
  const scaffoldsActive = qNum === 1;
  const questionContent = currentQuestion && passage
    ? buildContent(currentQuestion, interactionType, passage)
    : '';

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (view === 'loading' || view === 'generating') {
    const label = view === 'generating' ? 'Building your practice questions…' : 'Setting up your practice…';
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[#94A3B8] text-sm">{label}</p>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (view === 'error') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/[0.06] border border-red-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Practice</h2>
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

  // ─── Transitioning ────────────────────────────────────────────────────────
  // Shown for 3 seconds after Q3 before auto-routing to reassess.

  if (view === 'transitioning' || view === 'complete') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6">
          {/* Checkmark */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-[#1D9E75]/20 border border-[#1D9E75]/40 flex items-center justify-center">
              <span className="text-[#1D9E75] text-2xl font-bold">✓</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-white text-center font-bold" style={{ fontSize: '22px' }}>
            Practice complete.
          </h1>

          {/* Gogi message */}
          <div className="flex items-start gap-3">
            <GogiAvatar />
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
              <p className="text-[#94A3B8] text-sm leading-relaxed">
                You just put in real work. Your check-in is next.
              </p>
            </div>
          </div>

          {/* Continue button — also available for impatient students */}
          <button
            onClick={() => router.push(`/student-reassess/${standardId}`)}
            className="btn-primary w-full py-3.5"
          >
            Continue
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── Evaluating ───────────────────────────────────────────────────────────

  if (view === 'evaluating') {
    return (
      <div className="h-screen bg-[#0d0f12] flex flex-col overflow-hidden">
        <PracticeHeader standardCode={standardCode} qNum={qNum} />
        <PracticeProgress qNum={qNum} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-[#94A3B8] text-sm">Evaluating your response…</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question + Feedback (split panel) ────────────────────────────────────

  return (
    <div className="h-screen bg-[#0d0f12] flex flex-col overflow-hidden">
      <PracticeHeader standardCode={standardCode} qNum={qNum} />
      <PracticeProgress qNum={qNum} />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

        {/* Left: Passage Panel */}
        <div className="md:w-2/5 w-full flex-shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.08] p-4 md:p-6 max-h-48 md:max-h-none">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
            Question {qNum} of 3 — {SCAFFOLD_LABELS[qNum]}
          </div>
          <h2 className="text-white font-extrabold text-lg mb-4 leading-tight">
            {scaffoldsActive ? 'With support' : qNum === 2 ? 'Less support' : 'On your own'}
          </h2>

          {passage && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-white font-bold" style={{ fontSize: '16px' }}>Literary Selection</p>
              <hr className="border-white/[0.08] my-3" />
              <p className="text-[#94A3B8] text-sm whitespace-pre-line leading-7">
                {cleanPassageText(passage)}
              </p>
            </div>
          )}

          {scaffoldsActive && (
            <div className="mt-4 bg-amber-900/20 border border-amber-500/20 rounded-xl px-3 py-2">
              <p className="text-amber-300 text-xs">Guided — you have support on this question.</p>
            </div>
          )}
        </div>

        {/* Right: Interaction or Feedback */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {view === 'feedback' ? (
            <div className="flex-1 flex flex-col p-4 md:p-6 gap-4">
              {(feedbackStreaming.isStreaming || currentFeedback) && (
                <div className="flex items-start gap-3">
                  <GogiAvatar />
                  <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                    <p className="text-[#94A3B8] text-sm leading-relaxed">
                      {feedbackStreaming.isStreaming ? feedbackStreaming.content : currentFeedback}
                      {feedbackStreaming.isStreaming && (
                        <span className="inline-block w-0.5 h-3.5 bg-[#1D9E75] ml-0.5 align-middle animate-pulse" />
                      )}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex justify-end mt-auto pt-4">
                <button
                  onClick={handleContinue}
                  disabled={feedbackStreaming.isStreaming}
                  className="btn-primary py-3 px-8 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{qNum < 3 ? `Question ${qNum + 1}` : 'See Results'}</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {interactionType === 'multiple_choice' && (
                <MultipleChoiceStep
                  content={questionContent}
                  scaffoldsActive={scaffoldsActive}
                  onSubmit={handleQuestionSubmit}
                />
              )}
              {interactionType === 'fill_in' && (
                <FillInStep
                  content={questionContent}
                  scaffoldsActive={scaffoldsActive}
                  onSubmit={handleQuestionSubmit}
                />
              )}
              {interactionType === 'short_response' && (
                <ShortResponseStep
                  content={questionContent}
                  scaffoldsActive={scaffoldsActive}
                  onSubmit={handleQuestionSubmit}
                />
              )}
              {interactionType === 'structured_response' && (
                <StructuredResponseStep
                  content={questionContent}
                  scaffoldsActive={scaffoldsActive}
                  onSubmit={handleQuestionSubmit}
                />
              )}
              {interactionType === 'passage_annotation' && (
                <PassageAnnotatorStep
                  content={questionContent}
                  scaffoldsActive={scaffoldsActive}
                  onSubmit={handleQuestionSubmit}
                />
              )}
              {interactionType === 'drag_and_drop' && (
                <DragAndDropStep
                  content={questionContent}
                  scaffoldsActive={scaffoldsActive}
                  onSubmit={handleQuestionSubmit}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PracticeHeader({ standardCode, qNum }: { standardCode: string; qNum: QNum }) {
  const router = useRouter();
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            if (window.confirm('Leave practice? Your progress on this session will not be saved.')) {
              router.push('/student-home');
            }
          }}
          className="text-[#4B5563] hover:text-[#94A3B8] text-xs flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>
        <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#1D9E75] font-mono">{standardCode}</span>
        <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
          Practice — Q{qNum} of 3
        </span>
      </div>
    </header>
  );
}

function PracticeProgress({ qNum }: { qNum: QNum }) {
  const labels: Record<QNum, string> = { 1: 'Guided', 2: 'Some support', 3: 'On your own' };
  return (
    <div className="px-6 py-3 border-b border-white/[0.08] flex-shrink-0">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        {([1, 2, 3] as QNum[]).map((n) => {
          const done = n < qNum;
          const active = n === qNum;
          return (
            <div key={n} className="flex items-center gap-1.5">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  done ? 'bg-[#1D9E75] w-16' : active ? 'bg-amber-500 w-24' : 'bg-white/[0.12] w-16'
                }`}
              />
              {active && (
                <span className="text-xs text-amber-300 font-medium whitespace-nowrap">
                  {labels[n]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
