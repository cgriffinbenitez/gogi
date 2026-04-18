/**
 * classifySession — reads all diagnostic responses for a session, determines the
 * dominant cognitive breakdown classification, and writes it back to sessions.
 *
 * Clinical rules:
 * - 8+ correct of total questions → skipTeach (route to /practice)
 * - Dominant classification = most frequent non-CORRECT classification
 * - Tie-break: Layer 1 beats Layer 2, Layer 2 beats Layer 3 (root cause wins)
 */

import { createClient } from '@/lib/supabase/client';

// ─── Classification layer registry ────────────────────────────────────────────
// Sprint O — 13 canonical codes aligned to CPALMS ELA.9.R standards

const LAYER_1 = new Set([
  'no_metacognitive_strategy',                // Pre-reading: no strategy schema
]);
const LAYER_2 = new Set([
  'vocabulary_gap',                           // During-reading: unknown word blocks comprehension
  'morphology_gap',                           // During-reading: word structure failure
  'syntax_barrier',                           // During-reading: sentence structure failure
  'figurative_language_failure',              // During-reading: literal reading of figurative language
]);
const LAYER_3 = new Set([
  'mood_misreading',                          // After-reading: confuses character emotion with mood
  'tone_misreading',                          // After-reading: confuses content with author attitude
  'inferencing_literal',                      // After-reading: reads literally, misses implied meaning
  'inferencing_schema',                       // After-reading: activates wrong background schema
  'inferencing_wm',                           // After-reading: working memory failure breaks inference chain
  'topic_vs_theme_confusion',                 // After-reading: names topic instead of theme statement
  'evidence_retrieval_failure',               // After-reading: cannot locate supporting textual evidence
  'structure_purpose_disconnect',             // After-reading: identifies structure but misses author purpose
  'comprehension_integration_failure',        // After-reading: cannot synthesize across the whole text
]);

function getLayer(cls: string): number {
  if (LAYER_1.has(cls)) return 1;
  if (LAYER_2.has(cls)) return 2;
  if (LAYER_3.has(cls)) return 3;
  return 4; // unknown — lowest priority
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassifySessionResult {
  classification: string;
  skipTeach: boolean;
  confidence: number; // 0–100 — fraction of errors pointing to dominant class
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function classifySession(sessionId: string): Promise<ClassifySessionResult> {
  const supabase = createClient();

  // 1. Read all responses for this session
  const { data: responseRows, error } = await supabase
    .from('responses')
    .select('diagnostic_classification, mastery_achieved')
    .eq('session_id', sessionId);

  if (error) {
    console.error('[classifySession] response query failed:', error.message);
  }

  const rows = (responseRows ?? []) as Array<{
    diagnostic_classification: string | null;
    mastery_achieved: boolean | null;
  }>;

  const total = rows.length;
  const correctCount = rows.filter((r) => r.mastery_achieved === true).length;

  console.log(
    `[classifySession] sessionId=${sessionId} total=${total} correct=${correctCount}`,
  );

  // 2. Mastery shortcut: 8+ correct
  const passThreshold = 8;
  if (correctCount >= passThreshold) {
    const confidence = Math.round((correctCount / Math.max(total, 1)) * 100);

    await supabase
      .from('sessions')
      .update({
        dominant_classification:     'CORRECT',
        classification_confidence:   confidence,
        mastery_achieved:            true,
        status:                      'complete',
        completed_at:                new Date().toISOString(),
      })
      .eq('id', sessionId);

    console.log(
      `[classifySession] SKIP TEACH — ${correctCount}/${total} correct (${confidence}% confidence)`,
    );
    return { classification: 'CORRECT', skipTeach: true, confidence };
  }

  // 3. Count non-correct classifications
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.mastery_achieved !== true && row.diagnostic_classification) {
      const cls = row.diagnostic_classification;
      counts[cls] = (counts[cls] ?? 0) + 1;
    }
  }

  // 4. Determine dominant with tie-break (lower layer wins)
  let dominant = 'no_metacognitive_strategy'; // safe default — Layer 1
  let dominantCount = 0;
  let dominantLayer = 4;

  for (const [cls, count] of Object.entries(counts)) {
    const layer = getLayer(cls);
    if (
      count > dominantCount ||
      (count === dominantCount && layer < dominantLayer)
    ) {
      dominant      = cls;
      dominantCount = count;
      dominantLayer = layer;
    }
  }

  const confidence = Math.round((dominantCount / Math.max(total, 1)) * 100);

  console.log(
    `[classifySession] dominant=${dominant} count=${dominantCount}/${total} (${confidence}% confidence) layer=${dominantLayer}`,
  );
  console.log('[classifySession] full distribution:', counts);

  // 5. Write results to session
  const { error: updateErr } = await supabase
    .from('sessions')
    .update({
      dominant_classification:   dominant,
      classification_confidence: confidence,
      mastery_achieved:          false,
      status:                    'complete',
      completed_at:              new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateErr) {
    console.error('[classifySession] session update failed:', updateErr.message);
  }

  return { classification: dominant, skipTeach: false, confidence };
}
