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

const LAYER_1 = new Set([
  'schema_deficit',
  'no_metacognitive_strategy',
  'no_theme_schema',
  'no_struct_schema',
]);
const LAYER_2 = new Set([
  'vocabulary_gap',
  'morphology_gap',
  'syntax_barrier',
  'signal_word_blind',
]);
const LAYER_3 = new Set([
  'inferencing_deficit',
  'evidence_retrieval_failure',
  'comprehension_integration_failure',
  'literal_misreading',
  'theme_confusion',
  'abstract_reasoning_deficit',
  'concrete_thinking',
  'theme_evidence_disconnection',
  'purpose_failure',
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
  let dominant = 'schema_deficit'; // safe default
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
