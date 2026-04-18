'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';

// ─── Phase machine ────────────────────────────────────────────────────────────

type ProfilePhase =
  | 'loading'
  | 'overview'
  | 'wm_intro'   | 'wm_show'    | 'wm_recall' | 'wm_between'
  | 'infer_intro' | 'infer_question'
  | 'vocab_intro' | 'vocab_word'
  | 'syntax_intro'| 'syntax_show'| 'syntax_answer'
  | 'saving'
  | 'complete';

// ─── Module 1 — Working Memory ────────────────────────────────────────────────

// 3 completely separate word sets — index 0/1/2 maps to wmRound 0/1/2
const ROUNDS: readonly string[][] = [
  // Round 1 — Common everyday words (easiest)
  ['dog',        'chair',    'blue',        'run',        'happy',  'street'],
  // Round 2 — Academic words (medium)
  ['theory',     'conflict', 'evidence',    'analyze',    'pattern','claim'],
  // Round 3 — Complex literary/abstract words (hardest)
  ['inevitable', 'contrast', 'perseverance','sequence',   'infer',  'abstract'],
];
const WM_ROUND_LABELS = ['Common Words', 'Academic Words', 'Complex Words'];
// Word Length Effect: longer, less familiar words need more encoding time
const WM_DURATIONS    = [6, 8, 10]; // Round 1 / 2 / 3 seconds

// ─── Module 2 — Inferencing Scenarios ────────────────────────────────────────

interface InferOption {
  key:            'A' | 'B' | 'C' | 'D';
  text:           string;
  classification: string;
  correct:        boolean;
}
interface InferScenario {
  text:     string;
  question: string;
  options:  InferOption[];
}

const INFER_SCENARIOS: InferScenario[] = [
  {
    text: 'Every morning Jaylen\'s mom packed his lunch. One Monday he opened his bag at school and found only an apple. He walked past the cafeteria line twice without stopping.',
    question: 'What does this most strongly suggest about Jaylen?',
    options: [
      { key: 'A', text: 'Jaylen wasn\'t hungry that day.',                                  classification: 'schema_deficit',   correct: false },
      { key: 'B', text: 'Jaylen was embarrassed and didn\'t want anyone to notice.',          classification: 'CORRECT',          correct: true  },
      { key: 'C', text: 'Jaylen forgot to tell his mom he wanted more food.',                classification: 'literal_misreading',correct: false },
      { key: 'D', text: 'Jaylen was saving money to buy something.',                         classification: 'schema_deficit',   correct: false },
    ],
  },
  {
    text: 'Maya practiced her speech every night for two weeks. On the day of the competition, she sat in the back row during the other speeches. When her name was called, she walked slowly to the front and spoke in a voice barely above a whisper.',
    question: 'What does Maya\'s behavior most strongly suggest?',
    options: [
      { key: 'A', text: 'Maya had not practiced enough for the competition.',                classification: 'literal_misreading',correct: false },
      { key: 'B', text: 'Maya was confident but wanted to seem modest.',                    classification: 'schema_deficit',   correct: false },
      { key: 'C', text: 'Maya\'s preparation was not enough to overcome her anxiety about performing.', classification: 'CORRECT', correct: true },
      { key: 'D', text: 'Maya did not want to win the competition.',                         classification: 'schema_deficit',   correct: false },
    ],
  },
  {
    text: 'Every year on his birthday, Mr. Rivera\'s students brought him cards and small gifts. This year, his desk was empty when he arrived. He straightened his papers three times before class started.',
    question: 'What does Mr. Rivera\'s behavior suggest?',
    options: [
      { key: 'A', text: 'Mr. Rivera was preparing for an important lesson.',                classification: 'literal_misreading',correct: false },
      { key: 'B', text: 'Mr. Rivera noticed the absence of gifts and felt hurt but tried to hide it.', classification: 'CORRECT', correct: true },
      { key: 'C', text: 'Mr. Rivera had forgotten it was his birthday.',                    classification: 'schema_deficit',   correct: false },
      { key: 'D', text: 'Mr. Rivera preferred a clean desk before teaching.',               classification: 'literal_misreading',correct: false },
    ],
  },
  {
    text: 'Keisha had applied to seven colleges. Six letters arrived in one week — all thin envelopes. She put them in a drawer without opening them and went for a three-mile run.',
    question: 'What does Keisha\'s action most strongly suggest?',
    options: [
      { key: 'A', text: 'Keisha was not interested in going to college.',                   classification: 'schema_deficit',   correct: false },
      { key: 'B', text: 'Keisha preferred running to reading mail.',                        classification: 'literal_misreading',correct: false },
      { key: 'C', text: 'Keisha already knew the thin envelopes meant rejection and wasn\'t ready to confirm it.', classification: 'CORRECT', correct: true },
      { key: 'D', text: 'Keisha was waiting for all seven letters before opening any.',     classification: 'literal_misreading',correct: false },
    ],
  },
  {
    text: 'After twenty years away, Carlos returned to his old neighborhood. The bodega on the corner was now a pharmacy. The park where he played baseball had new equipment and different faces. He stood on the sidewalk for a long time before walking in.',
    question: 'What does Carlos\'s hesitation most strongly suggest?',
    options: [
      { key: 'A', text: 'Carlos was lost and trying to remember the directions.',           classification: 'literal_misreading',correct: false },
      { key: 'B', text: 'Carlos was excited to see how much had changed.',                  classification: 'schema_deficit',   correct: false },
      { key: 'C', text: 'Carlos felt like a stranger in a place that used to be his.',     classification: 'CORRECT',          correct: true  },
      { key: 'D', text: 'Carlos was looking for someone he recognized.',                    classification: 'literal_misreading',correct: false },
    ],
  },
];

// ─── Module 3 — Vocabulary Breadth ───────────────────────────────────────────

interface VocabWord {
  word:          string;
  sentence:      string;
  verifyCorrect: string;
  verifyWrong:   string;
}

