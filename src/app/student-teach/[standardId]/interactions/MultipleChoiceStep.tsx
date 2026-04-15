'use client';

// MultipleChoiceStep.tsx
// Parses A/B/C/D options from Claude-generated content string.
// Selection is immediate — no submit button. Calls onSubmit with
// the selected letter + text, e.g. "B) friendship is always enough".

import React, { useState, useMemo, useEffect } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

export interface MultipleChoiceStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Pattern: lines that start with A) B) C) D) or A. B. C. D.
const OPTION_RE = /^([A-D])[)\.]\s+(.+)$/;

function parseOptions(content: string): {
  question: string;
  options: { letter: string; text: string }[];
} {
  const lines = content.split('\n');
  const firstIdx = lines.findIndex((l) => OPTION_RE.test(l.trim()));

  if (firstIdx === -1) {
    return { question: content, options: [] };
  }

  const question = lines.slice(0, firstIdx).join('\n').trim();
  const options = lines
    .slice(firstIdx)
    .filter((l) => OPTION_RE.test(l.trim()))
    .map((l) => {
      const m = l.trim().match(OPTION_RE)!;
      return { letter: m[1], text: m[2] };
    });

  return { question, options };
}

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold text-slate-900">{p}</strong> : p
          )}
        </p>
      );
    }
    return <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">{line}</p>;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MultipleChoiceStep({
  content,
  scaffoldsActive,
  onSubmit,
}: MultipleChoiceStepProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const { question, options } = useMemo(() => parseOptions(content), [content]);

  useEffect(() => {
    console.log('MultipleChoiceStep content received:', JSON.stringify(content));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: content empty/whitespace or Claude returned unparseable format — never show an empty shell
  if (!content.trim() || options.length === 0) {
    return (
      <div className="p-4 md:p-6 flex items-center gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <p className="text-slate-400 text-sm animate-pulse">Gogi is preparing this question…</p>
        </div>
      </div>
    );
  }

  function handleSelect(letter: string, text: string) {
    if (selected) return; // already chosen
    setSelected(letter);
    // Brief visual delay so the student sees their selection before the engine transitions
    setTimeout(() => onSubmit(`${letter}) ${text}`), 350);
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Gogi bubble — question text ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-0.5">{renderText(question || content)}</div>
        </div>
      </div>

      {/* ── Option buttons ── */}
      <div className="space-y-2">
        {options.map(({ letter, text }) => {
          const isSelected = selected === letter;
          const isOther = selected !== null && !isSelected;

          return (
            <button
              key={letter}
              onClick={() => handleSelect(letter, text)}
              disabled={selected !== null}
              className={[
                'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 flex items-start gap-2',
                isSelected
                  ? 'bg-violet-800/50 border-violet-500 text-violet-100 shadow-sm shadow-violet-500/20'
                  : isOther
                    ? 'opacity-40 bg-white/3 border-white/8 text-slate-500 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-violet-500/40 cursor-pointer',
              ].join(' ')}
            >
              <span
                className={`font-bold flex-shrink-0 ${
                  isSelected ? 'text-violet-300' : isOther ? 'text-slate-600' : 'text-violet-400'
                }`}
              >
                {letter})
              </span>
              <span className="leading-relaxed">{text}</span>
            </button>
          );
        })}
      </div>

      {/* ── Scaffold indicator ── */}
      {scaffoldsActive && options.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Select an option — your answer is recorded immediately.
        </p>
      )}
    </div>
  );
}
