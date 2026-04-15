'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ProtocolEngine.tsx
// State machine for executing a single clinical intervention protocol.
//
// Drives the 8-step scaffold-fade sequence defined in each Protocol object:
//   Orientation → MicroModel → GuidedPractice → SemiGuided → IndependentTask
//   → MasteryCheck → TransferTask → ReassessTrigger
//
// On mastery-relevant steps, calls evaluate_mastery_structured and receives
// { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }.
// Checks reclassificationTrigger after failed attempts. Calls onComplete on
// step 8. Saves every student response to Supabase responses table.
//
// UI: preserves the Gogi split-panel layout from TeachSession.tsx.
// Interaction: plain <textarea> for all interactive steps (components added
// in the next build step).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { callClaude } from '@/lib/callClaude';
import GogiAvatar from '@/components/GogiAvatar';
import { Protocol, ProtocolStep } from './types';
import MultipleChoiceStep from '../interactions/MultipleChoiceStep';
import EvidenceSelectionStep from '../interactions/EvidenceSelectionStep';
import FillInStep from '../interactions/FillInStep';
import ShortResponseStep from '../interactions/ShortResponseStep';
import StructuredResponseStep from '../interactions/StructuredResponseStep';
import PassageAnnotatorStep from '@/components/protocol/steps/PassageAnnotatorStep';
import DragAndDropStep from '@/components/protocol/steps/DragAndDropStep';
import MultipleSelectStep from '@/components/protocol/steps/MultipleSelectStep';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProtocolEngineProps {
  protocol: Protocol;
  studentId: string;
  standardId: string;
  sessionId: string;
  passage: string;               // diagnostic passage — used in guided steps
  onComplete: () => void;        // called when step 8 (ReassessTrigger) is done
  onReclassify: (fallbackProtocol: string, clinicalRationale: string) => void;
}

// ─── Internal state shape ─────────────────────────────────────────────────────

type EngineView =
  | 'init'        // fetching standard info from Supabase
  | 'generating'  // fetching Gogi voice for current step from Claude
  | 'read_only'   // step.interactionType === 'read_only' — student reads, taps Continue
  | 'interactive' // all other interaction types — plain textarea for now
  | 'evaluating'  // calling evaluate_mastery_structured
  | 'feedback'    // showing failed-eval result before student retries
  | 'complete'    // step 8 finished — about to call onComplete
  | 'error';

interface MasteryEval {
  theme_universal: boolean;
  evidence_relevant: boolean;
  reasoning_explicit: boolean;
  scaffolds_used: boolean;
  // Claude may optionally include passed; engine derives it if absent
  passed?: boolean;
  feedback?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonSafe<T>(raw: string): T | null {
  try {
    const clean = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

// Derive whether this step's mastery conditions are met from the eval JSON.
// Each protocol has different advancement conditions; we use a conservative
// rule that matches the most common patterns across all six protocols:
//   MasteryCheck (step 6): theme_universal AND !scaffolds_used
//   TransferTask  (step 7): theme_universal AND evidence_relevant AND reasoning_explicit AND !scaffolds_used
// For steps with masteryRelevant = true, we err toward requiring all four.
function derivePassed(eval_: MasteryEval, step: ProtocolStep): boolean {
  if (eval_.passed !== undefined) return eval_.passed;

  const { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used } = eval_;

  if (step.name === 'MasteryCheck') {
    // Most protocols: theme_universal AND scaffolds_used = false
    // ConnotativeLanguage & LiteraryAnalysisParagraph additionally need evidence + reasoning
    const condition = step.advancementCondition.toLowerCase();
    const needsEvidence = condition.includes('evidence_relevant');
    const needsReasoning = condition.includes('reasoning_explicit');
    return (
      theme_universal === true &&
      scaffolds_used === false &&
      (!needsEvidence || evidence_relevant === true) &&
      (!needsReasoning || reasoning_explicit === true)
    );
  }

  if (step.name === 'TransferTask') {
    return (
      theme_universal === true &&
      evidence_relevant === true &&
      reasoning_explicit === true &&
      scaffolds_used === false
    );
  }

  // Other mastery-relevant steps — require at least theme_universal
  return theme_universal === true && scaffolds_used === false;
}

// Render Gogi's content with simple markdown support matching TeachSession.tsx
function renderGogiContent(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    if (trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed.length > 2) {
      return (
        <p key={i} className="text-[#4B5563] text-xs italic mt-2 leading-relaxed">
          {trimmed.slice(1, -1)}
        </p>
      );
    }

    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      return (
        <p key={i} className="font-bold text-white mt-4 mb-1 text-sm">
          {trimmed.replace(/\*\*/g, '')}
        </p>
      );
    }

    if (trimmed.includes('**')) {
      const parts = trimmed.split('**');
      return (
        <p key={i} className="text-[#94A3B8] text-sm mt-1 leading-relaxed">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-white">
                {p}
              </strong>
            ) : (
              p
            ),
          )}
        </p>
      );
    }

    if (/^\d+\.\s/.test(trimmed) || /^[-•]\s/.test(trimmed)) {
      return (
        <p key={i} className="text-[#94A3B8] text-sm mt-2 ml-3 leading-relaxed">
          {line}
        </p>
      );
    }

    return (
      <p key={i} className="text-[#94A3B8] text-sm mt-1 leading-relaxed">
        {line}
      </p>
    );
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SpinnerBlock({ label }: { label: string }) {
  return (
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin" />
      <p className="text-[#94A3B8] text-sm">{label}</p>
    </div>
  );
}

