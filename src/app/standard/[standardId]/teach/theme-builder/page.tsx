'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';
import {
  TeachNav, PassagePanel, MCVerification, MCOption,
  findHighlightRanges, minWords,
  GogiAvatar, GogiBubble,
  TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';

// ─── Character name check ─────────────────────────────────────────────────────

const CHARACTER_NAMES = new Set([
  'rainsford', 'zaroff', 'ivan', 'whitney',
  'della', 'jim', 'madame',
  'walter', 'ruth', 'travis', 'beneatha', 'lena',
  'holden', 'phoebe',
]);

function hasCharacterName(text: string): boolean {
  const words = text.toLowerCase().split(/[\s,.'";]+/);
  return words.some(w => CHARACTER_NAMES.has(w));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachThemeBuilderPage() {
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
    studentId || null, standardCode, 'topic_vs_theme_confusion',
  );
  const passageText   = triggerQ?.passageText   ?? '';
  const passageTitle  = triggerQ?.passageTitle  ?? '';
  const passageAuthor = triggerQ?.passageAuthor ?? '';

  const highlightRanges = useMemo(() => findHighlightRanges(passageText, 'theme'), [passageText]);
  const markStyle: React.CSSProperties = { background: '#C6EFCE', color: '#27500A', borderRadius: 2, padding: '0 2px' };

  const passagePanelRef = useRef<HTMLDivElement>(null);
  function jumpToHighlight() {
    passagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Step state
  const [step1Clicked,  setStep1Clicked]  = useState(false);

  // Field 1 — topic
  const [topic, setTopic] = useState('');
  const topicValid = topic.trim().length >= 2;

  // Field 2 — claim (continues from locked sentence starter)
  const [claim, setClaim] = useState('');
  const claimValid = minWords(claim, 8);

  // Field 3 — three blanks for universal statement
  const [b1, setB1] = useState('');
  const [b2, setB2] = useState('');
  const [b3, setB3] = useState('');
  const b1Valid    = minWords(b1, 4);
  const b2Valid    = minWords(b2, 6);
  const b3Valid    = minWords(b3, 8);
  const b1HasName  = b1Valid && hasCharacterName(b1);
  const b2HasName  = b2Valid && hasCharacterName(b2);
  const b3HasName  = b3Valid && hasCharacterName(b3);
  const step2Done  = claimValid && b1Valid && b2Valid && b3Valid && !b1HasName && !b2HasName && !b3HasName;

  const [mcPassed, setMcPassed] = useState(false);

  // Composed theme statement (shown after step2Done)
  const composedTheme = step2Done
    ? `${topic.trim()} ${b1.trim()} because ${b2.trim()}, which means that all people ${b3.trim()}.`
    : '';

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
      } catch (err) { console.error('[TeachThemeBuilder] init error:', err); }
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
            cognitive_skill_targeted: 'theme_identification',
            intervention_type: 'theme_builder',
            student_response: composedTheme || [topic, claim, b1, b2, b3].join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) { console.error('[TeachThemeBuilder] response write error:', err); }
    router.push(`/standard/${standardId}/practice`);
  }

  // MC options — dynamic
  const topicDisplay = topic.trim() || '[topic]';
  const mcOptions: MCOption[] = [
    {
      text: `"${topicDisplay}."`,
      wrongFeedback: `That's the topic — what the text is about. A theme goes further. What does the author SAY about that topic? A theme is always a complete sentence making a claim.`,
    },
    {
      text: `In this story, the character learns that certain events change everything.`,
      wrongFeedback: "That's a plot summary — it only works for this specific story. A universal theme applies to anyone, anywhere. Which option does that?",
    },
    {
      text: `${topicDisplay} ultimately requires that people make difficult choices, which reveals that all human beings must confront what they truly value.`,
      wrongFeedback: '',
    },
    {
      text: `The author wrote this to show that ${topicDisplay} is important in life.`,
      wrongFeedback: `That could describe almost any story ever written. A strong theme is specific — it makes a real claim about human experience. Which option actually says something specific about what ${topicDisplay} requires of people?`,
    },
  ];

  const taStyle = (valid: boolean): React.CSSProperties => ({
    width: '100%', minHeight: 70,
    background: C.white, border: `1px solid ${valid ? C.green : C.border}`,
    borderRadius: 4, padding: '8px 10px', fontSize: 13,
    fontFamily: FONTS.ui, color: C.dark, outline: 'none',
    resize: 'none', boxSizing: 'border-box',
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} navLabel="TEACH PHASE  |  LAYER 3  |  THEME" layerColor={C.greenBorder} />

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
              You identified the topic. That&rsquo;s the first step. Now go deeper —
              what does the author <strong>SAY</strong> about that topic?
              That&rsquo;s the theme.
            </GogiBubble>
          </div>

          <div style={{ background: C.greenLight, borderLeft: `3px solid ${C.green}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 3 — AFTER READING
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>Classification: topic_vs_theme_confusion → Layer 3</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
              Root cause: names the topic (what it&rsquo;s about) instead of the theme (what it says).
            </div>
          </div>

          {step2Done && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <GogiAvatar size={36} state="celebrate" />
              <GogiBubble state="celebrate">
                A theme applies to anyone, anywhere. If your statement could only be true
                in this story — it&rsquo;s not a theme yet. Push it to the universal level.
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
            THEME INTERVENTION — BUILD A THEME STATEMENT
          </div>

          {/* ── STEP 1: DISTINCTION ─────────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              TOPIC vs THEME
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {/* Topic */}
              <div style={{ background: '#F8F8F8', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, marginBottom: 8 }}>TOPIC ✗</div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 10, lineHeight: 1.6 }}>
                  A topic is a subject.<br />One or two words.<br />Tells you WHAT the text is about.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['loyalty', 'sacrifice', 'power'].map(t => (
                    <span key={t} style={{ background: C.light, color: C.gray, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 20, padding: '3px 10px' }}>{t}</span>
                  ))}
                </div>
                <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 8, marginBottom: 0 }}>
                  These are NOT themes. They are starting points.
                </p>
              </div>

              {/* Theme */}
              <div style={{ background: C.greenLight, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.green, marginBottom: 8 }}>THEME ✓</div>
                <div style={{ fontSize: 12, color: C.dark, marginBottom: 10, lineHeight: 1.6 }}>
                  A theme is a CLAIM about human experience. A full sentence. Tells you what the author SAYS about the topic.
                </div>
                {[
                  'Loyalty requires sacrifice from those who practice it.',
                  'True friendship survives loss and the passage of time.',
                  'Power corrupts those who believe they are above ordinary people.',
                ].map(stmt => (
                  <div key={stmt} style={{ background: C.white, borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 11, fontStyle: 'italic', color: C.dark, lineHeight: 1.5 }}>
                    {stmt}
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 11, fontStyle: 'italic', color: C.dark, textAlign: 'center', marginBottom: 10 }}>
              A theme applies to ANYONE, ANYWHERE — not just the characters in this story.
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

          {/* ── STEP 2: BUILD ────────────────────────────────────────── */}
          {step1Clicked && (
            <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                BUILD YOUR THEME STATEMENT
              </div>
              <p style={{ fontSize: 12, color: C.gray, marginBottom: 14, marginTop: 0 }}>
                Now build your own theme statement for this passage — step by step.
              </p>

              {/* Field 1 — Topic */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                  WHAT IS THIS TEXT ABOUT?
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value.slice(0, 40))}
                    placeholder="One or two words…"
                    style={{
                      flex: 1, border: `1px solid ${topicValid ? C.green : C.border}`,
                      borderRadius: 4, padding: '8px 10px', fontSize: 13,
                      fontFamily: FONTS.ui, color: C.dark, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: 10, color: C.gray, flexShrink: 0 }}>{topic.length}/40</span>
                </div>
                <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 4, marginBottom: 0 }}>
                  Keep it short. This is just the starting point.
                </p>
              </div>

              {/* Field 2 — Author's Claim */}
              {topicValid && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                    WHAT DOES THE AUTHOR SAY ABOUT &ldquo;{topic.trim().toUpperCase()}&rdquo;?
                  </div>
                  <div style={{ fontSize: 13, color: C.gray, fontStyle: 'italic', marginBottom: 6, lineHeight: 1.6 }}>
                    In this text, the author suggests that {topic.trim()}{' '}
                  </div>
                  <textarea
                    value={claim}
                    onChange={e => setClaim(e.target.value)}
                    placeholder="…complete the thought"
                    style={{
                      ...taStyle(claimValid),
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      borderRadius: 0, borderBottom: `2px solid ${claimValid ? C.green : C.blue}`,
                      minHeight: 60,
                    }}
                  />
                  <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 4, marginBottom: 0 }}>
                    Look at the highlighted moment in the passage. What does the author show us about this topic?
                  </p>
                </div>
              )}

              {/* Field 3 — Universal statement */}
              {claimValid && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                    MAKE IT UNIVERSAL
                  </div>
                  <p style={{ fontSize: 11, color: C.gray, marginBottom: 10, marginTop: 0 }}>
                    Replace any character names with universal language.
                    This must apply to anyone, not just these characters.
                  </p>

                  {/* Cloze frame text */}
                  <div style={{ background: C.blueLight, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: C.dark, marginBottom: 12, lineHeight: 1.7 }}>
                    <strong>{topicDisplay}</strong>
                    <span style={{ color: C.blue }}> [BLANK 1] </span>
                    because
                    <span style={{ color: C.blue }}> [BLANK 2]</span>
                    , which means that all people
                    <span style={{ color: C.blue }}> [BLANK 3]</span>.
                  </div>

                  {/* Blank 1 */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.dark, fontWeight: 700, marginBottom: 3 }}>BLANK 1 — what it does or requires:</div>
                    <textarea
                      value={b1}
                      onChange={e => setB1(e.target.value)}
                      placeholder="…requires, demands, forces, reveals…"
                      style={taStyle(b1Valid)}
                    />
                    {b1HasName && (
                      <p style={{ fontSize: 10, color: C.amber, margin: '3px 0 0' }}>
                        Try removing the character&rsquo;s name — a universal theme applies to all people, not just this character.
                      </p>
                    )}
                  </div>

                  {/* Blank 2 */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.dark, fontWeight: 700, marginBottom: 3 }}>BLANK 2 — why / evidence from passage:</div>
                    <textarea
                      value={b2}
                      onChange={e => setB2(e.target.value)}
                      placeholder="…as shown when…"
                      style={taStyle(b2Valid)}
                    />
                    {b2HasName && (
                      <p style={{ fontSize: 10, color: C.amber, margin: '3px 0 0' }}>
                        Try removing the character&rsquo;s name — a universal theme applies to all people, not just this character.
                      </p>
                    )}
                  </div>

                  {/* Blank 3 */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: C.dark, fontWeight: 700, marginBottom: 3 }}>BLANK 3 — universal human truth:</div>
                    <textarea
                      value={b3}
                      onChange={e => setB3(e.target.value)}
                      placeholder="…must face, will always, cannot escape…"
                      style={taStyle(b3Valid)}
                    />
                    {b3HasName && (
                      <p style={{ fontSize: 10, color: C.amber, margin: '3px 0 0' }}>
                        Try removing the character&rsquo;s name — a universal theme applies to all people, not just this character.
                      </p>
                    )}
                  </div>

                  {/* Composed theme statement */}
                  {step2Done && composedTheme && (
                    <div style={{ background: C.greenLight, border: `1px solid ${C.green}`, borderRadius: 8, padding: 12, marginTop: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                        YOUR THEME STATEMENT:
                      </div>
                      <p style={{ fontSize: 13, fontStyle: 'italic', color: '#27500A', margin: 0, lineHeight: 1.7 }}>
                        {composedTheme}
                      </p>
                    </div>
                  )}
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
                question="Which of these is the strongest theme statement?"
                options={mcOptions}
                correctIndex={2}
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
