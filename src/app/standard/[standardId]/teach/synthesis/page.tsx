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
  return "This is the hardest move in ELA. Not because it\u2019s confusing \u2014 because it has 5 parts. Let me show you.";
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function TeachNav({ standardCode }: { standardCode: string }) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  return (
    <nav style={{ background: C.navy, height: 52, width: '100%', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.greenBorder, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TEACH PHASE  |  LAYER 3  |  SYNTHESIS
        </div>
        {standard && <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{standard.title}</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: FONTS.passage, letterSpacing: '-0.5px' }}>GOGI</div>
    </nav>
  );
}

// ─── Box number circle ────────────────────────────────────────────────────────

function BoxNum({ n }: { n: number }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.navy, color: C.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {n}
    </div>
  );
}

// ─── Synthesis box ────────────────────────────────────────────────────────────

function SynthBox({
  number, label, starter, value, onChange, isLocked, isHighlight, children,
}: {
  number: number; label: string; starter: string;
  value: string; onChange: (v: string) => void;
  isLocked: boolean; isHighlight: boolean;
  children?: React.ReactNode;
}) {
  const valid = validateResponse(value);
  const bg      = isHighlight ? '#F0FAF0' : C.white;
  const border  = isHighlight ? `2px solid ${C.green}` : `1px solid ${C.border}`;
  return (
    <div style={{ background: bg, border, borderRadius: 8, padding: '12px 14px', marginBottom: 8, opacity: isLocked ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <BoxNum n={number} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{label}</span>
        {isHighlight && <span style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1 }}>KEY BOX</span>}
      </div>
      <p style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', margin: '0 0 6px' }}>{starter}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLocked}
        placeholder={`${starter} …`}
        style={{ background: C.light, border: `1px solid ${valid && !isLocked ? C.green : isLocked ? C.border : C.blueMid}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5, width: '100%', resize: 'none', minHeight: isHighlight ? 72 : 56, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box', cursor: isLocked ? 'not-allowed' : 'text', transition: 'border-color 0.15s' }}
      />
      {children}
    </div>
  );
}

// ─── AI analysis grader ───────────────────────────────────────────────────────

async function gradeAnalysis(text: string): Promise<boolean> {
  try {
    const res = await fetch('/api/vocab/define', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: text,
        passageContext: 'Evaluate if this is genuine ANALYSIS (explains WHY evidence proves the theme — makes a logical connection to human experience or meaning) or DESCRIPTION (just restates the evidence without explaining why it matters). Respond with only one word: ANALYSIS or DESCRIPTION',
      }),
    });
    if (!res.ok) return true; // fail open
    const data = await res.json() as { definition?: string };
    return String(data.definition ?? '').toUpperCase().includes('ANALYSIS');
  } catch {
    return true; // fail open — don't block student if API unavailable
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachSynthesisPage() {
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

  // Passage reference panel
  const [showPassage, setShowPassage] = useState(false);

  // Single source of truth — trigger question
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    'comprehension_integration_failure'
  );

  // Box values
  const [b1, setB1] = useState('');
  const [b2, setB2] = useState('');
  const [b3, setB3] = useState('');
  const [b4, setB4] = useState('');
  const [b5, setB5] = useState('');

  // Box 4 AI grading state
  const [b4Grading,  setB4Grading]  = useState(false);
  const [b4Attempts, setB4Attempts] = useState(0);
  const [b4GogMsg,   setB4GogMsg]   = useState<string | null>(null);
  const [b4Passed,   setB4Passed]   = useState(false);

  const v1 = validateResponse(b1);
  const v2 = validateResponse(b2);
  const v3 = validateResponse(b3);
  const v4 = validateResponse(b4);
  const v5 = validateResponse(b5);

  // Sequential unlock logic
  const box2Locked = !v1;
  const box3Locked = !v1 || !v2;
  const box4Locked = !v1 || !v2 || !v3;
  const box5Locked = !b4Passed && b4Attempts < 3;
  const allValid   = v1 && v2 && v3 && v4 && v5 && (b4Passed || b4Attempts >= 3);

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
        console.error('[TeachSynthesis] init error:', err);
      }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // Box 4 auto-grade when it gets a valid response and isn't locked or already passed
  async function handleB4Blur() {
    if (!v4 || box4Locked || b4Passed || b4Grading) return;
    if (b4Attempts >= 3) { setB4Passed(true); return; } // max attempts — pass through

    setB4Grading(true);
    const isAnalysis = await gradeAnalysis(b4);
    setB4Grading(false);

    if (isAnalysis) {
      setB4Passed(true);
      setB4GogMsg(null);
    } else {
      const newAttempts = b4Attempts + 1;
      setB4Attempts(newAttempts);
      if (newAttempts >= 3) {
        setB4Passed(true); // max attempts reached — unlock box 5
        setB4GogMsg(null);
      } else {
        setB4GogMsg("That restates the evidence. Now explain WHY it proves the theme — what does it tell us about human nature?");
        setB4(''); // clear for retry
      }
    }
  }

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
            cognitive_skill_targeted: 'comprehension_integration',
            intervention_type: 'synthesis_scaffold',
            student_response: [b1, b2, b3, b4, b5].join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachSynthesis] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

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

          <div style={{ background: C.greenLight, borderLeft: `3px solid ${C.green}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 3 — AFTER READING
            </div>
            <div style={{ fontSize: 13, color: C.green, marginBottom: 2 }}>
              Classification: comprehension_integration_failure → Layer 3
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>
              Root cause: cannot synthesize literary elements into a unified analytical claim.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="celebrate" />
            <GogiBubble state="celebrate">
              Each box has a sentence starter. Use it. You can revise after. The structure is the scaffold.
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
                  {passageLoading
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
              Complete all 5 boxes to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            LITERARY ANALYSIS PARAGRAPH — 5 BOXES
          </div>

          <SynthBox number={1} label="Universal theme statement" starter="The author suggests that…" value={b1} onChange={setB1} isLocked={false} isHighlight={false} />
          <SynthBox number={2} label="Literary element" starter="The author develops this theme through…" value={b2} onChange={setB2} isLocked={box2Locked} isHighlight={false} />
          <SynthBox number={3} label="Textual evidence" starter="For example, in the text,…" value={b3} onChange={setB3} isLocked={box3Locked} isHighlight={false} />

          {/* Box 4 — AI graded */}
          <div style={{ background: '#F0FAF0', border: `2px solid ${C.green}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, opacity: box4Locked ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <BoxNum n={4} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>Analysis</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1 }}>KEY BOX</span>
              {b4Grading && <span style={{ fontSize: 10, color: C.gray, fontStyle: 'italic' }}>checking…</span>}
              {b4Passed && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✓ Strong analysis</span>}
            </div>
            <p style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', margin: '0 0 6px' }}>This demonstrates the theme because…</p>
            <textarea
              value={b4}
              onChange={(e) => setB4(e.target.value)}
              onBlur={handleB4Blur}
              disabled={box4Locked || b4Passed}
              placeholder="This demonstrates the theme because…"
              style={{ background: C.light, border: `1px solid ${b4Passed ? C.green : C.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5, width: '100%', resize: 'none', minHeight: 72, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box', cursor: box4Locked || b4Passed ? 'not-allowed' : 'text', transition: 'border-color 0.15s' }}
            />
            {b4GogMsg && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                <GogiAvatar size={28} state="engaged" />
                <GogiBubble state="engaged">{b4GogMsg}</GogiBubble>
              </div>
            )}
            {!box4Locked && !b4Passed && b4Attempts < 3 && (
              <p style={{ fontSize: 10, color: C.gray, fontStyle: 'italic', marginTop: 4 }}>
                Tab or click away when ready — Gogi will check your analysis.
                {b4Attempts > 0 && ` (attempt ${b4Attempts + 1} of 3)`}
              </p>
            )}
          </div>

          {/* Box 5 */}
          <SynthBox number={5} label="Real-world connection" starter="This theme applies beyond the text because…" value={b5} onChange={setB5} isLocked={box5Locked} isHighlight={true} />
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
