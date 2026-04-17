'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { getTeachRoute } from '@/lib/classify/getTeachRoute';

// ─── Classification badge text ────────────────────────────────────────────────

const BADGE_TEXT: Record<string, string> = {
  // Layer 1 — Pre-reading
  schema_deficit:                      'Layer 1 classification  |  Schema support needed',
  no_metacognitive_strategy:           'Layer 1 classification  |  Strategy support needed',
  no_theme_schema:                     'Layer 1 classification  |  Schema support needed',
  no_struct_schema:                    'Layer 1 classification  |  Schema support needed',
  // Layer 2 — During reading
  vocabulary_gap:                      'Layer 2 classification  |  Vocabulary support needed',
  morphology_gap:                      'Layer 2 classification  |  Word structure support needed',
  syntax_barrier:                      'Layer 2 classification  |  Word structure support needed',
  signal_word_blind:                   'Layer 2 classification  |  Word structure support needed',
  // Layer 3 — After reading
  inferencing_deficit:                 'Layer 3 classification  |  Inferencing support needed',
  abstract_reasoning_deficit:          'Layer 3 classification  |  Inferencing support needed',
  theme_confusion:                     'Layer 3 classification  |  Inferencing support needed',
  literal_misreading:                  'Layer 3 classification  |  Inferencing support needed',
  concrete_thinking:                   'Layer 3 classification  |  Inferencing support needed',
  evidence_retrieval_failure:          'Layer 3 classification  |  Evidence support needed',
  theme_evidence_disconnection:        'Layer 3 classification  |  Evidence support needed',
  comprehension_integration_failure:   'Layer 3 classification  |  Analysis support needed',
  purpose_failure:                     'Layer 3 classification  |  Analysis support needed',
};

function badgeText(classification: string): string {
  return BADGE_TEXT[classification] ?? 'Layer 2 classification  |  Vocabulary support needed';
}

function teachRoute(standardId: string, classification: string): string {
  return `/standard/${standardId}/teach/${getTeachRoute(classification)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BridgePage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [classification, setClassification] = useState<string>('vocabulary_gap');
  const [showButton, setShowButton] = useState(false);

  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();

        // Get student record
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!student?.id) return; // stay on vocabulary_gap default

        // Get standard UUID
        const { data: std } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();

        if (!std?.id) return;

        // Read dominant_classification from most recent session
        // NOTE: sessions table requires a `dominant_classification text` column.
        //   ALTER TABLE sessions ADD COLUMN dominant_classification text;
        const { data: session } = await supabase
          .from('sessions')
          .select('dominant_classification')
          .eq('student_id', student.id)
          .eq('standard_id', std.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const cls = (session as { dominant_classification?: string | null } | null)
          ?.dominant_classification;
        if (cls) setClassification(cls);
      } catch (err) {
        console.error('[Bridge] init error:', err);
      }
    }

    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // Show button after 2-second delay
  useEffect(() => {
    const t = setTimeout(() => setShowButton(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        background: C.navy,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '40px 20px',
        fontFamily: FONTS.ui,
      }}
    >
      {/* 1 — Small label */}
      <div
        style={{
          fontSize: 10,
          color: C.blueMid,
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        DIAGNOSTIC COMPLETE  |  {standardCode}
      </div>

      {/* 2 — Gogi avatar */}
      <GogiAvatar size={90} state="engaged" />

      {/* 3 — Message card */}
      <div
        style={{
          background: C.darkCard,
          border: `1px solid ${C.darkBorder}`,
          borderRadius: 14,
          padding: '20px 24px',
          textAlign: 'center',
          maxWidth: 320,
          width: '100%',
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: C.white,
            lineHeight: 1.4,
            marginBottom: 10,
          }}
        >
          Got it. Let me show you something.
        </div>
        <div style={{ fontSize: 13, color: C.blueMid, lineHeight: 1.6 }}>
          I can see exactly where you got stuck.
          <br />
          There&rsquo;s a specific move that unlocks this every time.
        </div>
      </div>

      {/* 4 — Classification badge */}
      <div
        style={{
          background: C.darkMuted,
          border: `0.5px solid rgba(255,255,255,0.2)`,
          borderRadius: 8,
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: C.amber,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: C.blueMid }}>
          {badgeText(classification)}
        </span>
      </div>

      {/* 5 — Show me button (delayed 2s) */}
      <div style={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>
        {showButton && (
          <button
            onClick={() => router.push(teachRoute(standardId, classification))}
            style={{
              background: C.blue,
              color: C.white,
              border: 'none',
              borderRadius: 10,
              padding: '13px 48px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONTS.ui,
            }}
          >
            Show me  →
          </button>
        )}
      </div>

      {/* 6 — No score warning bar */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `0.5px solid ${C.darkBorder}`,
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 11,
          color: '#FAC775',
          maxWidth: 320,
          width: '100%',
          textAlign: 'center',
        }}
      >
        ⚠&nbsp; No score shown. No &ldquo;You got 1/3 correct.&rdquo; Ever.
      </div>

      {/* Standard title (subtle, below warning) */}
      {standard && (
        <div style={{ fontSize: 11, color: 'rgba(181,212,244,0.45)', letterSpacing: 0.5 }}>
          {standard.title}
        </div>
      )}
    </div>
  );
}
