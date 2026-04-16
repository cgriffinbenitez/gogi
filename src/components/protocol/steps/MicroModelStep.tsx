'use client';

// MicroModelStep.tsx
// The most important instructional moment in GOGI — Gogi actively demonstrates
// the skill on the passage while Marcus follows along point by point.
//
// Content format (from Claude):
//   POINT 1 | HIGHLIGHT: "exact quote" | Gogi instruction text
//   POINT 2 | HIGHLIGHT: "another quote" | More instruction
//   ...
//
// Behavior:
//   - Passage left panel: full text with current HIGHLIGHT glowing (teal glow),
//     all other text at 0.35 opacity.
//   - Right panel: GogiAvatar + instruction text + dot progress + Next/Got it.
//   - Auto-scrolls passage to the highlighted region on point advance.
//   - Graceful degradation: if parsing fails, renders content as plain text.
//
// Props: content (from Claude), passage (clean literary text), scaffoldsActive, onSubmit.
// onSubmit fires once on final point with 'micromodel_complete'.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MicroModelPoint {
  highlight: string;
  instruction: string;
}

export interface MicroModelStepProps {
  content: string;
  passage: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePoints(content: string): MicroModelPoint[] {
  // Match: POINT N | HIGHLIGHT: "..." | instruction text
  const regex = /^POINT\s+\d+\s*\|\s*HIGHLIGHT:\s*"([^"]+)"\s*\|\s*(.+)$/gm;
  const points: MicroModelPoint[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const highlight = m[1].trim();
    const instruction = m[2].trim();
    if (highlight && instruction) {
      points.push({ highlight, instruction });
    }
  }
  return points;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MicroModelStep({
  content,
  passage,
  scaffoldsActive: _scaffoldsActive,
  onSubmit,
}: MicroModelStepProps) {
  const points = useMemo(() => parsePoints(content), [content]);
  const [currentPoint, setCurrentPoint] = useState(0);
  const highlightRef = useRef<HTMLSpanElement>(null);

  // Auto-scroll highlighted span into view when point advances
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentPoint]);

  // ── Graceful degradation — parsing failed ──────────────────────────────────
  if (points.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-8">
            <GogiAvatar />
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-5 py-4 flex-1">
              <p className="text-[#94A3B8] text-sm leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => onSubmit('micromodel_complete')}
              className="btn-primary py-3.5 px-8"
            >
              <span>Continue</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const point = points[currentPoint];
  const isLast = currentPoint === points.length - 1;
  const highlightIdx = passage.indexOf(point.highlight);

  function handleNext() {
    if (isLast) {
      onSubmit('micromodel_complete');
    } else {
      setCurrentPoint((p) => p + 1);
    }
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

      {/* ── Left: passage with glow highlight ───────────────────────────────── */}
      <div className="md:w-2/5 w-full flex-shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.08] p-4 md:p-6 max-h-48 md:max-h-none">
        <p className="text-white font-bold mb-1" style={{ fontSize: '16px' }}>Literary Selection</p>
        <hr className="border-white/[0.08] my-3" />
        <p
          className="text-[#94A3B8] text-sm whitespace-pre-line"
          style={{ lineHeight: '1.8', fontFamily: 'Georgia, serif' }}
        >
          {highlightIdx === -1 ? (
            // Quote not found verbatim — show full passage at full opacity
            passage
          ) : (
            <>
              <span style={{ opacity: 0.35, transition: 'opacity 0.3s ease' }}>
                {passage.slice(0, highlightIdx)}
              </span>
              <span
                ref={highlightRef}
                style={{
                  background: 'rgba(29,158,117,0.15)',
                  border: '1px solid rgba(29,158,117,0.6)',
                  borderRadius: '4px',
                  boxShadow: '0 0 12px rgba(29,158,117,0.3)',
                  padding: '2px 4px',
                  opacity: 1,
                  color: '#ffffff',
                  transition: 'opacity 0.3s ease',
                }}
              >
                {passage.slice(highlightIdx, highlightIdx + point.highlight.length)}
              </span>
              <span style={{ opacity: 0.35, transition: 'opacity 0.3s ease' }}>
                {passage.slice(highlightIdx + point.highlight.length)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* ── Right: Gogi instruction ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6">
        <div className="flex-1 space-y-5">

          {/* Point counter */}
          <p
            className="text-[#4B5563] uppercase tracking-widest font-bold"
            style={{ fontSize: '11px' }}
          >
            Step {currentPoint + 1} of {points.length}
          </p>

          {/* Gogi speech bubble */}
          <div className="flex items-start gap-3">
            <GogiAvatar />
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-5 py-4 flex-1">
              <p className="text-[#94A3B8] text-sm leading-relaxed">{point.instruction}</p>
            </div>
          </div>

          {/* Dot progress indicator */}
          <div className="flex items-center gap-2 pl-1">
            {points.map((_, i) =>
              i < currentPoint ? (
                // Completed — filled teal with checkmark
                <div
                  key={i}
                  className="w-5 h-5 rounded-full bg-[#1D9E75] flex items-center justify-center flex-shrink-0"
                >
                  <span className="text-white font-bold leading-none" style={{ fontSize: '9px' }}>
                    ✓
                  </span>
                </div>
              ) : i === currentPoint ? (
                // Current — solid teal dot
                <div key={i} className="w-3 h-3 rounded-full bg-[#1D9E75] flex-shrink-0" />
              ) : (
                // Upcoming — empty ring
                <div
                  key={i}
                  className="w-3 h-3 rounded-full border border-[#4B5563] flex-shrink-0"
                />
              ),
            )}
          </div>

        </div>

        {/* Navigation button */}
        <div className="pt-6">
          <button onClick={handleNext} className="btn-primary w-full py-3.5">
            <span>{isLast ? 'Got it' : 'Next'}</span>
            {!isLast && <span>→</span>}
          </button>
        </div>
      </div>

    </div>
  );
}