const VOCAB_WORDS: VocabWord[] = [
  { word: 'analyze',     sentence: 'The scientist needed to analyze the data before drawing conclusions.',                     verifyCorrect: 'To examine carefully to understand',           verifyWrong: 'To write a summary of something'                   },
  { word: 'evidence',    sentence: 'The lawyer presented evidence to support her argument.',                                    verifyCorrect: 'Facts that support a claim',                  verifyWrong: 'A strong personal opinion'                         },
  { word: 'contrast',    sentence: 'The teacher asked students to contrast the two characters.',                               verifyCorrect: 'To show how two things are different',         verifyWrong: 'To combine two ideas into one'                     },
  { word: 'significant', sentence: 'The discovery was significant because it changed everything.',                              verifyCorrect: 'Important or meaningful',                     verifyWrong: 'Very small or hard to notice'                      },
  { word: 'interpret',   sentence: 'How you interpret the poem depends on your own experience.',                               verifyCorrect: 'To explain the meaning of something',         verifyWrong: 'To memorize something exactly'                     },
  { word: 'consequence', sentence: 'Every choice has a consequence, whether good or bad.',                                     verifyCorrect: 'A result that follows from an action',         verifyWrong: 'A warning given before something happens'           },
  { word: 'perspective', sentence: 'From his perspective, the decision made perfect sense.',                                    verifyCorrect: 'A particular point of view',                  verifyWrong: 'A fact that everyone agrees on'                    },
  { word: 'explicit',    sentence: 'The instructions were explicit — follow each step in order.',                              verifyCorrect: 'Clearly and directly stated',                 verifyWrong: 'Hidden and difficult to find'                      },
  { word: 'implicit',    sentence: 'Her smile gave an implicit message that she approved.',                                    verifyCorrect: 'Suggested but not directly stated',           verifyWrong: 'Written out in complete detail'                    },
  { word: 'infer',       sentence: 'From the clues, we can infer what happened.',                                              verifyCorrect: 'To draw a conclusion from evidence',          verifyWrong: 'To clearly explain something step by step'         },
  { word: 'theme',       sentence: 'The theme of the story is sacrifice.',                                                     verifyCorrect: 'The central message about human experience',  verifyWrong: 'The main character in a story'                     },
  { word: 'structure',   sentence: 'The structure of the essay helped readers follow the argument.',                           verifyCorrect: 'The way something is organized or built',     verifyWrong: 'The topic sentence of a paragraph'                 },
  { word: 'purpose',     sentence: 'What is the author\'s purpose in writing this passage?',                                   verifyCorrect: 'The reason something was written or done',    verifyWrong: 'The ending of a piece of writing'                  },
  { word: 'convey',      sentence: 'The author uses imagery to convey emotion.',                                               verifyCorrect: 'To communicate or express something',         verifyWrong: 'To translate a language'                           },
  { word: 'develop',     sentence: 'How does the author develop the main character over time?',                                verifyCorrect: 'To build or expand something over time',       verifyWrong: 'To delete unnecessary information'                 },
  { word: 'central',     sentence: 'The central idea of the text is perseverance.',                                            verifyCorrect: 'Most important or main',                      verifyWrong: 'Located at the edge of something'                  },
  { word: 'support',     sentence: 'Find two details that support your claim.',                                                verifyCorrect: 'Evidence that backs up a claim',              verifyWrong: 'The introduction of an essay'                      },
  { word: 'relevant',    sentence: 'Only include relevant evidence in your response.',                                         verifyCorrect: 'Directly connected to the topic',             verifyWrong: 'Very recent or up to date'                         },
  { word: 'complex',     sentence: 'The sentence was too complex for her to follow.',                                          verifyCorrect: 'Having many connected parts or layers',       verifyWrong: 'Simple and easy to understand'                     },
  { word: 'abstract',    sentence: 'Freedom is an abstract concept — it means different things to different people.',         verifyCorrect: 'Existing as an idea, not a physical thing',   verifyWrong: 'A short summary at the start of an essay'          },
];

// ─── Module 4 — Syntax Complexity ────────────────────────────────────────────

interface SyntaxSentence {
  id:         number;
  text:       string;
  duration:   number;
  complexity: string;
}

const SYNTAX_SENTENCES: SyntaxSentence[] = [
  { id: 1, text: 'The boy ran away because he was scared.',                                                                                                                                                                           duration: 8,  complexity: 'Simple'   },
  { id: 2, text: 'She studied hard, but she still failed the test.',                                                                                                                                                                  duration: 9,  complexity: 'Compound' },
  { id: 3, text: 'Despite his best efforts to remain calm, the plan that Marcus had carefully prepared began to fall apart the moment he entered the room.',                                                                          duration: 11, complexity: 'Complex'  },
  { id: 4, text: 'The evidence presented by the author, while compelling, fails to account for the possibility that other factors may have contributed to the outcome.',                                                              duration: 13, complexity: 'Academic' },
  { id: 5, text: 'It was not the darkness itself that frightened her, but rather the silence that the darkness carried with it, heavy and absolute, pressing against her like something alive.',                                      duration: 15, complexity: 'Literary' },
];

// ─── Shared style helpers ─────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:   C.white,
  border:       `0.5px solid ${C.border}`,
  borderRadius: 12,
  padding:      '18px 20px',
};

const BTN_NAVY: React.CSSProperties = {
  background:   C.navy,
  color:        C.white,
  border:       'none',
  borderRadius: 10,
  padding:      '13px 24px',
  fontSize:     14,
  fontWeight:   700,
  cursor:       'pointer',
  fontFamily:   FONTS.ui,
  width:        '100%',
};

const BTN_BLUE: React.CSSProperties = {
  ...BTN_NAVY,
  background: C.blue,
};

function scoreColor(score: number) {
  if (score >= 75) return { bg: C.greenLight,  border: C.green, text: C.green };
  if (score >= 55) return { bg: C.amberLight,  border: C.amber, text: C.amber };
  return                   { bg: C.redLight,   border: C.red,   text: C.red   };
}

function riskColors(risk: 'low' | 'moderate' | 'high') {
  if (risk === 'low')      return { bg: C.greenLight, text: C.green };
  if (risk === 'moderate') return { bg: C.amberLight, text: C.amber };
  return                          { bg: C.redLight,   text: C.red   };
}

// ─── Module-scope nav + page wrapper ─────────────────────────────────────────
// These MUST live outside ReadingProfilePage so their identity is stable across
// re-renders. Defining them inside the parent causes React to treat them as new
// component types on every keystroke, unmounting the subtree and losing focus.

