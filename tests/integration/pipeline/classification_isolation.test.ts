// MUST be first — sets NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to local
// instance before any DB calls are made.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.test'), override: true });

import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';
import { writePassageV3 } from '../../../src/pipeline/stages/write';
import type { PassageRowV3, CriteriaConfig, SourceConfig } from '../../../src/pipeline/types';

// ─── Sentinels ────────────────────────────────────────────────────────────────

const SENTINEL_SOURCE   = 'test__classification_isolation';
const FAKE_GUTENBERG_ID = 99995;

function getTestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function testHash(label: string): string {
  return 'test__' + crypto.createHash('sha256').update(label).digest('hex').slice(0, 16);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCriteria(classification: string): CriteriaConfig {
  const raw = readFileSync(
    resolve(process.cwd(), `src/pipeline/criteria/${classification}.json`),
    'utf-8',
  );
  return JSON.parse(raw) as CriteriaConfig;
}

function readSources(classification: string): SourceConfig {
  const raw = readFileSync(
    resolve(process.cwd(), `src/pipeline/sources/${classification}.json`),
    'utf-8',
  );
  return JSON.parse(raw) as SourceConfig;
}

const ALL_CLASSIFICATIONS = [
  'inferencing', 'evidence_retrieval_failure', 'tone_misreading',
  'mood_misreading', 'figurative_language_failure', 'comprehension_integration_failure',
  'topic_vs_theme_confusion', 'structure_purpose_disconnect',
  'vocabulary_gap', 'morphology_gap', 'syntax_barrier',
  'schema_strategy_missing', 'no_metacognitive_strategy',
];

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  const supabase = getTestClient();
  await supabase
    .from('intervention_passages')
    .delete()
    .eq('source_title', SENTINEL_SOURCE);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('classification_isolation — criteria JSON files are self-consistent', () => {

  it('every criteria JSON declares a classification field matching its filename', () => {
    // If any file declares the wrong classification, the pipeline would write rows
    // with one classification label but use a different classification's filter rules.
    for (const cls of ALL_CLASSIFICATIONS) {
      const criteria = readCriteria(cls);
      expect(
        criteria.classification,
        `${cls}.json has wrong classification field: "${criteria.classification}"`,
      ).toBe(cls);
    }
  });

  it('mood_misreading criteria has required structural fields', () => {
    const criteria = readCriteria('mood_misreading');
    expect(criteria.classification).toBe('mood_misreading');
    expect(Array.isArray(criteria.mustHave)).toBe(true);
    expect(criteria.mustHave.length).toBeGreaterThan(0);
    expect(Array.isArray(criteria.mustNotHave)).toBe(true);
    expect(criteria.mustNotHave.length).toBeGreaterThan(0);
    expect(criteria.tierSignals).toBeDefined();
    expect(typeof criteria.tierSignals.tier1).toBe('string');
    expect(typeof criteria.tierSignals.tier2).toBe('string');
    expect(typeof criteria.tierSignals.tier3).toBe('string');
  });

  it('no two criteria files have the same classification value — no aliasing', () => {
    const seen = new Map<string, string>();
    for (const cls of ALL_CLASSIFICATIONS) {
      const { classification } = readCriteria(cls);
      if (seen.has(classification)) {
        throw new Error(
          `Duplicate classification "${classification}" in both ${seen.get(classification)} and ${cls}.json`,
        );
      }
      seen.set(classification, cls);
    }
    expect(seen.size).toBe(ALL_CLASSIFICATIONS.length);
  });
});

describe('classification_isolation — sources JSON files match classification', () => {

  it('mood_misreading sources has gutendexSearchTerms and priorityAuthors arrays', () => {
    const sources = readSources('mood_misreading');
    expect(Array.isArray(sources.gutendexSearchTerms)).toBe(true);
    expect(sources.gutendexSearchTerms.length).toBeGreaterThan(0);
    expect(Array.isArray(sources.priorityAuthors)).toBe(true);
    expect(sources.priorityAuthors.length).toBeGreaterThan(0);
  });

  it('each sources JSON file is valid JSON and parses without error', () => {
    for (const cls of ALL_CLASSIFICATIONS) {
      expect(() => readSources(cls), `${cls} sources failed to parse`).not.toThrow();
      const src = readSources(cls);
      expect(src.priorityAuthors, `${cls} sources missing priorityAuthors`).toBeDefined();
    }
  });

  it('mood_misreading sources does not contain authors from other classifications — no list aliasing', () => {
    // Sanity check: the file is specifically mood_misreading curated, not a copy of another
    const moodSources = readSources('mood_misreading');
    const toneSources = readSources('tone_misreading');
    // The two lists should differ at least somewhat — they curate for different goals
    // (mood requires atmospheric prose; tone requires register-aware prose).
    // Full identity would indicate a copy-paste error.
    const moodSet = new Set(moodSources.priorityAuthors);
    const toneSet = new Set(toneSources.priorityAuthors);
    const intersection = [...moodSet].filter(a => toneSet.has(a));
    // Some authors appear in both (e.g. Chekhov) — that's fine.
    // What's not fine: exact same list (100% overlap in both directions).
    const pctMoodInTone = intersection.length / moodSources.priorityAuthors.length;
    const pctToneInMood = intersection.length / toneSources.priorityAuthors.length;
    expect(pctMoodInTone).toBeLessThan(1.0);  // not 100% of mood list in tone list
    expect(pctToneInMood).toBeLessThan(1.0);  // not 100% of tone list in mood list
  });
});

describe('classification_isolation — DB rows stay in declared classification', () => {

  // Insert three mood_misreading rows with distinct hashes before the read-back tests.
  it('inserts three mood_misreading rows via writePassageV3', async () => {
    const base: Omit<PassageRowV3, 'paragraph_hash' | 'word_count' | 'intervention_tier'> = {
      classification:           'mood_misreading',
      paragraph_text:           'The fog settled over the marsh like a mourning veil.',
      paragraph_count:          1,
      source:                   'test',
      source_title:             SENTINEL_SOURCE,
      source_author:            'Test Author',
      source_year:              null,
      source_gutenberg_id:      FAKE_GUTENBERG_ID,
      approved:                 false,
      pipeline_version:         'v4',
      target_signal:            'test signal',
      item_patterns_supported:  [],
      supporting_evidence:      [],
      non_supporting_evidence:  [],
      dominant_concept:         null,
      plausible_distractors:    null,
      craft_features:           null,
      discrimination_item_type: 'sentence_level',
      tagger_tier:              2,
      word_count_tier:          2,
      tier_rationale:           'test',
      q5_flag_5e_compatible:    false,
      approval_status:          'pending_review',
    };

    for (let i = 1; i <= 3; i++) {
      const row: PassageRowV3 = {
        ...base,
        paragraph_hash:   testHash(`mood_iso_row_${i}`),
        word_count:       200 + i * 10,   // 210, 220, 230 — all T2
        intervention_tier: 2,
      };
      const result = await writePassageV3(row);
      expect(result.status, `row ${i} insert failed: ${result.error}`).toBe('inserted');
    }
  });

  it('100% of sentinel rows have classification=mood_misreading — zero cross-contamination', async () => {
    const supabase = getTestClient();
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('classification')
      .eq('source_title', SENTINEL_SOURCE)
      .eq('source_gutenberg_id', FAKE_GUTENBERG_ID);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    for (const row of data!) {
      expect(
        row.classification,
        `expected mood_misreading but got "${row.classification}"`,
      ).toBe('mood_misreading');
    }
  });

  it('classification field is not null for any sentinel row', async () => {
    const supabase = getTestClient();
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('classification')
      .eq('source_title', SENTINEL_SOURCE)
      .is('classification', null);

    expect(error).toBeNull();
    expect(data!.length).toBe(0); // no null classifications
  });

  it('tone_misreading row is invisible to a mood_misreading classification filter', async () => {
    // Insert one row labeled tone_misreading under the same sentinel book
    const supabase = getTestClient();
    await supabase.from('intervention_passages').insert([{
      classification:           'tone_misreading',
      paragraph_text:           'The tone test passage.',
      word_count:               200,
      paragraph_count:          1,
      source:                   'test',
      source_title:             SENTINEL_SOURCE,
      source_author:            'Test Author',
      source_year:              null,
      source_gutenberg_id:      FAKE_GUTENBERG_ID,
      approved:                 false,
      paragraph_hash:           testHash('tone_isolation_probe'),
      pipeline_version:         'v4',
      target_signal:            'probe',
      item_patterns_supported:  [],
      supporting_evidence:      [],
      non_supporting_evidence:  [],
      dominant_concept:         null,
      plausible_distractors:    null,
      craft_features:           null,
      discrimination_item_type: 'sentence_level',
      intervention_tier:        2,
      tagger_tier:              2,
      word_count_tier:          2,
      tier_rationale:           'test',
      q5_flag_5e_compatible:    false,
      approval_status:          'pending_review',
    }]);

    // Now query filtering by mood_misreading — the tone row must NOT appear
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('classification')
      .eq('source_title', SENTINEL_SOURCE)
      .eq('classification', 'mood_misreading');

    expect(error).toBeNull();
    for (const row of data!) {
      expect(row.classification).toBe('mood_misreading');
    }

    // And the tone row IS there when queried directly
    const { data: toneData } = await supabase
      .from('intervention_passages')
      .select('classification')
      .eq('source_title', SENTINEL_SOURCE)
      .eq('classification', 'tone_misreading');

    expect(toneData!.length).toBe(1);
    expect(toneData![0].classification).toBe('tone_misreading');
  });

  it('classification NOT NULL constraint rejects a null insert at DB level', async () => {
    const supabase = getTestClient();
    const { error } = await supabase.from('intervention_passages').insert([{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      classification:           null as any,   // deliberately violate NOT NULL
      paragraph_text:           'Should not land.',
      word_count:               200,
      paragraph_count:          1,
      source:                   'test',
      source_title:             SENTINEL_SOURCE,
      source_author:            'Test Author',
      source_year:              null,
      source_gutenberg_id:      FAKE_GUTENBERG_ID,
      approved:                 false,
      paragraph_hash:           testHash('null_classification_probe'),
      pipeline_version:         'v4',
      target_signal:            'probe',
      item_patterns_supported:  [],
      supporting_evidence:      [],
      non_supporting_evidence:  [],
      dominant_concept:         null,
      plausible_distractors:    null,
      craft_features:           null,
      discrimination_item_type: 'sentence_level',
      intervention_tier:        2,
      tagger_tier:              null,
      word_count_tier:          2,
      tier_rationale:           'test',
      q5_flag_5e_compatible:    false,
      approval_status:          'pending_review',
    }]);

    // DB must reject this — classification is NOT NULL in the schema
    expect(error, 'expected NOT NULL violation but insert succeeded').not.toBeNull();
  });
});
