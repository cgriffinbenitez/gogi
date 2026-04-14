'use client';

// StructuredResponseStep.tsx
// Three labeled sections: Theme (text input), Evidence (textarea), Reasoning (textarea).
// Used for IndependentTask (step 5 in LiteraryAnalysisParagraph / ThemeEvidenceMapping),
// MasteryCheck (step 6), and TransferTask (step 7) across protocols.
// Calls onSubmit with JSON string { theme, evidence, reasoning }.

import React, { useState } from 'react';

export interface StructuredResponseStepProps {
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

const INPUT_BASE =
  'w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-all';

// ─── Component ────────────────────────────────────────────────────────────────

export default function StructuredResponseStep({
  content,
  scaffoldsActive,
  onSubmit,
}: StructuredResponseStepProps) {
  const [theme, setTheme] = useState('');
  const [evidence, setEvidence] = useState('');
  const [reasoning, setReasoning] = useState('');

  const canSubmit =
    theme.trim().length > 0 && evidence.trim().length > 0 && reasoning.trim().length > 0;

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(
      JSON.stringify({
        theme: theme.trim(),
        evidence: evidence.trim(),
        reasoning: reasoning.trim(),
      }),
    );
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

      {/* ── Three labeled sections ── */}
      <div className="space-y-4">

        {/* Theme */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-violet-300 uppercase tracking-widest block">
            Universal Theme
          </label>
          <p className="text-xs text-slate-500 mb-1">
            A full sentence that says something true about all people — not just this character.
          </p>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder={
              scaffoldsActive
                ? 'e.g. "People often discover their true strength when they face loss."'
                : 'Write the universal theme as a complete sentence…'
            }
            className={INPUT_BASE}
          />
        </div>

        {/* Evidence */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-blue-300 uppercase tracking-widest block">
            Evidence
          </label>
          <p className="text-xs text-slate-500 mb-1">
            Quote or closely paraphrase the specific part of the text that proves your theme.
          </p>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={
              scaffoldsActive
                ? 'e.g. "She stood at the edge of the cliff, not afraid anymore…"'
                : 'Paste or paraphrase the strongest evidence from the text…'
            }
            rows={3}
            className={`${INPUT_BASE} resize-none`}
          />
        </div>

        {/* Reasoning */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-widest block">
            Reasoning
          </label>
          <p className="text-xs text-slate-500 mb-1">
            Explain how this evidence proves the theme. The connection must be stated — not implied.
          </p>
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder={
              scaffoldsActive
                ? 'e.g. "This shows the theme because it demonstrates that she has changed from the person who…"'
                : 'Explain why this evidence proves your theme…'
            }
            rows={3}
            className={`${INPUT_BASE} resize-none`}
          />
        </div>
      </div>

      {/* ── Submit row ── */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {canSubmit
            ? 'All three sections complete — ready to submit.'
            : 'Complete all three sections before submitting.'}
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
