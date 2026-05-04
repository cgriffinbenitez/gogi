type ReleasedOption = {
  letter: string;
  text: string;
};

export type ReleasedItemForPromotion = {
  id: string;
  item_number: number;
  benchmark_code: string;
  item_type: string;
  prompt_text: string;
  options: ReleasedOption[];
  correct_answer: string;
  cognitive_complexity?: string | null;
  released_passages?: {
    passage_title?: string | null;
    passage_text?: string | null;
  } | null;
};

export function formatReleasedQuestionContent(item: ReleasedItemForPromotion) {
  const passage = item.released_passages?.passage_text?.trim();
  const options = item.options
    .map((option) => `${option.letter.trim().toUpperCase()}. ${option.text.trim()}`)
    .join('\n');

  return [
    passage ? `PASSAGE:\n${passage}` : null,
    `QUESTION:\n${item.prompt_text.trim()}`,
    options ? `OPTIONS:\n${options}` : null,
    `ANSWER:\n${item.correct_answer}`,
    `SOURCE:\nReleased FAST item ${item.item_number} (${item.benchmark_code})`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function optionText(item: ReleasedItemForPromotion, letter: string) {
  return item.options.find((option) => option.letter.toUpperCase() === letter)?.text ?? null;
}

export function buildReleasedQuestionInsert(
  item: ReleasedItemForPromotion,
  options: {
    standardId: string | null;
    primaryClassification: string;
    difficultyLevel: number;
  }
) {
  return {
    standard_id: options.standardId,
    content: formatReleasedQuestionContent(item),
    cognitive_skill_targeted: options.primaryClassification,
    difficulty_level: options.difficultyLevel,
    title: item.released_passages?.passage_title ?? `Released FAST Item ${item.item_number}`,
    author: 'Florida FAST Released Test',
    pub_year: null,
    option_a_text: optionText(item, 'A'),
    option_b_text: optionText(item, 'B'),
    option_c_text: optionText(item, 'C'),
    option_d_text: optionText(item, 'D'),
    correct_option: item.correct_answer,
    approved: true,
    flagged: false,
    rationale: `Promoted from released FAST item ${item.item_number}; benchmark ${item.benchmark_code}; primary GOGI signal ${options.primaryClassification}.`,
    pipeline_source: 'v3_promoted',
    source_classification: options.primaryClassification,
    source: 'released_fast',
    released_item_id: item.id,
    is_released_item: true,
  };
}
