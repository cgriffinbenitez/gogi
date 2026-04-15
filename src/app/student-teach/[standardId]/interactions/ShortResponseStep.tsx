'use client';

// ShortResponseStep.tsx
// Single textarea response — shown for IndependentTask steps (step 5).

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

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;
  const sentenceCount = countSentences(trimmed);
  const overLimit = sentenceCount > 3;

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
      {/* Gogi bubble */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
          <div className="space-y-0.5">{renderText(content)}</div>
        </div>
      </div>

      {/* Response textarea */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest block">
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
          className={`w-full bg-white/[0.06] border rounded-xl px-4 py-3 text-white text-sm leading-relaxed placeholder:text-[#4B5563] focus:outline-none resize-none transition-all ${
            overLimit
              ? 'border-amber-500/50 focus:border-amber-400'
              : 'border-white/[0.08] focus:border-[#1D9E75]/50'
          }`}
        />
      </div>

      {/* Submit row */}
      <div className="flex items-center justify-between gap-4">
        <p className={`text-xs ${overLimit ? 'text-amber-400' : 'text-[#4B5563]'}`}>
          {overLimit
            ? `${sentenceCount} sentences — aim for 1 to 3.`
            : scaffoldsActive
              ? 'Write 1–3 complete sentences. Ctrl+Enter to submit.'
              : 'No scaffolds on this step. Write your best answer. Ctrl+Enter to submit.'}
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
