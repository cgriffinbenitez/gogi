import { describe, expect, it } from 'vitest';
import {
  assertReleasedBookletExtraction,
  normalizeReleasedExtraction,
  type ReleasedBookletExtraction,
} from '../../src/lib/released-items/extraction';
import { buildReleasedItemClassificationPlan } from '../../src/lib/released-items/classification';
import { extractReleasedBookletFromText } from '../../src/lib/released-items/localExtraction';
import {
  buildReleasedQuestionInsert,
  formatReleasedQuestionContent,
} from '../../src/lib/released-items/promotion';
import {
  buildOriginalFastAlignedDraft,
  buildOriginalFastAlignedDraftSet,
  evaluateOriginalItemQuality,
} from '../../src/lib/original-items/engine';
import { buildOriginalQuestionInsert } from '../../src/lib/original-items/promotion';

function validExtraction(overrides: Partial<ReleasedBookletExtraction> = {}) {
  const extraction: ReleasedBookletExtraction = {
    metadata: {
      booklet_name: '2025 Grade 9 FAST ELA Reading',
      grade: 9,
      subject: 'ELA Reading',
      release_year: 2025,
      total_items_expected: 10,
    },
    passages: [
      {
        passage_index: 1,
        passage_title: 'A Passage',
        passage_type: 'prose_fiction',
        passage_text: 'This is a short passage used for extraction validation.',
        passage_word_count: 9,
      },
    ],
    items: Array.from({ length: 10 }).map((_, index) => ({
      item_number: index + 1,
      passage_index: 1,
      benchmark_code: 'ELA.9.R.1.1',
      reporting_category: 'RP',
      item_type: 'multiple_choice',
      prompt_text: `Question ${index + 1}?`,
      options: [
        { letter: 'A', text: 'Choice A' },
        { letter: 'B', text: 'Choice B' },
      ],
      correct_answer: 'B',
      cognitive_complexity: null,
      extraction_confidence: 0.92,
    })),
  };

  return { ...extraction, ...overrides };
}

describe('released FAST booklet extraction validation', () => {
  it('accepts a complete extraction', () => {
    expect(() => assertReleasedBookletExtraction(validExtraction())).not.toThrow();
  });

  it('rejects incomplete booklet extraction before persistence', () => {
    expect(() =>
      assertReleasedBookletExtraction(
        validExtraction({
          items: validExtraction().items.slice(0, 4),
        })
      )
    ).toThrow('at least ten items');

    expect(() =>
      assertReleasedBookletExtraction(
        validExtraction({
          passages: [],
        })
      )
    ).toThrow('at least one passage');
  });

  it('normalizes passage word counts and option letters', () => {
    const normalized = normalizeReleasedExtraction(
      validExtraction({
        passages: [
          {
            passage_index: 1,
            passage_title: null,
            passage_type: 'prose_fiction',
            passage_text: 'One two three four.',
          },
        ],
        items: [
          {
            ...validExtraction().items[0],
            options: [
              { letter: ' a ', text: ' First ' },
              { letter: ' b ', text: ' Second ' },
            ],
          },
          ...validExtraction().items.slice(1),
        ],
      })
    );

    expect(normalized.passages[0].passage_word_count).toBe(4);
    expect(normalized.items[0].options[0]).toEqual({ letter: 'A', text: 'First' });
  });
});

