'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'intro' | 'checking' | 'complete';
type WordResponse = 'confirmed_know' | 'maybe' | 'overestimate' | 'no';

interface WordResult {
  word:     string;
  response: WordResponse;
  context:  string;
}

interface VerificationOptions {
  correct:    string;
  wrong:      string;
  aIsCorrect: boolean;
}

// ─── Fallback words ───────────────────────────────────────────────────────────

const FALLBACK_WORDS: Record<string, string[]> = {
  'ELA.9.R.1.1': ['infer', 'imply', 'suggest', 'conclude', 'evident', 'reveal', 'indicate', 'contrast'],
  'ELA.9.R.1.2': ['theme', 'universal', 'develop', 'convey', 'symbol', 'motif', 'abstract', 'significant'],
  'ELA.9.R.2.1': ['structure', 'purpose', 'organize', 'transition', 'sequence', 'contrast', 'evidence', 'analyze'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findContextSentence(text: string, word: string): string {
  const lower     = word.toLowerCase();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
  const match     = sentences.find(s => s.toLowerCase().includes(lower));
  return match ? match.trim().replace(/\n/g, ' ') : `${word} — from your upcoming passage`;
}

function getDotStyle(results: WordResult[], index: number, current: number): { bg: string; border: string; pulse: boolean } {
  if (index < results.length) {
    const r = results[index].response;
    if (r === 'confirmed_know')                    return { bg: C.green, border: C.green, pulse: false };
    if (r === 'maybe' || r === 'overestimate')     return { bg: C.amber, border: C.amber, pulse: false };
    return                                                { bg: C.red,   border: C.red,   pulse: false };
  }
  if (index === current) return { bg: C.blue, border: C.blue, pulse: true };
  return { bg: 'transparent', border: C.border, pulse: false };
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function VocabCheckNav({ standardCode, studentName }: { standardCode: string; studentName: string }) {
  return (
    <nav style={{
      background: C.navy, height: 52, width: '100%', padding: '0 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.blueMid, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          {standardCode} | VOCABULARY CHECK
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Quick check before your diagnostic</div>
      </div>
      {studentName && <div style={{ fontSize: 12, color: C.white, opacity: 0.75 }}>{studentName}</div>}
    </nav>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VocabCheckPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId   = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading, role } = useAuth();

  // Identity
  const [studentId,    setStudentId]    = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [studentName,  setStudentName]  = useState('');

  // Passage data
  const [passageTitle,   setPassageTitle]   = useState('');
  const [passageExcerpt, setPassageExcerpt] = useState('');
  const [passageText,    setPassageText]    = useState('');
  const [words,          setWords]          = useState<string[]>([]);

  // Phase
  const [phase, setPhase] = useState<Phase>('loading');

  // Word checking state
  const [currentWordIndex,    setCurrentWordIndex]    = useState(0);
  const [wordResults,         setWordResults]         = useState<WordResult[]>([]);
  const [selectedOption,      setSelectedOption]      = useState<'know' | 'maybe' | 'no' | null>(null);
  const [verificationOptions, setVerificationOptions] = useState<VerificationOptions | null>(null);
  const [verificationSelected, setVerificationSelected] = useState<'A' | 'B' | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [saving,              setSaving]              = useState(false);

  const currentWord     = words[currentWordIndex] ?? '';
  const contextSentence = currentWord && passageText
    ? findContextSentence(passageText, currentWord)
    : '';

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user)              { router.push('/login');             return; }
    if (role === 'teacher') { router.push('/dashboard/teacher'); return; }

    async function init() {
      try {
        const supabase = createClient();

        // Student record
        const { data: student } = await supabase
          .from('students')
          .select('id, full_name')
          .eq('user_id', user!.id)
          .maybeSingle();
        const sid = student?.id ?? '';
        setStudentId(sid);
        if (student?.full_name) {
          const parts = student.full_name.trim().split(' ');
          setStudentName(
            parts.length >= 2
              ? `${parts[0]} ${parts[parts.length - 1][0]}.`
              : parts[0]
          );
        }

        // Standard UUID
        const { data: std } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();
        if (!std?.id) { setPhase('intro'); return; }
        setStandardUuid(std.id);

        // Already completed → go straight to diagnostic
        if (sid) {
          const { data: existing } = await supabase
            .from('vocab_readiness')
            .select('id')
            .eq('student_id', sid)
            .eq('standard_id', std.id)
            .maybeSingle();
          if (existing) {
            router.push(`/standard/${standardId}/diagnostic`);
            return;
          }
        }

        // Anchor passage
        const { data: question } = await supabase
          .from('questions')
          .select('content, title, keyword_flags')
          .eq('standard_id', std.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        setPassageTitle(question?.title ?? 'Anchor Passage');

        const rawContent = question?.content ?? '';
        const qIdx       = rawContent.search(/\nQUESTION:/i);
        const rawPassage = qIdx > 0 ? rawContent.slice(0, qIdx) : rawContent;
        const clean      = rawPassage
          .replace(/^PASSAGE:\s*/i, '')
          .replace(/^-{2,}\s*$/gm, '')
          .trim();
        setPassageText(clean);
        setPassageExcerpt(clean.slice(0, 200));

        // Build word list from keyword_flags + fallbacks, capped at 15
        const flags: string[]    = Array.isArray(question?.keyword_flags) ? question.keyword_flags as string[] : [];
        const fallbacks: string[] = FALLBACK_WORDS[standardCode] ?? [];
        const combined = [...new Set([...flags, ...fallbacks])];
        setWords(combined.slice(0, 15));

        setPhase('intro');
      } catch (err) {
        console.error('[VocabCheck] init error:', err);
        setPhase('intro'); // fail open
      }
    }

    init();
  }, [user, authLoading, role, standardId, standardCode, router]);

  // ── Fetch verification options when "know" selected ───────────────────────

  useEffect(() => {
    if (selectedOption !== 'know' || !currentWord) return;
    setVerificationLoading(true);
    setVerificationOptions(null);
    setVerificationSelected(null);

    fetch('/api/vocab/define', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: currentWord, passageContext: contextSentence, verification: true }),
    })
      .then(res => res.json())
      .then((data: { correct_definition?: string; wrong_definition?: string }) => {
        if (data.correct_definition && data.wrong_definition) {
          setVerificationOptions({
            correct:    data.correct_definition,
            wrong:      data.wrong_definition,
            aIsCorrect: Math.random() > 0.5,
          });
        }
      })
      .catch(err => console.error('[VocabCheck] verification error:', err))
      .finally(() => setVerificationLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption, currentWordIndex]);

  // ── Interactions ──────────────────────────────────────────────────────────

  function handleOptionSelect(opt: 'know' | 'maybe' | 'no') {
    if (selectedOption !== null) return;
    setSelectedOption(opt);
  }

  function handleVerificationSelect(letter: 'A' | 'B') {
    if (verificationSelected !== null) return;
    setVerificationSelected(letter);
  }

  function isNextEnabled(): boolean {
    if (!selectedOption) return false;
    if (selectedOption === 'maybe' || selectedOption === 'no') return true;
    // 'know': need verification answered OR no verification available
    return verificationSelected !== null || (!verificationLoading && !verificationOptions);
  }

  function handleNext() {
    if (!isNextEnabled()) return;

    let response: WordResponse;
    if (selectedOption === 'no') {
      response = 'no';
    } else if (selectedOption === 'maybe') {
      response = 'maybe';
    } else {
      // 'know' path
      if (!verificationOptions || verificationSelected === null) {
        response = 'confirmed_know';
      } else {
        const pickedCorrect = verificationOptions.aIsCorrect
          ? verificationSelected === 'A'
          : verificationSelected === 'B';
        response = pickedCorrect ? 'confirmed_know' : 'overestimate';
      }
    }

    const newResults: WordResult[] = [
      ...wordResults,
      { word: currentWord, response, context: contextSentence },
    ];
    setWordResults(newResults);

    if (currentWordIndex + 1 >= words.length) {
      handleComplete(newResults);
    } else {
      setCurrentWordIndex(prev => prev + 1);
      setSelectedOption(null);
      setVerificationOptions(null);
      setVerificationSelected(null);
    }
  }

  async function handleComplete(results: WordResult[]) {
    setSaving(true);

    const confirmedKnow = results.filter(r => r.response === 'confirmed_know').length;
    const maybe         = results.filter(r => r.response === 'maybe' || r.response === 'overestimate').length;
    const unknown       = results.filter(r => r.response === 'no').length;
    const coverageScore = Math.round((confirmedKnow / results.length) * 100);

    if (studentId && standardUuid) {
      try {
        const supabase = createClient();
        await supabase.from('vocab_readiness').upsert(
          {
            student_id:     studentId,
            standard_id:    standardUuid,
            coverage_score: coverageScore,
            words_known:    confirmedKnow,
            words_maybe:    maybe,
            words_unknown:  unknown,
            word_results:   results,
          },
          { onConflict: 'student_id,standard_id' }
        );
      } catch (err) {
        console.error('[VocabCheck] save error:', err);
      }
    }

    setSaving(false);
    setPhase('complete');
  }

  // ── Derived complete-screen values ────────────────────────────────────────

  const confirmedKnow  = wordResults.filter(r => r.response === 'confirmed_know').length;
  const maybeCount     = wordResults.filter(r => r.response === 'maybe' || r.response === 'overestimate').length;
  const unknownCount   = wordResults.filter(r => r.response === 'no').length;
  const coverageScore  = wordResults.length > 0 ? Math.round((confirmedKnow / wordResults.length) * 100) : 0;
  const scoreColor     = coverageScore >= 95 ? C.green : coverageScore >= 80 ? C.amber : C.red;
  const standard       = STANDARDS[standardCode as keyof typeof STANDARDS];
  const THRESHOLD      = 98;

  const completeMessage =
    coverageScore >= 95
      ? 'Strong vocabulary for this passage. Your diagnostic starts now.'
      : coverageScore >= 80
        ? "GOGI will support the words you're unsure about. You're ready to begin."
        : 'GOGI has flagged the words you need. The schema card will help before you read.';

  // ── Render: loading ───────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.ui }}>
        <p style={{ color: C.gray, fontSize: 14 }}>Loading vocabulary check…</p>
      </div>
    );
  }

  // ── Render: intro ─────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
        <VocabCheckNav standardCode={standardCode} studentName={studentName} />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>
          <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>

            {/* Standard badge */}
            <div style={{
              display: 'inline-block',
              background: C.blueLight, border: `1px solid ${C.blueMid}`,
              borderRadius: 20, padding: '4px 14px',
              fontSize: 10, fontWeight: 700, color: '#0C447C',
              marginBottom: 14,
            }}>
              {standardCode}{standard ? ` — ${standard.title}` : ''}
            </div>

            <div style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
              Quick vocabulary check
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
              {words.length} words from the passage you&rsquo;re about to read. Takes about 3 minutes.
            </div>

            {/* Passage preview */}
            <div style={{ background: '#F8F8F8', borderLeft: `3px solid ${C.blue}`, borderRadius: '0 8px 8px 0', padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                FROM: {passageTitle}
              </div>
              <div style={{ fontSize: 12, fontFamily: FONTS.passage, fontStyle: 'italic', color: C.dark, lineHeight: 1.6 }}>
                {passageExcerpt ? `${passageExcerpt}…` : 'Passage loading…'}
              </div>
            </div>

            {/* Instruction */}
            <div style={{ background: C.blueLight, borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.navy, lineHeight: 1.6 }}>
                For each word: be honest about whether you know it.
                GOGI uses this to set up the right support.
                If you say you know a word, you&rsquo;ll get a quick check.
              </div>
            </div>

            <button
              onClick={() => setPhase('checking')}
              style={{
                width: '100%', background: C.navy, color: C.white,
                border: 'none', borderRadius: 10, padding: 13,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui,
              }}
            >
              Start vocabulary check →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: checking (one word at a time) ─────────────────────────────────

  if (phase === 'checking') {
    const nextEnabled = isNextEnabled();

    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
        <VocabCheckNav standardCode={standardCode} studentName={studentName} />
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>

          {/* Progress dots */}
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
              {words.map((_, i) => {
                const { bg, border, pulse } = getDotStyle(wordResults, i, currentWordIndex);
                return (
                  <div
                    key={i}
                    style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: bg, border: `1.5px solid ${border}`,
                      flexShrink: 0,
                      animation: pulse ? 'dot-pulse 1.2s ease-in-out infinite' : 'none',
                    }}
                  />
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: C.gray }}>
              Word {currentWordIndex + 1} of {words.length}
            </div>
          </div>

          {/* Word card */}
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>

            {/* Word */}
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: FONTS.passage, color: C.navy, textAlign: 'center', marginBottom: 6 }}>
              {currentWord}
            </div>

            {/* Context sentence */}
            <div style={{ fontSize: 12, fontStyle: 'italic', color: C.gray, textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>
              &ldquo;{contextSentence}&rdquo;
            </div>

            {/* 3 response buttons */}
            {(
              [
                { opt: 'know'  as const, label: '✓  I know it well — I can use it',      selBg: '#C6EFCE', selBorder: C.green, selText: '#27500A' },
                { opt: 'maybe' as const, label: "~  I've seen it — not completely sure", selBg: C.amberLight, selBorder: C.amber, selText: '#633806' },
                { opt: 'no'    as const, label: '✗  I don\'t know this word',            selBg: C.redLight,  selBorder: C.red,   selText: '#791F1F' },
              ]
            ).map(({ opt, label, selBg, selBorder, selText }) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect(opt)}
                  disabled={selectedOption !== null}
                  style={{
                    width: '100%',
                    background:   isSelected ? selBg     : C.white,
                    border:       `1.5px solid ${isSelected ? selBorder : C.border}`,
                    borderRadius: 8,
                    padding:      '11px 14px',
                    fontSize:     13,
                    fontWeight:   700,
                    color:        isSelected ? selText : C.dark,
                    cursor:       selectedOption !== null ? 'default' : 'pointer',
                    fontFamily:   FONTS.ui,
                    textAlign:    'left',
                    marginBottom: 8,
                    transition:   'border-color 0.15s, background 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}

            {/* Verification check — fires on "I know it well" */}
            {selectedOption === 'know' && (
              <div style={{ marginTop: 4, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, marginBottom: 8 }}>
                  Quick check — which meaning is correct?
                </div>
                {verificationLoading && (
                  <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>Checking…</div>
                )}
                {!verificationLoading && verificationOptions && (
                  <>
                    {(['A', 'B'] as const).map((letter) => {
                      const text = letter === 'A'
                        ? (verificationOptions.aIsCorrect ? verificationOptions.correct : verificationOptions.wrong)
                        : (verificationOptions.aIsCorrect ? verificationOptions.wrong   : verificationOptions.correct);
                      const isSel = verificationSelected === letter;
                      return (
                        <button
                          key={letter}
                          onClick={() => handleVerificationSelect(letter)}
                          disabled={verificationSelected !== null}
                          style={{
                            width: '100%',
                            background:   isSel ? C.blueLight : C.white,
                            border:       `1.5px solid ${isSel ? C.blue : C.border}`,
                            borderRadius: 8,
                            padding:      '10px 14px',
                            fontSize:     12,
                            color:        C.dark,
                            cursor:       verificationSelected !== null ? 'default' : 'pointer',
                            fontFamily:   FONTS.ui,
                            textAlign:    'left',
                            marginBottom: 8,
                            transition:   'border-color 0.15s, background 0.15s',
                          }}
                        >
                          {letter}.  {text}
                        </button>
                      );
                    })}
                  </>
                )}
                {!verificationLoading && !verificationOptions && (
                  <div style={{ fontSize: 11, color: C.gray, fontStyle: 'italic' }}>
                    Verification unavailable — your answer has been recorded.
                  </div>
                )}
              </div>
            )}

            {/* Next word button */}
            <button
              onClick={handleNext}
              disabled={!nextEnabled}
              style={{
                width: '100%',
                background:   nextEnabled ? C.navy : C.light,
                color:        nextEnabled ? C.white : C.gray,
                border:       'none',
                borderRadius: 8,
                padding:      '12px 14px',
                fontSize:     13,
                fontWeight:   700,
                cursor:       nextEnabled ? 'pointer' : 'not-allowed',
                fontFamily:   FONTS.ui,
                marginTop:    8,
                transition:   'background 0.15s',
              }}
            >
              {currentWordIndex + 1 >= words.length ? 'See results →' : 'Next word →'}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes dot-pulse {
            0%, 100% { opacity: 0.5; transform: scale(0.85); }
            50%       { opacity: 1;   transform: scale(1.15); }
          }
        `}</style>
      </div>
    );
  }

  // ── Render: complete ──────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
      <VocabCheckNav standardCode={standardCode} studentName={studentName} />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '24px 22px' }}>

          <div style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
            Vocabulary check complete
          </div>

          {/* Score */}
          <div style={{ textAlign: 'center', margin: '20px 0 12px' }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {saving ? '…' : coverageScore}
            </div>
            <div style={{ fontSize: 14, color: C.gray, marginTop: 4 }}>% coverage</div>
          </div>

          {/* Threshold bar */}
          <div style={{ marginBottom: 20, marginTop: 24 }}>
            <div style={{ position: 'relative', background: C.light, height: 8, borderRadius: 4 }}>
              {/* Student fill */}
              <div style={{
                height: 8, borderRadius: 4,
                background:  scoreColor,
                width:       `${Math.min(coverageScore, 100)}%`,
                transition:  'width 0.5s ease',
              }} />
              {/* 98% marker */}
              <div style={{
                position:  'absolute',
                top:       -20,
                left:      `${THRESHOLD}%`,
                transform: 'translateX(-50%)',
                fontSize:  9,
                fontWeight: 700,
                color:     C.dark,
                whiteSpace: 'nowrap',
              }}>
                98% needed
              </div>
              <div style={{
                position:  'absolute',
                top:       0,
                left:      `${THRESHOLD}%`,
                height:    8,
                width:     2,
                background: C.dark,
                transform: 'translateX(-50%)',
              }} />
            </div>
          </div>

          {/* Words breakdown */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Known',   count: confirmedKnow, bg: C.greenLight, color: C.green },
              { label: 'Unsure',  count: maybeCount,    bg: C.amberLight, color: C.amber },
              { label: 'Unknown', count: unknownCount,  bg: C.redLight,   color: C.red   },
            ].map(({ label, count, bg, color }) => (
              <div key={label} style={{ flex: 1, background: bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{count}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Message */}
          <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic', textAlign: 'center' }}>
            {completeMessage}
          </div>

          <button
            onClick={() => router.push(`/standard/${standardId}/diagnostic`)}
            style={{
              width: '100%', background: C.navy, color: C.white,
              border: 'none', borderRadius: 10, padding: 13,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONTS.ui,
            }}
          >
            Start Diagnostic →
          </button>
        </div>
      </div>
    </div>
  );
}
