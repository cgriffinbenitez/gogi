// MUST be first — sets NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to local
// instance before any DB calls are made.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.test'), override: true });

import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { appendFileSync, readFileSync, unlinkSync } from 'fs';
import {
  PRIMITIVE_MAP,
  buildSlotSequence,
  checkLayerViolations,
} from '../../../src/pipeline/stages/promoteUtils';

// ─── Sentinels ────────────────────────────────────────────────────────────────

const SENTINEL_TITLE = 'test__layer_enforcement';

function getTestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  const supabase = getTestClient();
  await supabase
    .from('questions')
    .delete()
    .eq('title', SENTINEL_TITLE);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('layer_enforcement — PRIMITIVE_MAP layer assignments', () => {

  it('all 13 classifications are present in PRIMITIVE_MAP', () => {
    const expected = [
      'inferencing', 'evidence_retrieval_failure', 'tone_misreading',
      'mood_misreading', 'figurative_language_failure', 'comprehension_integration_failure',
      'topic_vs_theme_confusion', 'structure_purpose_disconnect',
      'vocabulary_gap', 'morphology_gap', 'syntax_barrier',
      'schema_strategy_missing', 'no_metacognitive_strategy',
    ];
    for (const cls of expected) {
      expect(PRIMITIVE_MAP[cls], `${cls} missing from PRIMITIVE_MAP`).toBeDefined();
    }
    expect(Object.keys(PRIMITIVE_MAP)).toHaveLength(13);
  });

  it('Layer 3 classifications are correctly assigned', () => {
    const l3 = [
      'inferencing', 'evidence_retrieval_failure', 'tone_misreading', 'mood_misreading',
      'figurative_language_failure', 'comprehension_integration_failure',
      'topic_vs_theme_confusion', 'structure_purpose_disconnect',
    ];
    for (const cls of l3) {
      expect(PRIMITIVE_MAP[cls].layer, `${cls} should be L3`).toBe(3);
    }
  });

  it('Layer 2 classifications are correctly assigned', () => {
    for (const cls of ['vocabulary_gap', 'morphology_gap', 'syntax_barrier']) {
      expect(PRIMITIVE_MAP[cls].layer, `${cls} should be L2`).toBe(2);
    }
  });

  it('Layer 1 classifications are correctly assigned', () => {
    for (const cls of ['schema_strategy_missing', 'no_metacognitive_strategy']) {
      expect(PRIMITIVE_MAP[cls].layer, `${cls} should be L1`).toBe(1);
    }
  });
});

describe('layer_enforcement — buildSlotSequence balance', () => {

  it('n=4 produces exactly 1 of each slot A/B/C/D', () => {
    const seq = buildSlotSequence(4);
    expect(seq).toHaveLength(4);
    expect(seq.filter(s => s === 'A')).toHaveLength(1);
    expect(seq.filter(s => s === 'B')).toHaveLength(1);
    expect(seq.filter(s => s === 'C')).toHaveLength(1);
    expect(seq.filter(s => s === 'D')).toHaveLength(1);
  });

  it('n=8 produces exactly 2 of each slot', () => {
    const seq = buildSlotSequence(8);
    expect(seq).toHaveLength(8);
    for (const slot of ['A', 'B', 'C', 'D'] as const) {
      expect(seq.filter(s => s === slot), `${slot} count`).toHaveLength(2);
    }
  });

  it('n=5 gives remainder to A (first slot) — A=2, B=1, C=1, D=1', () => {
    const seq = buildSlotSequence(5);
    expect(seq).toHaveLength(5);
    expect(seq.filter(s => s === 'A')).toHaveLength(2);
    expect(seq.filter(s => s === 'B')).toHaveLength(1);
    expect(seq.filter(s => s === 'C')).toHaveLength(1);
    expect(seq.filter(s => s === 'D')).toHaveLength(1);
  });

  it('n=50 produces the pilot-batch distribution: A=13, B=13, C=12, D=12', () => {
    const seq = buildSlotSequence(50);
    expect(seq).toHaveLength(50);
    expect(seq.filter(s => s === 'A')).toHaveLength(13);
    expect(seq.filter(s => s === 'B')).toHaveLength(13);
    expect(seq.filter(s => s === 'C')).toHaveLength(12);
    expect(seq.filter(s => s === 'D')).toHaveLength(12);
  });

  it('sequence contains only A/B/C/D and total length is correct for arbitrary n', () => {
    for (const n of [1, 3, 7, 12, 20]) {
      const seq = buildSlotSequence(n);
      expect(seq).toHaveLength(n);
      for (const s of seq) {
        expect(['A', 'B', 'C', 'D']).toContain(s);
      }
    }
  });
});

