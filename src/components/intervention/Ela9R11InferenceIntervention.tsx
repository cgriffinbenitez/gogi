'use client';

import { useState } from 'react';
import type { InferenceAttempt } from '@/lib/intervention/ela9r11';
import { getNoahPrimaryReadingWin } from '@/lib/reading-wins/noahPlan';
import type { FastGrade9ReadingDemand } from '@/lib/reading-wins/fastSkillMap';
import {
  R31_FIGURATIVE_LANGUAGE_SESSION,
  type ReadingWinLoopItem,
  type ReadingWinSession,
} from '@/lib/reading-wins/r31FigurativeLanguageSession';

type Props = {
  standardCode?: string;
  readingDemand?: FastGrade9ReadingDemand | null;
  readingWinSession?: ReadingWinSession | null;
  saving?: boolean;
  saveError?: string | null;
  onAttempt: (attempt: InferenceAttempt, allAttempts: InferenceAttempt[]) => void;
  onComplete: (attempts: InferenceAttempt[], closingResponse: string) => void;
};

type Phase = 'setup' | 'read' | 'drill' | 'transfer' | 'close' | 'efficacy';

const SELF_EFFICACY_OPTIONS = [
  'I can use this move again.',
  'I need one more example.',
  'I got part of it.',
  'I was lost today.',
] as const;

const SOURCE_ITEMS = R31_FIGURATIVE_LANGUAGE_SESSION.items;
const TRANSFER_ITEM = R31_FIGURATIVE_LANGUAGE_SESSION.transferItem;