// Step breadcrumb — 8 dots for the 8 protocol steps
function StepDots({
  total,
  current,
  stepNames,
}: {
  total: number;
  current: number; // 0-based index
  stepNames: string[];
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                done
                  ? 'bg-[#1D9E75] w-6'
                  : active
                    ? 'bg-[#1D9E75] w-10'
                    : 'bg-white/[0.12] w-6'
              }`}
            />
            {active && (
              <span className="text-xs text-[#1D9E75] font-medium whitespace-nowrap">
                {stepNames[i]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// MasteryEval display — shows which conditions passed/failed
function EvalBreakdown({ eval_ }: { eval_: MasteryEval }) {
  const checks = [
    { key: 'theme_universal' as const, label: 'Universal theme (not a topic)' },
    { key: 'evidence_relevant' as const, label: 'Evidence supports the theme' },
    { key: 'reasoning_explicit' as const, label: 'Connection explained explicitly' },
  ];
  return (
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-4 space-y-2">
      <p className="text-xs text-[#4B5563] uppercase tracking-widest mb-3">What was checked</p>
      {checks.map(({ key, label }) => {
        const passed = eval_[key];
        return (
          <div key={key} className="flex items-center gap-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                passed ? 'bg-[#1D9E75]/20 text-[#1D9E75]' : 'bg-red-900/40 text-red-400'
              }`}
            >
              {passed ? '✓' : '✗'}
            </div>
            <span className={`text-sm ${passed ? 'text-white' : 'text-[#94A3B8]'}`}>
              {label}
            </span>
          </div>
        );
      })}
      {eval_.scaffolds_used && (
        <div className="flex items-center gap-2.5 pt-1">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-amber-900/40 text-amber-400">
            !
          </div>
          <span className="text-sm text-amber-300">
            Scaffold used — independent attempt required
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export default function ProtocolEngine({
  protocol,
  studentId,
  standardId,
  sessionId,
  passage,
  onComplete,
  onReclassify,
}: ProtocolEngineProps) {
  // ── Standard info (fetched from Supabase on mount) ──────────────────────────
  const [standardCode, setStandardCode] = useState('');
  const [standardTitle, setStandardTitle] = useState('');

  // ── State machine ───────────────────────────────────────────────────────────
  const [view, setView] = useState<EngineView>('init');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [masteryAchieved, setMasteryAchieved] = useState(false);
  const [scaffoldsActive, setScaffoldsActive] = useState(
    protocol.steps[0]?.scaffoldsActive ?? true,
  );
  const [stepResponses, setStepResponses] = useState<string[]>([]);

  // ── Step content ────────────────────────────────────────────────────────────
  const [stepContent, setStepContent] = useState('');

  // ── Evaluation state ────────────────────────────────────────────────────────
  const [lastEval, setLastEval] = useState<MasteryEval | null>(null);
  const [evalFeedback, setEvalFeedback] = useState('');
  const [showHint, setShowHint] = useState(false);

  // ── Error ────────────────────────────────────────────────────────────────────
  const [errorMsg, setErrorMsg] = useState('');

  // Guard against double-submit
  const submittingRef = useRef(false);

  const router = useRouter();

  // ── Derived ─────────────────────────────────────────────────────────────────
  const step: ProtocolStep | undefined = protocol.steps[currentStepIndex];
  const totalSteps = protocol.steps.length;
  const stepNames = protocol.steps.map((s) => s.name);
  const isLastStep = currentStepIndex === totalSteps - 1;

  // ─────────────────────────────────────────────────────────────────────────────
  // MOUNT LOG — confirms what props arrived
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    console.log('ProtocolEngine props:', { passage: !!passage, studentId, standardId, sessionId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH STANDARD INFO
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchStandard() {
      try {
        const { data, error } = await supabase
          .from('standards')
          .select('code, title')
          .eq('id', standardId)
          .single();
        if (error || !data) throw error ?? new Error('Standard not found');
        setStandardCode(data.code);
        setStandardTitle(data.title);
        setView('generating');
      } catch (err) {
        console.error('[ProtocolEngine] fetchStandard error:', err);
        setErrorMsg('Could not load standard information. Please refresh.');
        setView('error');
      }
    }
    fetchStandard();
  }, [standardId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE STEP CONTENT
  // Fires whenever view transitions to 'generating' (i.e., standardCode is set
  // and currentStepIndex has just been updated).
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (view !== 'generating' || !standardCode || !step || !passage) return;

    let cancelled = false;

    async function generate() {
      try {
        const content = await callClaude('generate_protocol_step_content', {
          standardCode,
          standardTitle,
          protocolName: protocol.name,
          protocolLabel: protocol.label,
          stepName: step!.name,
          stepNumber: String(step!.stepNumber),
          stepPurpose: step!.stepPurpose,
          claudeGenerates: step!.claudeGenerates.join('\n\n'),
          interactionType: step!.interactionType,
          scaffoldsActive: String(step!.scaffoldsActive),
          passage,
          advancementCondition: step!.advancementCondition,
          diagnosticClassification: protocol.triggerClassifications[0] ?? '',
        });

        if (cancelled) return;

        setStepContent(content);
        setScaffoldsActive(step!.scaffoldsActive);
        setView(step!.interactionType === 'read_only' ? 'read_only' : 'interactive');
      } catch (err) {
        if (cancelled) return;
        console.error('[ProtocolEngine] generate error:', err);
        setErrorMsg('Something went wrong generating this step. Please refresh.');
        setView('error');
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [view, standardCode, standardTitle, step, protocol, passage]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ADVANCE TO NEXT STEP
  // ─────────────────────────────────────────────────────────────────────────────

  const advanceStep = useCallback(() => {
    if (isLastStep) {
      // Step 8 done — call onComplete
      setView('complete');
      onComplete();
      return;
    }
    setCurrentStepIndex((prev) => prev + 1);
    setLastEval(null);
    setEvalFeedback('');
    setView('generating');
  }, [isLastStep, onComplete]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE RESPONSE TO SUPABASE
  // ─────────────────────────────────────────────────────────────────────────────

  const saveResponse = useCallback(
    async ({
      studentResponse,
      masteryAchievedForStep,
      aiFeedback,
      attemptNumber,
    }: {
      studentResponse: string;
      masteryAchievedForStep: boolean;
      aiFeedback?: string;
      attemptNumber: number;
    }) => {
      try {
        await supabase.from('responses').insert({
          session_id: sessionId,
          student_id: studentId,
          standard_id: standardId,
          cognitive_skill_targeted: protocol.cognitiveSkillTargeted,
          diagnostic_classification: protocol.triggerClassifications[0] ?? null,
          intervention_type: protocol.name,
          attempt_number: attemptNumber,
          mastery_achieved: masteryAchievedForStep,
          student_response: studentResponse,
          ai_feedback: aiFeedback ?? null,
        });
      } catch (err) {
        // Non-fatal — log but don't block the student
        console.error('[ProtocolEngine] saveResponse error:', err);
      }
    },
    [sessionId, studentId, standardId, protocol.name, protocol.cognitiveSkillTargeted, protocol.triggerClassifications],
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLE CONTINUE (read_only steps)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleContinue = useCallback(() => {
    advanceStep();
  }, [advanceStep]);

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLE SUBMIT (called by interaction components via onSubmit prop)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleInteractionSubmit = useCallback(async (response: string) => {
    if (!step) return;
    const text = response.trim();
    if (!text || submittingRef.current) return;

    submittingRef.current = true;
    const currentAttempt = attemptCount + 1;

    // Record the response
    setStepResponses((prev) => {
      const updated = [...prev];
      updated[currentStepIndex] = text;
      return updated;
    });

    if (!step.masteryRelevant) {
      await saveResponse({
        studentResponse: text,
        masteryAchievedForStep: false,
        attemptNumber: currentAttempt,
      });
      // Show brief acknowledgment before advancing
      const ack = await callClaude('generate_protocol_step_content', {
        standardCode,
        standardTitle,
        protocolName: protocol.name,
        protocolLabel: protocol.label,
        stepName: step.name,
        stepNumber: String(step.stepNumber),
        stepPurpose: 'Give brief 1-sentence acknowledgment of the student response and confirm they are ready to move forward. Be specific to what they wrote.',
        claudeGenerates: 'One sentence acknowledging what the student did. No praise words like great or excellent. Just name what they did correctly.',
        interactionType: 'read_only',
        scaffoldsActive: String(step.scaffoldsActive),
        passage: passage.substring(0, 400),
        advancementCondition: '',
      });
      setEvalFeedback(ack);
      setView('feedback');
      // Override retry button to advance instead of retry
      setAttemptCount(-99); // sentinel value — feedback view will advance not retry
      submittingRef.current = false;
      return;
    }

    // Mastery-relevant step — evaluate
    setView('evaluating');
    setAttemptCount(currentAttempt);

    try {
      const rawEval = await callClaude('evaluate_mastery_structured', {
        standardCode,
        standardTitle,
        protocolName: protocol.name,
        protocolLabel: protocol.label,
        stepName: step.name,
        stepNumber: String(step.stepNumber),
        studentResponse: text,
        passage,
        scaffoldsActive: String(step.scaffoldsActive),
        advancementCondition: step.advancementCondition,
      });

      const eval_ = parseJsonSafe<MasteryEval>(rawEval);

      if (!eval_) {
        // Parse failure — fail-open: show feedback, let student retry
        console.error('[ProtocolEngine] eval parse failed. Raw:', rawEval);
        setEvalFeedback(
          "I wasn't able to evaluate that response right now. Try again — make sure your response addresses the prompt fully.",
        );
        setLastEval(null);
        setView('feedback');
        submittingRef.current = false;
        return;
      }

      setLastEval(eval_);

      const passed = derivePassed(eval_, step);
      const feedback = eval_.feedback ?? '';

      await saveResponse({
        studentResponse: text,
        masteryAchievedForStep: passed,
        aiFeedback: feedback || undefined,
        attemptNumber: currentAttempt,
      });

      if (passed) {
        setMasteryAchieved(true);
        setEvalFeedback(eval_.feedback || "That's the move. You just did exactly what a strong reader does — let's keep going.");
        setLastEval(eval_);
        setAttemptCount(-99); // sentinel: feedback view will advance not retry
        setView('feedback');
        submittingRef.current = false;
        return;
        // advanceStep() is now called from handleRetry when attemptCount === -99
      }

      // Not passed — check reclassification threshold
      if (currentAttempt >= protocol.reclassificationTrigger.attemptThreshold) {
        submittingRef.current = false;
        onReclassify(
          protocol.reclassificationTrigger.fallbackProtocol,
          protocol.reclassificationTrigger.clinicalRationale,
        );
        return;
      }

      // Unlock hint on the designated attempt before reclassification fires
      if (currentAttempt === protocol.reclassificationTrigger.hintUnlockAttempt) {
        setShowHint(true);
      }

      // Show feedback, allow retry
      setEvalFeedback(feedback);
      setView('feedback');
    } catch (err) {
      console.error('[ProtocolEngine] handleSubmit eval error:', err);
      setEvalFeedback(
        'Something went wrong evaluating your response. Please try submitting again.',
      );
      setView('feedback');
    } finally {
      submittingRef.current = false;
    }
  }, [
    step,
    attemptCount,
    currentStepIndex,
    standardCode,
    standardTitle,
    protocol,
    passage,
    saveResponse,
    advanceStep,
    onReclassify,
  ]);

  const handleRetry = useCallback(() => {
    if (attemptCount === -99) {
      setAttemptCount(0);
      setEvalFeedback('');
      advanceStep();
      return;
    }
    setEvalFeedback('');
    setShowHint(false);
    setView('interactive');
    // Interaction components mount fresh on view change — no focus management needed here
  }, [attemptCount, advanceStep]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SHARED LAYOUT COMPONENTS
  // (Inline here so they can close over standardCode/protocol without prop
  // drilling — matching the pattern in TeachSession.tsx)
  // ─────────────────────────────────────────────────────────────────────────────

  function EngineHeader() {
    const isReassessTrigger = step?.name === 'ReassessTrigger';
    const isEarlyStep = (step?.stepNumber ?? 0) <= 2;
    const confirmMsg = isEarlyStep
      ? 'Leave this session? Your progress will not be saved.'
      : "Leave this session? You'll need to restart this standard.";

    function handleBack() {
      if (window.confirm(confirmMsg)) {
        router.push('/student-home');
      }
    }

    return (
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
        <div className="flex items-center gap-4">
          {!isReassessTrigger && (
            <button
              onClick={handleBack}
              className="text-[#4B5563] hover:text-[#94A3B8] text-xs flex items-center gap-1 transition-colors flex-shrink-0"
            >
              ← Back
            </button>
          )}
          <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#1D9E75] font-mono">{standardCode}</span>
          <span className="bg-[#1D9E75]/20 text-[#1D9E75] text-xs font-bold px-3 py-1 rounded-full border border-[#1D9E75]/30">
            {protocol.label}
          </span>
        </div>
      </header>
    );
  }

  function ProgressBar() {
    return (
      <div className="px-6 py-3 border-b border-white/[0.08] flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <StepDots
            total={totalSteps}
            current={currentStepIndex}
            stepNames={stepNames}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEWS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Props guard — passage and standard must be populated before rendering ────
  if (!passage || !standardCode) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[#94A3B8] text-sm">Loading your session…</p>
        </div>
      </div>
    );
  }

  // ── Init / loading ───────────────────────────────────────────────────────────
  if (view === 'init') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[#94A3B8] text-sm">Loading your session…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (view === 'error') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/[0.06] border border-red-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-white font-bold text-xl mb-2">Unable to Load Step</h2>
          <p className="text-[#94A3B8] text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => {
              setErrorMsg('');
              setView(standardCode ? 'generating' : 'init');
            }}
            className="btn-primary w-full"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Complete (step 8 done — parent handles redirect) ─────────────────────────
  if (view === 'complete') {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col">
        <EngineHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-xl w-full text-center space-y-6">
            <h1 className="text-white text-3xl font-extrabold">Protocol Complete</h1>
            <p className="text-[#94A3B8] text-sm">Moving to your Practice session…</p>
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Generating / Evaluating — loading states ──────────────────────────────────
  if (view === 'generating' || view === 'evaluating') {
    const label =
      view === 'evaluating'
        ? 'Evaluating your response…'
        : step?.name === 'Orientation'
          ? 'Setting up your session…'
          : `Preparing ${step?.name ?? 'next step'}…`;
    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col">
        <EngineHeader />
        <ProgressBar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-3xl w-full">
            <SpinnerBlock label={label} />
          </div>
        </div>
      </div>
    );
  }

  // ── Read-only step (Orientation, MicroModel, ReassessTrigger) ─────────────────
  if (view === 'read_only' && step) {
    const isReassess = step.name === 'ReassessTrigger';

    return (
      <div className="min-h-screen bg-[#0d0f12] flex flex-col">
        <EngineHeader />
        <ProgressBar />
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">

            {/* Step label */}
            <div className="mb-6">
              <div className="text-xs font-bold text-[#1D9E75] uppercase tracking-widest mb-1">
                Step {step.stepNumber} of {totalSteps} — {step.name}
              </div>
              <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">
                {step.name === 'Orientation' && 'Where you are going and why'}
                {step.name === 'MicroModel' && 'Watch the thinking in action'}
                {step.name === 'ReassessTrigger' && 'Session complete'}
              </h1>
            </div>

            {/* Gogi speech bubble */}
            <div className="flex items-start gap-3 mb-8">
              <GogiAvatar />
              <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-5 py-4 flex-1">
                <div className="space-y-0.5">{renderGogiContent(stepContent)}</div>
              </div>
            </div>

            {/* Continue button */}
            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                className="btn-primary py-3.5 px-8"
              >
                <span>{isReassess ? 'Go to Reassessment' : 'Continue'}</span>
                <span>→</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Interactive step — split panel (passage left, response right) ─────────────
  if ((view === 'interactive' || view === 'feedback') && step) {
    return (
      <div className="h-screen bg-[#0d0f12] flex flex-col overflow-hidden">
        <EngineHeader />
        <ProgressBar />

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

          {/* ── Left panel: Passage + step context ───────────────── */}
          <div className="md:w-2/5 w-full flex-shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.08] p-4 md:p-6 max-h-48 md:max-h-none">
            <div className="text-xs font-bold text-[#1D9E75] uppercase tracking-widest mb-2">
              Step {step.stepNumber} of {totalSteps} — {step.name}
            </div>
            <h2 className="text-white font-extrabold text-lg mb-4 leading-tight">
              {step.scaffoldsActive ? 'With support' : 'On your own'}
            </h2>

            {passage && (
              <div className="mt-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
                <p className="text-[11px] font-bold text-[#4B5563] uppercase tracking-widest mb-3">
                  Literary Selection
                </p>
                <hr className="border-white/[0.08] mb-4" />
                <p className="text-[#94A3B8] text-sm whitespace-pre-line" style={{ lineHeight: '1.8' }}>
                  {passage}
                </p>
              </div>
            )}

            {step.scaffoldsActive && (
              <div className="mt-4 bg-amber-900/20 border border-amber-500/20 rounded-xl px-3 py-2">
                <p className="text-amber-300 text-xs">Scaffolds active — you have support on this step.</p>
              </div>
            )}
          </div>

          {/* ── Right panel ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0">

            {view === 'interactive' ? (
              <div className="flex-1 overflow-y-auto">
                {step.interactionType === 'multiple_choice' && (
                  <MultipleChoiceStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'evidence_selection' && (
                  <EvidenceSelectionStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'fill_in' && (
                  <FillInStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'short_response' && (
                  <ShortResponseStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'structured_response' && (
                  <StructuredResponseStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'passage_annotation' && (
                  <PassageAnnotatorStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'drag_and_drop' && (
                  <DragAndDropStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
                {step.interactionType === 'multiple_select' && (
                  <MultipleSelectStep
                    content={stepContent}
                    scaffoldsActive={scaffoldsActive}
                    onSubmit={handleInteractionSubmit}
                  />
                )}
              </div>
            ) : (
              /* ── Feedback view ──────────────────────────────────────────────── */
              <>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                  {/* Gogi feedback bubble */}
                  {evalFeedback && (
                    <div className="flex items-start gap-3">
                      <GogiAvatar />
                      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                        <p className="text-[#94A3B8] text-sm leading-relaxed">{evalFeedback}</p>
                      </div>
                    </div>
                  )}

                  {/* Mastery condition breakdown */}
                  {lastEval && <EvalBreakdown eval_={lastEval} />}

                  {/* Hint unlock */}
                  {showHint && (
                    <div className="bg-amber-900/30 border border-amber-500/30 rounded-2xl px-4 py-4">
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
                        One more hint before we move on
                      </p>
                      <p className="text-amber-100 text-sm leading-relaxed">
                        {protocol.reclassificationTrigger.hint}
                      </p>
                    </div>
                  )}

                  {/* Student's prior response */}
                  {stepResponses[currentStepIndex] && (
                    <div className="flex justify-end">
                      <div className="bg-[#1D9E75]/20 border border-[#1D9E75]/20 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                        <p className="text-sm leading-relaxed">{stepResponses[currentStepIndex]}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Retry bar */}
                <div className="flex-shrink-0 border-t border-white/[0.08] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                      {attemptCount === -99 ? 'Keep going' : 'Not quite yet — try again'}
                    </span>
                    <button
                      onClick={handleRetry}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all flex items-center gap-2"
                    >
                      {attemptCount === -99 ? 'Continue →' : 'Try Again'}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    );
  }

  // Fallback (should never render)
  return null;
}
