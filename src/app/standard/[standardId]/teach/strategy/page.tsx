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
  return "You don\u2019t have a system for attacking a text yet.\nI\u2019ll give you one. It takes 60 seconds.";
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
        <div style={{ fontSize: 9, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TEACH PHASE  |  LAYER 1  |  READING STRATEGY
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

// ─── Step card wrapper ────────────────────────────────────────────────────────

function StepCard({
  number, label, instruction, children, isCompleted, isLocked,
}: {
  number: number; label: string; instruction: string; children: React.ReactNode;
  isCompleted: boolean; isLocked: boolean;
}) {
  const borderColor = isCompleted ? C.green : isLocked ? C.border : C.amber;
  const bg          = isCompleted ? '#F0FAF0' : isLocked ? C.white : '#FFFDF8';
  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10, opacity: isLocked ? 0.5 : 1, transition: 'border-color 0.15s, background 0.15s' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        STEP {number} — {label}
      </div>
      <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, marginBottom: 8 }}>{instruction}</div>
      {isCompleted ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>✓</span>
          <span style={{ fontSize: 12, color: C.green, fontStyle: 'italic' }}>Completed</span>
        </div>
      ) : (
        <div style={{ pointerEvents: isLocked ? 'none' : 'auto' }}>{children}</div>
      )}
    </div>
  );
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function hasContent(s: string) { return s.trim().length > 0; }
function atLeast3Words(s: string) { return s.trim().split(/\s+/).filter(Boolean).length >= 3; }

function FieldInput({
  label, value, onChange, placeholder, disabled,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string; disabled: boolean; }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 3 }}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{ width: '100%', background: C.light, border: `1px solid ${C.blueMid}`, borderRadius: 4, padding: '5px 7px', fontSize: 12.5, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'text' }}
      />
    </div>
  );
}

function FieldTextarea({
  label, value, onChange, placeholder, disabled,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string; disabled: boolean; }) {
  return (
    <div>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 3 }}>{label}</div>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{ background: C.light, border: `1px solid ${C.blueMid}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5, width: '100%', resize: 'none', minHeight: 52, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'text', transition: 'border-color 0.15s' }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachStrategyPage() {
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
    'no_metacognitive_strategy'
  );

  const shouldShow = !passageLoading || loadTimeout;

  // Step 1 — 2 fields
  const [s1title, setS1title] = useState('');
  const [s1type,  setS1type]  = useState('');
  // Step 2 — 1 field
  const [s2goal, setS2goal] = useState('');
  // Step 3 — 3 short fields
  const [s3a, setS3a] = useState('');
  const [s3b, setS3b] = useState('');
  const [s3c, setS3c] = useState('');
  // Step 4 — 1 field
  const [s4q, setS4q] = useState('');

  const step1Done = hasContent(s1title) && hasContent(s1type);
  const step2Done = step1Done && validateResponse(s2goal);
  const step3Done = step2Done && atLeast3Words(s3a) && atLeast3Words(s3b) && atLeast3Words(s3c);
  const step4Done = step3Done && validateResponse(s4q);
  const allValid  = step4Done;

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
        console.error('[TeachStrategy] init error:', err);
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
            cognitive_skill_targeted: 'metacognitive_strategy',
            intervention_type: 'strategy_card',
            student_response: [s1title, s1type, s2goal, s3a, s3b, s3c, s4q].join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachStrategy] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // ── Diagnostic trace ───────────────────────────────────────────────────────
  console.log('[Strategy] authLoading:', authLoading);
  console.log('[Strategy] user:', user?.id);
  console.log('[Strategy] resolvedStudentId:', studentId || '(empty — students lookup pending)');
  console.log('[Strategy] triggerQ:', triggerQ);
  console.log('[Strategy] passageLoading:', passageLoading, '| loadTimeout:', loadTimeout);

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
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">{getSessionMsg(sessionNum)}</GogiBubble>
          </div>

          <div style={{ background: C.amberLight, borderLeft: `3px solid ${C.amber}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 1 — PRE-READING
            </div>
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 2 }}>
              Classification: no_metacognitive_strategy → Layer 1
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>
              Root cause: no reading strategy — approaching text without a plan.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              Do these 4 steps every time you see a new passage. Then read. Watch how different it feels.
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
            Apply to this passage →
          </button>
          {!allValid && (
            <p style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
              Complete all 4 steps to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
            4-STEP TEXT ATTACK STRATEGY
          </div>
          <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginBottom: 12 }}>
            SOAPSTone Model — use this every time
          </div>

          {/* Step 1 */}
          <StepCard number={1} label="PREVIEW" instruction="Look at the title. Read the first and last sentence only. What type of text is this?" isCompleted={step1Done} isLocked={false}>
            <div style={{ display: 'flex', gap: 8 }}>
              <FieldInput label="Title:" value={s1title} onChange={setS1title} placeholder="Write the title…" disabled={false} />
              <FieldInput label="Text type:" value={s1type} onChange={setS1type} placeholder="Story / Article / Poem…" disabled={false} />
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard number={2} label="PURPOSE" instruction="What does the question ask you to find? Write your reading goal in one sentence." isCompleted={step2Done} isLocked={!step1Done}>
            <FieldTextarea label="My reading goal:" value={s2goal} onChange={setS2goal} placeholder="I am reading to find out…" disabled={!step1Done} />
          </StepCard>

          {/* Step 3 */}
          <StepCard number={3} label="ANNOTATE" instruction="Name 3 things you will watch for as you read. What details matter for this type of question?" isCompleted={step3Done} isLocked={!step2Done}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldInput label="Watch for 1:" value={s3a} onChange={setS3a} placeholder="e.g. character emotions…" disabled={!step2Done} />
              <FieldInput label="Watch for 2:" value={s3b} onChange={setS3b} placeholder="e.g. repeated phrases…" disabled={!step2Done} />
              <FieldInput label="Watch for 3:" value={s3c} onChange={setS3c} placeholder="e.g. descriptive details…" disabled={!step2Done} />
            </div>
          </StepCard>

          {/* Step 4 */}
          <StepCard number={4} label="PAUSE AND CHECK" instruction="After each paragraph, ask yourself this one question. Write it now so you remember." isCompleted={step4Done} isLocked={!step3Done}>
            <FieldTextarea label="After each paragraph I will ask:" value={s4q} onChange={setS4q} placeholder="Write a question you'll ask yourself…" disabled={!step3Done} />
          </StepCard>
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
