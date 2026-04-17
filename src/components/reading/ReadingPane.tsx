'use client';

import { useRef, useState, useEffect } from 'react';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { VocabPopover } from './VocabPopover';
import type { Passage } from '@/lib/data/getPassage';
import { C, FONTS } from '@/lib/constants/design';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReadingPaneProps {
  passage: Passage;
  phase?: 'diagnostic' | 'practice';
  /** 'diagnostic' strips all vocab supports; 'supported' enables them (default) */
  mode?: 'diagnostic' | 'supported';
  onDoneReading: () => void;
  progressOverride?: number;
  fontSize?: number;
  activeKeyword?: string | null;
  onKeywordActivate?: (word: string | null) => void;
  /** Exact word + charIndex in passage.text currently spoken by TTS */
  activeTTSWord?: { word: string; charIndex: number } | null;
  /** Fired whenever scroll progress changes (0–100) */
  onScrollProgress?: (progress: number) => void;
}

interface PopoverState {
  word: string;
  x: number;
  y: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeForMatch(w: string): string {
  return w
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics (ï → i)
    .replace(/[^a-zA-Z-]/g, '')      // strip punctuation, keep hyphens
    .toLowerCase();
}

// Token carries its absolute charIndex within the full passage.text string
type Token = { text: string; isWord: boolean; charIndex: number };

/** Tokenize `text`, with `startOffset` = byte position of `text[0]` in passage.text */
function tokenize(text: string, startOffset: number = 0): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  // Match letter sequences including hyphenated compounds (mid-Victorian)
  const wordRe = /[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\u024F]+(?:-[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\u024F]+)*/g;
  for (const m of text.matchAll(wordRe)) {
    if (m.index! > last)
      tokens.push({ text: text.slice(last, m.index), isWord: false, charIndex: startOffset + last });
    tokens.push({ text: m[0], isWord: true, charIndex: startOffset + m.index! });
    last = m.index! + m[0].length;
  }
  if (last < text.length)
    tokens.push({ text: text.slice(last), isWord: false, charIndex: startOffset + last });
  return tokens;
}

/** Split passage text into paragraphs, preserving each paragraph's offset in the original string */
function getParasWithOffsets(text: string): Array<{ text: string; offset: number }> {
  const result: Array<{ text: string; offset: number }> = [];
  for (const m of text.matchAll(/[^\n]+/g)) {
    if (m[0].trim()) result.push({ text: m[0], offset: m.index! });
  }
  return result;
}

// ─── PassageText ─────────────────────────────────────────────────────────────

function PassageText({
  text,
  keywords,
  fontSize,
  activeKeyword,
  activeTTSWord,
  onKeywordClick,
  onKeywordHoverEnter,
  onKeywordHoverLeave,
}: {
  text: string;
  keywords: string[];
  fontSize: number;
  activeKeyword: string | null;
  activeTTSWord: { word: string; charIndex: number } | null;
  onKeywordClick: (word: string, x: number, y: number) => void;
  onKeywordHoverEnter: (word: string, x: number, y: number) => void;
  onKeywordHoverLeave: () => void;
}) {
  const safeKws = keywords ?? [];
  const paras = getParasWithOffsets(text);

  // Normalized keyword → original keyword
  const normKwMap = new Map<string, string>();
  for (const kw of safeKws) normKwMap.set(normalizeForMatch(kw), kw);

  const activeNorm = activeKeyword ? normalizeForMatch(activeKeyword) : null;
  const ttsNorm = activeTTSWord ? normalizeForMatch(activeTTSWord.word) : null;

  return (
    <>
      {paras.map(({ text: para, offset }, pi) => {
        const tokens = tokenize(para, offset);
        return (
          <p key={pi} style={{ fontSize, lineHeight: 1.75, color: C.dark, marginBottom: '1em' }}>
            {tokens.map((tok, ti) => {
              if (!tok.isWord) return tok.text;

              const norm = normalizeForMatch(tok.text);

              // TTS highlight — match by normalized word AND exact charIndex so only the
              // currently-spoken occurrence lights up (FIX 3)
              const isTTS =
                ttsNorm !== null &&
                norm === ttsNorm &&
                tok.charIndex === activeTTSWord!.charIndex;

              if (isTTS) {
                return (
                  <span
                    key={ti}
                    style={{
                      background: '#B5D4F4',
                      borderRadius: 2,
                      padding: '1px 2px',
                    }}
                  >
                    {tok.text}
                  </span>
                );
              }

              const originalKw = normKwMap.get(norm);
              if (!originalKw) return tok.text;

              const isActive = activeNorm === norm;

              return (
                <mark
                  key={ti}
                  data-keyword={originalKw}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onKeywordHoverEnter(originalKw, rect.left, rect.top);
                  }}
                  onMouseLeave={onKeywordHoverLeave}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onKeywordClick(originalKw, rect.left, rect.top);
                  }}
                  style={{
                    background: isActive ? '#FAEEDA' : '#FFF3A3',
                    border: isActive ? '2px solid #BA7517' : 'none',
                    padding: '1px 3px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    color: 'inherit',
                    fontStyle: 'inherit',
                  }}
                >
                  {tok.text}
                </mark>
              );
            })}
          </p>
        );
      })}
    </>
  );
}

// ─── ReadingPane ──────────────────────────────────────────────────────────────

