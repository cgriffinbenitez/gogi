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
        <p key={i} className="text-[#94A3B8] text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold text-white">{p}</strong> : p
          )}
        </p>
      );
    }
    return <p key={i} className="text-[#94A3B8] text-sm leading-relaxed mt-1">{line}</p>;
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

  function handleSelect(letter: string, text: string) {
    if (selected) return;
    setSelected(letter);
    setTimeout(() => onSubmit(`${letter}) ${text}`), 350);
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Gogi bubble */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
          <div className="space-y-0.5">{renderText(question || content)}</div>
        </div>
      </div>

      {/* Option buttons */}
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
                  ? 'bg-[#1D9E75]/20 border-[#1D9E75] text-white'
                  : isOther
                    ? 'opacity-40 bg-white/[0.04] border-white/[0.06] text-[#4B5563] cursor-not-allowed'
                    : 'bg-white/[0.06] border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.09] hover:border-[#1D9E75]/40 cursor-pointer',
              ].join(' ')}
            >
              <span
                className={`font-bold flex-shrink-0 ${
                  isSelected ? 'text-[#1D9E75]' : isOther ? 'text-[#4B5563]' : 'text-[#1D9E75]'
                }`}
              >
                {letter})
              </span>
              <span className="leading-relaxed">{text}</span>
            </button>
          );
        })}
      </div>

      {scaffoldsActive && options.length > 0 && (
        <p className="text-xs text-[#4B5563] text-center">
          Select an option — your answer is recorded immediately.
        </p>
      )}
    </div>
  );
}
