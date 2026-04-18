'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';
import {
  TeachNav, PassagePanel, MCVerification, MCOption, ChipBank, ChipItem,
  findHighlightRanges, minWords,
  GogiAvatar, GogiBubble,
  TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';

// ─── Chips ────────────────────────────────────────────────────────────────────

const MOOD_CHIPS: ChipItem[] = [
  { label: 'ominous' }, { label: 'tense' }, { label: 'melancholic' }, { label: 'unsettling' },
  { label: 'mysterious' }, { label: 'hopeful' }, { label: 'reverent' }, { label: 'somber' },
  { label: 'anxious' }, { label: 'nostalgic' }, { label: 'triumphant' }, { label: 'joyful' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachMoodPage() {
  const params       = useParams<{ standardId: string }>();
  const router       = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [studentId,    setStudentId]    = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId,    setSessionId]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null, standardCode, 'mood_misreading',
  );
  const passageText   = triggerQ?.passageText   ?? '';
  const passageTitle  = triggerQ?.passageTitle  ?? '';
  const passageAuthor = triggerQ?.passageAuthor ?? '';

  const highlightRanges = useMemo(() => findHighlightRanges(passageText, 'mood'), [passageText]);
  const markStyle: React.CSSProperties = { background: '#E6F1FB', color: '#0C447C', borderRadius: 2, padding: '0 2px' };

  const passagePanelRef = useRef<HTMLDivElement>(null);
  function jumpToHighlight() {
    passagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Step state
  const [step1Clicked,  setStep1Clicked]  = useState(false);
  const [selectedMood,  setSelectedMood]  = useState('');
  const [b1, setB1] = useState('');
  const [b2, setB2] = useState('');
  const [b3, setB3] = useState('');
  const [b1Error, setB1Error] = useState(false);
  const [b2Error, setB2Error] = useState(false);
  const [mcPassed, setMcPassed] = useState(false);

  function verifyInPassage(val: string): boolean {
    if (!val.trim() || !passageText) return true;
    return passageText.toLowerCase().includes(val.trim().toLowerCase());
  }

  const b1Valid   = minWords(b1, 1);
  const b2Valid   = minWords(b2, 1);
  const b3Valid   = minWords(b3, 6);
  const step2Done = selectedMood && b1Valid && !b1Error && b2Valid && !b2Error && b3Valid;

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
          const { data: session } = await supabase.from('sessions').select('id')
            .eq('student_id', sid).eq('standard_id', std.id)
            .order('started_at', { ascending: false }).limit(1).maybeSingle();
          if (session?.id) setSessionId(session.id);
        }
      } catch (err) { console.error('[TeachMood] init error:', err); }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  async function handleCTA() {
    if (!mcPassed || submitting) return;
    setSubmitting(true);
    try {
      if (sessionId && studentId && standardUuid) {
        await fetch('/api/responses/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId, student_id: studentId, standard_id: standardUuid,
            cognitive_skill_targeted: 'mood_identification',
            intervention_type: 'mood_chip_evidence',
            student_response: `Mood: ${selectedMood} | Words: ${b1}, ${b2} | Reason: ${b3}`,
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) { console.error('[TeachMood] response write error:', err); }
    router.push(`/standard/${standardId}/practice`);
  }

  // MC options — dynamic based on selectedMood
  const mcOptions: MCOption[] = [
    {
      text: `The mood is ${selectedMood || '[mood]'} because the main character is experiencing danger and feels scared.`,
      wrongFeedback: "You found the character's emotion. Mood is different — it's what the AUTHOR'S WORDS make YOU feel as a reader, before anything even happens. Look at the highlighted words.",
    },
    {
      text: `The author creates a ${selectedMood || '[mood]'} mood through specific word choices that make the reader feel that way, even before the character reacts.`,
      wrongFeedback: '',
    },
    {
      text: "The mood changes throughout the passage depending on what happens to the characters.",
      wrongFeedback: "Mood doesn't shift with plot events. The author set this mood through specific word choices from the beginning. It's consistent — look at what's highlighted.",
    },
    {
      text: 'The mood comes from the setting description at the opening of the passage.',
      wrongFeedback: "Setting contributes — but mood comes from the specific WORDS the author chose, not just the location. Which exact words create the feeling? That's the complete answer.",
    },
  ];

  const inlineInputStyle: React.CSSProperties = {
    display: 'inline-block', border: 'none',
    borderBottom: `2px solid ${C.green}`, background: 'transparent',
    fontSize: 13, fontFamily: FONTS.ui, color: C.dark,
    outline: 'none', padding: '1px 4px', width: 130, verticalAlign: 'baseline',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} navLabel="TEACH PHASE  |  LAYER 3  |  MOOD" layerColor={C.greenBorder} />

      <div className="teach-3col">

        {/* ── COL 1: PASSAGE ─────────────────────────────────────────────── */}
        <PassagePanel
          passageTitle={passageTitle} passageAuthor={passageAuthor}
          passageText={passageText} ranges={highlightRanges}
          markStyle={markStyle} onJump={jumpToHighlight}
          panelRef={passagePanelRef} loading={passageLoading} loadTimeout={loadTimeout}
        />

        {/* ── COL 2: GOGI COACHING ───────────────────────────────────────── */}
        <div style={{ flex: '0 0 35%', borderRight: `1px solid ${C.border}`, padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            GOGI COACHING
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <GogiAvatar size={36} state="celebrate" />
            <GogiBubble state="celebrate">
              Mood is not what the character feels. Mood is what <strong>YOU</strong> feel
              as a reader. The author controls that feeling through very specific word choices.
            </GogiBubble>
          </div>

          <div style={{ background: C.greenLight, borderLeft: `3px solid ${C.green}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 3 — AFTER READING
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>
              Classification: mood_misreading → Layer 3
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
              Root cause: confusing character emotion with the overall atmosphere.
            </div>
          </div>

          {step2Done && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <GogiAvatar size={36} state="celebrate" />
              <GogiBubble state="celebrate">
                You now have the tools to identify mood in any passage.
                Ask: how does this text make ME feel — and why?
              </GogiBubble>
            </div>
          )}

          <button
            onClick={handleCTA}
            disabled={!mcPassed || submitting}
            style={{
              width: '100%', background: C.navy, color: C.white, border: 'none',
              borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700,
              cursor: mcPassed && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: FONTS.ui, opacity: mcPassed && !submitting ? 1 : 0.4,
              transition: 'opacity 0.2s ease',
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
            MOOD INTERVENTION — IDENTIFY &amp; EVIDENCE
          </div>

          {/* ── STEP 1: DISTINCTION ─────────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              MOOD vs CHARACTER EMOTION
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {/* NOT MOOD */}
              <div style={{ border: `1.5px solid ${C.red}`, borderRadius: 8, padding: 10, background: C.redLight }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.red, marginBottom: 6 }}>NOT MOOD ✗</div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: C.dark, marginBottom: 6, lineHeight: 1.5 }}>
                  &ldquo;Rainsford felt terrified as he ran through the jungle.&rdquo;
                </div>
                <div style={{ fontSize: 10, color: C.red }}>← This is what the CHARACTER feels</div>
              </div>
              {/* MOOD */}
              <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 10, background: C.greenLight }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.green, marginBottom: 6 }}>MOOD ✓</div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: C.dark, marginBottom: 6, lineHeight: 1.5 }}>
                  &ldquo;The author&rsquo;s word choices create a feeling of dread and unease in the reader.&rdquo;
                </div>
                <div style={{ fontSize: 10, color: C.green }}>← This is what the READER feels because of the author&rsquo;s language</div>
              </div>
            </div>

            <p style={{ fontSize: 11, fontStyle: 'italic', color: C.dark, textAlign: 'center', marginBottom: 10 }}>
              Mood is not what happens in the story. Mood is what the AUTHOR&rsquo;S WORDS do to the reader.
            </p>

            {!step1Clicked && (
              <button
                onClick={() => setStep1Clicked(true)}
                style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui, display: 'block', width: '100%' }}
              >
                I see the difference →
              </button>
            )}
          </div>

          {/* ── STEP 2: IDENTIFY ─────────────────────────────────────── */}
          {step1Clicked && (
            <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                WHAT MOOD DOES THIS PASSAGE CREATE?
              </div>
              <p style={{ fontSize: 12, color: C.gray, marginBottom: 12, marginTop: 0 }}>
                Look at the highlighted words in the passage. What feeling do they create in you as a reader?
              </p>

              <ChipBank
                chips={MOOD_CHIPS}
                selected={selectedMood}
                onSelect={setSelectedMood}
                showDefinitions={false}
                selectedBg={C.navy}
                columns={2}
              />

              {selectedMood && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    FIND THE EVIDENCE
                  </div>
                  <p style={{ fontSize: 12, color: C.gray, marginBottom: 8, marginTop: 0 }}>
                    Which specific words CREATE that <strong>{selectedMood}</strong> mood?
                    Copy them directly from the highlighted text above.
                  </p>

                  {/* Cloze frame */}
                  <div style={{ fontSize: 13, color: C.dark, lineHeight: 2.4 }}>
                    <span>The words &lsquo;</span>
                    <input
                      value={b1}
                      onChange={e => { setB1(e.target.value); setB1Error(false); }}
                      onBlur={() => { if (b1.trim()) setB1Error(!verifyInPassage(b1)); }}
                      placeholder="quote from passage"
                      style={{ ...inlineInputStyle, borderBottomColor: b1Error ? C.red : C.green }}
                    />
                    <span>&rsquo; and &lsquo;</span>
                    <input
                      value={b2}
                      onChange={e => { setB2(e.target.value); setB2Error(false); }}
                      onBlur={() => { if (b2.trim()) setB2Error(!verifyInPassage(b2)); }}
                      placeholder="quote from passage"
                      style={{ ...inlineInputStyle, borderBottomColor: b2Error ? C.red : C.green }}
                    />
                    <span>&rsquo; create a feeling of <strong>{selectedMood}</strong> because they suggest:</span>
                  </div>

                  {b1Error && <p style={{ fontSize: 10, color: C.red, margin: '2px 0' }}>That word isn&rsquo;t in the passage. Copy directly from the highlighted text above ↑</p>}
                  {b2Error && <p style={{ fontSize: 10, color: C.red, margin: '2px 0' }}>That word isn&rsquo;t in the passage. Copy directly from the highlighted text above ↑</p>}

                  <textarea
                    value={b3}
                    onChange={e => setB3(e.target.value)}
                    placeholder={`What do these words suggest that creates the ${selectedMood} mood?…`}
                    style={{
                      width: '100%', minHeight: 80, marginTop: 8,
                      background: C.white, border: `1px solid ${b3Valid ? C.green : C.border}`,
                      borderRadius: 4, padding: '8px 10px', fontSize: 13,
                      fontFamily: FONTS.ui, color: C.dark, outline: 'none',
                      resize: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: VERIFY (MC) ─────────────────────────────────── */}
          {step2Done && (
            <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                VERIFY YOUR UNDERSTANDING
              </div>
              <MCVerification
                question="Which statement correctly describes how mood works in this passage?"
                options={mcOptions}
                correctIndex={1}
                onCorrect={() => setMcPassed(true)}
                accentColor={C.green}
              />
            </div>
          )}
        </div>
      </div>

      <style>{TEACH_3COL_CSS(C.border)}</style>
    </div>
  );
}
