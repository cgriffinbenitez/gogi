'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';
import {
  TeachNav, PassagePanel, MCVerification, MCOption,
  findHighlightRanges, minWords, detectFigureType,
  GogiAvatar, GogiBubble,
  TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';

// ─── Inline input style ───────────────────────────────────────────────────────

function inlineStyle(hasError: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    border: 'none',
    borderBottom: `2px solid ${hasError ? C.red : C.blue}`,
    background: 'transparent',
    fontSize: 13,
    fontFamily: FONTS.ui,
    color: C.dark,
    outline: 'none',
    padding: '1px 4px',
    width: 140,
    verticalAlign: 'baseline',
  };
}

// ─── MC options (fixed) ───────────────────────────────────────────────────────

const MC_OPTIONS: MCOption[] = [
  {
    text: 'To describe exactly what is happening in the scene',
    wrongFeedback: "That's a literal reading — the figure isn't describing reality. It's creating meaning beyond the literal. What emotional or intellectual effect does it have?",
  },
  {
    text: 'To create a deeper meaning by comparing two things, making the reader feel the connection between them',
    wrongFeedback: '',
  },
  {
    text: 'To show that the character is confused about what they are seeing',
    wrongFeedback: "That's the character's experience, not the author's technique. Why did the AUTHOR choose this specific comparison? What does it do for the reader?",
  },
  {
    text: 'To add description that makes the passage more detailed',
    wrongFeedback: 'Description is a side effect, not the purpose. Figurative language creates meaning — it makes the reader FEEL something. What feeling does this figure create?',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachFigurativePage() {
  const params       = useParams<{ standardId: string }>();
  const router       = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  // Supabase context
  const [studentId,    setStudentId]    = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId,    setSessionId]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  // Load timeout
  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Passage
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    'figurative_language_failure',
  );
  const passageText   = triggerQ?.passageText   ?? '';
  const passageTitle  = triggerQ?.passageTitle  ?? '';
  const passageAuthor = triggerQ?.passageAuthor ?? '';

  // Highlight ranges
  const highlightRanges = useMemo(
    () => findHighlightRanges(passageText, 'figurative'),
    [passageText],
  );
  const markStyle: React.CSSProperties = {
    background: '#FAEEDA', color: '#633806', borderRadius: 2, padding: '0 2px',
  };

  // Passage panel ref + jump
  const passagePanelRef = useRef<HTMLDivElement>(null);
  function jumpToHighlight() {
    passagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Figure type from passage
  const figureType = useMemo(() => detectFigureType(passageText), [passageText]);

  // Step state
  const [step1Clicked, setStep1Clicked] = useState(false);
  const [b1, setB1] = useState('');
  const [b2, setB2] = useState('');
  const [b3, setB3] = useState('');
  const [b1Error, setB1Error] = useState(false);
  const [b2Error, setB2Error] = useState(false);
  const [mcPassed, setMcPassed] = useState(false);

  // Passage verification
  function verifyInPassage(val: string): boolean {
    if (!val.trim() || !passageText) return true; // skip if no passage yet
    return passageText.toLowerCase().includes(val.trim().toLowerCase());
  }

  const b1Valid    = minWords(b1, 3);
  const b2Valid    = minWords(b2, 3);
  const b3Valid    = minWords(b3, 8);
  const step2Done  = b1Valid && !b1Error && b2Valid && !b2Error && b3Valid;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();

        const { data: student } = await supabase
          .from('students').select('id').eq('user_id', user!.id).maybeSingle();
        const sid = student?.id ?? '';
        setStudentId(sid);

        const { data: std } = await supabase
          .from('standards').select('id').eq('code', standardCode).maybeSingle();
        if (!std?.id) return;
        setStandardUuid(std.id);

        if (sid) {
          const { data: session } = await supabase
            .from('sessions').select('id')
            .eq('student_id', sid).eq('standard_id', std.id)
            .order('started_at', { ascending: false }).limit(1).maybeSingle();
          if (session?.id) setSessionId(session.id);
        }
      } catch (err) {
        console.error('[TeachFigurative] init error:', err);
      }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  async function handleCTA() {
    if (!mcPassed || submitting) return;
    setSubmitting(true);
    try {
      if (sessionId && studentId && standardUuid) {
        await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId, student_id: studentId, standard_id: standardUuid,
            cognitive_skill_targeted: 'figurative_language',
            intervention_type: 'figurative_3step',
            student_response: [b1, b2, b3].join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachFigurative] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // Pull quote for Step 1 (use passageContext or first highlighted segment)
  const figureQuote = triggerQ?.passageContext
    ?? (passageText ? passageText.split(/[.!?]/)[0]?.trim() : '');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} navLabel="TEACH PHASE  |  LAYER 2  |  FIGURATIVE LANGUAGE" layerColor={C.blueMid} />

      <div className="teach-3col">

        {/* ── COL 1: PASSAGE ─────────────────────────────────────────────── */}
        <PassagePanel
          passageTitle={passageTitle}
          passageAuthor={passageAuthor}
          passageText={passageText}
          ranges={highlightRanges}
          markStyle={markStyle}
          onJump={jumpToHighlight}
          panelRef={passagePanelRef}
          loading={passageLoading}
          loadTimeout={loadTimeout}
        />

        {/* ── COL 2: GOGI COACHING ───────────────────────────────────────── */}
        <div style={{ flex: '0 0 35%', borderRight: `1px solid ${C.border}`, padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            GOGI COACHING
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              The author didn&rsquo;t mean that literally. Figurative language says one thing
              but means something deeper. Let&rsquo;s unlock what this figure actually means.
            </GogiBubble>
          </div>

          <div style={{ background: C.blueLight, borderLeft: `3px solid ${C.blue}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              DIAGNOSTIC CONTEXT
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>
              Classification: figurative_language_failure → Layer 2
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
              Root cause: reading figurative language literally instead of inferring its meaning.
            </div>
          </div>

          {step2Done && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <GogiAvatar size={36} state="engaged" />
              <GogiBubble state="engaged">
                Now you can read the figure the way the author intended.
                The literal words are just the surface.
              </GogiBubble>
            </div>
          )}

          <button
            onClick={handleCTA}
            disabled={!mcPassed || submitting}
            style={{
              width: '100%', background: C.navy, color: C.white,
              border: 'none', borderRadius: 8, padding: 12,
              fontSize: 14, fontWeight: 700,
              cursor: mcPassed && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: FONTS.ui,
              opacity: mcPassed && !submitting ? 1 : 0.4,
              transition: 'opacity 0.2s ease',
              marginTop: 'auto',
            }}
          >
            I&rsquo;ve got it — Practice →
          </button>
          {!mcPassed && (
            <p style={{ fontSize: 11, color: C.gray, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
              Complete the verification question to continue
            </p>
          )}
        </div>

        {/* ── COL 3: INTERVENTION CARD ───────────────────────────────────── */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            FIGURATIVE LANGUAGE INTERVENTION
          </div>

          {/* ── STEP 1: THE FIGURE ──────────────────────────────────── */}
          <div style={{ border: `1.5px solid ${C.blue}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            {/* Figure type badge */}
            <div style={{ display: 'inline-block', background: C.blueLight, color: C.blue, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderRadius: 10, padding: '2px 8px', marginBottom: 8 }}>
              {figureType}
            </div>

            {/* Quote */}
            {figureQuote && (
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontStyle: 'italic', color: C.dark, margin: '8px 0', lineHeight: 1.6 }}>
                &ldquo;{figureQuote}&rdquo;
              </div>
            )}

            <p style={{ fontSize: 11, color: C.gray, margin: '8px 0', lineHeight: 1.6 }}>
              The author didn&rsquo;t mean this literally. This figure is comparing two things
              to create a deeper meaning.
            </p>

            {!step1Clicked && (
              <button
                onClick={() => setStep1Clicked(true)}
                style={{ background: C.blue, color: C.white, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui, marginTop: 4 }}
              >
                What does it mean? →
              </button>
            )}
          </div>

          {/* ── STEP 2: DECODE (cloze) ──────────────────────────────── */}
          {step1Clicked && (
            <div style={{ border: `1.5px solid ${C.blue}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                DECODE THE FIGURE
              </div>

              {/* Cloze frame */}
              <div style={{ fontSize: 13, color: C.dark, lineHeight: 2.2 }}>
                <span>This {figureType.toLowerCase()} compares </span>
                <input
                  value={b1}
                  onChange={e => { setB1(e.target.value); setB1Error(false); }}
                  onBlur={() => { if (b1.trim()) setB1Error(!verifyInPassage(b1)); }}
                  placeholder="from the passage…"
                  style={inlineStyle(b1Error)}
                />
                <span> to </span>
                <input
                  value={b2}
                  onChange={e => { setB2(e.target.value); setB2Error(false); }}
                  onBlur={() => { if (b2.trim()) setB2Error(!verifyInPassage(b2)); }}
                  placeholder="from the passage…"
                  style={inlineStyle(b2Error)}
                />
                <span> in order to suggest that:</span>
              </div>

              {b1Error && (
                <p style={{ fontSize: 10, color: C.red, margin: '2px 0 4px' }}>
                  That phrase isn&rsquo;t in the passage. Copy directly from the highlighted text above ↑
                </p>
              )}
              {b2Error && (
                <p style={{ fontSize: 10, color: C.red, margin: '2px 0 4px' }}>
                  That phrase isn&rsquo;t in the passage. Copy directly from the highlighted text above ↑
                </p>
              )}

              <textarea
                value={b3}
                onChange={e => setB3(e.target.value)}
                placeholder="What is the author implying here that they never directly stated?…"
                style={{
                  width: '100%', minHeight: 80, marginTop: 8,
                  background: C.white, border: `1px solid ${b3Valid ? C.green : C.border}`,
                  borderRadius: 4, padding: '8px 10px', fontSize: 13,
                  fontFamily: FONTS.ui, color: C.dark, outline: 'none',
                  resize: 'none', boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 4 }}>
                Hint: What is the author implying here that they never directly stated?
              </p>
            </div>
          )}

          {/* ── STEP 3: VERIFY (MC) ─────────────────────────────────── */}
          {step2Done && (
            <div style={{ border: `1.5px solid ${C.blue}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                WHY DID THE AUTHOR USE THIS FIGURE?
              </div>
              <MCVerification
                question="Which best explains why the author used this figure instead of plain language?"
                options={MC_OPTIONS}
                correctIndex={1}
                onCorrect={() => setMcPassed(true)}
                accentColor={C.blue}
              />
            </div>
          )}
        </div>
      </div>

      <style>{TEACH_3COL_CSS(C.border)}</style>
    </div>
  );
}
