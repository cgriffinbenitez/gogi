export type LessonVocabEntry = {
  word: string;
  pos: string;
  student_friendly_def: string;
  example_sentence_from_text: string;
};

export type LessonWorkedExample = {
  standardCode: string;
  element_named: string;
  evidence_quoted: string;
  evidence_location: string;
  layer_identified: string;
  effect_explanation: string;
};

export type LessonExcerptFile = {
  id: string;
  text_id: string;
  title: string;
  author: string;
  publication_year: string;
  chapter_or_section: string;
  standards_supported: string[];
  text_clean: string;
  vocab: LessonVocabEntry[];
  worked_examples: LessonWorkedExample[];
};

export type LessonExcerptValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  excerpt: LessonExcerptFile | null;
};

const BANNED_PHRASES = [
  /matters because it creates meaning beyond a surface summary/i,
  /detail matters because it does more than/i,
  /matters because it is important/i,
  /shows the theme/i,
  /what does it suggest in context/i,
  /this evidence is important/i,
];

const VALID_POS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'phrase',
]);

function clean(value: string | undefined) {
  return (value ?? '').trim();
}

function wordCount(value: string) {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

function stripQuotes(value: string) {
  return clean(value).replace(/^["“”']+|["“”']+$/g, '').trim();
}

function parseHeaderValue(markdown: string, key: string) {
  const match = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return clean(match?.[1]);
}

function parseStandards(value: string) {
  const bracketed = value.match(/\[([\s\S]+)\]/)?.[1] ?? value;
  return bracketed
    .split(',')
    .map((item) => item.replace(/["']/g, '').trim())
    .filter(Boolean);
}

function section(markdown: string, heading: string) {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'm');
  return clean(markdown.match(pattern)?.[1]);
}

function workedExampleSections(markdown: string) {
  const matches = [...markdown.matchAll(/^##\s+worked_example:\s*([A-Z0-9.]+)\s*$([\s\S]*?)(?=^##\s+|$)/gm)];
  return matches.map((match) => ({
    standardCode: clean(match[1]),
    body: clean(match[2]),
  }));
}

function field(body: string, key: string) {
  const pipeMatch = body.match(new RegExp(`^${key}:\\s*\\|\\s*\\n([\\s\\S]*?)(?=^[a-zA-Z0-9_]+:\\s*|$)`, 'm'));
  if (pipeMatch) {
    return pipeMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s{2}/, ''))
      .join('\n')
      .trim();
  }
  return clean(body.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]);
}

function parseVocab(markdown: string) {
  const body = section(markdown, 'vocab');
  if (!body) return [];
  const chunks = body
    .split(/\n(?=-\s+word:\s*)/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk) => ({
    word: clean(chunk.match(/^-?\s*word:\s*(.+)$/m)?.[1]),
    pos: clean(chunk.match(/^\s*pos:\s*(.+)$/m)?.[1]).toLowerCase(),
    student_friendly_def: clean(chunk.match(/^\s*student_friendly_def:\s*(.+)$/m)?.[1]),
    example_sentence_from_text: clean(chunk.match(/^\s*example_sentence_from_text:\s*(.+)$/m)?.[1]),
  }));
}

export function parseLessonExcerptMarkdown(markdown: string): LessonExcerptFile {
  const id = clean(markdown.match(/^#\s+excerpt:\s*(.+)$/m)?.[1]);
  const standards = parseStandards(parseHeaderValue(markdown, 'standards_supported'));
  const textClean = section(markdown, 'text_clean');

  return {
    id,
    text_id: parseHeaderValue(markdown, 'text_id'),
    title: parseHeaderValue(markdown, 'title'),
    author: parseHeaderValue(markdown, 'author'),
    publication_year: parseHeaderValue(markdown, 'publication_year'),
    chapter_or_section: parseHeaderValue(markdown, 'chapter_or_section'),
    standards_supported: standards,
    text_clean: textClean,
    vocab: parseVocab(markdown),
    worked_examples: workedExampleSections(markdown).map(({ standardCode, body }) => ({
      standardCode,
      element_named: field(body, 'element_named'),
      evidence_quoted: field(body, 'evidence_quoted'),
      evidence_location: field(body, 'evidence_location'),
      layer_identified: field(body, 'layer_identified'),
      effect_explanation: field(body, 'effect_explanation'),
    })),
  };
}

export function validateLessonExcerptMarkdown(markdown: string): LessonExcerptValidation {
  const excerpt = parseLessonExcerptMarkdown(markdown);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!excerpt.id) errors.push('Missing "# excerpt: <id>" header.');
  if (!excerpt.text_id) errors.push('Missing text_id.');
  if (!excerpt.title) errors.push('Missing title.');
  if (!excerpt.author) errors.push('Missing author.');
  if (!excerpt.chapter_or_section) errors.push('Missing chapter_or_section.');
  if (!excerpt.standards_supported.length) errors.push('Missing standards_supported list.');

  const words = wordCount(excerpt.text_clean);
  if (!excerpt.text_clean) errors.push('Missing ## text_clean section.');
  if (words < 80) errors.push(`text_clean is too short for a 90-minute lesson excerpt (${words} words).`);
  if (words > 650) warnings.push(`text_clean is long (${words} words). Consider a tighter lesson excerpt.`);
  if (/\[\s*\.\.\.|\.\.\.\.\.|¬|\[\s*no\s*\]/i.test(excerpt.text_clean)) {
    errors.push('text_clean contains OCR junk, bracket gaps, or broken hyphenation.');
  }
  if (!/[.!?]["”']?$/.test(stripQuotes(excerpt.text_clean))) {
    errors.push('text_clean should end on a complete sentence.');
  }

  if (excerpt.vocab.length < 4 || excerpt.vocab.length > 5) {
    errors.push('## vocab must include 4-5 curated words.');
  }
  for (const item of excerpt.vocab) {
    if (!item.word) errors.push('A vocab entry is missing word.');
    if (!VALID_POS.has(item.pos)) errors.push(`Vocab "${item.word || '(missing word)'}" has invalid POS "${item.pos}".`);
    if (!item.student_friendly_def) errors.push(`Vocab "${item.word}" is missing student_friendly_def.`);
    if (!item.example_sentence_from_text) errors.push(`Vocab "${item.word}" is missing example_sentence_from_text.`);
    if (item.example_sentence_from_text && item.word && !excerpt.text_clean.toLowerCase().includes(item.word.toLowerCase())) {
      warnings.push(`Vocab "${item.word}" does not appear plainly in text_clean. Verify the example sentence.`);
    }
  }

  for (const standard of excerpt.standards_supported) {
    const worked = excerpt.worked_examples.find((example) => example.standardCode === standard);
    if (!worked) {
      errors.push(`Missing ## worked_example: ${standard}.`);
      continue;
    }
    if (!worked.element_named) errors.push(`${standard} worked example missing element_named.`);
    if (!worked.evidence_quoted) errors.push(`${standard} worked example missing evidence_quoted.`);
    if (!worked.evidence_location) errors.push(`${standard} worked example missing evidence_location.`);
    if (!worked.layer_identified) errors.push(`${standard} worked example missing layer_identified.`);
    if (wordCount(worked.effect_explanation) < 40) {
      errors.push(`${standard} effect_explanation must be at least 40 words of real analysis.`);
    }
    if (
      worked.evidence_quoted &&
      !excerpt.text_clean.toLowerCase().includes(stripQuotes(worked.evidence_quoted).toLowerCase().slice(0, 60))
    ) {
      warnings.push(`${standard} evidence_quoted may not appear exactly in text_clean. Verify quote accuracy.`);
    }
  }

  const combined = [
    excerpt.text_clean,
    ...excerpt.worked_examples.map((example) => example.effect_explanation),
  ].join('\n');
  for (const phrase of BANNED_PHRASES) {
    if (phrase.test(combined)) errors.push(`Banned placeholder phrase detected: ${phrase.source}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    excerpt: errors.length === 0 ? excerpt : excerpt,
  };
}
