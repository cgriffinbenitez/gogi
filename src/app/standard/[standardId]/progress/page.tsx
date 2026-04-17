'use client';

import { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';

// ─── Inner component (needs useSearchParams → requires Suspense boundary) ─────

function ProgressContent() {
  const params       = useParams<{ standardId: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const standard     = STANDARDS[standardCode as keyof typeof STANDARDS];
  const sessions     = parseInt(searchParams.get('sessions') ?? '1', 10);

  // ── Labels per session count ──────────────────────────────────────────────

  const sessionLabel = sessions === 2 ? 'SESSION 2 COMPLETE' : 'SESSION 1 COMPLETE';

  const message =
    sessions === 2
      ? 'Two sessions in. One more to confirm it.'
      : "Good work. You're building this skill.";

  const subtext =
    sessions === 2
      ? "You're close. Come back tomorrow."
      : 'Come back tomorrow to keep going.';

  const subNote =
    sessions === 2
      ? 'One more session confirms mastery.'
      : 'Each session makes the skill stronger.';

  // ── Styles ────────────────────────────────────────────────────────────────

  const circleBase = {
    width:        18,
    height:       18,
    borderRadius: '50%' as const,
    flexShrink:   0,
  } as const;

  const circleFilled = {
    ...circleBase,
    background: C.green,
  } as const;

  const circleEmpty = {
    ...circleBase,
    background:  'transparent',
    border:      `2px solid ${C.blueMid}`,
    boxSizing:   'border-box' as const,
  } as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background:      C.navy,
        minHeight:       '100vh',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             20,
        padding:         '32px 20px',
        fontFamily:      FONTS.ui,
      }}
    >
      {/* Standard label */}
      <div
        style={{
          fontSize:      10,
          color:         C.blueMid,
          textTransform: 'uppercase' as const,
          letterSpacing: 2,
          fontWeight:    700,
        }}
      >
        {standardCode} | {standard?.title ?? standardCode}
      </div>

      {/* Gogi */}
      <GogiAvatar size={80} state="engaged" />

      {/* Session label */}
      <div
        style={{
          fontSize:      10,
          fontWeight:    700,
          color:         C.blueMid,
          textTransform: 'uppercase' as const,
          letterSpacing: 2,
        }}
      >
        {sessionLabel}
      </div>

      {/* Progress indicator: 3 circles */}
      <div
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           8,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={circleFilled} />
          <div style={sessions >= 2 ? circleFilled : circleEmpty} />
          <div style={circleEmpty} />
        </div>
        <div
          style={{
            display:        'flex',
            gap:            16,
            justifyContent: 'center',
          }}
        >
          {['Session 1', 'Session 2', 'Session 3'].map((label) => (
            <div
              key={label}
              style={{
                fontSize:  10,
                color:     C.blueMid,
                width:     18,
                textAlign: 'center' as const,
                whiteSpace:'nowrap' as const,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Message card */}
      <div
        style={{
          background:  'rgba(255,255,255,0.08)',
          border:      '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12,
          padding:      '18px 24px',
          textAlign:    'center',
          maxWidth:     320,
        }}
      >
        <p
          style={{
            fontSize:   17,
            fontWeight: 700,
            color:      C.white,
            lineHeight: 1.5,
            margin:     '0 0 8px',
          }}
        >
          {message}
        </p>
        <p
          style={{
            fontSize:   15,
            color:      C.blueMid,
            lineHeight: 1.5,
            margin:     0,
          }}
        >
          {subtext}
        </p>
      </div>

      {/* Sub-note */}
      <p
        style={{
          fontSize: 13,
          color:    C.blueMid,
          margin:   0,
        }}
      >
        {subNote}
      </p>

      {/* Back to dashboard */}
      <button
        onClick={() => router.push('/dashboard/student')}
        style={{
          background:   C.blue,
          color:        C.white,
          border:       'none',
          borderRadius: 10,
          padding:      '12px 40px',
          fontSize:     14,
          fontWeight:   700,
          cursor:       'pointer',
          fontFamily:   FONTS.ui,
          marginTop:    4,
        }}
      >
        Back to dashboard →
      </button>
    </div>
  );
}

// ─── Page wrapper (Suspense required for useSearchParams) ─────────────────────

export default function ProgressPage() {
  return (
    <Suspense fallback={null}>
      <ProgressContent />
    </Suspense>
  );
}