describe('released FAST item classification plan', () => {
  it('maps benchmark evidence to cognitive primitives, tiers, roles, and review queue rows', () => {
    const plan = buildReleasedItemClassificationPlan(
      {
        id: 'released-item-1',
        item_number: 17,
        benchmark_code: 'ELA.9.R.2.4',
        reporting_category: 'RI',
        item_type: 'table_completion',
        prompt_text: 'Complete the table to compare how two passages develop an argument.',
        correct_answer: 'C,E,G',
        extraction_confidence: 0.62,
        passage_word_count: 720,
      },
      [
        {
          benchmark_code: 'ELA.9.R.2.4',
          classification_code: 'comprehension_integration_failure',
          weight: 0.5,
          rationale: 'Arguments require connecting claims, reasons, and evidence.',
        },
        {
          benchmark_code: 'ELA.9.R.2.4',
          classification_code: 'evidence_retrieval_failure',
          weight: 0.3,
          rationale: 'Argument analysis requires finding support.',
        },
      ]
    );

    expect(plan.classifications).toHaveLength(2);
    expect(plan.classifications[0]).toMatchObject({
      released_item_id: 'released-item-1',
      classification_code: 'comprehension_integration_failure',
      weight: 0.5,
      assigned_by: 'automated',
    });
    expect(plan.tier).toMatchObject({
      id: 'released-item-1',
      tier: 'T4',
      tagger_assigned_tier: 'T4',
      wordcount_assigned_tier: 'T3',
    });
    expect(plan.roles.map((role) => role.role)).toEqual(['practice', 'transfer', 'scaffold']);
    expect(plan.reviewQueue.automated_classification_summary).toMatchObject({
      item_number: 17,
      benchmark_code: 'ELA.9.R.2.4',
      primary_classification: 'comprehension_integration_failure',
      tier: 'T4',
    });
  });
});

describe('released FAST promotion payload', () => {
  it('preserves released item provenance when building a question-bank row', () => {
    const item = {
      id: 'released-item-1',
      item_number: 1,
      benchmark_code: 'ELA.9.R.1.1',
      item_type: 'multiple_choice',
      prompt_text: 'How does the detail develop the passage?',
      options: [
        { letter: 'A', text: 'Correct detail.' },
        { letter: 'B', text: 'Distractor.' },
        { letter: 'C', text: 'Distractor.' },
        { letter: 'D', text: 'Distractor.' },
      ],
      correct_answer: 'A',
      released_passages: {
        passage_title: 'A White Heron',
        passage_text: 'A short passage excerpt.',
      },
    };

    expect(formatReleasedQuestionContent(item)).toContain('SOURCE:');

    const insert = buildReleasedQuestionInsert(item, {
      standardId: 'standard-1',
      primaryClassification: 'inferencing_literal',
      difficultyLevel: 2,
    });

    expect(insert).toMatchObject({
      standard_id: 'standard-1',
      source: 'released_fast',
      is_released_item: true,
      released_item_id: 'released-item-1',
      pipeline_source: 'v3_promoted',
      source_classification: 'inferencing_literal',
      approved: true,
    });
  });
});

