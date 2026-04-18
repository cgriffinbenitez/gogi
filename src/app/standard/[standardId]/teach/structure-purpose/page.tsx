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

// ─── Structure chips ──────────────────────────────────────────────────────────

const STRUCTURE_CHIPS: ChipItem[] = [
  { label: 'Description',       definition: 'Explains what something looks, sounds, or feels like in detail' },
  { label: 'Problem/Solution',  definition: 'Presents a challenge then offers one or more ways to address it' },
  { label: 'Chronological',     definition: 'Events in time order — shows how things developed or changed' },
  { label: 'Compare/Contrast',  definition: 'Shows similarities and differences between two or more things' },
  { label: 'Cause/Effect',      definition: 'Shows how one event leads to another — what happens and why' },
  { label: 'Sequence',          definition: 'Step-by-step process in a specific order — each step depends on the last' },
];

// ─── Dynamic purpose text per structure ───────────────────────────────────────

const STRUCTURE_EFFECT: Record<string, string> = {
  'Description':      'Helps the reader picture the subject clearly — creates a vivid mental image of the subject',
  'Problem/Solution': 'Guides the reader from tension to resolution — shows the author has something to offer',
  'Chronological':    'Shows the reader how things developed over time — reveals cause and effect through sequence',
  'Compare/Contrast': 'Helps the reader see distinctions clearly — forces evaluation of two or more things',
  'Cause/Effect':     'Shows the reader why things happen — builds understanding of consequences and connections',
  'Sequence':         'Guides the reader through a process — makes complex steps feel manageable and logical',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachStructurePurposePage() {
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
    studentId || null, standardCode, 'structure_purpose_disconnect',
  );
  const passageText   = triggerQ?.passageText   ?? '';
  const passageTitle  = triggerQ?.passageTitle  ?? '';
  const passageAuthor = triggerQ?.passageAuthor ?? '';

  const highlightRanges = useMemo(() => findHighlightRanges(passageText, 'structure'), [passageText]);
  const markStyle: React.CSSProperties = { background: '#FAEEDA', color: '#633806', borderRadius: 2, padding: '0 2px' };

  const passagePanelRef = useRef<HTMLDivElement>(null);
  function jumpToHighlight() {
    passagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Step state
  const [selectedStructure, setSelectedStructure] = useState('');
  const [step1Clicked,      setStep1Clicked]       = useState(false);
  const [b1, setB1] = useState('');
  const [b2, setB2] = useState('');
  const [mcPassed, setMcPassed] = useState(false);

  const b1Valid   = minWords(b1, 8);
  const b2Valid   = minWords(b2, 8);
  const step2Done = selectedStructure && b1Valid && b2Valid;

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
      } catch (err) { console.error('[TeachStructurePurpose] init error:', err); }
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
            cognitive_skill_targeted: 'structure_analysis',
            intervention_type: 'structure_purpose',
            student_response: `Structure: ${selectedStructure} | Purpose: ${b1} | Meaning: ${b2}`,
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) { console.error('[TeachStructurePurpose] response write error:', err); }
    router.push(`/standard/${standardId}/practice`);
  }

  // MC options — dynamic based on selectedStructure
  const structLabel = selectedStructure || '[structure]';
  const b1Short = b1.trim().slice(0, 50) + (b1.trim().length > 50 ? '…' : '');
  const b2Short = b2.trim().slice(0, 50) + (b2.trim().length > 50 ? '…' : '');

  const mcOptions: MCOption[] = [
    {
      text: `The author used ${structLabel} structure because it makes the text easier to read and follow.`,
      wrongFeedback: `Structure does make text easier to read — but that's a side effect, not the purpose. What does THIS structure help the reader UNDERSTAND that a different structure wouldn't? That's the real purpose.`,
    },
    {
      text: "The author organized the passage so that the reader can identify the main idea in each paragraph.",
      wrongFeedback: "Finding the main idea is what the READER does. The author's purpose is what the AUTHOR intended. Why did they choose to organize it THIS way — what did they want you to understand because of it?",
    },
    {
      text: `The author chose ${structLabel} structure because it allows the reader to understand ${b1Short || '…'}, which serves the author's purpose of ${b2Short || '…'}.`,
      wrongFeedback: '',
    },
    {
      text: `The author used ${structLabel} structure because this type of text always uses this organizational pattern.`,
      wrongFeedback: "Authors make deliberate choices. They didn't use this structure because they had to — they used it because it DOES something specific. What does it show the reader that another structure wouldn't?",
    },
  ];

  const taStyle = (valid: boolean): React.CSSProperties => ({
    width: '100%', minHeight: 90,
    background: C.white, border: `1px solid ${valid ? C.green : C.border}`,
    borderRadius: 4, padding: '8px 10px', fontSize: 13,
    fontFamily: FONTS.ui, color: C.dark, outline: 'none',
    resize: 'none', boxSizing: 'border-box',
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} navLabel="TEACH PHASE  |  LAYER 3  |  TEXT STRUCTURE" layerColor={C.greenBorder} />

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
              You can identify the structure. Now connect it to <strong>WHY</strong>.
              Authors don&rsquo;t choose structure by accident — they choose it because
              it <em>DOES</em> something. What does this structure do?
            </GogiBubble>
          </div>

          <div style={{ background: C.greenLight, borderLeft: `3px solid ${C.green}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 3 — AFTER READING
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>Classification: structure_purpose_disconnect → Layer 3</div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
              Root cause: identifies structure but cannot explain why the author chose it.
            </div>
          </div>

          {step2Done && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
              <GogiAvatar size={36} state="celebrate" />
              <GogiBubble state="celebrate">
                Structure is a tool. Every structural choice serves the author&rsquo;s purpose.
                You can now see both — and the connection between them.
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
            STRUCTURE &amp; PURPOSE INTERVENTION
          </div>

          {/* ── STEP 1: STRUCTURE IS A TOOL ─────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              TEXT STRUCTURE — A TOOL FOR PURPOSE
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, marginBottom: 10 }}>
              SELECT THE STRUCTURE USED IN THIS PASSAGE
            </div>

            <ChipBank
              chips={STRUCTURE_CHIPS}
              selected={selectedStructure}
              onSelect={setSelectedStructure}
              showDefinitions={true}
              selectedBg={C.navy}
              columns={1}
            />

            {/* Dynamic purpose box */}
            {selectedStructure && (
              <div style={{ background: C.blueLight, borderLeft: `3px solid ${C.blue}`, borderRadius: '0 8px 8px 0', padding: '10px 12px', marginTop: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                  WHAT THIS STRUCTURE DOES:
                </div>
                <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.6 }}>
                  {STRUCTURE_EFFECT[selectedStructure]}
                </div>
              </div>
            )}

            <p style={{ fontSize: 11, fontStyle: 'italic', color: C.dark, marginTop: 10, marginBottom: 10 }}>
              Authors don&rsquo;t choose structure by accident. Every structural choice DOES something to how the reader understands the text.
            </p>

            {selectedStructure && !step1Clicked && (
              <button
                onClick={() => setStep1Clicked(true)}
                style={{ background: C.green, color: C.white, border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui, display: 'block', width: '100%' }}
              >
                I see why structure matters →
              </button>
            )}
          </div>

          {/* ── STEP 2: CONNECT (cloze) ─────────────────────────────── */}
          {step1Clicked && selectedStructure && (
            <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                CONNECT STRUCTURE TO PURPOSE
              </div>
              <p style={{ fontSize: 12, color: C.gray, marginBottom: 14, marginTop: 0 }}>
                Now connect the <strong>{selectedStructure}</strong> structure to this specific passage.
              </p>

              {/* Blank 1 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: C.dark, marginBottom: 6, lineHeight: 1.6 }}>
                  The author used <strong>{selectedStructure}</strong> structure because it helps the reader understand:
                </div>
                <textarea
                  value={b1}
                  onChange={e => setB1(e.target.value)}
                  placeholder="What does this structure help the reader understand?…"
                  style={taStyle(b1Valid)}
                />
                <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 4, marginBottom: 0 }}>
                  Look at the highlighted signal words in the passage. What do they show the reader?
                </p>
              </div>

              {/* Blank 2 */}
              <div>
                <div style={{ fontSize: 13, color: C.dark, marginBottom: 6, lineHeight: 1.6 }}>
                  …which supports the author&rsquo;s purpose of:
                </div>
                <textarea
                  value={b2}
                  onChange={e => setB2(e.target.value)}
                  placeholder="Why did the author write this passage? What did they want the reader to walk away understanding?…"
                  style={taStyle(b2Valid)}
                />
                <p style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginTop: 4, marginBottom: 0 }}>
                  Why did the author write this passage? What did they want the reader to walk away understanding?
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: VERIFY (MC) ─────────────────────────────────── */}
          {step2Done && (
            <div style={{ border: `1.5px solid ${C.green}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                VERIFY YOUR UNDERSTANDING
              </div>
              <MCVerification
                question="Which statement best explains how structure and purpose work together in this passage?"
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
