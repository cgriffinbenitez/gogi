'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { SchemaCard } from '@/components/schema/SchemaCard';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';
import type { SchemaPayload } from '@/lib/schema/types';

// ─── Nav ──────────────────────────────────────────────────────────────────────

function TeachNav({ standardCode }: { standardCode: string }) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  return (
    <nav style={{ background: C.navy, height: 52, width: '100%', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TEACH PHASE  |  LAYER 1  |  SCHEMA BUILDING
        </div>
        {standard && <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{standard.title}</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: FONTS.passage, letterSpacing: '-0.5px' }}>GOGI</div>
    </nav>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function SchemaLoadingScreen() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.white }}>
      <GogiAvatar size={48} state="engaged" />
      <p style={{ color: C.gray, fontSize: 13, textAlign: 'center', marginTop: 12 }}>
        Building your schema support…
      </p>
      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.blueMid, animation: `dot-pulse 1.4s ease-in-out ${i * 0.16}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachSchemaPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [studentId,    setStudentId]    = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId,    setSessionId]    = useState('');

  // Schema state
  const [schemaPayload,        setSchemaPayload]        = useState<SchemaPayload | null>(null);
  const [schemaInterventionId, setSchemaInterventionId] = useState<string | null>(null);
  const [schemaLoading,        setSchemaLoading]        = useState(false);
  const [schemaError,          setSchemaError]          = useState(false);

  // Single source of truth — trigger question (classification: schema_deficit)
  const { data: triggerQ, loading: triggerLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    'schema_deficit'
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();

        const { data: studentRow } = await supabase.from('students').select('id').eq('user_id', user!.id).maybeSingle();
        const sid = studentRow?.id ?? '';
        setStudentId(sid);

        const { data: std } = await supabase.from('standards').select('id').eq('code', standardCode).maybeSingle();
        if (!std?.id) return;
        setStandardUuid(std.id);

        if (sid) {
          const { data: session } = await supabase
            .from('sessions')
            .select('id')
            .eq('student_id', sid)
            .eq('standard_id', std.id)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (session?.id) setSessionId(session.id);
        }
      } catch (err) {
        console.error('[TeachSchema] init error:', err);
      }
    }

    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // Generate second-pass schema card once trigger question and session are ready
  useEffect(() => {
    if (!triggerQ?.questionId || !sessionId || !studentId || !standardUuid) return;
    if (schemaPayload || schemaLoading) return; // already done

    setSchemaLoading(true);

    fetch('/api/schema/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        studentId,
        questionId:          triggerQ.questionId,
        standardId:          standardUuid,
        standardCode,
        schemaModeOverride:  'context_builder', // second-pass always uses deeper mode
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('schema generate failed');
        const data = await res.json() as { payload?: SchemaPayload; interventionId?: string };
        if (data.payload) {
          setSchemaPayload(data.payload);
          setSchemaInterventionId(data.interventionId ?? null);
        } else {
          setSchemaError(true);
        }
      })
      .catch((err) => {
        console.error('[TeachSchema] schema generate error:', err);
        setSchemaError(true);
      })
      .finally(() => setSchemaLoading(false));
  }, [triggerQ?.questionId, sessionId, studentId, standardUuid, standardCode, schemaPayload, schemaLoading]);

  const isLoading = triggerLoading || schemaLoading || (!schemaPayload && !schemaError);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} />

      {isLoading && <SchemaLoadingScreen />}

      {!isLoading && schemaError && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: C.red, fontSize: 14 }}>Could not load schema support. Please try again.</p>
          <button
            onClick={() => router.push(`/standard/${standardId}/practice`)}
            style={{ background: C.navy, color: C.white, border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui }}
          >
            Skip to Practice →
          </button>
        </div>
      )}

      {!isLoading && schemaPayload && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SchemaCard
            payload={schemaPayload}
            interventionId={schemaInterventionId}
            studentId={studentId}
            onUnlock={() => router.push(`/standard/${standardId}/practice`)}
            introMessage="The passage needs more context before it clicks. Let's build a stronger foundation."
          />
        </div>
      )}
    </div>
  );
}
