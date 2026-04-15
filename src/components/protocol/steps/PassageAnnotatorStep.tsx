'use client';

// PassageAnnotatorStep.tsx
// Student highlights text in the passage by clicking-and-dragging (desktop) or
// tapping a sentence (mobile), then tags the selection with one of six clinical
// labels, then writes a brief explanation.
//
// content prop format — two sections separated by ---:
//   [Gogi instruction text]
//   ---
//   [Passage text for annotation]
//
// Submitted string format (single string to ProtocolEngine):
//   HIGHLIGHTS: [Textual Evidence] 'She stood at the edge...' | [Signal Word] 'however'
//   EXPLANATION: This shows that the character has changed because...

import React, { useState, useRef, useCallback, useEffect } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

type TagLabel =
  | 'Textual Evidence'
  | 'Signal Word'
  | 'Main Idea'
  | 'Supporting Detail'
  | 'Clause'
  | 'Context Clue';

interface Highlight {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  tag: TagLabel;
}

interface PendingSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  menuX: number; // viewport-relative center X of the selection rect
  menuY: number; // viewport-relative top Y of the selection rect
}

export interface PassageAnnotatorStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAGS: TagLabel[] = [
  'Textual Evidence',
  'Signal Word',
  'Main Idea',
  'Supporting Detail',
  'Clause',
  'Context Clue',
];

const TAG_STYLE: Record<TagLabel, { mark: string; dot: string }> = {
  'Textual Evidence': { mark: 'bg-amber-200 text-amber-900',   dot: 'bg-amber-500' },
  'Signal Word':      { mark: 'bg-blue-200 text-blue-900',     dot: 'bg-blue-500' },
  'Main Idea':        { mark: 'bg-emerald-200 text-emerald-900', dot: 'bg-emerald-500' },
  'Supporting Detail':{ mark: 'bg-slate-200 text-slate-800',   dot: 'bg-slate-500' },
  'Clause':           { mark: 'bg-purple-200 text-purple-900', dot: 'bg-purple-500' },
  'Context Clue':     { mark: 'bg-orange-200 text-orange-900', dot: 'bg-orange-500' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseContent(content: string): { instruction: string; passage: string } {
  // Support both `\n---\n` and bare `---` on its own line
  const match = content.match(/^([\s\S]*?)^---\s*$/m);
  if (!match) return { instruction: content.trim(), passage: '' };
  return {
    instruction: match[1].trim(),
    passage: content.slice(match[0].length).trim(),
  };
}

// Walk all text nodes in container and return the character offset of
// (targetNode, targetOffset) relative to the start of the container's text.
function nodeToTextOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) return total + targetOffset;
    total += node.textContent?.length ?? 0;
    node = walker.nextNode();
  }
  return total + targetOffset;
}

// Split passage into sentence spans with absolute character offsets.
function sentenceRanges(text: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  // Match runs that end in .!? or run to end of string
  const re = /[^.!?\n]+[.!?]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m.index;
    const e = s + m[0].length;
    if (m[0].trim()) ranges.push({ start: s, end: e });
  }
  return ranges;
}

function renderInstruction(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-slate-900">{p}</strong>
            ) : p,
          )}
        </p>
      );
    }
    return <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">{line}</p>;
  });
}

// ─── Passage renderer ─────────────────────────────────────────────────────────
// Splits passage text into un-highlighted segments and highlighted <mark> spans.

