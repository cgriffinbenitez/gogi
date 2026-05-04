import type { Ela9R11MisconceptionFlag, Ela9R11TeachRoute } from './types';

export type Ela9R11MisconceptionSpec = {
  label: string;
  teacherDescription: string;
  studentNeed: string;
  route: Ela9R11TeachRoute;
  priority: number;
};

export const ELA9R11_MISCONCEPTIONS: Record<Ela9R11MisconceptionFlag, Ela9R11MisconceptionSpec> = {
  element_not_identified: {
    label: 'Element not identified',
    teacherDescription: 'Student does not locate the literary element the question is asking about.',
    studentNeed: 'Name the element before explaining what it does.',
    route: 'strategy',
    priority: 70,
  },
  element_misidentified: {
    label: 'Element misidentified',
    teacherDescription: 'Student confuses one literary element with another.',
    studentNeed: 'Separate setting, plot, character, conflict, mood, tone, theme, and structure.',
    route: 'strategy',
    priority: 70,
  },
  function_not_explained: {
    label: 'Function not explained',
    teacherDescription: 'Student names an element but does not explain how it works in the passage.',
    studentNeed: 'Use the move: element -> author effect -> meaning.',
    route: 'strategy',
    priority: 64,
  },
  effect_confused_with_summary: {
    label: 'Effect confused with summary',
    teacherDescription: 'Student retells what happened instead of explaining the effect on meaning, mood, tone, or theme.',
    studentNeed: 'Move from what happened to what the author made the reader understand or feel.',
    route: 'inferencing',
    priority: 82,
  },
  meaning_connection_missing: {
    label: 'Meaning connection missing',
    teacherDescription: 'Student does not connect the element to a deeper layer of meaning.',
    studentNeed: 'Link textual details to theme, implied meaning, or author purpose.',
    route: 'theme-builder',
    priority: 78,
  },
  style_connection_missing: {
    label: 'Style connection missing',
    teacherDescription: 'Student misses how word choice, imagery, or structure creates the author style.',
    studentNeed: 'Track how craft choices shape the voice and feel of the passage.',
    route: 'structure-purpose',
    priority: 66,
  },
  evidence_irrelevant: {
    label: 'Evidence irrelevant',
    teacherDescription: 'Student chooses text evidence that does not support the answer.',
    studentNeed: 'Tie each answer to a specific word, phrase, or detail that proves it.',
    route: 'evidence',
    priority: 74,
  },
  evidence_too_general: {
    label: 'Evidence too general',
    teacherDescription: 'Student chooses a broad section or vague detail instead of precise evidence.',
    studentNeed: 'Use the smallest useful piece of text evidence.',
    route: 'evidence',
    priority: 68,
  },
  evidence_misread: {
    label: 'Evidence misread',
    teacherDescription: 'Student cites evidence but misunderstands what it says or implies.',
    studentNeed: 'Slow down and paraphrase the evidence before using it.',
    route: 'evidence',
    priority: 72,
  },
  quote_without_function: {
    label: 'Quote without function',
    teacherDescription: 'Student drops a quote but does not explain how it supports the answer.',
    studentNeed: 'Explain what the quote does, not just where it appears.',
    route: 'evidence',
    priority: 60,
  },
  analysis_too_vague: {
    label: 'Analysis too vague',
    teacherDescription: 'Student gives an answer that sounds literary but is not anchored to the passage.',
    studentNeed: 'Use concrete text signals and name a specific effect.',
    route: 'strategy',
    priority: 58,
  },
  literal_reading_only: {
    label: 'Literal reading only',
    teacherDescription: 'Student stays at the surface level and misses implied meaning.',
    studentNeed: 'Infer what the detail suggests beyond what it literally says.',
    route: 'inferencing',
    priority: 80,
  },
  theme_element_confusion: {
    label: 'Theme and element confused',
    teacherDescription: 'Student treats a literary element as the theme or treats the theme as a single event.',
    studentNeed: 'Separate the tool the author uses from the message the author builds.',
    route: 'theme-builder',
    priority: 76,
  },
  tone_mood_confusion: {
    label: 'Tone and mood confused',
    teacherDescription: 'Student confuses the author or speaker attitude with the feeling created for the reader.',
    studentNeed: 'Separate author attitude from reader feeling.',
    route: 'mood',
    priority: 86,
  },
  point_of_view_effect_missing: {
    label: 'Point of view effect missing',
    teacherDescription: 'Student identifies point of view but misses how it shapes what the reader knows or feels.',
    studentNeed: 'Track what the narrator lets the reader know, miss, or question.',
    route: 'inferencing',
    priority: 64,
  },
  figurative_language_effect_missing: {
    label: 'Figurative language effect missing',
    teacherDescription: 'Student recognizes figurative language but misses its effect on meaning or feeling.',
    studentNeed: 'Explain what the comparison, image, or symbol adds.',
    route: 'figurative',
    priority: 70,
  },
  structure_effect_missing: {
    label: 'Structure effect missing',
    teacherDescription: 'Student misses how order, pacing, repetition, or contrast shapes meaning.',
    studentNeed: 'Explain how the order of the text changes the reader experience.',
    route: 'structure-purpose',
    priority: 70,
  },
};

export function describeMisconception(flag: Ela9R11MisconceptionFlag) {
  return ELA9R11_MISCONCEPTIONS[flag];
}
