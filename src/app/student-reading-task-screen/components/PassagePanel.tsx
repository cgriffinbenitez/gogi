'use client';

import React, { useRef, useState, useCallback } from 'react';
import { BookOpen, Highlighter, Info, X } from 'lucide-react';
import type { HighlightedSpan } from './StudentTaskPage';
import { PASSAGE } from './StudentTaskPage';

interface PassagePanelProps {
  passage: typeof PASSAGE;
  highlightMode: boolean;
  highlights: HighlightedSpan[];
  onAddHighlight: (span: HighlightedSpan) => void;
  onRemoveHighlight: (idx: number) => void;
  currentStep: number;
}

export default function PassagePanel({
  passage,
  highlightMode,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  currentStep,
}: PassagePanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
    setReadProgress(Math.min(100, Math.round(progress)));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!highlightMode) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 10) return;

    const idx = passage.text.indexOf(text);
    if (idx === -1) return;

    const alreadyHighlighted = highlights.some(
      (h) => h.start === idx && h.end === idx + text.length
    );
    if (alreadyHighlighted) return;

    onAddHighlight({ start: idx, end: idx + text.length, text });
    selection.removeAllRanges();
  }, [highlightMode, highlights, onAddHighlight, passage.text]);

  // Render passage text with highlights overlaid
  const renderPassageText = () => {
    if (highlights.length === 0) {
      return passage.text.split('\n\n').map((para, i) => (
        <p key={`para-${i + 1}`} className="mb-5 leading-8 text-slate-700 text-base">
          {para}
        </p>
      ));
    }

    // Sort highlights by start position
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    const fullText = passage.text;
    const elements: React.ReactNode[] = [];
    let cursor = 0;

    sorted.forEach((span, hi) => {
      if (span.start > cursor) {
        elements.push(
          <span key={`text-before-${hi}`}>{fullText.slice(cursor, span.start)}</span>
        );
      }
      elements.push(
        <span
          key={`highlight-${hi}`}
          className="bg-amber-200 rounded cursor-pointer hover:bg-amber-300 transition-colors relative group"
          onClick={() => onRemoveHighlight(hi)}
          title="Click to remove highlight"
        >
          {span.text}
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            Remove
          </span>
        </span>
      );
      cursor = span.end;
    });

    if (cursor < fullText.length) {
      elements.push(<span key="text-after-last">{fullText.slice(cursor)}</span>);
    }

    // Split back into paragraphs
    return (
      <div className="leading-8 text-slate-700 text-base whitespace-pre-wrap">
        {elements}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-white border-r border-slate-200 overflow-hidden"
      style={{ width: '55%', minWidth: '320px' }}>
      {/* Passage header */}
      <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
                Reading Passage
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{passage.title}</h2>
            <p className="text-xs text-slate-500">{passage.author}</p>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <Info size={16} />
          </button>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="badge bg-violet-100 text-violet-700">{passage.lexile}</span>
          <span className="badge bg-sky-100 text-sky-700">{passage.genre}</span>
          <span className="badge bg-slate-100 text-slate-600">Grade {passage.gradeLevel}</span>
          <span className="badge bg-slate-100 text-slate-600">{passage.wordCount} words</span>
          <span className="badge bg-amber-100 text-amber-700">~{passage.estimatedMinutes} min read</span>
        </div>

        {/* B.E.S.T. standards */}
        {showInfo && (
          <div className="mt-3 p-3 bg-violet-50 rounded-xl border border-violet-100 fade-in">
            <p className="text-xs font-semibold text-violet-700 mb-2">Florida B.E.S.T. Standards covered:</p>
            <div className="flex flex-wrap gap-1.5">
              {passage.bestStandards.map((s) => (
                <span key={`std-${s}`} className="badge bg-violet-600 text-white font-mono text-xs">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Highlight mode banner */}
        {highlightMode && currentStep === 2 && (
          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 fade-in">
            <Highlighter size={14} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              Highlight mode ON — select text to mark evidence
            </span>
            <span className="ml-auto text-xs text-amber-600 font-mono">
              {highlights.length} selected
            </span>
          </div>
        )}

        {/* Read progress */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${readProgress}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 font-mono tabular-nums w-10 text-right">
            {readProgress}%
          </span>
        </div>
      </div>

      {/* Passage body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        className={`flex-1 overflow-y-auto px-8 py-6 scrollbar-thin select-text ${
          highlightMode && currentStep === 2 ? 'cursor-text' : ''
        }`}
        style={{ lineHeight: 2 }}
      >
        {renderPassageText()}
      </div>

      {/* Highlights summary (step 2) */}
      {highlights.length > 0 && currentStep === 2 && (
        <div className="border-t border-amber-100 bg-amber-50 px-6 py-4 flex-shrink-0">
          <p className="text-xs font-semibold text-amber-700 mb-2">
            Selected Evidence ({highlights.length})
          </p>
          <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto scrollbar-thin">
            {highlights.map((h, i) => (
              <div
                key={`highlight-chip-${i + 1}`}
                className="flex items-start justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-200"
              >
                <span className="text-xs text-slate-700 leading-relaxed line-clamp-2 flex-1">
                  &ldquo;{h.text}&rdquo;
                </span>
                <button
                  onClick={() => onRemoveHighlight(i)}
                  className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}