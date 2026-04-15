'use client';

// EvidenceSelectionStep.tsx
// Student reads the passage (visible in the left panel), then pastes or types
// the exact quote they've selected as evidence plus a line / paragraph reference.
// Calls onSubmit with JSON string { quote, lineReference }.

import React, { useState } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

export interface EvidenceSelectionStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    if (/^\d+\.\s/.test(line.trim()) || /^[-•]\s/.test(line.trim())) {
      return (
        <p key={i} className="text-[#94A3B8] text-sm leading-relaxed ml-3 mt-1">
          {line}
        </p>
      );
    }
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-[#94A3B8] text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-white">
                {p}
              </strong>
            ) : (
              p
            ),
          )}
        </p>
      );
    }
    return (
      <p key={i} className="text-[#94A3B8] text-sm leading-relaxed mt-1">
        {line}
      </p>
    );
  });
}

const INPUT_BASE =
  'w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm leading-relaxed placeholder:text-[#4B5563] focus:outline-none focus:border-[#1D9E75]/50 transition-all';

// ─── Component ────────────────────────────────────────────────────────────────

export default function EvidenceSelectionStep({
  content,
  scaffoldsActive,
  onSubmit,
}: EvidenceSelectionStepProps) {
  const [quote, setQuote] = useState('');
  const [lineReference, setLineReference] = useState('');

  const canSubmit = quote.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(JSON.stringify({ quote: quote.trim(), lineReference: lineReference.trim() }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Gogi bubble */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
          <div className="space-y-0.5">{renderText(content)}</div>
        </div>
      </div>

      {/* Evidence quote input */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest block">
          Evidence — copy or type the exact quote
        </label>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            scaffoldsActive
              ? '"Copy a quote from the passage that directly supports the theme…"'
              : '"Paste the strongest evidence from the text…"'
          }
          rows={4}
          className={`${INPUT_BASE} resize-none`}
        />
      </div>

      {/* Line reference input */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest block">
          Location — line or paragraph number (optional)
        </label>
        <input
          type="text"
          value={lineReference}
          onChange={(e) => setLineReference(e.target.value)}
          placeholder="e.g. line 4, paragraph 2, sentence 3…"
          className={INPUT_BASE}
        />
      </div>

      {/* Submit row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#4B5563]">
          {scaffoldsActive
            ? 'Find the quote that makes the theme undeniable.'
            : 'No hints. Pick the strongest piece of proof you can find.'}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed py-2.5 px-6"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
