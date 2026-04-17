/**
 * reclassify — fires after 3 consecutive failed practice sessions.
 * Reads the student's full response history for this standard, finds the
 * next-best cognitive breakdown classification (excluding the one that
 * already failed), and updates standard_progress accordingly.
 *
 * Called server-side from /api/standard-progress/evaluate — uses admin client.
 */

import { createClient } from '@supabase/supabase-js';

// Admin client — bypasses RLS for trusted server writes
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Classification layer registry ────────────────────────────────────────────

const LAYER_1 = ['schema_deficit', 'no_metacognitive_strategy'];
const LAYER_2 = ['vocabulary_gap', 'morphology_gap', 'syntax_barrier'];
const LAYER_3 = [
  'inferencing_deficit',
  'evidence_retrieval_failure',
  'comprehension_integration_failure',
];

function getLayer(c: string): number {
  if (LAYER_1.includes(c)) return 1;
  if (LAYER_2.includes(c)) return 2;
  if (LAYER_3.includes(c)) return 3;
  return 4; // unknown — lowest priority
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReclassifyResult {
  newClassification:    string;
  shouldFlagTeacher:    boolean;
  reclassificationCount: number;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function reclassify(
  studentId:            string,
  standardId:           string,
  currentClassification: string,
  currentReclassCount:  number,
): Promise<ReclassifyResult> {
  const supabase = createAdminClient();

  // ── Guard: already reclassified twice → flag teacher ─────────────────────
  if (currentReclassCount >= 2) {
    await supabase
      .from('standard_progress')
      .update({
        teacher_flag:        true,
        teacher_flag_reason: 'Student has been reclassified twice without mastery. Manual review required.',
        current_status:      'needs_review',
      })
      .eq('student_id', studentId)
      .eq('standard_id', standardId);

    console.log(`[reclassify] TEACHER FLAG — student=${studentId} already reclassified ${currentReclassCount}x`);

    return {
      newClassification:    currentClassification,
      shouldFlagTeacher:    true,
      reclassificationCount: currentReclassCount,
    };
  }

  // ── Read all non-correct, non-current responses ───────────────────────────
  const { data: responses, error } = await supabase
    .from('responses')
    .select('diagnostic_classification')
    .eq('student_id', studentId)
    .eq('standard_id', standardId)
    .not('diagnostic_classification', 'is', null)
    .neq('diagnostic_classification', 'CORRECT')
    .neq('diagnostic_classification', currentClassification);

  if (error) {
    console.error('[reclassify] responses query failed:', error.message);
  }

  if (!responses || responses.length === 0) {
    // No alternative classification found — flag teacher
    await supabase
      .from('standard_progress')
      .update({
        teacher_flag:        true,
        teacher_flag_reason: 'No alternative classification found in response history. Manual review required.',
        current_status:      'needs_review',
      })
      .eq('student_id', studentId)
      .eq('standard_id', standardId);

    console.log(`[reclassify] TEACHER FLAG — no alternative classification found for student=${studentId}`);

    return {
      newClassification:    currentClassification,
      shouldFlagTeacher:    true,
      reclassificationCount: currentReclassCount,
    };
  }

  // ── Count frequency of each alternative classification ────────────────────
  const counts: Record<string, number> = {};
  for (const r of responses) {
    const cls = (r as { diagnostic_classification: string | null }).diagnostic_classification;
    if (cls) counts[cls] = (counts[cls] ?? 0) + 1;
  }

  // Sort: frequency DESC, then layer ASC (root cause wins on tie)
  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return getLayer(a[0]) - getLayer(b[0]);
  });

  const newClassification = sorted[0][0];
  const newReclassCount   = currentReclassCount + 1;

  console.log(
    `[reclassify] new classification: ${currentClassification} → ${newClassification}`,
    `| reclassCount: ${newReclassCount}`,
    `| alternatives:`, counts,
  );

  // ── Update standard_progress ──────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('standard_progress')
    .update({
      previous_classification: currentClassification,
      reclassification_count:  newReclassCount,
      failed_turns:            0,
      current_status:          'intervening',
    })
    .eq('student_id', studentId)
    .eq('standard_id', standardId);

  if (updateErr) {
    console.error('[reclassify] standard_progress update failed:', updateErr.message);
  }

  return {
    newClassification,
    shouldFlagTeacher:    false,
    reclassificationCount: newReclassCount,
  };
}
