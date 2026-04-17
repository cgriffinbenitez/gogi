'use client';

import { useEffect, useRef, useState } from 'react';
import { C, FONTS } from '@/lib/constants/design';
import { getDefinition } from '@/lib/vocab/getDefinition';
import type { VocabDefinition } from '@/lib/vocab/getDefinition';

interface Props {
  word: string;
  anchorX: number;
  anchorY: number;
  /** Passage text — used as context for Claude-generated definitions */
  passageContext?: string;
  onDismiss: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function VocabPopover({
  word,
  anchorX,
  anchorY,
  passageContext,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<VocabDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setEntry(null);
    getDefinition(word, passageContext).then((result) => {
      setEntry(result);
      setLoading(false);
    });
  }, [word, passageContext]);

  // Dismiss on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [onDismiss]);

  // Dismiss on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  // Clamp to viewport
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 600;
  const popoverW = 280;
  const popoverH = 180; // approximate — clamp so it doesn't go off bottom

  const left = Math.max(8, Math.min(anchorX, vpW - popoverW - 8));
  const top = Math.max(8, Math.min(anchorY - popoverH - 12, vpH - popoverH - 8));

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 50,
        background: C.white,
        border: `1px solid ${C.blueMid}`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        width: popoverW,
        fontFamily: FONTS.ui,
        pointerEvents: 'auto',
      }}
    >
      {loading ? (
        <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>Loading…</p>
      ) : entry ? (
        <>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: C.navy,
              fontFamily: FONTS.passage,
            }}
          >
            {word}
          </div>
          {entry.part_of_speech && (
            <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginTop: 2 }}>
              {entry.part_of_speech}
            </div>
          )}
          <hr style={{ border: 'none', borderTop: `1px solid ${C.blueLight}`, margin: '8px 0' }} />
          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>
            {entry.definition}
          </div>
          {entry.example && (
            <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic', marginTop: 6 }}>
              &ldquo;{entry.example}&rdquo;
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
          No definition found for &ldquo;{word}&rdquo;.
        </p>
      )}
    </div>
  );
}
