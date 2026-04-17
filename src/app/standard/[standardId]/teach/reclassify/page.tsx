'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { C, FONTS } from '@/lib/constants/design';
import { getTeachRoute } from '@/lib/classify/getTeachRoute';

// ─── Classification maps ──────────────────────────────────────────────────────

const PLAIN_NAMES: Record<string, string> = {
  schema_deficit:                    'Schema Building',
  no_metacognitive_strategy:         'Reading Strategy',
  vocabulary_gap:                    'Vocabulary Support',
  morphology_gap:                    'Word Structure',
  syntax_barrier:                    'Sentence Structure',
  inferencing_deficit:               'Inferencing Scaffold',
  evidence_retrieval_failure:        'Evidence Organizer',
  comprehension_integration_failure: 'Synthesis Scaffold',
};

const LAYER_NUM: Record<string, number> = {
  schema_deficit:                    1,
  no_metacognitive_strategy:         1,
  vocabulary_gap:                    2,
  morphology_gap:                    2,
  syntax_barrier:                    2,
  inferencing_deficit:               3,
  evidence_retrieval_failure:        3,
  comprehension_integration_failure: 3,
};

function plainName(cls: string): string {
  return PLAIN_NAMES[cls] ?? cls;
}

function layerNum(cls: string): number {
  return LAYER_NUM[cls] ?? 2;
}

// ─── Dot helper ───────────────────────────────────────────────────────────────

function Dot({ color, border }: { color: string; border: string }) {
  return (
    <div
      style={{
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   color,
        border:       `1.5px solid ${border}`,
        flexShrink:   0,
        marginTop:    2,
      }}
    />
  );
}

// ─── Inner component (reads search params) ────────────────────────────────────

