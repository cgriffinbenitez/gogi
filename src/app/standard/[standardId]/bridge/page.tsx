'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { getTeachRoute } from '@/lib/classify/getTeachRoute';
import { ELA9R11_MISCONCEPTIONS } from '@/lib/diagnostic/ela9r11';

// ─── Classification badge text ────────────────────────────────────────────────

// Sprint O — 13 canonical codes mapped to badge text shown after diagnostic
const BADGE_TEXT: Record<string, string> = {
  // Layer 1 — Pre-reading
  no_metacognitive_strategy: 'Layer 1  |  Reading strategy needed',
  schema_deficit: 'Layer 1  |  Background knowledge needed',
  // Layer 2 — During reading
  vocabulary_gap: 'Layer 2  |  Vocabulary support needed',
  morphology_gap: 'Layer 2  |  Word structure support needed',
  syntax_barrier: 'Layer 2  |  Sentence structure support needed',
  figurative_language_failure: 'Layer 2  |  Figurative language support needed',
  // Layer 3 — After reading
  mood_misreading: 'Layer 3  |  Mood identification needed',
  tone_misreading: 'Layer 3  |  Tone identification needed',
  inferencing_literal: 'Layer 3  |  Inferencing support needed',
  inferencing_schema: 'Layer 3  |  Inferencing support needed',
  inferencing_wm: 'Layer 3  |  Inferencing support needed',
  topic_vs_theme_confusion: 'Layer 3  |  Theme building support needed',
  evidence_retrieval_failure: 'Layer 3  |  Evidence support needed',
  structure_purpose_disconnect: 'Layer 3  |  Structure analysis support needed',
  comprehension_integration_failure: 'Layer 3  |  Analysis support needed',
};

function badgeText(classification: string): string {
  if (classification in ELA9R11_MISCONCEPTIONS) {
    const spec = ELA9R11_MISCONCEPTIONS[classification as keyof typeof ELA9R11_MISCONCEPTIONS];
    return `9.R.1.1  |  ${spec.label}`;
  }

  return BADGE_TEXT[classification] ?? 'Layer 2  |  Vocabulary support needed';
}

function teachRoute(standardId: string, classification: string): string {
  if (standardId.replace(/-/g, '.') === 'ELA.9.R.1.1') {
    return `/standard/${standardId}/intervention`;
  }

  return `/standard/${standardId}/teach/${getTeachRoute(classification)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BridgePage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [classification, setClassification] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showButton, setShowButton] = useState(false);

  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function init() {
      try {
        const supabase = createClient();

        // Get student record
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (!student?.id) {
          console.error('[bridge] student record not found for current user');
          setStatus('error');
          return;
        }

        // Get standard UUID
        const { data: std } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();

        if (!std?.id) {
          console.error('[bridge] standard not found:', standardCode);
          setStatus('error');
          return;
        }

        // Read dominant_classification from most recent completed diagnostic session.
        // Filter on phase + status so in-progress or non-diagnostic sessions are ignored.
        // Sort by completed_at so seeded sessions (which may have older started_at) are found correctly.
        const { data: session } = await supabase
          .from('sessions')
          .select('dominant_classification')
          .eq('student_id', student.id)
          .eq('standard_id', std.id)
          .eq('phase', 'diagnostic')
          .eq('status', 'complete')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const cls = (session as { dominant_classification?: string | null } | null)
          ?.dominant_classification;

        if (cls) {
          setClassification(cls);
          setStatus('ready');
        } else {
          console.error(
            '[bridge] no completed diagnostic session found, or dominant_classification is null'
          );
          setStatus('error');
        }
      } catch (err) {
        console.error('[bridge] init error:', err);
        setStatus('error');
      }
    }

    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // Show button after 2-second delay
  useEffect(() => {
    const t = setTimeout(() => setShowButton(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // ── Error state ───────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div
        style={{
          background: C.navy,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.ui,
        }}
      >
        <div style={{ maxWidth: 320, textAlign: 'center', padding: 24 }}>
          <p style={{ color: C.white, fontSize: 15, lineHeight: 1.6 }}>
            We couldn&rsquo;t load your diagnostic results. Please tell your teacher.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading state (classification not yet resolved) ───────────────────────────
  if (status === 'loading' || classification === null) {
    return (
      <div
        style={{
          background: C.navy,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.ui,
        }}
      >
        <p style={{ color: C.blueMid, fontSize: 13 }}>Loading your diagnostic…</p>
      </div>
    );
  }

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
        DIAGNOSTIC COMPLETE | {standardCode}
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
          Got it. I found today&apos;s Reading Win.
        </div>
        <div style={{ fontSize: 13, color: C.blueMid, lineHeight: 1.6 }}>
          I can see the one move to practice next.
          <br />
          We&apos;ll keep it small: learn it, try it, prove it.
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
        <span style={{ fontSize: 12, color: C.blueMid }}>{badgeText(classification)}</span>
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
            Start my Reading Win →
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
        No score shown. This is about the next move, not a grade.
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