export function ReadingPane({
  passage,
  phase = 'diagnostic',
  mode = 'supported',
  onDoneReading,
  progressOverride,
  fontSize = 17,
  activeKeyword = null,
  onKeywordActivate,
  activeTTSWord = null,
  onScrollProgress,
}: ReadingPaneProps) {
  const isDiagnostic = mode === 'diagnostic';
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useScrollProgress(scrollRef as React.RefObject<HTMLElement | null>);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // Bubble scroll progress to parent whenever it changes
  useEffect(() => {
    onScrollProgress?.(scrollProgress);
  }, [scrollProgress, onScrollProgress]);

  // ── Hover delay timers ──────────────────────────────────────────────────────
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayProgress = progressOverride ?? scrollProgress;
  const barColor = phase === 'practice' ? C.green : C.blue;

  // ── Scroll-to + pulse when activeKeyword changes ────────────────────────────
  useEffect(() => {
    if (!activeKeyword || !scrollRef.current) return;

    const marks = scrollRef.current.querySelectorAll<HTMLElement>(
      `[data-keyword="${CSS.escape(activeKeyword)}"]`,
    );

    marks.forEach((el) => {
      el.classList.remove('kw-pulse');
      void el.offsetWidth;
      el.classList.add('kw-pulse');
    });

    if (marks.length > 0) {
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const t = setTimeout(() => marks.forEach((el) => el.classList.remove('kw-pulse')), 1500);
    return () => clearTimeout(t);
  }, [activeKeyword]);

  // ── Hover handlers ──────────────────────────────────────────────────────────

  function scheduleOpen(word: string, x: number, y: number) {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      setPopover({ word, x, y });
      onKeywordActivate?.(word);
    }, 300);
  }

  function scheduleClose() {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    closeTimerRef.current = setTimeout(() => {
      setPopover(null);
      onKeywordActivate?.(null);
    }, 200);
  }

  function cancelClose() {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }

  function handleKeywordClick(word: string, x: number, y: number) {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setPopover({ word, x, y });
    onKeywordActivate?.(word);
  }

  function handlePopoverDismiss() {
    setPopover(null);
    onKeywordActivate?.(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: C.white,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Pulse keyframes */}
      <style>{`
        @keyframes kw-pulse {
          0%   { background: #FAEEDA; outline: 2px solid #BA7517; outline-offset: 2px; }
          70%  { background: #FAEEDA; outline: 2px solid #BA7517; outline-offset: 2px; }
          100% { background: #FFF3A3; outline: none; outline-offset: 0; }
        }
        .kw-pulse { animation: kw-pulse 1.5s ease-out forwards !important; }
      `}</style>

      {/* Reading progress bar */}
      <div style={{ height: 3, background: C.blueLight, flexShrink: 0 }}>
        <div
          style={{
            height: 3,
            background: barColor,
            width: `${displayProgress}%`,
            transition: 'width 0.2s ease',
          }}
        />
      </div>

      {/* Scrollable passage */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}
      >
        {/* Passage header */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.navy,
              fontFamily: FONTS.passage,
              lineHeight: 1.3,
            }}
          >
            {passage.title}
          </div>
          <div style={{ fontSize: 11, color: C.gray, fontFamily: FONTS.ui, marginTop: 3 }}>
            {passage.author}
            {passage.pub_year ? `  |  ${passage.pub_year}` : ''}
            {passage.gutenberg_id
              ? `  |  Public Domain  |  Gutenberg ID: ${passage.gutenberg_id}`
              : '  |  Public Domain'}
          </div>
          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
        </div>

        {/* Passage body — diagnostic mode: no highlights, no popovers */}
        <div style={{ fontFamily: FONTS.passage }}>
          <PassageText
            text={passage.text}
            keywords={isDiagnostic ? [] : (passage.keyword_flags ?? [])}
            fontSize={fontSize}
            activeKeyword={isDiagnostic ? null : activeKeyword}
            activeTTSWord={isDiagnostic ? null : activeTTSWord}
            onKeywordClick={isDiagnostic ? () => {} : handleKeywordClick}
            onKeywordHoverEnter={isDiagnostic ? () => {} : scheduleOpen}
            onKeywordHoverLeave={isDiagnostic ? () => {} : scheduleClose}
          />
        </div>

        {!isDiagnostic && (passage.keyword_flags?.length ?? 0) > 0 && (
          <p
            style={{
              fontSize: 11,
              color: C.blue,
              fontStyle: 'italic',
              marginTop: 10,
              fontFamily: FONTS.ui,
            }}
          >
            Hover or tap any highlighted word to see its definition
          </p>
        )}
      </div>

      {/* Bottom bar — Done Reading only (TTS lives in ToolsPanel) */}
      <div
        style={{
          height: 44,
          borderTop: `0.5px solid ${C.border}`,
          background: C.white,
          display: 'flex',
          padding: '0 16px',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onDoneReading}
          style={{
            flex: 1,
            background: C.navy,
            color: C.white,
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONTS.ui,
            height: 30,
          }}
        >
          Done Reading  →
        </button>
      </div>

      {/* Vocab popover — suppressed in diagnostic mode */}
      {!isDiagnostic && popover && (
        <VocabPopover
          word={popover.word}
          anchorX={popover.x}
          anchorY={popover.y}
          passageContext={passage.text}
          onDismiss={handlePopoverDismiss}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  );
}
