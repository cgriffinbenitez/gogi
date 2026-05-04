export type FastReadingWinLoopStep = 'spot' | 'name' | 'prove' | 'check' | 'compare' | 'revise';

export type FastGrade9ReadingDemand = {
  id: string;
  standardCode: string;
  standardText: string;
  fastDemand: string;
  studentTitle: string;
  teacherTitle: string;
  commonMiss: string;
  studentMove: string;
  microDiagnostic: string;
  readingWinLoop: FastReadingWinLoopStep[];
  proofOfGrowth: string;
  itemShape: string;
  layer0Support: string;
  cognitiveProfileId?: string;
};

export const FAST_GRADE9_RELEASED_BENCHMARKS = [
  'ELA.9.R.1.1',
  'ELA.9.R.1.2',
  'ELA.9.R.1.3',
  'ELA.9.R.2.1',
  'ELA.9.R.2.2',
  'ELA.9.R.2.3',
  'ELA.9.R.2.4',
  'ELA.9.R.3.1',
  'ELA.9.R.3.3',
  'ELA.9.R.3.4',
  'ELA.9.V.1.2',
  'ELA.9.V.1.3',
] as const;

export type FastGrade9ReleasedBenchmark = (typeof FAST_GRADE9_RELEASED_BENCHMARKS)[number];

