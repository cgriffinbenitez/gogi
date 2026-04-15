'use client';

// FillInStep.tsx
// Parses ___ blanks from content string and renders each as an inline text input.

import React, { useState, useMemo } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

export interface FillInStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countBlanks(content: string): number {
  return (content.match(/___/g) ?? []).length;
}

function reconstruct(content: string, blanks: string[]): string {
  let i = 0;
  return content.replace(/___/g, () => blanks[i++] ?? '___');
}

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

  if (parts.length === 1) {
    return (
      <p className="text-[#94A3B8] text-sm leading-relaxed">
        {line}
      </p>
    );
  }

  return (
    <p className="text-[#94A3B8] text-sm leading-relaxed flex flex-wrap items-baseline gap-0">
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
                className="inline-block min-w-[140px] border-b-2 border-[#1D9E75] bg-transparent text-white placeholder-[#4B5563] text-sm px-2 py-1 focus:outline-none focus:border-[#17825F] mx-1"
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
      {/* Gogi bubble */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
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
                <p key={li} className="text-[#94A3B8] text-sm leading-relaxed">
                  {line}
                </p>
              ) : (
                <div key={li} className="h-1.5" />
              ),
            )}
          </div>
        </div>
      </div>

      {/* Submit row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#4B5563]">
          {allFilled
            ? 'All blanks filled — ready to submit.'
            : `${blanks.filter((b) => b.trim()).length} of ${total} blank${total !== 1 ? 's' : ''} filled.`}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!allFilled}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed py-2.5 px-6"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