describe('GOGI original FAST-aligned item engine', () => {
  it('builds original benchmark-aligned drafts with remediation metadata', () => {
    const draft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.R.2.2',
      passageType: 'informational',
      topic: 'coastal flooding preparation plan',
    });

    expect(draft).toMatchObject({
      benchmark_code: 'ELA.9.R.2.2',
      reporting_category: 'RI',
      correct_answer: 'A',
    });
    expect(draft.passage_word_count).toBeGreaterThan(90);
    expect(draft.passage_title.toLowerCase()).not.toContain('scenario');
    expect(draft.correct_rationale).toContain('A is correct');
    expect(draft.remediation_hint.length).toBeGreaterThan(20);
    expect(draft.reassessment_plan.length).toBeGreaterThan(20);
  });

  it('builds capped original draft sets for one benchmark', () => {
    const drafts = buildOriginalFastAlignedDraftSet({
      benchmarkCode: 'ELA.9.R.2.2',
      passageType: 'informational',
      topic: 'community project',
      count: 50,
    });

    expect(drafts).toHaveLength(25);
    expect(new Set(drafts.map((draft) => draft.passage_title)).size).toBeGreaterThan(1);
    expect(drafts.every((draft) => !draft.passage_title.toLowerCase().includes('scenario'))).toBe(
      true
    );
    expect(new Set(drafts.map((draft) => draft.prompt_text)).size).toBeGreaterThan(1);
    expect(new Set(drafts.map((draft) => draft.correct_answer)).size).toBeGreaterThan(1);
    expect(drafts[0].options).not.toEqual(drafts[1].options);
    expect(drafts.every((draft) => draft.benchmark_code === 'ELA.9.R.2.2')).toBe(true);
  });

  it('scores original drafts against the FAST blueprint quality gate', () => {
    const draft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.R.2.2',
      passageType: 'informational',
      topic: 'coastal flooding preparation plan',
    });

    const quality = evaluateOriginalItemQuality(draft);

    expect(quality.decision).toBe('pass');
    expect(quality.status).toBe('strong_signal');
    expect(quality.score).toBeGreaterThanOrEqual(85);
    expect(quality.pattern).toMatchObject({
      id: 'r222-central-idea-support',
      name: 'Central Idea Evidence Match',
    });
    expect(quality.checks.map((check) => check.key)).toEqual([
      'benchmark',
      'pattern',
      'passage_type',
      'word_count',
      'passage_authenticity',
      'answer_key',
      'distractors',
      'evidence',
      'student_facing',
      'instructional_loop',
    ]);
  });

  it('generates passage-specific answer choices instead of blueprint notes', () => {
    const draft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.R.3.1',
      passageType: 'literary',
      topic: 'student-led neighborhood project',
    });

    expect(draft.prompt_text).toContain('“the wind moved through the reeds');
    expect(draft.passage_title).toBe('The Ferry Dock');
    expect(draft.options.map((option) => option.text).join(' ')).not.toMatch(
      /It connect|It state|It identify|It separate|It compare/i
    );
    expect(draft.options.map((option) => option.text).join(' ')).toContain('wind');

    const quality = evaluateOriginalItemQuality(draft);
    expect(quality.decision).toBe('pass');
  });

  it('rejects generic AI-textured literary passages before student use', () => {
    const draft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.R.3.1',
      passageType: 'literary',
      topic: 'student-led neighborhood project',
    });

    const quality = evaluateOriginalItemQuality({
      ...draft,
      passage_title: 'Student-Led Neighborhood Project Scenario 1',
      passage_text: `Mara arrived before anyone else, mostly because arriving early gave her fewer chances to be seen hesitating at the door. On the whiteboard, someone had written student-led neighborhood project in block letters and underlined it twice, as if confidence could be drawn into existence.\n\nFor three weeks, Mara had carried the project in a blue folder. She had lists, maps, survey notes, and one photograph connected to the community project. Then she posted a handwritten progress chart so people could see what still needed work.`,
      passage_word_count: 84,
    });

    expect(quality.checks.find((check) => check.key === 'passage_authenticity')?.passed).toBe(
      false
    );
    expect(quality.decision).toBe('reject');
  });

  it('rejects generic blueprint answer choices', () => {
    const draft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.R.3.1',
      passageType: 'literary',
      topic: 'student-led neighborhood project',
    });

    const quality = evaluateOriginalItemQuality({
      ...draft,
      options: [
        {
          letter: 'A',
          text: 'It connect image or phrase to mood, tone, meaning, or reader understanding.',
        },
        { letter: 'B', text: 'It defines the phrase literally.' },
        { letter: 'C', text: 'It names a mood without connecting it to the image.' },
        { letter: 'D', text: 'It chooses an effect that is true in general.' },
      ],
    });

    expect(quality.checks.find((check) => check.key === 'student_facing')?.passed).toBe(false);
    expect(quality.decision).not.toBe('pass');
  });

  it('builds vocabulary items with a target word, context sentence, and meaning choices', () => {
    const morphologyDraft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.V.1.2',
      passageType: 'informational',
      topic: 'community project',
    });
    const contextDraft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.V.1.3',
      passageType: 'informational',
      topic: 'community project',
    });

    expect(morphologyDraft.prompt_text).toContain('Read this sentence:');
    expect(morphologyDraft.prompt_text).toContain('reconstruct');
    expect(morphologyDraft.options.map((option) => option.text)).toContain(
      'build again in a better form'
    );
    expect(morphologyDraft.options.every((option) => !option.text.startsWith('It '))).toBe(true);
    const morphologyQuality = evaluateOriginalItemQuality(morphologyDraft);
    expect(morphologyQuality.decision).toBe('pass');
    expect(morphologyQuality.checks.map((check) => check.key)).toContain('vocab_context');

    expect(contextDraft.prompt_text).toContain('durable');
    expect(contextDraft.options.map((option) => option.text)).toContain('able to last');
    expect(contextDraft.correct_rationale).toContain('lasting only a week');
  });

  it('promotes original drafts with source provenance separate from released FAST', () => {
    const draft = buildOriginalFastAlignedDraft({
      benchmarkCode: 'ELA.9.R.1.1',
      passageType: 'literary',
      topic: 'a mural restoration',
    });

    const insert = buildOriginalQuestionInsert(
      {
        id: 'draft-1',
        benchmark_code: draft.benchmark_code,
        passage_title: draft.passage_title,
        passage_text: draft.passage_text,
        prompt_text: draft.prompt_text,
        options: draft.options,
        correct_answer: draft.correct_answer,
        correct_rationale: draft.correct_rationale,
        remediation_hint: draft.remediation_hint,
        difficulty_estimate: draft.difficulty_estimate,
      },
      { standardId: 'standard-1' }
    );

    expect(insert).toMatchObject({
      source: 'gogi_original_fast_aligned',
      is_released_item: false,
      approved: true,
      source_classification: 'ELA.9.R.1.1',
    });
    expect(insert.content).toContain('GOGI original FAST-aligned item');
  });
});