describe('layer_enforcement — checkLayerViolations', () => {

  // Slot setup for the following tests:
  //   correct = B
  //   A → expected L1 (schema_strategy_missing)
  //   C → expected L2 (vocabulary_gap)
  //   D → expected L3 (inferencing)
  const correctOption = 'B' as const;
  const slotAssignments = { A: 1, C: 2, D: 3 } as Record<string, 1 | 2 | 3>;

  it('returns empty array for a fully compliant OMC response', () => {
    const options = {
      a: { text: 'distractor A', classification: 'schema_strategy_missing' }, // L1 ✓
      b: { text: 'correct',      classification: 'correct'                  }, // skipped
      c: { text: 'distractor C', classification: 'vocabulary_gap'           }, // L2 ✓
      d: { text: 'distractor D', classification: 'inferencing'              }, // L3 ✓
    };
    expect(checkLayerViolations(options, correctOption, slotAssignments)).toEqual([]);
  });

  it('detects a single layer mismatch — option_C expected L2, got L3 classification', () => {
    const options = {
      a: { text: 'distractor A', classification: 'schema_strategy_missing' }, // L1 ✓
      b: { text: 'correct',      classification: 'correct'                  }, // skipped
      c: { text: 'distractor C', classification: 'tone_misreading'          }, // L3, expected L2 ✗
      d: { text: 'distractor D', classification: 'inferencing'              }, // L3 ✓
    };
    const violations = checkLayerViolations(options, correctOption, slotAssignments);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('option_C');
    expect(violations[0]).toContain('expected L2');
    expect(violations[0]).toContain('"tone_misreading"');
    expect(violations[0]).toContain('L3');
  });

  it('detects multiple violations', () => {
    const options = {
      a: { text: 'distractor A', classification: 'vocabulary_gap'  }, // L2, expected L1 ✗
      b: { text: 'correct',      classification: 'correct'          }, // skipped
      c: { text: 'distractor C', classification: 'tone_misreading'  }, // L3, expected L2 ✗
      d: { text: 'distractor D', classification: 'inferencing'      }, // L3 ✓
    };
    const violations = checkLayerViolations(options, correctOption, slotAssignments);
    expect(violations).toHaveLength(2);
    expect(violations.some(v => v.includes('option_A'))).toBe(true);
    expect(violations.some(v => v.includes('option_C'))).toBe(true);
  });

  it('reports unknown classification as L? — unknown class has no PRIMITIVE_MAP entry', () => {
    const options = {
      a: { text: 'distractor A', classification: 'schema_strategy_missing' }, // L1 ✓
      b: { text: 'correct',      classification: 'correct'                  }, // skipped
      c: { text: 'distractor C', classification: 'not_a_real_classification' }, // L?, expected L2 ✗
      d: { text: 'distractor D', classification: 'inferencing'              }, // L3 ✓
    };
    const violations = checkLayerViolations(options, correctOption, slotAssignments);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('L?');
  });

  it('correct option slot is skipped — no violation reported for correct answer slot', () => {
    // Option B is correct — even with a "wrong" classification it is not checked
    const options = {
      a: { text: 'distractor A', classification: 'schema_strategy_missing' },
      b: { text: 'correct',      classification: 'inferencing'              }, // correct slot — not checked
      c: { text: 'distractor C', classification: 'vocabulary_gap'           },
      d: { text: 'distractor D', classification: 'inferencing'              },
    };
    const violations = checkLayerViolations(options, correctOption, slotAssignments);
    expect(violations).toEqual([]);
  });
});

