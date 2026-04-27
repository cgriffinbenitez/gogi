'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';
import {
  TeachNav, PassagePanel,
  findHighlightRanges, renderHighlighted,
  GogiAvatar, GogiBubble,
  TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';
import { MOOD_SIGNATURES, getCanonicalMood } from './exemplars';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASSIFICATION    = 'mood_misreading';
const COGNITIVE_SKILL   = 'mood_identification';
const INTERVENTION_TYPE = 'mood_read_explicit_v2';
const NAV_LABEL         = 'Mood Read · Layer 3';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferPassageData {
  id: string;
  content: string;
  title?: string | null;
  author?: string | null;
  canonical_mood?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPassage(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  const raw  = qIdx > 0 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchTransferPassage(
  standardUuid: string,
  triggerQuestionId: string,
): Promise<TransferPassageData | null> {
  const supabase = createClient();
  // Fetch all matching; pick one at random client-side
  // (PostgREST doesn't support ORDER BY random())
  const { data, error } = await supabase
    .from('questions')
    .select('id, content, title, author, canonical_mood')
    .eq('standard_id', standardUuid)
    .eq('approved', true)
    .neq('id', triggerQuestionId)
    .or(
      'option_a_class.eq.mood_misreading,' +
      'option_b_class.eq.mood_misreading,' +
      'option_c_class.eq.mood_misreading,' +
      'option_d_class.eq.mood_misreading',
    )
    .limit(20);

  if (error || !data || data.length === 0) return null;
  const pick = data[Math.floor(Math.random() * data.length)];
  return pick as TransferPassageData;
}

// ─── Local: TransferCheckMC ───────────────────────────────────────────────────

const TRANSFER_MOOD_OPTIONS = ['Tense', 'Melancholy', 'Ominous', 'Peaceful'];

function TransferCheckMC({
  correctMood,
  onComplete,
}: {
  correctMood: string;
  onComplete: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  function handlePick(option: string) {
    if (picked !== null) return;
    setPicked(option);
    onComplete(option.toLowerCase() === correctMood.toLowerCase());
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {TRANSFER_MOOD_OPTIONS.map(opt => {
        const isCorrect = opt.toLowerCase() === correctMood.toLowerCase();
        let bg:     string = C.white;
        let border: string = C.border;
        let color:  string = C.dark;

        if (picked !== null) {
          if (opt === picked && isCorrect) {
            bg = C.greenLight; border = C.green; color = C.green;
          } else if (opt === picked && !isCorrect) {
            bg = C.redLight; border = C.red; color = C.red;
          } else if (isCorrect && picked !== null) {
            bg = C.greenLight; border = C.green; color = C.green;
          }
        }

        return (
          <button
            key={opt}
            onClick={() => handlePick(opt)}
            disabled={picked !== null}
            style={{
              background: bg, border: `1.5px solid ${border}`,
              borderRadius: 8, padding: '10px 14px',
              textAlign: 'left', cursor: picked !== null ? 'default' : 'pointer',
              fontFamily: FONTS.ui, fontSize: 13, fontWeight: 600, color,
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Local: TappablePassage ───────────────────────────────────────────────────

function TappablePassage({
  text,
  selected,
  onToggle,
}: {
  text: string;
  selected: string[];
  onToggle: (word: string) => void;
}) {
  const ranges = useMemo(() => findHighlightRanges(text, 'mood'), [text]);

  if (!text) return null;
  if (!ranges.length) return (
    <p style={{ fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8, color: C.dark }}>
      {text}
    </p>
  );

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(([start, end], i) => {
    if (start > cursor) {
      nodes.push(
        <span key={`t-${i}`} style={{ fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8, color: C.dark }}>
          {text.slice(cursor, start)}
        </span>,
      );
    }
    const word      = text.slice(start, end);
    const isTapped  = selected.includes(word);
    nodes.push(
      <button
        key={`w-${i}`}
        onClick={() => onToggle(word)}
        style={{
          background: isTapped ? C.green : C.greenLight,
          color:      isTapped ? C.white : C.green,
          border:     `1px dotted ${C.green}`,
          borderRadius: 3,
          padding: '0 3px',
          fontFamily: FONTS.passage,
          fontSize: 13,
          lineHeight: 1.8,
          cursor: 'pointer',
          display: 'inline',
          transition: 'all 0.15s',
        }}
      >
        {word}
      </button>,
    );
    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(
      <span key="t-tail" style={{ fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8, color: C.dark }}>
        {text.slice(cursor)}
      </span>,
    );
  }

  return <div style={{ lineHeight: 1.8 }}>{nodes}</div>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeachMoodPage() {
  const params       = useParams<{ standardId: string }>();
  const router       = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  // ── Session context ──────────────────────────────────────────────────────────
  const [studentId,    setStudentId]    = useState<string | null>(null);
  const [standardUuid, setStandardUuid] = useState<string | null>(null);
  const [sessionId,    setSessionId]    = useState<string | null>(null);

  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // ── Phase progression ────────────────────────────────────────────────────────
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3 | 4 | 5>(1);

  // ── Phase 1 ──────────────────────────────────────────────────────────────────
  const [scene_1_1_choice, setP1Choice] = useState<'a' | 'b' | null>(null);
  const [phase_1_complete, setP1Done]   = useState(false);

  // ── Phase 2 ──────────────────────────────────────────────────────────────────
  const [scene_2_1_choice, setP2Choice]   = useState<'a' | 'b' | 'c' | null>(null);
  const [element_picks,    setElementPicks] = useState<string[]>([]);
  const [phase_2_complete, setP2Done]     = useState(false);
  // UI sub-step: 1 = scene choice, 2 = tap words, 3 = 4 elements
  const [p2SubStep, setP2SubStep] = useState<1 | 2 | 3>(1);
  const [expandedElement, setExpandedElement] = useState<string | null>(null);

  // ── Phase 3 ──────────────────────────────────────────────────────────────────
  const [pattern_matches, setPatternMatches] = useState<Record<string, string>>({});
  const [phase_3_complete, setP3Done]        = useState(false);
  const [p3SubStep,   setP3SubStep]  = useState<1 | 2 | 3>(1);
  const [p3Match1Choice, setP3Match1Choice] = useState<string | null>(null);
  const [p3Match1Wrong,  setP3Match1Wrong]  = useState(false);
  const [p3Match2Choice, setP3Match2Choice] = useState<string | null>(null);
  const [p3Match2Wrong,  setP3Match2Wrong]  = useState(false);

  // ── Phase 4 ──────────────────────────────────────────────────────────────────
  const [p4IntroAcked,       setP4IntroAcked]  = useState(false);
  const [step_4_1_notice,    setNotice]         = useState<string | null>(null);
  const [step_4_1_attempts,  setStep41Attempts] = useState(0);
  const [step_4_2_name,      setName]           = useState<string | null>(null);
  const [step_4_2_attempts,  setStep42Attempts] = useState(0);
  const [step_4_3_defend_words, setDefendWords] = useState<string[]>([]);
  const [phase_4_complete,   setP4Done]         = useState(false);

  // ── Phase 5 ──────────────────────────────────────────────────────────────────
  const [transferPassage,     setTransferPassage]     = useState<TransferPassageData | null>(null);
  const [transfer_choice,     setTransferChoice]      = useState<string | null>(null);
  const [transfer_correct,    setTransferCorrect]     = useState<boolean | null>(null);
  const [transferUnavailable, setTransferUnavailable] = useState(false);

  // ── Submission ───────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Trigger question ─────────────────────────────────────────────────────────
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null, standardCode, CLASSIFICATION,
  );
  const passageText   = triggerQ?.passageText   ?? '';
  const passageTitle  = triggerQ?.passageTitle  ?? '';
  const passageAuthor = triggerQ?.passageAuthor ?? '';

  const highlightRanges = useMemo(
    () => findHighlightRanges(passageText, 'mood'),
    [passageText],
  );
  const markStyle: React.CSSProperties = {
    background: C.greenLight, color: C.green, borderRadius: 2, padding: '0 2px',
  };

  const passagePanelRef = useRef<HTMLDivElement>(null);
  function jumpToHighlight() {
    passagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Transfer passage text (Phase 5 passage panel) ────────────────────────────
  const transferText = transferPassage ? extractPassage(transferPassage.content) : '';
  const transferHighlightRanges = useMemo(
    () => findHighlightRanges(transferText, 'mood'),
    [transferText],
  );
  const transferPassagePanelRef = useRef<HTMLDivElement>(null);

  // ── Session init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();
        const { data: student } = await supabase
          .from('students').select('id').eq('user_id', user!.id).maybeSingle();
        const sid = student?.id ?? null;
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
      } catch (err) { console.error('[TeachMood] init error:', err); }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // ── Phase 5 entry: fetch transfer passage ────────────────────────────────────
  useEffect(() => {
    if (currentPhase !== 5) return;
    if (!standardUuid || !triggerQ?.questionId) {
      setTransferUnavailable(true);
      return;
    }

    fetchTransferPassage(standardUuid, triggerQ.questionId)
      .then(row => {
        if (!row) { setTransferUnavailable(true); return; }

        // Resolve canonical mood
        const fromCol  = (row as { canonical_mood?: string | null }).canonical_mood;
        const fromMap  = getCanonicalMood(row.id);
        const resolved = fromCol || fromMap;

        if (!resolved) {
          setTransferUnavailable(true);
        } else {
          setTransferPassage(row);
        }
      })
      .catch(() => setTransferUnavailable(true));
  }, [currentPhase, standardUuid, triggerQ?.questionId]);

  // ── Completion handler ───────────────────────────────────────────────────────
  async function handleCTA() {
    if (submitting) return;
    setSubmitting(true);

    const phase5Value = transferUnavailable ? 'unmeasured' : String(transfer_correct);

    const studentResponse = [
      `Phase1:scene_${scene_1_1_choice}`,
      `Phase2:element_picks=${element_picks.join(',')}`,
      `Phase3:matches=${Object.values(pattern_matches).join(',')}`,
      `Phase4:notice=${step_4_1_notice},name=${step_4_2_name},defend=${step_4_3_defend_words.join(',')}`,
      `Phase4_scaffolds:step1_attempts=${step_4_1_attempts},step2_attempts=${step_4_2_attempts}`,
      `Phase5:transferred=${phase5Value}`,
    ].join(' | ');

    try {
      await fetch('/api/responses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:              sessionId,
          student_id:              studentId,
          standard_id:             standardUuid,
          cognitive_skill_targeted: COGNITIVE_SKILL,
          intervention_type:       INTERVENTION_TYPE,
          student_response:        studentResponse,
          mastery_achieved:        false,
        }),
      });

      if (transfer_correct === true && sessionId) {
        const supabase = createClient();
        await supabase.rpc('append_teach_phase', {
          p_session_id: sessionId,
          p_phase: 'mood',
        });
      }
    } catch (err) {
      console.error('[TeachMood] response write error:', err);
    }

    router.push(`/standard/${standardId}/practice`);
  }

  // ── Phase 4.1/4.2 scaffold helpers ───────────────────────────────────────────
  const P4_1_ACCEPTABLE = ['Tense', 'Ominous'];
  const P4_2_ACCEPTABLE = ['Suspenseful', 'Anxious'];

  const p4_1_narrowed = step_4_1_attempts >= 1;
  const p4_2_narrowed = step_4_2_attempts >= 1;

  function handle41Chip(label: string) {
    const correct = P4_1_ACCEPTABLE.includes(label);
    if (correct) {
      setNotice(label);
    } else {
      const next = step_4_1_attempts + 1;
      setStep41Attempts(next);
      if (next >= 2) {
        // Force-pick the first acceptable
        setNotice(P4_1_ACCEPTABLE[0]);
      }
    }
  }

  function handle42Chip(label: string) {
    const correct = P4_2_ACCEPTABLE.includes(label);
    if (correct) {
      setName(label);
    } else {
      const next = step_4_2_attempts + 1;
      setStep42Attempts(next);
      if (next >= 2) {
        setName(P4_2_ACCEPTABLE[0]);
      }
    }
  }

  function toggleDefendWord(word: string) {
    setDefendWords(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word],
    );
  }

  // ── Gogi content ─────────────────────────────────────────────────────────────
  type GogiContent = { state: 'neutral' | 'engaged' | 'celebrate'; copy: React.ReactNode };

  function getGogiContent(): GogiContent {
    if (currentPhase === 1) {
      if (!scene_1_1_choice) {
        return {
          state: 'engaged',
          copy: 'Two scenes. Both are true. Tap the one that makes YOU feel heavier. No wrong answer — I want your gut.',
        };
      }
      return {
        state: 'engaged',
        copy: (
          <>
            <p style={{ margin: '0 0 8px' }}>Here&rsquo;s the trick.</p>
            <p style={{ margin: '0 0 8px' }}>
              Nobody in Scene B is sad. Yet the scene feels sad anyway.
            </p>
            <p style={{ margin: 0 }}>
              That feeling is called <strong>MOOD</strong>. It&rsquo;s what the writing
              creates in <strong>YOU</strong> — not what a character is feeling. These are
              two different things, and they don&rsquo;t always match.
            </p>
          </>
        ),
      };
    }

    if (currentPhase === 2) {
      if (p2SubStep === 1) {
        return {
          state: 'engaged',
          copy: 'Writers build mood with specific choices. Same event, three different versions. Tap the one that feels scariest.',
        };
      }
      if (p2SubStep === 2) {
        return {
          state: 'engaged',
          copy: element_picks.length > 0
            ? 'Those are mood words. Writers pick them on purpose.'
            : 'What made that last one scary? Tap the words doing the work.',
        };
      }
      return {
        state: 'engaged',
        copy: 'Writers use four main moves to build mood. Each one is a choice. Learn the names — they matter.',
      };
    }

    if (currentPhase === 3) {
      if (p3SubStep === 1) {
        return {
          state: 'engaged',
          copy: 'Three moods come up all the time. Each has a signature — a way writers build it.',
        };
      }
      if (p3SubStep === 2) {
        if (p3Match1Wrong && !p3Match1Choice) {
          return {
            state: 'engaged',
            copy: 'Not quite. Look at "something small moved" — she doesn\'t know what it is. That\'s an ominous signature. Try again.',
          };
        }
        if (p3Match1Choice) {
          return { state: 'celebrate', copy: 'That\'s the ominous signature: unexplained details and slow pacing.' };
        }
        return { state: 'engaged', copy: 'Read this. Which mood is the writer building?' };
      }
      if (p3SubStep === 3) {
        if (p3Match2Wrong && !p3Match2Choice) {
          return {
            state: 'engaged',
            copy: 'Look again. Short sentences. Held breath. A single creak. That\'s the tense signature. Try again.',
          };
        }
        if (p3Match2Choice) {
          return { state: 'celebrate', copy: 'That\'s the tense signature: silence, short sentences, what\'s unsaid.' };
        }
        return { state: 'engaged', copy: 'One more. Same idea — which mood?' };
      }
    }

    if (currentPhase === 4) {
      if (!p4IntroAcked) {
        return {
          state: 'engaged',
          copy: 'This passage is the one that tripped you in the diagnostic. We\'re going to run Mood Read on it. Three steps: Notice, Name, Defend.',
        };
      }
      if (!step_4_1_notice) {
        if (step_4_1_attempts === 0) {
          return { state: 'engaged', copy: 'Step 1 — Notice. What feeling is this passage creating in YOU?' };
        }
        if (step_4_1_attempts === 1) {
          const kw = triggerQ?.keywordFlags?.slice(0, 2).join(', ') ?? 'those words';
          return { state: 'engaged', copy: `Look at ${kw}. Those feel heavy. Try again.` };
        }
        return { state: 'engaged', copy: `This is a tense passage — the details are tight, everything feels like something's about to happen. Tap Tense to continue.` };
      }
      if (!step_4_2_name) {
        if (step_4_2_attempts === 0) {
          return { state: 'engaged', copy: 'Step 2 — Name. Which specific mood word fits best?' };
        }
        if (step_4_2_attempts === 1) {
          return { state: 'engaged', copy: 'Think about the quality of the tension — is it building toward something? Try again.' };
        }
        return { state: 'engaged', copy: 'The most precise label here is Suspenseful — it captures something about to happen. Tap Suspenseful to continue.' };
      }
      return {
        state: 'engaged',
        copy: 'Step 3 — Defend your call. Tap 2 words in the passage that build that mood.',
      };
    }

    if (currentPhase === 5) {
      if (transferUnavailable) {
        return {
          state: 'neutral',
          copy: "You've run the move. Nice work. We'll check transfer on a fresh passage in your next block.",
        };
      }
      if (transfer_correct === true)  return { state: 'celebrate', copy: "Nailed it. Mood Read — you've got it." };
      if (transfer_correct === false) return { state: 'neutral', copy: "Not yet. The move needs a few more reps. We'll come back to mood in your next block with a different passage." };
      return { state: 'engaged', copy: "New passage. You haven't seen this one. Run Mood Read on it." };
    }

    return { state: 'neutral', copy: '' };
  }

  const gogiContent = getGogiContent();

  // ── Phase 4 step indicator ────────────────────────────────────────────────────
  const p4ActiveStep = !step_4_1_notice ? 1 : !step_4_2_name ? 2 : 3;

  // ── Shared card style ─────────────────────────────────────────────────────────
  const sceneCardStyle = (selected: boolean): React.CSSProperties => ({
    border: `1px solid ${selected ? C.green : C.border}`,
    borderRadius: 8,
    padding: 16,
    cursor: 'pointer',
    background: selected ? C.greenLight : C.white,
    fontSize: 13,
    color: C.dark,
    fontFamily: FONTS.passage,
    lineHeight: 1.6,
    transition: 'all 0.15s',
    textAlign: 'left',
    width: '100%',
  });

  const chipStyle = (active: boolean, disabled = false): React.CSSProperties => ({
    border: `1px solid ${active ? C.green : C.border}`,
    borderRadius: 20,
    padding: '6px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? C.green : C.white,
    color: active ? C.white : C.dark,
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s',
  });

  const ctaStyle: React.CSSProperties = {
    background: C.blue, color: C.white, border: 'none',
    borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: FONTS.ui, marginTop: 12, width: '100%',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: C.gray,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  };

  // ── Passage panel props for Phase 5 swap ─────────────────────────────────────
  const showTransferPassage = currentPhase === 5 && !transferUnavailable && transferPassage;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.white, fontFamily: FONTS.ui }}>
      <TeachNav standardCode={standardCode} navLabel={NAV_LABEL} layerColor={C.greenBorder} />

      <div className="teach-3col">

        {/* ── COL 1: PASSAGE ─────────────────────────────────────────────── */}
        {showTransferPassage ? (
          <PassagePanel
            passageTitle={transferPassage.title ?? 'Literary Passage'}
            passageAuthor={transferPassage.author ?? 'Public Domain'}
            passageText={transferText}
            ranges={transferHighlightRanges}
            markStyle={markStyle}
            onJump={() => transferPassagePanelRef.current?.querySelector('mark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            panelRef={transferPassagePanelRef}
            loading={false}
            loadTimeout={true}
          />
        ) : (
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
        )}

        {/* ── COL 2: GOGI COACHING ───────────────────────────────────────── */}
        <div style={{
          flex: '0 0 35%', borderRight: `1px solid ${C.border}`,
          padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box',
        }}>
          <div style={sectionLabel}>GOGI COACHING</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <GogiAvatar size={36} state={gogiContent.state} />
            <GogiBubble state={gogiContent.state}>
              {gogiContent.copy}
            </GogiBubble>
          </div>
        </div>

        {/* ── COL 3: INTERVENTION CARD ───────────────────────────────────── */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

          {/* ══ PHASE 1 ══════════════════════════════════════════════════════ */}
          {currentPhase === 1 && (
            <div>
              <div style={sectionLabel}>PHASE 1 — FOUNDATION CHECK</div>

              {/* Screen 1.1 — scene cards */}
              {!scene_1_1_choice && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button style={sceneCardStyle(false)} onClick={() => setP1Choice('a')}>
                    <strong style={{ display: 'block', marginBottom: 6, fontSize: 11, color: C.gray }}>SCENE A</strong>
                    &ldquo;Sarah laughed at the joke. Her friend grinned back, and the kitchen filled with sunlight.&rdquo;
                  </button>
                  <button style={sceneCardStyle(false)} onClick={() => setP1Choice('b')}>
                    <strong style={{ display: 'block', marginBottom: 6, fontSize: 11, color: C.gray }}>SCENE B</strong>
                    &ldquo;The abandoned playground sat silent in the rain. No one had been there in weeks.&rdquo;
                  </button>
                </div>
              )}

              {/* Screen 1.2 — the reveal */}
              {scene_1_1_choice && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    <button style={sceneCardStyle(scene_1_1_choice === 'a')} disabled>
                      <strong style={{ display: 'block', marginBottom: 6, fontSize: 11, color: C.gray }}>SCENE A</strong>
                      &ldquo;Sarah laughed at the joke. Her friend grinned back, and the kitchen filled with sunlight.&rdquo;
                    </button>
                    <button style={sceneCardStyle(scene_1_1_choice === 'b')} disabled>
                      <strong style={{ display: 'block', marginBottom: 6, fontSize: 11, color: C.gray }}>SCENE B</strong>
                      &ldquo;The abandoned playground sat silent in the rain. No one had been there in weeks.&rdquo;
                    </button>
                  </div>

                  {/* Distinction card */}
                  <div style={{
                    background: C.greenLight,
                    borderLeft: `3px solid ${C.green}`,
                    padding: '14px 16px',
                    borderRadius: '0 6px 6px 0',
                    marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 13, color: C.dark, marginBottom: 6 }}>
                      <strong>MOOD</strong> = what the writing makes <strong>YOU</strong> feel
                    </div>
                    <div style={{ fontSize: 13, color: C.dark, marginBottom: 6 }}>
                      <strong>CHARACTER EMOTION</strong> = what a character feels
                    </div>
                    <div style={{ fontSize: 13, color: C.dark, fontWeight: 700 }}>
                      These are not the same thing.
                    </div>
                  </div>

                  <button
                    style={ctaStyle}
                    onClick={() => { setP1Done(true); setCurrentPhase(2); }}
                  >
                    I got it — next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══ PHASE 2 ══════════════════════════════════════════════════════ */}
          {currentPhase === 2 && (
            <div>
              <div style={sectionLabel}>PHASE 2 — NAME THE ELEMENTS</div>

              {/* Screen 2.1 — three scene versions */}
              {p2SubStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(['a', 'b', 'c'] as const).map((opt, i) => {
                    const texts = [
                      'A breeze danced through the sunlit leaves.',
                      'The wind moved through the trees.',
                      'A cold wind rattled through the dead oaks.',
                    ];
                    const labels = ['VERSION A', 'VERSION B', 'VERSION C'];
                    return (
                      <button
                        key={opt}
                        style={sceneCardStyle(scene_2_1_choice === opt)}
                        onClick={() => { setP2Choice(opt); setP2SubStep(2); }}
                      >
                        <strong style={{ display: 'block', marginBottom: 6, fontSize: 11, color: C.gray }}>
                          {labels[i]}
                        </strong>
                        &ldquo;{texts[i]}&rdquo;
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Screen 2.2 — tap mood words */}
              {p2SubStep === 2 && (
                <div>
                  <p style={{ fontSize: 13, color: C.dark, marginBottom: 14 }}>
                    What made that last one scary? Tap the words doing the work.
                  </p>
                  <div style={{
                    fontFamily: FONTS.passage,
                    fontSize: 14,
                    lineHeight: 2.2,
                    marginBottom: 14,
                  }}>
                    {'A '}
                    {(['cold', 'rattled', 'dead'] as const).map(word => {
                      const tapped = element_picks.includes(word);
                      return (
                        <button
                          key={word}
                          onClick={() => setElementPicks(prev =>
                            prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word],
                          )}
                          style={{
                            background: tapped ? C.green : C.greenLight,
                            color: tapped ? C.white : C.green,
                            border: `1px dotted ${C.green}`,
                            borderRadius: 3,
                            padding: '0 4px',
                            fontFamily: FONTS.passage,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'inline',
                          }}
                        >
                          {word}
                        </button>
                      );
                    })}
                    {' wind through the oaks.'}
                  </div>

                  {element_picks.length > 0 && (
                    <button style={ctaStyle} onClick={() => setP2SubStep(3)}>
                      Show me the four moves →
                    </button>
                  )}
                </div>
              )}

              {/* Screen 2.3 — 4 elements */}
              {p2SubStep === 3 && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {[
                      { term: 'DICTION',  gloss: 'the words the author picks (cold vs warm, heavy vs light)', tooltip: 'Every word the author chose could have been different. The mood comes from those specific choices — not the general situation.' },
                      { term: 'IMAGERY',  gloss: 'what you see, hear, smell, touch', tooltip: 'Sensory details bypass logic. When you smell rain or feel cold, you feel something before you think anything.' },
                      { term: 'OMISSION', gloss: 'what the author leaves out on purpose', tooltip: 'Silence is a technique. What the author doesn\'t say — doesn\'t explain, doesn\'t resolve — creates unease or longing.' },
                      { term: 'RHYTHM',   gloss: 'short sharp sentences or long slow ones', tooltip: 'Short sentences speed you up. Long sentences slow you down. That pacing is a mood dial the author controls.' },
                    ].map(({ term, gloss, tooltip }) => (
                      <div key={term}>
                        <button
                          onClick={() => setExpandedElement(expandedElement === term ? null : term)}
                          style={{
                            border: `1px solid ${C.border}`,
                            borderLeft: `3px solid ${C.green}`,
                            borderRadius: '0 8px 8px 0',
                            padding: '12px 14px',
                            background: C.white,
                            width: '100%',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: FONTS.ui,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: C.green }}>{term}</span>
                          {' '}
                          <span style={{ color: C.gray, fontSize: 12 }}>— {gloss}</span>
                          <span style={{ float: 'right', color: C.gray, fontSize: 11 }}>
                            {expandedElement === term ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedElement === term && (
                          <div style={{
                            background: C.light, borderRadius: '0 0 8px 8px',
                            padding: '10px 14px', fontSize: 12, color: C.dark,
                            lineHeight: 1.6, marginTop: -1,
                          }}>
                            {tooltip}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    style={ctaStyle}
                    onClick={() => { setP2Done(true); setCurrentPhase(3); }}
                  >
                    Show me how to spot these →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══ PHASE 3 ══════════════════════════════════════════════════════ */}
          {currentPhase === 3 && (
            <div>
              <div style={sectionLabel}>PHASE 3 — PATTERN RECOGNITION</div>

              {/* Screen 3.1 — three signatures */}
              {p3SubStep === 1 && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {(['tense', 'melancholy', 'ominous'] as const).map(key => (
                      <div key={key} style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${C.green}`,
                        borderRadius: '0 8px 8px 0', padding: '12px 14px',
                      }}>
                        <div style={{ fontWeight: 600, color: C.green, textTransform: 'uppercase', fontSize: 12, marginBottom: 4 }}>
                          {key}
                        </div>
                        <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.6 }}>
                          {MOOD_SIGNATURES[key].description}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button style={ctaStyle} onClick={() => setP3SubStep(2)}>
                    Now you try →
                  </button>
                </div>
              )}

              {/* Screen 3.2 — match ominous */}
              {p3SubStep === 2 && (
                <div>
                  <div style={{
                    background: C.light, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: 14, marginBottom: 14,
                    fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8, color: C.dark,
                    fontStyle: 'italic',
                  }}>
                    &ldquo;{MOOD_SIGNATURES.ominous.matchExcerpt}&rdquo;
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {['Tense', 'Melancholy', 'Ominous'].map(opt => (
                      <button
                        key={opt}
                        disabled={!!p3Match1Choice}
                        style={chipStyle(p3Match1Choice === opt, !!p3Match1Choice && p3Match1Choice !== opt)}
                        onClick={() => {
                          if (opt === 'Ominous') {
                            setP3Match1Choice(opt);
                            setPatternMatches(prev => ({ ...prev, match1: opt }));
                          } else {
                            setP3Match1Wrong(true);
                            setP3Match1Choice(null);
                          }
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {p3Match1Choice === 'Ominous' && (
                    <button style={ctaStyle} onClick={() => setP3SubStep(3)}>
                      Next →
                    </button>
                  )}
                </div>
              )}

              {/* Screen 3.3 — match tense */}
              {p3SubStep === 3 && (
                <div>
                  <div style={{
                    background: C.light, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: 14, marginBottom: 14,
                    fontFamily: FONTS.passage, fontSize: 13, lineHeight: 1.8, color: C.dark,
                    fontStyle: 'italic',
                  }}>
                    &ldquo;{MOOD_SIGNATURES.tense.matchExcerpt}&rdquo;
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {['Tense', 'Melancholy', 'Ominous'].map(opt => (
                      <button
                        key={opt}
                        disabled={!!p3Match2Choice}
                        style={chipStyle(p3Match2Choice === opt, !!p3Match2Choice && p3Match2Choice !== opt)}
                        onClick={() => {
                          if (opt === 'Tense') {
                            setP3Match2Choice(opt);
                            setPatternMatches(prev => ({ ...prev, match2: opt }));
                          } else {
                            setP3Match2Wrong(true);
                            setP3Match2Choice(null);
                          }
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {p3Match2Choice === 'Tense' && (
                    <button style={ctaStyle} onClick={() => { setP3Done(true); setCurrentPhase(4); }}>
                      Continue →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ PHASE 4 ══════════════════════════════════════════════════════ */}
          {currentPhase === 4 && (
            <div>
              <div style={sectionLabel}>PHASE 4 — RUN THE MOVE</div>

              {/* Step dots */}
              {p4IntroAcked && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                  {[1, 2, 3].map(dot => (
                    <div
                      key={dot}
                      style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: dot < p4ActiveStep
                          ? C.green
                          : dot === p4ActiveStep
                            ? C.green
                            : C.border,
                        opacity: dot < p4ActiveStep ? 0.5 : 1,
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 11, color: C.gray, marginLeft: 4 }}>
                    Step {p4ActiveStep} of 3
                  </span>
                </div>
              )}

              {/* 4.0 — Intro */}
              {!p4IntroAcked && (
                <div>
                  <div style={{
                    background: C.light, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: 14, marginBottom: 14,
                    fontSize: 13, color: C.dark, lineHeight: 1.6,
                  }}>
                    Three steps: <strong>Notice → Name → Defend.</strong> Look at the passage on the left as you work through each step.
                  </div>
                  <button style={ctaStyle} onClick={() => setP4IntroAcked(true)}>
                    Let&rsquo;s go →
                  </button>
                </div>
              )}

              {/* 4.1 — Notice */}
              {p4IntroAcked && !step_4_1_notice && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10 }}>
                    STEP 1 — NOTICE
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(step_4_1_attempts >= 1
                      ? ['Peaceful', P4_1_ACCEPTABLE[0]]
                      : ['Peaceful', 'Tense', 'Hopeful', 'Ominous']
                    ).map(label => {
                      const forceCorrectOnly = step_4_1_attempts >= 2;
                      const isCorrect        = P4_1_ACCEPTABLE.includes(label);
                      const disabled         = forceCorrectOnly && !isCorrect;
                      return (
                        <button
                          key={label}
                          disabled={disabled}
                          style={chipStyle(false, disabled)}
                          onClick={() => handle41Chip(label)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4.2 — Name */}
              {p4IntroAcked && step_4_1_notice && !step_4_2_name && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10 }}>
                    STEP 2 — NAME
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(step_4_2_attempts >= 1
                      ? ['Lonely', P4_2_ACCEPTABLE[0]]
                      : ['Suspenseful', 'Lonely', 'Threatening', 'Anxious']
                    ).map(label => {
                      const forceCorrectOnly = step_4_2_attempts >= 2;
                      const isCorrect        = P4_2_ACCEPTABLE.includes(label);
                      const disabled         = forceCorrectOnly && !isCorrect;
                      return (
                        <button
                          key={label}
                          disabled={disabled}
                          style={chipStyle(false, disabled)}
                          onClick={() => handle42Chip(label)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4.3 — Defend */}
              {p4IntroAcked && step_4_1_notice && step_4_2_name && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10 }}>
                    STEP 3 — DEFEND
                  </div>
                  <div style={{
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: 12, marginBottom: 12, background: C.light,
                  }}>
                    <TappablePassage
                      text={passageText}
                      selected={step_4_3_defend_words}
                      onToggle={toggleDefendWord}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: C.gray, margin: '0 0 10px' }}>
                    {step_4_3_defend_words.length} / 2 words selected
                  </p>
                  {step_4_3_defend_words.length >= 2 && (
                    <button
                      style={ctaStyle}
                      onClick={() => {
                        setP4Done(true);
                        setCurrentPhase(5);
                      }}
                    >
                      I&rsquo;ve run the move →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ PHASE 5 ══════════════════════════════════════════════════════ */}
          {currentPhase === 5 && (
            <div>
              <div style={sectionLabel}>PHASE 5 — TRANSFER CHECK</div>

              {/* Unavailable fallback */}
              {transferUnavailable && (
                <div>
                  <div style={{
                    background: C.light, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: 14, marginBottom: 14,
                    fontSize: 13, color: C.dark, lineHeight: 1.6,
                  }}>
                    Phases 1–4 complete. Transfer will be measured on a fresh passage in your next block.
                  </div>
                  <button
                    disabled={submitting}
                    style={{ ...ctaStyle, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
                    onClick={handleCTA}
                  >
                    Done — on to practice →
                  </button>
                </div>
              )}

              {/* Transfer MC */}
              {!transferUnavailable && transferPassage && (() => {
                const resolvedMood =
                  (transferPassage as { canonical_mood?: string | null }).canonical_mood ||
                  getCanonicalMood(transferPassage.id) ||
                  'Ominous'; // safety fallback (unreachable if setTransferUnavailable is correct)
                return (
                  <div>
                    <p style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>
                      The passage is in the left column. Read it, then tap the mood below.
                    </p>
                    <TransferCheckMC
                      correctMood={resolvedMood}
                      onComplete={correct => {
                        setTransferCorrect(correct);
                        setTransferChoice(correct ? resolvedMood : 'wrong');
                      }}
                    />
                    {transfer_correct !== null && (
                      <button
                        disabled={submitting}
                        style={{ ...ctaStyle, marginTop: 16, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
                        onClick={handleCTA}
                      >
                        Done — on to practice →
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Loading state */}
              {!transferUnavailable && !transferPassage && (
                <div style={{ fontSize: 13, color: C.gray, padding: 14 }}>
                  Loading transfer passage…
                </div>
              )}
            </div>
          )}

        </div>{/* end col 3 */}
      </div>

      <style>{TEACH_3COL_CSS(C.border)}</style>
    </div>
  );
}