describe('local released FAST PDF extraction fallback', () => {
  const metadata = {
    booklet_name: '2025 Grade 9 FAST ELA Reading Sample',
    grade: 9,
    subject: 'ELA Reading',
    release_year: 2025,
    total_items_expected: 10,
  };

  function localText(answerRows: string[]) {
    const questions = Array.from({ length: 10 })
      .map((_, index) => {
        const itemNumber = index + 1;
        return [
          `${itemNumber}. Which sentence best supports the central idea in paragraph ${itemNumber}?`,
          'A. The first possible response.',
          'B. The second possible response.',
          'C. The third possible response.',
          'D. The fourth possible response.',
        ].join('\n');
      })
      .join('\n\n');

    return [
      '[Page 1]',
      'Released FAST ELA Reading Passage',
      'Students read this passage and answer questions about meaning, structure, and vocabulary.',
      questions,
      'Answer Key',
      ...answerRows,
    ].join('\n');
  }

  it('parses items, options, benchmarks, and answer keys without Claude output', () => {
    const answerRows = Array.from({ length: 10 }).map((_, index) => {
      const itemNumber = index + 1;
      return `${itemNumber} B ELA.9.R.1.1 RP`;
    });

    const extraction = extractReleasedBookletFromText(localText(answerRows), metadata);

    expect(extraction.passages).toHaveLength(1);
    expect(extraction.items).toHaveLength(10);
    expect(extraction.items[0]).toMatchObject({
      item_number: 1,
      benchmark_code: 'ELA.9.R.1.1',
      reporting_category: 'RP',
      correct_answer: 'B',
      item_type: 'multiple_choice',
    });
    expect(extraction.items[0].options).toHaveLength(4);
  });

  it('keeps item shells when answer key benchmark evidence is missing', () => {
    const answerRows = Array.from({ length: 10 }).map((_, index) => `${index + 1} B RP`);

    const extraction = extractReleasedBookletFromText(localText(answerRows), metadata);

    expect(extraction.items).toHaveLength(10);
    expect(extraction.items[0]).toMatchObject({
      benchmark_code: 'UNMAPPED',
      reporting_category: 'RP',
      correct_answer: 'B',
      extraction_confidence: 0.36,
    });
  });

  it('parses released booklet item text when answer choices do not use periods', () => {
    const questions = Array.from({ length: 10 })
      .map((_, index) => {
        const itemNumber = index + 1;
        return [
          `${itemNumber}. How does paragraph ${itemNumber} develop the passage?`,
          'A It introduces the central conflict.',
          'B It explains the setting.',
          'C It contrasts two viewpoints.',
          'D It summarizes the resolution.',
          `${10000 + itemNumber}`,
        ].join('\n');
      })
      .join('\n\n');

    const extraction = extractReleasedBookletFromText(
      [
        '[Page 1]',
        'This introduction mentions that each released test will include an answer key later.',
        'A White Heron',
        'This is the passage text before the questions.',
        questions,
      ].join('\n'),
      metadata
    );

    expect(extraction.items).toHaveLength(10);
    expect(extraction.items[0].options[0]).toEqual({
      letter: 'A',
      text: 'It introduces the central conflict.',
    });
    expect(extraction.items[0].correct_answer).toBe('UNKEYED');
  });

  it('pairs interleaved support-document answer keys with the current item', () => {
    const questions = Array.from({ length: 10 })
      .map((_, index) => {
        const itemNumber = index + 1;
        const answer = itemNumber === 8 ? 'A and B' : 'C';
        const benchmark = itemNumber === 8 ? 'ELA.9.R.1.2' : 'ELA.9.R.2.1';
        const category =
          itemNumber === 8 ? 'Reading Prose and Poetry' : 'Reading Informational Text';

        return [
          `${itemNumber}. This question has a support document answer key after it.`,
          'A First choice',
          'B Second choice',
          'C Third choice',
          'D Fourth choice',
          `${11000 + itemNumber}`,
          `Answer Key: ${answer}`,
          'Percentage of Students Answering Correctly: 44%',
          `Reporting Category: ${category}`,
          `Benchmark: ${benchmark}`,
          'Benchmark Description: A released item benchmark description.',
        ].join('\n');
      })
      .join('\n\n');

    const extraction = extractReleasedBookletFromText(
      ['[Page 1]', 'Released support document', questions].join('\n'),
      metadata
    );

    expect(extraction.items).toHaveLength(10);
    expect(extraction.items[0]).toMatchObject({
      correct_answer: 'C',
      benchmark_code: 'ELA.9.R.2.1',
      reporting_category: 'RI',
      extraction_confidence: 0.62,
    });
    expect(extraction.items[7]).toMatchObject({
      correct_answer: 'A,B',
      benchmark_code: 'ELA.9.R.1.2',
      reporting_category: 'RP',
      extraction_confidence: 0.62,
    });
  });

  it('preserves separate passage groups so remediation can use the source text', () => {
    const longPassageOne = Array.from({ length: 30 })
      .map(() => 'Passage one sentence with enough source text for remediation evidence.')
      .join(' ');
    const longPassageTwo = Array.from({ length: 30 })
      .map(() => 'Passage two sentence with enough different source text for targeted practice.')
      .join(' ');
    const items = Array.from({ length: 10 })
      .map((_, index) => {
        const itemNumber = index + 1;
        return [
          itemNumber === 6 ? `[Page 6]\nSecond Passage\nby Test Author\n${longPassageTwo}` : null,
          `${itemNumber}. Which detail supports the idea in passage ${itemNumber <= 5 ? 'one' : 'two'}?`,
          'A First choice',
          'B Second choice',
          'C Third choice',
          'D Fourth choice',
          `${12000 + itemNumber}`,
          'Answer Key: A',
          'Reporting Category: Reading Informational Text',
          'Benchmark: ELA.9.R.2.2',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    const extraction = extractReleasedBookletFromText(
      ['[Page 1]', 'First Passage', 'by Test Author', longPassageOne, items].join('\n'),
      metadata
    );

    expect(extraction.passages).toHaveLength(2);
    expect(extraction.items[0].passage_index).toBe(1);
    expect(extraction.items[5].passage_index).toBe(2);
    expect(extraction.passages[1].passage_text).toContain('Passage two sentence');
  });
});
