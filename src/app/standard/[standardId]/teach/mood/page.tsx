'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  MoodInterventionRun,
  type MoodInterventionResult,
  type MoodPassage,
} from '@/components/mood-intervention/MoodInterventionRun';

const COGNITIVE_SKILL = 'mood_identification';
const INTERVENTION_TYPE = 'mood_skill_run_v1';

type TransferPassageRow = {
  id: string;
  content: string;
  title?: string | null;
  author?: string | null;
  canonical_mood?: string | null;
};

const STARTER_PASSAGE: MoodPassage = {
  title: 'Practice: Nathan in the Old House',
  author: 'Mood Reteach & Practice sample',
  text: [
    'Nathan had been in the old house before, but this was the first time he was left alone for the evening. A scratching sound against the house made him start.',
    'He realized it was only the telephone wire slapping in the wind. A low moan came from the basement. "Ah, it is only the furnace," he thought.',
    'But what was that sound upstairs? Footsteps? Was someone in the house? Suddenly, three loud knocks sounded at the front door. Nathan jumped to his feet. "Why did they not ring the doorbell?" he wondered.',
  ].join('\n\n'),
  canonicalMood: 'tense',
};

function extractPassage(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  const raw = qIdx > 0 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchTransferPassage(
  standardUuid: string,
  triggerQuestionId?: string,
): Promise<MoodPassage | null> {
  const supabase = createClient();
  const query = supabase
    .from('questions')
    .select('id, content, title, author, canonical_mood')
    .eq('standard_id', standardUuid)
    .eq('approved', true)
    .or(
      'option_a_class.eq.mood_misreading,' +
      'option_b_class.eq.mood_misreading,' +
      'option_c_class.eq.mood_misreading,' +
      'option_d_class.eq.mood_misreading',
    )
    .limit(20);

  if (triggerQuestionId) query.neq('id', triggerQuestionId);

  const { data, error } = await query;
  if (error || !data?.length) return null;

  const pick = data[Math.floor(Math.random() * data.length)] as TransferPassageRow;
  return {
    id: pick.id,
    title: pick.title ?? 'Fresh Mood Passage',
    author: pick.author ?? 'Public Domain',
    text: extractPassage(pick.content),
    canonicalMood: pick.canonical_mood ?? null,
  };
}

export default function TeachMoodPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardCode = params.standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [standardUuid, setStandardUuid] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transferPassage, setTransferPassage] = useState<MoodPassage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [masteryAchieved, setMasteryAchieved] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function init() {
      const supabase = createClient();

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      const sid = student?.id ?? null;
      setStudentId(sid);

      const { data: standard } = await supabase
        .from('standards')
        .select('id')
        .eq('code', standardCode)
        .maybeSingle();
      const stdId = standard?.id ?? null;
      setStandardUuid(stdId);

      if (sid && stdId) {
        const { data: session } = await supabase
          .from('sessions')
          .select('id')
          .eq('student_id', sid)
          .eq('standard_id', stdId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setSessionId(session?.id ?? null);
      }
    }

    init().catch((err) => console.error('[TeachMoodPage] init error:', err));
  }, [authLoading, router, standardCode, user]);

  useEffect(() => {
    if (!standardUuid) return;
    fetchTransferPassage(standardUuid)
      .then(setTransferPassage)
      .catch((err) => {
        console.error('[TeachMoodPage] transfer passage error:', err);
        setTransferPassage(null);
      });
  }, [standardUuid]);

  const starterPassage = useMemo<MoodPassage>(() => STARTER_PASSAGE, []);

  async function completeMoodRun(result: MoodInterventionResult) {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    const studentResponse = JSON.stringify({
      intervention: INTERVENTION_TYPE,
      transfer_passage_id: transferPassage?.id ?? null,
      stages: result.stageHistory,
      completed_at: result.completedAt,
    });

    try {
      if (sessionId && studentId && standardUuid) {
        const response = await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            question_id: null,
            student_id: studentId,
            standard_id: standardUuid,
            cognitive_skill_targeted: COGNITIVE_SKILL,
            diagnostic_classification: null,
            intervention_type: INTERVENTION_TYPE,
            intervention_content: 'Mood skill run: signal words -> feeling -> mood -> proof',
            student_response: studentResponse,
            mastery_achieved: result.masteryAchieved,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'GOGI could not save the mood run.');
        }

        const supabase = createClient();
        await supabase.rpc('append_teach_phase', {
          p_session_id: sessionId,
          p_phase: 'mood',
        });
      }

      setMasteryAchieved(result.masteryAchieved);
      setCompleted(true);
    } catch (err) {
      console.error('[TeachMoodPage] save error:', err);
      setSaveError('Your work is still on this screen. The save did not finish, so try Finish again.');
    } finally {
      setSaving(false);
    }
  }

  if (completed) {
    return (
      <main style={{
        alignItems: 'center',
        background: '#eef3f6',
        color: '#2C2C2A',
        display: 'flex',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        height: '100vh',
        justifyContent: 'center',
        padding: 24,
      }}>
        <section style={{
          background: '#fff',
          border: '1px solid rgba(31,78,121,.16)',
          borderRadius: 8,
          boxShadow: '0 18px 42px rgba(31,78,121,.12)',
          maxWidth: 620,
          padding: 32,
          width: '100%',
        }}>
          <div style={{
            color: '#3B6D11',
            fontSize: 11,
            fontWeight: 850,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
          }}>
            Mood practice complete
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.08, margin: '10px 0 12px' }}>
            You practiced the Mood Move.
          </h1>
          <p style={{ color: '#555', fontSize: 17, fontWeight: 650, lineHeight: 1.5, margin: 0 }}>
            You used signal words to build a feeling, named the mood, and proved it with evidence.
          </p>
          <div style={{
            background: masteryAchieved ? '#C6EFCE' : '#FAEEDA',
            border: `1px solid ${masteryAchieved ? '#3B6D11' : '#BA7517'}`,
            borderRadius: 8,
            color: masteryAchieved ? '#3B6D11' : '#BA7517',
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.45,
            marginTop: 20,
            padding: '12px 14px',
          }}>
            {masteryAchieved
              ? 'Strong finish. You showed the full pattern on the later passages.'
              : 'Good work. This skill still needs more reps, and GOGI saved what you practiced.'}
          </div>
          <button
            onClick={() => router.push('/dashboard/student')}
            style={{
              background: '#173a5d',
              border: '1px solid #173a5d',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontSize: 15,
              fontWeight: 850,
              marginTop: 22,
              minHeight: 48,
              padding: '0 18px',
            }}
            type="button"
          >
            Back to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <MoodInterventionRun
      diagnosticPassage={starterPassage}
      keywordFlags={[]}
      loading={false}
      onComplete={completeMoodRun}
      saveError={saveError}
      saving={saving}
      transferPassage={transferPassage}
    />
  );
}
