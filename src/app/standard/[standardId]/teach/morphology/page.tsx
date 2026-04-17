'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getDefinition } from '@/lib/vocab/getDefinition';
import { validateResponse } from '@/lib/validation/validateResponse';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';

// ─── Session message ──────────────────────────────────────────────────────────

function getSessionMsg(n: number): string {
  if (n >= 3) return "Last session. Let\u2019s confirm it\u2019s yours.";
  if (n >= 2) return "You worked on this before. Let\u2019s go deeper.";
  return "The word is not random. It\u2019s built from parts \u2014 and the parts give you the meaning. Let me show you.";
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function TeachNav({ standardCode }: { standardCode: string }) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  return (
    <nav style={{ background: C.navy, height: 52, width: '100%', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blueMid, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TEACH PHASE  |  LAYER 2  |  WORD STRUCTURE
        </div>
        {standard && <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{standard.title}</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: FONTS.passage, letterSpacing: '-0.5px' }}>GOGI</div>
    </nav>
  );
}

// ─── Morpheme box ─────────────────────────────────────────────────────────────

function MorphemeBox({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div style={{ flex: 1, border: `1.5px solid ${C.blueMid}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="—"
        style={{ width: '100%', background: C.light, border: `1px solid ${C.blueMid}`, borderRadius: 4, padding: '4px 6px', fontSize: 14, fontWeight: 700, color: C.navy, fontFamily: FONTS.passage, textAlign: 'center', outline: 'none', boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'text' }}
      />
    </div>
  );
}

// ─── Practice word row ────────────────────────────────────────────────────────

function PracticeRow({
  word, prefix, onPrefix, root, onRoot, suffix, onSuffix, meaning, onMeaning, disabled,
}: {
  word: string; prefix: string; onPrefix: (v: string) => void;
  root: string; onRoot: (v: string) => void; suffix: string; onSuffix: (v: string) => void;
  meaning: string; onMeaning: (v: string) => void; disabled: boolean;
}) {
  const meanValid = validateResponse(meaning);
  return (
    <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, fontStyle: 'italic', fontFamily: FONTS.passage, marginBottom: 8 }}>{word}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {[['Prefix:', prefix, onPrefix], ['Root:', root, onRoot], ['Suffix:', suffix, onSuffix]].map(([lbl, val, fn]) => (
          <div key={String(lbl)} style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 2 }}>{lbl as string}</div>
            <input type="text" value={val as string} onChange={(e) => (fn as (v: string) => void)(e.target.value)} disabled={disabled}
              placeholder="—"
              style={{ width: '100%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', fontSize: 12, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 2 }}>Meaning (write what this word means):</div>
        <textarea
          value={meaning}
          onChange={(e) => onMeaning(e.target.value)}
          disabled={disabled}
          placeholder="Write the complete meaning of this word…"
          style={{ background: C.white, border: `1px solid ${meanValid ? C.green : C.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5, width: '100%', resize: 'none', minHeight: 48, fontFamily: FONTS.ui, color: C.dark, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachMorphologyPage() {
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

  // 5-second hard timeout — prevents infinite loading under all conditions
  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Word definition state
  const [wordDef,    setWordDef]    = useState('');
  const [defLoading, setDefLoading] = useState(true);

  // Main word morpheme boxes
  const [mainPrefix,  setMainPrefix]  = useState('');
  const [mainRoot,    setMainRoot]    = useState('');
  const [mainSuffix,  setMainSuffix]  = useState('');

  // Practice word 1
  const [p1prefix, setP1prefix] = useState('');
  const [p1root,   setP1root]   = useState('');
  const [p1suffix, setP1suffix] = useState('');
  const [p1mean,   setP1mean]   = useState('');

  // Practice word 2
  const [p2prefix, setP2prefix] = useState('');
  const [p2root,   setP2root]   = useState('');
  const [p2suffix, setP2suffix] = useState('');
  const [p2mean,   setP2mean]   = useState('');

  const p1MeanValid = validateResponse(p1mean);
  const p2MeanValid = validateResponse(p2mean);
  const allValid    = p1MeanValid && p2MeanValid;

  // Single source of truth — trigger question
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    'morphology_gap'
  );

  const shouldShow = !(passageLoading || defLoading) || loadTimeout;

  // Derive from triggerQ
  const targetWord   = triggerQ?.blockingWord ?? '';
  const practiceWord1 = triggerQ?.keywordFlags[1] ?? 'obscure';
  const practiceWord2 = triggerQ?.keywordFlags[2] ?? 'elegant';

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
        console.error('[TeachMorphology] init error:', err);
      }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // Fetch definition once triggerQ resolves
  useEffect(() => {
    if (!triggerQ?.blockingWord) {
      if (!passageLoading) setDefLoading(false);
      return;
    }
    setDefLoading(true);
    const context = triggerQ.passageText.slice(0, 400);
    getDefinition(triggerQ.blockingWord, context)
      .then((def) => { setWordDef(def?.definition ?? ''); setDefLoading(false); })
      .catch(() => setDefLoading(false));
  }, [triggerQ?.blockingWord, passageLoading]);

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
            cognitive_skill_targeted: 'morphological_awareness',
            intervention_type: 'morphology_breakdown',
            student_response: [mainPrefix, mainRoot, mainSuffix, p1mean, p2mean].filter(Boolean).join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachMorphology] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // ── Diagnostic trace ───────────────────────────────────────────────────────
  console.log('[Morphology] authLoading:', authLoading);
  console.log('[Morphology] user:', user?.id);
  console.log('[Morphology] resolvedStudentId:', studentId || '(empty — students lookup pending)');
  console.log('[Morphology] triggerQ:', triggerQ);
  console.log('[Morphology] passageLoading:', passageLoading, '| defLoading:', defLoading, '| loadTimeout:', loadTimeout);

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

          <div style={{ background: C.blueLight, borderLeft: `3px solid ${C.blue}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 2 — DURING READING
            </div>
            <div style={{ fontSize: 13, color: C.blue, marginBottom: 2 }}>
              Classification: morphology_gap → Layer 2
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>
              Root cause: word structure is blocking meaning — the parts are unknown.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              Now you can break ANY word like this. The parts don&rsquo;t change. They follow you everywhere.
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
              Complete both practice words to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            MORPHEME BREAKDOWN
          </div>

          {/* Target word */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              THE WORD IN THE PASSAGE
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontStyle: 'italic', fontFamily: FONTS.passage, color: C.navy, marginBottom: 10 }}>
              {targetWord || (passageLoading ? '…' : 'word')}
            </div>

            {/* 3 morpheme boxes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <MorphemeBox label="PREFIX" value={mainPrefix} onChange={setMainPrefix} disabled={false} />
              <span style={{ fontSize: 16, color: C.gray, flexShrink: 0 }}>+</span>
              <MorphemeBox label="ROOT" value={mainRoot} onChange={setMainRoot} disabled={false} />
              <span style={{ fontSize: 16, color: C.gray, flexShrink: 0 }}>+</span>
              <MorphemeBox label="SUFFIX" value={mainSuffix} onChange={setMainSuffix} disabled={false} />
            </div>

            {/* Reconstructed meaning */}
            <div style={{ background: C.blueLight, borderRadius: 6, padding: '10px 12px', fontSize: 12, color: C.dark, lineHeight: 1.5 }}>
              <strong style={{ color: C.navy }}>{targetWord || 'This word'}</strong>
              {' = '}
              {defLoading ? '…loading definition…' : (wordDef || 'Look at the parts you identified to reconstruct the meaning.')}
            </div>
          </div>

          {/* Practice section */}
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            PRACTICE — Break these words the same way
          </div>

          <PracticeRow
            word={practiceWord1}
            prefix={p1prefix} onPrefix={setP1prefix}
            root={p1root}     onRoot={setP1root}
            suffix={p1suffix} onSuffix={setP1suffix}
            meaning={p1mean}  onMeaning={setP1mean}
            disabled={false}
          />

          <PracticeRow
            word={practiceWord2}
            prefix={p2prefix} onPrefix={setP2prefix}
            root={p2root}     onRoot={setP2root}
            suffix={p2suffix} onSuffix={setP2suffix}
            meaning={p2mean}  onMeaning={setP2mean}
            disabled={false}
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