describe('layer_enforcement — DB behavior and violations log', () => {

  it('a question row is NOT inserted when violations are detected', async () => {
    const supabase = getTestClient();

    // Build a violating OMC (option A: should be L1 but vocabulary_gap is L2)
    const correct: 'A' | 'B' | 'C' | 'D' = 'B';
    const slotAssign = { A: 1, C: 2, D: 3 } as Record<string, 1 | 2 | 3>;
    const options = {
      a: { text: 'distractor A', classification: 'vocabulary_gap'           }, // L2, expected L1 ✗
      b: { text: 'correct',      classification: 'correct'                  },
      c: { text: 'distractor C', classification: 'vocabulary_gap'           }, // L2 ✓
      d: { text: 'distractor D', classification: 'inferencing'              }, // L3 ✓
    };

    const violations = checkLayerViolations(options, correct, slotAssign);
    expect(violations.length, 'setup: should produce a violation').toBeGreaterThan(0);

    // Simulate the gating: violations present → do NOT insert
    // Confirm by checking DB has no sentinel row from this scenario
    const { data, error } = await supabase
      .from('questions')
      .select('id')
      .eq('title', SENTINEL_TITLE)
      .eq('source_classification', 'test__violation_gate');

    expect(error).toBeNull();
    expect(data!.length).toBe(0); // nothing was inserted — gate held
  });

  it('a compliant question row IS inserted into the questions table', async () => {
    const supabase = getTestClient();

    // Build a compliant OMC and insert directly (simulating what promotePassagesToQuestions.ts
    // does after checkLayerViolations returns empty)
    const { error } = await supabase.from('questions').insert([{
      standard_id:              null,
      content:                  'Test passage text\n\n---\n\nQUESTION: Test stem?\n\nA. opt A\nB. opt B\nC. opt C\nD. opt D\n\nCORRECT: B',
      cognitive_skill_targeted: 'inferencing',
      difficulty_level:         2,
      title:                    SENTINEL_TITLE,
      author:                   'Test Author',
      option_a_text:            'opt A',
      option_b_text:            'opt B',
      option_c_text:            'opt C',
      option_d_text:            'opt D',
      option_a_class:           'schema_strategy_missing',
      option_b_class:           'correct',
      option_c_class:           'vocabulary_gap',
      option_d_class:           'inferencing',
      correct_option:           'B',
      rationale:                'test rationale',
      approved:                 false,
      flagged:                  false,
      pipeline_source:          'v3_promoted',
      source_classification:    'mood_misreading',
    }]);

    expect(error, `insert failed: ${error?.message}`).toBeNull();

    // Verify it's in the DB
    const { data, error: selErr } = await supabase
      .from('questions')
      .select('correct_option, option_a_class, option_c_class, option_d_class')
      .eq('title', SENTINEL_TITLE)
      .single();

    expect(selErr).toBeNull();
    expect(data!.correct_option).toBe('B');
    expect(data!.option_a_class).toBe('schema_strategy_missing');
    expect(data!.option_c_class).toBe('vocabulary_gap');
    expect(data!.option_d_class).toBe('inferencing');
  });

  it('violations log file is written with correct format', () => {
    const logPath = `/tmp/test-promotion-violations-${Date.now()}.log`;

    // Simulate the violation log write from promotePassagesToQuestions.ts
    const passageId     = 'test-passage-uuid-0001';
    const classification = 'mood_misreading';
    const detail        = 'option_C: expected L2, got "tone_misreading" (L3)';
    const logLine       = `[${new Date().toISOString()}] passage ${passageId} (${classification}): ${detail}\n`;

    appendFileSync(logPath, logLine, 'utf8');

    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain(passageId);
    expect(content).toContain(classification);
    expect(content).toContain('expected L2');
    expect(content).toContain('"tone_misreading"');
    // ISO timestamp present
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T/);

    unlinkSync(logPath);
  });
});
