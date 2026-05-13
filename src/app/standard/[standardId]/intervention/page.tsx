'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Ela9R11InferenceIntervention } from '@/components/intervention/Ela9R11InferenceIntervention';
import { C, FONTS } from '@/lib/constants/design';
import { createClient } from '@/lib/supabase/client';
import { getLatestLayer0SessionCalibration } from '@/lib/layer0/sessionCalibration';
import { ELA9R11_INFERENCE_PASSAGE, type InferenceAttempt } from '@/lib/intervention/ela9r11';
import { getPrimaryFastReadingDemand } from '@/lib/reading-wins/fastSkillMap';
import {
  estimateCognitiveDifficulty,
  getCognitiveMoveProfile,
} from '@/lib/reading-wins/cognitiveMovesEngine';
import {
  buildReadingWinSessionFromQuestions,
  extractReadingWinQuestionTaxonomy,
  type PromotedReadingWinQuestion,
} from '@/lib/reading-wins/sessionBuilder';
import type { ReadingWinSession } from '@/lib/reading-wins/r31FigurativeLanguageSession';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';

type LoadState = 'loading' | 'ready' | 'error';

export default function Ela9R11InterventionPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const standardId = params.standardId;
  const preview = searchParams.get('preview') === '1';
  const requestedStrandId = searchParams.get('strand');
  const standardCode = standardId.replace(/-/g, '.');
  const readingDemand = getPrimaryFastReadingDemand(standardCode);
  const requestedStrand = requestedStrandId
    ? getGutenbergStandardBlueprint(standardCode)?.coverageStrands?.find(
        (strand) => strand.id === requestedStrandId
      )
    : null;
  const cognitiveProfile = getCognitiveMoveProfile(standardCode);
  const cognitiveDifficulty = cognitiveProfile
    ? estimateCognitiveDifficulty(cognitiveProfile)
    : null;
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<LoadState>('loading');
  const [studentId, setStudentId] = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [currentGap, setCurrentGap] = useState('ela9r11_inference');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [readingWinSession, setReadingWinSession] = useState<ReadingWinSession | null>(null);

  useEffect(() => {
    if (preview) {
      setStudentId('preview-student');
      setStandardUuid('preview-standard');
      setSessionId('preview-session');
      setState('ready');
      return;
    }

    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function init() {
      try {
        const supabase = createClient();

        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        const sid = student?.id ?? '';
        if (!sid) {
          setState('error');
          return;
        }

        const { data: standard } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();

        let stdId = standard?.id ?? '';
        if (!stdId && standardCode !== 'ELA.9.R.1.1') {
          const { data: fallbackStandard } = await supabase
            .from('standards')
            .select('id')
            .eq('code', 'ELA.9.R.1.1')
            .maybeSingle();
          stdId = fallbackStandard?.id ?? '';
        }

        if (!stdId) {
          setState('error');
          return;
        }

        const { data: progress } = await supabase
          .from('standard_progress')
          .select('current_gap')
          .eq('student_id', sid)
          .eq('standard_id', stdId)
          .maybeSingle();

        const layer0 = await getLatestLayer0SessionCalibration(supabase, sid);

        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('student_id', sid)
          .eq('standard_id', stdId)
          .eq('phase', 'teach')
          .eq('status', 'in_progress')
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        let teachSessionId = existingSession?.id ?? '';
        if (!teachSessionId) {
          const { data: createdSession, error } = await supabase
            .from('sessions')
            .insert({
              student_id: sid,
              standard_id: stdId,
              phase: 'teach',
              status: 'in_progress',
              started_at: new Date().toISOString(),
              dominant_classification: readingDemand?.id ?? 'ela9r11_inference_engine',
              layer0_assessment_id: layer0.layer0AssessmentId,
              load_calibration_at_session: layer0.loadCalibration,
            })
            .select('id')
            .single();

          if (error || !createdSession?.id) {
            console.error('[Ela9R11Intervention] session create error:', error?.message);
            setState('error');
            return;
          }
          teachSessionId = createdSession.id;
        }

        setStudentId(sid);
        setStandardUuid(stdId);
        setSessionId(teachSessionId);
        setCurrentGap(
          (progress as { current_gap?: string | null } | null)?.current_gap ?? 'ela9r11_inference'
        );

        if (readingDemand) {
          const filters = [
            standard?.id ? `standard_id.eq.${standard.id}` : null,
            `cognitive_skill_targeted.eq.${standardCode}`,
            `source_classification.eq.${standardCode}`,
          ]
            .filter(Boolean)
            .join(',');
          const { data: questionRows, error: questionError } = await supabase
            .from('questions')
            .select(
              'id, content, cognitive_skill_targeted, difficulty_level, title, option_a_text, option_b_text, option_c_text, option_d_text, correct_option, rationale, source, is_released_item'
            )
            .eq('approved', true)
            .eq('flagged', false)
            .or(filters)
            .order('is_released_item', { ascending: true })
            .order('difficulty_level', { ascending: true })
            .limit(12);

          if (!questionError) {
            const allQuestions = (questionRows ?? []) as PromotedReadingWinQuestion[];
            const strandQuestions = requestedStrand
              ? allQuestions.filter((question) => {
                  const taxonomy = extractReadingWinQuestionTaxonomy(question);
                  return taxonomy.targetSkill === requestedStrand.label;
                })
              : [];
            setReadingWinSession(
              buildReadingWinSessionFromQuestions({
                demand: readingDemand,
                questions: strandQuestions.length >= 6 ? strandQuestions : allQuestions,
              })
            );
          }
        }

        setState('ready');
      } catch (err) {
        console.error('[Ela9R11Intervention] init error:', err);
        setState('error');
      }
    }

    init();
  }, [authLoading, preview, readingDemand?.id, requestedStrand?.label, router, standardCode, user]);

  async function saveAttempt(attempt: InferenceAttempt, allAttempts: InferenceAttempt[]) {
    if (preview) return;
    if (!studentId || !standardUuid || !sessionId) return;

    try {
      await fetch('/api/responses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: null,
          student_id: studentId,
          standard_id: standardUuid,
          cognitive_skill_targeted: readingDemand?.id ?? 'ela9r11_inference_engine',
          diagnostic_classification: attempt.scaffoldMove,
          intervention_type: 'fast_reading_win_v1',
          intervention_content: ELA9R11_INFERENCE_PASSAGE.id,
          student_response: JSON.stringify({
            standard_code: standardCode,
            source: 'fast_reading_win_dynamic',
            reading_win_id: readingDemand?.id ?? 'ela9r11_inference',
            fast_demand: readingDemand?.fastDemand ?? null,
            cognitive_move_profile: cognitiveProfile?.honestSkillName ?? null,
            cognitive_move_chain: cognitiveProfile?.chain.map((move) => move.id) ?? [],
            cognitive_difficulty: cognitiveDifficulty,
            passage_id: ELA9R11_INFERENCE_PASSAGE.id,
            point_id: attempt.pointId,
            attempt,
            attempts_so_far: allAttempts,
            current_gap: currentGap,
            saved_at: new Date().toISOString(),
          }),
          mastery_achieved: attempt.quality === 'strong',
          attempt_number: attempt.attemptNumber,
        }),
      });
    } catch (err) {
      console.error('[Ela9R11Intervention] attempt save error:', err);
    }
  }

  async function completeIntervention(attempts: InferenceAttempt[], closingResponse: string) {
    if (preview) {
      router.push('/demo/cockpit?demoNav=1&completed=reading-win');
      return;
    }

    if (!studentId || !standardUuid || !sessionId || saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      let closingPayload: { transfer_correct?: boolean | null; clinical_flag?: boolean | null } =
        {};
      try {
        closingPayload = JSON.parse(closingResponse);
      } catch {
        closingPayload = {};
      }
      const transferPassed = closingPayload.transfer_correct === true;

      const response = await fetch('/api/responses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: null,
          student_id: studentId,
          standard_id: standardUuid,
          cognitive_skill_targeted: 'ela9r11_inference_engine_closing',
          diagnostic_classification: 'ela9r11_inference_engine',
          intervention_type: 'fast_reading_win_v1',
          intervention_content: ELA9R11_INFERENCE_PASSAGE.id,
          student_response: JSON.stringify({
            standard_code: standardCode,
            source: 'fast_reading_win_dynamic',
            reading_win_id: readingDemand?.id ?? 'ela9r11_inference',
            fast_demand: readingDemand?.fastDemand ?? null,
            student_move: readingDemand?.studentMove ?? null,
            cognitive_move_profile: cognitiveProfile?.honestSkillName ?? null,
            cognitive_move_chain: cognitiveProfile?.chain.map((move) => move.id) ?? [],
            cognitive_breakpoints: cognitiveProfile?.breakpoints.map((point) => point.id) ?? [],
            cognitive_difficulty: cognitiveDifficulty,
            passage_id: ELA9R11_INFERENCE_PASSAGE.id,
            closing_prompt: ELA9R11_INFERENCE_PASSAGE.closingQuestion,
            closing_response: closingResponse,
            attempts,
            completed_at: new Date().toISOString(),
          }),
          mastery_achieved: transferPassed,
          attempt_number: 1,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Intervention response did not save.');
      }

      const supabase = createClient();
      const { data: existingProgress } = await supabase
        .from('standard_progress')
        .select('sessions_passed, sessions_attempted')
        .eq('student_id', studentId)
        .eq('standard_id', standardUuid)
        .maybeSingle();

      const sessionsAttempted =
        ((existingProgress as { sessions_attempted?: number } | null)?.sessions_attempted ?? 0) + 1;
      const sessionsPassed =
        ((existingProgress as { sessions_passed?: number } | null)?.sessions_passed ?? 0) +
        (transferPassed ? 1 : 0);
      const progressUpdate: Record<string, unknown> = {
        student_id: studentId,
        standard_id: standardUuid,
        current_status: sessionsPassed >= 3 ? 'mastered' : 'in_intervention',
        sessions_attempted: sessionsAttempted,
        sessions_passed: sessionsPassed,
        current_gap: currentGap,
        last_session_at: new Date().toISOString(),
      };
      if (sessionsPassed >= 3) {
        progressUpdate.mastered_at = new Date().toISOString();
      }

      await Promise.all([
        supabase
          .from('sessions')
          .update({
            status: 'complete',
            mastery_achieved: transferPassed,
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId),
        supabase
          .from('standard_progress')
          .upsert(progressUpdate, { onConflict: 'student_id,standard_id' }),
      ]);

      router.push(`/standard/${standardId}/progress?win=1`);
    } catch (err) {
      console.error('[Ela9R11Intervention] completion save error:', err);
      setSaveError('Your work is still here. The save did not finish, so try again.');
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#F7F3EA',
          fontFamily: FONTS.ui,
        }}
      >
        <p style={{ color: C.gray, fontSize: 14 }}>Loading your Reading Win...</p>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: C.navy,
          fontFamily: FONTS.ui,
        }}
      >
        <section
          style={{
            width: 'min(420px, calc(100vw - 40px))',
            background: C.darkCard,
            border: `1px solid ${C.darkBorder}`,
            borderRadius: 10,
            padding: 24,
            color: C.white,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Reading Win could not load.</h1>
          <p style={{ fontSize: 13, color: C.blueMid, lineHeight: 1.5, margin: 0 }}>
            Tell your teacher. GOGI could not start this Reading Win yet.
          </p>
        </section>
      </main>
    );
  }

  return (
    <Ela9R11InferenceIntervention
      standardCode={standardCode}
      readingDemand={readingDemand}
      readingWinSession={readingWinSession}
      saving={saving}
      saveError={saveError}
      onAttempt={saveAttempt}
      onComplete={completeIntervention}
    />
  );
}
