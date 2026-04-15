'use client';

// MultipleSelectStep.tsx
// Student selects all correct answers from a list — used for signal word
// identification steps where multiple answers are valid.
// Unlike MultipleChoiceStep, selections toggle and an explicit Submit button
// is required — no auto-submit on first selection.
//
// content prop format — standard newline parsing:
//   [question stem, possibly multiple lines before first option]
//   A) option text
//   B) option text
//   C) option text  (up to F)
//
// Submitted string format:
//   SELECTED: A) however | C) therefore | E) in contrast

import React, { useState, useMemo } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

export interface MultipleSelectStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const OPTION_RE = /^([A-F])[).]\s+(.+)$/;

function parseOptions(content: string): {
  question: string;
  options: { letter: string; text: string }[];
} {
  const lines = content.split('\n');
  const firstIdx = lines.findIndex(l => OPTION_RE.test(l.trim()));

  if (firstIdx === -1) {
    return { question: content, options: [] };
  }

  const question = lines.slice(0, firstIdx).join('\n').trim();
  const options = lines
    .slice(firstIdx)
    .filter(l => OPTION_RE.test(l.trim()))
    .map(l => {
      const m = l.trim().match(OPTION_RE)!;
      return { letter: m[1], text: m[2] };
    });

  return { question, options };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-[#94A3B8] text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-white">{p}</strong>
            ) : (
              p
            ),
          )}
        </p>
      );
    }
    return <p key={i} className="text-[#94A3B8] text-sm leading-relaxed mt-1">{line}</p>;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MultipleSelectStep({
  content,
  scaffoldsActive,
  onSubmit,
}: MultipleSelectStepProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const { question, options } = useMemo(() => parseOptions(content), [content]);

  // Guard: empty or unparseable
  if (!content.trim() || options.length === 0) {
    return (
      <div className="p-4 md:p-6 flex items-center gap-3">
        <GogiAvatar />
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-[#4B5563] text-sm animate-pulse">Gogi is preparing this question…</p>
        </div>
      </div>
    );
  }

  const canSubmit = selected.size > 0 && !submitted;

  function toggleOption(letter: string) {
    if (submitted) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(letter)) {
        next.delete(letter);
      } else {
        next.add(letter);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted(true);
    const parts = options
      .filter(o => selected.has(o.letter))
      .map(o => `${o.letter}) ${o.text}`);
    onSubmit(`SELECTED: ${parts.join(' | ')}`);
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Gogi bubble */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
          <div className="space-y-0.5">{renderText(question || content)}</div>
          {scaffoldsActive && (
            <p className="text-xs text-[#4B5563] mt-2 italic">Select all that apply.</p>
          )}
        </div>
      </div>

      {/* Option toggles */}
      <div className="space-y-2">
        {options.map(({ letter, text }) => {
          const isSelected = selected.has(letter);

          return (
            <button
              key={letter}
              onClick={() => toggleOption(letter)}
              disabled={submitted}
              className={[
                'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 flex items-start gap-2',
                isSelected
                  ? 'bg-[#1D9E75]/20 border-[#1D9E75] text-white'
                  : submitted
                    ? 'opacity-40 bg-white/[0.04] border-white/[0.06] text-[#4B5563] cursor-not-allowed'
                    : 'bg-white/[0.06] border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.09] hover:border-[#1D9E75]/40 cursor-pointer',
              ].join(' ')}
            >
              <span
                className={`font-bold flex-shrink-0 w-5 text-center ${
                  isSelected ? 'text-[#1D9E75]' : 'text-[#1D9E75]'
                }`}
              >
                {isSelected ? '✓' : letter}
              </span>
              <span className="leading-relaxed">{text}</span>
            </button>
          );
        })}
      </div>

      {/* Submit row */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[#4B5563]">
          {submitted
            ? `${selected.size} option${selected.size !== 1 ? 's' : ''} submitted.`
            : selected.size > 0
              ? `${selected.size} selected — click Submit when ready.`
              : 'Select all that apply, then click Submit.'}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-shrink-0 btn-primary disabled:opacity-40 disabled:cursor-not-allowed py-2.5 px-6"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