function ReclassifyContent() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');

  const fromCls  = searchParams.get('from')    ?? '';
  const toCls    = searchParams.get('to')      ?? '';
  const count    = parseInt(searchParams.get('count') ?? '1', 10);
  const flagged  = searchParams.get('flagged') === 'true';

  const [showButton, setShowButton] = useState(false);

  // Show continue button after 2-second delay
  useEffect(() => {
    if (flagged) return; // teacher-flag mode has no delayed button
    const t = setTimeout(() => setShowButton(true), 2000);
    return () => clearTimeout(t);
  }, [flagged]);

  // ── TEACHER FLAG MODE ────────────────────────────────────────────────────────

  if (flagged) {
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
          textAlign:       'center',
        }}
      >
        {/* Label */}
        <div
          style={{
            fontSize:      10,
            fontWeight:    700,
            color:         C.blueMid,
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {standardCode}  |  Teacher Notified
        </div>

        <GogiAvatar size={80} state="engaged" />

        {/* Message card */}
        <div
          style={{
            background:   C.darkCard,
            border:       `1px solid ${C.darkBorder}`,
            borderRadius: 14,
            padding:      '20px 24px',
            maxWidth:     340,
          }}
        >
          <div
            style={{
              fontSize:     18,
              fontWeight:   700,
              color:        C.white,
              marginBottom: 8,
              lineHeight:   1.4,
            }}
          >
            You&rsquo;ve worked hard on this.
          </div>
          <div style={{ fontSize: 13, color: C.blueMid, lineHeight: 1.6 }}>
            Your teacher has been notified to check in with you personally.
            Keep going — they&rsquo;ll be with you soon.
          </div>
        </div>

        {/* Back to dashboard */}
        <button
          onClick={() => router.push('/dashboard/student')}
          style={{
            background:   'rgba(255,255,255,0.12)',
            color:        C.white,
            border:       `1px solid ${C.darkBorder}`,
            borderRadius: 10,
            padding:      '12px 32px',
            fontSize:     14,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   FONTS.ui,
            marginTop:    4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
        >
          Back to dashboard →
        </button>
      </div>
    );
  }

  // ── NORMAL RECLASSIFICATION MODE ─────────────────────────────────────────────

  return (
    <div
      style={{
        background:     C.navy,
        minHeight:      '100vh',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            20,
        padding:        '32px 20px',
        fontFamily:     FONTS.ui,
        textAlign:      'center',
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize:      10,
          fontWeight:    700,
          color:         C.blueMid,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        RECLASSIFYING  |  {standardCode}
      </div>

      <GogiAvatar size={80} state="engaged" />

      {/* Message card */}
      <div
        style={{
          background:   C.darkCard,
          border:       `1px solid ${C.darkBorder}`,
          borderRadius: 14,
          padding:      '20px 24px',
          maxWidth:     340,
          width:        '100%',
        }}
      >
        <div
          style={{
            fontSize:     18,
            fontWeight:   700,
            color:        C.white,
            marginBottom: 8,
            lineHeight:   1.4,
          }}
        >
          That path didn&rsquo;t get us there. That&rsquo;s okay.
        </div>
        <div style={{ fontSize: 13, color: C.blueMid, lineHeight: 1.6 }}>
          It means I need to look closer. I found something.
        </div>
      </div>

      {/* Turn log card */}
      <div
        style={{
          background:   C.darkMuted,
          border:       `1px solid ${C.darkBorder}`,
          borderRadius: 10,
          padding:      '14px 18px',
          maxWidth:     340,
          width:        '100%',
          textAlign:    'left',
        }}
      >
        {/* What we tried */}
        <div
          style={{
            fontSize:      9,
            fontWeight:    700,
            color:         C.blueMid,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom:  8,
          }}
        >
          WHAT WE TRIED
        </div>

        {[1, 2, 3].map((turn) => (
          <div
            key={turn}
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          8,
              marginBottom: 6,
              fontSize:     12,
              color:        C.blueMid,
            }}
          >
            <Dot color={C.amber} border={C.amber} />
            <span>
              Turn {turn}: {plainName(fromCls)} → not yet mastered
            </span>
          </div>
        ))}

        {/* Divider */}
        <div
          style={{
            height:  1,
            background: 'rgba(255,255,255,0.10)',
            margin:  '10px 0',
          }}
        />

        {/* New direction */}
        <div
          style={{
            fontSize:      9,
            fontWeight:    700,
            color:         C.greenBorder,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom:  6,
          }}
        >
          NEW DIRECTION
        </div>
        <div
          style={{
            display:    'flex',
            alignItems: 'flex-start',
            gap:        8,
            fontSize:   12,
            color:      C.white,
          }}
        >
          <Dot color={C.green} border={C.greenBorder} />
          <span>Routing to: {plainName(toCls)}</span>
        </div>
      </div>

      {/* Classification badge */}
      <div
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          8,
          background:   C.darkCard,
          border:       `1px solid ${C.darkBorder}`,
          borderRadius: 20,
          padding:      '6px 14px',
          fontSize:     12,
          color:        C.blueMid,
        }}
      >
        <Dot color={C.blue} border={C.blueMid} />
        Layer {layerNum(toCls)} — {plainName(toCls)}
        {count > 1 && (
          <span style={{ color: C.amber, marginLeft: 4 }}>
            (reclassification {count})
          </span>
        )}
      </div>

      {/* Continue button — appears after 2s delay */}
      {showButton && (
        <button
          onClick={() =>
            router.push(`/standard/${standardId}/teach/${getTeachRoute(toCls)}`)
          }
          style={{
            background:   C.blue,
            color:        C.white,
            border:       'none',
            borderRadius: 10,
            padding:      '13px 48px',
            fontSize:     15,
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   FONTS.ui,
            transition:   'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#2563A8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.blue; }}
        >
          Continue →
        </button>
      )}
    </div>
  );
}

// ─── Page wrapper — required for useSearchParams in Next.js 15 ────────────────

export default function ReclassifyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background:     C.navy,
            minHeight:      '100vh',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontFamily:     FONTS.ui,
          }}
        >
          <p style={{ color: C.blueMid, fontSize: 14 }}>Loading…</p>
        </div>
      }
    >
      <ReclassifyContent />
    </Suspense>
  );
}
