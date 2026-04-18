'use client';

import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useAuth } from '@/context/AuthContext';

// ─── TeachNav ─────────────────────────────────────────────────────────────────

export function TeachNav({
  standardCode,
  navLabel,
  layerColor,
}: {
  standardCode: string;
  navLabel: string;
  layerColor: string;
}) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  const router = useRouter();
  const { role } = useAuth();
  function handleHomeClick() {
    router.push(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
  }
  return (
    <nav
      style={{
        background: C.navy, height: 52, width: '100%', padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: layerColor, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          {navLabel}
        </div>
        {standard && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{standard.title}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleHomeClick}
          style={{ fontSize: 11, color: 'rgba(181,212,244,0.5)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: FONTS.ui, transition: 'color 0.2s', padding: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#B5D4F4'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(181,212,244,0.5)'; }}
        >
          ← Dashboard
        </button>
        <button
          onClick={handleHomeClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 6, transition: 'background 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          title="Back to dashboard"
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: FONTS.passage, letterSpacing: '-0.5px' }}>GOGI</div>
        </button>
      </div>
    </nav>
  );
}

// ─── MCVerification ───────────────────────────────────────────────────────────

export interface MCOption {
  text: string;
  wrongFeedback: string;
}

interface MCVerificationProps {
  question: string;
  options: MCOption[];
  correctIndex: number;
  onCorrect: () => void;
  accentColor?: string;
}

export function MCVerification({
  question,
  options,
  correctIndex,
  onCorrect,
  accentColor = C.blue,
}: MCVerificationProps) {
  const [selected, setSelected]         = useState<number | null>(null);
  const [attempts, setAttempts]         = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [showCorrect, setShowCorrect]   = useState(false);
  const [done, setDone]                 = useState(false);

  const LABELS = ['A', 'B', 'C', 'D'];

  function handleSelect(i: number) {
    if (done) return;
    const isCorrect = i === correctIndex;
    setSelected(i);

    if (isCorrect) {
      setDone(true);
      setFeedbackText('');
      onCorrect();
      return;
    }

    const next = attempts + 1;
    setAttempts(next);
    setFeedbackText(options[i].wrongFeedback);

    if (next >= 2) {
      setShowCorrect(true);
      setDone(true);
      onCorrect(); // unlock CTA after 2 attempts
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 12, marginTop: 0, lineHeight: 1.5 }}>
        {question}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, i) => {
          const isSelected    = selected === i;
          const isCorrect     = i === correctIndex;
          const isWrong       = isSelected && !isCorrect && attempts > 0;
          const revealCorrect = showCorrect && isCorrect;

          let borderColor: string = C.border;
          let bg: string          = C.white;
          let labelBg: string     = C.light;
          let labelColor: string  = C.gray;

          if (revealCorrect) {
            borderColor = C.green;  bg = C.greenLight;
            labelBg = C.green;      labelColor = C.white;
          } else if (isSelected && isCorrect) {
            borderColor = C.green;  bg = C.greenLight;
            labelBg = C.green;      labelColor = C.white;
          } else if (isWrong) {
            borderColor = C.red;    bg = C.redLight;
            labelBg = C.red;        labelColor = C.white;
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={done && !revealCorrect}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: bg,
                border: `1.5px solid ${borderColor}`,
                borderRadius: 8, padding: '10px 12px',
                cursor: done ? 'default' : 'pointer',
                textAlign: 'left', width: '100%',
                fontFamily: FONTS.ui, transition: 'border-color 0.15s',
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: labelBg, color: labelColor,
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {LABELS[i]}
              </span>
              <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>{opt.text}</span>
            </button>
          );
        })}
      </div>

      {feedbackText && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <GogiAvatar size={28} state={showCorrect ? 'celebrate' : 'engaged'} />
          <div
            style={{
              background: showCorrect ? C.greenLight : accentColor === C.blue ? C.blueLight : '#C6EFCE',
              border: `1px solid ${showCorrect ? C.green : accentColor}`,
              borderRadius: 8, padding: '8px 12px', flex: 1,
            }}
          >
            {showCorrect && (
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 4 }}>
                Correct answer: Option {LABELS[correctIndex]}.
              </div>
            )}
            <p style={{ fontSize: 12, color: C.dark, margin: 0, lineHeight: 1.6 }}>
              {feedbackText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ChipBank ─────────────────────────────────────────────────────────────────

export interface ChipItem {
  label: string;
  definition?: string;
}

interface ChipBankProps {
  chips: ChipItem[];
  selected: string;
  onSelect: (label: string) => void;
  showDefinitions: boolean;
  selectedBg?: string;
  columns?: 1 | 2;
}

export function ChipBank({
  chips,
  selected,
  onSelect,
  showDefinitions,
  selectedBg = C.navy,
  columns = 1,
}: ChipBankProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns === 2 ? '1fr 1fr' : '1fr',
        gap: 8,
      }}
    >
      {chips.map(chip => {
        const isSelected = selected === chip.label;
        return (
          <button
            key={chip.label}
            onClick={() => onSelect(isSelected ? '' : chip.label)}
            style={{
              background: isSelected ? selectedBg : C.white,
              color: isSelected ? C.white : C.dark,
              border: `1px solid ${isSelected ? selectedBg : C.border}`,
              borderRadius: showDefinitions ? 8 : 20,
              padding: showDefinitions ? '8px 10px' : '5px 14px',
              cursor: 'pointer',
              fontFamily: FONTS.ui,
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500 }}>
              {chip.label}
            </div>
            {showDefinitions && chip.definition && (
              <div
                style={{
                  fontSize: 10,
                  color: isSelected ? 'rgba(255,255,255,0.75)' : C.gray,
                  marginTop: 2,
                }}
              >
                {chip.definition}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Passage highlighting ─────────────────────────────────────────────────────

export type HighlightStrategy = 'figurative' | 'mood' | 'tone' | 'theme' | 'structure';

const MOOD_WORDS = [
  'dark', 'darkness', 'shadow', 'shadows', 'gloomy', 'bleak', 'somber', 'dreary',
  'desolate', 'eerie', 'ominous', 'haunting', 'foreboding', 'sinister', 'menacing',
  'oppressive', 'hopeful', 'bright', 'warm', 'joyful', 'peaceful', 'serene', 'tranquil',
  'anxious', 'tense', 'uneasy', 'restless', 'frantic', 'desperate', 'fearful',
  'melancholy', 'sorrowful', 'mournful', 'bitter', 'grief', 'anguish', 'despair',
  'mysterious', 'uncanny', 'whispering', 'silent', 'still', 'hollow',
  'cold', 'frozen', 'pale', 'gaunt', 'withered', 'decaying', 'stifling',
];

const TONE_WORDS = [
  'clearly', 'obviously', 'certainly', 'indeed', 'surely', 'undoubtedly',
  'unfortunately', 'tragically', 'remarkably', 'surprisingly', 'absurdly',
  'despite', 'although', 'nevertheless', 'ironically', 'foolishly', 'wisely',
  'brilliantly', 'shamefully', 'heroically', 'cruelly', 'merely', 'simply',
  'never', 'always', 'must', 'cannot', 'refuse', 'insist', 'demand',
];

const STRUCTURE_SIGNALS = [
  'first', 'second', 'third', 'finally', 'then', 'next', 'after',
  'because', 'therefore', 'thus', 'consequently', 'however', 'although',
  'despite', 'in contrast', 'for example', 'for instance', 'in addition',
  'furthermore', 'in conclusion', 'ultimately', 'as a result',
];

function mergeRanges(sorted: [number, number][]): [number, number][] {
  if (!sorted.length) return [];
  const merged: [number, number][] = [[...sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push([...sorted[i]]);
    }
  }
  return merged;
}

export function findHighlightRanges(
  text: string,
  strategy: HighlightStrategy,
): [number, number][] {
  if (!text) return [];
  const ranges: [number, number][] = [];

  if (strategy === 'figurative') {
    // Simile: word(s) like/as word, or as X as Y
    const patterns = [
      /\b\w[\w\s]{0,20}?\s+like\s+\w[\w\s]{0,20}?(?=\b|,|\.)/gi,
      /\bas\s+\w+\s+as\b/gi,
      /\b(is|was|were|are)\s+a[n]?\s+\w+/gi,
    ];
    for (const pat of patterns) {
      let m;
      while ((m = pat.exec(text)) !== null) {
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
  } else if (strategy === 'mood') {
    for (const word of MOOD_WORDS) {
      const re = new RegExp(`\\b${word}\\b`, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
  } else if (strategy === 'tone') {
    for (const word of TONE_WORDS) {
      const re = new RegExp(`\\b${word}\\b`, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
  } else if (strategy === 'theme') {
    // Highlight the longest sentence (most likely thematic)
    const re = /[A-Z][^.!?]*[.!?]/g;
    let longest: [number, number] | null = null;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!longest || m[0].length > longest[1] - longest[0]) {
        longest = [m.index, m.index + m[0].length];
      }
    }
    if (longest) ranges.push(longest);
  } else if (strategy === 'structure') {
    for (const phrase of STRUCTURE_SIGNALS) {
      // Escape any regex special chars in multi-word phrases
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
  }

  return mergeRanges(ranges.sort((a, b) => a[0] - b[0]));
}

export function renderHighlighted(
  text: string,
  ranges: [number, number][],
  markStyle: CSSProperties,
): ReactNode {
  if (!text) return null;
  if (!ranges.length) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={`hl-${i}`} style={markStyle}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}

// ─── minWords ─────────────────────────────────────────────────────────────────

export function minWords(text: string, n: number): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length >= n;
}

// ─── detectFigureType ─────────────────────────────────────────────────────────

export function detectFigureType(text: string): string {
  if (/\blike\s+\w/i.test(text) || /\bas\s+\w+\s+as\b/i.test(text)) return 'SIMILE';
  if (/\b(represent|symbol)\b/i.test(text)) return 'SYMBOL';
  if (/\b(speaks|cries|laughs|whispers|roars|breathes|reaches)\b/i.test(text)) return 'PERSONIFICATION';
  return 'METAPHOR';
}

// ─── Shared CSS string ────────────────────────────────────────────────────────

export const TEACH_3COL_CSS = (borderColor: string) => `
  .teach-3col {
    display: flex;
    flex-direction: row;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  @media (max-width: 768px) {
    .teach-3col {
      flex-direction: column !important;
      overflow: visible !important;
    }
    .teach-3col > div:first-child {
      flex: 0 0 auto !important;
      height: 200px !important;
      overflow-y: scroll !important;
      border-right: none !important;
      border-bottom: 1px solid ${borderColor};
    }
    .teach-3col > div:nth-child(2) {
      flex: 0 0 auto !important;
      height: auto !important;
      border-right: none !important;
      border-bottom: 1px solid ${borderColor};
    }
    .teach-3col > div:last-child {
      flex: 1 !important;
      height: auto !important;
    }
  }
`;

// ─── Passage panel ────────────────────────────────────────────────────────────
// Exported so each page can render the col-1 consistently.

interface PassagePanelProps {
  passageTitle: string;
  passageAuthor: string;
  passageText: string;
  ranges: [number, number][];
  markStyle: CSSProperties;
  onJump: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  loadTimeout: boolean;
}

export function PassagePanel({
  passageTitle,
  passageAuthor,
  passageText,
  ranges,
  markStyle,
  onJump,
  panelRef,
  loading,
  loadTimeout,
}: PassagePanelProps) {
  const shouldShow = !loading || loadTimeout;
  return (
    <div
      ref={panelRef}
      style={{
        flex: '0 0 30%',
        borderRight: `1px solid ${C.border}`,
        padding: 16,
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        background: C.white,
      }}
    >
      {/* Header */}
      <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
        PASSAGE
      </div>
      <div style={{ fontSize: 11, color: C.gray, marginBottom: 10, lineHeight: 1.5 }}>
        {passageTitle || '—'}<br />
        <span style={{ fontStyle: 'italic' }}>{passageAuthor}</span>
      </div>

      {/* Jump button */}
      {ranges.length > 0 && (
        <button
          onClick={onJump}
          style={{
            background: C.blueLight, color: C.blue,
            border: 'none', borderRadius: 6,
            padding: '4px 10px', fontSize: 10, fontWeight: 700,
            cursor: 'pointer', marginBottom: 10, display: 'block',
          }}
        >
          JUMP TO HIGHLIGHT →
        </button>
      )}

      {/* Passage text */}
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 13,
          lineHeight: 1.8,
          color: C.dark,
          whiteSpace: 'pre-wrap',
        }}
      >
        {!shouldShow
          ? 'Loading passage…'
          : passageText
            ? renderHighlighted(passageText, ranges, markStyle)
            : 'Passage will appear here once the diagnostic is complete.'}
      </div>
    </div>
  );
}

// Re-export GogiAvatar and GogiBubble for convenience
export { GogiAvatar, GogiBubble };
