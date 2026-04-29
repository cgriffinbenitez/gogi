'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Grip, LocateFixed } from 'lucide-react';

type ScaffoldMode = 'teach' | 'full' | 'partial' | 'none' | 'reassess';
type Marker = { x: number; y: number };
export type EvidenceWord = {
  word: string;
  sentence: string;
  signal: 'diction' | 'imagery' | 'rhythm' | 'omission';
};

export type MoodGridExperienceProps = {
  mode: ScaffoldMode;
  title: string;
  passageTitle: string;
  passage: string[];
  evidenceWords: EvidenceWord[];
  prompt: string;
  gogiCopy: string;
};

const GRID_SIZE = 420;
const MIN_MARKER = 44;

const quadrantLabels = [
  { label: 'Dark + Tense', x: 24, y: 24 },
  { label: 'Bright + Tense', x: 252, y: 24 },
  { label: 'Dark + Calm', x: 24, y: 368 },
  { label: 'Bright + Calm', x: 252, y: 368 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function describeMarker(marker: Marker) {
  const darkBright = marker.x < 42 ? 'darker' : marker.x > 58 ? 'brighter' : 'balanced';
  const tenseCalm = marker.y < 42 ? 'tenser' : marker.y > 58 ? 'calmer' : 'steady';
  if (darkBright === 'balanced' && tenseCalm === 'steady') return 'centered: not enough evidence yet';
  return `${darkBright} + ${tenseCalm}`;
}

function getEvidenceSentence(word: string, evidenceWords: EvidenceWord[]) {
  return evidenceWords.find((item) => item.word === word)?.sentence;
}

function getModeLabel(mode: ScaffoldMode) {
  if (mode === 'teach') return 'Teach';
  if (mode === 'full') return 'Practice 1';
  if (mode === 'partial') return 'Practice 2';
  if (mode === 'none') return 'Practice 3';
  return 'Reassess';
}

export function MoodGridExperience({
  mode,
  title,
  passageTitle,
  passage,
  evidenceWords,
  prompt,
  gogiCopy,
}: MoodGridExperienceProps) {
  const [marker, setMarker] = useState<Marker>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'aligned' | 'redirect'>('idle');
  const [showPartialLabels, setShowPartialLabels] = useState(false);

  const activeSentences = useMemo(
    () => activeEvidence.map((word) => getEvidenceSentence(word, evidenceWords)).filter(Boolean),
    [activeEvidence, evidenceWords],
  );

  const readout = describeMarker(marker);
  const labelsVisible = mode === 'teach' || mode === 'full';
  const fineGrid = mode === 'none' || mode === 'reassess';
  const needsEvidence = mode === 'none' || mode === 'reassess';
  const canFinalize = activeEvidence.length >= (mode === 'reassess' ? 2 : 1);

  function updateMarker(clientX: number, clientY: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    setMarker({ x, y });
  }

  function toggleEvidence(word: string) {
    setActiveEvidence((current) =>
      current.includes(word)
        ? current.filter((item) => item !== word)
        : [...current, word],
    );
    setFeedback('idle');
  }

  function finalizePlacement() {
    if (needsEvidence && !canFinalize) {
      setFeedback('redirect');
      return;
    }

    const darker = marker.x < 48;
    const tense = marker.y < 54;
    const hasMoodEvidence = activeEvidence.length > 0;
    setFeedback(darker && tense && hasMoodEvidence ? 'aligned' : 'redirect');
  }

  return (
    <section className="moodShell" aria-label={`${title} Mood Grid review`}>
      <aside className="passagePane">
        <div className="paneKicker">Evidence source</div>
        <h2>{passageTitle}</h2>
        <div className="passageText">
          {passage.map((paragraph, index) => (
            <p key={index}>
              {paragraph.split(/(\b\w+\b)/).map((piece, pieceIndex) => {
                const match = evidenceWords.find((item) => item.word.toLowerCase() === piece.toLowerCase());
                const isActive = activeEvidence.includes(piece.toLowerCase()) ||
                  activeEvidence.includes(piece);
                const sentenceActive = activeSentences.includes(match?.sentence);

                if (!match) return <span key={`${piece}-${pieceIndex}`}>{piece}</span>;

                return (
                  <button
                    key={`${piece}-${pieceIndex}`}
                    className={`inlineEvidence ${isActive ? 'active' : ''} ${sentenceActive ? 'sentenceActive' : ''}`}
                    onClick={() => toggleEvidence(match.word)}
                    type="button"
                  >
                    {piece}
                  </button>
                );
              })}
            </p>
          ))}
        </div>
      </aside>

      <main className="gridWorkspace">
        <div className="workspaceHeader">
          <div>
            <div className="paneKicker">{getModeLabel(mode)} · Mood Read</div>
            <h1>{title}</h1>
          </div>
          <div className="modePill">{mode === 'partial' ? 'labels on hover' : mode === 'none' ? '3 x 3 no labels' : mode}</div>
        </div>

        <p className="prompt">{prompt}</p>

        <div className="readout" aria-live="polite">
          <LocateFixed size={18} />
          <span>You are plotting: {readout}</span>
        </div>

        <div
          className={`moodGrid ${fineGrid ? 'fine' : ''} ${dragging ? 'dragging' : ''}`}
          onMouseEnter={() => setShowPartialLabels(true)}
          onMouseLeave={() => setShowPartialLabels(false)}
          onPointerMove={(event) => {
            if (!dragging) return;
            updateMarker(event.clientX, event.clientY, event.currentTarget);
          }}
          onPointerUp={(event) => {
            if (!dragging) return;
            updateMarker(event.clientX, event.clientY, event.currentTarget);
            setDragging(false);
            finalizePlacement();
          }}
          style={{ width: GRID_SIZE, height: GRID_SIZE }}
        >
          <div className="axisLabel top">Tense</div>
          <div className="axisLabel bottom">Calm</div>
          <div className="axisLabel left">Dark</div>
          <div className="axisLabel right">Bright</div>

          {(labelsVisible || (mode === 'partial' && showPartialLabels)) && quadrantLabels.map((item) => (
            <div
              key={item.label}
              className="quadrantLabel"
              style={{ left: item.x, top: item.y }}
            >
              {item.label}
            </div>
          ))}

          <button
            aria-label="Drag mood marker"
            className="marker"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              setFeedback('idle');
            }}
            style={{
              left: `calc(${marker.x}% - ${MIN_MARKER / 2}px)`,
              top: `calc(${marker.y}% - ${MIN_MARKER / 2}px)`,
            }}
            type="button"
          >
            <Grip size={18} />
          </button>
        </div>

        <div className="evidenceTray" aria-label="Evidence words">
          {evidenceWords.map((item) => {
            const selected = activeEvidence.includes(item.word);
            return (
              <button
                className={`evidenceChip ${selected ? 'selected' : ''}`}
                key={item.word}
                onClick={() => toggleEvidence(item.word)}
                type="button"
              >
                <span>{item.word}</span>
                <small>{item.signal}</small>
              </button>
            );
          })}
        </div>

        <div className="actionRow">
          <button className="finalizeButton" onClick={finalizePlacement} type="button">
            <Check size={18} />
            Place the feeling
          </button>
          <div className={`feedback ${feedback}`}>
            {feedback === 'aligned' && 'That placement matches the evidence. The words are doing the mood work.'}
            {feedback === 'redirect' && 'Start with the words, then move the marker darker or tenser based on what they create.'}
            {feedback === 'idle' && (needsEvidence ? 'Attach evidence before you finalize.' : 'Drag the marker, then place the feeling.')}
          </div>
        </div>
      </main>

      <aside className="gogiPane">
        <div className="gogiAvatar">G</div>
        <div className="gogiBubble">
          <div className="paneKicker">Gogi</div>
          <p>{gogiCopy}</p>
        </div>
        <div className="miniJourney">
          {['Part One', 'Modeling', 'Guided Practice'].map((step, index) => (
            <div className="journeyStep" key={step}>
              <span className={index === 2 ? 'active' : ''} />
              {step}
            </div>
          ))}
        </div>
        <button className="nextReviewButton" type="button">
          Next screen
          <ArrowRight size={16} />
        </button>
      </aside>

      <style jsx>{`
        .moodShell {
          min-height: calc(100vh - 52px);
          background: #101715;
          color: #f3f7f5;
          display: grid;
          grid-template-columns: minmax(360px, 36%) minmax(480px, 44%) minmax(240px, 20%);
          gap: 16px;
          padding: 16px;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        .passagePane,
        .gridWorkspace,
        .gogiPane {
          min-height: calc(100vh - 84px);
          border: 1px solid #2d4139;
          border-radius: 8px;
          overflow: hidden;
        }

        .passagePane {
          background: #f5f2ea;
          color: #202724;
          padding: 20px 22px;
          overflow-y: auto;
        }

        .paneKicker {
          color: #4cc9a6;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .passagePane h2,
        .workspaceHeader h1 {
          margin: 6px 0 18px;
        }

        .passagePane h2 {
          color: #16201d;
          font-size: 18px;
          line-height: 24px;
        }

        .passageText p {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 17px;
          line-height: 31px;
          margin: 0 0 18px;
        }

        .inlineEvidence {
          background: rgba(255, 224, 138, .42);
          border: 0;
          border-radius: 4px;
          color: #202724;
          cursor: pointer;
          font: inherit;
          padding: 1px 3px;
          transition: background 140ms ease-out, box-shadow 140ms ease-out;
        }

        .inlineEvidence.active {
          background: #ffe08a;
          box-shadow: 0 0 0 5px rgba(255, 224, 138, .22);
        }

        .gridWorkspace {
          background: #18231f;
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .workspaceHeader {
          width: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .workspaceHeader h1 {
          font-size: 24px;
          line-height: 30px;
          letter-spacing: 0;
        }

        .modePill {
          min-height: 32px;
          border: 1px solid #2d4139;
          border-radius: 999px;
          padding: 7px 12px;
          color: #a9b8b2;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .prompt {
          align-self: stretch;
          color: #d7e2dd;
          font-size: 15px;
          font-weight: 650;
          line-height: 22px;
          margin: 0 0 12px;
        }

        .readout {
          align-self: stretch;
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f3f7f5;
          font-size: 20px;
          font-weight: 800;
          line-height: 26px;
          margin-bottom: 12px;
        }

        .moodGrid {
          position: relative;
          max-width: min(100%, 420px);
          max-height: min(48vh, 420px);
          aspect-ratio: 1;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 8px;
          overflow: hidden;
          touch-action: none;
          background:
            linear-gradient(90deg, rgba(43,28,53,.92), rgba(216,116,79,.88)),
            linear-gradient(180deg, rgba(255,255,255,0), rgba(246,217,141,.88)),
            radial-gradient(circle at 25% 20%, rgba(43,28,53,.85), transparent 44%),
            radial-gradient(circle at 75% 20%, rgba(216,116,79,.8), transparent 42%),
            radial-gradient(circle at 26% 78%, rgba(47,69,82,.9), transparent 44%),
            radial-gradient(circle at 74% 78%, rgba(246,217,141,.88), transparent 42%);
          background-blend-mode: multiply, normal, normal, normal, normal, normal;
          box-shadow: inset 0 0 90px rgba(0,0,0,.24);
        }

        .moodGrid::before,
        .moodGrid::after {
          content: '';
          position: absolute;
          background: rgba(255,255,255,.22);
          pointer-events: none;
        }

        .moodGrid::before {
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
        }

        .moodGrid::after {
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
        }

        .moodGrid.fine {
          background-size: auto, auto, auto, auto, auto, auto;
        }

        .moodGrid.fine {
          box-shadow:
            inset 0 0 90px rgba(0,0,0,.24),
            inset 0 0 0 1px rgba(255,255,255,.12);
        }

        .moodGrid.fine :global(*) {
          z-index: 1;
        }

        .moodGrid.fine {
          background-image:
            linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(43,28,53,.92), rgba(216,116,79,.88)),
            linear-gradient(180deg, rgba(255,255,255,0), rgba(246,217,141,.88));
          background-size: 33.333% 33.333%, 33.333% 33.333%, auto, auto;
        }

        .axisLabel {
          position: absolute;
          z-index: 2;
          color: rgba(243,247,245,.88);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
          pointer-events: none;
        }

        .axisLabel.top { top: 10px; left: 50%; transform: translateX(-50%); }
        .axisLabel.bottom { bottom: 10px; left: 50%; transform: translateX(-50%); }
        .axisLabel.left { left: 10px; top: 50%; transform: translateY(-50%) rotate(-90deg); }
        .axisLabel.right { right: 10px; top: 50%; transform: translateY(-50%) rotate(90deg); }

        .quadrantLabel {
          position: absolute;
          z-index: 2;
          background: rgba(16,23,21,.72);
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px;
          color: #f3f7f5;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .04em;
          padding: 7px 10px;
          pointer-events: none;
        }

        .marker {
          position: absolute;
          z-index: 4;
          width: 44px;
          height: 44px;
          border: 2px solid #8be7cf;
          border-radius: 50%;
          background: #f3f7f5;
          color: #101715;
          display: grid;
          place-items: center;
          cursor: grab;
          touch-action: none;
          box-shadow: 0 10px 24px rgba(0,0,0,.28);
          transition: transform 120ms ease-out, box-shadow 120ms ease-out;
        }

        .marker:active,
        .dragging .marker {
          cursor: grabbing;
          transform: scale(1.08);
          box-shadow: 0 14px 32px rgba(0,0,0,.36);
        }

        .evidenceTray {
          align-self: stretch;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .evidenceChip {
          min-height: 44px;
          border: 1px solid #3b5048;
          border-radius: 8px;
          background: #22302b;
          color: #f3f7f5;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
          padding: 8px 12px;
          text-align: left;
          transition: border 140ms ease-out, background 140ms ease-out, transform 90ms ease-out;
        }

        .evidenceChip span {
          font-size: 13px;
          font-weight: 800;
        }

        .evidenceChip small {
          color: #a9b8b2;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .evidenceChip.selected {
          background: #ffe08a;
          border-color: #ffe08a;
          color: #16201d;
        }

        .evidenceChip.selected small {
          color: #5b4a15;
        }

        .evidenceChip:active {
          transform: scale(.98);
        }

        .actionRow {
          align-self: stretch;
          display: grid;
          grid-template-columns: 190px 1fr;
          gap: 12px;
          align-items: center;
          margin-top: 14px;
        }

        .finalizeButton,
        .nextReviewButton {
          min-height: 48px;
          border: 0;
          border-radius: 8px;
          background: #4cc9a6;
          color: #071015;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 850;
        }

        .feedback {
          min-height: 48px;
          border: 1px solid #2d4139;
          border-radius: 8px;
          color: #a9b8b2;
          display: flex;
          align-items: center;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 650;
          line-height: 18px;
        }

        .feedback.aligned {
          border-color: #4cc9a6;
          color: #bdf5e5;
          background: rgba(76,201,166,.12);
        }

        .feedback.redirect {
          border-color: #f2b84b;
          color: #ffe1a3;
          background: rgba(242,184,75,.10);
        }

        .gogiPane {
          background: #121d19;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .gogiAvatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #4cc9a6;
          color: #071015;
          display: grid;
          place-items: center;
          font-size: 20px;
          font-weight: 900;
        }

        .gogiBubble {
          border: 1px solid #2d4139;
          border-radius: 8px;
          background: #18231f;
          padding: 14px;
        }

        .gogiBubble p {
          margin: 8px 0 0;
          color: #f3f7f5;
          font-size: 14px;
          font-weight: 650;
          line-height: 21px;
        }

        .miniJourney {
          display: grid;
          gap: 10px;
          margin-top: 4px;
        }

        .journeyStep {
          color: #a9b8b2;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 750;
        }

        .journeyStep span {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1px solid #53635d;
        }

        .journeyStep span.active {
          width: 20px;
          height: 20px;
          background: #4cc9a6;
          border-color: #4cc9a6;
        }

        .nextReviewButton {
          margin-top: auto;
          width: 100%;
        }

        @media (max-width: 980px) {
          .moodShell {
            grid-template-columns: 1fr;
          }

          .passagePane,
          .gridWorkspace,
          .gogiPane {
            min-height: auto;
          }

          .moodGrid {
            width: min(92vw, 420px) !important;
            height: min(92vw, 420px) !important;
          }

          .actionRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
