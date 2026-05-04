'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, FONTS } from '@/lib/constants/design';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';

type TesterType = 'adult' | 'teacher' | 'student' | 'other';
type RunMode = 'demo' | 'research';

export default function DemoStartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [participantLabel, setParticipantLabel] = useState('');
  const [testerType, setTesterType] = useState<TesterType>('adult');
  const [runMode, setRunMode] = useState<RunMode>('research');
  const [context, setContext] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function startDemo() {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!participantLabel.trim()) {
      setError('Add a first name, nickname, or tester label.');
      return;
    }
    if (!consent) {
      setError('Check the consent box before starting the demo.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const supabase = createClient();
      const cleanContext = context.trim().slice(0, 220);
      const contextNote = `[run_mode:${runMode}]${cleanContext ? ` ${cleanContext}` : ''}`;
      const { data, error: insertError } = await supabase
        .from('demo_participants')
        .insert({
          auth_user_id: user.id,
          participant_label: participantLabel.trim().slice(0, 80),
          tester_type: testerType,
          context_note: contextNote,
          consent_research: true,
          run_mode: runMode,
        })
        .select('id')
        .single();

      let participantId = data?.id ?? null;
      if (insertError || !participantId) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('demo_participants')
          .insert({
            auth_user_id: user.id,
            participant_label: participantLabel.trim().slice(0, 80),
            tester_type: testerType,
            context_note: contextNote,
            consent_research: true,
          })
          .select('id')
          .single();

        participantId = fallbackData?.id ?? null;
        if (fallbackError || !participantId) {
          setError(
            fallbackError?.message ?? insertError?.message ?? 'Could not start the demo run.'
          );
          setSaving(false);
          return;
        }
      }

      if (!participantId) {
        setError('Could not start the demo run.');
        setSaving(false);
        return;
      }

      window.localStorage.setItem('gogi_demo_participant_id', participantId);
      window.location.assign(`/layer0?demo=1&mode=${runMode}&demo_participant_id=${participantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo run.');
      setSaving(false);
    }
  }

  if (authLoading)
    return (
      <Shell>
        <Card>
          <p style={body}>Opening demo...</p>
        </Card>
      </Shell>
    );
  if (!user)
    return (
      <Shell>
        <Card>
          <h1 style={title}>Demo needs a login.</h1>
          <button style={button} onClick={() => router.push('/login')}>
            Back to login
          </button>
        </Card>
      </Shell>
    );

  return (
    <Shell>
      <Card>
        <div style={kicker}>Demo tester setup</div>
        <h1 style={title}>Who is taking this Layer 0 check?</h1>
        <p style={body}>
          Use the tester&apos;s first and last name. This keeps demo feedback separate from real
          student records.
        </p>

        <label style={label}>Tester name</label>
        <input
          value={participantLabel}
          onChange={(e) => setParticipantLabel(e.target.value)}
          placeholder="First Name, Last Name"
          maxLength={80}
          style={input}
        />

        <label style={label}>Tester type</label>
        <div style={segmented}>
          {(['adult', 'teacher', 'student', 'other'] as TesterType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTesterType(type)}
              style={testerType === type ? segmentActive : segment}
            >
              {type}
            </button>
          ))}
        </div>

        <label style={label}>Run length</label>
        <div style={modeGrid}>
          <button
            type="button"
            onClick={() => setRunMode('research')}
            style={runMode === 'research' ? modeActive : modeCard}
          >
            <span style={modeTitle}>Research</span>
            <span style={modeText}>Better signal for 10-15 testers. About 5-7 minutes.</span>
          </button>
          <button
            type="button"
            onClick={() => setRunMode('demo')}
            style={runMode === 'demo' ? modeActive : modeCard}
          >
            <span style={modeTitle}>Quick demo</span>
            <span style={modeText}>Fast live walkthrough. About 2-3 minutes.</span>
          </button>
        </div>

        <label style={label}>Context note</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional: why this person is testing, anything useful to remember."
          maxLength={240}
          style={{ ...input, minHeight: 76, resize: 'vertical' }}
        />

        <label style={consentRow}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>
            I understand this demo stores the tester label and Layer 0 results for product feedback.
          </span>
        </label>

        {error && <div style={errorBox}>{error}</div>}

        <button style={button} disabled={saving} onClick={startDemo}>
          {saving ? 'Starting...' : `Start ${runMode === 'research' ? 'research' : 'demo'} Layer 0`}
        </button>
        <button
          style={secondaryButton}
          disabled={saving}
          onClick={() => router.push('/demo/results')}
        >
          View demo data dashboard
        </button>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F7F3EA',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: FONTS.ui,
      }}
    >
      <section style={{ width: '100%', maxWidth: 620 }}>{children}</section>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: C.white, border: '1px solid #D7C9AE', borderRadius: 10, padding: 24 }}
    >
      {children}
    </div>
  );
}

const kicker: React.CSSProperties = {
  color: C.amber,
  fontSize: 10,
  fontWeight: 850,
  letterSpacing: 1.2,
  marginBottom: 8,
  textTransform: 'uppercase',
};
const title: React.CSSProperties = {
  color: C.dark,
  fontSize: 28,
  lineHeight: 1.1,
  margin: '0 0 10px',
};
const body: React.CSSProperties = {
  color: C.gray,
  fontSize: 15,
  lineHeight: 1.55,
  margin: '0 0 18px',
};
const label: React.CSSProperties = {
  color: C.dark,
  display: 'block',
  fontSize: 12,
  fontWeight: 850,
  margin: '14px 0 6px',
  textTransform: 'uppercase',
};
const input: React.CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 8,
  boxSizing: 'border-box',
  color: C.dark,
  fontFamily: FONTS.ui,
  fontSize: 15,
  lineHeight: 1.4,
  outline: 'none',
  padding: '12px 14px',
  width: '100%',
};
const segmented: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
};
const segment: React.CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 8,
  color: C.gray,
  cursor: 'pointer',
  fontFamily: FONTS.ui,
  fontSize: 13,
  fontWeight: 800,
  minHeight: 42,
  textTransform: 'capitalize',
};
const segmentActive: React.CSSProperties = {
  ...segment,
  background: C.amberLight,
  borderColor: C.amber,
  color: '#633806',
};
const modeGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
};
const modeCard: React.CSSProperties = {
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  borderRadius: 8,
  color: C.dark,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONTS.ui,
  gap: 4,
  minHeight: 92,
  padding: 12,
  textAlign: 'left',
};
const modeActive: React.CSSProperties = {
  ...modeCard,
  background: C.blueLight,
  borderColor: C.blueMid,
};
const modeTitle: React.CSSProperties = { color: C.navy, fontSize: 14, fontWeight: 900 };
const modeText: React.CSSProperties = { color: C.gray, fontSize: 12, lineHeight: 1.35 };
const consentRow: React.CSSProperties = {
  alignItems: 'flex-start',
  color: C.gray,
  display: 'flex',
  fontSize: 13,
  gap: 10,
  lineHeight: 1.45,
  margin: '16px 0',
};
const errorBox: React.CSSProperties = {
  background: '#FCEBEB',
  border: '1px solid #A32D2D',
  borderRadius: 8,
  color: '#7A1F1F',
  fontSize: 13,
  marginBottom: 12,
  padding: 10,
};
const button: React.CSSProperties = {
  background: C.navy,
  border: 'none',
  borderRadius: 8,
  color: C.white,
  cursor: 'pointer',
  fontFamily: FONTS.ui,
  fontSize: 15,
  fontWeight: 850,
  minHeight: 48,
  padding: '0 18px',
  width: '100%',
};
const secondaryButton: React.CSSProperties = {
  ...button,
  background: '#FFFDF8',
  border: '1px solid #D7C9AE',
  color: C.dark,
  marginTop: 10,
};
