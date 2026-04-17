'use client';

import { useEffect, useRef, useState } from 'react';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { getDefinition } from '@/lib/vocab/getDefinition';
import type { VocabDefinition } from '@/lib/vocab/getDefinition';

interface ToolsPanelProps {
  /** 'diagnostic' renders stripped panel; 'supported' renders full panel (default) */
  mode?: 'diagnostic' | 'supported';
  standardId: string;
  readingProgress: number;
  keywords: string[];
  /** Full passage text — drives TTS and vocab context */
  passageText: string;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  activeKeyword?: string | null;
  onKeywordActivate?: (word: string | null) => void;
  /** Called each time TTS moves to a new word (or stops) */
  onActiveTTSWordChange?: (tts: { word: string; charIndex: number } | null) => void;
}

const FONT_SIZES = [14, 17, 20] as const;
const FONT_LABELS = ['A', 'A', 'A'] as const;

type TTSState = 'idle' | 'playing' | 'paused';

// ─── Definition fetching ──────────────────────────────────────────────────────

/** Maps keyword → definition, undefined = loading, null = not found */
function useKeywordDefinitions(
  keywords: string[],
  passageText: string,
): Map<string, VocabDefinition | null> {
  const [defs, setDefs] = useState<Map<string, VocabDefinition | null>>(new Map());
  const key = keywords.join(',');

  useEffect(() => {
    if (!keywords.length) return;

    Promise.all(
      keywords.map(async (word): Promise<[string, VocabDefinition | null]> => {
        const result = await getDefinition(word, passageText);
        return [word, result];
      }),
    ).then((entries) => setDefs(new Map(entries)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // re-runs only when keyword list changes

  return defs;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ToolsPanel({
  mode = 'supported',
  standardId,
  readingProgress,
  keywords,
  passageText,
  fontSize,
  onFontSizeChange,
  activeKeyword = null,
  onKeywordActivate,
  onActiveTTSWordChange,
}: ToolsPanelProps) {
  const standard = STANDARDS[standardId as keyof typeof STANDARDS];
  const defs = useKeywordDefinitions(mode === 'supported' ? keywords : [], passageText);

  // ── TTS state machine ───────────────────────────────────────────────────────
  const [ttsState, setTtsState] = useState<TTSState>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  function handleTTSPlay() {
    if (!window.speechSynthesis || !passageText) return;

    const utterance = new SpeechSynthesisUtterance(passageText);
    utterance.rate = 0.9;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const word = passageText.substr(event.charIndex, event.charLength);
        onActiveTTSWordChange?.({ word, charIndex: event.charIndex });
      }
    };

    utterance.onend = () => {
      setTtsState('idle');
      onActiveTTSWordChange?.(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setTtsState('idle');
      onActiveTTSWordChange?.(null);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setTtsState('playing');
  }

  function handleTTSPause() {
    window.speechSynthesis.pause();
    setTtsState('paused');
  }

  function handleTTSResume() {
    window.speechSynthesis.resume();
    setTtsState('playing');
  }

  function handleTTSStop() {
    window.speechSynthesis.cancel();
    setTtsState('idle');
    onActiveTTSWordChange?.(null);
    utteranceRef.current = null;
  }

  // Cancel TTS when component unmounts
  useEffect(() => {
    return () => {
      if (utteranceRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Diagnostic mode — stripped panel ─────────────────────────────────────────

  if (mode === 'diagnostic') {
    return (
      <div
        style={{
          background:    C.white,
          borderLeft:    `1px solid ${C.border}`,
          padding:       '16px 14px',
          height:        '100%',
          overflowY:     'auto',
          fontFamily:    FONTS.ui,
          boxSizing:     'border-box',
        }}
      >
        {/* Header */}
        <div
          style={{
            fontSize:      9,
            fontWeight:    700,
            color:         C.gray,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom:  14,
          }}
        >
          READING
        </div>

        {/* Active Standard */}
        {standard && (
          <div
            style={{
              background:    C.blueLight,
              border:        `0.5px solid ${C.blueMid}`,
              borderRadius:  6,
              padding:       '10px 12px',
              marginBottom:  12,
            }}
          >
            <div
              style={{
                fontSize:      9,
                fontWeight:    700,
                color:         C.blue,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom:  6,
              }}
            >
              ACTIVE STANDARD
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 3 }}>
              {standard.code}
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>{standard.title}</div>
          </div>
        )}

        {/* Reading Progress */}
        <div
          style={{
            background:    C.light,
            borderRadius:  6,
            padding:       '10px 12px',
          }}
        >
          <div
            style={{
              fontSize:      9,
              fontWeight:    700,
              color:         C.gray,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom:  6,
            }}
          >
            READING PROGRESS
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height:     4,
                background: C.blue,
                borderRadius: 2,
                width:      `${readingProgress}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: C.blue, textAlign: 'right', marginTop: 4 }}>
            {readingProgress}%
          </div>
        </div>
      </div>
    );
  }

  // ── Supported mode — full panel ───────────────────────────────────────────────

  return (
    <div
      style={{
        background: C.white,
        borderLeft: `1px solid ${C.border}`,
        padding: '16px 14px',
        height: '100%',
        overflowY: 'auto',
        fontFamily: FONTS.ui,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: C.gray,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          marginBottom: 14,
        }}
      >
        READING TOOLS
      </div>

      {/* Reading Progress */}
      <div
        style={{
          background: C.blueLight,
          border: `0.5px solid ${C.blueMid}`,
          borderRadius: 6,
          padding: '10px 12px',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
          Reading Progress
        </div>
        <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: 4,
              background: C.blue,
              borderRadius: 2,
              width: `${readingProgress}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: C.blue, textAlign: 'right', marginTop: 4 }}>
          {readingProgress}%
        </div>
      </div>

      {/* Active Standard */}
      {standard && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.gray,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            ACTIVE STANDARD
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 2 }}>
            {standard.code}
          </div>
          <div style={{ fontSize: 12, color: C.dark }}>{standard.title}</div>
        </div>
      )}

      {/* Key Vocabulary */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.gray,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          KEY VOCABULARY
        </div>

        {keywords.length === 0 ? (
          <div
            style={{
              background: C.light,
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 12,
              color: C.gray,
              fontStyle: 'italic',
            }}
          >
            No key vocabulary flagged for this passage.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {keywords.map((word) => {
              const isActive =
                activeKeyword != null &&
                activeKeyword.toLowerCase() === word.toLowerCase();
              const def = defs.get(word); // undefined = loading, null = not found, object = found

              return (
                <div
                  key={word}
                  data-vocab-row={word}
                  onClick={() => onKeywordActivate?.(isActive ? null : word)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 10px',
                    marginBottom: 10,
                    borderRadius: 6,
                    background: isActive ? '#FAEEDA' : C.light,
                    border: isActive ? '2px solid #BA7517' : '1.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Yellow dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isActive ? '#BA7517' : '#FFF3A3',
                      border: `1.5px solid ${isActive ? '#BA7517' : '#E8C97A'}`,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 3 }}>
                      {word}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.gray,
                        lineHeight: 1.5,
                        fontStyle: def === undefined || def === null ? 'italic' : 'normal',
                      }}
                    >
                      {def === undefined
                        ? '…'
                        : def === null
                          ? 'tap to define'
                          : def.definition}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Text-to-Speech controls */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.gray,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          TEXT-TO-SPEECH
        </div>

        {ttsState === 'idle' ? (
          <button
            onClick={handleTTSPlay}
            style={{
              width: '100%',
              background: C.light,
              border: `0.5px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 13,
              color: C.gray,
              cursor: 'pointer',
              fontFamily: FONTS.ui,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            ▶  Listen to passage
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={ttsState === 'playing' ? handleTTSPause : handleTTSResume}
              style={{
                flex: 2,
                background: C.blueLight,
                border: `0.5px solid ${C.blueMid}`,
                borderRadius: 6,
                fontSize: 13,
                color: C.navy,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              {ttsState === 'playing' ? '⏸  Pause' : '▶  Resume'}
            </button>
            <button
              onClick={handleTTSStop}
              style={{
                flex: 1,
                background: C.light,
                border: `0.5px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                color: C.gray,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Font Size Toggle */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: C.gray }}>Font size:</span>
        {FONT_SIZES.map((size, i) => (
          <button
            key={size}
            onClick={() => onFontSizeChange(size)}
            style={{
              width: 28,
              height: 26,
              border: `0.5px solid ${fontSize === size ? C.blue : C.blueMid}`,
              borderRadius: 4,
              background: fontSize === size ? C.blueLight : C.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: [12, 15, 18][i],
              color: C.navy,
              fontFamily: FONTS.ui,
              fontWeight: fontSize === size ? 700 : 400,
            }}
          >
            {FONT_LABELS[i]}
          </button>
        ))}
      </div>
    </div>
  );
}
