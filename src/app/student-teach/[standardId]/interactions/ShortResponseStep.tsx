'use client';

// ShortResponseStep.tsx
// Single textarea response — shown for IndependentTask steps (step 5).
// Renders content as the Gogi prompt. Helper text enforces 1–3 sentence scope.
// Calls onSubmit with the trimmed student response.

import React, { useState, useRef, useEffect } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

export interface ShortResponseStepProps {
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

// Rough sentence count by splitting on sentence-ending punctuation
function countSentences(text: string): number {
  const matches = text.trim().match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : text.trim().length > 0 ? 1 : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShortResponseStep({
  content,
  scaffoldsActive,
  onSubmit,
}: ShortResponseStepProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the textarea once the component mounts
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;
  const sentenceCount = countSentences(trimmed);
  const overLimit = sentenceCount > 3;

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Gogi bubble — prompt ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-0.5">{renderText(content)}</div>
        </div>
      </div>

      {/* ── Response textarea ── */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
          Your response — 1 to 3 sentences
        </label>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            scaffoldsActive
              ? 'Write your response here…'
              : 'No scaffolds. No hints. Just you and the text.'
          }
          rows={4}
          className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none resize-none transition-all ${
            overLimit
              ? 'border-amber-500/50 focus:border-amber-400'
              : 'border-white/15 focus:border-violet-500/50'
          }`}
        />
      </div>

      {/* ── Submit row ── */}
      <div className="flex items-center justify-between gap-4">
        <p className={`text-xs ${overLimit ? 'text-amber-400' : 'text-slate-500'}`}>
          {overLimit
            ? `${sentenceCount} sentences — aim for 1 to 3.`
            : scaffoldsActive
              ? 'Write 1–3 complete sentences. Ctrl+Enter to submit.'
              : 'No scaffolds on this step. Write your best answer. Ctrl+Enter to submit.'}
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
