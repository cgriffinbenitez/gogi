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

    // Fetch current progress (including gap tracking columns)
    const { data: progressRaw } = await supabase
      .from('standard_progress')
      .select('sessions_passed, sessions_attempted, current_status, failed_turns, reclassification_count, gaps_identified, gaps_addressed, current_gap')
      .eq('student_id', student_id)
      .eq('standard_id', standard_id)
      .maybeSingle();

    const progress = progressRaw as {
      sessions_passed?:        number;
      sessions_attempted?:     number;
      current_status?:         string;
      failed_turns?:           number;
      reclassification_count?: number;
      gaps_identified?:        string[];
      gaps_addressed?:         string[];
      current_gap?:            string | null;
    } | null;

    const currentPassed        = progress?.sessions_passed       ?? 0;
    const currentAttempted     = progress?.sessions_attempted    ?? 0;
    const currentFailedTurns   = progress?.failed_turns          ?? 0;
    const currentReclassCount  = progress?.reclassification_count ?? 0;
    const gapsIdentified       = progress?.gaps_identified       ?? [];
    const gapsAddressed        = progress?.gaps_addressed        ?? [];
    const currentGap           = progress?.current_gap           ?? current_classification ?? null;

    // ── PASS branch ──────────────────────────────────────────────────────────
    if (passed) {
      // Mark this gap as addressed
      const newGapsAddressed = currentGap && !gapsAddressed.includes(currentGap)
        ? [...gapsAddressed, currentGap]
        : gapsAddressed;

      // Remaining gaps = gaps identified but not yet addressed
      const remainingGaps = gapsIdentified.filter((g) => !newGapsAddressed.includes(g));

      let result:    'mastered' | 'gap_complete' | 'practicing';
      let newStatus: string;
      let nextGap:   string | null = null;

      if (remainingGaps.length === 0) {
        // All gaps addressed — mastery achieved
        result    = 'mastered';
        newStatus = 'mastered';
      } else {
        // More gaps remain — advance to next gap
        nextGap   = remainingGaps[0];
        result    = 'gap_complete';
        newStatus = 'intervening';
      }

      const progressUpdate: Record<string, unknown> = {
        student_id,
        standard_id,
        sessions_passed:    result === 'mastered' ? currentPassed + 1 : 0, // reset per-gap counter
        sessions_attempted: currentAttempted + 1,
        current_status:     newStatus,
        last_session_at:    new Date().toISOString(),
        failed_turns:       0,
        gaps_addressed:     newGapsAddressed,
        current_gap:        nextGap,
      };
      if (newStatus === 'mastered') {
        progressUpdate.mastered_at   = new Date().toISOString();
        progressUpdate.sessions_passed = currentPassed + 1;
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

      console.log(
        `[evaluate] PASS — result=${result} gapAddressed=${currentGap}`,
        `addressed=${newGapsAddressed.length}/${gapsIdentified.length} remaining=${remainingGaps.length}`,
        nextGap ? `nextGap=${nextGap}` : 'ALL GAPS DONE',
      );
      return NextResponse.json({
        result,
        gaps_addressed:   newGapsAddressed,
        gaps_remaining:   remainingGaps,
        next_gap:         nextGap,
        sessions_passed:  currentPassed + 1,
      });
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
