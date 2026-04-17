'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GogiAvatar } from '@/components/gogi/GogiAvatar';
import { GogiBubble } from '@/components/gogi/GogiBubble';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { validateResponse } from '@/lib/validation/validateResponse';
import { C, FONTS, STANDARDS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';

// ─── Session message ──────────────────────────────────────────────────────────

function getSessionMsg(n: number): string {
  if (n >= 3) return "Last session. Let\u2019s confirm it\u2019s yours.";
  if (n >= 2) return "You worked on this before. Let\u2019s go deeper.";
  return "You have the right idea about the theme. You just need to show me WHERE in the text it comes from.";
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function TeachNav({ standardCode }: { standardCode: string }) {
  const standard = STANDARDS[standardCode as keyof typeof STANDARDS];
  return (
    <nav style={{ background: C.navy, height: 52, width: '100%', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.greenBorder, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          TEACH PHASE  |  LAYER 3  |  EVIDENCE MAPPING
        </div>
        {standard && <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{standard.title}</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.white, fontFamily: FONTS.passage, letterSpacing: '-0.5px' }}>GOGI</div>
    </nav>
  );
}

// ─── Table cell ───────────────────────────────────────────────────────────────

function TableCell({ children, isHeader, style: extra }: { children: React.ReactNode; isHeader?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{ border: `1px solid ${C.border}`, padding: isHeader ? '8px 10px' : '6px 8px', verticalAlign: 'top', ...(extra ?? {}) }}>
      {children}
    </td>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeachEvidencePage() {
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

  // Single source of truth — trigger question
  const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
    studentId || null,
    standardCode,
    'evidence_retrieval_failure'
  );

  const shouldShow = !passageLoading || loadTimeout;

  // Student row
  const [claim,      setClaim]      = useState('');
  const [evidence,   setEvidence]   = useState('');
  const [connection, setConnection] = useState('');

  const claimValid      = validateResponse(claim);
  const evidenceValid   = validateResponse(evidence);
  const connectionValid = validateResponse(connection);
  const allValid        = claimValid && evidenceValid && connectionValid;

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
        console.error('[TeachEvidence] init error:', err);
      }
    }
    init();
  }, [user, authLoading, standardId, standardCode, router]);

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
            cognitive_skill_targeted: 'evidence_retrieval',
            intervention_type: 'evidence_organizer',
            student_response: [claim, evidence, connection].join(' | '),
            mastery_achieved: false,
          }),
        });
      }
    } catch (err) {
      console.error('[TeachEvidence] response write error:', err);
    }
    router.push(`/standard/${standardId}/practice`);
  }

  // ── Diagnostic trace ───────────────────────────────────────────────────────
  console.log('[Evidence] authLoading:', authLoading);
  console.log('[Evidence] user:', user?.id);
  console.log('[Evidence] resolvedStudentId:', studentId || '(empty — students lookup pending)');
  console.log('[Evidence] triggerQ:', triggerQ);
  console.log('[Evidence] passageLoading:', passageLoading, '| loadTimeout:', loadTimeout);

  const taStyle = (valid: boolean): React.CSSProperties => ({
    background: C.white,
    border: `1px solid ${valid ? C.green : C.border}`,
    borderRadius: 4,
    padding: '6px 7px',
    fontSize: 12,
    width: '100%',
    resize: 'none',
    minHeight: 72,
    fontFamily: FONTS.ui,
    color: C.dark,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

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
            <GogiAvatar size={36} state="celebrate" />
            <GogiBubble state="celebrate">{getSessionMsg(sessionNum)}</GogiBubble>
          </div>

          <div style={{ background: C.greenLight, borderLeft: `3px solid ${C.green}`, borderRadius: '0 6px 6px 0', padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              LAYER 3 — AFTER READING
            </div>
            <div style={{ fontSize: 13, color: C.green, marginBottom: 2 }}>
              Classification: evidence_retrieval_failure → Layer 3
            </div>
            <div style={{ fontSize: 12, color: C.dark }}>
              Root cause: claim identified but cannot connect it to text evidence.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <GogiAvatar size={36} state="celebrate" />
            <GogiBubble state="celebrate">
              Fill 2 rows minimum. Column 3 is the most important. Don&rsquo;t skip it.
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
              Complete your row in the organizer to continue
            </p>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            THEME-EVIDENCE MAPPING ORGANIZER
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 520 }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '35%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['THEME STATEMENT', 'LITERARY EVIDENCE (quote or scene)', 'CONNECTION: How does this prove the theme?'].map((h) => (
                    <TableCell key={h} isHeader style={{ background: C.navy, color: C.white, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {h}
                    </TableCell>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Modeled example row */}
                <tr>
                  <td colSpan={3} style={{ background: C.greenLight, border: `1px solid ${C.border}`, padding: '4px 10px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 1 }}>
                      READ THIS EXAMPLE FIRST
                    </span>
                  </td>
                </tr>
                <tr>
                  <TableCell style={{ background: C.greenLight }}>
                    <p style={{ fontSize: 12, color: C.dark, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                      Sacrifice for love is the central theme.
                    </p>
                  </TableCell>
                  <TableCell style={{ background: C.greenLight }}>
                    <p style={{ fontSize: 12, color: C.dark, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                      &ldquo;pennies saved one and two at a time&hellip; until one&rsquo;s cheeks burned&rdquo;
                    </p>
                  </TableCell>
                  <TableCell style={{ background: C.greenLight }}>
                    <p style={{ fontSize: 12, color: C.dark, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                      Della&rsquo;s public shame proves her love for Jim overrides her pride.
                    </p>
                  </TableCell>
                </tr>

                {/* Student row */}
                <tr>
                  <TableCell>
                    <textarea
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      placeholder="Write the theme as a complete sentence…"
                      style={taStyle(claimValid)}
                    />
                  </TableCell>
                  <TableCell>
                    <textarea
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="Quote directly from the passage…"
                      style={taStyle(evidenceValid)}
                    />
                  </TableCell>
                  <TableCell>
                    <p style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', margin: '0 0 4px' }}>
                      This shows the theme because…
                    </p>
                    <textarea
                      value={connection}
                      onChange={(e) => setConnection(e.target.value)}
                      placeholder="Explain HOW this proves the theme…"
                      style={taStyle(connectionValid)}
                    />
                  </TableCell>
                </tr>
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: C.gray, fontStyle: 'italic', marginTop: 8 }}>
            MINIMUM: 2 rows. Column 3 on both rows must be complete.
          </p>
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
