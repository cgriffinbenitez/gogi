'use client';

// EvidenceSelectionStep.tsx
// Student reads the passage (visible in the left panel), then pastes or types
// the exact quote they've selected as evidence plus a line / paragraph reference.
// Calls onSubmit with JSON string { quote, lineReference }.

import React, { useState } from 'react';

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
        <p key={i} className="text-slate-700 text-sm leading-relaxed ml-3 mt-1">
          {line}
        </p>
      );
    }
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-slate-900">
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
      <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">
        {line}
      </p>
    );
  });
}

function GogiAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center flex-shrink-0 self-start mt-0.5">
      <span className="text-white text-sm font-extrabold leading-none select-none">G</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EvidenceSelectionStep({
  content,
  scaffoldsActive,
  onSubmit,
}: EvidenceSelectionStepProps) {
  const [quote, setQuote] = useState('');
  const [lineReference, setLineReference] = useState('');

  const canSubmit = quote.trim().length > 0;

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

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
      {/* ── Gogi bubble — instructions ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-0.5">{renderText(content)}</div>
        </div>
      </div>

      {/* ── Evidence quote input ── */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
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
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none transition-all"
        />
      </div>

      {/* ── Line reference input ── */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
          Location — line or paragraph number (optional)
        </label>
        <input
          type="text"
          value={lineReference}
          onChange={(e) => setLineReference(e.target.value)}
          placeholder="e.g. line 4, paragraph 2, sentence 3…"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-all"
        />
      </div>

      {/* ── Submit row ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {scaffoldsActive
            ? 'Find the quote that makes the theme undeniable.'
            : 'No hints. Pick the strongest piece of proof you can find.'}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`${btnClass} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg`}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
