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

// ─── Tone chips (with definitions) ───────────────────────────────────────────

const TONE_CHIPS: ChipItem[] = [
  { label: 'ironic',        definition: 'saying the opposite of what you mean for effect' },
  { label: 'admiring',      definition: 'showing genuine respect and approval' },
  { label: 'contemptuous',  definition: 'treating something as worthless or beneath you' },
  { label: 'critical',      definition: 'finding fault or pointing out problems' },
  { label: 'reverent',      definition: 'treating something with deep respect or awe' },
  { label: 'sardonic',      definition: 'mocking in a dry, bitter way' },
  { label: 'sympathetic',   definition: "showing understanding and care for someone's situation" },
  { label: 'detached',      definition: 'emotionally distant — describing without feeling' },
  { label: 'melancholic',   definition: 'expressing a deep, quiet sadness' },
  { label: 'celebratory',   definition: 'expressing joy and pride in something' },
  { label: 'nostalgic',     definition: 'longing for something from the past' },
  { label: 'satirical',     definition: 'using humor to criticize or expose something' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachTonePage() {
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
    studentId || null, standardCode, 'tone_misreading',
  );
  const passageText   = triggerQ?.passageText   ?? '';
  const passageTitle  = triggerQ?.passageTitle  ?? '';
  const passageAuthor = triggerQ?.passageAuthor ?? '';

  const highlightRanges = useMemo(() => findHighlightRanges(passageText, 'tone'), [passageText]);
  const markStyle: React.CSSProperties = { background: '#C6EFCE', color: '#27500A', borderRadius: 2, padding: '0 2px' };

  const passagePanelRef = useRef<HTMLDivElement>(null);
  function jumpToHighlight() {
    passagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Step state
  const [step1Clicked,  setStep1Clicked]  = useState(false);
  const [selectedTone,  setSelectedTone]  = useState('');
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
  const b3Valid   = minWords(b3, 8);
  const step2Done = selectedTone && b1Valid && !b1Error && b2Valid && !b2Error && b3Valid;

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
      } catch (err) { console.error('[TeachTone] init error:', err); }
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
            cognitive_skill_targeted: 'tone_identification',
            intervention_type: 'tone_distinction',
            student_response: `Tone: ${selectedTone} | Diction: ${b1}, ${b2} | Belief: ${b3}`,
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) { console.error('[TeachTone] response write error:', err); }
    router.push(`/standard/${standardId}/practice`);
  }

  // MC options — dynamic based on selectedTone
  const mcOptions: MCOption[] = [
    {
      text: `The tone is ${selectedTone || '[mood word]'} because the passage makes the reader feel uncomfortable and tense.`,
      wrongFeedback: "That's the mood — what the reader feels. Tone is the AUTHOR'S attitude. Ask: what does the author think about what they're describing? Look at the highlighted words — those are the author's choices.",
    },
    {
      text: `The author's tone is ${selectedTone || '[tone word]'} — you can see this in word choices like the highlighted words, which reveal the author's attitude rather than just describing events.`,
      wrongFeedback: '',
    },
    {
      text: `The tone is ${selectedTone || '[word]'} because the main character is experiencing a difficult situation.`,
      wrongFeedback: "That's the character's experience. The author is a separate person from their characters. How does the AUTHOR feel about what they're describing? The highlighted words are the author's choices — not the character's.",
    },
    {
      text: 'The author has no clear tone — they are simply describing what happens in a neutral way.',
      wrongFeedback: "No writing is truly neutral. Every word choice reveals an attitude. Look at the highlighted words — would a neutral author choose those specific words? What do those choices reveal about how the author feels about the subject?",
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
      <TeachNav standardCode={standardCode} navLabel="TEACH PHASE  |  LAYER 3  |  TONE" layerColor={C.greenBorder} />

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
              Tone is the author&rsquo;s <strong>attitude</strong> — not the character&rsquo;s emotion,
              not the reader&rsquo;s feeling. Ask: what does the <em>AUTHOR</em> think about what
              they&rsquo;re describing?
            </GogiBubble>
          </div>

          <div style={{ background: C.greenLight, borderLeft: `3px solid ${C.green}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 3 — AFTER READING
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>Classification: tone_misreading → Layer 3</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
              Root cause: confusing what the content describes with how the author regards it.
            </div>
          </div>

          {step2Done && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <GogiAvatar size={36} state="celebrate" />
              <GogiBubble state="celebrate">
                Every author has a stance. Tone is how that stance leaks through their
                word choices. You can hear it now.
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
            TONE INTERVENTION — IDENTIFY &amp; DISTINGUISH
          </div>

          {/* ── STEP 1: THREE-WAY DISTINCTION TABLE ─────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              TONE vs MOOD vs CHARACTER EMOTION
            </div>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
              {/* Row 1 — Character emotion */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', background: C.white }}>
                <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.dark }}>Character emotion</div>
                </div>
                <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.gray }}>What the character feels</div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>&ldquo;Rainsford felt terrified&rdquo;</div>
                  <div style={{ fontSize: 9, color: C.border, marginTop: 2 }}>← from plot and action</div>
                </div>
              </div>

              {/* Row 2 — Mood */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', background: C.blueLight, borderTop: `1px solid ${C.border}` }}>
                <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.blue }}>Mood</div>
                </div>
                <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.blue }}>What the READER feels</div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: C.blue, fontStyle: 'italic' }}>&ldquo;The passage feels ominous&rdquo;</div>
                  <div style={{ fontSize: 9, color: C.blue, marginTop: 2, opacity: 0.7 }}>← from word choices</div>
                </div>
              </div>

              {/* Row 3 — Tone (highlighted) */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', background: C.greenLight, borderTop: `2px solid ${C.green}` }}>
                <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.greenBorder}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.green }}>Tone ✓</div>
                </div>
                <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.greenBorder}` }}>
                  <div style={{ fontSize: 11, color: C.green }}>What the AUTHOR thinks</div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: C.green, fontStyle: 'italic' }}>&ldquo;The author treats Zaroff with contempt&rdquo;</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.green, marginTop: 2 }}>← THIS is tone</div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 11, fontStyle: 'italic', color: C.dark, marginBottom: 10 }}>
              Tone is the author&rsquo;s attitude — their stance on the subject. You can hear it in HOW they describe things, not just WHAT they describe.
            </p>

            {!step1Clicked && (
              <button
                onClick={() => setStep1Clicked(true)}
                style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui, display: 'block', width: '100%' }}
              >
                I understand the difference →
              </button>
            )}
          </div>

          {/* ── STEP 2: IDENTIFY ─────────────────────────────────────── */}
          {step1Clicked && (
            <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                WHAT IS THE AUTHOR&rsquo;S ATTITUDE?
              </div>
              <p style={{ fontSize: 12, color: C.gray, marginBottom: 12, marginTop: 0 }}>
                Look at the highlighted words. What is the AUTHOR&rsquo;S attitude toward the subject?
              </p>

              <ChipBank
                chips={TONE_CHIPS}
                selected={selectedTone}
                onSelect={setSelectedTone}
                showDefinitions={true}
                selectedBg={C.navy}
                columns={2}
              />

              {selectedTone && (
                <div style={{ marginTop: 14 }}>
                  {/* Cloze frame */}
                  <div style={{ fontSize: 13, color: C.dark, lineHeight: 2.4 }}>
                    <span>The author&rsquo;s tone is <strong>{selectedTone}</strong> because they describe it as &lsquo;</span>
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
                    <span>&rsquo;, which reveals that the author believes:</span>
                  </div>

                  {b1Error && <p style={{ fontSize: 10, color: C.red, margin: '2px 0' }}>That word isn&rsquo;t in the passage. Copy directly from the highlighted text above ↑</p>}
                  {b2Error && <p style={{ fontSize: 10, color: C.red, margin: '2px 0' }}>That word isn&rsquo;t in the passage. Copy directly from the highlighted text above ↑</p>}

                  <textarea
                    value={b3}
                    onChange={e => setB3(e.target.value)}
                    placeholder={`What is the author's actual stance or judgment here?…`}
                    style={{
                      width: '100%', minHeight: 90, marginTop: 8,
                      background: C.white, border: `1px solid ${b3Valid ? C.green : C.border}`,
                      borderRadius: 4, padding: '8px 10px', fontSize: 13,
                      fontFamily: FONTS.ui, color: C.dark, outline: 'none',
                      resize: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 4 }}>
                    Hint: What is the author&rsquo;s actual stance or judgment here?
                  </p>
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
                question="Which statement correctly describes the AUTHOR's tone in this passage?"
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