export function Ela9R11InferenceIntervention({
  readingDemand = null,
  readingWinSession = null,
  saving = false,
  saveError = null,
  onAttempt,
  onComplete,
}: Props) {
  const readingWin = readingDemand ?? getNoahPrimaryReadingWin();
  const activeSession =
    readingWinSession ??
    (readingWin.standardCode === R31_FIGURATIVE_LANGUAGE_SESSION.benchmarkCode
      ? R31_FIGURATIVE_LANGUAGE_SESSION
      : null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [itemIndex, setItemIndex] = useState(0);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [itemAttempts, setItemAttempts] = useState(0);
  const [attempts, setAttempts] = useState<InferenceAttempt[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [transferCorrect, setTransferCorrect] = useState<boolean | null>(null);
  const [clinicalFlag, setClinicalFlag] = useState(false);
  const [selfEfficacy, setSelfEfficacy] = useState<string | null>(null);

  if (!activeSession) {
    return (
      <ScreenShell eyebrow="Reading Win">
        <div className="centerFrame">
          <h1>{readingWin.studentTitle} is not ready yet.</h1>
          <p className="emptyCopy">
            GOGI needs approved FAST-aligned reps for {readingWin.standardCode} before this can be
            assigned to a student.
          </p>
        </div>
      </ScreenShell>
    );
  }

  const session = activeSession;
  const sourceItems = session.items.length ? session.items : SOURCE_ITEMS;
  const transferItem = session.transferItem ?? TRANSFER_ITEM;
  const currentItem = phase === 'transfer' ? transferItem : sourceItems[itemIndex];
  const drillComplete = itemIndex >= sourceItems.length - 1;

  function recordAttempt(
    item: ReadingWinLoopItem,
    response: string,
    correct: boolean,
    attemptNumber: number
  ) {
    const attempt: InferenceAttempt = {
      pointId: item.id,
      attemptNumber,
      response,
      quality: correct ? 'strong' : attemptNumber >= 3 ? 'weak' : 'partial',
      scaffoldMove: correct ? 'explain_the_effect' : 'find_the_move',
      feedback: correct
        ? attemptNumber === 1
          ? item.successCold
          : item.successScaffold
        : item.scaffold || 'Try the same move again.',
      submittedAt: new Date().toISOString(),
    };
    const nextAttempts = [...attempts, attempt];
    setAttempts(nextAttempts);
    onAttempt(attempt, nextAttempts);
  }

  function submitDrill(response: string) {
    const nextAttempt = itemAttempts + 1;
    const correct = response === currentItem.correctAnswer;
    setSelectedResponse(response);
    setItemAttempts(nextAttempt);
    recordAttempt(currentItem, response, correct, nextAttempt);

    if (correct) {
      setFeedback(nextAttempt === 1 ? currentItem.successCold : currentItem.successScaffold);
      setScaffoldOpen(false);
      return;
    }

    if (nextAttempt === 1) {
      setFeedback(null);
      setScaffoldOpen(true);
      return;
    }

    if (nextAttempt === 2) {
      setFeedback(currentItem.workedExample);
      setScaffoldOpen(true);
      return;
    }

    setClinicalFlag(true);
    setFeedback('Same move tomorrow. Different example.');
  }

  function submitTransfer(response: string) {
    const correct = response === transferItem.correctAnswer;
    setSelectedResponse(response);
    setTransferCorrect(correct);
    recordAttempt(transferItem, response, correct, 1);
    setFeedback(
      correct
        ? transferItem.successCold
        : 'Good work today. Tomorrow we try the same move on another new passage.'
    );
  }

  function advanceFromDrill() {
    setSelectedResponse(null);
    setItemAttempts(0);
    setFeedback(null);
    setScaffoldOpen(false);

    if (phase === 'transfer') {
      setPhase('close');
      return;
    }

    if (drillComplete) {
      setPhase('transfer');
      return;
    }

    setItemIndex((index) => index + 1);
  }

  function finishSession(response?: string) {
    const closingResponse =
      response ??
      selfEfficacy ??
      (transferCorrect
        ? 'Transfer correct. Move practiced and transferred.'
        : 'Move practiced. Transfer needs another session.');
    onComplete(
      attempts,
      JSON.stringify({
        loop: 'remediation_loop_v1',
        standard_code: session.benchmarkCode,
        source_pattern: session.sourcePattern,
        move: readingWin.studentTitle,
        transfer_correct: transferCorrect,
        clinical_flag: clinicalFlag,
        self_efficacy_response: response ?? selfEfficacy,
        closing_response: closingResponse,
      })
    );
  }

  if (phase === 'setup') {
    return (
      <ScreenShell eyebrow="Reading Win">
        <div className="centerFrame">
          <p className="standardPill">{session.benchmarkCode}</p>
          <h1>Today&apos;s win: explain what figurative language does.</h1>
          <p className="setupCopy">
            Read one FAST-style passage, answer five short questions, then prove the move on a new
            passage.
          </p>
          <button type="button" className="primary" onClick={() => setPhase('read')}>
            Tap to begin
          </button>
        </div>
      </ScreenShell>
    );
  }

  if (phase === 'read') {
    return (
      <ScreenShell eyebrow="Read">
        <div className="readFrame">
          <div className="readHeader">
            <div>
              <p className="standardPill">{session.benchmarkCode}</p>
              <h1>{session.passageTitle}</h1>
              <p className="setupCopy">
                Read once for what happens. The questions will zoom in on how specific language
                shapes meaning.
              </p>
            </div>
            <button type="button" className="primary topAction" onClick={() => setPhase('drill')}>
              Start questions
            </button>
          </div>
          <div className="passageBox">
            <p>{activeSession.passage}</p>
          </div>
          <button type="button" className="primary" onClick={() => setPhase('drill')}>
            I&apos;m ready
          </button>
        </div>
      </ScreenShell>
    );
  }

  if (phase === 'close') {
    const transferred = transferCorrect === true;

    return (
      <ScreenShell eyebrow={transferred ? 'Skill transferred' : 'Skill practiced'}>
        <div className="centerFrame">
          <p className="standardPill">{session.benchmarkCode}</p>
          <h1>
            {transferred
              ? 'You transferred the skill to a new passage.'
              : 'We will keep practicing this move.'}
          </h1>
          <div className="resultGrid">
            <div>
              <p className="resultLabel">Practiced</p>
              <p>Figurative language effect in context</p>
            </div>
            <div>
              <p className="resultLabel">Proof</p>
              <p>
                {transferred
                  ? 'You answered the transfer question on a passage you had not seen.'
                  : 'You finished the loop. Next time GOGI gives another chance to transfer it.'}
              </p>
            </div>
            <div>
              <p className="resultLabel">Next</p>
              <p>
                {transferred
                  ? 'Stack three successful sessions to close this standard.'
                  : 'Same skill, fresh passage, more support if needed.'}
              </p>
            </div>
          </div>
          <button type="button" className="primary" onClick={() => setPhase('efficacy')}>
            Quick check
          </button>
        </div>
      </ScreenShell>
    );
  }

  if (phase === 'efficacy') {
    return (
      <ScreenShell eyebrow="One last thing">
        <div className="itemFrame">
          <p className="standardPill">{session.benchmarkCode}</p>
          <p className="prompt">Before you go, how ready do you feel to try that move again?</p>
          <div className="optionGrid">
            {SELF_EFFICACY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={selfEfficacy === option ? 'option selected' : 'option'}
                disabled={saving}
                onClick={() => {
                  setSelfEfficacy(option);
                  finishSession(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
          {saveError ? <p className="errorLine">{saveError}</p> : null}
        </div>
      </ScreenShell>
    );
  }

  const isTransfer = phase === 'transfer';
  const stepNumber = isTransfer ? sourceItems.length + 1 : itemIndex + 1;
  const totalSteps = sourceItems.length + 1;
  const canContinue =
    Boolean(feedback) &&
    (selectedResponse === currentItem.correctAnswer || itemAttempts >= 3 || isTransfer);

  return (
    <ScreenShell
      eyebrow={isTransfer ? 'Transfer' : 'Drill'}
      progress={`${stepNumber} / ${totalSteps}`}
    >
      <div className="itemFrame">
        <div className={isTransfer ? 'phaseBand bridge' : 'phaseBand'}>
          {isTransfer
            ? 'Transfer: new passage, same move.'
            : 'Pick the answer that explains the effect in context.'}
        </div>

        <p className="context">{highlightAnchor(currentItem.context, currentItem.anchor)}</p>
        <p className="prompt">{currentItem.prompt}</p>

        {feedback ? (
          <div
            className={
              selectedResponse === currentItem.correctAnswer || isTransfer
                ? 'feedback'
                : 'feedback stretch'
            }
          >
            <p>{feedback}</p>
            {canContinue ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  advanceFromDrill();
                }}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setSelectedResponse(null);
                  setFeedback(null);
                }}
              >
                Try again
              </button>
            )}
          </div>
        ) : null}

        <div className="optionGrid">
          {currentItem.options.map((option, index) => {
            const selected = selectedResponse === option;
            const letter = String.fromCharCode(65 + index);
            return (
              <button
                key={option}
                type="button"
                className={selected ? 'option selected' : 'option'}
                disabled={
                  saving || Boolean(feedback && selectedResponse === currentItem.correctAnswer)
                }
                onClick={() => (isTransfer ? submitTransfer(option) : submitDrill(option))}
              >
                <span className="optionLetter">{letter}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {!isTransfer ? (
          <div className="underActions">
            {scaffoldOpen ? (
              <div className="scaffold">
                <p className="scaffoldLabel">Try this move, then choose again</p>
                <p>{currentItem.scaffold}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ScreenShell>
  );
}

function ScreenShell({
  eyebrow,
  progress,
  children,
}: {
  eyebrow: string;
  progress?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="firstWinRoot">
      <section className="sessionShell">
        <div className="topLine">
          <p className="eyebrow">{eyebrow}</p>
          {progress ? <p className="progress">{progress}</p> : null}
        </div>
        {children}
      </section>
      <style jsx>{styles}</style>
    </main>
  );
}

function highlightAnchor(text: string, anchor: string) {
  const index = text.toLowerCase().indexOf(anchor.toLowerCase());
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + anchor.length)}</mark>
      {text.slice(index + anchor.length)}
    </>
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

  .progress {
    color: #cbd5e1;
  }

  h1 {
    font-size: 42px;
    line-height: 1.04;
    font-weight: 820;
    letter-spacing: 0;
    margin: 0;
    max-width: 760px;
  }

  .centerFrame,
  .itemFrame,
  .readFrame {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .centerFrame {
    justify-content: center;
    min-height: 420px;
  }

  .setupCopy {
    color: #bfdbfe;
    font-size: 20px;
    line-height: 1.45;
    max-width: 720px;
    margin: 0;
  }

  .standardPill {
    width: fit-content;
    border: 1px solid rgba(147, 197, 253, 0.28);
    background: rgba(37, 99, 235, 0.16);
    color: #bfdbfe;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 850;
    letter-spacing: 0.04em;
    margin: 0;
  }

  .readHeader {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
  }

  .readHeader h1 {
    margin-top: 12px;
  }

  .topAction {
    flex: none;
    margin-top: 2px;
  }

  .passageBox {
    max-height: min(58vh, 520px);
    overflow: auto;
    border-radius: 16px;
    border: 1px solid rgba(147, 197, 253, 0.18);
    background: rgba(255, 255, 255, 0.05);
    padding: 18px;
  }

  .passageBox p {
    color: #dbeafe;
    border-left: 3px solid #60a5fa;
    padding-left: 16px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 21px;
    line-height: 1.44;
    margin: 0;
    white-space: pre-line;
  }

  .emptyCopy {
    color: #bfdbfe;
    font-size: 20px;
    line-height: 1.45;
    max-width: 680px;
    margin: 0;
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
    font-family: Georgia, "Times New Roman", serif;
    font-size: 24px;
    line-height: 1.32;
    margin: 0;
    max-width: 780px;
  }

  mark {
    background: #f6d36f;
    border-radius: 4px;
    color: #111827;
    padding: 0 4px;
  }

  .prompt {
    font-size: 32px;
    line-height: 1.16;
    font-weight: 760;
    letter-spacing: 0;
    margin: 0;
  }

  .resultGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .resultGrid > div {
    border-radius: 14px;
    border: 1px solid rgba(147, 197, 253, 0.2);
    background: rgba(255, 255, 255, 0.07);
    padding: 15px;
  }

  .resultGrid p {
    color: #dbeafe;
    font-size: 16px;
    line-height: 1.42;
    margin: 0;
  }

  .resultGrid .resultLabel {
    color: #93c5fd;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
    text-transform: uppercase;
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

  .primary {
    width: fit-content;
    background: #ffffff;
    color: #07111f;
    min-height: 48px;
    padding: 0 20px;
    font-size: 16px;
  }

  .option {
    min-height: 72px;
    text-align: left;
    color: #f8fafc;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 16px;
    font-size: 17px;
    line-height: 1.25;
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 10px;
    align-items: start;
  }

  .optionLetter {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #bfdbfe;
    font-size: 13px;
    font-weight: 900;
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
    min-height: 0;
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

  .scaffold p {
    margin: 0;
  }

  .scaffoldLabel {
    color: #93c5fd;
    font-size: 12px;
    font-weight: 850;
    letter-spacing: 0.06em;
    margin-bottom: 6px !important;
    text-transform: uppercase;
  }

  .feedback {
    border-radius: 14px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(110, 231, 183, 0.28);
    color: #bbf7d0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
  }

  .feedback.stretch {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(147, 197, 253, 0.24);
    color: #dbeafe;
  }

  .feedback p {
    font-size: 18px;
    line-height: 1.35;
    margin: 0;
  }

  .feedback button {
    background: #ffffff;
    color: #07111f;
    min-height: 42px;
    padding: 0 18px;
    font-size: 15px;
    white-space: nowrap;
  }

  .errorLine {
    color: #fecaca;
    font-size: 14px;
    line-height: 1.4;
    margin: 0;
  }

  @media (max-width: 640px) {
    .firstWinRoot {
      align-items: flex-start;
      padding: 24px 18px 42px;
    }

    .sessionShell {
      min-height: auto;
    }

    .topLine,
    .readHeader,
    .feedback {
      align-items: stretch;
      flex-direction: column;
    }

    .topAction {
      width: fit-content;
    }

    h1 {
      font-size: 34px;
    }

    .prompt {
      font-size: 26px;
    }

    .context,
    .passageBox p {
      font-size: 20px;
    }

    .resultGrid {
      grid-template-columns: 1fr;
    }

    .optionGrid {
      grid-template-columns: 1fr;
    }
  }
`;
