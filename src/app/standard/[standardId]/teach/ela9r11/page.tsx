'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import type { LoadCalibration } from '@/lib/layer0/scoring';
import { getLatestLayer0SessionCalibration } from '@/lib/layer0/sessionCalibration';
import { Ela9R11TeachLoopRunner } from '@/components/teach/Ela9R11TeachLoopRunner';
import { getEla9R11TeachLoop, type TeachLoop, type TeachPhaseRecord } from '@/lib/teach/ela9r11';

type LoadState = 'loading' | 'ready' | 'error';

export default function Ela9R11TeachPage() {
  const params = useParams<{ standardId: string }>();
  const router = useRouter();
  const standardId = params.standardId;
  const standardCode = standardId.replace(/-/g, '.');
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<LoadState>('loading');
  const [studentId, setStudentId] = useState('');
  const [standardUuid, setStandardUuid] = useState('');
  const [diagnosticSessionId, setDiagnosticSessionId] = useState('');
  const [teachSessionId, setTeachSessionId] = useState('');
  const [loadCalibration, setLoadCalibration] = useState<LoadCalibration>('standard');
  const [loop, setLoop] = useState<TeachLoop | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
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
        setStudentId(sid);

        const { data: standard } = await supabase
          .from('standards')
          .select('id')
          .eq('code', standardCode)
          .maybeSingle();

        const stdId = standard?.id ?? '';
        if (!stdId) {
          setState('error');
          return;
        }
        setStandardUuid(stdId);

        const layer0 = await getLatestLayer0SessionCalibration(supabase, sid);
        setLoadCalibration(layer0.loadCalibration ?? 'standard');

        const [{ data: progress }, { data: session }, { data: existingTeachSession }] =
          await Promise.all([
            supabase
              .from('standard_progress')
              .select('current_gap')
              .eq('student_id', sid)
              .eq('standard_id', stdId)
              .maybeSingle(),
            supabase
              .from('sessions')
              .select('id, dominant_classification')
              .eq('student_id', sid)
              .eq('standard_id', stdId)
              .eq('phase', 'diagnostic')
              .eq('status', 'complete')
              .order('completed_at', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('sessions')
              .select('id')
              .eq('student_id', sid)
              .eq('standard_id', stdId)
              .eq('phase', 'teach')
              .eq('status', 'in_progress')
              .order('started_at', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle(),
          ]);

        let resolvedTeachSessionId = (existingTeachSession as { id?: string } | null)?.id ?? '';
        if (!resolvedTeachSessionId) {
          const { data: createdTeachSession, error: teachSessionError } = await supabase
            .from('sessions')
            .insert({
              student_id: sid,
              standard_id: stdId,
              phase: 'teach',
              status: 'in_progress',
              layer0_assessment_id: layer0.layer0AssessmentId,
              load_calibration_at_session: layer0.loadCalibration,
            })
            .select('id')
            .single();

          if (teachSessionError || !createdTeachSession?.id) {
            console.error(
              '[Ela9R11TeachPage] teach session create error:',
              teachSessionError?.message
            );
            setState('error');
            return;
          }
          resolvedTeachSessionId = createdTeachSession.id;
        }

        const flag =
          (progress as { current_gap?: string | null } | null)?.current_gap ??
          (session as { dominant_classification?: string | null } | null)
            ?.dominant_classification ??
          'analysis_too_vague';

        setDiagnosticSessionId((session as { id?: string } | null)?.id ?? '');
        setTeachSessionId(resolvedTeachSessionId);
        setLoop(getEla9R11TeachLoop(flag));
        setState('ready');
      } catch (err) {
        console.error('[Ela9R11TeachPage] init error:', err);
        setState('error');
      }
    }

    init();
  }, [authLoading, router, standardCode, user]);

  async function completeTeachLoop(
    records: TeachPhaseRecord[],
    masteryResponse: string,
    masteryPassed: boolean
  ) {
    if (!loop || saving || !teachSessionId) return;
    setSaving(true);
    setSaveError(null);

    try {
      if (studentId && standardUuid) {
        const response = await fetch('/api/responses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: teachSessionId,
            question_id: null,
            student_id: studentId,
            standard_id: standardUuid,
            cognitive_skill_targeted: 'ela9r11_teach_loop',
            diagnostic_classification: loop.misconceptionFlag,
            intervention_type: 'ela9r11_teach_loop_v1',
            intervention_content: loop.id,
            student_response: JSON.stringify({
              standard_code: 'ELA.9.R.1.1',
              diagnostic_session_id: diagnosticSessionId,
              teach_session_id: teachSessionId,
              load_calibration: loadCalibration,
              primary_misconception_flag: loop.misconceptionFlag,
              assigned_teach_route: loop.routeName,
              teach_loop_id: loop.id,
              step_responses: records,
              transfer_response: masteryResponse,
              mastery_check_score: masteryPassed ? loop.masteryCheck.minimumScoreToPass : 0,
              teach_loop_completion_status: masteryPassed ? 'complete' : 'needs_revision',
              teacher_description: loop.teacherDescription,
              completed_at: new Date().toISOString(),
            }),
            mastery_achieved: masteryPassed,
            attempt_number: 1,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'Teach loop response did not save.');
        }
        const savedResponse = (await response.json().catch(() => ({}))) as { id?: string };

        const supabase = createClient();
        await Promise.all([
          supabase
            .from('sessions')
            .update({
              status: 'complete',
              completed_at: new Date().toISOString(),
              mastery_achieved: masteryPassed,
            })
            .eq('id', teachSessionId),
          supabase.from('standard_progress').upsert(
            {
              student_id: studentId,
              standard_id: standardUuid,
              current_status: 'practicing',
              current_gap: loop.misconceptionFlag,
              last_session_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,standard_id' }
          ),
        ]);

        if (diagnosticSessionId) {
          const { error: insightErr } = await supabase
            .from('diagnostic_insights')
            .update({
              post_intervention_response_id: savedResponse.id ?? null,
              growth_signal: masteryPassed ? 'improved' : 'unchanged',
              updated_at: new Date().toISOString(),
            })
            .eq('session_id', diagnosticSessionId);

          if (insightErr)
            console.warn('[Ela9R11TeachPage] insight update skipped:', insightErr.message);
        }
      }

      router.push(`/standard/${standardId}/practice`);
    } catch (err) {
      console.error('[Ela9R11TeachPage] completion save error:', err);
      setSaveError('Your work is still here. The save did not finish, so try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveTeachStep(record: TeachPhaseRecord, records: TeachPhaseRecord[]) {
    if (!loop || !studentId || !standardUuid || !teachSessionId) return;

    try {
      await fetch('/api/responses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: teachSessionId,
          question_id: null,
          student_id: studentId,
          standard_id: standardUuid,
          cognitive_skill_targeted: 'ela9r11_teach_step',
          diagnostic_classification: loop.misconceptionFlag,
          intervention_type: 'ela9r11_teach_step_v1',
          intervention_content: loop.id,
          student_response: JSON.stringify({
            standard_code: 'ELA.9.R.1.1',
            diagnostic_session_id: diagnosticSessionId,
            teach_session_id: teachSessionId,
            load_calibration: loadCalibration,
            primary_misconception_flag: loop.misconceptionFlag,
            assigned_teach_route: loop.routeName,
            teach_loop_id: loop.id,
            current_teach_step: record.stepId,
            current_teach_phase: record.phaseName,
            step_response: record,
            step_responses_so_far: records,
            step_feedback: record.feedback,
            step_status: record.status,
            teach_loop_completion_status: 'in_progress',
            teacher_description: loop.teacherDescription,
            saved_at: new Date().toISOString(),
          }),
          mastery_achieved: false,
          attempt_number: 1,
        }),
      });
    } catch (err) {
      console.error('[Ela9R11TeachPage] step progress save error:', err);
    }
  }

  if (state === 'loading') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#F8F9FA',
          fontFamily: FONTS.ui,
        }}
      >
        <p style={{ color: C.gray, fontSize: 14 }}>Loading your teach loop...</p>
      </main>
    );
  }

  if (state === 'error' || !loop) {
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
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Teach loop could not load.</h1>
          <p style={{ fontSize: 13, color: C.blueMid, lineHeight: 1.5, margin: 0 }}>
            Tell your teacher. GOGI could not find the diagnostic route for this standard.
          </p>
        </section>
      </main>
    );
  }

  return (
    <Ela9R11TeachLoopRunner
      loop={loop}
      saving={saving}
      saveError={saveError}
      loadCalibration={loadCalibration}
      onStepSubmit={saveTeachStep}
      onComplete={completeTeachLoop}
    />
  );
}
