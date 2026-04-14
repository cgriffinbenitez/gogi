'use client';

// FillInStep.tsx
// Parses ___ blanks from content string and renders each as an inline text input.
// On submit, reconstructs the content with blanks filled and calls onSubmit with
// the readable completed sentence(s).
//
// Example content:
//   "The topic of this story is ___.\nThis story suggests that ___."
// Rendered as:
//   "The topic of this story is [  input  ]."
//   "This story suggests that [  input  ]."

import React, { useState, useMemo } from 'react';

export interface FillInStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function GogiAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center flex-shrink-0 self-start mt-0.5">
      <span className="text-white text-sm font-extrabold leading-none select-none">G</span>
    </div>
  );
}

// Count total ___ occurrences across the content
function countBlanks(content: string): number {
  return (content.match(/___/g) ?? []).length;
}

// Reconstruct the filled content: replace each ___ with the corresponding blank value
function reconstruct(content: string, blanks: string[]): string {
  let i = 0;
  return content.replace(/___/g, () => blanks[i++] ?? '___');
}

// Render a single line that may contain ___ segments mixed with text.
// blankOffset: the index of the first blank in this line within the global blanks array.
function FilledLine({
  line,
  blankOffset,
  blanks,
  onChange,
}: {
  line: string;
  blankOffset: number;
  blanks: string[];
  onChange: (globalIdx: number, value: string) => void;
}) {
  const parts = line.split('___');

  // No blanks — render as text
  if (parts.length === 1) {
    return (
      <p className="text-slate-200 text-sm leading-relaxed">
        {line}
      </p>
    );
  }

  return (
    <p className="text-slate-200 text-sm leading-relaxed flex flex-wrap items-baseline gap-0">
      {parts.map((part, pi) => {
        const globalIdx = blankOffset + pi;
        return (
          <React.Fragment key={pi}>
            {part && <span>{part}</span>}
            {pi < parts.length - 1 && (
              <input
                type="text"
                value={blanks[globalIdx] ?? ''}
                onChange={(e) => onChange(globalIdx, e.target.value)}
                placeholder="___"
                className="inline-block bg-transparent border-b-2 border-violet-500/60 text-violet-200 placeholder:text-slate-600 px-1 mx-0.5 min-w-[80px] max-w-[180px] text-sm focus:outline-none focus:border-violet-400 transition-colors"
                style={{ width: `${Math.max(80, (blanks[globalIdx]?.length ?? 0) * 9 + 24)}px` }}
              />
            )}
          </React.Fragment>
        );
      })}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FillInStep({
  content,
  scaffoldsActive,
  onSubmit,
}: FillInStepProps) {
  const total = useMemo(() => countBlanks(content), [content]);
  const [blanks, setBlanks] = useState<string[]>(() => Array(total).fill(''));

  const allFilled = blanks.every((b) => b.trim().length > 0);

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

  function updateBlank(globalIdx: number, value: string) {
    setBlanks((prev) => {
      const next = [...prev];
      next[globalIdx] = value;
      return next;
    });
  }

  function handleSubmit() {
    if (!allFilled) return;
    onSubmit(reconstruct(content, blanks.map((b) => b.trim())));
  }

  // Split the content by lines, tracking which global blank index each line starts at
  const lines = content.split('\n');
  let blankCursor = 0;
  const lineData: { line: string; blankOffset: number; blankCount: number }[] = lines.map(
    (line) => {
      const n = (line.match(/___/g) ?? []).length;
      const offset = blankCursor;
      blankCursor += n;
      return { line, blankOffset: offset, blankCount: n };
    },
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Gogi bubble — prompt + inline fill-in form ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-2">
            {lineData.map(({ line, blankOffset, blankCount }, li) =>
              blankCount > 0 ? (
                <FilledLine
                  key={li}
                  line={line}
                  blankOffset={blankOffset}
                  blanks={blanks}
                  onChange={updateBlank}
                />
              ) : line.trim() ? (
                // Non-blank line inside the Gogi bubble: render as regular paragraph
                <p key={li} className="text-slate-700 text-sm leading-relaxed">
                  {line}
                </p>
              ) : (
                <div key={li} className="h-1.5" />
              ),
            )}
          </div>
        </div>
      </div>

      {/* ── Helper text + submit ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {allFilled
            ? 'All blanks filled — ready to submit.'
            : `${blanks.filter((b) => b.trim()).length} of ${total} blank${total !== 1 ? 's' : ''} filled.`}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!allFilled}
          className={`${btnClass} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg`}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
