'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getDefinition } from '@/lib/vocab/getDefinition';
import type { VocabDefinition } from '@/lib/vocab/getDefinition';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateResponse(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length >= 5;
}

// ─── Custom teach nav ─────────────────────────────────────────────────────────

function TeachNav({ standardCode }: { standardCode: string }) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  return (
    <nav
      style={{
        background: C.navy,
        height: 52,
        width: '100%',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.blueMid,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
          }}
        >
          TEACH PHASE  |  LAYER 2  |  VOCABULARY
        </div>
        {standard && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
            {standard.title}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.white,
          fontFamily: FONTS.passage,
          letterSpacing: '-0.5px',
        }}
      >
        GOGI
      </div>
    </nav>
  );
}

// ─── Quadrant label ───────────────────────────────────────────────────────────

function QLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: C.blue,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachVocabularyPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  // Student + session context
  const [studentId, setStudentId] = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [lastSelectedOption, setLastSelectedOption] = useState<string | null>(null);
  const [classification, setClassification] = useState('vocabulary_gap');

  // Vocab definition state
  const [vocabDef, setVocabDef] = useState<VocabDefinition | null>(null);
  const [defLoading, setDefLoading] = useState(true);

  // "In Your Own Words" state
  const [ownWords, setOwnWords] = useState('');
  const [ownWordsValid, setOwnWordsValid] = useState(false);
  const [ownWordsBlurred, setOwnWordsBlurred] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Passage reference panel
  const [showPassage, setShowPassage] = useState(false);

  // 5-second hard timeout — prevents infinite loading under all conditions
  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Single source of truth — trigger question
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    classification
  );

  const shouldShow = !(passageLoading || defLoading) || loadTimeout;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function init() {
      try {
        const supabase = createClient();

        // ── Student ─────────────────────────────────────────────────────────
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();
        const resolvedStudentId = student?.id ?? '';
        setStudentId(resolvedStudentId);

        // ── Standard UUID ───────────────────────────────────────────────────
        const { data: std } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();
        if (!std?.id) return;
        setStandardUuid(std.id);

        // ── Most recent session ─────────────────────────────────────────────
        if (resolvedStudentId) {
          const { data: session } = await supabase
            .from('sessions')
            .select('id, dominant_classification')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', std.id)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (session?.id) {
            setSessionId(session.id);
            const cls = (session as { dominant_classification?: string | null })
              .dominant_classification;
            if (cls) setClassification(cls);
          }

          // ── Most recent diagnostic response (for "Student selected: Option X") ──
          const { data: lastResponse } = await supabase
            .from('responses')
            .select('student_response')
            .eq('student_id', resolvedStudentId)
            .eq('standard_id', std.id)
            .is('intervention_type', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastResponse?.student_response) {
            setLastSelectedOption(lastResponse.student_response);
          }
        }
      } catch (err) {
        console.error('[TeachVocabulary] init error:', err);
      }
    }

    init();
  }, [user, authLoading, standardId, standardCode, router]);

  // Fetch definition once triggerQ resolves — derives from the same question
  useEffect(() => {
    if (!triggerQ?.blockingWord) {
      if (!passageLoading) setDefLoading(false);
      return;
    }
    setDefLoading(true);
    const context = triggerQ.passageContext || triggerQ.passageText.slice(0, 300);
    getDefinition(triggerQ.blockingWord, context)
      .then((def) => { setVocabDef(def); setDefLoading(false); })
      .catch(() => setDefLoading(false));
  }, [triggerQ?.blockingWord, triggerQ?.passageContext, passageLoading]);

  function handleOwnWordsChange(text: string) {
    setOwnWords(text);
    setOwnWordsValid(validateResponse(text));
  }

  async function handleCTA() {
    if (!ownWordsValid || submitting) return;
    setSubmitting(true);

    try {
      if (sessionId && studentId && standardUuid) {
        await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            student_id: studentId,
            standard_id: standardUuid,
            cognitive_skill_targeted: 'vocabulary',
            intervention_type: 'vocabulary_frayer',
            student_response: ownWords,
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachVocabulary] response write error:', err);
    }

    router.push(`/standard/${standardId}/practice`);
  }

  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  const blockingWord = triggerQ?.blockingWord ?? '';
  const passageSentence = triggerQ?.passageContext ?? '';

  // ── Diagnostic trace ───────────────────────────────────────────────────────
  console.log('[Vocabulary] authLoading:', authLoading);
  console.log('[Vocabulary] user:', user?.id);
  console.log('[Vocabulary] resolvedStudentId:', studentId || '(empty — students lookup pending)');
  console.log('[Vocabulary] triggerQ:', triggerQ);
  console.log('[Vocabulary] passageLoading:', passageLoading, '| defLoading:', defLoading, '| loadTimeout:', loadTimeout);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: C.white,
        fontFamily: FONTS.ui,
      }}
    >
      <TeachNav standardCode={standardCode} />

      {/* Two-column content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
        className="teach-columns"
      >
        {/* ── LEFT PANEL — Gogi Coaching (42%) ─────────────────────────────── */}
        <div
          style={{
            flex: '0 0 42%',
            borderRight: `1px solid ${C.border}`,
            padding: '20px 18px',
            overflowY: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.gray,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 12,
            }}
          >
            GOGI COACHING
          </div>

          {/* Top Gogi row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              {blockingWord
                ? <>
                    The word <strong>&ldquo;{blockingWord}&rdquo;</strong> was stopping you before
                    you reached the inference. Let&rsquo;s unlock it permanently.
                  </>
                : 'Let\u2019s unlock a key vocabulary word from this passage permanently.'}
            </GogiBubble>
          </div>

          {/* Diagnostic context panel */}
          <div
            style={{
              background: C.blueLight,
              borderLeft: `3px solid ${C.blue}`,
              borderRadius: '0 6px 6px 0',
              padding: '10px 12px',
              margin: '14px 0',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.blue,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              DIAGNOSTIC CONTEXT
            </div>
            <div style={{ fontSize: 13, color: C.dark, marginBottom: 3 }}>
              Student selected: Option{' '}
              {lastSelectedOption ? lastSelectedOption : '—'}
            </div>
            <div style={{ fontSize: 13, color: C.amber }}>
              Classification: {classification} → Layer 2
            </div>
          </div>

          {/* Bottom Gogi row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              Now you have this word. Go back to the passage &mdash; it reads completely
              differently.
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

          {/* CTA button */}
          <button
            onClick={handleCTA}
            disabled={!ownWordsValid || submitting}
            style={{
              width: '100%',
              background: C.navy,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: ownWordsValid && !submitting ? 'pointer' : 'not-allowed',
              fontFamily: FONTS.ui,
              opacity: ownWordsValid && !submitting ? 1 : 0.4,
              transition: 'opacity 0.2s ease',
            }}
          >
            I&rsquo;ve got it — Practice  →
          </button>

          {!ownWordsValid && (
            <p
              style={{
                fontSize: 11,
                color: C.gray,
                marginTop: 6,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              Complete &ldquo;In Your Own Words&rdquo; to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL — Frayer Model Card (58%) ────────────────────────── */}
        <div
          style={{
            flex: 1,
            padding: '20px 18px',
            overflowY: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.gray,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 10,
            }}
          >
            VOCABULARY INTERVENTION — FRAYER MODEL
          </div>

          {/* Frayer card */}
          <div
            style={{
              border: `1.5px solid ${C.blue}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {/* Card header */}
            <div
              style={{
                background: C.navy,
                padding: '12px 14px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  fontStyle: 'italic',
                  fontFamily: FONTS.passage,
                  color: C.white,
                }}
              >
                {blockingWord || (passageLoading ? '…' : '—')}
              </div>
              <div style={{ fontSize: 11, color: C.blueMid, marginTop: 3 }}>
                {defLoading
                  ? 'loading…'
                  : vocabDef?.part_of_speech
                    ? vocabDef.part_of_speech
                    : standard?.code ?? standardCode}
              </div>
            </div>

            {/* 2×2 grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'auto auto',
              }}
            >
              {/* Q1 — Definition (top-left) */}
              <div
                style={{
                  padding: 12,
                  minHeight: 100,
                  borderRight: `0.5px solid ${C.blueMid}`,
                  borderBottom: `0.5px solid ${C.blueMid}`,
                  boxSizing: 'border-box',
                }}
              >
                <QLabel>Definition</QLabel>
                <p style={{ fontSize: 12, color: C.dark, lineHeight: 1.5, margin: 0 }}>
                  {defLoading
                    ? '…'
                    : vocabDef?.definition ?? 'Definition unavailable.'}
                </p>
              </div>

              {/* Q2 — In This Passage (top-right) */}
              <div
                style={{
                  padding: 12,
                  minHeight: 100,
                  borderBottom: `0.5px solid ${C.blueMid}`,
                  boxSizing: 'border-box',
                }}
              >
                <QLabel>In This Passage</QLabel>
                <p
                  style={{
                    fontSize: 12,
                    color: C.dark,
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    margin: 0,
                  }}
                >
                  {passageSentence
                    ? `\u201C${passageSentence}\u201D`
                    : defLoading
                      ? '…'
                      : 'No matching sentence found.'}
                </p>
              </div>

              {/* Q3 — Real-World Example (bottom-left) */}
              <div
                style={{
                  padding: 12,
                  minHeight: 100,
                  borderRight: `0.5px solid ${C.blueMid}`,
                  boxSizing: 'border-box',
                }}
              >
                <QLabel>Real-World Example</QLabel>
                <p style={{ fontSize: 12, color: C.dark, lineHeight: 1.5, margin: 0 }}>
                  {defLoading
                    ? '…'
                    : vocabDef?.example
                      ? `\u201C${vocabDef.example}\u201D`
                      : 'Example unavailable.'}
                </p>
              </div>

              {/* Q4 — In Your Own Words (bottom-right) */}
              <div
                style={{
                  padding: 12,
                  minHeight: 100,
                  boxSizing: 'border-box',
                }}
              >
                <QLabel>In Your Own Words</QLabel>
                <textarea
                  value={ownWords}
                  onChange={(e) => handleOwnWordsChange(e.target.value)}
                  onBlur={() => setOwnWordsBlurred(true)}
                  placeholder="Type the definition in your own words…"
                  style={{
                    background: C.light,
                    border: `1px solid ${ownWordsValid ? C.green : C.blueMid}`,
                    borderRadius: 4,
                    padding: '6px 8px',
                    fontSize: 12.5,
                    width: '100%',
                    resize: 'none',
                    minHeight: 60,
                    fontFamily: FONTS.ui,
                    color: C.dark,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                />
                {ownWordsBlurred && !ownWordsValid && (
                  <p
                    style={{
                      fontSize: 12,
                      color: C.red,
                      marginTop: 4,
                      margin: '4px 0 0',
                    }}
                  >
                    Tell me more — at least a full sentence.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .teach-columns {
            flex-direction: column !important;
          }
          .teach-columns > div:first-child {
            flex: 0 0 auto !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid ${C.border};
          }
          .teach-columns > div:last-child {
            flex: 1 !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
