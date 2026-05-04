import Anthropic from '@anthropic-ai/sdk';

export type ReleasedPassageExtraction = {
  passage_index: number;
  passage_title?: string | null;
  passage_type:
    | 'prose_fiction'
    | 'prose_nonfiction'
    | 'poetry'
    | 'drama'
    | 'informational_article'
    | 'paired_set';
  passage_text: string;
  passage_word_count?: number | null;
  paired_with_passage_index?: number | null;
  inferred_lexile?: number | null;
};

export type ReleasedItemOption = {
  letter: string;
  text: string;
};

export type ReleasedItemExtraction = {
  item_number: number;
  passage_index?: number | null;
  benchmark_code: string;
  reporting_category: 'RP' | 'RI' | 'RGV';
  item_type:
    | 'multiple_choice'
    | 'multi_select'
    | 'evidence_based_2_part'
    | 'table_completion'
    | 'hot_text'
    | 'drag_drop';
  prompt_text: string;
  options: ReleasedItemOption[];
  correct_answer: string;
  cognitive_complexity?: string | null;
  extraction_confidence: number;
};

export type ReleasedBookletExtraction = {
  metadata: {
    booklet_name?: string | null;
    grade?: number | null;
    subject?: string | null;
    release_year?: number | null;
    total_items_expected?: number | null;
  };
  passages: ReleasedPassageExtraction[];
  items: ReleasedItemExtraction[];
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Released item extractor did not return JSON.');
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function assertOption(option: unknown): asserts option is ReleasedItemOption {
  const value = option as Partial<ReleasedItemOption>;
  if (!value || typeof value !== 'object') {
    throw new Error('Released item extractor returned a malformed option.');
  }
  if (!value.letter || !value.text) {
    throw new Error('Released item extractor missed an option letter or text.');
  }
}

export function assertReleasedBookletExtraction(
  value: unknown
): asserts value is ReleasedBookletExtraction {
  const extraction = value as Partial<ReleasedBookletExtraction>;
  if (!extraction || typeof extraction !== 'object') {
    throw new Error('Released item extractor returned an empty result.');
  }
  if (!Array.isArray(extraction.passages) || extraction.passages.length < 1) {
    throw new Error('Released item extractor must return at least one passage.');
  }
  if (!Array.isArray(extraction.items) || extraction.items.length < 10) {
    throw new Error('Released item extractor must return at least ten items.');
  }

  const passageIndexes = new Set<number>();
  for (const passage of extraction.passages) {
    if (!Number.isInteger(passage.passage_index) || passage.passage_index < 1) {
      throw new Error('Released item extractor missed a passage index.');
    }
    if (!passage.passage_text?.trim()) {
      throw new Error('Released item extractor missed passage text.');
    }
    if (!passage.passage_type) {
      throw new Error('Released item extractor missed passage type.');
    }
    passageIndexes.add(passage.passage_index);
  }

  for (const item of extraction.items) {
    if (!Number.isInteger(item.item_number) || item.item_number < 1) {
      throw new Error('Released item extractor missed an item number.');
    }
    if (!item.prompt_text?.trim()) {
      throw new Error(`Released item extractor missed prompt text for item ${item.item_number}.`);
    }
    if (!item.benchmark_code?.trim()) {
      throw new Error(
        `Released item extractor missed benchmark code for item ${item.item_number}.`
      );
    }
    if (!['RP', 'RI', 'RGV'].includes(String(item.reporting_category))) {
      throw new Error(
        `Released item extractor missed reporting category for item ${item.item_number}.`
      );
    }
    if (!item.correct_answer?.trim()) {
      throw new Error(
        `Released item extractor missed correct answer for item ${item.item_number}.`
      );
    }
    if (!Array.isArray(item.options) || item.options.length < 2) {
      throw new Error(
        `Released item extractor returned too few options for item ${item.item_number}.`
      );
    }
    item.options.forEach(assertOption);
    if (
      typeof item.extraction_confidence !== 'number' ||
      item.extraction_confidence < 0 ||
      item.extraction_confidence > 1
    ) {
      throw new Error(`Released item extractor missed confidence for item ${item.item_number}.`);
    }
    if (item.passage_index && !passageIndexes.has(item.passage_index)) {
      throw new Error(`Released item ${item.item_number} references a missing passage.`);
    }
  }
}

export function normalizeReleasedExtraction(
  extraction: ReleasedBookletExtraction
): ReleasedBookletExtraction {
  return {
    metadata: extraction.metadata ?? {},
    passages: extraction.passages.map((passage) => ({
      ...passage,
      passage_title: passage.passage_title ?? null,
      passage_word_count: passage.passage_word_count ?? wordCount(passage.passage_text),
      paired_with_passage_index: passage.paired_with_passage_index ?? null,
      inferred_lexile: passage.inferred_lexile ?? null,
    })),
    items: extraction.items.map((item) => ({
      ...item,
      passage_index: item.passage_index ?? null,
      cognitive_complexity: item.cognitive_complexity ?? null,
      extraction_confidence: Math.round(Number(item.extraction_confidence) * 100) / 100,
      options: item.options.map((option) => ({
        letter: option.letter.trim().toUpperCase(),
        text: option.text.trim(),
      })),
    })),
  };
}

export async function extractReleasedFastBookletWithClaude(
  pdfBytes: ArrayBuffer
): Promise<ReleasedBookletExtraction> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64 = Buffer.from(pdfBytes).toString('base64');

  try {
    const response = await client.messages.create({
      model:
        process.env.ANTHROPIC_RELEASED_ITEMS_MODEL ??
        process.env.ANTHROPIC_FAST_MODEL ??
        process.env.ANTHROPIC_MODEL ??
        'claude-sonnet-4-6',
      max_tokens: 12000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract this Florida FAST ELA Reading released item booklet as strict JSON only.

Walk the booklet page by page. Items may span pages. Use the answer key/scoring guide when present to recover benchmark_code, reporting_category, and correct_answer. Do not invent values. If an item is too malformed to extract, omit that item rather than guessing.

Return exactly this shape:
{
  "metadata": {
    "booklet_name": "2025 Grade 9 FAST ELA Reading",
    "grade": 9,
    "subject": "ELA Reading",
    "release_year": 2025,
    "total_items_expected": 40
  },
  "passages": [
    {
      "passage_index": 1,
      "passage_title": "string or null",
      "passage_type": "prose_fiction|prose_nonfiction|poetry|drama|informational_article|paired_set",
      "passage_text": "full passage text",
      "passage_word_count": 420,
      "paired_with_passage_index": null,
      "inferred_lexile": null
    }
  ],
  "items": [
    {
      "item_number": 1,
      "passage_index": 1,
      "benchmark_code": "ELA.9.R.1.1",
      "reporting_category": "RP|RI|RGV",
      "item_type": "multiple_choice|multi_select|evidence_based_2_part|table_completion|hot_text|drag_drop",
      "prompt_text": "question stem",
      "options": [{"letter":"A","text":"answer choice text"}],
      "correct_answer": "B",
      "cognitive_complexity": "DOK 2 or null",
      "extraction_confidence": 0.95
    }
  ]
}

Normalize non-standard item types into the options array as clearly as possible. For multi-select, correct_answer may be comma-separated letters like "A,C,D". For two-part items, include both parts in prompt_text and represent answer options with clear labels. extraction_confidence is your confidence that the item, answer choices, correct answer, benchmark, and passage link are correct.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');
    const parsed = JSON.parse(extractJson(text)) as unknown;
    assertReleasedBookletExtraction(parsed);
    return normalizeReleasedExtraction(parsed);
  } catch (err) {
    const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : null;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 401 || /invalid x-api-key|authentication_error/i.test(message)) {
      throw new Error(
        'Claude could not extract this released FAST booklet because the Anthropic API key is invalid. Update ANTHROPIC_API_KEY in .env.local, then restart the dev server.'
      );
    }

    if (status === 404 || /model:|not_found_error/i.test(message)) {
      throw new Error(
        'Claude could not extract this released FAST booklet because the configured model is unavailable. Set ANTHROPIC_RELEASED_ITEMS_MODEL to a valid Anthropic document-capable model, or remove it to use the app default.'
      );
    }

    throw err;
  }
}

export function getReleasedExtractionErrorStatus(message: string) {
  if (/Anthropic API key is invalid|configured model is unavailable/i.test(message)) return 502;
  if (/Released item extractor|at least ten items|at least one passage/i.test(message)) return 400;
  return 500;
}
