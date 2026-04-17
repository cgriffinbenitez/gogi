'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';

// ─── Validation ───────────────────────────────────────────────────────────────

function validatePromptResponse(text: string): boolean {
  const words     = text.trim().split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  return words >= 25 && sentences >= 2;
}

// ─── Session message ──────────────────────────────────────────────────────────

function getSessionMsg(n: number): string {
  if (n >= 3) return "Last session. You\u2019ve done this twice. This time write like you mean it \u2014 this is the skill confirming itself.";
  if (n >= 2) return "You\u2019re back. This time go deeper on each prompt. The more you connect to your own experience, the more the text will make sense.";
  return "The passage didn\u2019t connect because your brain didn\u2019t have a mental model for it yet. These 3 prompts will build one. Do the work \u2014 don\u2019t rush.";
}

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

// ─── Prompt card ─────────────────────────────────────────────────────────────

function PromptCard({
  number, label, question, value, onChange,
  isLocked, isComplete, isGreen,
}: {
  number: number; label: string; question: string;
  value: string; onChange: (v: string) => void;
  isLocked: boolean; isComplete: boolean; isGreen: boolean;
}) {
  const valid        = validatePromptResponse(value);
  const labelColor   = isGreen ? '#3B6D11' : '#BA7517';
  const activeBorder = isGreen ? '#3B6D11' : '#BA7517';
  const borderColor  = isComplete ? '#3B6D11' : isLocked ? '#CCCCCC' : activeBorder;
  const leftBorder   = isComplete ? `3px solid #3B6D11` : isLocked ? `1.5px solid #CCCCCC` : `3px solid ${activeBorder}`;
  const bg           = isComplete ? '#F6FBF0' : '#FFFFFF';

  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${borderColor}`,
      borderLeft: leftBorder,
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 10,
      opacity: isLocked ? 0.45 : 1,
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        PROMPT {number} — {label}
      </div>
      <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.55, marginBottom: 10 }}>
        {question}
      </div>
      {isComplete ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ color: '#3B6D11', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>
          <p style={{ fontSize: 12, color: C.dark, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{value}</p>
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked}
          placeholder="Write at least 3–4 sentences…"
          style={{
            background: C.light,
            border: `1px solid ${valid ? '#3B6D11' : '#CCCCCC'}`,
            borderRadius: 4,
            padding: '8px 10px',
            fontSize: 12.5,
            width: '100%',
            resize: 'none',
            minHeight: 80,
            fontFamily: FONTS.ui,
            color: C.dark,
            outline: 'none',
            boxSizing: 'border-box',
            cursor: isLocked ? 'not-allowed' : 'text',
            transition: 'border-color 0.15s',
          }}
        />
      )}
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
    'schema_deficit'
  );

  const shouldShow = !passageLoading || loadTimeout;

  // Prompt values
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');

  const v1 = validatePromptResponse(p1);
  const v2 = validatePromptResponse(p2);
  const v3 = validatePromptResponse(p3);

  // Sequential unlock: p2 unlocks after v1, p3 unlocks after v2
  const p2Locked = !v1;
  const p3Locked = !v1 || !v2;
  const allValid  = v1 && v2 && v3;

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
        console.error('[TeachSchema] init error:', err);
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
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id:               sessionId,
            student_id:               studentId,
            standard_id:              standardUuid,
            cognitive_skill_targeted: 'schema_building',
            intervention_type:        'schema_prompts',
            student_response:         [p1, p2, p3].join(' | '),
            mastery_achieved:         false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachSchema] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // ── Diagnostic trace ───────────────────────────────────────────────────────
  console.log('[Schema] authLoading:', authLoading);
  console.log('[Schema] user:', user?.id);
  console.log('[Schema] resolvedStudentId:', studentId || '(empty — students lookup pending)');
  console.log('[Schema] triggerQ:', triggerQ);
  console.log('[Schema] passageLoading:', passageLoading, '| loadTimeout:', loadTimeout);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }} className="teach-columns">

        {/* ── LEFT PANEL — Gogi Coaching ─────────────────────────────────── */}
        <div style={{ flex: '0 0 42%', borderRight: `1px solid ${C.border}`, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            GOGI COACHING
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">{getSessionMsg(sessionNum)}</GogiBubble>
          </div>

          {/* Why this fires — amber context panel */}
          <div style={{ background: C.amberLight, borderLeft: `3px solid ${C.amber}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              WHY THIS FIRES
            </div>
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 3 }}>
              Classification: schema_deficit → Layer 1
            </div>
            <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.5 }}>
              Root cause: no background knowledge to anchor the text. The passage felt random because your brain had nothing to connect it to.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              Don&rsquo;t just answer to get through it. The quality of what you write here determines how well the passage makes sense when you practice.
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

          {/* CTA */}
          <button
            onClick={handleCTA}
            disabled={!allValid || submitting}
            style={{ width: '100%', background: C.navy, color: C.white, border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700, cursor: allValid && !submitting ? 'pointer' : 'not-allowed', fontFamily: FONTS.ui, opacity: allValid && !submitting ? 1 : 0.4, transition: 'opacity 0.2s ease' }}
          >
            I&rsquo;ve built the context — Practice →
          </button>
          {!allValid && (
            <p style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
              Complete all 3 prompts to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL — 3 Prompts ───────────────────────────────────── */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
            SCHEMA BUILDING — 3 PROMPTS
          </div>
          <div style={{ fontSize: 12, color: C.gray, fontStyle: 'italic', marginBottom: 16 }}>
            Answer all 3 prompts fully. Your brain needs to do this work — not just read it.
          </div>

          <PromptCard
            number={1}
            label="PRIOR KNOWLEDGE"
            question="What do you already know about people who sacrifice something important for someone they love? Have you seen this in real life, in a story, or in your own family?"
            value={p1}
            onChange={setP1}
            isLocked={false}
            isComplete={v1 && !!(p2 || p3)}
            isGreen={false}
          />

          <PromptCard
            number={2}
            label="WORLD CONNECTION"
            question="Think of a story, film, song, or real situation where someone was put in a dangerous situation by someone more powerful. What happened? How did it make you feel?"
            value={p2}
            onChange={setP2}
            isLocked={p2Locked}
            isComplete={v2 && !!p3}
            isGreen={false}
          />

          <PromptCard
            number={3}
            label="BRIDGE TO TEXT"
            question="Based on what you just wrote — what do you predict the main character in this passage is feeling? What kind of situation do you think they are facing?"
            value={p3}
            onChange={setP3}
            isLocked={p3Locked}
            isComplete={v3}
            isGreen={true}
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