interface ProfileNavProps {
  phase:       ProfilePhase;
  displayName: string;
  moduleInfo:  { num: number; name: string } | null;
}

function ProfileNav({ phase, displayName, moduleInfo }: ProfileNavProps) {
  const router       = useRouter();
  const { role }     = useAuth();
  const timerPhase   = phase === 'wm_show' || phase === 'syntax_show';

  function handleHomeClick() {
    router.push(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
  }

  return (
    <div style={{
      background:     C.navy,
      height:         52,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 20px',
      fontFamily:     FONTS.ui,
      flexShrink:     0,
    }}>
      <button
        onClick={handleHomeClick}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '4px 8px', borderRadius: 6, transition: 'background 0.2s', textAlign: 'left' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        title="Back to dashboard"
      >
        {moduleInfo && (
          <div style={{ fontSize: 9, fontWeight: 700, color: C.blueMid, letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1.2 }}>
            READING PROFILE  |  MODULE {moduleInfo.num} OF 4
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: C.white, lineHeight: 1.3 }}>
          {moduleInfo ? moduleInfo.name : 'Reading Profile'}
        </div>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!timerPhase && (
          <button
            onClick={handleHomeClick}
            style={{ fontSize: 11, color: 'rgba(181,212,244,0.5)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: FONTS.ui, transition: 'color 0.2s', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = '#B5D4F4'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(181,212,244,0.5)'; }}
          >
            ← Dashboard
          </button>
        )}
        <div style={{ fontSize: 12, color: C.blueMid, fontWeight: 600 }}>
          {displayName}
        </div>
      </div>
    </div>
  );
}

interface ProfilePageProps {
  phase:       ProfilePhase;
  displayName: string;
  moduleInfo:  { num: number; name: string } | null;
  children:    React.ReactNode;
}

function ProfilePage({ phase, displayName, moduleInfo, children }: ProfilePageProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        input::placeholder, textarea::placeholder { color: #888780 !important; }
        textarea { direction: ltr !important; unicode-bidi: normal !important; text-align: left !important; writing-mode: horizontal-tb !important; }
      `}</style>
      <ProfileNav phase={phase} displayName={displayName} moduleInfo={moduleInfo} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReadingProfilePage() {
  const router   = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const initialized = useRef(false);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<ProfilePhase>('loading');
  const [studentId,   setStudentId]   = useState('');
  const [studentName, setStudentName] = useState('');

  // ── WM state ───────────────────────────────────────────────────────────────
  const [wmRound,     setWmRound]     = useState(0);
  const [wmInput,     setWmInput]     = useState('');
  const [wmTimerSec,  setWmTimerSec]  = useState(WM_DURATIONS[0]);
  const [wmLastScore, setWmLastScore] = useState(0); // for wm_between display
  const wmRoundScoresRef = useRef<number[]>([]);
  const wmTimerRef       = useRef<NodeJS.Timeout | null>(null);

  // ── Infer state ────────────────────────────────────────────────────────────
  const [inferIdx,      setInferIdx]      = useState(0);
  const [inferSelected, setInferSelected] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const inferCorrectRef = useRef(0);

  // ── Vocab state ────────────────────────────────────────────────────────────
  const [vocabIdx,         setVocabIdx]         = useState(0);
  const [vocabSelfAssess,  setVocabSelfAssess]  = useState<'know' | 'maybe' | 'no' | null>(null);
  const [vocabVerifyShown, setVocabVerifyShown] = useState(false);
  const [vocabVerifyAns,   setVocabVerifyAns]   = useState<'A' | 'B' | null>(null);
  type VocabResult = 'confirmed_know' | 'maybe' | 'no';
  const vocabResultsRef = useRef<VocabResult[]>([]);

  // ── Syntax state ───────────────────────────────────────────────────────────
  const [syntaxIdx,         setSyntaxIdx]         = useState(0);
  const [syntaxInput,       setSyntaxInput]       = useState('');
  const [syntaxPhase,       setSyntaxPhase]       = useState<'show' | 'answer'>('show');
  const [syntaxResponses,   setSyntaxResponses]   = useState<string[]>([]);
  const [syntaxTimeLeft,    setSyntaxTimeLeft]    = useState(SYNTAX_SENTENCES[0].duration);
  const [syntaxTimerActive, setSyntaxTimerActive] = useState(false);
  const syntaxTimerRef        = useRef<NodeJS.Timeout | null>(null);
  const syntaxScoringPromises = useRef<Promise<number>[]>([]);

  // ── Complete state ─────────────────────────────────────────────────────────
  const [finalScores,  setFinalScores]  = useState({ wm: 0, infer: 0, vocab: 0, syntax: 0 });
  const [overallRisk,  setOverallRisk]  = useState<'low' | 'moderate' | 'high'>('moderate');

  // ── Auth + init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user)           { router.push('/login');            return; }
    if (role === 'teacher') { router.push('/dashboard/teacher'); return; }
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      const supabase = createClient();
      const { data: student } = await supabase
        .from('students')
        .select('id, full_name, reading_profile_complete')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!student) { router.push('/login'); return; }
      // Already complete — skip to dashboard
      if ((student as { reading_profile_complete?: boolean }).reading_profile_complete) {
        router.push('/dashboard/student');
        return;
      }
      setStudentId(student.id);
      setStudentName((student as { full_name: string }).full_name ?? '');
      setPhase('overview');
    }
    init();
  }, [user, authLoading, role, router]);

  // ── Timer cleanup (both WM and Syntax) ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (wmTimerRef.current)     clearInterval(wmTimerRef.current);
      if (syntaxTimerRef.current) clearInterval(syntaxTimerRef.current);
    };
  }, []);

// ── WM handlers ────────────────────────────────────────────────────────────

  function startWmTimer(roundIdx: number) {
    const duration = WM_DURATIONS[roundIdx];
    setWmTimerSec(duration);
    if (wmTimerRef.current) clearInterval(wmTimerRef.current);
    wmTimerRef.current = setInterval(() => {
      setWmTimerSec(prev => {
        if (prev <= 1) {
          clearInterval(wmTimerRef.current!);
          wmTimerRef.current = null;
          setPhase('wm_recall');
          setWmInput('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function parseRecalledWords(input: string): string[] {
    return input.trim().split(/\s+/).filter(w => w.length > 0).map(w => w.toLowerCase());
  }

  function submitWmRecall() {
    const words  = ROUNDS[wmRound];
    const tokens = parseRecalledWords(wmInput);
    let count = 0;
    for (const token of tokens) {
      const t = token.slice(0, 4);
      if (words.some(w => w.slice(0, 4) === t)) count++;
    }
    const recalled = Math.min(count, words.length);
    wmRoundScoresRef.current = [...wmRoundScoresRef.current, recalled];
    setWmLastScore(recalled);
    setWmInput('');
    setPhase('wm_between');
  }

  // ── Infer handlers ─────────────────────────────────────────────────────────

  function submitInferAnswer() {
    if (!inferSelected) return;
    const scenario = INFER_SCENARIOS[inferIdx];
    const correct  = scenario.options.find(o => o.key === inferSelected)?.correct ?? false;
    if (correct) inferCorrectRef.current += 1;
    setInferSelected(null);

    if (inferIdx < 4) {
      setInferIdx(i => i + 1);
    } else {
      setPhase('vocab_intro');
    }
  }

  // ── Vocab handlers ─────────────────────────────────────────────────────────

  function handleVocabSelfAssess(val: 'know' | 'maybe' | 'no') {
    setVocabSelfAssess(val);
    setVocabVerifyShown(val === 'know');
    setVocabVerifyAns(null);
  }

  function advanceVocab() {
    let result: VocabResult;
    if (vocabSelfAssess === 'know') {
      result = vocabVerifyAns === 'A' ? 'confirmed_know' : 'maybe';
    } else if (vocabSelfAssess === 'maybe') {
      result = 'maybe';
    } else {
      result = 'no';
    }
    vocabResultsRef.current = [...vocabResultsRef.current, result];
    setVocabSelfAssess(null);
    setVocabVerifyShown(false);
    setVocabVerifyAns(null);

    if (vocabIdx < 19) {
      setVocabIdx(i => i + 1);
    } else {
      setPhase('syntax_intro');
    }
  }

  const vocabNextEnabled =
    vocabSelfAssess !== null &&
    !(vocabSelfAssess === 'know' && vocabVerifyAns === null);

  // ── Syntax handlers ────────────────────────────────────────────────────────

  function startSyntaxTimer(duration: number) {
    setSyntaxTimeLeft(duration);
    setSyntaxTimerActive(true);
    if (syntaxTimerRef.current) clearInterval(syntaxTimerRef.current);
    syntaxTimerRef.current = setInterval(() => {
      setSyntaxTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(syntaxTimerRef.current!);
          syntaxTimerRef.current = null;
          setSyntaxTimerActive(false);
          setSyntaxPhase('answer');
          setPhase('syntax_answer');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function scoreSentence(response: string, sentence: string): Promise<number> {
    try {
      const res = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:          'score_syntax_response',
          studentResponse: response || '(no response)',
          originalSentence: sentence,
        }),
      });
      const data = await res.json() as { text?: string };
      const n = parseInt((data.text ?? '').trim().slice(0, 1), 10);
      return isNaN(n) ? 0 : Math.min(2, Math.max(0, n));
    } catch {
      return response.trim().length > 5 ? 1 : 0;
    }
  }

  async function submitSyntaxAnswer() {
    const response = syntaxInput.trim();
    const sentence = SYNTAX_SENTENCES[syntaxIdx];

    const promise = scoreSentence(response, sentence.text);
    syntaxScoringPromises.current.push(promise);

    setSyntaxResponses(prev => [...prev, response]);
    setSyntaxInput('');

    if (syntaxIdx < 4) {
      const nextIdx = syntaxIdx + 1;
      setSyntaxIdx(nextIdx);
      setSyntaxPhase('show');
      startSyntaxTimer(SYNTAX_SENTENCES[nextIdx].duration);
      setPhase('syntax_show');
    } else {
      setPhase('saving');
      const scores = await Promise.all(syntaxScoringPromises.current);
      const total  = scores.reduce((a, b) => a + b, 0);
      await saveAndComplete(total);
    }
  }

  // ── Save + complete ────────────────────────────────────────────────────────

  async function saveAndComplete(syntaxTotal: number) {
    const wmTotal  = wmRoundScoresRef.current.reduce((a, b) => a + b, 0);
    const wmScore  = Math.round((wmTotal  / 18) * 100);
    const inferScore  = Math.round((inferCorrectRef.current / 5)  * 100);
    const vocabConfirmed = vocabResultsRef.current.filter(r => r === 'confirmed_know').length;
    const vocabScore  = Math.round((vocabConfirmed / 20) * 100);
    const syntaxScore = Math.round((syntaxTotal   / 10) * 100);

    // Vocabulary contamination signal — measures drop from Round 1 → Round 2
    // A drop > 30% suggests the student inflated Round 1 vocab self-assessment
    const round1Rate = (wmRoundScoresRef.current[0] ?? 0) / 6;
    const round2Rate = (wmRoundScoresRef.current[1] ?? 0) / 6;
    const dropRate   = round1Rate - round2Rate;
    const vocabContaminationSignal = dropRate > 0.3;

    const avg  = (wmScore + inferScore + vocabScore + syntaxScore) / 4;
    const risk: 'low' | 'moderate' | 'high' =
      avg >= 75 ? 'low' : avg >= 55 ? 'moderate' : 'high';

    setFinalScores({ wm: wmScore, infer: inferScore, vocab: vocabScore, syntax: syntaxScore });
    setOverallRisk(risk);

    try {
      const supabase = createClient();
      await Promise.all([
        supabase.from('cognitive_profiles').insert({
          student_id:          studentId,
          working_memory_r1:   wmRoundScoresRef.current[0] ?? 0,
          working_memory_r2:   wmRoundScoresRef.current[1] ?? 0,
          working_memory_r3:   wmRoundScoresRef.current[2] ?? 0,
          working_memory_score: wmScore,
          inferencing_score:   inferScore,
          vocab_breadth_score: vocabScore,
          syntax_score:        syntaxScore,
          overall_risk:               risk,
          vocab_contamination_signal: vocabContaminationSignal,
          raw_responses:              {
            wm_rounds:      wmRoundScoresRef.current,
            infer_correct:  inferCorrectRef.current,
            vocab_results:  vocabResultsRef.current,
            syntax_total:   syntaxTotal,
            drop_rate:      dropRate,
          },
        }),
        supabase
          .from('students')
          .update({ reading_profile_complete: true })
          .eq('id', studentId),
      ]);
    } catch (err) {
      console.error('[ReadingProfile] DB save error:', err);
    }

    setPhase('complete');
  }

  // ── Nav ────────────────────────────────────────────────────────────────────

  function getModuleInfo(): { num: number; name: string } | null {
    if (['wm_intro',    'wm_show', 'wm_recall', 'wm_between'].includes(phase)) return { num: 1, name: 'Working Memory'   };
    if (['infer_intro', 'infer_question'].includes(phase))                      return { num: 2, name: 'Inferencing'      };
    if (['vocab_intro', 'vocab_word'].includes(phase))                          return { num: 3, name: 'Vocabulary Breadth' };
    if (['syntax_intro','syntax_show', 'syntax_answer'].includes(phase))        return { num: 4, name: 'Sentence Complexity' };
    return null;
  }

  const moduleInfo = getModuleInfo();

  const nameParts   = studentName.trim().split(' ');
  const displayName = nameParts.length >= 2
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : (nameParts[0] ?? '');

  // ── Amber warning box ──────────────────────────────────────────────────────

  function Warning({ children }: { children: React.ReactNode }) {
    return (
      <div style={{
        background:   C.amberLight,
        border:       `0.5px solid ${C.amber}`,
        borderRadius: 8,
        padding:      '10px 12px',
        fontSize:     11,
        color:        '#633806',
        lineHeight:   1.6,
      }}>
        {children}
      </div>
    );
  }

  // ── Blue info box ──────────────────────────────────────────────────────────

  function InfoBox({ children }: { children: React.ReactNode }) {
    return (
      <div style={{
        background:   C.blueLight,
        border:       `0.5px solid ${C.blue}`,
        borderRadius: 8,
        padding:      '10px 12px',
        fontSize:     11,
        color:        C.navy,
        lineHeight:   1.6,
      }}>
        {children}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: loading
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <div style={{ color: C.gray, fontSize: 14 }}>Setting up your profile…</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: saving
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'saving') {
    return (
      <div style={{ minHeight: '100vh', background: C.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: FONTS.ui }}>
        <GogiAvatar size={64} state="engaged" />
        <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>Scoring your responses…</div>
        <div style={{ fontSize: 13, color: C.blueMid }}>This takes about 10 seconds.</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE: overview
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'overview') {
    const modules = [
      { num: 1, name: 'Working Memory',    sub: 'Remember words under time pressure · 3 min', active: true  },
      { num: 2, name: 'Inferencing',       sub: 'Read between the lines · 3 min',             active: false },
      { num: 3, name: 'Vocabulary Breadth',sub: 'Academic word knowledge · 3 min',            active: false },
      { num: 4, name: 'Sentence Complexity',sub:'Understanding complex sentences · 3 min',    active: false },
    ];

    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Your Reading Profile</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6, marginBottom: 20 }}>
            Complete all 4 modules before your first diagnostic.<br />
            Takes about 12 minutes total.
          </div>
        </div>

        {/* 4 module cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {modules.map(m => (
            <div key={m.num} style={{ ...CARD, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: C.navy,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.white, fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {m.num}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5, marginBottom: 6 }}>{m.sub}</div>
                <div style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  padding: '2px 8px', borderRadius: 4,
                  background: m.active ? C.blueLight  : C.light,
                  color:      m.active ? C.blue        : C.gray,
                  border:     `0.5px solid ${m.active ? C.blue : C.border}`,
                }}>
                  {m.active ? 'Active' : 'Pending'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Warning>
          <strong>Important:</strong> Do not write words down or photograph the screen during Module 1 or 4.
          These modules only work if you rely on your memory.
        </Warning>

        <button style={{ ...BTN_NAVY, marginTop: 16 }} onClick={() => setPhase('wm_intro')}>
          Start Module 1 — Working Memory →
        </button>
      </ProfilePage>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 1 — WORKING MEMORY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'wm_intro') {
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🧠</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Working Memory</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6, marginBottom: 16 }}>
            This module measures how well you hold information in your mind while reading.
          </div>

          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            {[
              'A set of words will appear. Study them carefully.',
              'Each round has a different time limit. The words disappear automatically when time runs out.',
              'Type as many words as you can remember. Spelling doesn\'t need to be perfect.',
              'You will do 3 rounds. Each round gets harder.',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: C.navy,
                  color: C.white, fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5 }}>{step}</div>
              </div>
            ))}
          </div>

          <Warning>
            Do not write words down or take a photo. This only works if you rely on your memory.
          </Warning>

          <button style={{ ...BTN_NAVY, marginTop: 16 }} onClick={() => {
            setWmRound(0);
            startWmTimer(0);
            setPhase('wm_show');
          }}>
            I understand — start Round 1 →
          </button>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'wm_show') {
    const words = ROUNDS[wmRound];
    console.log('[WM] Phase:', phase, 'Round:', wmRound, 'Words:', ROUNDS[wmRound]);
    const pct   = (wmTimerSec / WM_DURATIONS[wmRound]) * 100;
    const barColor = wmTimerSec <= 3 ? C.red : wmTimerSec <= 5 ? C.amber : C.blue;

    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          {/* Round badge */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
            Round {wmRound + 1} of 3 — {WM_ROUND_LABELS[wmRound]}
          </div>

          {/* Timer bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>
                Study these words carefully. They disappear when the timer runs out.
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: barColor, minWidth: 20, textAlign: 'right' }}>
                {wmTimerSec}
              </div>
            </div>
            <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.9s linear, background 0.3s' }} />
            </div>
          </div>

          {/* Word chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', padding: '20px 0' }}>
            {words.map(word => (
              <div key={word} style={{
                background:   C.navy,
                color:        C.white,
                padding:      '10px 18px',
                borderRadius: 8,
                fontSize:     16,
                fontFamily:   FONTS.passage,
                fontWeight:   600,
                letterSpacing: 0.5,
              }}>
                {word}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: C.gray, textAlign: 'center', marginTop: 4 }}>
            Timer is automatic — words disappear at zero
          </div>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'wm_recall') {
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
            Round {wmRound + 1} of 3 — Recall
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
            The words are gone. What do you remember?
          </div>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.6, marginBottom: 16 }}>
            Type the words you remember, separated by spaces. Spelling doesn&apos;t have to be perfect.
          </div>

          {/* 6 decorative placeholder boxes */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{
                width:        68,
                height:       44,
                border:       '2px dashed #CCCCCC',
                borderRadius: 8,
                background:   C.light,
              }} />
            ))}
          </div>

          <input
            type="text"
            autoFocus
            value={wmInput}
            onChange={e => setWmInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitWmRecall(); }}
            placeholder="Type the words you remember, separated by spaces"
            style={{
              width:        '100%',
              border:       '1.5px solid #CCCCCC',
              borderRadius: 8,
              padding:      '12px 14px',
              fontSize:     14,
              fontFamily:   FONTS.ui,
              boxSizing:    'border-box' as const,
              outline:      'none',
              color:        '#2C2C2A',
              background:   C.white,
              marginBottom: 12,
            }}
          />

          <button style={{ ...BTN_NAVY }} onClick={submitWmRecall}>
            Submit →
          </button>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'wm_between') {
    const isLastRound  = wmRound === 2;
    const nextRoundIdx = wmRound + 1;
    const nextLabel    = !isLastRound ? WM_ROUND_LABELS[nextRoundIdx] : '';
    const nextDuration = !isLastRound ? WM_DURATIONS[nextRoundIdx] : 0;
    const BTN_GREEN: React.CSSProperties = { ...BTN_NAVY, background: C.green };

    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            {isLastRound ? 'Round 3 Complete' : `Round ${wmRound + 1} Complete`}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
            {wmLastScore} / 6 words recalled
          </div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6, marginBottom: 20 }}>
            {isLastRound
              ? 'Working Memory module done. Moving to Module 2.'
              : `Round ${nextRoundIdx + 1} — ${nextDuration} seconds. ${nextLabel}. Ready?`}
          </div>
          {isLastRound ? (
            <button style={BTN_GREEN} onClick={() => setPhase('infer_intro')}>
              Continue to Module 2 →
            </button>
          ) : (
            <button style={BTN_NAVY} onClick={() => {
              setWmRound(nextRoundIdx);
              startWmTimer(nextRoundIdx);
              setPhase('wm_show');
            }}>
              Start Round {nextRoundIdx + 1} →
            </button>
          )}
        </div>
      </ProfilePage>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 2 — INFERENCING
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'infer_intro') {
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Inferencing</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6, marginBottom: 12 }}>
            Read each short scenario. Choose what it most strongly implies — not what it directly says.
          </div>
          <InfoBox>
            Pick the answer that reads between the lines. The correct answer is never a literal fact.
          </InfoBox>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <Warning>
              No literary vocabulary. Just real-life situations. If you miss these, it tells GOGI
              your inferencing gap is general — not just text-specific.
            </Warning>
          </div>
          <button style={BTN_NAVY} onClick={() => { setInferIdx(0); setInferSelected(null); setPhase('infer_question'); }}>
            Start →
          </button>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'infer_question') {
    const scenario = INFER_SCENARIOS[inferIdx];
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: C.gray, marginRight: 4 }}>Scenario {inferIdx + 1} of 5</div>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i < inferIdx ? C.green : i === inferIdx ? C.blue : C.border,
                border:     i === inferIdx ? `2px solid ${C.blue}` : 'none',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          {/* Scenario text */}
          <div style={{
            borderLeft:  `3px solid ${C.blue}`,
            paddingLeft: 12,
            marginBottom:16,
            fontFamily:  FONTS.passage,
            fontSize:    14,
            lineHeight:  1.7,
            color:       C.dark,
          }}>
            {scenario.text}
          </div>

          {/* Question */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 12 }}>
            {scenario.question}
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {scenario.options.map(opt => {
              const sel = inferSelected === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setInferSelected(opt.key)}
                  style={{
                    background:   sel ? C.blueLight  : C.white,
                    border:       `${sel ? 2 : 1}px solid ${sel ? C.blue : C.border}`,
                    borderRadius: 8,
                    padding:      '10px 14px',
                    fontSize:     13,
                    color:        sel ? C.navy : C.dark,
                    fontWeight:   sel ? 700 : 400,
                    cursor:       'pointer',
                    textAlign:    'left',
                    fontFamily:   FONTS.ui,
                    transition:   'all 0.15s',
                    display:      'flex',
                    gap:          10,
                    alignItems:   'flex-start',
                  }}
                >
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>{opt.key}.</span>
                  {opt.text}
                </button>
              );
            })}
          </div>

          <button
            style={{ ...BTN_NAVY, opacity: inferSelected ? 1 : 0.4, cursor: inferSelected ? 'pointer' : 'not-allowed' }}
            disabled={!inferSelected}
            onClick={submitInferAnswer}
          >
            Next →
          </button>
        </div>
      </ProfilePage>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 3 — VOCABULARY BREADTH
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'vocab_intro') {
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Vocabulary Breadth</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6, marginBottom: 12 }}>
            20 academic words. For each: tell GOGI how well you know it.
          </div>
          <InfoBox>
            If you say you know a word, you'll get a quick check. Be honest — there's no grade.
            GOGI uses this to set up the right support for you.
          </InfoBox>
          <button style={{ ...BTN_NAVY, marginTop: 16 }} onClick={() => { setVocabIdx(0); setVocabSelfAssess(null); setVocabVerifyShown(false); setVocabVerifyAns(null); setPhase('vocab_word'); }}>
            Start →
          </button>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'vocab_word') {
    const wordData = VOCAB_WORDS[vocabIdx];

    // Chip colors for progress row
    function chipStyle(i: number): React.CSSProperties {
      if (i < vocabResultsRef.current.length) {
        const r = vocabResultsRef.current[i];
        return {
          background:   r === 'confirmed_know' ? C.greenLight : r === 'maybe' ? C.amberLight : C.redLight,
          border:       `0.5px solid ${r === 'confirmed_know' ? C.green : r === 'maybe' ? C.amber : C.red}`,
          color:        r === 'confirmed_know' ? C.green : r === 'maybe' ? C.amber : C.red,
          fontSize:     9,
          fontWeight:   600,
          padding:      '2px 4px',
          borderRadius: 4,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap' as const,
          maxWidth:     44,
        };
      }
      if (i === vocabIdx) {
        return {
          background: C.blueLight, border: `1.5px solid ${C.blue}`,
          color: C.navy, fontSize: 9, fontWeight: 700,
          padding: '2px 4px', borderRadius: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 44,
        };
      }
      return {
        background: C.light, border: `0.5px solid ${C.border}`,
        width: 14, height: 14, borderRadius: 3,
      };
    }

    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          {/* Word count */}
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 10 }}>Word {vocabIdx + 1} of 20</div>

          {/* Progress chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 16 }}>
            {VOCAB_WORDS.map((w, i) => (
              <div key={i} style={chipStyle(i)}>
                {i < vocabResultsRef.current.length || i === vocabIdx ? w.word.slice(0,6) : ''}
              </div>
            ))}
          </div>

          {/* Big word */}
          <div style={{
            fontSize:    28,
            fontWeight:  700,
            color:       C.navy,
            fontFamily:  FONTS.passage,
            textAlign:   'center',
            marginBottom:6,
          }}>
            {wordData.word}
          </div>

          {/* Example sentence */}
          <div style={{ fontSize: 12, fontStyle: 'italic', color: C.gray, lineHeight: 1.6, textAlign: 'center', marginBottom: 20 }}>
            {wordData.sentence}
          </div>

          {/* Self-assessment buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {/* Know it */}
            <button
              onClick={() => handleVocabSelfAssess('know')}
              style={{
                background:   vocabSelfAssess === 'know' ? '#C6EFCE' : '#C6EFCE',
                border:       `${vocabSelfAssess === 'know' ? 2 : 1}px solid ${C.green}`,
                borderRadius: 8, padding: '12px 14px',
                fontSize: 13, fontWeight: vocabSelfAssess === 'know' ? 700 : 600,
                color: '#27500A', cursor: 'pointer', fontFamily: FONTS.ui, textAlign: 'left',
              }}
            >
              ✓ I know it well — I can use it
            </button>

            {/* Maybe */}
            <button
              onClick={() => handleVocabSelfAssess('maybe')}
              style={{
                background:   C.amberLight,
                border:       `${vocabSelfAssess === 'maybe' ? 2 : 1}px solid ${C.amber}`,
                borderRadius: 8, padding: '12px 14px',
                fontSize: 13, fontWeight: vocabSelfAssess === 'maybe' ? 700 : 600,
                color: '#633806', cursor: 'pointer', fontFamily: FONTS.ui, textAlign: 'left',
              }}
            >
              ~ I&apos;ve seen it — not sure what it means
            </button>

            {/* Don't know */}
            <button
              onClick={() => handleVocabSelfAssess('no')}
              style={{
                background:   C.redLight,
                border:       `${vocabSelfAssess === 'no' ? 2 : 1}px solid ${C.red}`,
                borderRadius: 8, padding: '12px 14px',
                fontSize: 13, fontWeight: vocabSelfAssess === 'no' ? 700 : 600,
                color: '#791F1F', cursor: 'pointer', fontFamily: FONTS.ui, textAlign: 'left',
              }}
            >
              ✗ I don&apos;t know this word
            </button>
          </div>

          {/* Verification section */}
          {vocabVerifyShown && (
            <div style={{
              background:   C.blueLight,
              border:       `1px solid ${C.blue}`,
              borderRadius: 8,
              padding:      '12px 14px',
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>
                Quick check — which meaning is correct?
              </div>
              {(['A', 'B'] as const).map(opt => {
                const text = opt === 'A' ? wordData.verifyCorrect : wordData.verifyWrong;
                const sel  = vocabVerifyAns === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setVocabVerifyAns(opt)}
                    style={{
                      display:      'flex',
                      gap:          8,
                      alignItems:   'flex-start',
                      width:        '100%',
                      background:   sel ? C.navy  : C.white,
                      border:       `${sel ? 2 : 1}px solid ${sel ? C.navy : C.border}`,
                      borderRadius: 6,
                      padding:      '8px 10px',
                      fontSize:     12,
                      color:        sel ? C.white : C.dark,
                      fontWeight:   sel ? 700 : 400,
                      cursor:       'pointer',
                      fontFamily:   FONTS.ui,
                      textAlign:    'left',
                      marginBottom: opt === 'A' ? 6 : 0,
                    }}
                  >
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{opt}.</span>
                    {text}
                  </button>
                );
              })}
            </div>
          )}

          <button
            style={{ ...BTN_NAVY, opacity: vocabNextEnabled ? 1 : 0.4, cursor: vocabNextEnabled ? 'pointer' : 'not-allowed' }}
            disabled={!vocabNextEnabled}
            onClick={advanceVocab}
          >
            {vocabIdx < 19 ? 'Next word →' : 'Finish Module 3 →'}
          </button>
        </div>
      </ProfilePage>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 4 — SYNTAX COMPLEXITY
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'syntax_intro') {
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Sentence Complexity</div>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6, marginBottom: 12 }}>
            A sentence will appear for a few seconds then disappear. Write the main idea in your own words.
          </div>
          <InfoBox>
            Academic texts use long, complex sentences. This tells GOGI if those sentences are blocking you.
          </InfoBox>
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <Warning>
              The sentence disappears automatically. You cannot pause it. Focus on the main idea, not every word.
            </Warning>
          </div>

          {/* Complexity ladder preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {SYNTAX_SENTENCES.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 20, height: 6, borderRadius: 3,
                  background: C.border,
                  flexShrink: 0,
                  flex: `0 0 ${20 + i * 16}px`,
                  maxWidth: 100,
                }} />
                <div style={{ fontSize: 11, color: C.gray }}>{s.complexity} — {s.duration}s</div>
              </div>
            ))}
          </div>

          <button style={BTN_NAVY} onClick={() => {
            setSyntaxIdx(0);
            setSyntaxPhase('show');
            startSyntaxTimer(SYNTAX_SENTENCES[0].duration);
            setPhase('syntax_show');
          }}>
            Start →
          </button>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'syntax_show') {
    const sentence = SYNTAX_SENTENCES[syntaxIdx];
    const ratio    = syntaxTimeLeft / sentence.duration;
    const barColor = ratio <= 0.3 ? C.red : ratio <= 0.6 ? C.amber : C.blue;

    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, textAlign: 'center' }}>
            Sentence {syntaxIdx + 1} of 5 — {sentence.complexity}
          </div>

          {/* Complexity ladder */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
            {SYNTAX_SENTENCES.map((_, i) => (
              <div key={i} style={{
                height:       6,
                width:        i <= syntaxIdx ? 28 : 20,
                borderRadius: 3,
                background:   i < syntaxIdx ? C.green : i === syntaxIdx ? C.blue : C.border,
                transition:   'background 0.2s',
              }} />
            ))}
          </div>

          {/* Timer */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>
                The sentence disappears when timer reaches zero. Focus on the main idea.
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: barColor, minWidth: 22, textAlign: 'right' }}>
                {syntaxTimeLeft}
              </div>
            </div>
            <div style={{ height: 6, background: C.light, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${ratio * 100}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.9s linear, background 0.3s' }} />
            </div>
          </div>

          {/* Sentence card */}
          <div style={{
            background:   C.navy,
            borderRadius: 10,
            padding:      '16px 18px',
            fontFamily:   FONTS.passage,
            fontSize:     15,
            color:        C.white,
            lineHeight:   1.8,
            textAlign:    'center',
            minHeight:    80,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
          }}>
            {sentence.text}
          </div>
        </div>
      </ProfilePage>
    );
  }

  if (phase === 'syntax_answer') {
    return (
      <ProfilePage phase={phase} displayName={displayName} moduleInfo={moduleInfo}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, textAlign: 'center' }}>
            Sentence {syntaxIdx + 1} of 5
          </div>

          {/* Empty gray card — no text, no placeholder, nothing */}
          <div style={{
            background:   C.light,
            borderRadius: 10,
            minHeight:    80,
            marginBottom: 16,
          }} />

          <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginBottom: 8 }}>
            What was the main point of that sentence?
          </div>

          <textarea
            dir="ltr"
            value={syntaxInput}
            onChange={(e) => setSyntaxInput(e.target.value)}
            placeholder="What was the main point of that sentence?"
            style={{
              direction:    'ltr',
              unicodeBidi:  'normal' as React.CSSProperties['unicodeBidi'],
              textAlign:    'left',
              writingMode:  'horizontal-tb' as React.CSSProperties['writingMode'],
              width:        '100%',
              minHeight:    64,
              background:   '#F2F2F2',
              border:       '1.5px solid #B5D4F4',
              borderRadius: 8,
              padding:      '12px 14px',
              fontSize:     13,
              fontFamily:   FONTS.ui,
              boxSizing:    'border-box' as const,
              resize:       'none',
              outline:      'none',
              marginBottom: 8,
              color:        '#2C2C2A',
            }}
          />

          <div style={{ fontSize: 10, fontStyle: 'italic', color: C.gray, marginBottom: 12, lineHeight: 1.5 }}>
            Don&apos;t try to remember word for word. Write what it was basically saying.
          </div>

          <button style={{ ...BTN_NAVY, width: '100%' }} onClick={submitSyntaxAnswer}>
            {syntaxIdx < 4 ? 'Submit → Next sentence' : 'Submit → Finish'}
          </button>
        </div>
      </ProfilePage>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLETE SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'complete') {
    const skillCards = [
      { num: 1, label: 'Holding information while you read'  },
      { num: 2, label: 'Figuring out what the author means'  },
      { num: 3, label: 'Understanding tricky words'          },
      { num: 4, label: 'Untangling long sentences'           },
    ];

    return (
      <div style={{ minHeight: '100vh', background: C.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '40px 20px', fontFamily: FONTS.ui }}>
        {/* Avatar */}
        <GogiAvatar size={80} state="celebrate" />

        {/* Heading */}
        <div style={{ fontSize: 28, fontWeight: 700, color: C.white, textAlign: 'center' }}>
          Reading profile complete
        </div>

        {/* Gogi message bubble */}
        <div style={{
          background:   'rgba(255,255,255,0.08)',
          border:       '1px solid rgba(255,255,255,0.15)',
          borderRadius: 14,
          padding:      '18px 22px',
          maxWidth:     400,
          width:        '100%',
          textAlign:    'center',
        }}>
          <div style={{ fontSize: 14, color: C.white, lineHeight: 1.7 }}>
            Nice work finishing all four parts. Gogi now knows how you read — and that&apos;s exactly what we needed to start.
          </div>
        </div>

        {/* Four skill cards — neutral, no color-coding */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400, width: '100%' }}>
          {skillCards.map(card => (
            <div key={card.num} style={{
              background:   'rgba(255,255,255,0.06)',
              border:       '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10,
              padding:      '12px 16px',
              display:      'flex',
              alignItems:   'center',
              gap:          14,
            }}>
              <div style={{
                width:          28,
                height:         28,
                borderRadius:   '50%',
                background:     'rgba(133,183,235,0.25)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       13,
                fontWeight:     700,
                color:          '#85B7EB',
                flexShrink:     0,
              }}>
                {card.num}
              </div>
              <div style={{ fontSize: 13, color: C.white, fontWeight: 500 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer text */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 360, lineHeight: 1.7 }}>
          We&apos;ll work on these one at a time. You won&apos;t have to figure out what to focus on — Gogi already has a plan.
        </div>

        {/* Back to dashboard */}
        <button style={{ ...BTN_BLUE, maxWidth: 320 }} onClick={() => router.push('/dashboard/student')}>
          Back to dashboard →
        </button>
      </div>
    );
  }

  // Fallback — should never render
  return null;
}
