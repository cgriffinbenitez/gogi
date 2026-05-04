export type ReleasedItemForClassification = {
  id: string;
  item_number: number;
  benchmark_code: string;
  reporting_category: 'RP' | 'RI' | 'RGV';
  item_type: string;
  prompt_text: string;
  correct_answer: string;
  extraction_confidence: number;
  passage_word_count?: number | null;
};

export type BenchmarkClassificationMapRow = {
  benchmark_code: string;
  classification_code: string;
  weight: number;
  rationale?: string | null;
};

export type ReleasedItemClassificationPlan = {
  classifications: Array<{
    released_item_id: string;
    classification_code: string;
    weight: number;
    confidence: number;
    distractor_analysis: Record<string, unknown>;
    rationale: string;
    assigned_by: 'automated';
  }>;
  tier: {
    id: string;
    tier: 'T1' | 'T2' | 'T3' | 'T4';
    tier_rationale: string;
    passage_word_count: number;
    tagger_assigned_tier: 'T1' | 'T2' | 'T3' | 'T4';
    wordcount_assigned_tier: 'T1' | 'T2' | 'T3' | 'T4';
    tier_override_applied: boolean;
  };
  roles: Array<{
    released_item_id: string;
    role: 'practice' | 'transfer' | 'scaffold';
    priority: number;
  }>;
  reviewQueue: {
    released_item_id: string;
    status: 'pending';
    automated_classification_summary: Record<string, unknown>;
  };
};

function clampScore(value: number) {
  return Math.max(0.01, Math.min(0.99, Math.round(value * 100) / 100));
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function wordcountTier(wordCountValue: number): 'T1' | 'T2' | 'T3' | 'T4' {
  if (wordCountValue >= 900) return 'T4';
  if (wordCountValue >= 650) return 'T3';
  if (wordCountValue >= 350) return 'T2';
  return 'T1';
}

function taggerTier(item: ReleasedItemForClassification): 'T1' | 'T2' | 'T3' | 'T4' {
  const promptWords = wordCount(item.prompt_text);
  if (item.item_type === 'table_completion') return 'T4';
  if (item.item_type === 'evidence_based_2_part') return 'T3';
  if (item.item_type === 'multi_select') return 'T3';
  if (/select two|compare|contrast|develop|support/i.test(item.prompt_text)) return 'T3';
  if (promptWords >= 85) return 'T3';
  return 'T2';
}

function maxTier(...tiers: Array<'T1' | 'T2' | 'T3' | 'T4'>): 'T1' | 'T2' | 'T3' | 'T4' {
  const order = ['T1', 'T2', 'T3', 'T4'] as const;
  return tiers.reduce((highest, tier) =>
    order.indexOf(tier) > order.indexOf(highest) ? tier : highest
  );
}

function fallbackClassification(
  item: ReleasedItemForClassification
): BenchmarkClassificationMapRow[] {
  if (item.reporting_category === 'RP') {
    return [
      {
        benchmark_code: item.benchmark_code,
        classification_code: 'inferencing_literal',
        weight: 0.45,
        rationale: 'Released prose/poetry items often depend on inference from textual details.',
      },
      {
        benchmark_code: item.benchmark_code,
        classification_code: 'evidence_retrieval_failure',
        weight: 0.3,
        rationale: 'Students must locate and use evidence from the passage.',
      },
    ];
  }

  if (item.reporting_category === 'RGV') {
    return [
      {
        benchmark_code: item.benchmark_code,
        classification_code: 'vocabulary_gap',
        weight: 0.45,
        rationale:
          'Released cross-genre/vocabulary items often depend on word meaning or language effects.',
      },
      {
        benchmark_code: item.benchmark_code,
        classification_code: 'figurative_language_failure',
        weight: 0.25,
        rationale: 'Language-effect questions can expose figurative or connotative reading gaps.',
      },
    ];
  }

  return [
    {
      benchmark_code: item.benchmark_code,
      classification_code: 'structure_purpose_disconnect',
      weight: 0.45,
      rationale:
        'Released informational items often depend on structure, purpose, or central-idea development.',
    },
    {
      benchmark_code: item.benchmark_code,
      classification_code: 'evidence_retrieval_failure',
      weight: 0.35,
      rationale: 'Informational items often require finding and integrating support.',
    },
  ];
}

export function buildReleasedItemClassificationPlan(
  item: ReleasedItemForClassification,
  benchmarkMap: BenchmarkClassificationMapRow[]
): ReleasedItemClassificationPlan {
  const mappedRows = benchmarkMap.filter((row) => row.benchmark_code === item.benchmark_code);
  const rows = mappedRows.length ? mappedRows : fallbackClassification(item);
  const classificationConfidence = clampScore(
    0.58 + Number(item.extraction_confidence ?? 0) * 0.34
  );
  const passageWordCount = Number(item.passage_word_count ?? 0);
  const taggerAssignedTier = taggerTier(item);
  const wordcountAssignedTier = wordcountTier(passageWordCount);
  const tier = maxTier(taggerAssignedTier, wordcountAssignedTier);
  const tierOverrideApplied = tier !== taggerAssignedTier;
  const primary = rows[0];

  return {
    classifications: rows.slice(0, 3).map((row) => ({
      released_item_id: item.id,
      classification_code: row.classification_code,
      weight: clampScore(Number(row.weight)),
      confidence: classificationConfidence,
      distractor_analysis: {
        correct_answer: item.correct_answer,
        item_type: item.item_type,
        benchmark_code: item.benchmark_code,
        signal_source: mappedRows.length ? 'benchmark_map' : 'reporting_category_fallback',
      },
      rationale:
        row.rationale ??
        `Mapped ${item.benchmark_code} to ${row.classification_code} from released FAST item metadata.`,
      assigned_by: 'automated',
    })),
    tier: {
      id: item.id,
      tier,
      tier_rationale: `Tier ${tier} from item type (${item.item_type}), prompt demand, and passage length.`,
      passage_word_count: passageWordCount,
      tagger_assigned_tier: taggerAssignedTier,
      wordcount_assigned_tier: wordcountAssignedTier,
      tier_override_applied: tierOverrideApplied,
    },
    roles: [
      { released_item_id: item.id, role: 'practice', priority: 1 },
      ...(tier === 'T3' || tier === 'T4'
        ? [{ released_item_id: item.id, role: 'transfer' as const, priority: 2 }]
        : []),
      ...(item.item_type !== 'multiple_choice'
        ? [{ released_item_id: item.id, role: 'scaffold' as const, priority: 3 }]
        : []),
    ],
    reviewQueue: {
      released_item_id: item.id,
      status: 'pending',
      automated_classification_summary: {
        item_number: item.item_number,
        benchmark_code: item.benchmark_code,
        reporting_category: item.reporting_category,
        correct_answer: item.correct_answer,
        primary_classification: primary.classification_code,
        classification_confidence: classificationConfidence,
        tier,
        item_type: item.item_type,
        source: mappedRows.length ? 'benchmark_map' : 'reporting_category_fallback',
      },
    },
  };
}
