'use client';

import { useMemo, useState } from 'react';
import { Check, Grip, LocateFixed } from 'lucide-react';
import { C, FONTS } from '@/lib/constants/design';

export type ScaffoldMode = 'teach' | 'full' | 'partial' | 'none' | 'reassess';
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
  onEvidenceChange?: (words: string[]) => void;
};

const GRID_SIZE = 390;
const MIN_MARKER = 44;

const quadrantLabels = [
  { label: 'Dark + Tense', x: 22, y: 22 },
  { label: 'Bright + Tense', x: 226, y: 22 },
  { label: 'Dark + Calm', x: 22, y: 336 },
  { label: 'Bright + Calm', x: 226, y: 336 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function describeMarker(marker: Marker) {
  const darkBright = marker.x < 42 ? 'darker' : marker.x > 58 ? 'brighter' : 'balanced';
  const tenseCalm = marker.y < 42 ? 'tenser' : marker.y > 58 ? 'calmer' : 'steady';
  if (darkBright === 'balanced' && tenseCalm === 'steady') return 'centered';
  return `${darkBright} + ${tenseCalm}`;
}

function getModeLabel(mode: ScaffoldMode) {
  if (mode === 'teach') return 'PART ONE';
  if (mode === 'full') return 'PRACTICE 1 — FULL SCAFFOLD';
  if (mode === 'partial') return 'PRACTICE 2 — PARTIAL SCAFFOLD';
  if (mode === 'none') return 'PRACTICE 3 — NO LABELS';
  return 'REASSESS — TRANSFER';
}

export function MoodGridExperience({
  mode,
  title,
  evidenceWords,
  prompt,
  onEvidenceChange,
}: MoodGridExperienceProps) {
  const [marker, setMarker] = useState<Marker>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'aligned' | 'redirect'>('idle');
  const [showPartialLabels, setShowPartialLabels] = useState(false);

  const readout = describeMarker(marker);
  const labelsVisible = mode === 'teach' || mode === 'full';
  const fineGrid = mode === 'none' || mode === 'reassess';
  const needsEvidence = mode === 'none' || mode === 'reassess';
  const requiredEvidenceCount = mode === 'reassess' ? 2 : 1;
  const canFinalize = activeEvidence.length >= requiredEvidenceCount;

  const feedbackCopy = useMemo(() => {
    if (feedback === 'aligned') {
      return 'That placement matches the evidence. The words are doing the mood work.';
    }
    if (feedback === 'redirect') {
      return needsEvidence && !canFinalize
        ? `Attach ${requiredEvidenceCount} evidence word${requiredEvidenceCount > 1 ? 's' : ''} before you place the feeling.`
        : 'You tracked what happened. Now use the evidence to move the marker toward the feeling.';
    }
    return needsEvidence
      ? `Attach ${requiredEvidenceCount} evidence word${requiredEvidenceCount > 1 ? 's' : ''}, then place the feeling.`
      : 'Drag the marker, then place the feeling.';
  }, [canFinalize, feedback, needsEvidence, requiredEvidenceCount]);

  function updateMarker(clientX: number, clientY: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    setMarker({ x, y });
  }

  function toggleEvidence(word: string) {
    setActiveEvidence((current) => {
      const next = current.includes(word)
        ? current.filter((item) => item !== word)
        : [...current, word];
      onEvidenceChange?.(next);
      return next;
    });
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
    <div className="moodGridCard" aria-label={`${title} Mood Grid interaction`}>
      <div className="sectionLabel">{getModeLabel(mode)}</div>

      <div className="workspaceHeader">
        <h1>{title}</h1>
        <div className="modePill">
          {mode === 'partial' ? 'labels on hover' : mode === 'none' || mode === 'reassess' ? '3 x 3 grid' : 'labels visible'}
        </div>
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
          <div key={item.label} className="quadrantLabel" style={{ left: item.x, top: item.y }}>
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
        <div className={`feedback ${feedback}`}>{feedbackCopy}</div>
      </div>

      <style jsx>{`
        .moodGridCard {
          font-family: ${FONTS.ui};
        }

        .sectionLabel {
          color: ${C.gray};
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .workspaceHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        h1 {
          color: ${C.dark};
          font-size: 19px;
          font-weight: 750;
          line-height: 1.3;
          margin: 0;
        }

        .modePill {
          border: 1px solid ${C.border};
          border-radius: 999px;
          color: ${C.gray};
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          min-height: 30px;
          padding: 7px 10px;
          white-space: nowrap;
        }

        .prompt {
          color: ${C.dark};
          font-size: 13px;
          font-weight: 600;
          line-height: 1.55;
          margin: 0 0 12px;
        }

        .readout {
          align-items: center;
          background: ${C.blueLight};
          border: 1px solid ${C.blueMid};
          border-radius: 8px;
          color: ${C.navy};
          display: flex;
          font-size: 14px;
          font-weight: 800;
          gap: 8px;
          line-height: 20px;
          margin-bottom: 12px;
          min-height: 44px;
          padding: 0 12px;
        }

        .moodGrid {
          aspect-ratio: 1;
          border: 1px solid rgba(255,255,255,.35);
          border-radius: 8px;
          box-shadow: inset 0 0 80px rgba(0,0,0,.18);
          max-height: min(45vh, 390px);
          max-width: min(100%, 390px);
          margin: 0 auto;
          overflow: hidden;
          position: relative;
          touch-action: none;
          background:
            radial-gradient(circle at 25% 20%, rgba(43,28,53,.92), transparent 47%),
            radial-gradient(circle at 75% 20%, rgba(216,116,79,.86), transparent 46%),
            radial-gradient(circle at 26% 78%, rgba(47,69,82,.9), transparent 48%),
            radial-gradient(circle at 76% 78%, rgba(246,217,141,.88), transparent 46%),
            linear-gradient(90deg, #2b1c35, #d8744f);
        }

        .moodGrid::before,
        .moodGrid::after {
          background: rgba(255,255,255,.28);
          content: '';
          pointer-events: none;
          position: absolute;
        }

        .moodGrid::before {
          bottom: 0;
          left: 50%;
          top: 0;
          width: 1px;
        }

        .moodGrid::after {
          height: 1px;
          left: 0;
          right: 0;
          top: 50%;
        }

        .moodGrid.fine {
          background-image:
            linear-gradient(rgba(255,255,255,.17) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.17) 1px, transparent 1px),
            radial-gradient(circle at 25% 20%, rgba(43,28,53,.92), transparent 47%),
            radial-gradient(circle at 75% 20%, rgba(216,116,79,.86), transparent 46%),
            radial-gradient(circle at 26% 78%, rgba(47,69,82,.9), transparent 48%),
            radial-gradient(circle at 76% 78%, rgba(246,217,141,.88), transparent 46%);
          background-size: 33.333% 33.333%, 33.333% 33.333%, auto, auto, auto, auto;
        }

        .axisLabel {
          color: rgba(255,255,255,.88);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          pointer-events: none;
          position: absolute;
          text-transform: uppercase;
          z-index: 2;
        }

        .axisLabel.top { left: 50%; top: 9px; transform: translateX(-50%); }
        .axisLabel.bottom { bottom: 9px; left: 50%; transform: translateX(-50%); }
        .axisLabel.left { left: 8px; top: 50%; transform: translateY(-50%) rotate(-90deg); }
        .axisLabel.right { right: 8px; top: 50%; transform: translateY(-50%) rotate(90deg); }

        .quadrantLabel {
          background: rgba(31,78,121,.78);
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 999px;
          color: ${C.white};
          font-size: 11px;
          font-weight: 800;
          padding: 6px 9px;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }

        .marker {
          align-items: center;
          background: ${C.white};
          border: 3px solid ${C.greenBorder};
          border-radius: 50%;
          box-shadow: 0 10px 24px rgba(0,0,0,.28);
          color: ${C.navy};
          cursor: grab;
          display: flex;
          height: 44px;
          justify-content: center;
          position: absolute;
          touch-action: none;
          transition: transform 120ms ease-out, box-shadow 120ms ease-out;
          width: 44px;
          z-index: 4;
        }

        .dragging .marker,
        .marker:active {
          box-shadow: 0 14px 32px rgba(0,0,0,.36);
          cursor: grabbing;
          transform: scale(1.08);
        }

        .evidenceTray {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .evidenceChip {
          background: ${C.white};
          border: 1px solid ${C.border};
          border-radius: 8px;
          color: ${C.dark};
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          justify-content: center;
          min-height: 44px;
          padding: 7px 11px;
          text-align: left;
          transition: background 140ms ease-out, border 140ms ease-out, transform 90ms ease-out;
        }

        .evidenceChip span {
          font-size: 13px;
          font-weight: 800;
        }

        .evidenceChip small {
          color: ${C.gray};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .evidenceChip.selected {
          background: #fff3a3;
          border-color: ${C.amber};
        }

        .evidenceChip:active {
          transform: scale(.98);
        }

        .actionRow {
          display: grid;
          gap: 10px;
          grid-template-columns: 170px 1fr;
          margin-top: 12px;
        }

        .finalizeButton {
          align-items: center;
          background: ${C.blue};
          border: 0;
          border-radius: 8px;
          color: ${C.white};
          cursor: pointer;
          display: inline-flex;
          font-family: ${FONTS.ui};
          font-size: 13px;
          font-weight: 800;
          gap: 8px;
          justify-content: center;
          min-height: 44px;
          padding: 0 12px;
        }

        .feedback {
          align-items: center;
          border: 1px solid ${C.border};
          border-radius: 8px;
          color: ${C.gray};
          display: flex;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.45;
          min-height: 44px;
          padding: 8px 10px;
        }

        .feedback.aligned {
          background: ${C.greenLight};
          border-color: ${C.green};
          color: ${C.green};
        }

        .feedback.redirect {
          background: ${C.amberLight};
          border-color: ${C.amber};
          color: ${C.amber};
        }

        @media (max-width: 768px) {
          .workspaceHeader,
          .actionRow {
            grid-template-columns: 1fr;
          }

          .workspaceHeader {
            display: block;
          }

          .modePill {
            display: inline-flex;
            margin-top: 8px;
          }

          h1 {
            font-size: 17px;
            line-height: 1.25;
          }

          .prompt {
            font-size: 12px;
            margin-bottom: 10px;
          }

          .readout {
            font-size: 13px;
            min-height: 40px;
          }

          .moodGrid {
            height: min(82vw, 360px) !important;
            width: min(82vw, 360px) !important;
          }

          .evidenceTray {
            gap: 6px;
          }

          .evidenceChip {
            min-height: 40px;
            padding: 6px 9px;
          }

          .evidenceChip span {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
