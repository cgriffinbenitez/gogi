'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { validateResponse } from '@/lib/validation/validateResponse';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';

// ─── Session message ──────────────────────────────────────────────────────────

function getSessionMsg(n: number): string {
  if (n >= 3) return "Last session. Let\u2019s confirm it\u2019s yours.";
  if (n >= 2) return "You worked on this before. Let\u2019s go deeper.";
  return "The author didn\u2019t say it. They showed it.\nThat gap between what\u2019s written and what\u2019s meant \u2014 that\u2019s where the inference lives.";
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function TeachNav({ standardCode }: { standardCode: string }) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  const router = useRouter();
  const { role } = useAuth();
  function handleHomeClick() {
    router.push(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
  }
  return (
    <nav style={{ background: C.navy, height: 52, width: '100%', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.greenBorder, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TEACH PHASE  |  INFERENCING SCAFFOLD
        </div>
        {standard && <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{standard.title}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleHomeClick} style={{ fontSize: 11, color: 'rgba(181,212,244,0.5)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: FONTS.ui, transition: 'color 0.2s', padding: 0 }} onMouseEnter={e => { e.currentTarget.style.color = '#B5D4F4'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(181,212,244,0.5)'; }}>← Dashboard</button>
        <button onClick={handleHomeClick} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 6, transition: 'background 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }} title="Back to dashboard">
          <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: FONTS.passage, letterSpacing: '-0.5px' }}>GOGI</div>
        </button>
      </div>
    </nav>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function InferenceStep({
  number, label, instruction, starter, placeholder,
  value, onChange, isLocked, isCompleted,
}: {
  number: number; label: string; instruction: string; starter: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  isLocked: boolean; isCompleted: boolean;
}) {
  const valid = validateResponse(value);
  const borderColor = isCompleted ? C.green : isLocked ? C.border : C.green;
  const bg          = isCompleted ? '#F0FAF0' : isLocked ? C.white : '#F0FAF0';

  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10, opacity: isLocked ? 0.5 : 1, transition: 'border-color 0.15s, background 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: isCompleted ? C.green : C.navy, color: C.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isCompleted ? '✓' : number}
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, marginBottom: 8 }}>{instruction}</div>
      {isCompleted ? (
        <p style={{ fontSize: 12, color: C.dark, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{value}</p>
      ) : (
        <>
          {starter && (
            <p style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', margin: '0 0 4px' }}>{starter}</p>
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLocked}
            placeholder={placeholder}
            style={{ background: C.white, border: `1px solid ${valid ? C.green : C.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5, width: '100%', resize: 'none', minHeight: 64, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box', cursor: isLocked ? 'not-allowed' : 'text', transition: 'border-color 0.15s' }}
          />
        </>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachInferencingPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [studentId,    setStudentId]    = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId,    setSessionId]    = useState('');
  const [sessionNum,   setSessionNum]   = useState(1);
  const [submitting,   setSubmitting]   = useState(false);

  const [showPassage, setShowPassage] = useState(false);

  // 5-second hard timeout — prevents infinite loading under all conditions
  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Single source of truth — trigger question
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    'inferencing_deficit'
  );

  const shouldShow = !passageLoading || loadTimeout;

  const [step1, setStep1] = useState('');
  const [step2, setStep2] = useState('');
  const [step3, setStep3] = useState('');

  const v1 = validateResponse(step1);
  const v2 = validateResponse(step2);
  const v3 = validateResponse(step3);
  const allValid = v1 && v2 && v3;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();
        const { data: student } = await supabase.from('students').select('id').eq('user_id', user!.id).maybeSingle();
        const sid = student?.id ?? '';
        setStudentId(sid);

        const { data: std } = await supabase.from('standards').select('id').eq('code', standardCode).maybeSingle();
        if (!std?.id) return;
        setStandardUuid(std.id);

        if (sid) {
          const [{ data: session }, { data: progress }] = await Promise.all([
            supabase.from('sessions').select('id').eq('student_id', sid).eq('standard_id', std.id).order('started_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('standard_progress').select('sessions_attempted').eq('student_id', sid).eq('standard_id', std.id).maybeSingle(),
          ]);
          if (session?.id) setSessionId(session.id);
          const attempted = (progress as { sessions_attempted?: number } | null)?.sessions_attempted ?? 0;
          setSessionNum(Math.max(1, attempted + 1));
        }
      } catch (err) {
        console.error('[TeachInferencing] init error:', err);
      }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  async function handleCTA() {
    if (!allValid || submitting) return;
    setSubmitting(true);
    try {
      if (sessionId && studentId && standardUuid) {
        await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId, student_id: studentId, standard_id: standardUuid,
            cognitive_skill_targeted: 'inferencing',
            intervention_type: 'inferencing_scaffold',
            student_response: [step1, step2, step3].join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachInferencing] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // ── Diagnostic trace ───────────────────────────────────────────────────────
  console.log('[Inferencing] authLoading:', authLoading);
  console.log('[Inferencing] user:', user?.id);
  console.log('[Inferencing] resolvedStudentId:', studentId || '(empty — students lookup pending)');
  console.log('[Inferencing] triggerQ:', triggerQ);
  console.log('[Inferencing] passageLoading:', passageLoading, '| loadTimeout:', loadTimeout);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }} className="teach-columns">

        {/* ── LEFT PANEL ── */}
        <div style={{ flex: '0 0 42%', borderRight: `1px solid ${C.border}`, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            GOGI COACHING
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <GogiAvatar size={36} state="celebrate" />
            <GogiBubble state="celebrate">{getSessionMsg(sessionNum)}</GogiBubble>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="celebrate" />
            <GogiBubble state="celebrate">
              Use the 3 steps every time. Step 1 anchors you in the text. Step 2 is the leap. Step 3 is your proof.
            </GogiBubble>
          </div>

          {/* Passage Reference — collapsible */}
          <div style={{ marginTop: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#888780', marginBottom: 6 }}>
              Passage reference
            </div>
            <button
              onClick={() => setShowPassage(prev => !prev)}
              style={{ width: '100%', background: showPassage ? '#1F4E79' : '#F2F2F2', border: '1.5px solid', borderColor: showPassage ? '#1F4E79' : '#CCCCCC', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: showPassage ? '#fff' : '#2C2C2A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' as const, fontFamily: FONTS.ui }}
            >
              <span>{showPassage ? 'Hide the passage' : (triggerQ?.passageTitle || 'Show passage')}</span>
              <span style={{ fontSize: 11 }}>{showPassage ? '▲' : '▼'}</span>
            </button>
            {showPassage && (
              <div style={{ marginTop: 8, background: '#F8F8F8', borderLeft: '3px solid #CCCCCC', borderRadius: '0 6px 6px 0', padding: '12px 14px', maxHeight: 220, overflowY: 'auto' as const }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1F4E79', marginBottom: 2 }}>{triggerQ?.passageTitle}</div>
                <div style={{ fontSize: 10, color: '#888780', marginBottom: 8 }}>{triggerQ?.passageAuthor}</div>
                <div style={{ fontSize: 11, fontFamily: 'Georgia, serif', lineHeight: 1.6, color: '#2C2C2A' }}>
                  {!shouldShow
                    ? 'Loading…'
                    : (triggerQ?.passageText || 'Passage will appear here once the diagnostic is complete.')}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCTA}
            disabled={!allValid || submitting}
            style={{ width: '100%', background: C.navy, color: C.white, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700, cursor: allValid && !submitting ? 'pointer' : 'not-allowed', fontFamily: FONTS.ui, opacity: allValid && !submitting ? 1 : 0.4, transition: 'opacity 0.2s ease' }}
          >
            I&rsquo;ve got it — Practice →
          </button>
          {!allValid && (
            <p style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
              Complete all 3 steps to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
            INFERENCING SCAFFOLD — 3 STEPS
          </div>
          <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginBottom: 14 }}>
            Text → Inference → Evidence. Always in that order.
          </div>

          {/* Visual model */}
          <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              THE MODEL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: 'TEXT SAYS', eg: '"Her hands trembled."' },
                { label: 'IMPLIES', eg: 'She is afraid or nervous' },
                { label: 'PROOF', eg: 'The trembling = physical reaction to fear' },
              ].map((item, i) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ background: C.greenLight, border: `1px solid ${C.green}`, borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: C.dark, fontStyle: 'italic', marginTop: 2 }}>{item.eg}</div>
                  </div>
                  {i < 2 && <span style={{ fontSize: 16, color: C.gray }}>→</span>}
                </div>
              ))}
            </div>
          </div>

          <InferenceStep
            number={1} label="WHAT THE TEXT SAYS"
            instruction="Find the specific lines in the passage that relate to this question."
            starter=""
            placeholder="Copy or paraphrase the relevant lines from the passage…"
            value={step1} onChange={setStep1}
            isLocked={false} isCompleted={v1 && !!(step2 || step3)}
          />

          <InferenceStep
            number={2} label="WHAT IT IMPLIES"
            instruction="The author doesn't SAY this directly. What are they SUGGESTING?"
            starter="The author implies that…"
            placeholder="The author implies that…"
            value={step2} onChange={setStep2}
            isLocked={!v1} isCompleted={v2 && !!step3}
          />

          <InferenceStep
            number={3} label="HOW YOU KNOW"
            instruction="Explain the connection. What in the text makes you believe your inference?"
            starter="I know this because the text shows…"
            placeholder="I know this because the text shows…"
            value={step3} onChange={setStep3}
            isLocked={!v2} isCompleted={v3}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .teach-columns { flex-direction: column !important; }
          .teach-columns > div:first-child { flex: 0 0 auto !important; height: auto !important; border-right: none !important; border-bottom: 1px solid ${C.border}; }
          .teach-columns > div:last-child { flex: 1 !important; height: auto !important; }
        }
      `}</style>
    </div>
  );
}
