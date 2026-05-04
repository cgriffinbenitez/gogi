type OriginalOption = {
  letter: string;
  text: string;
};

export type OriginalItemDraftForPromotion = {
  id: string;
  benchmark_code: string;
  passage_title: string;
  passage_text: string;
  prompt_text: string;
  options: OriginalOption[];
  correct_answer: string;
  correct_rationale: string;
  remediation_hint: string;
  difficulty_estimate: number;
};

function optionText(item: OriginalItemDraftForPromotion, letter: string) {
  return item.options.find((option) => option.letter.toUpperCase() === letter)?.text ?? null;
}

export function formatOriginalQuestionContent(item: OriginalItemDraftForPromotion) {
  const options = item.options
    .map((option) => `${option.letter.trim().toUpperCase()}. ${option.text.trim()}`)
    .join('\n');

  return [
    `PASSAGE:\n${item.passage_text.trim()}`,
    `QUESTION:\n${item.prompt_text.trim()}`,
    `OPTIONS:\n${options}`,
    `ANSWER:\n${item.correct_answer}`,
    `SOURCE:\nGOGI original FAST-aligned item (${item.benchmark_code})`,
  ].join('\n\n');
}

export function buildOriginalQuestionInsert(
  item: OriginalItemDraftForPromotion,
  options: {
    standardId: string | null;
  }
) {
  return {
    standard_id: options.standardId,
    content: formatOriginalQuestionContent(item),
    cognitive_skill_targeted: item.benchmark_code,
    difficulty_level: item.difficulty_estimate,
    title: item.passage_title,
    author: 'GOGI Original',
    pub_year: null,
    option_a_text: optionText(item, 'A'),
    option_b_text: optionText(item, 'B'),
    option_c_text: optionText(item, 'C'),
    option_d_text: optionText(item, 'D'),
    correct_option: item.correct_answer,
    approved: true,
    flagged: false,
    rationale: `${item.correct_rationale} Remediation move: ${item.remediation_hint}`,
    pipeline_source: 'v3_promoted',
    source_classification: item.benchmark_code,
    source: 'gogi_original_fast_aligned',
    is_released_item: false,
  };
}