function PassageWithHighlights({
  text,
  highlights,
}: {
  text: string;
  highlights: Highlight[];
}) {
  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
  const segments: { text: string; highlight: Highlight | null }[] = [];
  let cursor = 0;

  for (const h of sorted) {
    if (h.startOffset > cursor) {
      segments.push({ text: text.slice(cursor, h.startOffset), highlight: null });
    }
    if (h.endOffset > h.startOffset) {
      segments.push({ text: text.slice(h.startOffset, h.endOffset), highlight: h });
    }
    cursor = Math.max(cursor, h.endOffset);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: null });
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className={`${TAG_STYLE[seg.highlight.tag].mark} rounded-sm px-0.5 cursor-default`}
            title={seg.highlight.tag}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PassageAnnotatorStep({
  content,
  scaffoldsActive,
  onSubmit,
}: PassageAnnotatorStepProps) {
  const { instruction, passage } = parseContent(content);

  const passageRef = useRef<HTMLDivElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [pending,    setPending]    = useState<PendingSelection | null>(null);
  const [explanation, setExplanation] = useState('');

  const canSubmit = highlights.length > 0 && explanation.trim().length > 0;

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

  // ── Close tag menu on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!pending) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPending(null);
        window.getSelection()?.removeAllRanges();
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [pending]);

  // ── Shared: check for overlap with existing highlights ─────────────────────
  function overlaps(start: number, end: number): boolean {
    return highlights.some(h => start < h.endOffset && end > h.startOffset);
  }

  // ── Desktop: drag-to-select via mouseup ────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (!passageRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!passageRef.current.contains(range.commonAncestorContainer)) return;

    const selectedText = sel.toString().trim();
    if (!selectedText) return;

    const startOff = nodeToTextOffset(passageRef.current, range.startContainer, range.startOffset);
    const endOff   = nodeToTextOffset(passageRef.current, range.endContainer,   range.endOffset);
    if (startOff >= endOff || overlaps(startOff, endOff)) {
      sel.removeAllRanges();
      return;
    }

    const rect = range.getBoundingClientRect();
    setPending({
      text:        selectedText,
      startOffset: startOff,
      endOffset:   endOff,
      menuX:       rect.left + rect.width / 2,
      menuY:       rect.top,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights]);

  // ── Mobile: tap-to-select-sentence via touchend ────────────────────────────
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!passageRef.current) return;

      // If the user dragged and produced a selection, handle it like desktop
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (passageRef.current.contains(range.commonAncestorContainer)) {
          const selectedText = sel.toString().trim();
          if (selectedText) {
            const startOff = nodeToTextOffset(passageRef.current, range.startContainer, range.startOffset);
            const endOff   = nodeToTextOffset(passageRef.current, range.endContainer,   range.endOffset);
            if (startOff < endOff && !overlaps(startOff, endOff)) {
              const rect = range.getBoundingClientRect();
              setPending({
                text:        selectedText,
                startOffset: startOff,
                endOffset:   endOff,
                menuX:       rect.left + rect.width / 2,
                menuY:       rect.top,
              });
              return;
            }
          }
        }
        sel.removeAllRanges();
      }

      // Tap fallback — find which sentence the touch landed in
      const touch = e.changedTouches[0];
      if (!touch) return;

      // caretRangeFromPoint is non-standard but widely supported on iOS/Android
      type DocWithCaret = Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      const caretRange = (document as DocWithCaret).caretRangeFromPoint?.(
        touch.clientX,
        touch.clientY,
      );
      if (!caretRange || !passageRef.current.contains(caretRange.startContainer)) return;

      const tapOffset = nodeToTextOffset(
        passageRef.current,
        caretRange.startContainer,
        caretRange.startOffset,
      );

      const sentences = sentenceRanges(passage);
      const tapped = sentences.find(s => tapOffset >= s.start && tapOffset <= s.end);
      if (!tapped) return;

      const sentText = passage.slice(tapped.start, tapped.end).trim();
      if (!sentText || overlaps(tapped.start, tapped.end)) return;

      setPending({
        text:        sentText,
        startOffset: tapped.start,
        endOffset:   tapped.end,
        menuX:       touch.clientX,
        menuY:       touch.clientY,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlights, passage],
  );

  // ── Tag a pending selection ────────────────────────────────────────────────
  function handleTag(tag: TagLabel) {
    if (!pending) return;
    setHighlights(prev => [
      ...prev,
      {
        id:          `${Date.now()}-${Math.random()}`,
        text:        pending.text,
        startOffset: pending.startOffset,
        endOffset:   pending.endOffset,
        tag,
      },
    ]);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  function handleClear() {
    setHighlights([]);
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const highlightStr = highlights
      .map(h => `[${h.tag}] '${h.text}'`)
      .join(' | ');
    onSubmit(`HIGHLIGHTS: ${highlightStr}\nEXPLANATION: ${explanation.trim()}`);
  }

  // ── Clamp menu position to viewport ───────────────────────────────────────
  const MENU_W = 304;
  const menuLeft = typeof window !== 'undefined'
    ? Math.min(Math.max(pending?.menuX ?? 0) - MENU_W / 2, window.innerWidth - MENU_W - 8)
    : 0;
  const menuTop = Math.max((pending?.menuY ?? 0) - 172, 8);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Gogi bubble — instruction ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-0.5">{renderInstruction(instruction || content)}</div>
        </div>
      </div>

      {/* ── Passage panel ── */}
      {passage ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {scaffoldsActive
                ? 'Select text → choose a tag → explain below'
                : 'Annotate the passage'}
            </span>
            {highlights.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Selectable passage text */}
          <div
            ref={passageRef}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleTouchEnd}
            className="px-5 py-5 text-slate-800 text-[15px] leading-8 select-text cursor-text"
            style={{ fontFamily: 'Georgia, serif', WebkitUserSelect: 'text', userSelect: 'text' }}
          >
            <PassageWithHighlights text={passage} highlights={highlights} />
          </div>

          {/* Active highlight legend */}
          {highlights.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
              {highlights.map(h => (
                <span
                  key={h.id}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${TAG_STYLE[h.tag].mark}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TAG_STYLE[h.tag].dot}`} />
                  {h.tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-amber-300 text-sm">
            No passage found — content must include a <code>---</code> separator between the
            instruction and the passage text.
          </p>
        </div>
      )}

      {/* ── Floating tag menu ── */}
      {pending && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-3"
          style={{ left: menuLeft, top: menuTop, width: MENU_W }}
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5 px-1 truncate">
            Tag: &ldquo;{pending.text.length > 32
              ? pending.text.slice(0, 32) + '…'
              : pending.text}&rdquo;
          </p>

          <div className="grid grid-cols-2 gap-1.5">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => handleTag(tag)}
                className={`text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 hover:opacity-90 ${TAG_STYLE[tag].mark}`}
              >
                {tag}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setPending(null); window.getSelection()?.removeAllRanges(); }}
            className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1.5"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Explanation ── */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
          Explain what you found
        </label>
        <textarea
          value={explanation}
          onChange={e => setExplanation(e.target.value)}
          disabled={highlights.length === 0}
          placeholder={
            highlights.length === 0
              ? 'Highlight and tag at least one part of the passage first…'
              : scaffoldsActive
                ? 'Explain why you highlighted these parts and what they reveal about the text…'
                : 'Explain what you found and why it matters.'
          }
          rows={3}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-slate-200 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>

      {/* ── Submit row ── */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {canSubmit
            ? `${highlights.length} highlight${highlights.length !== 1 ? 's' : ''} tagged — ready to submit.`
            : highlights.length === 0
              ? 'Select and tag at least one part of the passage.'
              : 'Add your explanation before submitting.'}
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