export const FAST_GRADE9_READING_DEMANDS: FastGrade9ReadingDemand[] = [
  {
    id: 'literary-key-element-layer',
    standardCode: 'ELA.9.R.1.1',
    standardText:
      'Explain how key elements enhance or add layers of meaning and/or style in a literary text.',
    fastDemand:
      'The student must explain why a specific literary detail, object, description, setting shift, or plot element matters beyond the literal event.',
    studentTitle: 'Use one story detail to explain deeper meaning',
    teacherTitle: 'Key literary elements add layers of meaning',
    commonMiss:
      'Student identifies the detail but only restates what happened, or chooses an answer that sounds important without explaining the author effect.',
    studentMove: 'Name the detail, say what it suggests, then explain why it matters.',
    microDiagnostic:
      'Give one short excerpt and ask the student to choose which sentence explains the effect of one highlighted detail.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student uses one exact detail to explain a layer of meaning, style, mood, or plot effect.',
    itemShape:
      'Single-answer literary analysis item asking how a description, setting detail, or plot element contributes to meaning.',
    layer0Support:
      'If cognitive load is high, highlight only one detail and offer two effect words before asking for the full explanation.',
    cognitiveProfileId: 'ELA.9.R.1.1',
  },
  {
    id: 'theme-development-evidence',
    standardCode: 'ELA.9.R.1.2',
    standardText: 'Analyze universal themes and their development throughout a literary text.',
    fastDemand:
      'The student must turn a topic into a universal theme and track how multiple story moments develop that theme.',
    studentTitle: 'Turn the topic into a life lesson',
    teacherTitle: 'Theme development across a literary text',
    commonMiss:
      'Student picks a topic or moral-sounding sentence, then misses the evidence that proves the theme across the passage.',
    studentMove:
      'Ask: what does this text show about people, choices, or life? Then prove it with two moments.',
    microDiagnostic:
      'Ask for the best theme statement first, then ask which two details develop that theme.',
    readingWinLoop: ['name', 'prove', 'compare', 'check'],
    proofOfGrowth:
      'Student selects a universal theme and matches it with two details that develop the same idea.',
    itemShape:
      'Two-part or multiple-select item: identify theme, then select the details that develop it.',
    layer0Support:
      'For low working-memory availability, separate theme choice from evidence choice and keep the theme language plain.',
    cognitiveProfileId: 'ELA.9.R.1.2',
  },
  {
    id: 'narrator-perspective-irony',
    standardCode: 'ELA.9.R.1.3',
    standardText:
      'Analyze the influence of narrator perspective on a text, explaining how the author creates irony or satire.',
    fastDemand:
      'The student must notice the gap between what a narrator, speaker, or character says and what the reader understands.',
    studentTitle: 'Find the gap between what is said and what is meant',
    teacherTitle: 'Narrator perspective, irony, and satire',
    commonMiss:
      'Student reads the sentence straight instead of noticing contrast, exaggeration, reversal, or a speaker’s limited view.',
    studentMove:
      'Ask: what does the speaker think, what do I know, and what is funny, unfair, or reversed?',
    microDiagnostic:
      'Show a short ironic description and ask what makes it ironic before asking for the answer choice.',
    readingWinLoop: ['spot', 'compare', 'name', 'prove'],
    proofOfGrowth:
      'Student explains the contrast that creates irony, satire, or perspective-based meaning.',
    itemShape:
      'Single-answer item asking how a line develops irony, satire, or narrator perspective.',
    layer0Support:
      'For attention fatigue, visually separate speaker view from reader view before the answer choices appear.',
    cognitiveProfileId: 'ELA.9.R.1.3',
  },
  {
    id: 'informational-structure-purpose',
    standardCode: 'ELA.9.R.2.1',
    standardText:
      'Analyze how multiple text structures and/or features convey a purpose and/or meaning in texts.',
    fastDemand:
      'The student must explain how a paragraph, sequence, contrast, example, or feature helps the author build meaning or purpose.',
    studentTitle: 'Figure out why this part is here',
    teacherTitle: 'Text structure and feature purpose',
    commonMiss: 'Student summarizes the paragraph but misses its job in the whole text.',
    studentMove: 'Ask: why did the author put this part here, and what job does it do?',
    microDiagnostic:
      'Give two adjacent paragraphs and ask how the second paragraph changes, proves, contrasts, or extends the first.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student names the structural job of a paragraph or feature and connects it to author purpose.',
    itemShape:
      'Single or multiple-select item asking how paragraphs, features, or structure develop meaning.',
    layer0Support:
      'For syntax barriers, chunk the paragraph into claim, example, and effect before asking for the structure job.',
    cognitiveProfileId: 'ELA.9.R.2.1',
  },
  {
    id: 'central-idea-support',
    standardCode: 'ELA.9.R.2.2',
    standardText:
      'Evaluate the support an author uses to develop the central idea(s) throughout a text.',
    fastDemand:
      'The student must identify the central idea and choose evidence that genuinely develops it, not just evidence from the same topic.',
    studentTitle: 'Match the big idea to the proof',
    teacherTitle: 'Central idea and supporting evidence',
    commonMiss:
      'Student chooses a true detail that is nearby or interesting but does not prove the central idea.',
    studentMove: 'Say the big idea in plain words, then ask which detail makes that idea stronger.',
    microDiagnostic:
      'Ask the student to reject one tempting detail that is true but does not support the central idea.',
    readingWinLoop: ['name', 'prove', 'check', 'revise'],
    proofOfGrowth:
      'Student pairs a central idea with evidence and explains how the evidence develops that idea.',
    itemShape:
      'Two-part item: select central idea, then select the detail that best supports or develops it.',
    layer0Support:
      'If load is high, hide extra distractors until the student has stated the central idea in their own words.',
    cognitiveProfileId: 'ELA.9.R.2.2',
  },
  {
    id: 'rhetorical-appeal-purpose',
    standardCode: 'ELA.9.R.2.3',
    standardText:
      'Analyze how an author establishes and achieves purpose(s) through rhetorical appeals and/or figurative language.',
    fastDemand:
      'The student must recognize how evidence, expert reference, emotional appeal, credibility, or figurative language helps persuade the reader.',
    studentTitle: 'Name how the author is trying to persuade you',
    teacherTitle: 'Rhetorical appeals and author purpose',
    commonMiss:
      'Student notices the topic but does not identify the persuasive move or why it helps the author’s purpose.',
    studentMove:
      'Ask: is the author using facts, credibility, feelings, or vivid language, and why?',
    microDiagnostic:
      'Show one persuasive sentence and ask which appeal it uses before asking how it supports purpose.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student names the rhetorical appeal and explains how it helps the author achieve a purpose.',
    itemShape: 'Single-answer item asking how a rhetorical appeal supports persuasion or purpose.',
    layer0Support:
      'For vocabulary gaps, pre-label appeal types with plain-language examples before moving to the passage.',
    cognitiveProfileId: 'ELA.9.R.2.3',
  },
  {
    id: 'compare-opposing-arguments',
    standardCode: 'ELA.9.R.2.4',
    standardText:
      'Compare the development of two opposing arguments on the same topic, evaluating the effectiveness and validity of the claims.',
    fastDemand:
      'The student must track two texts at once, separate each author’s claim, and compare how evidence develops or limits each argument.',
    studentTitle: 'Compare two sides without mixing them up',
    teacherTitle: 'Opposing arguments, claims, evidence, and validity',
    commonMiss:
      'Student blends both passages together or matches a claim to the wrong passage in table-style questions.',
    studentMove: 'Make a two-column claim map: Passage 1 says, Passage 2 says, both say.',
    microDiagnostic:
      'Use a three-row table where the student must place one claim under Passage 1, Passage 2, or Both.',
    readingWinLoop: ['name', 'compare', 'prove', 'check'],
    proofOfGrowth:
      'Student correctly sorts claims and evidence by passage, then explains which argument is better supported.',
    itemShape:
      'Multiple-select table comparing how two passages develop claims, evidence, limitations, or validity.',
    layer0Support:
      'If working memory is constrained, keep the two-column map visible while the student answers.',
    cognitiveProfileId: 'ELA.9.R.2.4',
  },
  {
    id: 'figurative-language-effect',
    standardCode: 'ELA.9.R.3.1',
    standardText: 'Explain how figurative language creates mood in text(s).',
    fastDemand:
      'The student must recognize a nonliteral move, interpret what it means in context, and explain the effect it creates in the passage.',
    studentTitle: 'Break down figurative language',
    teacherTitle: 'Figurative language effect',
    commonMiss:
      'Student reads the phrase literally, names the device without explaining effect, or jumps to a mood word without proving it from the language.',
    studentMove:
      'Ask: what is being compared or personified, what does it suggest, and what effect does it create?',
    microDiagnostic:
      'Highlight one figurative phrase and ask the student to interpret the image before asking for the effect.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student explains a figurative phrase by naming the image, meaning, and effect in context.',
    itemShape:
      'Single-answer item asking how personification, metaphor, imagery, or figurative language affects meaning, mood, tone, or reader understanding.',
    layer0Support:
      'For low confidence, separate the move into image, meaning, and effect before showing answer choices.',
    cognitiveProfileId: 'ELA.9.R.3.1',
  },
  {
    id: 'adaptation-comparison',
    standardCode: 'ELA.9.R.3.3',
    standardText:
      'Compare and contrast the ways authors have adapted mythical, classical, or religious texts.',
    fastDemand:
      'The student must recognize the original source pattern and compare how later texts reuse, shift, mock, admire, or reinterpret it.',
    studentTitle: 'See what changed in the retelling',
    teacherTitle: 'Adaptation across texts',
    commonMiss:
      'Student notices the shared character or plot but misses how the author changed the meaning or attitude.',
    studentMove: 'Ask: what stayed the same, what changed, and what message changed with it?',
    microDiagnostic:
      'Give a short source summary and one adaptation, then ask what the adaptation changes about the original idea.',
    readingWinLoop: ['spot', 'compare', 'name', 'prove'],
    proofOfGrowth:
      'Student compares a source and adaptation by naming both the shared element and the changed meaning.',
    itemShape:
      'Multiple-select table comparing how two adaptations treat the same myth, figure, or source idea.',
    layer0Support:
      'For background gaps, provide the source pattern in one sentence before asking for the adaptation comparison.',
    cognitiveProfileId: 'ELA.9.R.3.3',
  },
  {
    id: 'author-rhetoric-effect',
    standardCode: 'ELA.9.R.3.4',
    standardText: 'Explain an author’s use of rhetoric in a text.',
    fastDemand:
      'The student must explain how a rhetorical move, reference, contrast, analogy, or wording choice shapes the reader’s view.',
    studentTitle: 'Explain what the author wants you to think',
    teacherTitle: 'Rhetoric and reader effect',
    commonMiss:
      'Student identifies the quoted line but misses the author’s intended effect on the reader.',
    studentMove: 'Ask: what does this wording make the reader believe, feel, or notice?',
    microDiagnostic:
      'Give one rhetorical line and ask for the reader effect before requiring evidence.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student explains the rhetorical move and connects it to the reader effect or author purpose.',
    itemShape:
      'Part A/Part B item: explain why the author uses a rhetorical move, then select the evidence or effect.',
    layer0Support:
      'For attention fatigue, isolate the rhetorical line and one surrounding sentence before adding answer choices.',
    cognitiveProfileId: 'ELA.9.R.3.4',
  },
  {
    id: 'word-part-etymology',
    standardCode: 'ELA.9.V.1.2',
    standardText:
      'Apply knowledge of etymology and derivations to determine meanings of words and phrases in grade-level content.',
    fastDemand:
      'The student must use roots, prefixes, suffixes, or word origin clues to identify meaning in a passage context.',
    studentTitle: 'Use word parts to unlock meaning',
    teacherTitle: 'Morphology and etymology in context',
    commonMiss:
      'Student guesses from sentence tone or chooses a familiar-looking word without checking the word part clue.',
    studentMove:
      'Break the word into parts, say what each part means, then test it in the sentence.',
    microDiagnostic:
      'Ask the student to match a root or prefix to the word in the sentence, then explain the word’s meaning.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student uses a word part or origin clue to explain a word’s meaning in context.',
    itemShape:
      'Selectable-word or multiple-choice item using etymology, roots, prefixes, suffixes, or derivations.',
    layer0Support:
      'If processing speed is low, show the word-part split visually before asking for meaning.',
    cognitiveProfileId: 'ELA.9.V.1.2',
  },
  {
    id: 'vocabulary-context-connotation',
    standardCode: 'ELA.9.V.1.3',
    standardText:
      'Use context clues, figurative language, word relationships, reference materials, and background knowledge to determine connotative and denotative meaning.',
    fastDemand:
      'The student must infer word or phrase meaning from nearby clues and decide whether the meaning is literal, emotional, or connotative.',
    studentTitle: 'Use nearby clues to choose the right meaning',
    teacherTitle: 'Vocabulary in context and connotation',
    commonMiss:
      'Student picks a dictionary meaning that does not fit the sentence or misses the emotional charge of the word.',
    studentMove: 'Read before and after the word, replace it with your guess, then check the tone.',
    microDiagnostic: 'Ask for the best replacement word and then ask which nearby clue proves it.',
    readingWinLoop: ['spot', 'name', 'prove', 'check'],
    proofOfGrowth:
      'Student chooses a meaning that fits the sentence and proves it with nearby context.',
    itemShape: 'Vocabulary-in-context item asking for meaning, connotation, or phrase effect.',
    layer0Support:
      'For confidence gaps, give a replacement-word test before showing full answer choices.',
    cognitiveProfileId: 'ELA.9.V.1.3',
  },
];

export const FAST_GRADE9_DEMANDS_BY_STANDARD = FAST_GRADE9_READING_DEMANDS.reduce<
  Record<string, FastGrade9ReadingDemand[]>
>((map, demand) => {
  map[demand.standardCode] = [...(map[demand.standardCode] ?? []), demand];
  return map;
}, {});

export const FAST_GRADE9_READING_DEMANDS_BY_ID = FAST_GRADE9_READING_DEMANDS.reduce<
  Record<string, FastGrade9ReadingDemand>
>((map, demand) => {
  map[demand.id] = demand;
  return map;
}, {});

export function getFastReadingDemandsForStandard(standardCode: string) {
  return FAST_GRADE9_DEMANDS_BY_STANDARD[standardCode] ?? [];
}

export function getPrimaryFastReadingDemand(standardCode: string) {
  return getFastReadingDemandsForStandard(standardCode)[0] ?? null;
}
