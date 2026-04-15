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
        <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-slate-900">{p}</strong>
            ) : (
              p
            ),
          )}
        </p>
      );
    }
    return <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">{line}</p>;
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
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <p className="text-slate-400 text-sm animate-pulse">Gogi is preparing this question…</p>
        </div>
      </div>
    );
  }

  const canSubmit = selected.size > 0 && !submitted;

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

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
      {/* ── Gogi bubble — question stem ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-0.5">{renderText(question || content)}</div>
          {scaffoldsActive && (
            <p className="text-xs text-slate-500 mt-2 italic">Select all that apply.</p>
          )}
        </div>
      </div>

      {/* ── Option toggles ── */}
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
                  ? 'bg-emerald-800/50 border-emerald-500 text-emerald-100 shadow-sm shadow-emerald-500/20'
                  : submitted
                    ? 'opacity-40 bg-white/3 border-white/8 text-slate-500 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-emerald-500/40 cursor-pointer',
              ].join(' ')}
            >
              <span
                className={`font-bold flex-shrink-0 w-5 text-center ${
                  isSelected ? 'text-emerald-300' : 'text-violet-400'
                }`}
              >
                {isSelected ? '✓' : letter}
              </span>
              <span className="leading-relaxed">{text}</span>
            </button>
          );
        })}
      </div>

      {/* ── Submit row ── */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {submitted
            ? `${selected.size} option${selected.size !== 1 ? 's' : ''} submitted.`
            : selected.size > 0
              ? `${selected.size} selected — click Submit when ready.`
              : 'Select all that apply, then click Submit.'}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`flex-shrink-0 ${btnClass} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg`}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
