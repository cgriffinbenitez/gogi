import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { reclassify } from '@/lib/classify/reclassify';

// Service-role client for trusted writes (bypasses RLS for server operations)
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_id,
      standard_id,
      session_id,
      correct_count,
      total_questions,
      current_classification,
    } = body as {
      student_id:             string;
      standard_id:            string;
      session_id:             string;
      correct_count:          number;
      total_questions:        number;
      current_classification: string;
    };

    if (!student_id || !standard_id || !session_id) {
      return NextResponse.json(
        { error: 'student_id, standard_id, session_id required' },
        { status: 400 },
      );
    }

    // Verify the caller is authenticated
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Pass threshold: 80% (4 of 5 questions)
    const passThreshold = Math.round(total_questions * 0.8);
    const passed = correct_count >= passThreshold;

    console.log(
      `[evaluate] student=${student_id} standard=${standard_id}`,
      `correct=${correct_count}/${total_questions} threshold=${passThreshold} passed=${passed}`,
    );

    // Fetch current progress (sessions_passed, sessions_attempted, failed_turns, reclassification_count)
    const { data: progressRaw } = await supabase
      .from('standard_progress')
      .select('sessions_passed, sessions_attempted, current_status, failed_turns, reclassification_count')
      .eq('student_id', student_id)
      .eq('standard_id', standard_id)
      .maybeSingle();

    const progress = progressRaw as {
      sessions_passed?:      number;
      sessions_attempted?:   number;
      current_status?:       string;
      failed_turns?:         number;
      reclassification_count?: number;
    } | null;

    const currentPassed        = progress?.sessions_passed       ?? 0;
    const currentAttempted     = progress?.sessions_attempted    ?? 0;
    const currentFailedTurns   = progress?.failed_turns          ?? 0;
    const currentReclassCount  = progress?.reclassification_count ?? 0;

    // ── PASS branch ──────────────────────────────────────────────────────────
    if (passed) {
      const newSessionsPassed = currentPassed + 1;

      let result:    'mastered' | 'reinforcing' | 'practicing';
      let newStatus: string;

      if (newSessionsPassed >= 3) {
        result    = 'mastered';
        newStatus = 'mastered';
      } else if (newSessionsPassed === 2) {
        result    = 'reinforcing';
        newStatus = 'reinforcing';
      } else {
        result    = 'practicing';
        newStatus = 'practicing';
      }

      const progressUpdate: Record<string, unknown> = {
        student_id,
        standard_id,
        sessions_passed:    newSessionsPassed,
        sessions_attempted: currentAttempted + 1,
        current_status:     newStatus,
        last_session_at:    new Date().toISOString(),
        failed_turns:       0, // reset on pass
      };
      if (newStatus === 'mastered') {
        progressUpdate.mastered_at = new Date().toISOString();
      }

      const { error: upsertErr } = await supabase
        .from('standard_progress')
        .upsert(progressUpdate, { onConflict: 'student_id,standard_id' });

      if (upsertErr) console.error('[evaluate] progress upsert error:', upsertErr.message);

      await supabase
        .from('sessions')
        .update({
          mastery_achieved: newStatus === 'mastered',
          status:           'complete',
          completed_at:     new Date().toISOString(),
        })
        .eq('id', session_id);

      console.log(`[evaluate] PASS — result=${result} sessions_passed=${newSessionsPassed}`);
      return NextResponse.json({ result, sessions_passed: newSessionsPassed });
    }

    // ── FAIL branch ──────────────────────────────────────────────────────────

    const newFailedTurns = currentFailedTurns + 1;

    // Upsert incremented failed_turns (reclassify will reset to 0 if it fires)
    const { error: upsertErr } = await supabase
      .from('standard_progress')
      .upsert({
        student_id,
        standard_id,
        sessions_passed:    0,
        sessions_attempted: currentAttempted + 1,
        current_status:     'intervening',
        last_session_at:    new Date().toISOString(),
        failed_turns:       newFailedTurns,
      }, { onConflict: 'student_id,standard_id' });

    if (upsertErr) console.error('[evaluate] progress upsert error (fail):', upsertErr.message);

    await supabase
      .from('sessions')
      .update({
        mastery_achieved: false,
        status:           'complete',
        completed_at:     new Date().toISOString(),
      })
      .eq('id', session_id);

    console.log(
      `[evaluate] FAIL — failed_turns=${newFailedTurns} reclassCount=${currentReclassCount}`,
      `classification=${current_classification}`,
    );

    // ── Reclassification trigger: 3 failed turns ─────────────────────────────
    if (newFailedTurns >= 3) {
      console.log(`[evaluate] RECLASSIFY TRIGGER — calling reclassify()`);

      const reclassResult = await reclassify(
        student_id,
        standard_id,
        current_classification,
        currentReclassCount,
      );

      if (reclassResult.shouldFlagTeacher) {
        // Update the session to mark it for teacher review
        await supabase
          .from('sessions')
          .update({ needs_teacher_review: true })
          .eq('id', session_id);

        return NextResponse.json({ result: 'needs_teacher_review' });
      }

      // Update this session's dominant_classification to the new one
      await supabase
        .from('sessions')
        .update({
          dominant_classification: reclassResult.newClassification,
          needs_teacher_review:    false,
        })
        .eq('id', session_id);

      return NextResponse.json({
        result:               'reclassified',
        newClassification:    reclassResult.newClassification,
        reclassificationCount: reclassResult.reclassificationCount,
      });
    }

    // Normal fail — not yet at 3 turns
    return NextResponse.json({
      result:      'failed',
      sessions_passed: 0,
      failedTurns: newFailedTurns,
    });

  } catch (err) {
    console.error('[api/standard-progress/evaluate] exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
