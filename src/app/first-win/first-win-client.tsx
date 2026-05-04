'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FIRST_WIN_SELF_EFFICACY_OPTIONS,
  type FirstWinItem,
  type FirstWinPhase,
  type FirstWinProtocolPayload,
} from '@/lib/first-win/types';

type FirstWinClientProps = {
  studentId: string;
  preview?: boolean;
};

type Step =
  | { kind: 'item'; phase: FirstWinPhase; itemIndex: number; item: FirstWinItem }
  | { kind: 'closing' };

type FeedbackState = {
  isCorrect: boolean;
  text: string;
};

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isAnswerCorrect(item: FirstWinItem, value: string) {
  return normalizeAnswer(item.correct_answer) === normalizeAnswer(value);
}

export default function FirstWinClient({ studentId, preview = false }: FirstWinClientProps) {
  const router = useRouter();
  const [protocolPayload, setProtocolPayload] = useState<FirstWinProtocolPayload | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selfEfficacy, setSelfEfficacy] = useState<string | null>(null);
  const itemStartedAt = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const protocolResponse = await fetch(`/api/first-win/protocol/${studentId}`);
      const protocolBody = (await protocolResponse.json()) as {
        error?: string;
        payload?: FirstWinProtocolPayload;
      };

      if (!protocolResponse.ok || !protocolBody.payload) {
        setError(protocolBody.error ?? 'Could not load First-Win.');
        setLoading(false);
        return;
      }

      setProtocolPayload(protocolBody.payload);

      if (preview) {
        setSessionId('preview-session');
        setLoading(false);
        return;
      }

      const startResponse = await fetch('/api/first-win/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          protocol_id: protocolBody.payload.protocol.id,
        }),
      });
      const startBody = (await startResponse.json()) as {
        error?: string;
        session?: { id: string };
      };

      if (!startResponse.ok || !startBody.session?.id) {
        setError(startBody.error ?? 'Could not start First-Win.');
        setLoading(false);
        return;
      }

      setSessionId(startBody.session.id);
      setLoading(false);
    }

    load();
  }, [preview, studentId]);

  useEffect(() => {
    if (!sessionId || preview) return;

    function markAbandoned() {
      if (completedRef.current || !sessionId) return;
      navigator.sendBeacon(`/api/first-win/session/${sessionId}/abandon`);
    }

    window.addEventListener('pagehide', markAbandoned);
    return () => {
      window.removeEventListener('pagehide', markAbandoned);
    };
  }, [preview, sessionId]);

  const steps = useMemo<Step[]>(() => {
    const protocol = protocolPayload?.protocol;
    if (!protocol) return [];
    return [
      ...protocol.phase_a_content.map((item, index) => ({
        kind: 'item' as const,
        phase: 'A' as const,
        itemIndex: index,
        item,
      })),
      ...protocol.phase_b_content.map((item, index) => ({
        kind: 'item' as const,
        phase: 'B' as const,
        itemIndex: index,
        item,
      })),
      { kind: 'closing' as const },
    ];
  }, [protocolPayload]);

  const currentStep = steps[stepIndex] ?? null;
  const itemSteps = steps.filter((step) => step.kind === 'item');
  const currentItemNumber =
    currentStep?.kind === 'item'
      ? itemSteps.findIndex(
          (step) =>
            step.kind === 'item' &&
            step.phase === currentStep.phase &&
            step.itemIndex === currentStep.itemIndex
        ) + 1
      : itemSteps.length;

  function resetForNextStep() {
    setSelectedResponse(null);
    setFeedback(null);
    setScaffoldOpen(false);
    itemStartedAt.current = Date.now();
  }

  async function submitResponse(response: string) {
    if (!currentStep || currentStep.kind !== 'item' || !sessionId) return;

    const isCorrect = isAnswerCorrect(currentStep.item, response);
    const timeOnItemMs = Date.now() - itemStartedAt.current;
    setSaving(true);
    setSelectedResponse(response);
    setScaffoldOpen(!isCorrect);

    if (preview) {
      setFeedback({
        isCorrect,
        text: isCorrect ? currentStep.item.feedback_correct : currentStep.item.feedback_incorrect,
      });
      setSaving(false);
      return;
    }

    const responseResult = await fetch(`/api/first-win/session/${sessionId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: currentStep.phase,
        item_index: currentStep.itemIndex,
        student_response: response,
        scaffold_used: scaffoldOpen || !isCorrect,
        time_on_item_ms: timeOnItemMs,
      }),
    });
    const body = (await responseResult.json()) as {
      error?: string;
      feedback?: string;
    };

    setSaving(false);

    if (!responseResult.ok) {
      setError(body.error ?? 'Could not save your response.');
      return;
    }

    setFeedback({
      isCorrect,
      text:
        body.feedback ??
        (isCorrect ? currentStep.item.feedback_correct : currentStep.item.feedback_incorrect),
    });
  }

  function continueSession() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((index) => index + 1);
      resetForNextStep();
    }
  }

  async function completeSession(response: string) {
    if (!sessionId) return;
    setSelfEfficacy(response);

    if (preview) {
      completedRef.current = true;
      router.push('/dashboard/student');
      return;
    }

    setSaving(true);
    const completeResponse = await fetch(`/api/first-win/session/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ self_efficacy_response: response }),
    });
    const body = (await completeResponse.json()) as { error?: string; nextRoute?: string };
    setSaving(false);

    if (!completeResponse.ok) {
      setError(body.error ?? 'Could not finish First-Win.');
      return;
    }

    completedRef.current = true;
    router.push(body.nextRoute ?? '/dashboard/student');
  }

  if (loading) {
    return (
      <main className="firstWinRoot">
        <p className="quiet">Loading...</p>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (error || !protocolPayload || !currentStep) {
    return (
      <main className="firstWinRoot">
        <section className="sessionShell">
          <p className="eyebrow">First Win</p>
          <h1>We need to reload this session.</h1>
          <p className="support">{error ?? 'The First-Win protocol did not load.'}</p>
          <button type="button" onClick={() => router.push('/dashboard/student')}>
            Back to dashboard
          </button>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  const protocol = protocolPayload.protocol;
  const isBridge = currentStep.kind === 'item' && currentStep.phase === 'B';

  return (
    <main className="firstWinRoot">
      <section className="sessionShell">
        <div className="topLine">
          <div>
            <p className="eyebrow">First Win</p>
            <h1>{protocol.protocol_name}</h1>
          </div>
          {currentStep.kind === 'item' ? (
            <p className="progress">
              {currentItemNumber} / {itemSteps.length}
            </p>
          ) : null}
        </div>

        {currentStep.kind === 'closing' ? (
          <div className="closing">
            <p className="closingCopy">{protocol.closing_copy}</p>
            <div className="efficacy">
              <p className="prompt">One last thing. How did that feel?</p>
              <div className="optionGrid">
                {FIRST_WIN_SELF_EFFICACY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={selfEfficacy === option ? 'option selected' : 'option'}
                    disabled={saving}
                    onClick={() => completeSession(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="itemFrame">
            <div className={isBridge ? 'phaseBand bridge' : 'phaseBand'}>
              {isBridge
                ? 'Now use the same engine in a sentence.'
                : 'Start with what your brain already knows how to do.'}
            </div>

            {currentStep.item.context ? (
              <p className="context">{currentStep.item.context}</p>
            ) : null}
            <p className="prompt">{currentStep.item.prompt}</p>

            <div className="optionGrid">
              {(currentStep.item.options ?? []).map((option) => {
                const selected = selectedResponse === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={selected ? 'option selected' : 'option'}
                    disabled={saving || Boolean(feedback)}
                    onClick={() => submitResponse(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="underActions">
              {currentStep.item.scaffold_text ? (
                <button
                  type="button"
                  className="textButton"
                  onClick={() => setScaffoldOpen((open) => !open)}
                >
                  {scaffoldOpen ? 'Hide hint' : 'Use a hint'}
                </button>
              ) : null}
            </div>

            {scaffoldOpen && currentStep.item.scaffold_text ? (
              <div className="scaffold">{currentStep.item.scaffold_text}</div>
            ) : null}

            {feedback ? (
              <div className={feedback.isCorrect ? 'feedback' : 'feedback stretch'}>
                <p>{feedback.text}</p>
                <button type="button" onClick={continueSession}>
                  Continue
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .firstWinRoot {
    min-height: 100vh;
    background: #07111f;
    color: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .sessionShell {
    width: min(860px, 100%);
    min-height: 560px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .topLine {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .eyebrow,
  .progress {
    color: #93c5fd;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 8px;
  }

  h1 {
    font-size: 42px;
    line-height: 1.02;
    font-weight: 820;
    letter-spacing: 0;
    margin: 0;
  }

  .progress {
    margin-top: 6px;
    color: #cbd5e1;
  }

  .itemFrame,
  .closing {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .phaseBand {
    width: fit-content;
    border: 1px solid rgba(147, 197, 253, 0.24);
    background: rgba(37, 99, 235, 0.14);
    color: #bfdbfe;
    border-radius: 999px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 750;
  }

  .phaseBand.bridge {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(110, 231, 183, 0.28);
    color: #bbf7d0;
  }

  .context {
    color: #dbeafe;
    border-left: 3px solid #60a5fa;
    padding-left: 16px;
    font-size: 24px;
    line-height: 1.32;
    margin: 0;
  }

  .prompt,
  .closingCopy {
    font-size: 32px;
    line-height: 1.16;
    font-weight: 760;
    letter-spacing: 0;
    margin: 0;
  }

  .support,
  .quiet {
    color: #94a3b8;
    font-size: 16px;
    line-height: 1.5;
  }

  .optionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  button {
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 800;
  }

  .option {
    min-height: 66px;
    text-align: left;
    color: #f8fafc;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 16px;
    font-size: 17px;
    line-height: 1.25;
  }

  .option:hover,
  .option.selected {
    background: rgba(37, 99, 235, 0.24);
    border-color: rgba(147, 197, 253, 0.48);
  }

  .option:disabled {
    cursor: default;
  }

  .underActions {
    min-height: 28px;
  }

  .textButton {
    color: #bfdbfe;
    background: transparent;
    border: 0;
    padding: 0;
    font-size: 14px;
  }

  .scaffold {
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(147, 197, 253, 0.2);
    color: #dbeafe;
    padding: 16px;
    font-size: 18px;
    line-height: 1.45;
  }

  .feedback {
    border-radius: 14px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(110, 231, 183, 0.3);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .feedback.stretch {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(147, 197, 253, 0.26);
  }

  .feedback p {
    color: #e0f2fe;
    font-size: 19px;
    line-height: 1.42;
    margin: 0;
  }

  .feedback button,
  .closing button,
  .sessionShell > button {
    align-self: flex-start;
    background: #ffffff;
    color: #07111f;
    padding: 12px 18px;
    font-size: 15px;
  }

  .efficacy {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 18px;
  }

  @media (max-width: 640px) {
    .firstWinRoot {
      align-items: flex-start;
      padding: 28px 18px 44px;
    }

    .sessionShell {
      min-height: auto;
    }

    .topLine {
      flex-direction: column;
    }

    h1 {
      font-size: 34px;
    }

    .prompt,
    .closingCopy {
      font-size: 26px;
    }

    .context {
      font-size: 20px;
    }

    .optionGrid {
      grid-template-columns: 1fr;
    }
  }
`;
