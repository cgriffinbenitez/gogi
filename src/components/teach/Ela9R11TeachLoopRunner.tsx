'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { C, FONTS } from '@/lib/constants/design';
import type { LoadCalibration } from '@/lib/layer0/scoring';
import {
  evaluateEla9R11TeachStep,
  evaluateEla9R11TransferCheck,
  type TeachLoop,
  type TeachPhaseRecord,
  type TeachStep,
} from '@/lib/teach/ela9r11';

type Props = {
  loop: TeachLoop;
  saving?: boolean;
  saveError?: string | null;
  loadCalibration?: LoadCalibration;
  onStepSubmit?: (record: TeachPhaseRecord, records: TeachPhaseRecord[]) => void;
  onComplete: (records: TeachPhaseRecord[], masteryResponse: string, masteryPassed: boolean) => void;
};

type Phase = {
  name: string;
  purpose: string;
  step: TeachStep;
  passage: 'sample' | 'transfer';
  button: string;
};

export function Ela9R11TeachLoopRunner({
  loop,
  saving = false,
  saveError = null,
  loadCalibration = 'standard',
  onStepSubmit,
  onComplete,
}: Props) {
  const phases: Phase[] = useMemo(() => {
    const standardPhases: Phase[] = [
      {
        name: 'Foundation Check',
        purpose: 'Know the job before using evidence.',
        step: loop.steps[0],
        passage: 'sample',
        button: 'Check foundation',
      },
      {
        name: 'Name the Move',
        purpose: 'Name the author move instead of only retelling what happened.',
        step: loop.steps[2],
        passage: 'sample',
        button: 'Name the move',
      },
      {
        name: 'Pattern Recognition',
        purpose: 'Find the precise words that prove the claim.',
        step: loop.steps[1],
        passage: 'sample',
        button: 'Check evidence',
      },
      {
        name: 'Run the Move',
        purpose: 'Notice, name, and defend in one analytical response.',
        step: loop.steps[6],
        passage: 'sample',
        button: 'Run the move',
      },
      {
        name: 'Transfer Check',
        purpose: 'Use the same move on a new passage with no scaffolded answer.',
        step: loop.steps[8],
        passage: 'transfer',
        button: 'Pass transfer',
      },
    ];

    if (loadCalibration === 'reduced') {
      return [standardPhases[0], standardPhases[2], standardPhases[3]];
    }

    if (loadCalibration === 'maximum_reduction') {
      return [standardPhases[0], standardPhases[2], standardPhases[3], standardPhases[4]];
    }

    return standardPhases;
  }, [loadCalibration, loop]);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [response, setResponse] = useState('');
  const [feedback, setFeedback] = useState(loop.whyThisLesson);
  const [records, setRecords] = useState<TeachPhaseRecord[]>([]);

  const phase = phases[phaseIndex];
  const isTransfer = phase.passage === 'transfer';
  const activePassage = isTransfer ? loop.transferPassage : loop.samplePassage;
  const complete = phaseIndex >= phases.length;
  const progressPct = Math.round((phaseIndex / phases.length) * 100);
  const passageParagraphs = activePassage.text.split(/\n+/).filter(Boolean);
  const loadLabel = loadCalibration === 'maximum_reduction'
    ? 'Maximum load reduction'
    : loadCalibration === 'reduced'
      ? 'Reduced load'
      : 'Standard support';

  function submitPhase() {
    const evaluation = isTransfer
      ? evaluateEla9R11TransferCheck(loop, response)
      : evaluateEla9R11TeachStep(loop, phase.step, response, false);

    const record: TeachPhaseRecord = {
      phaseNumber: phaseIndex + 1,
      phaseName: phase.name,
      stepId: phase.step.id,
      stepType: phase.step.stepType,
      response: response.trim(),
      status: evaluation.status,
      feedback: evaluation.feedback,
      score: evaluation.score,
      submittedAt: new Date().toISOString(),
    };

    const nextRecords = [...records, record];
    setFeedback(evaluation.feedback);
    setRecords(nextRecords);
    onStepSubmit?.(record, nextRecords);

    if (evaluation.status !== 'advance') return;

    if (phaseIndex + 1 >= phases.length) {
      onComplete(nextRecords, response.trim(), true);
      return;
    }

    setResponse('');
    setPhaseIndex((prev) => prev + 1);
  }

  if (complete) {
    return null;
  }

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F8F9FA', fontFamily: FONTS.ui, color: C.dark }}>
      <header style={{ height: 52, background: C.navy, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.amberLight, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            TEACH PHASE | ELA.9.R.1.1
          </div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{loop.studentFriendlyTitle}</div>
        </div>
          <div style={{ fontSize: 11, color: C.blueMid }}>{`${loadLabel} | Phase ${phaseIndex + 1} of ${phases.length}`}</div>
      </header>

      <div style={{ height: 3, background: C.blueLight, flexShrink: 0 }}>
        <div style={{ height: 3, width: `${progressPct}%`, background: C.amber, transition: 'width 180ms ease' }} />
      </div>

      <section style={{ flex: 1, display: 'grid', gridTemplateColumns: '34% 36% 30%', minHeight: 0, overflow: 'hidden' }}>
        <aside style={{ borderRight: `1px solid ${C.border}`, background: C.white, padding: 18, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.gray, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
            {isTransfer ? 'Unseen transfer passage' : 'Practice passage'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{activePassage.title}</div>
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 14 }}>{activePassage.author}</div>
          {passageParagraphs.map((para, index) => (
            <p key={index} style={{ fontFamily: FONTS.passage, fontSize: 16, lineHeight: 1.75, margin: '0 0 14px' }}>
              {highlightEvidence(para, isTransfer ? [] : activePassage.focusEvidence)}
            </p>
          ))}
        </aside>

        <section style={{ borderRight: `1px solid ${C.border}`, padding: 18, overflowY: 'auto', background: '#FFFDF8' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.amber, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
            Why this lesson
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.amber}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 850, lineHeight: 1.2, marginBottom: 8 }}>{loop.routeName}</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: C.dark }}>{loop.whyThisLesson}</p>
          </div>

          <div style={{ background: C.amberLight, border: `1px solid ${C.amber}`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 850, color: C.amber, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
              Claim we are proving
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.45, color: C.dark }}>
              {isTransfer
                ? `${loop.transferPassage.targetElement} ${loop.transferPassage.targetEffect}.`
                : loop.anchorClaim}
            </div>
          </div>

          <div style={{ background: C.navy, borderRadius: 8, color: C.white, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 850, color: C.blueMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
              GOGI feedback
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>{feedback}</div>
          </div>

          <div style={{ fontSize: 9, fontWeight: 800, color: C.gray, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
            Phase map
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {phases.map((item, index) => {
              const done = index < phaseIndex;
              const active = index === phaseIndex;
              return (
                <div key={item.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: done ? C.greenLight : active ? C.amberLight : C.white,
                  border: `1px solid ${done ? C.green : active ? C.amber : C.border}`,
                  color: done ? C.green : active ? C.amber : C.gray,
                }}>
                  <span style={{ width: 20, height: 20, borderRadius: 10, display: 'grid', placeItems: 'center', background: done ? C.green : active ? C.amber : C.light, color: done || active ? C.white : C.gray, fontSize: 10, fontWeight: 850 }}>
                    {done ? <Check size={12} /> : index + 1}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: done || active ? 800 : 600 }}>{item.name}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ padding: 18, overflowY: 'auto', background: C.white }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.gray, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
            Active phase
          </div>
          <h1 style={{ fontSize: 22, lineHeight: 1.12, margin: '0 0 10px', color: C.dark }}>
            {phase.name}
          </h1>
          <div style={{ background: C.blueLight, border: `1px solid ${C.blueMid}`, borderRadius: 8, color: C.navy, fontSize: 12, fontWeight: 750, lineHeight: 1.45, marginBottom: 12, padding: '9px 10px' }}>
            {phase.purpose}
          </div>
          {loadCalibration !== 'standard' && (
            <div style={{ background: C.greenLight, border: `1px solid ${C.green}`, borderRadius: 8, color: C.green, fontSize: 12, fontWeight: 750, lineHeight: 1.45, marginBottom: 12, padding: '9px 10px' }}>
              {loadCalibration === 'maximum_reduction'
                ? 'GOGI will keep the scaffold visible and ask for one move at a time.'
                : 'GOGI will keep the directions visible and use a shorter sequence of moves.'}
            </div>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 14px', color: C.dark }}>
            {isTransfer
              ? 'Use the same move on this new passage. Name the author move, use precise evidence, and explain what it reveals or changes.'
              : phase.step.studentPrompt}
          </p>

          {!isTransfer && phase.step.inputMode === 'chips' ? (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {(phase.step.options ?? []).map((option) => (
                <button
                  key={option}
                  onClick={() => setResponse(option)}
                  style={{
                    textAlign: 'left',
                    border: `1.5px solid ${response === option ? C.amber : C.border}`,
                    background: response === option ? C.amberLight : C.white,
                    color: C.dark,
                    borderRadius: 8,
                    minHeight: 46,
                    padding: '10px 12px',
                    fontFamily: FONTS.ui,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder={isTransfer ? 'The author uses...' : 'Type the move here...'}
              style={{
                width: '100%',
                minHeight: isTransfer || phase.step.inputMode === 'text' ? 150 : 88,
                border: `1.5px solid ${C.border}`,
                borderRadius: 8,
                padding: 12,
                fontFamily: FONTS.ui,
                fontSize: 13,
                lineHeight: 1.55,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 12,
              }}
            />
          )}

          <button
            onClick={submitPhase}
            disabled={!response.trim() || saving}
            style={primaryButtonStyle(Boolean(response.trim()) && !saving)}
          >
            {saving && isTransfer ? 'Saving...' : phase.button} <ArrowRight size={16} />
          </button>
          {saveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.red, fontSize: 12, marginTop: 10 }}>
              <RotateCcw size={14} /> {saveError}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function primaryButtonStyle(enabled: boolean): CSSProperties {
  return {
    alignItems: 'center',
    background: enabled ? C.navy : C.border,
    border: 'none',
    borderRadius: 8,
    color: C.white,
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'flex',
    fontFamily: FONTS.ui,
    fontSize: 14,
    fontWeight: 850,
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    opacity: enabled ? 1 : 0.55,
    padding: '0 14px',
    width: '100%',
  };
}

function highlightEvidence(text: string, evidence: string[]) {
  let remaining = text;
  const parts: ReactNode[] = [];

  while (remaining.length) {
    const match = evidence
      .map((piece) => ({ piece, index: remaining.toLowerCase().indexOf(piece.toLowerCase()) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index)[0];

    if (!match) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) parts.push(remaining.slice(0, match.index));
    const exact = remaining.slice(match.index, match.index + match.piece.length);
    parts.push(
      <mark key={`${match.piece}-${parts.length}`} style={{ background: C.yellow, color: C.dark, borderRadius: 2, padding: '0 2px' }}>
        {exact}
      </mark>,
    );
    remaining = remaining.slice(match.index + match.piece.length);
  }

  return parts;
}
