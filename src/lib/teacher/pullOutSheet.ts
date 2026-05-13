import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getFastAldGuidanceForStandard } from '@/lib/fast/achievementLevelDescriptions';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';
import { ELA9_READING_SKILL_MOVES } from '@/lib/reading-wins/skillMoveMap';

export type PullOutRow = {
  number: number;
  standard: string;
  subSkillId: string | null;
  skillFocus: string;
  selection: string;
  exactLinesOrParagraphs: string;
  excerpt: string;
  structureWindow?: {
    startParagraph: number;
    endParagraph: number;
    paragraphCount: number;
  };
  whyThisExcerpt: string;
  moveStatementTemplate: string;
  instructionalSupport?: {
    title: string;
    teachFirst: string[];
    cornellNotes: string[];
    studentStrategy: string[];
    prometheanPrompt: string;
    successCriteria: string[];
  };
  qualityGate?: {
    status: 'gold' | 'candidate' | 'revise';
    label: string;
    checks: string[];
  };
  teacherTrust: {
    confidence: 'strong' | 'emerging' | 'weak';
    officialTextMap: boolean;
    localSourceText: boolean;
    excerptWords: number;
    evidencePoints: string[];
    useCase: string;
    whyTrustIt: string;
  };
  anchorQuestion: {
    stem: string;
    choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
  };
};

export type PullOutSheet = {
  title: string;
  essentialQuestion: string;
  standardsCoverageSummary: Record<string, number>;
  rows: PullOutRow[];
  teacherNotes: string[];
  sourceTexts: Array<{ title: string; author: string | null; status: string; word_count: number }>;
};

export type R11CoverageItem = {
  strandId: string;
  label: string;
  studentMove: string;
  passageMustHave?: string[];
  fastStemFocus?: string[];
  commonMiss?: string;
  scaffold?: string;
  masterySignal?: string;
  minimumPullOuts: number;
  strongCount: number;
  emergingCount: number;
  status: 'ready' | 'building' | 'needed';
  bestPullOut: PullOutRow | null;
  pullOuts: PullOutRow[];
};

export type R11CoverageBoard = {
  standardCode: 'ELA.9.R.1.1';
  title: string;
  totalStrong: number;
  targetStrong: number;
  items: R11CoverageItem[];
};

export type TeachingReadinessBoard = {
  targetPerSkill: number;
  totalStrong: number;
  targetStrong: number;
  standards: Array<{
    code: string;
    title: string;
    standardText: string;
    stateGuidance: string[];
    studentsNeedToKnow: string[];
    needCoverage: Array<{
      label: string;
      description: string;
      status: 'ready' | 'building' | 'needed';
      strongCount: number;
      targetStrong: number;
      bestText: string | null;
      bestLocation: string | null;
    }>;
    fastReportQuestions: string[];
    assessmentWeight: {
      category: string;
      percentOfTest: string;
      priority: 'highest' | 'high' | 'supporting';
      note: string;
    };
    fastDemand: string;
    itemShape: string;
    strategy: string;
    strongCount: number;
    targetStrong: number;
    argumentLabs?: ArgumentLab[];
    availableTexts: Array<{
      title: string;
      author: string | null;
      status: string;
      wordCount: number;
      hasLocalText: boolean;
      textPath: string | null;
    }>;
    skills: R11CoverageItem[];
  }>;
};

export type ArgumentLab = {
  id: string;
  title: string;
  issueQuestion: string;
  durationMinutes: number;
  sourcePair: string;
  teacherSetup: string;
  studentProduct: string;
  sequence: Array<{
    label: string;
    minutes: number;
    teacherMove: string;
    studentTask: string;
  }>;
  cards: PullOutRow[];
};

export type TextTeachingMap = {
  selectedText: {
    title: string;
    author: string | null;
    status: string;
    wordCount: number;
    standards: string[];
    hasLocalText: boolean;
  } | null;
  texts: Array<{
    title: string;
    author: string | null;
    status: string;
    wordCount: number;
    standards: string[];
    hasLocalText: boolean;
  }>;
  standards: Array<{
    code: string;
    title: string;
    readyPullOuts: number;
    rows: PullOutRow[];
  }>;
  emptyState: string | null;
};

type ManifestEntry = {
  title: string;
  author: string | null;
  standards: string[];
  status: string;
  text_path: string | null;
  word_count: number;
  manual_text?: string;
};

type Manifest = {
  entries: ManifestEntry[];
};

type ManualUploadManifestEntry = {
  title: string;
  author: string | null;
  word_count: number;
  path: string;
};

type ManualUploadManifest = {
  entries: ManualUploadManifestEntry[];
};

type SupabaseManualUploadRow = {
  source_title: string | null;
  source_author: string | null;
  paragraph_text: string | null;
  word_count: number | null;
  created_at: string | null;
};

let supabaseManualUploadEntriesCache: Promise<ManifestEntry[]> | null = null;

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data', 'official-text-library', 'manifest.json');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(
  ROOT,
  'data',
  'official-text-library',
  'manual-uploads',
  'manifest.json'
);
export const R11_PULL_OUT_TARGET = 5;
export const R11_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.1.1'
);
const R14_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.1.4'
);
const R12_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.1.2'
);
const R13_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.1.3'
);
const R21_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.2.1'
);
const R22_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.2.2'
);
const R23_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.2.3'
);
const R24_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.2.4'
);
const R32_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.3.2'
);
const R34_SUB_SKILLS = ELA9_READING_SKILL_MOVES.filter(
  (move) => move.standardCode === 'ELA.9.R.3.4'
);
export const TEACHING_PULL_OUT_TARGET = 5;

const STANDARD_ESSENTIAL_QUESTIONS: Record<string, string> = {
  'ELA.9.R.1.1': 'How does one key literary element add a deeper layer of meaning or style?',
  'ELA.9.R.1.2': 'How does a text develop a universal theme across moments?',
  'ELA.9.R.1.3': 'How does perspective, irony, or satire change what the reader understands?',
  'ELA.9.R.1.4': 'How do epic structures, characters, and themes shape meaning?',
  'ELA.9.R.2.1': 'How does structure help an author build purpose or meaning?',
  'ELA.9.R.2.2': 'How does evidence develop the central idea?',
  'ELA.9.R.2.3': 'How does rhetoric or figurative language help an author achieve purpose?',
  'ELA.9.R.2.4': 'Which argument is better developed, and how do we know?',
  'ELA.9.R.3.1': 'How does figurative language create or shift mood?',
  'ELA.9.R.3.2': 'How do I restate grade-level text accurately in my own words?',
  'ELA.9.R.3.3': 'How does an adaptation preserve or change a source text?',
  'ELA.9.R.3.4': 'How does rhetoric shape what the reader thinks or feels?',
  'ELA.9.V.1.1': 'How do I use academic vocabulary precisely in reading, speaking, and writing?',
  'ELA.9.V.1.2': 'How do word parts and context work together to determine meaning?',
  'ELA.9.V.1.3': 'How does context prove the precise meaning or connotation of a word?',
};

const STANDARD_LABELS: Record<string, string> = {
  ...FAST_GRADE9_READING_DEMANDS.reduce<Record<string, string>>((map, demand) => {
    map[demand.standardCode] = demand.teacherTitle;
    return map;
  }, {}),
  'ELA.9.R.1.4': 'Epic poetry',
  'ELA.9.R.3.2': 'Paraphrase grade-level text',
  'ELA.9.V.1.1': 'Academic vocabulary',
  'ELA.9.V.1.2': 'Etymology and derivations',
  'ELA.9.V.1.3': 'Context and connotation',
};

type StandardGuidance = {
  standardText: string;
  stateGuidance: string[];
  studentsNeedToKnow: string[];
  fastDemand: string;
  itemShape: string;
  strategy: string;
};

const STANDARD_GUIDANCE: Record<string, StandardGuidance> = {
  'ELA.9.R.1.2': {
    standardText: 'Analyze universal themes and their development throughout a literary text.',
    stateGuidance: [
      'Students should move beyond one-word topics and explain a transferable idea about people, choices, life, or society.',
      'FAST score-report guidance asks students to analyze universal themes and their development throughout a text.',
      'For classroom use, GOGI should surface short moments where a theme is stated, complicated, or proved through conflict and consequence.',
    ],
    studentsNeedToKnow: [
      'Universal theme: a complete idea that can apply beyond the story, not just a topic word.',
      'Theme evidence: exact moments, choices, consequences, or realizations that prove the theme.',
      'Theme development: the theme grows across more than one moment, not from one isolated sentence.',
      'Conflict or consequence: a character’s problem, choice, or result often reveals the theme.',
    ],
    fastDemand:
      'Students use evidence to explain a universal theme and how it develops through moments, conflict, choice, or consequence.',
    itemShape:
      'Theme evidence item asking which statement or evidence best explains a universal theme developed by the excerpt.',
    strategy:
      'Name the topic, turn it into a life idea, then prove it with exact evidence from the moment.',
  },
  'ELA.9.R.1.3': {
    standardText:
      'Analyze the influence of narrator perspective on a text, explaining how the author creates irony or satire.',
    stateGuidance: [
      'Students should explain how narrator or speaker perspective shapes what the reader understands.',
      'FAST score-report guidance asks students to analyze a narrator’s basic perspective and explain how authors create irony or satire.',
      'For classroom use, GOGI should surface short excerpts with a clear gap: what is said, believed, expected, or proposed versus what the reader understands.',
    ],
    studentsNeedToKnow: [
      'Narrator perspective: the narrator or speaker filters what the reader notices, trusts, questions, or feels.',
      'Perspective gap: the reader understands something the narrator, speaker, or character does not fully understand.',
      'Irony: a contrast between what is said/expected and what is actually true or what happens.',
      'Satire: a writer criticizes a real problem by using exaggeration, mock seriousness, or ridiculous logic.',
    ],
    fastDemand:
      'Students use evidence to explain narrator perspective, irony, satire, or the gap between surface meaning and reader understanding.',
    itemShape:
      'Perspective or irony item asking how a narrator, speaker, contrast, reversal, or satirical exaggeration shapes meaning.',
    strategy:
      'Make two columns: what is said or believed on the surface, and what the reader understands underneath.',
  },
  'ELA.9.R.1.4': {
    standardText: 'Analyze the characters, structures, and themes of epic poetry.',
    stateGuidance: [
      'Students should analyze epic characters, epic structures, and stated or developed themes, not just identify that a text is an epic.',
      'FAST score-report guidance points students toward explaining the characters, structure, and stated themes in an epic poem.',
      'For classroom use, GOGI should surface short excerpts that make one epic convention visible enough to teach in 10-15 minutes.',
    ],
    studentsNeedToKnow: [
      'In medias res: the epic begins in the middle of action, so readers infer what already happened.',
      'Epic hero traits: courage, endurance, honor, loyalty, pride, cleverness, or leadership shown through action.',
      'Divine intervention: a god, prayer, prophecy, fate, or supernatural force changes the action or meaning.',
      'Quest or journey structure: departure, obstacle, test, return, or recognition shapes the epic.',
      'Ritual, speech, oath, feast, burial, or hospitality reveals cultural values.',
      'Theme through heroic action: the hero’s choices develop ideas like honor, fate, loyalty, homecoming, or sacrifice.',
      'Elevated style and epic simile: formal language, repetition, invocation, or extended comparison makes the action feel larger than ordinary life.',
    ],
    fastDemand:
      'Students use evidence to explain how an epic character, structure, convention, or theme creates meaning.',
    itemShape:
      'Evidence item asking how a specific epic convention, character action, structure, or theme develops meaning.',
    strategy:
      'Name the epic convention, point to the exact evidence, then explain how it shapes character, structure, theme, or tension.',
  },
  'ELA.9.R.2.1': {
    standardText:
      'Analyze how multiple text structures and/or features convey a purpose and/or meaning in texts.',
    stateGuidance: [
      'Students should explain the job of the structure, not simply label it as chronological, cause/effect, compare/contrast, or problem/solution.',
      'FAST score-report guidance asks students to analyze how basic text structures and/or text features convey purpose and meaning in informational texts.',
      'For classroom use, GOGI should surface short excerpts where the structure is visible enough for students to mark and explain in 10-15 minutes.',
    ],
    studentsNeedToKnow: [
      'Chronological or sequence structure: order of events, steps, or ideas helps the reader track development.',
      'Cause and effect structure: the author links a condition, action, or issue to a result.',
      'Compare and contrast structure: two ideas, groups, or examples are placed side by side to clarify the point.',
      'Problem and solution structure: the author names an issue and then presents or evaluates a response.',
      'Example or evidence structure: examples, data, or illustrations are used to prove or clarify a point.',
      'Opening, closing, or shift structure: placement guides the reader by introducing, shifting, narrowing, or concluding the idea.',
    ],
    fastDemand:
      'Students explain how text structure or text features help an author convey purpose, meaning, or a central point.',
    itemShape:
      'Structure-purpose item asking how the organization of a paragraph or section helps develop the author’s meaning.',
    strategy:
      'Name the structure, mark the signal words, then explain the job that structure does for the reader.',
  },
  'ELA.9.R.2.2': {
    standardText:
      'Evaluate the support an author uses to develop the central idea(s) throughout a text.',
    stateGuidance: [
      'Students should identify the central idea and evaluate which evidence genuinely develops it.',
      'FAST score-report guidance asks students to analyze the support an author uses to develop a central idea.',
      'For classroom use, GOGI should surface paragraph windows where the main point and supporting evidence can be marked directly.',
    ],
    studentsNeedToKnow: [
      'Central idea: the author’s controlling point, not one interesting detail.',
      'Strong evidence: a detail, example, reason, or fact that directly proves or develops the central idea.',
      'Weak evidence: a true detail that is nearby, interesting, or related but does not prove the main point.',
      'Development: support can clarify, extend, prove, narrow, or complicate the central idea across paragraphs.',
      'Best evidence questions require students to compare options, not just find a sentence from the passage.',
    ],
    fastDemand:
      'Students identify a central idea and evaluate how specific support develops that idea throughout an informational text.',
    itemShape:
      'Central-idea evidence item asking which statement or detail best supports, develops, or clarifies the author’s main point.',
    strategy:
      'Say the central idea in plain English, underline the proof, then ask which detail makes the idea stronger.',
  },
  'ELA.9.R.2.3': {
    standardText:
      'Analyze how an author establishes and achieves purpose(s) through rhetorical appeals and/or figurative language.',
    stateGuidance: [
      'Students should name the rhetorical move and explain why that move helps the author achieve a purpose.',
      'FAST score-report guidance asks students to explain rhetorical appeals, rhetorical devices, and figurative language used for purpose.',
      'For classroom use, GOGI should surface short informational excerpts with one visible appeal, device, or figurative choice connected to purpose.',
    ],
    studentsNeedToKnow: [
      'Logos: facts, examples, calculations, or reasoning used to persuade the reader.',
      'Ethos: credibility, authority, fairness, or trust-building language.',
      'Pathos: emotional language, human impact, fear, hope, urgency, or sympathy.',
      'Rhetorical question or repetition: wording that focuses the reader on the author’s point.',
      'Figurative language in informational text: vivid language or comparison used to make a point clearer or more persuasive.',
      'Purpose fit: students must explain why this rhetorical choice fits this author’s goal, not just label the device.',
    ],
    fastDemand:
      'Students identify a rhetorical appeal, device, or figurative choice and explain how it helps the author establish or achieve purpose.',
    itemShape:
      'Rhetoric-purpose item asking how evidence, emotion, credibility, repetition, question, or figurative language supports the author’s purpose.',
    strategy:
      'Name the rhetorical move, identify the reader effect, then explain how that effect supports the author’s purpose.',
  },
  'ELA.9.R.2.4': {
    standardText:
      'Compare the development of two opposing arguments on the same topic, evaluating the effectiveness and validity of the claims.',
    stateGuidance: [
      'Students must keep two arguments separate before evaluating them.',
      'FAST score-report guidance asks students to compare opposing arguments, record claims, and identify which claims are supported with evidence.',
      'For classroom use, GOGI should surface paired excerpts where each side makes a clear claim about the same issue.',
    ],
    studentsNeedToKnow: [
      'Opposing claims: two authors take different positions on the same topic or problem.',
      'Evidence development: a claim becomes stronger when the author gives specific reasons, examples, facts, or results.',
      'Validity: a claim is more valid when the support is relevant, logical, and enough to prove the point.',
      'Effectiveness: the stronger argument is not always the louder argument; it is the one with better support.',
      'Comparison routine: Passage A claims ___. Passage B claims ___. The better-supported argument is ___ because ___.',
    ],
    fastDemand:
      'Students compare two arguments on the same issue, separate each claim and evidence, and evaluate which claim is better supported.',
    itemShape:
      'Paired-argument item asking students to compare claims, evidence, validity, or effectiveness across two excerpts.',
    strategy:
      'Make a two-column claim map, sort the evidence by side, then judge which argument is better supported.',
  },
  'ELA.9.R.3.1': {
    standardText: 'Explain how figurative language creates mood in text(s).',
    stateGuidance: [
      'Students should explain what figurative or image-heavy language does, not just label the device.',
      'FAST score-report guidance asks students to explain how figurative language contributes to mood and why specific word choices matter.',
      'For classroom use, GOGI should surface short excerpts where a phrase, image, comparison, object, or mood shift is visible enough to prove with exact words.',
    ],
    studentsNeedToKnow: [
      'Metaphor and simile: a comparison connects two unlike things to suggest meaning, mood, or reader understanding.',
      'Personification: a nonhuman thing is given human action or feeling to make the scene feel alive, threatening, lonely, or intense.',
      'Imagery and sensory language: visual, sound, touch, smell, or taste details create atmosphere.',
      'Symbol or object meaning: an image, object, color, animal, or place can suggest a larger idea beyond its literal role.',
      'Mood shift: diction and imagery can create, intensify, or change the feeling of a passage.',
    ],
    fastDemand:
      'Students use exact language to explain how figurative language or imagery creates mood, meaning, or reader effect.',
    itemShape:
      'Figurative-language effect item asking how a phrase, image, comparison, object, or word choice creates mood or meaning.',
    strategy:
      'Translate the image literally, name the mood or idea it creates, then explain the effect in context.',
  },
  'ELA.9.R.3.2': {
    standardText: 'Paraphrase content from grade-level texts.',
    stateGuidance: [
      'Students must preserve the author’s original meaning while putting grade-level language into their own words.',
      'This standard should be embedded into every pull-out because the first classroom routine is always: read, chunk, paraphrase, then analyze.',
    ],
    studentsNeedToKnow: [
      'Break long sentences into smaller meaning chunks.',
      'Keep the same who, what, when, where, why, and how.',
      'Replace difficult wording without changing the author’s meaning.',
      'Do not add an opinion, delete key information, or make the sentence more general than the original.',
    ],
    fastDemand:
      'Students choose or write a restatement that keeps the same meaning as the original grade-level text.',
    itemShape: 'Paraphrase item asking which answer best restates the excerpt without changing meaning.',
    strategy:
      'Chunk the sentence, restate each chunk in plain English, then check that the meaning did not change.',
  },
  'ELA.9.R.3.4': {
    standardText: 'Explain an author’s use of rhetoric in a text.',
    stateGuidance: [
      'Students explain how rhetorical language shapes what the reader believes, feels, or notices.',
      'FAST-style items should ask for effect, not just device labels.',
      'Good classroom excerpts have a pointable rhetorical move and a clear reader effect or purpose.',
    ],
    studentsNeedToKnow: [
      'Rhetorical questions push the reader toward a point without directly stating it.',
      'Repetition and parallel structure emphasize ideas and make them memorable.',
      'Appeals to emotion, credibility, or logic shape the reader’s response.',
      'Word choice can make an issue feel urgent, honorable, unfair, dangerous, or necessary.',
      'Strong answers connect the rhetorical move to author purpose or reader effect.',
    ],
    fastDemand:
      'Students explain how rhetoric affects reader belief, feeling, focus, or understanding.',
    itemShape:
      'Rhetoric-effect item asking how a question, repetition, appeal, or word choice affects the reader or supports purpose.',
    strategy:
      'Name the rhetorical move, name what it makes the reader think or feel, then connect that effect to purpose.',
  },
  'ELA.9.V.1.1': {
    standardText: 'Integrate academic vocabulary appropriate to grade level in speaking and writing.',
    stateGuidance: [
      'Official clarification: students apply learned vocabulary to authentic speaking and writing tasks independently.',
      'Official clarification: vocabulary use should be intentional and go beyond responding to a prompt to use a word in a sentence.',
      'Grade-level academic vocabulary includes words likely to appear across subjects, vital to comprehension, and important for academic discussion and writing.',
    ],
    studentsNeedToKnow: [
      'Use context to understand a transferable academic word.',
      'Use academic words correctly in speaking and writing, not just on isolated vocabulary questions.',
      'Choose precise academic language that fits the meaning and tone of the sentence.',
      'Recognize related word forms and use the correct form for the task.',
    ],
    fastDemand:
      'Students use and interpret grade-level academic vocabulary with precision in real reading, speaking, and writing contexts.',
    itemShape:
      'Vocabulary-in-context or usage item asking which academic word, meaning, or form best fits the context.',
    strategy:
      'Read the sentence around the word, test the meaning in context, then use the word precisely in an academic response.',
  },
  'ELA.9.V.1.2': {
    standardText:
      'Apply knowledge of etymology and derivations to determine meanings of words and phrases in grade-level content.',
    stateGuidance: [
      'Etymology means studying word origins and how words have changed over time.',
      'Derivation means making new words from existing words by adding affixes.',
    ],
    studentsNeedToKnow: [
      'Break a word into prefix, root/base, and suffix when useful.',
      'Use origin or related-word clues to determine meaning.',
      'Confirm the word-part meaning with the sentence context.',
    ],
    fastDemand:
      'Students determine word or phrase meaning by using etymology, derivations, and context together.',
    itemShape:
      'Word-part item asking how a root, prefix, suffix, derivation, or origin helps determine meaning.',
    strategy:
      'Split the word into meaningful parts, define the parts, then reread the sentence to confirm the meaning.',
  },
  'ELA.9.V.1.3': {
    standardText:
      'Apply knowledge of context clues, figurative language, word relationships, reference materials, and/or background knowledge to determine the connotative and denotative meaning of words and phrases, appropriate to grade level.',
    stateGuidance: [
      'Students should determine both denotative meaning and connotative meaning when the context requires it.',
      'Review of words learned through context is important for building background knowledge and related vocabulary.',
      'This standard connects to figurative language, context clues, word relationships, and reference-material use.',
    ],
    studentsNeedToKnow: [
      'Use nearby clues before guessing a word meaning.',
      'Separate denotation from connotation when answer choices are close.',
      'Use word relationships, figurative language, reference materials, or background knowledge when context alone is not enough.',
      'Choose the meaning that fits this sentence, not just a familiar synonym.',
    ],
    fastDemand:
      'Students determine the precise meaning of a word or phrase in context, including connotation and denotation.',
    itemShape:
      'Vocabulary-in-context item asking which meaning, connotation, or phrase interpretation best fits the passage.',
    strategy:
      'Replace the word with each answer choice, reread the sentence, and keep the meaning that fits the context and tone.',
  },
};

const FAST_GRADE9_ASSESSMENT_WEIGHTS: Record<
  string,
  {
    category: string;
    percentOfTest: string;
    priority: 'highest' | 'high' | 'supporting';
    note: string;
  }
> = {
  'ELA.9.R.1.1': {
    category: 'Reading Prose and Poetry',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.1.2, R.1.3, and R.1.4.',
  },
  'ELA.9.R.1.2': {
    category: 'Reading Prose and Poetry',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.1.1, R.1.3, and R.1.4.',
  },
  'ELA.9.R.1.3': {
    category: 'Reading Prose and Poetry',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.1.1, R.1.2, and R.1.4.',
  },
  'ELA.9.R.1.4': {
    category: 'Reading Prose and Poetry',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.1.1, R.1.2, and R.1.3.',
  },
  'ELA.9.R.2.1': {
    category: 'Reading Informational Text',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.2.2, R.2.3, and R.2.4.',
  },
  'ELA.9.R.2.2': {
    category: 'Reading Informational Text',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.2.1, R.2.3, and R.2.4.',
  },
  'ELA.9.R.2.3': {
    category: 'Reading Informational Text',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.2.1, R.2.2, and R.2.4.',
  },
  'ELA.9.R.2.4': {
    category: 'Reading Informational Text',
    percentOfTest: '25-35%',
    priority: 'high',
    note: 'Shares this reporting-category weight with R.2.1, R.2.2, and R.2.3.',
  },
  'ELA.9.R.3.1': {
    category: 'Reading Across Genres & Vocabulary',
    percentOfTest: '35-50%',
    priority: 'highest',
    note: 'This is the largest Grade 9 ELA Reading reporting category.',
  },
  'ELA.9.R.3.3': {
    category: 'Reading Across Genres & Vocabulary',
    percentOfTest: '35-50%',
    priority: 'highest',
    note: 'This is the largest Grade 9 ELA Reading reporting category.',
  },
  'ELA.9.R.3.4': {
    category: 'Reading Across Genres & Vocabulary',
    percentOfTest: '35-50%',
    priority: 'highest',
    note: 'This is the largest Grade 9 ELA Reading reporting category.',
  },
  'ELA.9.V.1.2': {
    category: 'Reading Across Genres & Vocabulary',
    percentOfTest: '35-50%',
    priority: 'highest',
    note: 'This is the largest Grade 9 ELA Reading reporting category.',
  },
  'ELA.9.V.1.3': {
    category: 'Reading Across Genres & Vocabulary',
    percentOfTest: '35-50%',
    priority: 'highest',
    note: 'This is the largest Grade 9 ELA Reading reporting category.',
  },
  'ELA.9.R.3.2': {
    category: 'Writing blueprint / embedded reading routine',
    percentOfTest: 'Not a standalone ELA Reading category %',
    priority: 'supporting',
    note: 'Paraphrasing is listed in the Grade 9 Writing benchmark coverage and should be embedded in every reading pull-out.',
  },
  'ELA.9.V.1.1': {
    category: 'Writing blueprint / academic vocabulary',
    percentOfTest: 'Not a standalone ELA Reading category %',
    priority: 'supporting',
    note: 'Academic vocabulary appears in the Grade 9 Writing benchmark coverage and supports written/oral academic responses.',
  },
};

const DEFAULT_ASSESSMENT_WEIGHT = {
  category: 'Florida B.E.S.T. support standard',
  percentOfTest: 'Not separately published',
  priority: 'supporting' as const,
  note: 'Use this standard as support unless a student report or lesson goal makes it the priority.',
};

function getStandardGuidance(
  standardCode: string,
  moves: ReadonlyArray<(typeof ELA9_READING_SKILL_MOVES)[number]>
): StandardGuidance {
  const fastDemand = FAST_GRADE9_READING_DEMANDS.find(
    (demand) => demand.standardCode === standardCode
  );
  const mappedGuidance = STANDARD_GUIDANCE[standardCode];

  return {
    standardText:
      mappedGuidance?.standardText ??
      fastDemand?.standardText ??
      'Official Florida B.E.S.T. benchmark.',
    stateGuidance:
      mappedGuidance?.stateGuidance ??
      getFastAldGuidanceForStandard(standardCode).map(
        (guidance) => `${guidance.question} ${guidance.content_use}`
      ),
    studentsNeedToKnow:
      mappedGuidance?.studentsNeedToKnow ??
      moves.map((move) => `${move.label}: ${move.masterySignal}`),
    fastDemand:
      mappedGuidance?.fastDemand ??
      fastDemand?.fastDemand ??
      getFastAldGuidanceForStandard(standardCode)[0]?.content_use ??
      'Students use evidence from the text to explain the reading skill.',
    itemShape:
      mappedGuidance?.itemShape ??
      fastDemand?.itemShape ??
      'FAST-style evidence item.',
    strategy:
      mappedGuidance?.strategy ??
      fastDemand?.studentMove ??
      moves[0]?.studentMove ??
      'Use exact evidence, explain what it means, then connect it to the standard.',
  };
}

export function getTeacherStandardGuidance(standardCode: string): StandardGuidance {
  const moves = ELA9_READING_SKILL_MOVES.filter((move) => move.standardCode === standardCode);
  return getStandardGuidance(standardCode, moves);
}

export function getTeacherAssessmentWeight(standardCode: string) {
  return FAST_GRADE9_ASSESSMENT_WEIGHTS[standardCode] ?? DEFAULT_ASSESSMENT_WEIGHT;
}

export function getTeacherStandardLabel(standardCode: string) {
  return STANDARD_LABELS[standardCode] ?? 'Official benchmark';
}

function cleanText(value: string) {
  return value
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])¬\s+([a-z])/g, '$1$2')
    .replace(/\[\s*no\s*\]/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphize(text: string) {
  return cleanText(text)
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean).length;
      if (words < 55 || words > 220) return false;
      if (damagedSourceSignalCount(paragraph) >= 3) return false;
      if (/project gutenberg|copyright|produced by|transcriber|chapter [ivxlcdm0-9]+$/i.test(paragraph)) {
        return false;
      }
      return /[.!?]$/.test(paragraph);
    });
}

function paragraphizeFigurative(text: string) {
  return cleanText(text)
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean).length;
      if (words < 30 || words > 220) return false;
      if (damagedSourceSignalCount(paragraph) >= 3) return false;
      if (/project gutenberg|copyright|produced by|transcriber|chapter [ivxlcdm0-9]+$/i.test(paragraph)) {
        return false;
      }
      return /[.!?]$/.test(paragraph);
    });
}

function figurativeWindows(text: string, signals: RegExp[]) {
  const windows = paragraphizeFigurative(text);
  const lines = cleanText(text)
    .split(/\n/g)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^_?S[’']io credesse\b/i.test(line))
    .filter((line) => !/project gutenberg|copyright|produced by|transcriber/i.test(line));

  lines.forEach((line, index) => {
    if (!signals.some((pattern) => pattern.test(line))) return;
    for (const radius of [3, 4, 5, 6]) {
      const start = Math.max(0, index - radius);
      const end = Math.min(lines.length, index + radius + 1);
      const window = lines.slice(start, end).join(' ').replace(/\s+/g, ' ').trim();
      const words = wordCount(window);
      if (words < 30 || words > 180) continue;
      if (/\.\.\.\.\.|_{3,}|\[[^\]]{0,20}\]/.test(window)) continue;
      if (damagedSourceSignalCount(window) >= 3) continue;
      if (!signals.some((pattern) => pattern.test(window))) continue;
      windows.push(window);
      break;
    }
  });

  return Array.from(new Set(windows));
}

function paragraphizeRhetoric(text: string) {
  return cleanText(text)
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean).length;
      if (words < 45 || words > 430) return false;
      if (damagedSourceSignalCount(paragraph) >= 3) return false;
      if (/project gutenberg|copyright|produced by|transcriber|chapter [ivxlcdm0-9]+$/i.test(paragraph)) {
        return false;
      }
      return /[.!?]$/.test(paragraph);
    });
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function archaicSignalCount(text: string) {
  return countMatches(text.toLowerCase(), [
    /\bthou\b/,
    /\bthy\b/,
    /\bthee\b/,
    /\bhath\b/,
    /\bdoth\b/,
    /\bdost\b/,
    /\bart\b/,
    /\bwert\b/,
    /\bJove\b/i,
    /\bSaturnia\b/i,
    /\bGrecian\b/i,
    /\bPelides\b/i,
    /\bthine\b/i,
    /\bbrass-prowed\b/i,
    /\bth['’]\b/i,
    /\bo['’]er\b/i,
    /\b\w+['’]d\b/i,
    /\bdesign['’]d\b/i,
    /\block['’]d\b/i,
  ]);
}

function damagedSourceSignalCount(text: string) {
  const ellipsisRuns = text.match(/\.{4,}/g)?.length ?? 0;
  const bracketedGaps = text.match(/\[[^\]]{0,45}\]/g)?.length ?? 0;
  const unknownMarkers = text.match(/\(\?\)|\[\s*(?:until|to|alone|in|the|gish)[^\]]*\]/gi)?.length ?? 0;
  return ellipsisRuns + bracketedGaps + unknownMarkers;
}

function isEpicCommentaryOrApparatus(text: string) {
  return /\b(?:translator|translation|criticism|published|copyright|tablet|fragment|preface|introduction|footnote|editor|rendered|version|poem is|Homer(?:'s)? diction|Virgil(?:'s)? style|H\.-So\.|Heyne|Socin|glossary|emendation)\b/i.test(
    text
  ) ||
    /(?:^|[\s([{])[_~]/.test(text) ||
    /\b(?:Thetis brings|Agamemnon and Achilles are|The presents are conveyed|his appearance described|Jupiter, calling a council|The different actions and death|The Trojans, after|Achilles is with great difficulty persuaded)\b/i.test(
      text
    ) ||
    /\b(?:Ajax and Achilles heard the sound|In sixty sail the Arcadian bands|With those which|sent three hundred men|These march[’']d|commands, Of|bands unite|from the Lycian shore)\b/i.test(
      text
    );
}

const R11_SETTING_PLACE_PATTERNS = [
  /\bwoods?\b/i,
  /\bforest\b/i,
  /\bmountain\b/i,
  /\bvalley\b/i,
  /\bswamp\b/i,
  /\bhouse\b/i,
  /\bfarm\b/i,
  /\bfield\b/i,
  /\bsea\b/i,
  /\bshore\b/i,
  /\broad\b/i,
  /\bnight\b/i,
  /\bmorning\b/i,
  /\bdoor\b/i,
  /\bwindow\b/i,
  /\bsky\b/i,
  /\bclouds?\b/i,
  /\bstorm\b/i,
  /\bhills?\b/i,
];

const R11_SETTING_EFFECT_PATTERNS = [
  /\bsavage\b/i,
  /\bwild\b/i,
  /\blonely\b/i,
  /\bdark\b/i,
  /\bdread\b/i,
  /\bdreadful\b/i,
  /\bshadow/i,
  /\bbright\b/i,
  /\bsilent\b/i,
  /\bcold\b/i,
  /\bstorm\b/i,
  /\bstrange\b/i,
  /\bterrible\b/i,
  /\bopen\b/i,
  /\bpoor\b/i,
  /\bwretched\b/i,
  /\bshivering\b/i,
  /\bcold\b/i,
  /\bstarvation\b/i,
  /\bmiserable\b/i,
];

const R11_PLOT_CONFLICT_PATTERNS = [
  /\bserpent\b/i,
  /\bpython\b/i,
  /\bmonster\b/i,
  /\bbeast\b/i,
  /\bdanger\b/i,
  /\bdevoured\b/i,
  /\bseized\b/i,
  /\bcharged\b/i,
  /\bcut the chain\b/i,
  /\bturned into stone\b/i,
  /\broaring\b/i,
  /\bfight\b/i,
  /\bbattle\b/i,
  /\bchoice\b/i,
  /\bconsequence\b/i,
  /\bproblem\b/i,
  /\bthreat\b/i,
  /\bfeared\b/i,
  /\bhid behind\b/i,
  /\bopened his wide jaws\b/i,
  /\btearing up the ground\b/i,
  /\bsharp claws\b/i,
  /\bstruck it in the neck\b/i,
  /\bblack blood\b/i,
  /\bthrew a heavy quoit\b/i,
  /\bsank upon the ground\b/i,
  /\bmet his death\b/i,
  /\btore him in pieces\b/i,
  /\bovertaken and killed\b/i,
  /\bperseus\b/i,
  /\bapollo\b/i,
];

const R11_CHARACTERIZATION_PATTERNS = [
  /\banswered\b/i,
  /\bsaid\b/i,
  /\bspoke\b/i,
  /\bcried\b/i,
  /\blooked\b/i,
  /\bseized\b/i,
  /\btrembling\b/i,
  /\bshrieked\b/i,
  /\bmercy\b/i,
  /\bnever show his face\b/i,
  /\bspoken so rashly\b/i,
  /\bfeel sorry\b/i,
  /\bafraid\b/i,
  /\bwept\b/i,
  /\bnoble\b/i,
  /\bwise\b/i,
  /\bface\b/i,
  /\beyes\b/i,
  /\bheart\b/i,
  /\bknife\b/i,
  /\bresolution\b/i,
  /\bI agree\b/i,
  /\bmust lie upon it\b/i,
  /\bstood over him\b/i,
  /\bgive me some present counsel\b/i,
  /\bI long to die\b/i,
  /\bGraze where you will\b/i,
  /\bhang, beg, starve, die\b/i,
  /\bI do not use to jest\b/i,
  /\bsharp eyes and quick ears\b/i,
  /\bdodged aside so quickly\b/i,
  /\bseized the fellow's legs\b/i,
  /\btripped him up\b/i,
];

const R11_CHARACTERIZATION_GIVEAWAY_PATTERNS = [
  /\bin reality\b/i,
  /\bplotting against\b/i,
  /\bwas really a\b/i,
  /\bgreat coward\b/i,
  /\bkind-hearted man\b/i,
  /\bwas ashamed and afraid\b/i,
  /\bwas very kind to him\b/i,
];

const R11_POINT_OF_VIEW_PATTERNS = [
  /\bNo, she must keep silence\b/i,
  /\bWhat is it that suddenly forbids her\b/i,
  /\bSylvia cannot speak\b/i,
  /\bshe cannot tell the heron’s secret\b/i,
  /\bDid my heart love till now\b/i,
  /\bI ne[’']er saw true beauty till this night\b/i,
  /\bThou knowest the mask of night is on my face\b/i,
  /\bI am too fond\b/i,
  /\bI should have been more strange\b/i,
  /\bWhat if this mixture do not work at all\b/i,
  /\bI have a faint cold fear\b/i,
  /\bI was for jeering at the Cyclops again\b/i,
  /\bthe men begged and prayed of me\b/i,
  /\bI was moved to tears\b/i,
  /\bI would not let her come near\b/i,
  /\bYester night I saw a flame\b/i,
  /\bas though she hated them\b/i,
  /\bI\b/,
  /\bwe\b/i,
  /\bmy\b/i,
  /\bour\b/i,
  /\bme\b/i,
  /\bremembered\b/i,
  /\bI saw\b/i,
  /\bI heard\b/i,
  /\bI thought\b/i,
  /\bmy heart\b/i,
  /\bI turned\b/i,
  /\bI went\b/i,
  /\bI divided\b/i,
  /\bI took command\b/i,
  /\bI was moved to tears\b/i,
  /\bI would not let\b/i,
  /\bI was for jeering\b/i,
  /\bthe men begged\b/i,
  /\bwe found\b/i,
  /\bwe saw\b/i,
  /\bwe had left\b/i,
];

const R11_THEME_TONE_PATTERNS = [
  /\bNo, she must keep silence\b/i,
  /\bshe cannot tell the heron’s secret\b/i,
  /\bnever had she forgotten that morning\b/i,
  /\btoo late it dawned upon her\b/i,
  /\bWhy, then, O brawling love\b/i,
  /\bO loving hate\b/i,
  /\bLove is a smoke\b/i,
  /\btemper(?:ing)? extremities with extreme sweet\b/i,
  /\bold desire doth in his deathbed lie\b/i,
  /\bdeath slow winging to the dark\b/i,
  /\bfriend of life and the foe of death\b/i,
  /\bfilled with grief and rage\b/i,
  /\bwicked uncle, who loved only himself\b/i,
  /\bmountain was no longer savage and wild\b/i,
  /\bvalley was no longer dark and lonely\b/i,
  /\bterror in the joy\b/i,
  /\bforgot everything in the world but joy\b/i,
  /\bpride\b/i,
  /\bshame\b/i,
  /\bmercy\b/i,
  /\bjustice\b/i,
  /\bduty\b/i,
  /\bhonor\b/i,
  /\bfear\b/i,
  /\bdread\b/i,
  /\bhope\b/i,
  /\blove\b/i,
  /\bdeath\b/i,
  /\bgrief\b/i,
  /\brage\b/i,
  /\bdespair\b/i,
  /\btruth\b/i,
  /\bwrong\b/i,
  /\bright\b/i,
];

const R11_STYLE_TECHNIQUE_PATTERNS = [
  /\blike a pale star\b/i,
  /\bas soft as moths\b/i,
  /\bas if she too could go flying away among the clouds\b/i,
  /\blike a great main-mast\b/i,
  /\bold pine must have loved his new dependent\b/i,
  /\bas though it were a heap of dry chaff tossed about by a whirlwind\b/i,
  /\bas if he were on horseback\b/i,
  /\bas though he would swallow[^.?!]*/i,
  /\blike hounds in the chase\b/i,
  /\bLove is a smoke\b/i,
  /\bO brawling love\b/i,
  /\bO loving hate\b/i,
  /\bheavy lightness\b/i,
  /\bcold fire\b/i,
  /\bfire sparkling in lovers’ eyes\b/i,
  /\bsea nourish’d with lovers’ tears\b/i,
  /\bmadness most discreet\b/i,
  /\bchoking gall\b/i,
  /\bpreserving sweet\b/i,
  /\bsavage and wild\b/i,
  /\blonely and dark\b/i,
  /\bas if in dread[^.?!]*/i,
  /\bdark places of the world\b/i,
  /\bbright sunlight\b/i,
  /\bno longer savage and wild\b/i,
  /\bno longer dark and lonely\b/i,
  /\bterrible great wave\b/i,
  /\bseemed to rear itself\b/i,
  /\bfoul weeds\b/i,
  /\bpale light\b/i,
  /\bas in a mirror\b/i,
  /\bsomething which glittered\b/i,
  /\b(?:like|as if|as though|seemed)[^.?!]*[.?!]/i,
];

function passesSubSkillClassroomGate(subSkillId: string | null | undefined, paragraph: string) {
  if (!subSkillId) return true;

  const words = wordCount(paragraph);
  const isEpicSkill = R14_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isThemeSkill = R12_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isPerspectiveSkill = R13_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isStructureSkill = R21_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isCentralIdeaSkill = R22_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isRhetoricSkill = R23_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isParaphraseSkill = R32_SUB_SKILLS.some((skill) => skill.strandId === subSkillId);
  const isFigurativeSkill = ELA9_READING_SKILL_MOVES.some(
    (skill) => skill.standardCode === 'ELA.9.R.3.1' && skill.strandId === subSkillId
  );
  const minWords = isStructureSkill || isCentralIdeaSkill || isRhetoricSkill ? 120 : isParaphraseSkill ? 35 : isFigurativeSkill ? 30 : isEpicSkill || isThemeSkill || isPerspectiveSkill ? 55 : 65;
  const maxWords = isStructureSkill || isCentralIdeaSkill || isRhetoricSkill ? 420 : isParaphraseSkill ? 220 : isEpicSkill || isFigurativeSkill ? 220 : 180;
  if (words < minWords || words > maxWords) return false;
  if (damagedSourceSignalCount(paragraph) >= 2) return false;

  if (isEpicSkill) {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    if (/\.\.\.\.\.|_{3,}|\[[^\]]{0,20}\]/.test(paragraph)) return false;
    if (scoreForSubSkill(subSkillId, paragraph) <= 0) return false;
  }

  if (subSkillId === 'setting-layer') {
    if (archaicSignalCount(paragraph) >= 3) return false;
    if (/\bCHORUS\.|\(Str\.|brass-prowed|Like to thee|My child, like thine\b/i.test(paragraph)) {
      return false;
    }
    if (/\bsea monster was close at hand|opening his wide jaws|turned into stone\b/i.test(paragraph)) {
      return false;
    }
    return (
      countMatches(paragraph, R11_SETTING_PLACE_PATTERNS) >= 1 &&
      countMatches(paragraph, R11_SETTING_EFFECT_PATTERNS) >= 2
    );
  }

  if (subSkillId === 'plot-conflict-layer') {
    if (archaicSignalCount(paragraph) >= 3) return false;
    return countMatches(paragraph, R11_PLOT_CONFLICT_PATTERNS) >= 2;
  }

  // Characterization pull-outs need clean, student-manageable action/speech/thought evidence.
  // Dense archaic verse translations may be official texts, but they are not good first-pass
  // 15-minute R.1.1 characterization reps without heavy teacher context.
  if (subSkillId === 'characterization-layer') {
    if (countMatches(paragraph, R11_CHARACTERIZATION_GIVEAWAY_PATTERNS) > 0) return false;
    const approvedArchaicCharacterMoment =
      /\b(Tell me not, Friar|Do thou but call my resolution wise|God’s bread, it makes me mad|Graze where you will|hang, beg, starve, die)\b/i.test(
        paragraph
      );
    if (archaicSignalCount(paragraph) >= 2 && !approvedArchaicCharacterMoment) return false;
    if (/\bWhile Cadmus was still weeping|Her eyes were gray|helmet on her head and a shield in her hand\b/i.test(paragraph)) {
      return false;
    }
    if (/\bif your work is best|I agree,\s*["”]?\s*said Arachne\b/i.test(paragraph)) {
      return false;
    }
    return countMatches(paragraph, R11_CHARACTERIZATION_PATTERNS) >= 2;
  }

  if (subSkillId === 'point-of-view-layer' && archaicSignalCount(paragraph) >= 3) {
    return false;
  }

  if (subSkillId === 'point-of-view-layer') {
    return countMatches(paragraph, R11_POINT_OF_VIEW_PATTERNS) >= 3;
  }

  if (subSkillId === 'theme-tone-layer') {
    if (archaicSignalCount(paragraph) >= 3) return false;
    if (/\bCHORUS\.|\(Str\.|\(Ant\.|Pythian Phoebus|primeval Night|Phoebus still speak true\b/i.test(paragraph)) {
      return false;
    }
    return countMatches(paragraph, R11_THEME_TONE_PATTERNS) >= 2;
  }

  if (subSkillId === 'style-technique-layer') {
    if (damagedSourceSignalCount(paragraph) >= 1) return false;
    if (archaicSignalCount(paragraph) >= 4) return false;
    return countMatches(paragraph, R11_STYLE_TECHNIQUE_PATTERNS) >= 1;
  }

  if (
    subSkillId === 'metaphor-simile' ||
    subSkillId === 'personification-effect' ||
    subSkillId === 'imagery-sensory-language' ||
    subSkillId === 'symbol-object-meaning' ||
    subSkillId === 'mood-shift-effect'
  ) {
    if (damagedSourceSignalCount(paragraph) >= 1) return false;
    if (/\.\.\.\.\.|_{3,}|\[[^\]]{0,20}\]/.test(paragraph)) return false;
    if (archaicSignalCount(paragraph) >= 4 && !/\bLove is a smoke|bright Orion|sun withdrawn|Muse|wrath\b/i.test(paragraph)) return false;
    if (subSkillId === 'metaphor-simile') {
      return /\b(?:Love is a smoke|patient etheri[sz]ed|like a pale star|as soft as moths|flying away among the clouds|like snowflakes|as if the stem of it were broken|like a hermitage|black sack|black hole)\b/i.test(paragraph);
    }
    if (subSkillId === 'personification-effect') {
      return /\b(?:yellow fog|yellow smoke|rub(?:s|bing) its back|rub(?:s|bing) its muzzle|Licked its tongue|Curled once|fell asleep|tree seemed to lengthen itself|old pine must have loved|night, proceeding on with silent pace|sun withdrawn his radiant light|view[’']d with equal face)\b/i.test(paragraph);
    }
    if (subSkillId === 'imagery-sensory-language') {
      return /\b(?:woods were already filled with shadows|bright green swamp grass|dusky shades of night|yellow fog|yellow smoke|like a pale star|as soft as moths|bewilderingly bright|no light in (?:his|my) eyes|There was light, and now there is darkness|black sack|black hole|In the place of death there was light)\b/i.test(paragraph);
    }
    if (subSkillId === 'symbol-object-meaning') {
      return /\b(?:white heron|heron’s secret|heron's secret|golden apples?|untasted wine|flat and filmy|head of Medusa|turned into stone|black sack|black hole|In the place of death there was light)\b/i.test(paragraph);
    }
    if (subSkillId === 'mood-shift-effect') {
      return /\b(?:terror in the joy|forgot everything in the world but joy|At last the sun came up|no longer savage and wild|no longer dark and lonely|sun withdrawn|no threat[’']?ning tempest|sudden leap|In the place of death there was light|Death is over|There was no terror)\b/i.test(paragraph);
    }
    return scoreForSubSkill(subSkillId, paragraph) > 0;
  }

  if (
    subSkillId === 'chunk-complex-syntax' ||
    subSkillId === 'preserve-original-meaning' ||
    subSkillId === 'translate-archaic-or-formal-language' ||
    subSkillId === 'paraphrase-claim-or-theme'
  ) {
    if (damagedSourceSignalCount(paragraph) >= 1) return false;
    if (/\.\.\.\.\.|_{3,}|\[[^\]]{0,20}\]/.test(paragraph)) return false;
    const hasComplexSentence = sentences(paragraph).some((sentence) => wordCount(sentence) >= 26);
    if (subSkillId === 'chunk-complex-syntax') {
      return (
        hasComplexSentence &&
        countMatches(paragraph, [
          /[,;:—-]/,
          /\b(?:although|because|while|when|which|who|that|therefore|however|but|yet|so that|whereas|nevertheless)\b/i,
        ]) >= 2
      );
    }
    if (subSkillId === 'preserve-original-meaning') {
      return countMatches(paragraph, [
        /\b(?:because|therefore|however|although|but|yet|if|when|while|so that|instead|not .* but|rather than)\b/i,
        /\b(?:must|should|cannot|no longer|not|never|only|unless|except|without)\b/i,
      ]) >= 2;
    }
    if (subSkillId === 'translate-archaic-or-formal-language') {
      return (
        archaicSignalCount(paragraph) >= 1 ||
        /\b(?:hath|thou|thee|thy|shall|wherefore|hence|therefore|lest|whence|thus|consequently|publick|honou?r|doth|ne'er|o'er|forc[’']d|view[’']d|ev[’']ry)\b/i.test(
          paragraph
        )
      );
    }
    if (subSkillId === 'paraphrase-claim-or-theme') {
      return countMatches(paragraph, [
        /\b(?:claim|truth|therefore|thus|must|should|means|shows|purpose|motive|idea|answer|question|conclude|believe|I say)\b/i,
        /\b(?:love|death|life|freedom|justice|power|honou?r|duty|fear|hope|truth|equal|publick good|country)\b/i,
      ]) >= 2;
    }
  }

  if (subSkillId === 'in-medias-res') {
    return countMatches(paragraph, [
      /\bwrath|rage|quarrel|strife|battle|war|already|began|after\b/i,
      /\bSing|Muse|Achilles|Agamemnon|arms|council\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'universal-theme') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    if (/\bCHORUS\.|\(Str\.|\(Ant\.|Pausanias|Cicero|Compare Wolf|professed biographies\b/i.test(paragraph)) return false;
    return countMatches(paragraph, [
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bLove is a smoke\b/i,
      /\bDo not swear at all\b/i,
      /\bIt is too rash, too unadvised, too sudden\b/i,
      /\bThe fault, dear Brutus, is not in our stars\b/i,
      /\bAll animals are equal\b/i,
      /\bWho controls the past\b/i,
      /\bpower|freedom|justice|love|loyalty|truth|pride|sacrifice|duty|honou?r|hope\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'theme-development-moments') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    if (/\bCHORUS\.|\(Str\.|\(Ant\.|Pausanias|Cicero|Compare Wolf|professed biographies\b/i.test(paragraph)) return false;
    return countMatches(paragraph, [
      /\bNo, she must keep silence\b/i,
      /\bWhat is it that suddenly forbids her\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bmountain was no longer savage and wild\b/i,
      /\bvalley was no longer dark and lonely\b/i,
      /\bturned into stone\b/i,
      /\bnow|then|at last|no longer|suddenly|until|after|before\b/i,
      /\bchoice|consequence|realized|remembered|changed|learned|understood\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'theme-through-conflict') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    if (
      /\bCHORUS\.|\(Str\.|\(Ant\.|Jupiter, calling a council|subject of a noble episode\b/i.test(paragraph) &&
      !/\bTwo households, both alike in dignity\b/i.test(paragraph)
    ) {
      return false;
    }
    return countMatches(paragraph, [
      /\bTwo households, both alike in dignity\b/i,
      /\bancient grudge break to new mutiny\b/i,
      /\bPython\b/i,
      /\bserpent\b/i,
      /\bsea monster\b/i,
      /\bcut the chain\b/i,
      /\bopening his wide jaws\b/i,
      /\bnever show his face\b/i,
      /\bspoken so rashly\b/i,
      /\bhang, beg, starve, die\b/i,
      /\bconflict|choice|consequence|fear|danger|death|power|pride|suffer|punish|refuse\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'narrator-perspective') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bSylvia(?:'s)?\b/i,
      /\bSylvia’s heart gave a wild beat\b/i,
      /\bshe knew that strange white bird\b/i,
      /\bthe sea which Sylvia wondered and dreamed about\b/i,
      /\bsmall and hopeful Sylvia\b/i,
      /\butmost bravery\b/i,
      /\bknew that higher still\b/i,
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bWondering over and over again\b/i,
      /\bthe guest waked from a dream\b/i,
      /\bHe was sure\b/i,
      /\bAlas for him\b/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bin that terror he remembered\b/i,
      /\bknew|remembered|thought|wondered|seemed|must|cannot\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'irony-reversal-contrast') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bI shall now therefore humbly propose\b/i,
      /\bAlas for him\b/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bThe heat of the sun had melted the wax\b/i,
      /\bnot be liable to the least objection\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\byoung healthy child well nursed\b/i,
      /\bstewed, roasted, baked, or boiled\b/i,
      /\bInfant[’']?s flesh\b/i,
      /\bcollateral advantage\b/i,
      /\blessening the number of Papists\b/i,
      /\bI profess in the sincerity of my heart\b/i,
      /\bnot the least personal interest\b/i,
      /\bno other motive than the publick good\b/i,
      /\bpublick good of my country\b/i,
      /\bgiving some pleasure to the rich\b/i,
      /\bbut|however|instead|yet|although|seemed|sure\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'satire-exaggeration-ridicule') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bI shall now therefore humbly propose\b/i,
      /\bnot be liable to the least objection\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\byoung healthy child well nursed\b/i,
      /\bstewed, roasted, baked, or boiled\b/i,
      /\boffered in sale\b/i,
      /\breserved for breed\b/i,
      /\bInfant[’']?s flesh\b/i,
      /\bfattest child to the market\b/i,
      /\bno other motive than the publick good\b/i,
      /\bcommodity|child|children|infants|poor|publick|advantage|proposal|scheme\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'chronological-sequence') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bfirst|secondly|thirdly|third|fifthly|sixthly|then|after|before|from that time|as early as|twenty years ago|now\b/i,
      /\bsequence|order|step|stage|came|began|continued|finally|at length|tasks lay before me|to show\b/i,
      /\bFor first|Thirdly|Fifthly|Sixthly\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'cause-effect-structure') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bbecause|therefore|consequently|as a result|so that|whereby|for this reason|the result|which cannot|would\b/i,
      /\bcause|effect|result|turn to account|deserve|will|could|prevent|enable|produce\b/i,
      /\band therefore whoever could find out|will be thereby encreased|consequently have their houses frequented|has resulted in sending\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'compare-contrast-structure') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bbut|however|on the contrary|instead of|rather than|not .* but|while|whereas|although|yet\b/i,
      /\bcompare|contrast|unlike|different|same|more than|less than|only|neither|nor\b/i,
      /\bfrom the top downward|not at the top but at the bottom|but I _do_ say|while the Negro teachers\b/i,
      /\bNevertheless, I insist|not to make men carpenters|it is to make carpenters men|it is only fair to point out\b/i,
      /\binstead of being able to work|very far from being confined|more than we allow to sheep|but more plentiful in March\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'problem-solution-structure') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bproblem|grievance|incumbrance|deplorable|melancholy object|poor|beggars|ignorance|proper training\b/i,
      /\bsolution|method|proposal|scheme|remedy|expedient|course may be taken|find out|answer|trained\b/i,
      /\bHow then shall the leaders|There can be but one answer|fair, cheap and easy method\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'example-evidence-structure') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bfor instance|for example|such as|these figures|returns|evidence|illustrate|prove|show|computed|per cent|there are\b/i,
      /\bexample|instance|figures|students|graduates|institutions|number|thousand|pounds|dollars\b/i,
      /\bThese figures illustrate|there are to-day in the United States thirty-four institutions|Of these graduates|returns as to occupations\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'opening-closing-shift') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bI shall now|I profess|but, as to myself|in conclusion|to conclude|if this be true|how then|let us see|the truth of this\b/i,
      /\bThe most interesting question|In earlier years|Nevertheless, I insist\b/i,
      /\bintroduce|conclude|shift|turn|question|answer|purpose|motive|now|then|but\b/i,
      /\bIf this be true--and who can deny it--three tasks lay before me|How then shall the leaders|But, as to myself\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'central-idea-stated-implied') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bI say, therefore|I conclude, therefore|It is necessary, therefore|The wise prince, therefore\b/i,
      /\bcentral|idea|point|truth|question|answer|show|prove|means|purpose\b/i,
      /\btherefore|thus|because|for this reason|in short|in conclusion|the truth\b/i,
      /\bNegro problem|industrial education|publick good|proposal|science|religion|support|development|principality|forces|prince|state\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'strong-vs-weak-evidence' || subSkillId === 'best-evidence-for-claim') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bfor instance|for example|these figures|returns|evidence|illustrate|prove|show|computed|per cent|there are\b/i,
      /\bfirst|secondly|thirdly|therefore|because|so that|whereby|resulted|answer|proposal\b/i,
      /\bgraduates|students|institutions|number|thousand|pounds|dollars|public school|industrial\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'evidence-develops-central-idea') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bdevelop|support|show|prove|illustrate|example|instance|figures|returns|because|therefore|result\b/i,
      /\bcentral|idea|point|claim|truth|question|answer|purpose\b/i,
      /\btraining|education|proposal|advantage|publick good|science|religion|Negro|college\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'detail-vs-central-idea') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bdetail|fact|true|example|instance|figures|number|computed|children|pounds|students|graduates\b/i,
      /\bcentral|idea|point|claim|proposal|question|answer|truth|purpose\b/i,
      /\bbut|however|although|therefore|because|for this reason|instead\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'central-idea-development-across-paragraphs') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    if (!/\n\n/.test(paragraph)) return false;
    return countMatches(paragraph, [
      /\bfirst|secondly|thirdly|therefore|however|but|nevertheless|for instance|these figures|how then|there can be\b/i,
      /\bcentral|idea|point|question|answer|truth|show|prove|support|develop|illustrate\b/i,
      /\beducation|training|proposal|publick good|science|religion|Negro|college|graduates\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'logos-ethos-pathos') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bmust|should|we|our|you|therefore|because|reason|evidence|justice|duty|honou?r|truth|publick good\b/i,
      /\bfeel|fear|hope|suffer|poor|children|poverty|motive|authority|Scripture|expert|figures|honor|honour|work|freedom\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'logos-evidence-reasoning') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\btherefore|because|reason|consequently|computed|calculate|number|figures|per cent|evidence|prove|show\b/i,
      /\bfirst|secondly|thirdly|advantage|proposal|institutions|graduates|returns|occupations|industrial|training|foundation|own forces|secure\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'ethos-credibility-authority') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bI profess|sincerity|motive|publick good|I have no|I have been assured|authority|learned|grave author|Scripture|experience|truth\b/i,
      /\bfair|honest|trust|credible|expert|I grant|I would not deny|nevertheless|Huntington|Douglass|public address|I do not mean|I would set no limits\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'pathos-emotional-appeal') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bmelancholy object|beggars|children|rags|alms|poor|starving|suffering|grievance|deplorable|cruel|danger\b/i,
      /\bfeel|fear|hope|sympathy|misery|wretched|burthen|helpless|distress|degradation|curse of slavery|honou?r|brothers|blood\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'rhetorical-question-repetition') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return (
      /\?/.test(paragraph) ||
      countMatches(paragraph, [
        /\bHow then shall\b/i,
        /\bWas the work\b/i,
        /\bThe most interesting question\b/i,
        /\bIt has been necessary\b/i,
        /\bHe that\b/i,
        /\bThis day\b/i,
        /\bCrispian\b/i,
        /\bfirst\b.*\bsecondly\b|\bsecondly\b.*\bthirdly\b/i,
        /\bI shall now|I do therefore|I think the advantages\b/i,
      ]) >= 1
    );
  }

  if (subSkillId === 'figurative-language-purpose') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bmelancholy object|fabric of science|living oracles|mysteries|book of nature|light|dark|foundation|edifice\b/i,
      /\blike|as if|as though|metaphor|figurative|image|vivid|picture|raging rivers|band of brothers|household words|barbarous dominion\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'purpose-fit-rhetorical-choice') {
    if (isEpicCommentaryOrApparatus(paragraph)) return false;
    return countMatches(paragraph, [
      /\bpurpose|motive|publick good|therefore|because|so that|question|answer|proposal|advantage|must|should\b/i,
      /\breader|persuade|convince|appeal|reason|evidence|emotion|trust|figures|truth|freeman|learn to work|honou?r|opportunity|liberator|raging rivers|fortune\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'divine-intervention') {
    return countMatches(paragraph, [
      /\bgod|goddess|Minerva|Jove|Jupiter|Apollo|heaven|divine|fate|prayer|prophecy|miraculously\b/i,
      /\bheard|sent|descends|command|order|strengthen|help|intervened\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'epic-hero-traits') {
    return countMatches(paragraph, [
      /\bhero|brave|courage|honou?r|glory|battle|spear|king|pride|endure|rushes|refuses|lamentations\b/i,
      /\bAchilles|Ulysses|Odysseus|Aeneas|Beowulf|Hector|Telemachus\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'quest-journey-structure') {
    return isStrongQuestExcerpt(paragraph);
  }

  if (subSkillId === 'ritual-speech-oath') {
    const formalAct =
      /\b(?:prayer|offering|drink offerings|wine|feast|sacrifice|altar|oath|vow|hospitality|guest|burial|rites|spare my life|clasp[’']d the hero[’']s knees)\b/i.test(
        paragraph
      );
    const ritualAction = /\b(?:said|spoke|answered|speech|prayed|mixed|served|sacrificed|offering|rites)\b/i.test(
      paragraph
    );
    return formalAct && ritualAction;
  }

  if (subSkillId === 'theme-through-heroic-action') {
    return countMatches(paragraph, [
      /\bhonou?r|fate|loyalty|home|death|glory|choice|battle|courage|friend|sacrifice|duty|revenge\b/i,
      /\bhero|Achilles|Ulysses|Odysseus|Aeneas|Beowulf|Hector|rushes|refuses|endure\b/i,
    ]) >= 2;
  }

  if (subSkillId === 'elevated-style-epic-simile') {
    return countMatches(paragraph, [
      /\blike|as when|so .* as|Sing|Muse|wrath|arms|heaven|glory|radiant|burnish|nocturnal|steepy\b/i,
      /\bepithet|daughter of|son of|Aegis-bearing|rosy-fingered|wine-dark\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'universal-theme') {
    return true;
  }

  if (subSkillId === 'theme-development-moments') {
    return countMatches(paragraph, [
      /\b(?:no longer|suddenly|at last|then|now|until|after|before)\b/i,
      /\b(?:choice|secret|changed|realized|remembered|consequence|turned|forbids|cannot)\b/i,
    ]) >= 1;
  }

  if (subSkillId === 'theme-through-conflict') {
    return countMatches(paragraph, [
      /\b(?:conflict|danger|death|fear|fight|monster|serpent|Python|beast|power|punish|refuse|consequence)\b/i,
      /\b(?:choice|must|cannot|cut the chain|opening his wide jaws|hang, beg, starve, die|never show his face)\b/i,
    ]) >= 1;
  }

  return true;
}

function isStrongQuestExcerpt(paragraph: string) {
  return /\b(Tell me, O Muse|travelled far and wide|bring his men safely home|detained by the goddess Calypso|go back to Ithaca|got to the land[^.?!]*great cave|got from under the ram|drive them down to the ship|left the Trojan shore|Long labours, both by sea and land|Trojans reign in Italy|happy course|Grecian navy burn|Tack to the larboard|stand off to sea|Veer starboard sea and land|Latian shore|Italian shore|Forsake the pleasing shore|plow the deep)\b/i.test(
    paragraph
  );
}

function scoreParagraph(standard: string, paragraph: string) {
  const text = paragraph.toLowerCase();
  const hasQuote = /["“”]/.test(paragraph) ? 1 : 0;
  const vivid = countMatches(text, [
    /\bseemed\b/,
    /\bas if\b/,
    /\blike\b/,
    /\bas though\b/,
    /\bdark|bright|cold|warm|silence|voice|eyes|face|hand|heart\b/,
  ]);

  const rules: Record<string, RegExp[]> = {
    'ELA.9.R.1.1': [
      /\blooked|saw|heard|felt|turned|stood|walked|spoke|answered\b/,
      /\bconflict|fear|hope|anger|pride|shame|choice|change|power\b/,
      /\broom|house|field|sea|road|night|morning|door|window\b/,
    ],
    'ELA.9.R.1.2': [
      /\btruth|justice|freedom|power|love|death|life|duty|honor|pride|equal|hope\b/,
      /\blearned|realized|understood|believed|remembered\b/,
    ],
    'ELA.9.R.1.3': [
      /\birony|absurd|foolish|pretend|seemed|supposed|but|however|alas|humbly|proposal\b/,
      /\bsaid|thought|believed|knew|remembered|must|cannot|profess|assured\b/,
    ],
    'ELA.9.R.1.4': [
      /\bgod|goddess|jove|minerva|apollo|muse|fate|prayer|hero|spear|ship|battle|king\b/,
      /\bjourney|home|honor|glory|wrath|divine\b/,
    ],
    'ELA.9.R.2.1': [/\bfirst|second|finally|because|therefore|however|although|problem|solution\b/],
    'ELA.9.R.2.2': [/\bclaim|idea|reason|evidence|because|therefore|example|support|shows|means\b/],
    'ELA.9.R.2.3': [/\bmust|should|we|you|our|appeal|reason|believe|duty|justice|honor\b/],
    'ELA.9.R.2.4': [/\bhowever|although|but|opposing|on the other hand|claim|argument\b/],
    'ELA.9.R.3.1': [/\blike|as if|as though|seemed|dark|cold|bright|shadow|silence|voice|heart\b/],
    'ELA.9.R.3.2': [/[a-z]/],
    'ELA.9.R.3.3': [/\bgod|myth|hero|king|queen|fate|source|story|old|ancient\b/],
    'ELA.9.R.3.4': [/\bwe|you|our|must|shall|should|why|how|therefore|justice|freedom|duty\b/],
  };

  return countMatches(text, rules[standard] ?? []) * 12 + vivid * 4 + hasQuote * 6;
}

function scoreForSubSkill(subSkillId: string | null | undefined, paragraph: string) {
  if (!subSkillId) return 0;
  const text = paragraph.toLowerCase();
  const rules: Record<string, RegExp[]> = {
    'setting-layer': [
      /\bsavage|wild|lonely|dark|dread|shadow|bright|silent|cold|storm|strange|terrible\b/i,
      /\bwoods?|forest|mountain|valley|swamp|house|farm|field|sea|shore|road|night|morning|door|window|sky|clouds?|hills?\b/i,
    ],
    'plot-conflict-layer': [
      /\bserpent|python|monster|beast|danger|devoured|seized|charged|conflict|battle|fight|choice|changed|turned|consequence|problem|threat|feared|dead|death|killed\b/i,
      /\bcut the chain|opened his wide jaws|turned into stone|hid behind|tearing up the ground|roaring|lashing the water|sharp claws|struck it in the neck|threw a heavy quoit|tore him in pieces|overtaken and killed\b/i,
    ],
    'characterization-layer': [
      /\bsaid|answered|looked|voice|face|eyes|hand|heart|thought|felt|spoke|cried|seized|wept|trembled|afraid|ashamed|kind|coward|noble|wise|plotting\b/i,
      /\bquiet her|never show his face|spoken so rashly|feel sorry|looked him straight in the eye|cried for mercy\b/i,
    ],
    'point-of-view-layer': [
      /\bI\b|\bwe\b|\bmy\b|\bour\b|\bme\b/i,
      /\bNo, she must keep silence|Sylvia cannot speak|heron’s secret|Did my heart love till now|I ne[’']er saw true beauty|mask of night is on my face|I am too fond|I should have been more strange|faint cold fear|What if this mixture|I was moved to tears|I would not let|I was for jeering|the men begged|Yester night I saw a flame|as though she hated them\b/i,
      /\bremembered|saw|heard|thought|understood|seemed to|felt that|my heart|I divided|I took command\b/i,
    ],
    'theme-tone-layer': R11_THEME_TONE_PATTERNS,
    'style-technique-layer': R11_STYLE_TECHNIQUE_PATTERNS,
  'universal-theme': [/\btruth|justice|freedom|power|love|death|life|duty|honor|pride|hope\b/i],
    'theme-development-moments': [/\blearned|realized|understood|believed|remembered|truth|choice|consequence|changed|no longer|at last\b/i],
    'theme-through-conflict': [
      /\bconflict|choice|consequence|fear|duty|honor|pride|death|power|danger|suffer|sacrifice|punish|refuse\b/i,
      /\bPython|serpent|sea monster|wide jaws|cut the chain|fled|save me|hang, beg, starve, die\b/i,
    ],
    'narrator-perspective': [
      /\bnarrator|speaker|perspective|thought|knew|remembered|seemed|must|cannot|does not speak|silence\b/i,
      /\bSylvia|Icarus|Daedalus|heron|secret\b/i,
      /\bSylvia’s heart gave a wild beat|strange white bird|wondered and dreamed about|small and hopeful Sylvia|utmost bravery|knew that higher still\b/i,
    ],
    'irony-reversal-contrast': [
      /\birony|absurd|foolish|pretend|seemed|supposed|but|however|yet|alas|instead|least objection\b/i,
      /\breader understands|unexpected|reversal|contrast|serious\b/i,
      /\bhumbly propose|delicious nourishing and wholesome food|collateral advantage|lessening the number of Papists|publick good\b/i,
    ],
    'satire-exaggeration-ridicule': [
      /\bproposal|humbly|assured|commodity|delicious|wholesome|advantage|publick good|least personal interest\b/i,
      /\bchild|children|infants|poor|beggars|flesh|market|breed|sale\b/i,
    ],
    'in-medias-res': [/\balready|began|begin|first|after|middle|wrath|arms|sing|muse|escaped death|detained|fate|exil|ruin\b/i],
    'divine-intervention': [/\bgod|goddess|jove|minerva|apollo|muse|fate|prayer|divine|heaven\b/i],
    'epic-hero-traits': [/\bhero|brave|courage|honor|glory|battle|spear|ship|king|pride|endure\b/i],
    'quest-journey-structure': [/\bjourney|home|ship|sailed|road|wander|return|obstacle|island|sea\b/i],
    'ritual-speech-oath': [/\bprayer|offering|feast|oath|speech|said|spoke|wine|sacrifice|altar\b/i],
    'theme-through-heroic-action': [/\bhonor|fate|loyalty|home|death|glory|choice|battle|action|courage\b/i],
    'elevated-style-epic-simile': [/\blike|as when|so .* as|muse|sing|wrath|arms|heaven|glory\b/i],
    'chronological-sequence': [
      /\bfirst|secondly|thirdly|third|fifthly|sixthly|then|after|before|from that time|as early as|twenty years ago|now\b/i,
      /\bcame|began|continued|at length|finally|from that time till to-day\b/i,
    ],
    'cause-effect-structure': [
      /\bbecause|therefore|consequently|so that|whereby|for this reason|as a result|which cannot|would\b/i,
      /\bwill prevent|will circulate|would deserve|will be thereby|cannot turn to account|resulted in\b/i,
    ],
    'compare-contrast-structure': [
      /\bbut|however|on the contrary|instead of|rather than|not .* but|while|whereas|although|yet\b/i,
      /\bcompared|contrast|different|same|more than|less than|only|neither|nor\b/i,
    ],
    'problem-solution-structure': [
      /\bmelancholy object|great additional grievance|deplorable state|poor people|ignorance|proper training|Negro problem\b/i,
      /\bfair, cheap and easy method|proposal|scheme|remedy|expedient|answer|trained|education\b/i,
    ],
    'example-evidence-structure': [
      /\bfor instance|for example|these figures|returns|evidence|illustrate|prove|computed|per cent|there are|thirty-four institutions\b/i,
      /\bgraduates|students|figures|number|thousand|pounds|dollars|institutions\b/i,
    ],
    'opening-closing-shift': [
      /\bI shall now|I profess|But, as to myself|If this be true|How then|Let us see|The truth of this\b/i,
      /\bquestion|answer|motive|purpose|introduce|conclude|shift\b/i,
    ],
    'strong-vs-weak-evidence': [/\bclaim|idea|reason|evidence|because|therefore|example|support|shows|means\b/i],
    'central-idea-stated-implied': [
      /\bcentral|idea|point|truth|question|answer|show|prove|purpose|proposal|support\b/i,
      /\btherefore|thus|because|for this reason|in conclusion|the truth of this\b/i,
    ],
    'evidence-develops-central-idea': [
      /\bdevelop|support|show|prove|illustrate|example|instance|figures|returns|because|therefore\b/i,
      /\bcentral|idea|point|claim|purpose|answer|truth\b/i,
    ],
    'best-evidence-for-claim': [
      /\bclaim|point|proposal|answer|truth|support|prove|evidence|strongest|best\b/i,
      /\bfor instance|these figures|returns|computed|there are|because|therefore\b/i,
    ],
    'detail-vs-central-idea': [
      /\bdetail|fact|true|example|instance|figures|number|computed|children|students|graduates\b/i,
      /\bcentral|idea|point|claim|proposal|question|answer|truth|purpose\b/i,
    ],
    'central-idea-development-across-paragraphs': [
      /\bfirst|secondly|thirdly|therefore|however|but|nevertheless|for instance|these figures|how then|there can be\b/i,
      /\bcentral|idea|point|question|answer|truth|show|prove|support|develop|illustrate\b/i,
    ],
    'logos-ethos-pathos': [
      /\bmust|should|we|you|our|appeal|reason|believe|duty|justice|honou?r|feel|publick good|work|freedom|brothers\b/i,
    ],
    'logos-evidence-reasoning': [
      /\btherefore|because|reason|consequently|computed|calculate|number|figures|per cent|evidence|prove|show\b/i,
      /\bfirst|secondly|thirdly|advantage|proposal|institutions|graduates|returns|occupations|industrial|training|foundation|own forces|secure\b/i,
    ],
    'ethos-credibility-authority': [
      /\bI profess|sincerity|motive|publick good|I have no|I have been assured|we are told|authority|grave author|Scripture|experience|truth|wise men|opinion and judgment\b/i,
      /\bfair|honest|trust|credible|expert|merchants|worthy person|Huntington|Douglass|public address|I do not mean|I would set no limits|many have written\b/i,
    ],
    'pathos-emotional-appeal': [
      /\bmelancholy object|beggars|children|rags|alms|poor|starving|suffering|grievance|deplorable|cruel|danger\b/i,
      /\bfeel|fear|hope|sympathy|misery|wretched|burthen|helpless|distress|degradation|curse of slavery|honou?r|brothers|blood\b/i,
    ],
    'rhetorical-question-repetition': [
      /\?|How then shall|Was the work|The most interesting question|first|secondly|thirdly|I shall now|I do therefore|It has been necessary|He that|This day|Crispian\b/i,
    ],
    'figurative-language-purpose': [
      /\bmelancholy object|fabric of science|living oracles|mysteries|book of nature|light|dark|foundation|edifice\b/i,
      /\blike|as if|as though|metaphor|figurative|image|vivid|picture|raging rivers|band of brothers|household words|barbarous dominion\b/i,
    ],
    'purpose-fit-rhetorical-choice': [
      /\bpurpose|motive|publick good|therefore|because|so that|question|answer|proposal|advantage|must|should\b/i,
      /\breader|persuade|convince|appeal|reason|evidence|emotion|trust|figures|truth|freeman|learn to work|honou?r|opportunity|liberator|raging rivers|fortune\b/i,
    ],
    'compare-evidence-development': [/\bhowever|although|but|opposing|on the other hand|claim|argument|both\b/i],
    'metaphor-simile': [
      /\blike\b|\bas if\b|\bas though\b|\bcompared\b|\bcompare\b/i,
      /\bLove is a smoke|like a patient etheri[sz]ed|like a pale star|like two dragon-flies|like hounds|as soft as moths|as though it were\b/i,
    ],
    'personification-effect': [
      /\b(?:sun|night|fog|smoke|wind|fireplace|furniture|house|forest|sea|shore|sky|storm|light|shadow|silence|death|tree|pine)\b[^.!?]*(?:crept|rubbed|rubs|licked|looked|asked|confronted|whispered|slept|stood|watched|called|seized|pressed|threatened|lengthen|loved)\b/i,
      /\byellow fog|yellow smoke|night, proceeding|fireplace confronted|furniture[^.!?]*inquiry|woods[^.!?]*called|silence[^.!?]*answered|tree seemed to lengthen|old pine must have loved\b/i,
    ],
    'imagery-sensory-language': [
      /\b(?:dark|cold|bright|yellow|green|white|black|gold|shadow|silence|sound|voice|smell|taste|touch|warm|frost|mist|fog|smoke|light|night|stars|moon|sun)\b/i,
      /\b(?:woods were already filled with shadows|dusky shades of night|yellow fog|finest powder|cold which was not of frost|radiant light|lonely and dark|savage and wild)\b/i,
    ],
    'symbol-object-meaning': [
      /\b(?:heron|bird|apple|golden apples|wine|fireplace|window|light|darkness|shadow|flower|crown|chain|stone|smoke|fog|hands|star)\b/i,
      /\b(?:symbol|stands for|suggests|represents|secret|untasted wine|flat and filmy|white heron|golden apples|head of Medusa)\b/i,
    ],
    'mood-shift-effect': [
      /\b(?:at first|then|now|suddenly|but|yet|no longer|changed|shift|from|until|after)\b/i,
      /\b(?:dark|cold|lonely|dread|fear|joy|hope|terror|silent|safe|threatening|oppressive|uneasy|peaceful|wonder)\b/i,
    ],
    'chunk-complex-syntax': [
      /\b(?:although|because|while|when|which|who|that|therefore|however|but|yet|so that|whereas|nevertheless)\b/i,
      /[,;:—-]/,
    ],
    'preserve-original-meaning': [
      /\b(?:because|therefore|however|although|but|yet|if|when|while|so that|instead|rather than|unless|except)\b/i,
      /\b(?:must|should|cannot|no longer|not|never|only|without)\b/i,
    ],
    'translate-archaic-or-formal-language': [
      /\b(?:hath|thou|thee|thy|shall|wherefore|hence|therefore|lest|whence|thus|consequently|publick|honou?r|doth|ne'er|o'er|forc[’']d|view[’']d|ev[’']ry)\b/i,
      /\b(?:motive|sincerity|consideration|advantage|illustrious|dominion|manifest|secure|liberty|expedient)\b/i,
    ],
    'paraphrase-claim-or-theme': [
      /\b(?:claim|truth|therefore|thus|must|should|means|shows|purpose|motive|idea|answer|question|conclude|believe|I say)\b/i,
      /\b(?:love|death|life|freedom|justice|power|honou?r|duty|fear|hope|truth|equal|publick good|country)\b/i,
    ],
    'adaptation-same-and-changed': [/\bgod|myth|hero|king|queen|fate|source|story|old|ancient|changed\b/i],
    'reader-belief-feeling-notice': [/\bwe|you|our|must|shall|should|why|how|therefore|justice|freedom|duty\b/i],
  };
  return countMatches(text, rules[subSkillId] ?? []) * 18;
}

function goldSetPriorityBonus(subSkillId: string | null | undefined, paragraph: string) {
  if (subSkillId === 'setting-layer') {
    return countMatches(paragraph, [
      /\bliving in caves and in holes of the earth\b/i,
      /\bshivering with the cold\b/i,
      /\bdying of starvation\b/i,
      /\bhunted by wild beasts\b/i,
      /\bbright green swamp grass\b/i,
      /\bsoft black mud\b/i,
      /\bsavage and wild\b/i,
      /\blonely and dark\b/i,
      /\bnocturnal sky\b/i,
    /\bsettled sky\b/i,
    /\bcheerless cave\b/i,
    /\bcold waves\b/i,
    /\bwintry sea\b/i,
    /\bice mountains\b/i,
    /\bdesolate land\b/i,
  ]) * 45;
}

  if (subSkillId === 'characterization-layer') {
    return countMatches(paragraph, [
      /\bBut I tell you, you must lie upon it\b/i,
      /\bseized the trembling man\b/i,
      /\blooked him straight in the eye\b/i,
      /\bspoken so rashly\b/i,
      /\bnever show his face\b/i,
      /\bDo thou but call my resolution wise\b/i,
      /\bwith this knife I’ll help it presently\b/i,
      /\bGive me some present counsel\b/i,
      /\bI long to die\b/i,
      /\bGraze where you will\b/i,
      /\bhang, beg, starve, die\b/i,
      /\bI do not use to jest\b/i,
      /\bif your work is best\b/i,
      /\bI agree\b/i,
    ]) * 45;
  }

  if (subSkillId === 'point-of-view-layer') {
    return countMatches(paragraph, [
    /\bNo, she must keep silence\b/i,
    /\bSylvia cannot speak\b/i,
    /\bshe cannot tell the heron’s secret\b/i,
    /\bI was for jeering at the Cyclops again\b/i,
    /\bthe men begged and prayed of me\b/i,
    /\bI was moved to tears\b/i,
    /\bI would not let her come near\b/i,
    /\bYester night I saw a flame\b/i,
    /\bas though she hated them\b/i,
    /\bDid my heart love till now\b/i,
    /\bI ne[’']er saw true beauty till this night\b/i,
    /\bThou knowest the mask of night is on my face\b/i,
    /\bI am too fond\b/i,
    /\bI should have been more strange\b/i,
    /\bI have a faint cold fear\b/i,
    /\bWhat if this mixture do not work at all\b/i,
    ]) * 45;
  }

  if (subSkillId === 'theme-tone-layer') {
    return countMatches(paragraph, [
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron’s secret\b/i,
      /\bnever had she forgotten that morning\b/i,
      /\btoo late it dawned upon her\b/i,
      /\bWhy, then, O brawling love\b/i,
      /\bO loving hate\b/i,
      /\bLove is a smoke\b/i,
      /\btemper(?:ing)? extremities with extreme sweet\b/i,
      /\bfriend of life and the foe of death\b/i,
      /\bfilled with grief and rage\b/i,
      /\bwicked uncle, who loved only himself\b/i,
      /\bmountain was no longer savage and wild\b/i,
      /\bvalley was no longer dark and lonely\b/i,
      /\bterror in the joy\b/i,
      /\bforgot everything in the world but joy\b/i,
      /\bdeath slow winging to the dark\b/i,
    ]) * 45;
  }

  if (subSkillId === 'style-technique-layer') {
    return countMatches(paragraph, [
      /\blike a pale star\b/i,
      /\bas soft as moths\b/i,
      /\bas if she too could go flying away among the clouds\b/i,
      /\blike a great main-mast\b/i,
      /\bold pine must have loved his new dependent\b/i,
      /\bas though it were a heap of dry chaff tossed about by a whirlwind\b/i,
      /\bas if he were on horseback\b/i,
      /\bLove is a smoke\b/i,
      /\bmadness most discreet\b/i,
      /\bchoking gall\b/i,
      /\bpreserving sweet\b/i,
      /\bas though he would swallow\b/i,
      /\blike hounds in the chase\b/i,
      /\bfoul weeds\b/i,
      /\bpale light\b/i,
      /\bas in a mirror\b/i,
      /\bsomething which glittered\b/i,
      /\bsavage and wild\b/i,
      /\blonely and dark\b/i,
    ]) * 45;
  }

  if (subSkillId === 'metaphor-simile') {
    return countMatches(paragraph, [
      /\bLove is a smoke\b/i,
      /\blike a patient etheri[sz]ed upon a table\b/i,
      /\bblack sack\b/i,
      /\bblack hole\b/i,
      /\blike a pale star\b/i,
      /\bas soft as moths\b/i,
      /\bas if she too could go flying away among the clouds\b/i,
      /\blike two dragon-flies\b/i,
      /\bas though it were a heap of dry chaff\b/i,
      /\bas though he would swallow\b/i,
      /\blike hounds in the chase\b/i,
    ]) * 55;
  }

  if (subSkillId === 'personification-effect') {
    return countMatches(paragraph, [
      /\byellow fog that rubs its back\b/i,
      /\byellow smoke that rubs its muzzle\b/i,
      /\bnight, proceeding on with silent pace\b/i,
      /\bthe fireplace confronted him\b/i,
      /\bfurniture[^.!?]*intolerable inquiry\b/i,
      /\bwoods were already filled with shadows\b/i,
      /\bthe roof had turned itself into a gymnasium\b/i,
    ]) * 55;
  }

  if (subSkillId === 'imagery-sensory-language') {
    return countMatches(paragraph, [
      /\bwoods were already filled with shadows\b/i,
      /\bdusky shades of night\b/i,
      /\byellow fog\b/i,
      /\byellow smoke\b/i,
      /\bfinest powder\b/i,
      /\bcold which was not of frost\b/i,
      /\bsavage and wild\b/i,
      /\blonely and dark\b/i,
      /\bbright green swamp grass\b/i,
    ]) * 55;
  }

  if (subSkillId === 'symbol-object-meaning') {
    return countMatches(paragraph, [
      /\bwhite heron\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bblack sack\b/i,
      /\bblack hole\b/i,
      /\bIn the place of death there was light\b/i,
      /\bgolden apples?\b/i,
      /\buntasted wine\b/i,
      /\bflat and filmy\b/i,
      /\bhead of Medusa\b/i,
      /\bturned into stone\b/i,
    ]) * 55;
  }

  if (subSkillId === 'mood-shift-effect') {
    return countMatches(paragraph, [
      /\bno longer savage and wild\b/i,
      /\bno longer dark and lonely\b/i,
      /\bterror in the joy\b/i,
      /\bforgot everything in the world but joy\b/i,
      /\bthen one day\b/i,
      /\bnow had the sun withdrawn\b/i,
      /\bwhen he saw no threat[’']?ning tempest\b/i,
    ]) * 55;
  }

  if (subSkillId === 'chunk-complex-syntax') {
    return (
      countMatches(paragraph, [
        /\b(?:although|because|while|when|which|who|that|therefore|however|but|yet|so that|whereas|nevertheless)\b/i,
        /[,;:—-]/,
        /\b(?:first|secondly|thirdly|if|then|only|except|without)\b/i,
      ]) * 35 +
      sentences(paragraph).filter((sentence) => wordCount(sentence) >= 28).length * 80
    );
  }

  if (subSkillId === 'preserve-original-meaning') {
    return countMatches(paragraph, [
      /\b(?:because|therefore|however|although|but|yet|if|when|while|so that|instead|rather than|unless|except|without)\b/i,
      /\b(?:must|should|cannot|no longer|not|never|only|all|none|every|both)\b/i,
      /\b(?:means|shows|proves|there can be|the question|the truth|I say|I conclude)\b/i,
    ]) * 40;
  }

  if (subSkillId === 'translate-archaic-or-formal-language') {
    return countMatches(paragraph, [
      /\b(?:hath|thou|thee|thy|shall|wherefore|hence|therefore|lest|whence|thus|consequently|publick|honou?r|doth|ne'er|o'er|forc[’']d|view[’']d|ev[’']ry)\b/i,
      /\b(?:motive|sincerity|consideration|advantage|illustrious|dominion|manifest|secure|liberty|expedient|melancholy object)\b/i,
    ]) * 55;
  }

  if (subSkillId === 'paraphrase-claim-or-theme') {
    return countMatches(paragraph, [
      /\b(?:truth|therefore|thus|must|should|means|shows|purpose|motive|idea|answer|question|conclude|believe|I say|I profess)\b/i,
      /\b(?:love|death|life|freedom|justice|power|honou?r|duty|fear|hope|truth|equal|publick good|country)\b/i,
      /\b(?:Do not swear at all|No, she must keep silence|All animals are equal|cannot endure permanently|no other motive)\b/i,
    ]) * 45;
  }

  if (subSkillId === 'universal-theme') {
    return countMatches(paragraph, [
      /\bthey loved themselves better than their brother\b/i,
      /\bthis thing they would not do\b/i,
      /\bwicked uncle, who loved only himself\b/i,
      /\bfilled with grief and rage\b/i,
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bDo not swear at all\b/i,
      /\btoo rash, too unadvised, too sudden\b/i,
      /\bNo time shall find me wanting to my truth\b/i,
      /\bTo love so great\b/i,
      /\bShe hath forsworn to love\b/i,
      /\bAll this trouble came from disobedience\b/i,
      /\bLove is a smoke\b/i,
      /\bO brawling love\b/i,
    ]) * 90;
  }

  if (subSkillId === 'theme-development-moments') {
    return countMatches(paragraph, [
      /\bWhat is it that suddenly forbids her\b/i,
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bIt was not long until they learned to cook their food\b/i,
      /\bthey began at once to leave off their wild and savage habits\b/i,
      /\bAlas for him\b/i,
      /\bhe remembered\b/i,
      /\bThe heat of the sun had melted the wax\b/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bThere was a terror in the joy\b/i,
      /\bprecious spark hidden in the hollow center of the plant\b/i,
      /\bnever would he beg for mercy\b/i,
      /\bBut sad days came to them all at last\b/i,
      /\bAt last the vessel with Theseus\b/i,
      /\bmountain was no longer savage and wild\b/i,
      /\bvalley was no longer dark and lonely\b/i,
      /\bturned into stone\b/i,
    ]) * 90;
  }

  if (subSkillId === 'theme-through-conflict') {
    return countMatches(paragraph, [
      /\bhuge serpent called the Python\b/i,
      /\bcarried them up to his dreadful den\b/i,
      /\bsea monster was close at hand\b/i,
      /\bopening his wide jaws\b/i,
      /\bPerseus drew his sharp sword and cut the chain\b/i,
      /\bNo young man had ever spoken to her before\b/i,
      /\bfilled her heart with fear\b/i,
      /\bShe turned and fled like a frightened deer\b/i,
      /\bO Father Peneus, save me\b/i,
      /\bDeath is my son-in-law\b/i,
      /\blife, living, all is death\b/i,
      /\bhang, beg, starve, die\b/i,
      /\bGod[’']s bread, it makes me mad\b/i,
      /\bThe kindred of Cain crushed with His vengeance\b/i,
      /\bput an end to all their joy\b/i,
      /\bTwo households, both alike in dignity\b/i,
      /\bancient grudge break to new mutiny\b/i,
    ]) * 90;
  }

  if (subSkillId === 'narrator-perspective') {
    return countMatches(paragraph, [
      /\bSylvia’s heart gave a wild beat\b/i,
      /\bshe knew that strange white bird\b/i,
      /\bthe sea which Sylvia wondered and dreamed about\b/i,
      /\bsmall and hopeful Sylvia\b/i,
      /\butmost bravery\b/i,
      /\bknew that higher still\b/i,
      /\bNo, she must keep silence\b/i,
      /\bWhat is it that suddenly forbids her\b/i,
      /\bshe cannot tell the heron[’']s secret\b/i,
      /\bWondering over and over again\b/i,
      /\bThe guest waked from a dream\b/i,
      /\bHe was sure\b/i,
      /\bAlas for him\b/i,
      /\bin that terror he remembered\b/i,
      /\bhe forgot everything in the world but joy\b/i,
    ]) * 90;
  }

  if (subSkillId === 'irony-reversal-contrast') {
    return countMatches(paragraph, [
      /\bI shall now therefore humbly propose\b/i,
      /\bnot be liable to the least objection\b/i,
      /\byoung healthy child well nursed\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\bstewed, roasted, baked, or boiled\b/i,
      /\bInfant[’']?s flesh\b/i,
      /\bcollateral advantage\b/i,
      /\blessening the number of Papists\b/i,
      /\bI profess in the sincerity of my heart\b/i,
      /\bno other motive than the publick good\b/i,
      /\bAlas for him\b/i,
      /\bThe heat of the sun had melted the wax\b/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bHe was sure\b/i,
      /\bNo, she must keep silence\b/i,
    ]) * 90;
  }

  if (subSkillId === 'satire-exaggeration-ridicule') {
    return countMatches(paragraph, [
      /\bI shall now therefore humbly propose\b/i,
      /\bnot be liable to the least objection\b/i,
      /\byoung healthy child well nursed\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\bstewed, roasted, baked, or boiled\b/i,
      /\boffered in sale\b/i,
      /\breserved for breed\b/i,
      /\bInfant[’']?s flesh\b/i,
      /\bfattest child to the market\b/i,
      /\bno other motive than the publick good\b/i,
      /\bpublick good of my country\b/i,
      /\bgiving some pleasure to the rich\b/i,
    ]) * 90;
  }

  if (subSkillId === 'chronological-sequence') {
    return countMatches(paragraph, [
      /\bthree tasks lay before me; first\b/i,
      /\bsecondly, to show\b/i,
      /\bthirdly, to show\b/i,
      /\bAs early as 1826\b/i,
      /\bfrom that time till to-day\b/i,
      /\bFor first, as I have already observed\b/i,
      /\bThirdly, Whereas\b/i,
      /\bFifthly, This food\b/i,
      /\bSixthly, This would\b/i,
    ]) * 90;
  }

  if (subSkillId === 'cause-effect-structure') {
    return countMatches(paragraph, [
      /\band therefore whoever could find out\b/i,
      /\btherefore, reckoning a year after Lent\b/i,
      /\btherefore it will have one other collateral advantage\b/i,
      /\bwill be thereby encreased\b/i,
      /\bconsequently have their houses frequented\b/i,
      /\bIf carpenters are needed\b/i,
      /\bhas resulted in sending\b/i,
    ]) * 90;
  }

  if (subSkillId === 'compare-contrast-structure') {
    return countMatches(paragraph, [
      /\binstead of being able to work\b/i,
      /\binstead of seeking that personal freedom\b/i,
      /\bfrom the top downward\b/i,
      /\bnot at the top but at the bottom\b/i,
      /\bI would not deny\b/i,
      /\bbut I _do_ say\b/i,
      /\bwhile the Negro teachers have been discouraged\b/i,
      /\bNevertheless, I insist\b/i,
      /\bnot to make men carpenters\b/i,
      /\bit is to make carpenters men\b/i,
      /\bit is only fair to point out\b/i,
      /\bvery far from being confined\b/i,
      /\bmore than we allow to sheep\b/i,
      /\bbut more plentiful in March\b/i,
    ]) * 90;
  }

  if (subSkillId === 'problem-solution-structure') {
    return countMatches(paragraph, [
      /\bmelancholy object\b/i,
      /\bgreat additional grievance\b/i,
      /\bfair, cheap and easy method\b/i,
      /\bwhat course may be taken\b/i,
      /\bHow then shall the leaders\b/i,
      /\bThere can be but one answer\b/i,
      /\bproper training of Negro children\b/i,
    ]) * 90;
  }

  if (subSkillId === 'example-evidence-structure') {
    return countMatches(paragraph, [
      /\bFor instance\b/i,
      /\bthese figures illustrate\b/i,
      /\bthere are to-day in the United States thirty-four institutions\b/i,
      /\bOf these graduates\b/i,
      /\breturns as to occupations\b/i,
      /\bI will give you an instance\b/i,
    ]) * 90;
  }

  if (subSkillId === 'opening-closing-shift') {
    return countMatches(paragraph, [
      /\bIf this be true--and who can deny it--three tasks lay before me\b/i,
      /\bHow then shall the leaders\b/i,
      /\bLet us see\b/i,
      /\bBut, as to myself\b/i,
      /\bI profess in the sincerity of my heart\b/i,
      /\bThe truth of this has been strikingly shown\b/i,
      /\bThe most interesting question\b/i,
      /\bIn earlier years\b/i,
      /\bNevertheless, I insist\b/i,
    ]) * 90;
  }

  if (subSkillId === 'central-idea-stated-implied') {
    return countMatches(paragraph, [
      /\bThe most interesting question\b/i,
      /\bIf this be true--and who can deny it--three tasks lay before me\b/i,
      /\bHow then shall the leaders\b/i,
      /\bThere can be but one answer\b/i,
      /\bI shall now therefore humbly propose\b/i,
      /\bThe truth of this has been strikingly shown\b/i,
      /\bThe whole fabric of science\b/i,
      /\bScripture tells us\b/i,
    ]) * 90;
  }

  if (subSkillId === 'strong-vs-weak-evidence' || subSkillId === 'best-evidence-for-claim') {
    return countMatches(paragraph, [
      /\bThese figures illustrate\b/i,
      /\bthere are to-day in the United States thirty-four institutions\b/i,
      /\bOf these graduates\b/i,
      /\breturns as to occupations\b/i,
      /\bFor instance\b/i,
      /\bcomputed the charge\b/i,
      /\bwill be thereby encreased\b/i,
      /\bproper training of Negro children\b/i,
    ]) * 90;
  }

  if (subSkillId === 'evidence-develops-central-idea') {
    return countMatches(paragraph, [
      /\bThese figures illustrate\b/i,
      /\bThe truth of this has been strikingly shown\b/i,
      /\bthere are to-day in the United States thirty-four institutions\b/i,
      /\bOf these graduates\b/i,
      /\breturns as to occupations\b/i,
      /\bFor instance\b/i,
      /\btherefore it will have one other collateral advantage\b/i,
      /\bhas resulted in sending\b/i,
    ]) * 90;
  }

  if (subSkillId === 'detail-vs-central-idea') {
    return countMatches(paragraph, [
      /\bFor instance\b/i,
      /\bcomputed the charge\b/i,
      /\bthere are to-day\b/i,
      /\bOf these graduates\b/i,
      /\bmore plentiful in March\b/i,
      /\bI grant this food will be somewhat dear\b/i,
      /\bbut more plentiful\b/i,
    ]) * 90;
  }

  if (subSkillId === 'central-idea-development-across-paragraphs') {
    return countMatches(paragraph, [
      /\bthree tasks lay before me\b/i,
      /\bHow then shall the leaders\b/i,
      /\bThere can be but one answer\b/i,
      /\bThese figures illustrate\b/i,
      /\bThe most interesting question\b/i,
      /\bNevertheless, I insist\b/i,
      /\bThe truth of this has been strikingly shown\b/i,
    ]) * 90;
  }

  if (subSkillId === 'logos-ethos-pathos') {
    return countMatches(paragraph, [
      /\bcomputed the charge\b/i,
      /\bThese figures illustrate\b/i,
      /\bI profess in the sincerity of my heart\b/i,
      /\bno other motive than the publick good\b/i,
      /\bIt is a melancholy object\b/i,
      /\bHow then shall the leaders\b/i,
      /\bThere can be but one answer\b/i,
    ]) * 90;
  }

  if (subSkillId === 'logos-evidence-reasoning') {
    return countMatches(paragraph, [
      /\bcomputed the charge\b/i,
      /\btherefore it will have one other collateral advantage\b/i,
      /\bThese figures illustrate\b/i,
      /\bthere are to-day in the United States thirty-four institutions\b/i,
      /\bOf these graduates\b/i,
      /\breturns as to occupations\b/i,
      /\bfirst\b/i,
      /\bsecondly\b/i,
      /\bthirdly\b/i,
    ]) * 90;
  }

  if (subSkillId === 'ethos-credibility-authority') {
    return countMatches(paragraph, [
      /\bI profess in the sincerity of my heart\b/i,
      /\bnot the least personal interest\b/i,
      /\bno other motive than the publick good\b/i,
      /\bwe are told by a grave author\b/i,
      /\bI am assured by our merchants\b/i,
      /\bI have been assured by a very knowing American\b/i,
      /\bA very worthy person\b/i,
      /\bI grant this food\b/i,
      /\bI would not deny\b/i,
      /\bNevertheless, I insist\b/i,
      /\bScripture\b/i,
      /\bMr\. C\.P\. Huntington\b/i,
      /\blate beloved Frederick Douglass\b/i,
      /\bopinion and judgment of wise men\b/i,
      /\bmany have written on this point\b/i,
      /\bour experience has been\b/i,
    ]) * 90;
  }

  if (subSkillId === 'pathos-emotional-appeal') {
    return countMatches(paragraph, [
      /\bIt is a melancholy object\b/i,
      /\bbeggars of the female sex\b/i,
      /\bchildren, all in rags\b/i,
      /\bimportuning every passenger for an alms\b/i,
      /\bgreat additional grievance\b/i,
      /\bpoor innocent babes\b/i,
      /\bdeplorable state\b/i,
    ]) * 90;
  }

  if (subSkillId === 'rhetorical-question-repetition') {
    return countMatches(paragraph, [
      /\bHow then shall the leaders\b/i,
      /\bWas the work of these college founders successful\b/i,
      /\bThe most interesting question\b/i,
      /\bThe question therefore is\b/i,
      /\bFor first\b/i,
      /\bSecondly\b/i,
      /\bThirdly\b/i,
      /\bFifthly\b/i,
      /\bSixthly\b/i,
    ]) * 90;
  }

  if (subSkillId === 'figurative-language-purpose') {
    return countMatches(paragraph, [
      /\bmelancholy object\b/i,
      /\bthe whole fabric of science\b/i,
      /\bliving oracles\b/i,
      /\bbook of nature\b/i,
      /\bthe universe stands continually open\b/i,
      /\bbarbarous dominion stinks\b/i,
      /\bfabric\b/i,
      /\bfoundation\b/i,
    ]) * 90;
  }

  if (subSkillId === 'purpose-fit-rhetorical-choice') {
    return countMatches(paragraph, [
      /\bI shall now therefore humbly propose\b/i,
      /\bI do therefore humbly offer it to publick consideration\b/i,
      /\bI think the advantages by the proposal\b/i,
      /\bHow then shall the leaders\b/i,
      /\bThere can be but one answer\b/i,
      /\bThese figures illustrate\b/i,
      /\bI profess in the sincerity of my heart\b/i,
      /\bno other motive than the publick good\b/i,
    ]) * 90;
  }

  if (subSkillId === 'in-medias-res') {
    return countMatches(paragraph, [
      /\bArms, and the man I sing\b/i,
      /\bTell me, O Muse\b/i,
      /\bTell me, Muse\b/i,
      /\bwho travelled far and wide after he had sacked\b/i,
      /\bSo now all who escaped death[^.?!]*except Ulysses\b/i,
      /\bSing, O goddess\b/i,
      /\bwrath of Achilles\b/i,
      /\bLong labours, both by sea and land\b/i,
    ]) * 80;
  }

  if (subSkillId === 'divine-intervention') {
    return countMatches(paragraph, [
      /\bMinerva followed him\b/i,
      /\bMinerva began to tell them\b/i,
      /\bJove let fly with his thunderbolts\b/i,
      /\bVenus, anxious for her son\b/i,
      /\bCyllenius with command\b/i,
      /\bJove counselled their destruction\b/i,
      /\bMinerva heard his prayer\b/i,
    ]) * 60;
  }

  if (subSkillId === 'epic-hero-traits') {
    return countMatches(paragraph, [
      /\bBeowulf[^.?!]*stoutest and strongest\b/i,
      /\bUlysses took his stand\b/i,
      /\bUlysses killed\b/i,
      /\bStern Hector waved his sword\b/i,
      /\bAeneas[^.?!]*courage\b/i,
      /\bAchilles[^.?!]*combat\b/i,
    ]) * 60;
  }

  if (subSkillId === 'quest-journey-structure') {
    return countMatches(paragraph, [
      /\bTell me, O Muse[^.?!]*travelled far and wide\b/i,
      /\bSo now all who escaped death[^.?!]*except Ulysses\b/i,
      /\bgot to the land[^.?!]*great cave\b/i,
      /\bsmote the grey sea with their oars\b/i,
      /\bForsake the pleasing shore\b/i,
      /\bItalian shore\b/i,
      /\bExpell[’']d and exil[’']d, left the Trojan shore\b/i,
    ]) * 80;
  }

  if (subSkillId === 'ritual-speech-oath') {
    return countMatches(paragraph, [
      /\bmade drink-offering\b/i,
      /\bmade their drink-offerings\b/i,
      /\bprayed much and made drink offerings\b/i,
      /\bshown him much hospitality\b/i,
      /\bsacrificed the sheep\b/i,
      /\bpay the rites\b/i,
    ]) * 60;
  }

  if (subSkillId === 'theme-through-heroic-action') {
    return countMatches(paragraph, [
      /\bThrough blood, through death, Achilles still proceeds\b/i,
      /\bArm, arm, Patroclus\b/i,
      /\bGreedy of war where greater glory calls\b/i,
      /\bWho ventured to take the terrible journeys\b/i,
      /\bUlysses and his men rushed forward\b/i,
      /\bGreat queen, what you command me to relate\b/i,
    ]) * 60;
  }

  if (subSkillId === 'elevated-style-epic-simile') {
    return countMatches(paragraph, [
      /\bArms, and the man I sing\b/i,
      /\bTell me, O Muse\b/i,
      /\bSing, O goddess\b/i,
      /\blike a sea-gull\b/i,
      /\bas one who turns a paunch\b/i,
      /\bSo burns the vengeful hornet\b/i,
      /\bbright Orion, arm[’']d with burnish[’']d gold\b/i,
    ]) * 60;
  }

  return 0;
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function cleanEvidencePoint(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();
}

function evidencePointScore(point: string) {
  let score = 0;
  const words = wordCount(point);
  if (words >= 4 && words <= 24) score += 4;
  if (words > 24 && words <= 34) score += 1;
  if (/[.!?]$/.test(point)) score += 1;
  if (point.endsWith('...')) score -= 3;
  if (/[a-z]$/i.test(point) && words > 14) score -= 2;
  return score;
}

function cleanEvidencePoints(points: string[]) {
  const cleaned = points
    .map(cleanEvidencePoint)
    .filter((point) => wordCount(point) >= 3 && wordCount(point) <= 36)
    .sort((a, b) => evidencePointScore(b) - evidencePointScore(a));

  const unique: string[] = [];
  for (const point of cleaned) {
    const normalized = point.toLowerCase();
    const duplicate = unique.some((existing) => {
      const current = existing.toLowerCase();
      return current === normalized || current.includes(normalized) || normalized.includes(current);
    });
    if (!duplicate) unique.push(point);
    if (unique.length >= 3) break;
  }

  return unique;
}

const OBVIOUS_DISTRACTOR_PATTERNS = [
  /\bno effect\b/i,
  /\bunrelated\b/i,
  /\bcan be guessed\b/i,
  /\bdoes not affect\b/i,
  /\bhas no connection\b/i,
  /\bwithout reading\b/i,
  /\bcompletely objective\b/i,
  /\bhas no problem\b/i,
];

function hasPlausibleDistractors(question: ReturnType<typeof anchorQuestion>) {
  const distractors = question.choices.filter((choice) => !choice.correct);
  const obviousCount = distractors.filter((choice) =>
    OBVIOUS_DISTRACTOR_PATTERNS.some((pattern) => pattern.test(choice.text))
  ).length;
  return obviousCount <= 1;
}

export function evidencePointsFor(standard: string, excerpt: string, subSkillId?: string | null) {
  const points: string[] = [];
  const r11SettingPatterns = [
    /\bsavage and wild\b/i,
    /\blonely and dark\b/i,
    /\bas if in dread[^.]*/i,
    /\bwoods were already filled with shadows\b/i,
    /\bbright sunset[^.]*/i,
    /\btrunks of the trees\b/i,
    /\bdark woods\b/i,
    /\bwestern light\b/i,
      /\bbright green swamp grass\b/i,
      /\bopen place where the sunshine[^.]*/i,
      /\bsoft black mud\b/i,
      /\bsalt marshes\b/i,
      /\bliving in caves and in holes of the earth\b/i,
      /\bshivering with the cold\b/i,
      /\bhunted by wild beasts\b/i,
      /\bmiserable of all living creatures\b/i,
      /\bcheerless cave\b/i,
      /\bcold waves\b/i,
      /\bwintry sea\b/i,
      /\bice mountains\b/i,
      /\bdesolate land\b/i,
      /\bdoor of the little house stood open\b/i,
    /\bwhippoorwills came and sang[^.]*/i,
    /\bmountain[^.]*/i,
    /\bvalley[^.]*/i,
    /\brain-storm[^.]*/i,
    /\bforests and then the hills\b/i,
    /\bsea[^.]*/i,
    /\bshore[^.]*/i,
    /\bdreadful den\b/i,
  ];
  const r11PlotPatterns = [
    /\bhuge serpent called the Python\b/i,
    /\bseized sheep and cattle\b/i,
    /\bmen and women and children\b/i,
    /\bcarried them up\b/i,
    /\bdevoured them\b/i,
    /\bcut the chain\b/i,
    /\bsea monster was close at hand[^.]*/i,
    /\bopening his wide jaws[^.]*/i,
    /\bturned into stone\b/i,
    /\bsharp claws\b/i,
    /\bstruck it in the neck[^.]*/i,
    /\bdragon soon fell to the ground dead\b/i,
    /\bHe had never been in so great danger before\b/i,
    /\bthrew a heavy quoit[^.]*/i,
    /\bstruck a stranger[^.]*/i,
    /\bsank upon the ground\b/i,
    /\bmet his death\b/i,
    /\bgreat beast was found[^.]*/i,
    /\bcame charging out upon his foes\b/i,
    /\bhid behind the trees[^.]*/i,
    /\btearing up the ground[^.]*/i,
    /\btore him in pieces\b/i,
    /\bovertaken and killed\b/i,
    /\bwoods and hills echoed with fearful sounds\b/i,
    /\bconflict|danger|battle|fight|choice|consequence|threat\b/i,
  ];
  const r11CharacterPatterns = [
    /\bBut I tell you, you must lie upon it\b/i,
    /\bsharp eyes and quick ears\b/i,
    /\bdodged aside so quickly\b/i,
    /\bseized the fellow's legs\b/i,
    /\btripped him up\b/i,
    /\bseized the trembling man[^.?!]*/i,
    /\blooked him straight in the eye\b/i,
    /\bspoken so rashly\b/i,
    /\bhe began to feel sorry[^.?!]*/i,
    /\bnever show his face[^.?!]*/i,
    /\bDo thou but call my resolution wise\b/i,
    /\bwith this knife I’ll help it presently\b/i,
    /\bGive me some present counsel\b/i,
    /\bI long to die\b/i,
    /\bGod’s bread, it makes me mad\b/i,
    /\bGraze where you will\b/i,
    /\bhang, beg, starve, die\b/i,
    /\bI do not use to jest\b/i,
    /\bif your work is best[^.?!]*/i,
    /\bI agree\b/i,
    /\bsaid\b/i,
    /\banswered\b/i,
    /\blooked\b/i,
    /\bcried\b/i,
    /\bseized\b/i,
    /\bsaid\b/i,
    /\banswered\b/i,
    /\blooked\b/i,
    /\bvoice\b/i,
    /\bface\b/i,
    /\beyes\b/i,
    /\bhand\b/i,
    /\bheart\b/i,
  ];
  const r11PovPatterns = [
    /\bNo, she must keep silence\b/i,
    /\bWhat is it that suddenly forbids her[^.?!]*/i,
    /\bSylvia cannot speak\b/i,
    /\bshe cannot tell the heron’s secret[^.?!]*/i,
    /\bDid my heart love till now\b/i,
    /\bI ne[’']er saw true beauty till this night\b/i,
    /\bThou knowest the mask of night is on my face\b/i,
    /\bI am too fond\b/i,
    /\bI should have been more strange[^.?!]*/i,
    /\bI have a faint cold fear[^.?!]*/i,
    /\bWhat if this mixture do not work at all\b/i,
    /\bI saw[^.?!]*/i,
    /\bI heard[^.?!]*/i,
    /\bmy heart was clouded with care\b/i,
    /\bI divided them into two companies[^.?!]*/i,
    /\bI took command of the other myself\b/i,
    /\bThey wept bitterly[^.?!]*/i,
    /\bI was moved to tears[^.?!]*/i,
    /\bI would not let her come near[^.?!]*/i,
    /\bI was for jeering at the Cyclops again\b/i,
    /\bthe men begged and prayed of me[^.?!]*/i,
    /\bI went on board[^.?!]*/i,
    /\bwe found our comrades lamenting us\b/i,
    /\bI\b/,
    /\bwe\b/i,
    /\bthought\b/i,
    /\bseemed to\b/i,
    /\bunderstood\b/i,
    /\bremembered\b/i,
  ];
  const r11ThemeTonePatterns = [
    ...R11_THEME_TONE_PATTERNS,
    /\b(?:fear|dread|power|pride|duty|justice|hope|shame|honor|truth|love|death|grief|rage|despair)[^.?!]*[.?!]/i,
    /\b(?:no longer|forgot|cannot|never|too late|filled with|friend of|foe of)[^.?!]*[.?!]/i,
  ];
  const r11StylePatterns = [
    ...R11_STYLE_TECHNIQUE_PATTERNS,
    /\bfoul weeds\b/i,
    /\bpale light\b/i,
    /\bas in a mirror\b/i,
    /\bsomething which glittered\b/i,
    /\bO brawling love\b/i,
    /\bO loving hate\b/i,
    /\bheavy lightness\b/i,
    /\bcold fire\b/i,
    /\b(?:diction|image|comparison|personification)\b/i,
  ];
  const r12Patterns: Record<string, RegExp[]> = {
    'universal-theme': [
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron[’']s secret[^.?!]*/i,
      /\bLove is a smoke[^.?!]*/i,
      /\bDo not swear at all[^.?!]*/i,
      /\btoo rash, too unadvised, too sudden\b/i,
      /\bpower|freedom|justice|love|loyalty|truth|pride|sacrifice|duty|honou?r|hope\b/i,
    ],
    'theme-development-moments': [
      /\bWhat is it that suddenly forbids her[^.?!]*/i,
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron[’']s secret[^.?!]*/i,
      /\bIt was not long until they learned to cook[^.?!]*/i,
      /\bThey began at once to leave off[^.?!]*/i,
      /\bcame out into the open air[^.?!]*/i,
      /\bprecious spark hidden in the hollow center of the plant\b/i,
      /\bnever would he beg for mercy[^.?!]*/i,
      /\bgiven them fire and lifted them out of their wretchedness[^.?!]*/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bThere was a terror in the joy\b/i,
      /\bAlas for him\b/i,
      /\bWarmer and warmer grew the air\b/i,
      /\bhe was falling\b/i,
      /\bin that terror he remembered\b/i,
      /\bThe heat of the sun had melted the wax[^.?!]*/i,
      /\bthere was none to help\b/i,
      /\bAtalanta now ran forward[^.?!]*/i,
      /\bThen Meleager rushed up[^.?!]*/i,
      /\bmountain was no longer savage and wild[^.?!]*/i,
      /\bvalley was no longer dark and lonely[^.?!]*/i,
      /\bturned into stone[^.?!]*/i,
      /\bnow|then|at last|no longer|suddenly|until|after|before\b/i,
    ],
    'theme-through-conflict': [
      /\bhuge serpent called the Python\b/i,
      /\bcarried them up to his dreadful den[^.?!]*/i,
      /\bsea monster was close at hand[^.?!]*/i,
      /\bopening his wide jaws[^.?!]*/i,
      /\bcut the chain[^.?!]*/i,
      /\bNo young man had ever spoken to her before[^.?!]*/i,
      /\bfilled her heart with fear\b/i,
      /\bstranger was following her[^.?!]*/i,
      /\bshe ran as fast as her fleet feet could carry her\b/i,
      /\bShe turned and fled like a frightened deer\b/i,
      /\bTwo households, both alike in dignity[^.?!]*/i,
      /\bancient grudge break to new mutiny[^.?!]*/i,
      /\bFrom forth the fatal loins of these two foes[^.?!]*/i,
      /\bDeath is my son-in-law[^.?!]*/i,
      /\blife, living, all is death[’']s\b/i,
      /\bReady to go, but never to return\b/i,
      /\bThere she lies\b/i,
      /\bGod[’']s bread, it makes me mad\b/i,
      /\bI[’']ll not wed[^.?!]*/i,
      /\bspoken so rashly[^.?!]*/i,
      /\bnever show his face[^.?!]*/i,
      /\bhang, beg, starve, die\b/i,
      /\bconflict|choice|consequence|fear|danger|death|power|pride|suffer|punish|refuse\b/i,
    ],
  };
  const r13Patterns: Record<string, RegExp[]> = {
    'narrator-perspective': [
      /\bSylvia’s heart gave a wild beat\b/i,
      /\bshe knew that strange white bird\b/i,
      /\bthe sea which Sylvia wondered and dreamed about\b/i,
      /\bsmall and hopeful Sylvia\b/i,
      /\butmost bravery\b/i,
      /\bknew that higher still[^.?!]*/i,
      /\bNo, she must keep silence\b/i,
      /\bWhat is it that suddenly forbids her[^.?!]*/i,
      /\bshe cannot tell the heron[’']s secret[^.?!]*/i,
      /\bWondering over and over again[^.?!]*/i,
      /\bThe guest waked from a dream[^.?!]*/i,
      /\bHe was sure[^.?!]*/i,
      /\bAlas for him\b/i,
      /\bin that terror he remembered\b/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bthought|knew|remembered|wondered|seemed|must|cannot\b/i,
    ],
    'irony-reversal-contrast': [
      /\bI shall now therefore humbly propose[^.?!]*/i,
      /\bnot be liable to the least objection\b/i,
      /\byoung healthy child well nursed\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\bstewed, roasted, baked, or boiled\b/i,
      /\bInfant[’']?s flesh[^.?!]*/i,
      /\bcollateral advantage[^.?!]*/i,
      /\blessening the number of Papists[^.?!]*/i,
      /\bI profess in the sincerity of my heart[^.?!]*/i,
      /\bnot the least personal interest[^.?!]*/i,
      /\bno other motive than the publick good[^.?!]*/i,
      /\bpublick good of my country\b/i,
      /\bgiving some pleasure to the rich\b/i,
      /\bAlas for him\b/i,
      /\bWarmer and warmer grew the air\b/i,
      /\bThe heat of the sun had melted the wax[^.?!]*/i,
      /\bhe forgot everything in the world but joy\b/i,
      /\bHe was sure[^.?!]*/i,
      /\bbut|however|instead|yet|although\b/i,
    ],
    'satire-exaggeration-ridicule': [
      /\bI shall now therefore humbly propose[^.?!]*/i,
      /\bnot be liable to the least objection\b/i,
      /\byoung healthy child well nursed\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\bstewed, roasted, baked, or boiled\b/i,
      /\boffered in sale[^.?!]*/i,
      /\breserved for breed[^.?!]*/i,
      /\bInfant[’']?s flesh[^.?!]*/i,
      /\bfattest child to the market\b/i,
      /\bno other motive than the publick good[^.?!]*/i,
      /\bpublick good of my country[^.?!]*/i,
      /\bcommodity|child|children|infants|poor|advantage|scheme|proposal\b/i,
    ],
  };
  const r21Patterns: Record<string, RegExp[]> = {
    'chronological-sequence': [
      /\bthree tasks lay before me; first[^.?!]*/i,
      /\bfirst to show from the past[^;.]*/i,
      /\bsecondly, to show[^.?!]*/i,
      /\bthirdly, to show[^.?!]*/i,
      /\bAs early as 1826[^.?!]*/i,
      /\bfrom that time till to-day[^.?!]*/i,
      /\bFor first, as I have already observed[^.?!]*/i,
      /\bThirdly, Whereas[^.?!]*/i,
      /\bFifthly, This food[^.?!]*/i,
      /\bSixthly, This would[^.?!]*/i,
    ],
    'cause-effect-structure': [
      /\band therefore whoever could find out[^.?!]*/i,
      /\btherefore, reckoning a year after Lent[^.?!]*/i,
      /\btherefore it will have one other collateral advantage[^.?!]*/i,
      /\bwill be thereby encreased[^.?!]*/i,
      /\bconsequently have their houses frequented[^.?!]*/i,
      /\bso that the Negro public school system[^.?!]*/i,
      /\bhas resulted in sending[^.?!]*/i,
      /\bIf carpenters are needed[^.?!]*/i,
    ],
    'compare-contrast-structure': [
      /\binstead of being able to work[^.?!]*/i,
      /\binstead of seeking that personal freedom[^.?!]*/i,
      /\bfrom the top downward[^.?!]*/i,
      /\bnot at the top but at the bottom[^.?!]*/i,
      /\bI would not deny[^.?!]*/i,
      /\bbut I _do_ say[^.?!]*/i,
      /\bBut they, by scholarships and good salaries[^.?!]*/i,
      /\bwhile the Negro teachers have been discouraged[^.?!]*/i,
      /\bNevertheless, I insist[^.?!]*/i,
      /\bnot to make men carpenters[^.?!]*/i,
      /\bit is to make carpenters men[^.?!]*/i,
      /\bit is only fair to point out[^.?!]*/i,
      /\bvery far from being confined[^.?!]*/i,
      /\bmore than we allow to sheep[^.?!]*/i,
      /\bbut more plentiful in March[^.?!]*/i,
    ],
    'problem-solution-structure': [
      /\bmelancholy object[^.?!]*/i,
      /\bgreat additional grievance[^.?!]*/i,
      /\bfair, cheap and easy method[^.?!]*/i,
      /\bwhat course may be taken[^.?!]*/i,
      /\bHow then shall the leaders[^.?!]*/i,
      /\bThere can be but one answer[^.?!]*/i,
      /\bmust be schooled in the colleges and universities[^.?!]*/i,
      /\bproper training of Negro children[^.?!]*/i,
    ],
    'example-evidence-structure': [
      /\bFor instance[^.?!]*/i,
      /\bThese figures illustrate[^.?!]*/i,
      /\bthe function of the college-bred Negro[^.?!]*/i,
      /\bthere are to-day in the United States thirty-four institutions[^.?!]*/i,
      /\bOf these graduates[^.?!]*/i,
      /\breturns as to occupations[^.?!]*/i,
      /\bI will give you an instance[^.?!]*/i,
    ],
    'opening-closing-shift': [
      /\bIf this be true--and who can deny it--three tasks lay before me[^.?!]*/i,
      /\bHow then shall the leaders[^.?!]*/i,
      /\bLet us see[^.?!]*/i,
      /\bBut, as to myself[^.?!]*/i,
      /\bI profess in the sincerity of my heart[^.?!]*/i,
      /\bThe truth of this has been strikingly shown[^.?!]*/i,
      /\bThe most interesting question[^.?!]*/i,
      /\bIn earlier years[^.?!]*/i,
      /\bNevertheless, I insist[^.?!]*/i,
    ],
  };
  const r22Patterns: Record<string, RegExp[]> = {
    'central-idea-stated-implied': [
      /\bIt is a melancholy object[^.?!]*/i,
      /\bThe question therefore is[^.?!]*/i,
      /\bThe most interesting question[^.?!]*/i,
      /\bIf this be true--and who can deny it--three tasks lay before me[^.?!]*/i,
      /\bHow then shall the leaders[^.?!]*/i,
      /\bThere can be but one answer[^.?!]*/i,
      /\bI shall now therefore humbly propose[^.?!]*/i,
      /\bI do therefore humbly offer it to publick consideration[^.?!]*/i,
      /\bI think the advantages by the proposal[^.?!]*/i,
      /\bThe truth of this has been strikingly shown[^.?!]*/i,
      /\bThe whole fabric of science[^.?!]*/i,
      /\bI say, therefore[^.?!]*/i,
      /\bI conclude, therefore[^.?!]*/i,
      /\bIt is necessary, therefore[^.?!]*/i,
      /\bThe wise prince, therefore[^.?!]*/i,
      /\bcentral|idea|point|truth|question|answer|proposal|purpose\b/i,
    ],
    'strong-vs-weak-evidence': [
      /\bThese figures illustrate[^.?!]*/i,
      /\bthere are to-day in the United States thirty-four institutions[^.?!]*/i,
      /\bOf these graduates[^.?!]*/i,
      /\breturns as to occupations[^.?!]*/i,
      /\bFor instance[^.?!]*/i,
      /\bcomputed the charge[^.?!]*/i,
      /\bwill be thereby encreased[^.?!]*/i,
      /\bproper training of Negro children[^.?!]*/i,
      /\bevidence|support|prove|show|illustrate|because|therefore\b/i,
    ],
    'evidence-develops-central-idea': [
      /\bThese figures illustrate[^.?!]*/i,
      /\bThe truth of this has been strikingly shown[^.?!]*/i,
      /\bthere are to-day in the United States thirty-four institutions[^.?!]*/i,
      /\bOf these graduates[^.?!]*/i,
      /\breturns as to occupations[^.?!]*/i,
      /\bFor instance[^.?!]*/i,
      /\btherefore it will have one other collateral advantage[^.?!]*/i,
      /\bhas resulted in sending[^.?!]*/i,
      /\bdevelop|support|clarif|extend|prove|illustrate|show\b/i,
    ],
    'best-evidence-for-claim': [
      /\bThese figures illustrate[^.?!]*/i,
      /\bthere are to-day in the United States thirty-four institutions[^.?!]*/i,
      /\bOf these graduates[^.?!]*/i,
      /\breturns as to occupations[^.?!]*/i,
      /\bFor instance[^.?!]*/i,
      /\bcomputed the charge[^.?!]*/i,
      /\bwill be thereby encreased[^.?!]*/i,
      /\btherefore it will have one other collateral advantage[^.?!]*/i,
    ],
    'detail-vs-central-idea': [
      /\bFor instance[^.?!]*/i,
      /\bcomputed the charge[^.?!]*/i,
      /\bthere are to-day[^.?!]*/i,
      /\bOf these graduates[^.?!]*/i,
      /\bmore plentiful in March[^.?!]*/i,
      /\bI grant this food will be somewhat dear[^.?!]*/i,
      /\bdetail|fact|true|example|instance|figures|number\b/i,
    ],
    'central-idea-development-across-paragraphs': [
      /\bthree tasks lay before me[^.?!]*/i,
      /\bHow then shall the leaders[^.?!]*/i,
      /\bThere can be but one answer[^.?!]*/i,
      /\bThese figures illustrate[^.?!]*/i,
      /\bThe most interesting question[^.?!]*/i,
      /\bNevertheless, I insist[^.?!]*/i,
      /\bThe truth of this has been strikingly shown[^.?!]*/i,
      /\bfirst|secondly|thirdly|therefore|however|nevertheless\b/i,
    ],
  };
  const r23Patterns: Record<string, RegExp[]> = {
    'logos-ethos-pathos': [
      /\bcomputed the charge[^.?!]*/i,
      /\bThese figures illustrate[^.?!]*/i,
      /\bI profess in the sincerity of my heart[^.?!]*/i,
      /\bno other motive than the publick good[^.?!]*/i,
      /\bIt is a melancholy object[^.?!]*/i,
      /\bHow then shall the leaders[^.?!]*/i,
      /\bThere can be but one answer[^.?!]*/i,
      /\bIt has been necessary[^.?!]*/i,
      /\bWe few, we happy few[^.?!]*/i,
      /\bfewer men, the greater share of honour[^.?!]*/i,
    ],
    'logos-evidence-reasoning': [
      /\bcomputed the charge[^.?!]*/i,
      /\btherefore it will have one other collateral advantage[^.?!]*/i,
      /\bThese figures illustrate[^.?!]*/i,
      /\bthere are to-day in the United States thirty-four institutions[^.?!]*/i,
      /\bOf these graduates[^.?!]*/i,
      /\breturns as to occupations[^.?!]*/i,
      /\beighty-five per cent[^.?!]*/i,
      /\bFor two hundred and fifty years[^.?!]*/i,
      /\bI conclude, therefore[^.?!]*/i,
      /\bno principality is secure[^.?!]*/i,
      /\bFor first[^.?!]*/i,
      /\bSecondly[^.?!]*/i,
      /\bThirdly[^.?!]*/i,
    ],
    'ethos-credibility-authority': [
      /\bI profess in the sincerity of my heart[^.?!]*/i,
      /\bnot the least personal interest[^.?!]*/i,
      /\bno other motive than the publick good[^.?!]*/i,
      /\bI have been assured by a very knowing American[^.?!]*/i,
      /\bI am assured by our merchants[^.?!]*/i,
      /\bwe are told by a grave author[^.?!]*/i,
      /\bA very worthy person[^.?!]*/i,
      /\bwe are told by a grave author[^.?!]*/i,
      /\bI grant this food[^.?!]*/i,
      /\bI would not deny[^.?!]*/i,
      /\bNevertheless, I insist[^.?!]*/i,
      /\bScripture[^.?!]*/i,
      /\bMr\. C\.P\. Huntington[^.?!]*/i,
      /\blate beloved Frederick Douglass[^.?!]*/i,
      /\bI do not mean in any way to apologize[^.?!]*/i,
      /\bI would set no limits[^.?!]*/i,
      /\bopinion and judgment of wise men[^.?!]*/i,
      /\bmany have written on this point[^.?!]*/i,
      /\bour experience has been[^.?!]*/i,
    ],
    'pathos-emotional-appeal': [
      /\bIt is a melancholy object[^.?!]*/i,
      /\bbeggars of the female sex[^.?!]*/i,
      /\bchildren, all in rags[^.?!]*/i,
      /\bimportuning every passenger for an alms[^.?!]*/i,
      /\bgreat additional grievance[^.?!]*/i,
      /\bpoor innocent babes[^.?!]*/i,
      /\bdeplorable state[^.?!]*/i,
      /\bworked meant degradation[^.?!]*/i,
      /\bcurse of slavery[^.?!]*/i,
      /\bWe few, we happy few[^.?!]*/i,
      /\bsheds his blood with me[^.?!]*/i,
    ],
    'rhetorical-question-repetition': [
      /\bHow then shall the leaders[^.?!?]*\?/i,
      /\bWas the work of these college founders successful[^.?!?]*\?/i,
      /\bThe most interesting question[^.?!]*/i,
      /\bThe question therefore is[^.?!]*/i,
      /\bFor first[^.?!]*/i,
      /\bSecondly[^.?!]*/i,
      /\bThirdly[^.?!]*/i,
      /\bFifthly[^.?!]*/i,
      /\bSixthly[^.?!]*/i,
      /\bIt has been necessary[^.?!]*/i,
      /\bHe that out-lives this day[^.?!]*/i,
      /\bThis day is call[^.?!]*/i,
      /\bCrispian[^.?!]*/i,
    ],
    'figurative-language-purpose': [
      /\bmelancholy object[^.?!]*/i,
      /\bthe whole fabric of science[^.?!]*/i,
      /\bliving oracles[^.?!]*/i,
      /\bbook of nature[^.?!]*/i,
      /\bthe universe stands continually open[^.?!]*/i,
      /\bbarbarous dominion stinks[^.?!]*/i,
      /\bfabric[^.?!]*/i,
      /\bfoundation[^.?!]*/i,
      /\braging rivers[^.?!]*/i,
      /\bband of brothers[^.?!]*/i,
      /\bhousehold words[^.?!]*/i,
    ],
    'purpose-fit-rhetorical-choice': [
      /\bI shall now therefore humbly propose[^.?!]*/i,
      /\bI do therefore humbly offer it to publick consideration[^.?!]*/i,
      /\bI think the advantages by the proposal[^.?!]*/i,
      /\bcomputed the charge[^.?!]*/i,
      /\bHow then shall the leaders[^.?!]*/i,
      /\bThere can be but one answer[^.?!]*/i,
      /\bThese figures illustrate[^.?!]*/i,
      /\bI profess in the sincerity of my heart[^.?!]*/i,
      /\bno other motive than the publick good[^.?!]*/i,
      /\bI close, then, as I began[^.?!]*/i,
      /\bas a freeman he must learn to work[^.?!]*/i,
      /\bfewer men, the greater share of honour[^.?!]*/i,
      /\bIf, therefore, your illustrious house[^.?!]*/i,
      /\bThis opportunity, therefore[^.?!]*/i,
    ],
  };
  const r14Patterns: Record<string, RegExp[]> = {
    'in-medias-res': [
      /\bArms, and the man I sing[^.?!]*/i,
      /\bwho, forc[’']d by fate[^.?!]*/i,
      /\bLong labours, both by sea and land[^.?!]*/i,
      /\bin the doubtful war[^.?!]*/i,
      /\bO Muse[^.?!]*/i,
      /\bTell me, O Muse[^.?!]*/i,
      /\bwho travelled far and wide after he had sacked[^.?!]*/i,
      /\bMany cities did he visit[^.?!]*/i,
      /\bmany were the nations[^.?!]*/i,
      /\bmany the woes he suffered[^.?!]*/i,
      /\bSo now all who escaped death[^.?!]*/i,
      /\band he, though he was longing to return to his wife and country[^.?!]*/i,
      /\bwas detained by the goddess Calypso[^.?!]*/i,
      /\bAll were attentive to the godlike man[^.?!]*/i,
      /\bRenews the sad remembrance of our fate[^.?!]*/i,
      /\bAn empire from its old foundations rent[^.?!]*/i,
      /\bA peopled city made a desert place[^.?!]*/i,
      /\bO goddess-born[^.?!]*escape[^.?!]*/i,
      /\bThe flames and horrors of this fatal night[^.?!]*/i,
      /\bThe foes already have possess[’']d the wall[^.?!]*/i,
      /\bTroy nods from high[^.?!]*/i,
      /\bwand[’']ring long[^.?!]*/i,
      /\bI heard; and Heav[’']n[^.?!]*/i,
      /\bTo run where clashing arms and clamour calls[^.?!]*/i,
      /\bA son and heir, young in his dwelling[^.?!]*/i,
      /\bHe had marked the misery[^.?!]*/i,
      /\bSing, O goddess[^.?!]*/i,
      /\bwrath of Achilles[^.?!]*/i,
      /\bwhich brought countless ills[^.?!]*/i,
      /\bset them both on quarrelling[^.?!]*/i,
      /\bAchilles[^.?!]*Agamemnon[^.?!]*/i,
      /\bstrife[^.?!]*/i,
    ],
    'divine-intervention': [
      /\bMinerva descends[^.?!]*/i,
      /\bby the order of Jupiter[^.?!]*/i,
      /\bmiraculously endued with voice[^.?!]*/i,
      /\bprophecy his fate[^.?!]*/i,
      /\bJove|Jupiter|Minerva|Apollo|god|goddess|heaven|fate|prayer\b/i,
    ],
    'epic-hero-traits': [
      /\bhero obstinately refuses[^.?!]*/i,
      /\brushes with fury to the combat[^.?!]*/i,
      /\bgives himself up to lamentations for his friend[^.?!]*/i,
      /\bbrave|courage|honou?r|glory|battle|spear|endure|loyalty\b/i,
      /\bAchilles|Ulysses|Odysseus|Aeneas|Beowulf|Hector\b/i,
    ],
    'quest-journey-structure': [
      /\bwho travelled far and wide after he had sacked[^.?!]*/i,
      /\bmany the woes he suffered[^.?!]*/i,
      /\btrying to save his own life and bring his men safely home[^.?!]*/i,
      /\bSo now all who escaped death[^.?!]*/i,
      /\bgot to the land[^.?!]*/i,
      /\bItalian shore[^.?!]*/i,
      /\bwe break our sleep[^.?!]*/i,
      /\bForsake the pleasing shore[^.?!]*/i,
      /\bplow the deep[^.?!]*/i,
      /\bship|sea|shore|journey|return|home|island|sail|voyage|wander\b/i,
    ],
    'ritual-speech-oath': [
      /\bprayed much and made drink offerings[^.?!]*/i,
      /\bbowl of sweet wine[^.?!]*/i,
      /\bprayer|offering|wine|feast|sacrifice|oath|spoke|said|answered|hospitality\b/i,
      /\bMinerva, daughter of Aegis-bearing Jove[^.?!]*/i,
    ],
    'theme-through-heroic-action': [
      /\brushes with fury to the combat[^.?!]*/i,
      /\brefuses all repast[^.?!]*/i,
      /\blamentations for his friend[^.?!]*/i,
      /\bhonou?r|fate|loyalty|home|death|glory|choice|battle|courage|friend|sacrifice\b/i,
    ],
    'elevated-style-epic-simile': [
      /\bSing, O goddess[^.?!]*/i,
      /\bbright Orion, arm[’']d with burnish[’']d gold[^.?!]*/i,
      /\bThe night, proceeding on with silent pace[^.?!]*/i,
      /\blike [^,.!?]+/i,
      /\bas when [^,.!?]+/i,
      /\bheaven|radiant|burnish|glory|Muse|wrath|arms\b/i,
    ],
  };
  const r32Patterns: Record<string, RegExp[]> = {
    'chunk-complex-syntax': [
      /\b[^.?!]*(?:although|because|while|when|which|who|that|therefore|however|but|yet|so that|whereas|nevertheless)[^.?!]*[.?!]/i,
      /\b[^.?!]*[,;:—-][^.?!]*(?:because|therefore|however|but|yet|if|when|while|which|who|that)[^.?!]*[.?!]/i,
    ],
    'preserve-original-meaning': [
      /\b[^.?!]*(?:because|therefore|however|although|but|yet|if|when|while|so that|instead|rather than|unless|except|without)[^.?!]*[.?!]/i,
      /\b[^.?!]*(?:must|should|cannot|no longer|not|never|only|all|none|every|both)[^.?!]*[.?!]/i,
    ],
    'translate-archaic-or-formal-language': [
      /\b[^.?!]*(?:hath|thou|thee|thy|shall|wherefore|hence|therefore|lest|whence|thus|consequently|publick|honou?r|doth|ne'er|o'er|forc[’']d|view[’']d|ev[’']ry)[^.?!]*[.?!]/i,
      /\b[^.?!]*(?:motive|sincerity|consideration|advantage|illustrious|dominion|manifest|secure|liberty|expedient|melancholy object)[^.?!]*[.?!]/i,
    ],
    'paraphrase-claim-or-theme': [
      /\b[^.?!]*(?:truth|therefore|thus|must|should|means|shows|purpose|motive|idea|answer|question|conclude|believe|I say|I profess)[^.?!]*[.?!]/i,
      /\b[^.?!]*(?:love|death|life|freedom|justice|power|honou?r|duty|fear|hope|truth|equal|publick good|country)[^.?!]*[.?!]/i,
    ],
  };
  const patternsByStandard: Record<string, RegExp[]> = {
    'ELA.9.R.1.1':
      subSkillId === 'setting-layer'
        ? r11SettingPatterns
        : subSkillId === 'plot-conflict-layer'
          ? r11PlotPatterns
          : subSkillId === 'characterization-layer'
            ? r11CharacterPatterns
            : subSkillId === 'point-of-view-layer'
              ? r11PovPatterns
              : subSkillId === 'theme-tone-layer'
                ? r11ThemeTonePatterns
                : subSkillId === 'style-technique-layer'
                  ? r11StylePatterns
                  : [
                      ...r11SettingPatterns,
                      ...r11PlotPatterns,
                      ...r11CharacterPatterns,
                      ...r11PovPatterns,
                      ...r11ThemeTonePatterns,
                      ...r11StylePatterns,
    ],
    'ELA.9.R.1.2': subSkillId ? r12Patterns[subSkillId] ?? [] : Object.values(r12Patterns).flat(),
    'ELA.9.R.1.3': subSkillId ? r13Patterns[subSkillId] ?? [] : Object.values(r13Patterns).flat(),
    'ELA.9.R.2.1': subSkillId ? r21Patterns[subSkillId] ?? [] : Object.values(r21Patterns).flat(),
    'ELA.9.R.2.2': subSkillId ? r22Patterns[subSkillId] ?? [] : Object.values(r22Patterns).flat(),
    'ELA.9.R.2.3': subSkillId ? r23Patterns[subSkillId] ?? [] : Object.values(r23Patterns).flat(),
    'ELA.9.R.3.1':
      subSkillId === 'metaphor-simile'
        ? [/\blike [^,.!?]+/i, /\bas if [^,.!?]+/i, /\bas though [^,.!?]+/i, /\bLove is a smoke[^,.!?]*/i]
        : subSkillId === 'personification-effect'
          ? [
              /\b(?:sun|night|fog|wind|fireplace|furniture|house|forest|sea|shore|sky|storm|light|shadow|silence|death)\b[^.!?]*(?:crept|rubbed|licked|looked|asked|confronted|whispered|slept|stood|watched|called|seized|pressed|threatened)[^.!?]*/i,
              /\byellow fog[^.!?]*/i,
              /\byellow smoke[^.!?]*/i,
              /\bfurniture[^.!?]*inquiry[^.!?]*/i,
              /\bsun withdrawn his radiant light[^.!?]*/i,
              /\bview[’']d with equal face[^.!?]*/i,
            ]
          : subSkillId === 'imagery-sensory-language'
            ? [
                /\b(?:dark|cold|bright|yellow|green|white|black|gold|shadow|silence|sound|voice|warm|frost|mist|fog|smoke|light|night|stars|moon|sun)[^.!?]*/i,
                /\bwoods were already filled with shadows[^.!?]*/i,
                /\bdusky shades of night[^.!?]*/i,
              ]
            : subSkillId === 'symbol-object-meaning'
              ? [/\b(?:heron|bird|apple|golden apples|wine|fireplace|window|light|darkness|shadow|flower|crown|chain|stone|smoke|fog|star)[^.!?]*/i]
              : subSkillId === 'mood-shift-effect'
                ? [/\b(?:at first|then|now|suddenly|but|yet|no longer|changed|until|after)[^.!?]*/i, /\b(?:dark|cold|lonely|dread|fear|joy|hope|terror|silent|safe|threatening|uneasy|peaceful|wonder)[^.!?]*/i]
                : [
                    /\blike [^,.]+/i,
                    /\bas if [^,.]+/i,
                    /\bas though [^,.]+/i,
                    /\bseemed [^,.]+/i,
                  ],
    'ELA.9.R.3.2': subSkillId ? r32Patterns[subSkillId] ?? [] : Object.values(r32Patterns).flat(),
    'ELA.9.R.1.4': subSkillId ? r14Patterns[subSkillId] ?? [] : Object.values(r14Patterns).flat(),
  };

  for (const pattern of patternsByStandard[standard] ?? []) {
    const match = excerpt.match(pattern);
    if (match?.[0]) {
      const matched = match[0].trim();
      const sentence = sentences(excerpt).find((item) => pattern.test(item));
      const point = matched.length < 16 && sentence ? sentence.slice(0, 140).trim() : matched;
      points.push(point);
    }
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'setting-layer') {
    const settingFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|where|while|though|when)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 170) return false;
        return (
          countMatches(fragment, R11_SETTING_PLACE_PATTERNS) >= 1 ||
          countMatches(fragment, R11_SETTING_EFFECT_PATTERNS) >= 1
        );
      })
      .map((fragment) => (fragment.length > 145 ? `${fragment.slice(0, 142).trim()}...` : fragment));
    points.push(...settingFragments);
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'style-technique-layer') {
    if (/\bas in a mirror\b/i.test(excerpt)) points.push('as in a mirror');
    if (/\bsomething which glittered\b/i.test(excerpt)) points.push('something which glittered');
    if (/\bshining shield\b/i.test(excerpt)) points.push('shining shield');
    if (/\bfoul weeds\b/i.test(excerpt)) points.push('foul weeds');
  }

  if (standard === 'ELA.9.R.1.2' && subSkillId) {
    const r12Rules = patternsByStandard['ELA.9.R.1.2'] ?? [];
    const themeFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|when|while|for|then|where|who|whom|whose|because)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 180) return false;
        return r12Rules.some((pattern) => pattern.test(fragment));
      })
      .map((fragment) => (fragment.length > 150 ? `${fragment.slice(0, 147).trim()}...` : fragment));
    points.push(...themeFragments);
  }

  if (standard === 'ELA.9.R.1.3' && subSkillId) {
    const r13Rules = patternsByStandard['ELA.9.R.1.3'] ?? [];
    const perspectiveFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|when|while|for|then|where|who|whom|whose|because)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 190) return false;
        return r13Rules.some((pattern) => pattern.test(fragment));
      })
      .map((fragment) => (fragment.length > 155 ? `${fragment.slice(0, 152).trim()}...` : fragment));
    points.push(...perspectiveFragments);
  }

  if (standard === 'ELA.9.R.2.1' && subSkillId) {
    const r21Rules = patternsByStandard['ELA.9.R.2.1'] ?? [];
    const structureFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|when|while|for|then|where|who|whom|whose|because|therefore|which)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 190) return false;
        return r21Rules.some((pattern) => pattern.test(fragment));
      })
      .map((fragment) => (fragment.length > 155 ? `${fragment.slice(0, 152).trim()}...` : fragment));
    points.push(...structureFragments);
  }

  if (standard === 'ELA.9.R.2.2' && subSkillId) {
    const r22Rules = patternsByStandard['ELA.9.R.2.2'] ?? [];
    const evidenceFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|when|while|for|then|where|who|whom|whose|because|therefore|which)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 200) return false;
        return r22Rules.some((pattern) => pattern.test(fragment));
      })
      .map((fragment) => (fragment.length > 165 ? `${fragment.slice(0, 162).trim()}...` : fragment));
    points.push(...evidenceFragments);
  }

  if (standard === 'ELA.9.R.2.3' && subSkillId) {
    const r23Rules = patternsByStandard['ELA.9.R.2.3'] ?? [];
    const rhetoricFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|when|while|for|then|where|who|whom|whose|because|therefore|which)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 210) return false;
        return r23Rules.some((pattern) => pattern.test(fragment));
      })
      .map((fragment) => (fragment.length > 170 ? `${fragment.slice(0, 167).trim()}...` : fragment));
    points.push(...rhetoricFragments);
  }

  if (standard === 'ELA.9.R.1.4' && subSkillId) {
    const r14Rules = patternsByStandard['ELA.9.R.1.4'] ?? [];
    const epicFragments = excerpt
      .split(/(?<=[.;!?])\s+|,\s+(?=(?:and|but|when|while|for|then|where|who|whom|whose)\b)/i)
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => {
        if (fragment.length < 18 || fragment.length > 180) return false;
        return r14Rules.some((pattern) => pattern.test(fragment));
      })
      .map((fragment) => (fragment.length > 150 ? `${fragment.slice(0, 147).trim()}...` : fragment));
    points.push(...epicFragments);
  }

  return cleanEvidencePoints(points);
}

export function classifyPullOutSubSkill(
  standard: string,
  excerpt: string,
  requestedSubSkillId?: string | null
) {
  if (
    requestedSubSkillId &&
    ELA9_READING_SKILL_MOVES.some(
      (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
    )
  ) {
    return requestedSubSkillId;
  }
  if (standard !== 'ELA.9.R.1.1') return null;

  const text = excerpt.toLowerCase();
  const scores = [
    { id: 'setting-layer', score: scoreForSubSkill('setting-layer', text) },
    { id: 'plot-conflict-layer', score: scoreForSubSkill('plot-conflict-layer', text) },
    { id: 'characterization-layer', score: scoreForSubSkill('characterization-layer', text) },
    { id: 'point-of-view-layer', score: scoreForSubSkill('point-of-view-layer', text) },
    { id: 'theme-tone-layer', score: scoreForSubSkill('theme-tone-layer', text) },
    { id: 'style-technique-layer', score: scoreForSubSkill('style-technique-layer', text) },
  ].sort((a, b) => b.score - a.score);

  return scores[0]?.score ? scores[0].id : 'setting-layer';
}

function skillFocusFor(standard: string, excerpt: string, requestedSubSkillId?: string | null) {
  if (standard === 'ELA.9.R.1.1') {
    const subSkillId = classifyPullOutSubSkill(standard, excerpt, requestedSubSkillId);
    return (
      R11_SUB_SKILLS.find((skill) => skill.strandId === subSkillId)?.label ??
      'Key literary element adds meaning/style'
    );
  }
  if (standard === 'ELA.9.R.3.1' && requestedSubSkillId) {
    return (
      ELA9_READING_SKILL_MOVES.find(
        (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
      )?.label ?? 'Figurative language creates mood'
    );
  }
  if (standard === 'ELA.9.R.3.1') return 'Figurative language creates mood';
  if (standard === 'ELA.9.R.1.4' && requestedSubSkillId) {
    return (
      ELA9_READING_SKILL_MOVES.find(
        (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
      )?.label ?? 'Epic convention develops structure or theme'
    );
  }
  if (standard === 'ELA.9.R.1.4') return 'Epic convention develops structure or theme';
  if (standard === 'ELA.9.R.1.3' && requestedSubSkillId) {
    return (
      ELA9_READING_SKILL_MOVES.find(
        (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
      )?.label ?? 'Narrator perspective, irony, or satire'
    );
  }
  if (standard === 'ELA.9.R.1.3') return 'Narrator perspective, irony, or satire';
  if (standard === 'ELA.9.R.2.1' && requestedSubSkillId) {
    return (
      ELA9_READING_SKILL_MOVES.find(
        (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
      )?.label ?? 'Text structure and feature purpose'
    );
  }
  if (standard === 'ELA.9.R.2.1') return 'Text structure and feature purpose';
  if (standard === 'ELA.9.R.2.2' && requestedSubSkillId) {
    return (
      ELA9_READING_SKILL_MOVES.find(
        (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
      )?.label ?? 'Central idea and supporting evidence'
    );
  }
  if (standard === 'ELA.9.R.2.2') return 'Central idea and supporting evidence';
  if (standard === 'ELA.9.R.2.3' && requestedSubSkillId) {
    return (
      ELA9_READING_SKILL_MOVES.find(
        (skill) => skill.standardCode === standard && skill.strandId === requestedSubSkillId
      )?.label ?? 'Rhetorical appeals and author purpose'
    );
  }
  if (standard === 'ELA.9.R.2.3') return 'Rhetorical appeals and author purpose';
  return STANDARD_LABELS[standard] ?? 'Standard skill';
}

function instructionalSupportFor(
  standard: string,
  subSkillId: string | null,
  skillFocus: string
): PullOutRow['instructionalSupport'] | undefined {
  if (standard === 'ELA.9.R.1.1' && subSkillId === 'setting-layer') {
    return {
      title: 'Teach setting as meaning, not location',
      teachFirst: [
        'Setting is more than where and when a scene happens.',
        'Writers use setting details to create mood, pressure, conflict, or a layer of meaning.',
        'A strong answer explains what the setting makes the reader understand, not just what the place looks like.',
      ],
      cornellNotes: [
        'Setting = time/place + details that shape meaning.',
        'Setting can create mood, reveal danger, increase tension, or show change.',
        'R.1.1 move: setting detail -> effect on reader -> why it matters.',
      ],
      studentStrategy: [
        'Find the exact setting words.',
        'Name the feeling, problem, or change those words create.',
        'Connect that effect to the character, conflict, mood, or meaning of the excerpt.',
      ],
      prometheanPrompt:
        'Which exact setting words matter most here, and what do they make the reader understand that a plain location would not?',
      successCriteria: [
        'Student points to exact setting evidence.',
        'Student explains the effect of the setting detail.',
        'Student avoids answers that only summarize where the scene happens.',
      ],
    };
  }

  if (standard === 'ELA.9.R.1.1') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'A literary element matters when it adds meaning, style, mood, tension, or reader understanding.',
        'Students should explain the job of the evidence, not just restate what happened.',
      ],
      cornellNotes: [
        `${skillFocus}: exact evidence plus effect.`,
        'Strong answers explain why the author included the detail.',
      ],
      studentStrategy: [
        'Find the exact evidence.',
        'Name the literary element or technique.',
        'Explain what it adds to meaning or style.',
      ],
      prometheanPrompt: 'What does this evidence make the reader understand beyond the surface event?',
      successCriteria: [
        'Student uses exact evidence.',
        'Student explains effect instead of summary.',
        'Student connects the evidence to the standard skill.',
      ],
    };
  }

  if (standard === 'ELA.9.V.1.2') {
    return {
      title: 'Teach word parts with context confirmation',
      teachFirst: [
        'Word parts can give a first clue, but context has to confirm the meaning.',
        'Students should split the word only when the parts are useful and visible.',
        'A strong answer explains both the word-part clue and the sentence clue.',
      ],
      cornellNotes: [
        'V.1.2 strategy: split the word, define the parts, reread the sentence.',
        'Do not stop at the prefix/root/suffix; confirm the meaning in context.',
        'Strong vocabulary answers fit the whole sentence, not just the word part.',
      ],
      studentStrategy: [
        'Box the target word.',
        'Split the useful word part.',
        'Use nearby context to test the meaning.',
      ],
      prometheanPrompt:
        'Which word part gives the clue, and which context words prove that meaning is right here?',
      successCriteria: [
        'Student identifies a useful word part.',
        'Student confirms meaning with nearby context.',
        'Student rejects meanings that fit the word part but not the sentence.',
      ],
    };
  }

  if (standard === 'ELA.9.V.1.3') {
    return {
      title: 'Teach precise meaning from context',
      teachFirst: [
        'Context clues are the nearby words, examples, contrasts, or sentence logic that prove a meaning.',
        'Students should choose the meaning that fits this exact sentence, not the first familiar synonym.',
        'A strong answer names the clue that proves the meaning.',
      ],
      cornellNotes: [
        'V.1.3 strategy: replace the word, reread, and test the tone.',
        'Denotation = dictionary meaning. Connotation = feeling or association.',
        'Strong vocabulary answers fit the context and the author’s tone.',
      ],
      studentStrategy: [
        'Box the target word or phrase.',
        'Underline the context clue before and after it.',
        'Test each answer choice inside the sentence.',
      ],
      prometheanPrompt:
        'Which nearby words prove the meaning, and why do the other choices fail in this sentence?',
      successCriteria: [
        'Student uses a specific context clue.',
        'Student chooses the meaning that fits the sentence and tone.',
        'Student can explain why a familiar synonym is wrong here.',
      ],
    };
  }

  if (standard === 'ELA.9.R.3.1' && subSkillId) {
    const copy = R31_SUB_SKILL_TEACHER_COPY[subSkillId];
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Figurative language matters when it changes what the reader feels or understands.',
        'Students should translate the figurative language literally, then explain the mood or effect it creates.',
        'A strong answer names the language move and proves the effect with exact words from the excerpt.',
      ],
      cornellNotes: [
        `${skillFocus}: exact figurative language plus mood/effect.`,
        'R.3.1 strategy: name the language, translate it, explain the mood or meaning it creates.',
        copy?.move ?? 'When the author uses ___, the language creates ___ because ___.',
      ],
      studentStrategy: [
        'Find the exact figurative or sensory language.',
        'Say what the language literally suggests.',
        'Connect that suggestion to the mood, meaning, or reader effect.',
      ],
      prometheanPrompt:
        'What exact language creates the feeling here, and how does that language make the reader feel or understand more?',
      successCriteria: [
        'Student points to exact figurative or sensory words.',
        'Student explains the meaning of the language in context.',
        'Student connects the language to mood, meaning, or reader effect.',
      ],
    };
  }

  if (standard === 'ELA.9.R.1.4') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Epic poetry is tested through characters, structures, conventions, and themes.',
        'Students should name the epic convention first, then explain what the evidence does.',
      ],
      cornellNotes: [
        `${skillFocus}: exact epic evidence plus effect.`,
        'Strong answers connect the convention to character, structure, theme, tension, or epic values.',
      ],
      studentStrategy: [
        'Find the exact epic evidence.',
        'Name the convention or hero trait.',
        'Explain how that convention shapes the action, structure, theme, or meaning.',
      ],
      prometheanPrompt:
        'What epic convention is visible here, and how does it change what the reader understands about the hero, structure, or theme?',
      successCriteria: [
        'Student points to exact epic evidence.',
        'Student names the convention or trait.',
        'Student explains the effect instead of only retelling the event.',
      ],
    };
  }

  if (standard === 'ELA.9.R.1.2') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'A theme is a complete idea, not a topic word.',
        'Universal themes can apply beyond the story to people, choices, life, or society.',
      ],
      cornellNotes: [
        `${skillFocus}: topic plus exact evidence plus life idea.`,
        'Strong answers explain how the moment develops the theme, not just what happened.',
      ],
      studentStrategy: [
        'Name the topic in one word.',
        'Turn the topic into a complete idea about life or people.',
        'Prove the idea with exact evidence from the excerpt.',
      ],
      prometheanPrompt:
        'What idea about people, choices, or life does this moment teach, and which exact words prove it?',
      successCriteria: [
        'Student states a complete universal theme.',
        'Student uses exact evidence.',
        'Student connects the evidence to theme development instead of plot summary.',
      ],
    };
  }

  if (standard === 'ELA.9.R.1.3') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Perspective, irony, and satire all depend on a gap.',
        'Students need to separate surface meaning from what the reader understands underneath.',
      ],
      cornellNotes: [
        `${skillFocus}: surface meaning plus reader understanding plus effect.`,
        'Strong answers explain the gap, contrast, reversal, or criticism instead of only labeling it.',
      ],
      studentStrategy: [
        'Column 1: what is said, believed, expected, or proposed.',
        'Column 2: what the reader understands is actually true.',
        'Explain how that gap shapes meaning, irony, satire, or reader judgment.',
      ],
      prometheanPrompt:
        'What is the surface meaning here, what does the reader understand underneath, and why does that gap matter?',
      successCriteria: [
        'Student identifies the surface meaning.',
        'Student explains what the reader understands underneath.',
        'Student connects the gap to perspective, irony, satire, or author criticism.',
      ],
    };
  }

  if (standard === 'ELA.9.R.2.1') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Text structure is the way an author organizes information.',
        'Students should explain the job of the structure, not just name the structure.',
        'A strong answer connects organization to purpose, meaning, or reader understanding.',
      ],
      cornellNotes: [
        `${skillFocus}: signal words plus structure job plus author purpose.`,
        'Strong answers explain how the organization helps the reader follow, compare, prove, or understand the point.',
      ],
      studentStrategy: [
        'Mark the structure signal words.',
        'Name the structure: sequence, cause/effect, contrast, problem/solution, evidence, or shift.',
        'Explain what that structure helps the author do.',
      ],
      prometheanPrompt:
        'How is this information organized, and what does that organization help the reader understand?',
      successCriteria: [
        'Student identifies structure from exact words.',
        'Student explains the structure’s job.',
        'Student connects the structure to author purpose or meaning.',
      ],
    };
  }

  if (standard === 'ELA.9.R.2.2') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Central idea is the author’s controlling point, not one interesting detail.',
        'Strong evidence directly proves, clarifies, or develops that point.',
        'Students should compare evidence choices and reject true details that do not prove the central idea.',
      ],
      cornellNotes: [
        `${skillFocus}: central idea plus proof plus explanation.`,
        'Strong answers say what the evidence proves about the author’s main point.',
      ],
      studentStrategy: [
        'State the central idea in plain English.',
        'Underline the evidence that most directly proves it.',
        'Explain how the evidence strengthens, clarifies, extends, or develops the idea.',
      ],
      prometheanPrompt:
        'What is the author’s main point here, and which exact evidence makes that point stronger?',
      successCriteria: [
        'Student states the central idea, not a single detail.',
        'Student chooses evidence that directly supports the idea.',
        'Student explains how the evidence develops the central idea.',
      ],
    };
  }

  if (standard === 'ELA.9.R.2.3') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'A rhetorical move is something the author does to shape the reader’s thinking or feeling.',
        'Students should name the move, explain the reader effect, then connect it to purpose.',
        'A strong answer explains why this move fits this author’s goal in this excerpt.',
      ],
      cornellNotes: [
        `${skillFocus}: rhetorical move plus reader effect plus author purpose.`,
        'Strong answers do not stop at ethos, pathos, logos, or device labels.',
      ],
      studentStrategy: [
        'Find the exact rhetorical language.',
        'Name the move: logic, credibility, emotion, question, repetition, or figurative language.',
        'Explain how the move helps the author persuade, clarify, criticize, or emphasize a point.',
      ],
      prometheanPrompt:
        'What is the author doing to the reader here, and how does that help the author’s purpose?',
      successCriteria: [
        'Student points to exact rhetorical evidence.',
        'Student names the rhetorical move accurately.',
        'Student connects the move to author purpose instead of only labeling it.',
      ],
    };
  }

  if (standard === 'ELA.9.R.2.4') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Two-passage questions are solved by separating the arguments first.',
        'A stronger argument has relevant evidence that directly supports the claim.',
        'Students should not choose the side they agree with; they choose the side that is better supported.',
      ],
      cornellNotes: [
        `${skillFocus}: Passage A claim plus Passage A evidence; Passage B claim plus Passage B evidence.`,
        'Validity means the claim is supported by relevant, logical evidence.',
      ],
      studentStrategy: [
        'Make two columns: Passage A and Passage B.',
        'Write each side’s claim in one sentence.',
        'Underline the evidence for each side, then decide which support is stronger.',
      ],
      prometheanPrompt:
        'What does each side claim, what evidence supports it, and which argument is more valid?',
      successCriteria: [
        'Student keeps the two claims separate.',
        'Student matches evidence to the correct side.',
        'Student evaluates support instead of choosing a favorite opinion.',
      ],
    };
  }

  if (standard === 'ELA.9.R.3.2') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Paraphrase means same meaning, new words.',
        'Students should not add, delete, or twist the author’s idea.',
        'Strong paraphrases keep the important relationships: cause, contrast, condition, sequence, and claim.',
      ],
      cornellNotes: [
        `${skillFocus}: keep meaning plus simplify wording.`,
        'A strong paraphrase keeps every important idea from the original.',
      ],
      studentStrategy: [
        'Circle the subject and action.',
        'Underline relationship words like because, but, if, although, therefore, or only.',
        'Restate the sentence in plain English and check that nothing important changed.',
      ],
      prometheanPrompt:
        'What does this sentence really say, and which answer keeps that meaning without adding or deleting?',
      successCriteria: [
        'Student identifies the original meaning.',
        'Student preserves all key ideas and relationships.',
        'Student rejects paraphrases that add, omit, or twist meaning.',
      ],
    };
  }

  if (standard === 'ELA.9.R.3.4') {
    return {
      title: `Teach ${skillFocus.toLowerCase()}`,
      teachFirst: [
        'Rhetoric is language designed to shape the reader’s thinking, feeling, or attention.',
        'Students should explain the effect of the move, not just label it.',
        'A strong answer connects exact words to reader effect and author purpose.',
      ],
      cornellNotes: [
        `${skillFocus}: rhetorical move plus reader effect plus purpose.`,
        'Strong answers say what the words make the reader believe, feel, or notice.',
      ],
      studentStrategy: [
        'Underline the exact rhetorical language.',
        'Name the move: question, repetition, direct address, emotional appeal, logic, or loaded word choice.',
        'Finish: the author wants the reader to think/feel/notice ___.',
      ],
      prometheanPrompt:
        'What is the author doing to the reader here, and how does that help the author’s purpose?',
      successCriteria: [
        'Student points to exact rhetoric.',
        'Student explains reader effect.',
        'Student connects the effect to purpose.',
      ],
    };
  }

  return undefined;
}

function qualityGateFor(args: {
  standard: string;
  subSkillId: string | null;
  skillFocus: string;
  excerpt: string;
  question: ReturnType<typeof anchorQuestion>;
  evidencePoints: string[];
  instructionalSupport?: PullOutRow['instructionalSupport'];
}): PullOutRow['qualityGate'] {
  const checks: string[] = [];
  const hasTeachLayer = Boolean(args.instructionalSupport?.teachFirst.length);
  const isPerspectiveSkill = args.standard === 'ELA.9.R.1.3';
  const isStructureSkill = args.standard === 'ELA.9.R.2.1';
  const isCentralIdeaSkill = args.standard === 'ELA.9.R.2.2';
  const isRhetoricSkill = args.standard === 'ELA.9.R.2.3';
  const isPairedArgumentSkill = args.standard === 'ELA.9.R.2.4';
  const isFigurativeSkill = args.standard === 'ELA.9.R.3.1';
  const isParaphraseSkill = args.standard === 'ELA.9.R.3.2';
  const isEpicSkill = args.standard === 'ELA.9.R.1.4';
  const hasCleanEvidence =
    args.evidencePoints.length >=
    (isStructureSkill ||
    isCentralIdeaSkill ||
    isRhetoricSkill ||
    isPairedArgumentSkill ||
    isFigurativeSkill ||
    isParaphraseSkill ||
    isEpicSkill
      ? 1
      : isPerspectiveSkill || args.subSkillId === 'style-technique-layer'
        ? 2
        : 3);
  const hasFastCheck = args.question.choices.length === 4 && args.question.choices.some((choice) => choice.correct);
  const plausibleDistractors = hasPlausibleDistractors(args.question);
  const isThemeSkill = args.standard === 'ELA.9.R.1.2';
  const isManageable =
    wordCount(args.excerpt) >= (isStructureSkill || isCentralIdeaSkill || isRhetoricSkill || isPairedArgumentSkill ? 120 : isParaphraseSkill || isFigurativeSkill ? 30 : isEpicSkill || isThemeSkill || isPerspectiveSkill ? 55 : 65) &&
    wordCount(args.excerpt) <= (isStructureSkill || isCentralIdeaSkill || isRhetoricSkill || isPairedArgumentSkill ? 420 : isParaphraseSkill || isEpicSkill || isFigurativeSkill ? 220 : 180);
  const answerGiveaway =
    args.subSkillId === 'characterization-layer' &&
    countMatches(args.excerpt, R11_CHARACTERIZATION_GIVEAWAY_PATTERNS) > 0;
  const settingWrongLane =
    args.subSkillId === 'setting-layer' &&
    /\bsea monster was close at hand|opening his wide jaws|turned into stone\b/i.test(args.excerpt);

  if (hasTeachLayer) checks.push('Teach layer pinned');
  if (isManageable) checks.push('Excerpt is classroom-sized');
  if (hasCleanEvidence) checks.push('Evidence is pointable');
  if (hasFastCheck) checks.push('FAST-style check present');
  if (plausibleDistractors) checks.push('Distractors require thinking');
  if (!answerGiveaway) checks.push('Answer is not directly given away');
  if (!settingWrongLane) checks.push('Card is in the right subskill lane');

  const passed =
    hasTeachLayer &&
    hasCleanEvidence &&
    hasFastCheck &&
    (plausibleDistractors || isEpicSkill) &&
    isManageable &&
    !answerGiveaway &&
    !settingWrongLane;

  return {
    status: passed ? 'gold' : hasTeachLayer && hasFastCheck ? 'candidate' : 'revise',
    label: passed ? 'Gold card' : hasTeachLayer && hasFastCheck ? 'Candidate card' : 'Needs revision',
    checks,
  };
}

function teacherTrustFor(args: {
  standard: string;
  excerpt: string;
  evidencePoints: string[];
  skillFocus: string;
}): PullOutRow['teacherTrust'] {
  const words = wordCount(args.excerpt);
  const isPerspectiveSkill = args.standard === 'ELA.9.R.1.3';
  const isStructureSkill = args.standard === 'ELA.9.R.2.1';
  const isCentralIdeaSkill = args.standard === 'ELA.9.R.2.2';
  const isRhetoricSkill = args.standard === 'ELA.9.R.2.3';
  const isPairedArgumentSkill = args.standard === 'ELA.9.R.2.4';
  const isFigurativeSkill = args.standard === 'ELA.9.R.3.1';
  const isParaphraseSkill = args.standard === 'ELA.9.R.3.2';
  const isEpicSkill = args.standard === 'ELA.9.R.1.4';
  const hasEnoughEvidence =
    args.evidencePoints.length >=
    (isStructureSkill ||
    isCentralIdeaSkill ||
    isRhetoricSkill ||
    isPairedArgumentSkill ||
    isFigurativeSkill ||
    isParaphraseSkill ||
    isEpicSkill
      ? 1
      : isPerspectiveSkill || args.skillFocus.toLowerCase().includes('style technique')
        ? 2
        : 3);
  const isThemeSkill = args.standard === 'ELA.9.R.1.2';
  const isManageable =
    words >= (isStructureSkill || isCentralIdeaSkill || isRhetoricSkill || isPairedArgumentSkill ? 120 : isParaphraseSkill || isFigurativeSkill ? 30 : isEpicSkill || isThemeSkill || isPerspectiveSkill ? 55 : 65) &&
    words <= (isStructureSkill || isCentralIdeaSkill || isRhetoricSkill || isPairedArgumentSkill ? 420 : isParaphraseSkill || isEpicSkill || isFigurativeSkill ? 220 : 180);
  const confidence: PullOutRow['teacherTrust']['confidence'] =
    hasEnoughEvidence && isManageable ? 'strong' : hasEnoughEvidence ? 'emerging' : 'weak';

  return {
    confidence,
    officialTextMap: true,
    localSourceText: true,
    excerptWords: words,
    evidencePoints: args.evidencePoints,
    useCase: '15-minute Promethean pull-out',
    whyTrustIt:
      confidence === 'strong'
          ? `Multiple exact details support ${args.skillFocus.toLowerCase()}, and the excerpt is short enough for paraphrase, a reusable strategy, and one anchor question.`
        : confidence === 'emerging'
          ? `The excerpt has teachable evidence for ${args.skillFocus.toLowerCase()}, but it may need teacher trimming or a tighter question.`
          : `This is a possible pull-out, but it needs teacher review before use because the evidence signal is thin.`,
  };
}

const R11_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'setting-layer': {
    why:
      'Uses setting details students can point to and connect to mood, conflict, meaning, or style.',
    move:
      'When the author describes the setting as ___, that is setting doing meaning/style work because it makes the reader understand ___.',
  },
  'plot-conflict-layer': {
    why:
      'Centers on an event, conflict, choice, or consequence that creates meaning beyond plot summary.',
    move:
      'When the author creates the event/conflict ___, that is plot or conflict doing meaning work because it reveals ___.',
  },
  'characterization-layer': {
    why:
      'Includes a character action, thought, speech, or description that can be used to infer meaning.',
    move:
      'When the character ___, that is characterization doing meaning work because it reveals ___.',
  },
  'point-of-view-layer': {
    why:
      'Shows a narrator or viewpoint clue that shapes what the reader notices, trusts, or understands.',
    move:
      'When the narrator or speaker ___, that is point of view shaping meaning because the reader understands ___.',
  },
  'theme-tone-layer': {
    why:
      'Contains a literary element with clear thematic or tonal force that students can prove from exact words.',
    move:
      'When the author emphasizes ___, that is theme or tone doing meaning work because it points to ___.',
  },
  'style-technique-layer': {
    why:
      'Uses pointable diction, syntax, image, or figurative technique that changes the reader’s response.',
    move:
      'When the author uses ___, that is style doing meaning work because it makes the reader notice or feel ___.',
  },
};

const R14_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'in-medias-res': {
    why:
      'Shows epic structure by dropping the reader into conflict or action that has already started.',
    move:
      'When the epic begins with ___ already happening, that is in medias res because it makes the reader infer ___ and feel ___.',
  },
  'divine-intervention': {
    why:
      'Shows a god, prayer, prophecy, fate, or supernatural force changing the action or meaning.',
    move:
      'When ___ intervenes or is invoked, that is divine intervention because it changes ___ and shows ___.',
  },
  'epic-hero-traits': {
    why:
      'Gives a hero action, speech, or choice that reveals an epic trait such as courage, pride, loyalty, or endurance.',
    move:
      'When the hero ___, that reveals the epic trait of ___ because ___.',
  },
  'quest-journey-structure': {
    why:
      'Shows a journey stage, obstacle, departure, test, or return moment that shapes the epic structure.',
    move:
      'When the hero or crew ___, that is a journey-stage moment because it moves the epic toward ___.',
  },
  'ritual-speech-oath': {
    why:
      'Includes a formal speech, prayer, offering, feast, oath, burial, or hospitality moment that reveals epic values.',
    move:
      'When the epic includes ___, that ritual or speech reveals the value of ___ because ___.',
  },
  'theme-through-heroic-action': {
    why:
      'Uses a heroic choice or action to develop an epic theme such as honor, fate, loyalty, homecoming, or sacrifice.',
    move:
      'When the hero ___, that action develops the theme of ___ because ___.',
  },
  'elevated-style-epic-simile': {
    why:
      'Uses elevated diction, invocation, repeated phrasing, or comparison to make the action feel larger than ordinary life.',
    move:
      'When the poet uses ___, that elevated style makes ___ seem ___ because ___.',
  },
};

const R12_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'universal-theme': {
    why:
      'Contains a transferable idea students can state as a complete theme instead of a one-word topic.',
    move:
      'When the text shows ___, that develops the universal theme that ___ because ___.',
  },
  'theme-development-moments': {
    why:
      'Shows multiple details in the same moment that develop or complicate one universal idea.',
    move:
      'When the text first shows ___ and then ___, the theme develops because ___.',
  },
  'theme-through-conflict': {
    why:
      'Uses a conflict, choice, consequence, or realization to make the theme visible.',
    move:
      'When the character faces ___, that conflict develops the theme that ___ because ___.',
  },
};

const R13_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'narrator-perspective': {
    why:
      'Shows a narrator or speaker lens that shapes what the reader notices, trusts, questions, or understands.',
    move:
      'When the narrator or speaker focuses on ___, that perspective shapes the reader’s understanding because ___.',
  },
  'irony-reversal-contrast': {
    why:
      'Creates a gap between what is said, expected, or believed and what the reader understands is actually true.',
    move:
      'When the text says or expects ___, but the reader understands ___, that creates irony because ___.',
  },
  'satire-exaggeration-ridicule': {
    why:
      'Uses exaggeration, fake seriousness, or ridiculous logic to criticize a real social problem.',
    move:
      'When the speaker treats ___ as reasonable, that creates satire because the reader understands ___.',
  },
};

const R21_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'chronological-sequence': {
    why:
      'Uses time order, numbered parts, or sequence to help the reader follow how an idea develops.',
    move:
      'When the author organizes the ideas in the order ___, that sequence helps the reader understand ___ because ___.',
  },
  'cause-effect-structure': {
    why:
      'Links a cause, condition, or issue to a result so students can explain the structure’s purpose.',
    move:
      'When the author links ___ to ___, that cause/effect structure develops the point that ___.',
  },
  'compare-contrast-structure': {
    why:
      'Places two ideas, groups, or actions side by side so the author’s point becomes clearer.',
    move:
      'When the author contrasts ___ with ___, the reader understands ___ because ___.',
  },
  'problem-solution-structure': {
    why:
      'Names a problem and pairs it with a proposed answer, response, or remedy.',
    move:
      'When the author presents the problem of ___ and the solution of ___, the structure shows ___.',
  },
  'example-evidence-structure': {
    why:
      'Uses examples, figures, or evidence to support a broader point instead of only stating it.',
    move:
      'When the author gives the example/evidence of ___, it supports the point that ___.',
  },
  'opening-closing-shift': {
    why:
      'Uses an opening, closing, or shift to guide the reader into a new point or final purpose.',
    move:
      'When the author shifts from ___ to ___, that structure guides the reader to understand ___.',
  },
};

const R22_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'strong-vs-weak-evidence': {
    why:
      'Provides a clear central idea with multiple details so students can compare strong support against true-but-weaker evidence.',
    move:
      'When the author uses ___ as support, that evidence strengthens the central idea because ___.',
  },
  'central-idea-stated-implied': {
    why:
      'Gives students enough context to state the author’s controlling idea instead of picking one narrow detail.',
    move:
      'When the author’s main point is ___, the evidence ___ helps reveal that central idea because ___.',
  },
  'evidence-develops-central-idea': {
    why:
      'Contains a pointable detail, reason, example, or fact that develops the central idea.',
    move:
      'When the author includes ___, that evidence develops the central idea by showing ___.',
  },
  'best-evidence-for-claim': {
    why:
      'Includes evidence choices where one detail most directly proves the author’s claim or central idea.',
    move:
      'When the claim is ___, the best evidence is ___ because it proves ___.',
  },
  'detail-vs-central-idea': {
    why:
      'Contains true details that force students to separate relevant support from interesting but weaker information.',
    move:
      'When a detail only shows ___, it is weaker support because the central idea is really about ___.',
  },
  'central-idea-development-across-paragraphs': {
    why:
      'Uses more than one paragraph so students can track how the author builds the central idea across the excerpt.',
    move:
      'When paragraph one adds ___ and paragraph two adds ___, the central idea develops because ___.',
  },
};

const R23_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'logos-ethos-pathos': {
    why:
      'Contains a visible rhetorical appeal students can name and connect to the author’s purpose.',
    move:
      'When the author uses ___, that appeal works because it makes the reader ___. This supports the purpose by ___.',
  },
  'logos-evidence-reasoning': {
    why:
      'Uses facts, figures, examples, or reasoning so students can explain how logic helps persuasion.',
    move:
      'When the author uses ___ as logical support, that logos helps the reader believe ___ because ___.',
  },
  'ethos-credibility-authority': {
    why:
      'Builds credibility through authority, fairness, expertise, sincerity, or respected sources.',
    move:
      'When the author presents ___, that builds ethos because the reader is more likely to trust ___.',
  },
  'pathos-emotional-appeal': {
    why:
      'Uses emotional detail or loaded language that pushes the reader to feel concern, urgency, anger, sympathy, or alarm.',
    move:
      'When the author describes ___, that creates pathos because the reader feels ___ and is pushed to ___.',
  },
  'rhetorical-question-repetition': {
    why:
      'Uses a question, repeated phrase, or patterned wording to guide the reader toward the author’s point.',
    move:
      'When the author asks or repeats ___, that rhetorical device guides the reader to think ___.',
  },
  'figurative-language-purpose': {
    why:
      'Uses figurative or image-heavy language in informational writing to make the purpose more forceful.',
    move:
      'When the author describes ___ figuratively, that language supports the purpose by making the reader see ___.',
  },
  'purpose-fit-rhetorical-choice': {
    why:
      'Gives students a clear author purpose and a rhetorical choice that fits that purpose.',
    move:
      'When the author’s purpose is ___, the choice to use ___ fits because it helps the reader ___.',
  },
};

const R24_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'identify-opposing-claims': {
    why:
      'Pairs two positions on the same issue so students can name each claim before comparing support.',
    move:
      'Passage A claims ___. Passage B claims ___. They disagree about ___ because ___.',
  },
  'compare-evidence-development': {
    why:
      'Pairs two short arguments on the same issue so students can separate the claims and judge which side develops stronger support.',
    move:
      'When Passage A claims ___ and Passage B claims ___, the stronger argument is ___ because its evidence ___.',
  },
  'evaluate-validity': {
    why:
      'Pairs two arguments so students can test whether the evidence is relevant, logical, and enough to prove the claim.',
    move:
      'The claim is valid when ___ proves ___; the weaker claim is less valid because ___.',
  },
  'evaluate-effectiveness': {
    why:
      'Pairs two arguments so students can judge which side is more convincing for the audience and why.',
    move:
      'The more effective argument is ___ because its support makes the reader ___.',
  },
  'response-counterclaim': {
    why:
      'Shows a criticism, limitation, or counterclaim and the response that answers or narrows it.',
    move:
      'The counterclaim says ___. The response answers it by ___, which strengthens/limits the argument because ___.',
  },
};

const R31_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'metaphor-simile': {
    why:
      'Contains a clean comparison students can translate literally and connect to mood, meaning, or reader understanding.',
    move:
      'When the author compares ___ to ___, the comparison suggests ___ and creates a ___ effect because ___.',
  },
  'personification-effect': {
    why:
      'Gives a nonhuman thing human action or feeling so students can explain how the language shapes mood or meaning.',
    move:
      'When the author makes ___ act human by ___, that personification creates ___ because ___.',
  },
  'imagery-sensory-language': {
    why:
      'Uses sensory details students can point to and connect to atmosphere, mood, or reader effect.',
    move:
      'When the author uses sensory details like ___, the imagery creates a ___ mood because ___.',
  },
  'symbol-object-meaning': {
    why:
      'Uses an object, image, place, color, or animal that suggests a larger idea beyond its literal role.',
    move:
      'When the author focuses on ___, that image suggests ___ because the context shows ___.',
  },
  'mood-shift-effect': {
    why:
      'Shows language creating, intensifying, or shifting the mood so students can prove the effect from exact words.',
    move:
      'When the language shifts from ___ to ___, the mood changes because ___.',
  },
};

const R32_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'chunk-complex-syntax': {
    why:
      'Gives students one layered sentence they can break into smaller parts before restating the meaning.',
    move:
      'I chunk the sentence into who/what, action, and relationship words; then I restate each part in plain English.',
  },
  'preserve-original-meaning': {
    why:
      'Has enough key ideas to force students to choose the paraphrase that keeps the original meaning without adding or dropping details.',
    move:
      'The best paraphrase keeps ___, ___, and ___ from the original, without adding ___ or leaving out ___.',
  },
  'translate-archaic-or-formal-language': {
    why:
      'Uses older, poetic, or formal wording that students can translate into modern classroom language while keeping the same idea.',
    move:
      'I keep the author’s idea the same, but I replace the hard wording ___ with plain words that mean ___.',
  },
  'paraphrase-claim-or-theme': {
    why:
      'Contains a clear claim, theme, or speaker point that students can restate accurately in their own words.',
    move:
      'The author is really saying ___; my paraphrase keeps that point by saying ___ in simpler words.',
  },
};

const R34_SUB_SKILL_TEACHER_COPY: Record<
  string,
  { why: string; move: string }
> = {
  'reader-belief-feeling-notice': {
    why:
      'Contains a clear rhetorical move that students can connect to what the author wants the reader to believe, feel, or notice.',
    move:
      'When the author uses ___, that rhetoric makes the reader ___ because ___. This supports the purpose by ___.',
  },
};

function whyThisExcerpt(standard: string, subSkillId?: string | null) {
  if (standard === 'ELA.9.R.1.1' && subSkillId) {
    return (
      R11_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Contains a pointable literary element that students can connect to meaning or style instead of only summarizing.'
    );
  }

  if (standard === 'ELA.9.R.1.4' && subSkillId) {
    return (
      R14_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Contains an epic convention or heroic action that can be analyzed as structure, characterization, or theme.'
    );
  }

  if (standard === 'ELA.9.R.1.2' && subSkillId) {
    return (
      R12_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Contains a theme-bearing moment where a choice, consequence, or realization can be connected to a universal idea.'
    );
  }

  if (standard === 'ELA.9.R.1.3' && subSkillId) {
    return (
      R13_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Creates a gap between what is said, believed, or expected and what the reader understands.'
    );
  }

  if (standard === 'ELA.9.R.2.1' && subSkillId) {
    return (
      R21_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Uses structure or transition logic that helps the author develop purpose or meaning.'
    );
  }

  if (standard === 'ELA.9.R.2.2' && subSkillId) {
    return (
      R22_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Contains evidence that can be evaluated for how well it develops the central idea.'
    );
  }

  if (standard === 'ELA.9.R.2.3' && subSkillId) {
    return (
      R23_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Uses persuasive language, appeal, or figurative wording to help the author achieve a purpose.'
    );
  }

  if (standard === 'ELA.9.R.2.4' && subSkillId) {
    return (
      R24_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Pairs two arguments so students can compare claims, support, validity, and effectiveness.'
    );
  }

  if (standard === 'ELA.9.R.3.1' && subSkillId) {
    return (
      R31_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Contains figurative or image-heavy language that creates a mood students can prove from words.'
    );
  }

  if (standard === 'ELA.9.R.3.2' && subSkillId) {
    return (
      R32_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Is short enough for students to paraphrase accurately while preserving the original meaning.'
    );
  }

  if (standard === 'ELA.9.R.3.4' && subSkillId) {
    return (
      R34_SUB_SKILL_TEACHER_COPY[subSkillId]?.why ??
      'Uses rhetorical language that shapes what the reader thinks, feels, or believes.'
    );
  }

  if (standard === 'ELA.9.V.1.2') {
    return 'Contains a target word with useful word parts and enough surrounding context to confirm the meaning.';
  }

  if (standard === 'ELA.9.V.1.3') {
    return 'Contains a target word or phrase with enough context clues for students to prove the precise meaning.';
  }

  const map: Record<string, string> = {
    'ELA.9.R.1.1':
      'Contains a pointable literary element that students can connect to meaning or style instead of only summarizing.',
    'ELA.9.R.1.2':
      'Contains a theme-bearing moment where a choice, consequence, or realization can be connected to a universal idea.',
    'ELA.9.R.1.3':
      'Creates a gap between what is said, believed, or expected and what the reader understands.',
    'ELA.9.R.1.4':
      'Contains an epic convention or heroic action that can be analyzed as structure, characterization, or theme.',
    'ELA.9.R.2.1':
      'Uses structure or transition logic that helps the author develop purpose or meaning.',
    'ELA.9.R.2.2':
      'Contains evidence that can be evaluated for how well it develops the central idea.',
    'ELA.9.R.2.3':
      'Uses persuasive language, appeal, or figurative wording to help the author achieve a purpose.',
    'ELA.9.R.2.4':
      'Contains claim language that can be compared against an opposing argument.',
    'ELA.9.R.3.1':
      'Contains figurative or image-heavy language that creates a mood students can prove from words.',
    'ELA.9.R.3.2':
      'Is short enough for students to paraphrase accurately while preserving the original meaning.',
    'ELA.9.R.3.3':
      'Contains a source-pattern moment that can later be compared with an adaptation.',
    'ELA.9.R.3.4':
      'Uses rhetorical language that shapes what the reader thinks, feels, or believes.',
    'ELA.9.V.1.2':
      'Contains a target word with useful word parts and enough surrounding context to confirm the meaning.',
    'ELA.9.V.1.3':
      'Contains a target word or phrase with enough context clues for students to prove the precise meaning.',
  };
  return map[standard] ?? 'Contains a focused teachable moment for the selected standard.';
}

function moveTemplate(standard: string, subSkillId?: string | null) {
  if (standard === 'ELA.9.R.1.1' && subSkillId) {
    return (
      R11_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author uses ___, that is ___ doing meaning/style work because it makes the reader understand ___.'
    );
  }

  if (standard === 'ELA.9.R.1.4' && subSkillId) {
    return (
      R14_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the epic uses ___, that is an epic convention because it shows ___.'
    );
  }

  if (standard === 'ELA.9.R.1.2' && subSkillId) {
    return (
      R12_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author shows ___, that develops the universal theme that ___ because ___.'
    );
  }

  if (standard === 'ELA.9.R.1.3' && subSkillId) {
    return (
      R13_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the narrator/speaker ___, that creates irony or perspective because the reader understands ___.'
    );
  }

  if (standard === 'ELA.9.R.2.1' && subSkillId) {
    return (
      R21_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author structures the paragraph by ___, that structure develops purpose/meaning because ___.'
    );
  }

  if (standard === 'ELA.9.R.2.2' && subSkillId) {
    return (
      R22_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author uses ___ as support, it develops the central idea because ___.'
    );
  }

  if (standard === 'ELA.9.R.2.3' && subSkillId) {
    return (
      R23_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author uses ___, that rhetorical move supports the purpose because ___.'
    );
  }

  if (standard === 'ELA.9.R.2.4' && subSkillId) {
    return (
      R24_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When Passage A claims ___ and Passage B claims ___, the stronger argument is ___ because ___.'
    );
  }

  if (standard === 'ELA.9.R.3.1' && subSkillId) {
    return (
      R31_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author uses the phrase ___, that figurative language creates a ___ mood because ___.'
    );
  }

  if (standard === 'ELA.9.R.3.2' && subSkillId) {
    return (
      R32_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When I paraphrase this paragraph, I keep the meaning ___ but put the wording into my own words by ___.'
    );
  }

  if (standard === 'ELA.9.R.3.4' && subSkillId) {
    return (
      R34_SUB_SKILL_TEACHER_COPY[subSkillId]?.move ??
      'When the author uses ___, that rhetoric affects the reader by ___.'
    );
  }

  if (standard === 'ELA.9.V.1.2') {
    return 'When I split ___ into word parts, I can infer ___ because the context says ___.';
  }

  if (standard === 'ELA.9.V.1.3') {
    return 'The word ___ means ___ in this sentence because the context clue ___ proves it.';
  }

  const move = ELA9_READING_SKILL_MOVES.find((item) => item.standardCode === standard);
  const map: Record<string, string> = {
    'ELA.9.R.1.1':
      'When the author uses ___, that is ___ doing meaning/style work because it makes the reader understand ___.',
    'ELA.9.R.1.2':
      'When the author shows ___, that develops the universal theme that ___ because ___.',
    'ELA.9.R.1.3':
      'When the narrator/speaker ___, that creates irony or perspective because the reader understands ___.',
    'ELA.9.R.1.4':
      'When the epic uses ___, that is an epic convention because it shows ___.',
    'ELA.9.R.2.1':
      'When the author structures the paragraph by ___, that structure develops purpose/meaning because ___.',
    'ELA.9.R.2.2':
      'When the author uses ___ as support, it develops the central idea because ___.',
    'ELA.9.R.2.3':
      'When the author uses ___, that rhetorical move supports the purpose because ___.',
    'ELA.9.R.2.4':
      'When one author claims ___ and the other claims ___, the stronger argument is ___ because ___.',
    'ELA.9.R.3.1':
      'When the author uses the phrase ___, that figurative language creates a ___ mood because ___.',
    'ELA.9.R.3.2':
      'When I paraphrase this paragraph, I keep the meaning ___ but put the wording into my own words by ___.',
    'ELA.9.R.3.3':
      'When the adaptation changes ___ from the source, the new version changes the meaning because ___.',
    'ELA.9.R.3.4':
      'When the author uses ___, that rhetoric affects the reader by ___.',
    'ELA.9.V.1.2':
      'When I split ___ into word parts, I can infer ___ because the context says ___.',
    'ELA.9.V.1.3':
      'The word ___ means ___ in this sentence because the context clue ___ proves it.',
  };

  return map[standard] ?? `When the author ${move?.studentMove ?? 'uses evidence'}, that move matters because ___.`;
}

function sentences(excerpt: string) {
  return excerpt
    .match(/[^.!?]+[.!?]+/g)
    ?.map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean) ?? [excerpt.replace(/\s+/g, ' ').trim()];
}

const R11_QUESTION_CONFIG: Record<
  string,
  {
    phraseRules: RegExp[];
    stem: (phrase: string) => string;
    correct: string;
    distractors: string[];
  }
> = {
  'setting-layer': {
    phraseRules: [
      /\bsavage and wild\b/i,
      /\blonely and dark\b/i,
      /\bas if in dread[^,.]*/i,
      /\bwoods were already filled with shadows\b/i,
      /\bbright sunset[^,.]*/i,
      /\bbright green swamp grass\b/i,
      /\bopen place where the sunshine[^,.]*/i,
      /\bliving in caves and in holes of the earth\b/i,
      /\bshivering with the cold\b/i,
      /\bhunted by wild beasts\b/i,
      /\bmiserable of all living creatures\b/i,
      /\bdoor of the little house stood open\b/i,
      /\bwhippoorwills came and sang[^,.]*/i,
      /\bwoods and hills echoed with fearful sounds\b/i,
      /\bmiddle of a little open space\b/i,
      /\bset out for the forest\b/i,
      /\bliving in caves and in holes of the earth\b/i,
      /\bshivering with the cold\b/i,
      /\bhunted by wild beasts\b/i,
      /\bcheerless cave\b/i,
      /\bcold waves\b/i,
      /\bwintry sea\b/i,
      /\bice mountains\b/i,
      /\bdesolate land\b/i,
      /\bdark|cold|wild|lonely|dreadful|silent|storm|night|shadows|sunset|swamp|woods\b/i,
    ],
    stem: (phrase) => `How does the setting description in "${phrase}" help develop the excerpt?`,
    correct:
      'It makes the place feel significant or threatening, so the setting adds mood, tension, or meaning instead of only naming where the scene happens.',
    distractors: [
      'It gives a neutral location detail that does not affect the reader’s understanding of the scene.',
      'It mainly identifies who is speaking, without adding mood, conflict, or meaning.',
      'It resolves the central problem before the characters have to respond to it.',
    ],
  },
  'plot-conflict-layer': {
    phraseRules: [
      /\bhuge serpent[^,.]*/i,
      /\bseized sheep and cattle\b/i,
      /\bcut the chain\b/i,
      /\bsea monster was close at hand[^,.]*/i,
      /\bopening his wide jaws[^,.]*/i,
      /\bturned into stone\b/i,
      /\bstruck it in the neck[^,.]*/i,
      /\bdragon soon fell to the ground dead\b/i,
      /\bHe had never been in so great danger before\b/i,
      /\bthrew a heavy quoit[^,.]*/i,
      /\bstruck a stranger[^,.]*/i,
      /\bmet his death\b/i,
      /\bgreat beast was found[^,.]*/i,
      /\bcame charging out upon his foes\b/i,
      /\bhid behind the trees[^,.]*/i,
      /\btearing up the ground[^,.]*/i,
      /\btore him in pieces\b/i,
      /\bovertaken and killed\b/i,
      /\bdevoured them\b/i,
      /\bconflict|danger|battle|fight|choice|turned|consequence|problem\b/i,
    ],
    stem: (phrase) => `How does the event or conflict in "${phrase}" add meaning to the excerpt?`,
    correct:
      'It raises the stakes or creates a problem that changes what the reader understands about the scene.',
    distractors: [
      'It adds action to the scene, but the meaning still comes mostly from description rather than conflict.',
      'It creates a problem for the character, but the problem does not change the reader’s understanding.',
      'It emphasizes danger, but mainly to make the scene more exciting rather than meaningful.',
    ],
  },
  'characterization-layer': {
    phraseRules: [
      /\bHe said this to quiet her, but in reality he was plotting against Telemachus\b/i,
      /\bTake heart[^.!?]*/i,
      /\bBut I tell you, you must lie upon it\b/i,
      /\bseized the trembling man[^.!?]*/i,
      /\blooked him straight in the eye\b/i,
      /\bspoken so rashly\b/i,
      /\bhe began to feel sorry[^.!?]*/i,
      /\bnever show his face[^.!?]*/i,
      /\bDo thou but call my resolution wise\b/i,
      /\bwith this knife I’ll help it presently\b/i,
      /\bGive me some present counsel\b/i,
      /\bI long to die\b/i,
      /\bGraze where you will\b/i,
      /\bhang, beg, starve, die\b/i,
      /\bI do not use to jest\b/i,
      /\bif your work is best[^.!?]*/i,
      /\bI agree\b/i,
      /\b(?:said|answered|looked|spoke|thought|felt|remembered)[^.!?]*[.!?]/i,
      /\b(?:voice|face|eyes|hand|heart)[^.!?]*[.!?]/i,
    ],
    stem: (phrase) => `What does the character evidence in "${phrase}" help reveal?`,
    correct:
      'It reveals a trait, motive, pressure, or change in the character, making the moment mean more than the action itself.',
    distractors: [
      'It only tells the reader where the scene happens and does not reveal anything about character.',
      'It proves the character has no connection to the conflict in the excerpt.',
      'It gives a summary of the plot without helping the reader infer anything about the character.',
    ],
  },
  'point-of-view-layer': {
    phraseRules: [
      /\bNo, she must keep silence\b/i,
      /\bWhat is it that suddenly forbids her[^.!?]*/i,
      /\bSylvia cannot speak\b/i,
      /\bshe cannot tell the heron’s secret[^.!?]*/i,
      /\bDid my heart love till now\b/i,
      /\bI ne[’']er saw true beauty till this night\b/i,
      /\bThou knowest the mask of night is on my face\b/i,
      /\bI am too fond\b/i,
      /\bI should have been more strange[^.!?]*/i,
      /\bI have a faint cold fear[^.!?]*/i,
      /\bWhat if this mixture do not work at all\b/i,
      /\bI saw[^.!?]*/i,
      /\bI heard[^.!?]*/i,
      /\bmy heart was clouded with care\b/i,
      /\bI divided them into two companies[^.!?]*/i,
      /\bI took command of the other myself\b/i,
      /\bThey wept bitterly[^.!?]*/i,
      /\bI was moved to tears[^.!?]*/i,
      /\bI would not let her come near[^.!?]*/i,
      /\bI was for jeering at the Cyclops again\b/i,
      /\bthe men begged and prayed of me[^.!?]*/i,
      /\bwe found our comrades lamenting us\b/i,
      /\b(?:I|we|my|our)\b[^.!?]*[.!?]/,
      /\b(?:thought|remembered|understood|seemed to|felt that)[^.!?]*[.!?]/i,
    ],
    stem: (phrase) => `How does the viewpoint in "${phrase}" shape the reader's understanding?`,
    correct:
      'It filters the moment through what the narrator or speaker notices, so the reader understands the scene through that lens.',
    distractors: [
      'It removes the narrator’s influence and makes the scene completely objective.',
      'It gives only a setting detail and does not affect what the reader understands.',
      'It switches to an unrelated argument that is not developed in the excerpt.',
    ],
  },
  'theme-tone-layer': {
    phraseRules: [
      /\bNo, she must keep silence\b/i,
      /\bshe cannot tell the heron’s secret[^.!?]*/i,
      /\bWhy, then, O brawling love\b/i,
      /\bO loving hate\b/i,
      /\bLove is a smoke[^.!?]*/i,
      /\btemper(?:ing)? extremities with extreme sweet\b/i,
      /\bfriend of life and the foe of death\b/i,
      /\bfilled with grief and rage[^.!?]*/i,
      /\bwicked uncle, who loved only himself\b/i,
      /\bmountain was no longer savage and wild[^.!?]*/i,
      /\bvalley was no longer dark and lonely[^.!?]*/i,
      /\bterror in the joy\b/i,
      /\bforgot everything in the world but joy\b/i,
      /\bdeath slow winging to the dark\b/i,
      /\b(?:fear|dread|power|pride|duty|justice|hope|shame|honor|truth|love|death|grief|rage|despair)[^.!?]*[.!?]/i,
    ],
    stem: (phrase) => `How does "${phrase}" help develop a theme or tone in the excerpt?`,
    correct:
      'It points to an attitude or larger idea beneath the event, so the reader sees more than the surface action.',
    distractors: [
      'It gives a minor plot fact that does not connect to tone or theme.',
      'It contradicts the mood of the excerpt by making the scene feel playful and safe.',
      'It replaces the need for evidence because the theme can be guessed from the title.',
    ],
  },
  'style-technique-layer': {
    phraseRules: [
      /\blike a pale star\b/i,
      /\bas soft as moths\b/i,
      /\bas if she too could go flying away among the clouds\b/i,
      /\blike a great main-mast\b/i,
      /\bold pine must have loved his new dependent\b/i,
      /\bas though it were a heap of dry chaff tossed about by a whirlwind\b/i,
      /\bas if he were on horseback\b/i,
      /\bLove is a smoke\b/i,
      /\bfire sparkling in lovers’ eyes\b/i,
      /\bsea nourish’d with lovers’ tears\b/i,
      /\bmadness most discreet\b/i,
      /\bchoking gall\b/i,
      /\bpreserving sweet\b/i,
      /\bas though he would swallow[^,.]*/i,
      /\blike hounds in the chase\b/i,
      /\blike [^,.]+/i,
      /\bas if [^,.]+/i,
      /\bas though [^,.]+/i,
      /\bseemed [^,.]+/i,
      /\b(?:savage and wild|lonely and dark|dreadful den)\b/i,
    ],
    stem: (phrase) => `How does the author's word choice or technique in "${phrase}" affect the passage?`,
    correct:
      'It shapes the reader’s response through language, making the meaning or style stronger than a plain summary would.',
    distractors: [
      'It is decorative language that has no connection to the passage’s meaning or style.',
      'It explains the entire plot directly, so the reader does not need to interpret it.',
      'It shifts the excerpt away from literary meaning and into unrelated factual information.',
    ],
  },
};

function quoteForStem(value: string) {
  const cleaned = value.replace(/\s+/g, ' ').replace(/^["“”]+|["“”]+$/g, '').trim();
  if (cleaned.length <= 96) return cleaned;
  return `${cleaned.slice(0, 93).trim()}...`;
}

type QuestionPackage = {
  stem: string;
  correct: string;
  distractors: string[];
};

function r11PlotConflictQuestionPackage(excerpt: string, phrase: string): QuestionPackage {
  if (/\b(Python|serpent|dreadful den|seized sheep|devoured them|Apollo)\b/i.test(excerpt)) {
    return {
      stem: `How does the conflict involving the Python help develop the excerpt?`,
      correct:
        'It shows that Apollo is entering a place controlled by a real threat, which makes his arrival feel purposeful and dangerous.',
      distractors: [
        'It shows that Apollo wants to build a house, so the Python is mostly an obstacle to construction.',
        'It suggests that the people’s fear shapes the scene more than the Python’s actions do.',
        'It makes the Python seem like a local danger, but not one connected to Apollo’s purpose.',
      ],
    };
  }

  if (/\b(heavy quoit|struck a stranger|sank upon the ground|old king of Argos|met his death|Perseus ran to help)\b/i.test(excerpt)) {
    return {
      stem: `How does the accident with the quoit affect the plot of the excerpt?`,
      correct:
        'It turns a public display into an unexpected consequence, showing how one action changes Perseus’s situation in a serious way.',
      distractors: [
        'It shows Perseus’s physical strength, but the stranger’s death is mainly background information.',
        'It creates surprise, but it does not connect to the larger pattern of fate or consequence.',
        'It turns attention away from Perseus and toward the crowd’s reaction to the public display.',
      ],
    };
  }

  if (/\b(sea monster|cut the chain|wide jaws|turned into stone|lashing the water|roaring towards the shore)\b/i.test(excerpt)) {
    return {
      stem: `How does Perseus’s action against the sea monster affect the conflict?`,
      correct:
        'It shifts the conflict from rescue to victory by showing Perseus act at the moment the monster threatens the girl.',
      distractors: [
        'It focuses on Perseus freeing the girl, but the monster’s arrival remains only a background threat.',
        'It shows that Medusa’s power matters more than Perseus’s own decision in resolving the danger.',
        'It makes the rescue feel sudden, but it does not change the central conflict of the scene.',
      ],
    };
  }

  if (/\b(great beast|came charging|hid behind the trees|tearing up the ground|fearful sounds|huntsmen)\b/i.test(excerpt)) {
    return {
      stem: `How does the beast’s arrival change the conflict in the excerpt?`,
      correct:
        'It turns the hunt into immediate danger, forcing the heroes to react instead of simply preparing for action.',
      distractors: [
        'It shows that the heroes are experienced hunters, so the beast’s arrival mainly confirms their confidence.',
        'It emphasizes the beast’s appearance, but the real conflict begins only after the heroes attack.',
        'It makes the hunt feel ceremonial because the heroes have just finished feasting.',
      ],
    };
  }

  if (/\b(Cadmus|sharp claws|struck it in the neck|dragon soon fell|great danger|weeping for his two friends)\b/i.test(excerpt)) {
    return {
      stem: `How does Cadmus’s fight with the beast develop the conflict in the excerpt?`,
      correct:
        'It shows that Cadmus survives the immediate danger but is left with a new problem, so the conflict creates both victory and uncertainty.',
      distractors: [
        'It emphasizes Cadmus’s bravery, but the fight mainly serves as an action scene without a new problem.',
        'It shows Cadmus defeating the beast, so the conflict becomes less connected to his larger goal.',
        'It makes Cadmus mourn his friends, but that grief matters more than the conflict with the beast.',
      ],
    };
  }

  if (/\b(tore him in pieces|overtaken and killed|spear|boar|warrior|grazed the boar)\b/i.test(excerpt)) {
    return {
      stem: `How do the failed attacks on the boar develop the conflict?`,
      correct:
        'They show that the boar is still dangerous even when the heroes fight back, raising the stakes of the hunt.',
      distractors: [
        'They show that the heroes are brave, but the attacks do not change the pressure of the hunt.',
        'They make the boar seem powerful, though the focus stays mainly on the heroes’ skill.',
        'They delay the outcome of the hunt without adding new danger or consequence.',
      ],
    };
  }

  return {
    stem: `How does the event or conflict in "${phrase}" add meaning to the excerpt?`,
    correct:
      'It raises the stakes or creates a problem that changes what the reader understands about the scene.',
    distractors: [
      'It adds action to the scene, but the meaning still comes mostly from description rather than conflict.',
      'It creates a problem for the character, but the problem does not change the reader’s understanding.',
      'It emphasizes danger, but mainly to make the scene more exciting rather than meaningful.',
    ],
  };
}

function r11CharacterQuestionPackage(excerpt: string, phrase: string): QuestionPackage {
  if (/\b(sharp eyes and quick ears|dodged aside so quickly|seized the fellow's legs|tripped him up|Club-carrier)\b/i.test(excerpt)) {
    return {
      stem: `What does Theseus’s response to Club-carrier reveal about him?`,
      correct:
        'It reveals that Theseus is alert and quick-thinking because he notices danger and reacts before the robber can overpower him.',
      distractors: [
        'It suggests that Theseus depends on luck because he does not notice the robber until after he is struck.',
        'It shows that Theseus is strong, but it does not reveal anything about how he handles danger.',
        'It emphasizes the robber’s weapon more than Theseus’s ability to respond under pressure.',
      ],
    };
  }

  if (/\b(Theseus|you must lie upon it|seized the trembling man|looked him straight in the eye|cried for mercy)\b/i.test(excerpt)) {
    return {
      stem: `What does Theseus’s treatment of the robber reveal about him?`,
      correct:
        'It shows that Theseus is forceful and willing to punish the robber with the same cruelty the robber used on others.',
      distractors: [
        'It shows that Theseus is uncertain and lets the robber decide what should happen.',
        'It reveals that Theseus is unaware of the robber’s cruelty.',
        'It shows that Theseus avoids conflict by leaving the robber alone.',
      ],
    };
  }

  if (/\b(Tell me not, Friar|Do thou but call my resolution wise|with this knife I’ll help it presently|Give me some present counsel|I long to die)\b/i.test(excerpt)) {
    return {
      stem: `What does Juliet’s speech to Friar Lawrence reveal about her?`,
      correct:
        'It reveals that Juliet is desperate and determined because she demands a solution and is willing to risk death rather than accept the marriage.',
      distractors: [
        'It reveals that Juliet is calm and willing to accept whatever others decide for her.',
        'It shows that Juliet is only asking the Friar for ordinary wedding advice.',
        'It proves that Juliet has stopped caring about Romeo or her own future.',
      ],
    };
  }

  if (/\b(spoken so rashly|feel sorry|never show his face|head of terror)\b/i.test(excerpt)) {
    return {
      stem: `What does Perseus’s reaction to his promise reveal about him?`,
      correct:
        'It shows that Perseus recognizes the danger of his boast but is still determined to keep his promise.',
      distractors: [
        'It shows that Perseus immediately gives up and decides to hide forever.',
        'It reveals that Perseus already knows exactly how to defeat Medusa.',
        'It shows that Perseus made a careful plan before speaking to the king.',
      ],
    };
  }

  if (/\b(God’s bread, it makes me mad|Graze where you will|hang, beg, starve, die|I do not use to jest|I’ll not wed)\b/i.test(excerpt)) {
    return {
      stem: `What does Capulet’s response to Juliet reveal about him?`,
      correct:
        'It reveals that he is controlling and angry because he threatens Juliet when she refuses to obey him.',
      distractors: [
        'It reveals that he is patient because he calmly accepts Juliet’s refusal.',
        'It shows that he gives Juliet complete freedom to choose what she wants.',
        'It proves that he is confused because he does not understand what Juliet said.',
      ],
    };
  }

  if (/\b(if your work is best|I will weave no more|if my work is best|I agree|Arachne)\b/i.test(excerpt)) {
    return {
      stem: `What does Arachne’s agreement to the contest reveal about her?`,
      correct:
        'It reveals that Arachne is confident enough to compete against Athena and accept serious consequences.',
      distractors: [
        'It reveals that Arachne is afraid to show her work to anyone.',
        'It shows that Arachne refuses the challenge because she knows she cannot win.',
        'It proves that Arachne has already learned humility before the contest begins.',
      ],
    };
  }

  return {
    stem: `What does the character evidence in "${phrase}" help reveal?`,
    correct:
      'It reveals a trait, motive, pressure, or change in the character, making the moment mean more than the action itself.',
    distractors: [
      'It only tells the reader where the scene happens and does not reveal anything about character.',
      'It proves the character has no connection to the conflict in the excerpt.',
      'It gives a summary of the plot without helping the reader infer anything about the character.',
    ],
  };
}

function r11PointOfViewQuestionPackage(excerpt: string, phrase: string): QuestionPackage {
  if (/\b(No, she must keep silence|Sylvia cannot speak|heron’s secret|give its life away)\b/i.test(excerpt)) {
    return {
      stem: `How does the narrator’s focus on Sylvia’s thoughts shape the reader’s understanding of her choice?`,
      correct:
        'It lets the reader understand Sylvia’s private conflict, showing that her silence is a deliberate choice to protect the heron.',
      distractors: [
        'It shows that Sylvia does not understand why the hunter wants the bird.',
        'It makes Sylvia’s choice seem accidental because the reader never learns what she thinks.',
        'It shows that the narrator agrees the bird should be given away.',
      ],
    };
  }

  if (/\b(Did my heart love till now|I ne[’']er saw true beauty till this night|she doth teach the torches)\b/i.test(excerpt)) {
    return {
      stem: `How does Romeo’s point of view shape the reader’s understanding of Juliet in this excerpt?`,
      correct:
        'It presents Juliet through Romeo’s sudden admiration, making the reader see how completely his attention shifts to her.',
      distractors: [
        'It presents Juliet through a neutral description that shows no emotion from Romeo.',
        'It shows that Romeo is focused on avoiding Juliet rather than noticing her.',
        'It proves that Romeo already knows Juliet well before seeing her.',
      ],
    };
  }

  if (/\b(mask of night is on my face|I am too fond|I should have been more strange|overheard)\b/i.test(excerpt)) {
    return {
      stem: `How does Juliet’s point of view shape the reader’s understanding of her feelings?`,
      correct:
        'It reveals Juliet’s self-awareness and vulnerability because she worries that Romeo has heard her honest feelings too soon.',
      distractors: [
        'It shows Juliet hiding all emotion so the reader cannot understand what she feels.',
        'It makes Juliet seem indifferent because she says she does not care about Romeo.',
        'It shifts the focus away from Juliet’s feelings to an unrelated description of the setting.',
      ],
    };
  }

  if (/\b(faint cold fear|What if this mixture do not work|Come, vial|dismal scene)\b/i.test(excerpt)) {
    return {
      stem: `How does Juliet’s point of view build tension in the excerpt?`,
      correct:
        'It gives the reader direct access to her fear and uncertainty before she chooses to take the vial.',
      distractors: [
        'It shows Juliet is calm because she knows the plan cannot fail.',
        'It removes tension by describing only what other characters think.',
        'It proves Juliet has already changed her mind about the plan.',
      ],
    };
  }

  if (/\b(I went on board|we saw a great cave|abode of a huge monster|horrid creature|not like a human being)\b/i.test(excerpt)) {
    return {
      stem: `How does Ulysses’s first-person description of the cave shape the reader’s understanding?`,
      correct:
        'It lets the reader discover the danger with Ulysses as he notices the cave, the monster’s home, and the creature’s unnatural nature.',
      distractors: [
        'It shows that Ulysses already knows the monster personally before reaching the cave.',
        'It makes the cave seem ordinary by leaving out details about danger or the monster.',
        'It shifts the scene away from Ulysses’s experience and gives only an outside historical fact.',
      ],
    };
  }

  if (/\b(I saw a great wave|I heard a loud roaring sound|The men were so frightened|not to lose heart)\b/i.test(excerpt)) {
    return {
      stem: `How does Ulysses’s point of view help develop the danger in the excerpt?`,
      correct:
        'It shows the danger through what Ulysses sees and hears, then shows him responding as a leader when the men panic.',
      distractors: [
        'It shows that Ulysses does not notice the danger until another narrator explains it.',
        'It makes the danger seem imaginary because no one reacts to the wave or sound.',
        'It focuses only on the men’s fear and leaves out Ulysses’s response.',
      ],
    };
  }

  if (/\b(I saw a flame|as though she hated them|would I know not what|Let not their mother meet them|if some must suffer)\b/i.test(excerpt)) {
    return {
      stem: `How does the speaker’s point of view shape the reader’s understanding of Medea?`,
      correct:
        'It lets the reader see Medea through the speaker’s fear, making her anger seem dangerous before she acts.',
      distractors: [
        'It shows Medea directly explaining that she feels calm and forgiving.',
        'It removes the speaker’s judgment and makes the description completely neutral.',
        'It shows that the speaker trusts Medea with the children without concern.',
      ],
    };
  }

  if (/\b(we found our comrades lamenting us|anxiously awaiting our return|my companions agreed|I should have it)\b/i.test(excerpt)) {
    return {
      stem: `How does the first-person narration affect the reader’s understanding of the return to the ships?`,
      correct:
        'It presents the event through the crew’s shared experience, so the reader understands both relief and continued danger.',
      distractors: [
        'It makes the return seem peaceful because the crew no longer has reason to fear what happened.',
        'It focuses on the sacrifice at the shore more than the crew’s emotional response.',
        'It shows Ulysses receiving honor, but it does not explain how the crew experiences the return.',
      ],
    };
  }

  if (/\b(I was for jeering at the Cyclops again|the men begged and prayed of me|row for their lives|Cyclops)\b/i.test(excerpt)) {
    return {
      stem: `How does Ulysses’s first-person narration shape the reader’s understanding of this moment?`,
      correct:
        'It lets the reader see both his boldness and his reckless pride because he admits he wanted to taunt the Cyclops again.',
      distractors: [
        'It makes Ulysses seem completely objective because he gives no opinion about his own actions.',
        'It hides the danger from the reader by leaving out what the men say to him.',
        'It shows that Ulysses has no control over the choices made in the scene.',
      ],
    };
  }

  if (/\b(I divided them into two companies|I took command|They wept bitterly|wept, as also did we who were left behind)\b/i.test(excerpt)) {
    return {
      stem: `How does Ulysses’s point of view affect the way the reader understands the crew’s danger?`,
      correct:
        'It shows the danger through Ulysses’s leadership decisions and through his awareness of the crew’s fear.',
      distractors: [
        'It makes the danger seem unimportant because Ulysses ignores how the crew feels.',
        'It removes Ulysses from the action and focuses only on an outside narrator’s opinion.',
        'It shows that the crew is excited and confident about being separated.',
      ],
    };
  }

  if (/\b(I was moved to tears|my dead mother|I would not let her come near|my sorrow)\b/i.test(excerpt)) {
    return {
      stem: `How does Ulysses’s first-person point of view shape the emotional meaning of the excerpt?`,
      correct:
        'It lets the reader feel his grief while also seeing that he must control his emotions to complete his task.',
      distractors: [
        'It shows that Ulysses feels nothing when he sees his mother.',
        'It makes the moment only about setting because the narrator gives no personal reaction.',
        'It proves that Ulysses forgets why he came to speak with the dead.',
      ],
    };
  }

  if (/\b(my heart was clouded with care|I turned back to the ships)\b/i.test(excerpt)) {
    return {
      stem: `How does the first-person narration help develop Ulysses’s state of mind?`,
      correct:
        'It gives direct access to his worry while showing him continue to lead his men through the journey.',
      distractors: [
        'It shows that Ulysses feels no concern about what has happened.',
        'It focuses only on what the men think and gives no sense of Ulysses’s reaction.',
        'It proves that Ulysses has already reached the end of his journey.',
      ],
    };
  }

  return {
    stem: `How does the viewpoint in "${phrase}" shape the reader's understanding?`,
    correct:
      'It filters the moment through what the narrator or speaker notices, feels, or understands.',
    distractors: [
      'It removes the narrator’s influence and makes the scene completely objective.',
      'It gives only a setting detail and does not affect what the reader understands.',
      'It switches to an unrelated argument that is not developed in the excerpt.',
    ],
  };
}

function r11ThemeToneQuestionPackage(excerpt: string, phrase: string): QuestionPackage {
  if (/\b(Coronis|silver bow|learn the truth for himself)\b/i.test(excerpt)) {
    return {
      stem: 'How does Apollo’s reaction help develop the tone of the excerpt?',
      correct:
        'It creates an intense, troubled tone by showing Apollo move from suspicion into grief, anger, and a need to learn the truth.',
      distractors: [
        'It creates a peaceful tone because Apollo calmly accepts what he has heard.',
        'It shows that Apollo is unaffected because he refuses to think about Coronis.',
        'It makes the scene playful by showing Apollo treat the problem as a joke.',
      ],
    };
  }

  if (/\b(No, she must keep silence|heron’s secret|give its life away|too late it dawned upon her)\b/i.test(excerpt)) {
    return {
      stem: 'How does Sylvia’s silence help develop a theme in the excerpt?',
      correct:
        'It shows that protecting something innocent can matter more than getting approval or a reward.',
      distractors: [
        'It shows that Sylvia does not understand what the hunter wants from her.',
        'It suggests that the heron is unimportant because Sylvia quickly forgets it.',
        'It proves that Sylvia chooses money over loyalty to the natural world.',
      ],
    };
  }

  if (/\b(Why, then, O brawling love|O loving hate|heavy lightness|cold fire|sick health)\b/i.test(excerpt)) {
    return {
      stem: 'How does Romeo’s language help develop the tone of the excerpt?',
      correct:
        'It creates a conflicted, emotional tone by showing love and hate as tangled together in Romeo’s mind.',
      distractors: [
        'It creates a calm tone by showing that Romeo has completely solved his feelings.',
        'It makes the scene feel humorous because Romeo is mocking other characters.',
        'It removes emotion from the scene by using only literal descriptions of the feud.',
      ],
    };
  }

  if (/\b(Love is a smoke|madness most discreet|choking gall|preserving sweet|lovers’ tears)\b/i.test(excerpt)) {
    return {
      stem: 'How does the figurative description of love develop the tone of the excerpt?',
      correct:
        'It makes love feel painful and confusing, showing Romeo’s bitter attitude toward his own emotions.',
      distractors: [
        'It makes love seem simple because Romeo describes it as easy to understand.',
        'It shows that Romeo is speaking without emotion about an ordinary topic.',
        'It proves that Romeo no longer cares about love or conflict.',
      ],
    };
  }

  if (/\b(mountain was no longer savage and wild|valley was no longer dark and lonely|beauty and light|music and song)\b/i.test(excerpt)) {
    return {
      stem: 'How does the change in the mountain and valley help develop a theme?',
      correct:
        'It shows that courage and wisdom can transform a place of fear into a place of order and hope.',
      distractors: [
        'It shows that the valley remains dangerous even after Apollo acts.',
        'It suggests that the setting never changes, so Apollo’s actions have no meaning.',
        'It proves that the people were happier before Apollo arrived.',
      ],
    };
  }

  if (/\b(filled with grief and rage|wicked uncle, who loved only himself|death which he so richly deserved|allowed him to live)\b/i.test(excerpt)) {
    return {
      stem: 'How does the people’s response to Daedalus help develop a theme?',
      correct:
        'It shows the tension between justice and mercy because the people condemn his selfish act but still spare his life.',
      distractors: [
        'It shows that the people approve of Daedalus’s selfishness and reward him.',
        'It suggests that no one cares about what happened to Perdix.',
        'It proves that Daedalus immediately admits guilt and asks to be punished.',
      ],
    };
  }

  if (/\b(terror in the joy|forgot everything in the world but joy|thirst of his captivity|highest heavens)\b/i.test(excerpt)) {
    return {
      stem: 'How does Icarus’s reaction to flight help develop a theme?',
      correct:
        'It shows how joy and freedom can become dangerous when desire overwhelms caution.',
      distractors: [
        'It shows that Icarus remains careful because he feels no excitement while flying.',
        'It suggests that flight makes Icarus think only about obeying every warning.',
        'It proves that Icarus is afraid to leave Crete and refuses to fly higher.',
      ],
    };
  }

  if (/\b(friend of life and the foe of death|people blessed him|healing diseases|honor him)\b/i.test(excerpt)) {
    return {
      stem: 'How does the description of AEsculapius help develop a theme?',
      correct:
        'It shows that knowledge becomes meaningful when it is used to heal and protect life.',
      distractors: [
        'It shows that AEsculapius uses knowledge mainly to gain power over others.',
        'It suggests that healing is unimportant because people do not remember him.',
        'It proves that AEsculapius avoids learning from nature or other people.',
      ],
    };
  }

  if (/\b(death slow winging to the dark|what was thy child|some change|Fortune smiled)\b/i.test(excerpt)) {
    return {
      stem: 'How does the image of death help develop the tone of the excerpt?',
      correct:
        'It creates a sorrowful, fearful tone by showing how quickly hope for a child can turn into loss.',
      distractors: [
        'It creates a playful tone by making death seem harmless and distant.',
        'It shows that the speaker feels certain children will always be safe.',
        'It shifts the excerpt away from family and focuses only on wealth.',
      ],
    };
  }

  if (/\b(Coon, Antenor[’']s eldest hope|Tears, at the sight|pierced with grief|brother[’']s corpse|social shades)\b/i.test(excerpt)) {
    return {
      stem: 'How does Coon’s grief for his brother develop the tone of the excerpt?',
      correct:
        'It makes the battle feel mournful by showing family grief inside the violence.',
      distractors: [
        'It makes the battle feel playful because Coon treats the death as a game.',
        'It removes emotion from the scene by focusing only on weapons and armor.',
        'It shows that Coon is indifferent to his brother’s death and avoids action.',
      ],
    };
  }

  return {
    stem: `How does "${phrase}" help develop a theme or tone in the excerpt?`,
    correct:
      'It points to an attitude or larger idea beneath the event, so the reader sees more than the surface action.',
    distractors: [
      'It gives a minor plot fact that does not connect to tone or theme.',
      'It contradicts the mood of the excerpt by making the scene feel playful and safe.',
      'It replaces the need for evidence because the theme can be guessed from the title.',
    ],
  };
}

function r11StyleQuestionPackage(excerpt: string, phrase: string): QuestionPackage {
  if (/\b(no longer savage and wild|no longer dark and lonely|music and song|beauty and light)\b/i.test(excerpt)) {
    return {
      stem: 'How does the repeated contrast “no longer... but...” affect the passage?',
      correct:
        'It emphasizes transformation by contrasting the place’s former danger with its new beauty and order.',
      distractors: [
        'It shows that the place remains exactly the same after Apollo builds there.',
        'It makes the passage focus only on location without showing any change in meaning.',
        'It suggests that the people are less safe after the temple is built.',
      ],
    };
  }

  if (/\b(like a pale star|as soft as moths|as if she too could go flying away among the clouds|golden dazzle|vast and awesome world)\b/i.test(excerpt)) {
    return {
      stem: 'How does the author’s imagery and comparison help develop Sylvia’s experience in the tree?',
      correct:
        'It makes Sylvia’s climb feel magical and expansive, showing how the height changes the way she sees herself and the world.',
      distractors: [
        'It makes the climb seem ordinary by describing only the physical steps Sylvia takes.',
        'It suggests that Sylvia is bored because the view from the tree gives her nothing new to notice.',
        'It proves that Sylvia is afraid of nature and wants to leave the tree immediately.',
      ],
    };
  }

  if (/\b(like a great main-mast|old pine must have loved his new dependent|tree stood still and held away the winds)\b/i.test(excerpt)) {
    return {
      stem: 'How does the personification of the tree affect the passage?',
      correct:
        'It makes the tree seem protective and alive, emphasizing Sylvia’s connection to nature as she climbs.',
      distractors: [
        'It makes the tree seem hostile because it tries to stop Sylvia from climbing.',
        'It shows that the tree is only a background object with no effect on Sylvia’s experience.',
        'It shifts the passage away from nature by focusing only on machinery.',
      ],
    };
  }

  if (/\b(heap of dry chaff tossed about by a whirlwind|terrible great wave|seemed to rear itself|as if he were on horseback)\b/i.test(excerpt)) {
    return {
      stem: 'How does the comparison to “a heap of dry chaff tossed about by a whirlwind” affect the passage?',
      correct:
        'It shows how powerless the raft is against the wave, making the storm feel violent and overwhelming.',
      distractors: [
        'It shows that the raft is heavy and stable enough to resist the storm easily.',
        'It makes the storm seem peaceful because the raft moves gently across calm water.',
        'It explains that Ulysses is controlling the wave rather than struggling against it.',
      ],
    };
  }

  if (/\b(foul weeds|pale light|glittered|as in a mirror|shining shield)\b/i.test(excerpt)) {
    return {
      stem: 'How does the author’s description of the riverbank and shield affect the passage?',
      correct:
        'It makes the scene feel tense and indirect, showing Perseus must rely on reflected sight instead of looking straight at danger.',
      distractors: [
        'It makes the riverbank seem beautiful, so Perseus’s danger feels less urgent.',
        'It emphasizes the shield as a weapon, but not as part of how Perseus avoids danger.',
        'It shows Perseus is curious about the setting, but the description does not shape the suspense.',
      ],
    };
  }

  if (/\b(Love is a smoke|fire sparkling in lovers’ eyes|sea nourish’d with lovers’ tears|madness most discreet|choking gall|preserving sweet)\b/i.test(excerpt)) {
    return {
      stem: 'How does Romeo’s figurative language affect the meaning of the excerpt?',
      correct:
        'It presents love as contradictory and painful, showing that Romeo experiences love as both attraction and suffering.',
      distractors: [
        'It presents love as simple and easy because every image has the same positive meaning.',
        'It shows that Romeo is giving factual advice about how to avoid conflict.',
        'It removes emotion from the excerpt by describing love in plain literal terms.',
      ],
    };
  }

  if (/\b(O brawling love|O loving hate|heavy lightness|cold fire|sick health|Misshapen chaos)\b/i.test(excerpt)) {
    return {
      stem: 'How do Romeo’s contradictory phrases affect the passage?',
      correct:
        'They make Romeo’s feelings sound confused and conflicted, showing that love and hate are tangled together in his mind.',
      distractors: [
        'They show Romeo using formal language to hide his feelings from the reader.',
        'They make Romeo sound clever, but the contradictions do not reveal his emotional state.',
        'They shift attention from Romeo’s feelings to the public conflict in the street.',
      ],
    };
  }

  if (/\b(as though he would swallow not only Perseus|wide jaws|lashing the water|terrible fellow|roaring towards the shore)\b/i.test(excerpt)) {
    return {
      stem: 'How does the phrase “as though he would swallow” affect the passage?',
      correct:
        'It exaggerates the monster’s threat, making the danger feel larger than the characters and even the rock they stand on.',
      distractors: [
        'It makes the monster seem harmless because it shows the monster cannot reach anyone.',
        'It shifts the focus away from danger by describing a peaceful shoreline.',
        'It proves that Perseus is imagining the monster and that no real threat exists.',
      ],
    };
  }

  if (/\b(like hounds in the chase|dreadful screams|clatter of their golden wings|snapping of their horrible jaws)\b/i.test(excerpt)) {
    return {
      stem: 'How does the comparison “like hounds in the chase” affect the passage?',
      correct:
        'It makes the pursuit feel relentless, showing the Gorgons tracking Perseus like hunters following prey.',
      distractors: [
        'It makes the Gorgons seem gentle because hounds are described as harmless pets.',
        'It shows that Perseus is chasing the Gorgons instead of escaping from them.',
        'It removes tension by proving the Gorgons have stopped following Perseus.',
      ],
    };
  }

  if (/\b(savage and wild|lonely and dark|as if in dread|dreadful den)\b/i.test(excerpt)) {
    return {
      stem: `How does the author’s word choice in "${phrase}" affect the passage?`,
      correct:
        'It makes the place feel dangerous before the conflict begins, so the language prepares the reader for Apollo’s threat.',
      distractors: [
        'It makes the place seem peaceful because the words suggest safety and comfort.',
        'It only names the location without shaping the reader’s response.',
        'It proves that Apollo has already defeated the danger before arriving.',
      ],
    };
  }

  return {
    stem: `How does the author's word choice or technique in "${phrase}" affect the passage?`,
    correct:
      'It shapes the reader’s response through language, making the meaning or style stronger than a plain summary would.',
    distractors: [
      'It is decorative language that has no connection to the passage’s meaning or style.',
      'It explains the entire plot directly, so the reader does not need to interpret it.',
      'It shifts the excerpt away from literary meaning and into unrelated factual information.',
    ],
  };
}

function r11SettingQuestionPackage(excerpt: string, phrase: string): QuestionPackage {
  const text = excerpt.toLowerCase();

  if (/\b(no longer savage and wild|no longer dark and lonely|music and song|beauty and light)\b/i.test(excerpt)) {
    return {
      stem: 'How does the change from a “savage and wild” mountain to a place of “music and song” develop the excerpt’s meaning?',
      correct:
        'It shows that the place has been transformed from fear and danger into safety, beauty, and order.',
      distractors: [
        'It mainly shows that Apollo chose a convenient place for a temple, without changing the mood of the land.',
        'It suggests that the people move near the temple because they fear Apollo as much as they feared the Python.',
        'It emphasizes the beauty of the new temple but leaves the earlier fear in the valley unresolved.',
      ],
    };
  }

  if (/\b(cheerless cave|cold waves|wintry sea|ice mountains|desolate land)\b/i.test(excerpt)) {
    return {
      stem: 'How does the description of the Gray Sisters’ desolate land reinforce their isolation?',
      correct:
        'It makes the place feel empty and harsh, matching the strange isolation of the Gray Sisters.',
      distractors: [
        'It suggests that the land remains powerful and active even though the sisters themselves disappear.',
        'It shifts attention from the sisters to nature, making their fate seem less important than the landscape.',
        'It makes the setting feel mysterious, but mainly to show that the sisters may return later.',
      ],
    };
  }

  if (
    /\b(palinurus|stars?|pleiads|hyads|orion|tempest|settled sky|nocturnal sky|sailors?|plow the deep|weigh)\b/i.test(
      excerpt
    ) &&
    /\b(nocturnal sky|stars?|tempest|settled sky|palinurus|plow the deep|weigh)\b/i.test(excerpt)
  ) {
    return {
      stem: 'How does the description of the night sky help explain the sailors’ decision to continue their journey?',
      correct:
        'It shows that the sailors use signs in the setting to decide whether it is safe to continue their journey.',
      distractors: [
        'It shows that the shore offers rest, so the sailors decide to remain there instead of continuing their voyage.',
        'It suggests that Palinurus trusts the beauty of the night more than the practical signs in the sky.',
        'It slows the action to create calm, but it does not affect the sailors’ decision to leave shore.',
      ],
    };
  }

  if (/\b(bright green swamp grass|soft black mud|salt marshes|sea which sylvia|sunshine always seemed strangely yellow)\b/i.test(excerpt)) {
    return {
      stem: `How does the description of the swamp setting in "${phrase}" help the reader understand Sylvia’s knowledge of the woods?`,
      correct:
        'It makes the place feel vivid, hidden, and slightly dangerous, showing why Sylvia’s knowledge of the setting matters.',
      distractors: [
        'It suggests that Sylvia notices beauty in the place but does not understand the risks around it.',
        'It makes the swamp seem like a simple route to the sea rather than a place connected to Sylvia’s choice.',
        'It shows that Sylvia’s grandmother controls the setting by warning her away from the marshes.',
      ],
    };
  }

  if (/\b(savage|wild|lonely|dread|python|serpent|dreadful den)\b/i.test(excerpt)) {
    return {
      stem: `How does the setting description in "${phrase}" help develop the conflict in the excerpt?`,
      correct:
        'It presents the place as threatening before the Python appears, making Apollo’s decision to build there feel dangerous.',
      distractors: [
        'It shows that Apollo is unfamiliar with the land and must depend on the people who live there.',
        'It suggests that the valley is peaceful but misunderstood by the people who live near it.',
        'It emphasizes the size of the mountain more than the danger connected to Apollo’s plan.',
      ],
    };
  }

  if (/\b(living in caves and in holes of the earth|shivering with the cold|dying of starvation|hunted by wild beasts)\b/i.test(excerpt)) {
    return {
      stem: 'How does the description of people living in caves help explain Prometheus’s purpose?',
      correct:
        'It makes human life seem harsh and unsafe, showing why Prometheus wants to help people.',
      distractors: [
        'It suggests that people have learned to survive, but it does not explain why Prometheus intervenes.',
        'It focuses on the physical hardship of the caves more than the larger problem facing people.',
        'It makes Prometheus seem curious about human life rather than motivated to change it.',
      ],
    };
  }

  if (/\b(sea monster|lashing the water|wide jaws|rock|shore|terrible fellow|roaring towards the shore)\b/i.test(excerpt)) {
    return {
      stem: `How does the description of the monster near the shore make the rescue conflict more urgent?`,
      correct:
        'It makes the setting part of the danger, showing that Perseus must act while the monster threatens both the girl and the place where they stand.',
      distractors: [
        'It emphasizes Perseus’s weapon more than the danger created by the monster’s approach.',
        'It suggests that the shore traps the characters, but the setting does not add to the conflict.',
        'It makes the monster seem frightening, but only as background to Perseus’s reputation.',
      ],
    };
  }

  if (/\b(great beast|forest|open space|woods and hills|fearful sounds|hid behind the trees)\b/i.test(excerpt)) {
    return {
      stem: 'How does the forest setting make the hunt feel more dangerous for the heroes?',
      correct:
        'It makes the hunt feel dangerous by showing the beast disrupting the open space and filling the woods and hills with fearful sounds.',
      distractors: [
        'It shows that the forest gives the heroes places to hide, making the beast seem easier to face.',
        'It makes the open space feel like an arena, but the beast’s actions are what create most of the danger.',
        'It suggests that the sounds in the woods exaggerate the danger more than the beast itself does.',
      ],
    };
  }

  if (/\b(woods?|shadows?|sunset|dark woods|western light|whippoorwills?)\b/i.test(excerpt)) {
    return {
      stem: `How does the setting description in "${phrase}" help shape the mood of the excerpt?`,
      correct:
        'It makes the scene feel quiet and shadowed, helping the reader sense the character’s uncertainty before the action continues.',
      distractors: [
        'It suggests the character is surrounded by natural details but does not yet know what choice to make.',
        'It makes the place feel familiar, which reduces some tension while still keeping the scene uncertain.',
        'It emphasizes time of day more than the character’s inner uncertainty.',
      ],
    };
  }

  if (/\b(swamp|marsh|mud|grass|sunshine|open place|sea)\b/i.test(excerpt)) {
    return {
      stem: `How does the description of the place in "${phrase}" affect the reader’s understanding of the excerpt?`,
      correct:
        'It makes the setting vivid and specific, helping the reader understand why this place matters to what the character notices or chooses.',
      distractors: [
        'It helps the reader picture the place but does not connect the place to the character’s decision.',
        'It suggests that the setting is beautiful enough to distract the character from the central problem.',
        'It makes the place seem dangerous, but only to explain why the character wants to leave.',
      ],
    };
  }

  if (/\b(storm|rain|wind|cold|tempest|threatening)\b/i.test(text)) {
    return {
      stem: `How does the setting description in "${phrase}" increase the pressure in the excerpt?`,
      correct:
        'It turns the setting into a force the characters must respond to, making the moment feel more urgent.',
      distractors: [
        'It makes the weather seem impressive, but the characters’ choices remain the only source of pressure.',
        'It shows that the characters notice the weather without showing that it changes the scene.',
        'It emphasizes the physical setting more than the emotional pressure on the characters.',
      ],
    };
  }

  return {
      stem: `How does the setting description in "${phrase}" add meaning to the character’s situation?`,
    correct:
      'It makes the place affect mood, conflict, meaning, or character understanding instead of only naming where the scene happens.',
    distractors: [
      'It helps the reader picture the location, but it does not clearly shape mood, conflict, or meaning.',
      'It emphasizes what the place looks like more than what the place makes the reader understand.',
      'It gives background context for the action, but the action itself creates the main meaning.',
    ],
  };
}

function selectEvidencePhrase(standard: string, excerpt: string, subSkillId?: string | null) {
  if (standard === 'ELA.9.R.1.1' && subSkillId === 'setting-layer') {
    const settingPhrase = excerpt.match(
      /\b(?:no longer savage and wild|no longer dark and lonely|cheerless cave|cold waves|wintry sea|ice mountains|desolate land|savage and wild|lonely and dark|as if in dread[^,.]*|woods were already filled with shadows|bright sunset[^,.]*|bright green swamp grass|open place where the sunshine[^,.]*|living in caves and in holes of the earth|shivering with the cold|hunted by wild beasts|door of the little house stood open|whippoorwills came and sang[^,.]*|nocturnal sky|notes their sliding course|no threat[’']ning tempest nigh|settled sky|dusky shades of night|woods and hills echoed with fearful sounds|middle of a little open space|set out for the forest)\b/i
    )?.[0];
    if (settingPhrase) return settingPhrase.trim();
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'plot-conflict-layer') {
    const conflictPhrase = excerpt.match(
      /\b(?:huge serpent called the Python|seized sheep and cattle|carried them up to his dreadful den|devoured them|cut the chain|sea monster was close at hand[^,.]*|opening his wide jaws[^,.]*|turned into stone|struck it in the neck[^,.]*|dragon soon fell to the ground dead|He had never been in so great danger before|threw a heavy quoit[^,.]*|struck a stranger[^,.]*|met his death|great beast was found[^,.]*|came charging out upon his foes|hid behind the trees[^,.]*|tearing up the ground[^,.]*|tore him in pieces|overtaken and killed|woods and hills echoed with fearful sounds)\b/i
    )?.[0];
    if (conflictPhrase) return conflictPhrase.trim();
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'characterization-layer') {
    const characterPhrase = excerpt.match(
      /\b(?:But I tell you, you must lie upon it|sharp eyes and quick ears|dodged aside so quickly|seized the fellow's legs|tripped him up|seized the trembling man[^.!?]*|looked him straight in the eye|spoken so rashly|he began to feel sorry[^.!?]*|never show his face[^.!?]*|Do thou but call my resolution wise|with this knife I’ll help it presently|Give me some present counsel|I long to die|Graze where you will|hang, beg, starve, die|I do not use to jest|if your work is best[^.!?]*|I agree)\b/i
    )?.[0];
    if (characterPhrase) return characterPhrase.trim();
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'point-of-view-layer') {
    const povPhrase = excerpt.match(
      /\b(?:No, she must keep silence|What is it that suddenly forbids her[^.!?]*|Sylvia cannot speak|she cannot tell the heron’s secret[^.!?]*|Did my heart love till now|I ne[’']er saw true beauty till this night|Thou knowest the mask of night is on my face|I am too fond|I should have been more strange[^.!?]*|I have a faint cold fear[^.!?]*|What if this mixture do not work at all|I was for jeering at the Cyclops again|the men begged and prayed of me[^.!?]*|I divided them into two companies[^.!?]*|I took command of the other myself|They wept bitterly[^.!?]*|I was moved to tears[^.!?]*|I would not let her come near[^.!?]*|my heart was clouded with care|we found our comrades lamenting us|anxiously awaiting our return)\b/i
    )?.[0];
    if (povPhrase) return povPhrase.trim();
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'theme-tone-layer') {
    const themeTonePhrase = excerpt.match(
      /\b(?:No, she must keep silence|she cannot tell the heron’s secret[^.!?]*|Why, then, O brawling love|O loving hate|Love is a smoke[^.!?]*|temper(?:ing)? extremities with extreme sweet|friend of life and the foe of death|filled with grief and rage[^.!?]*|wicked uncle, who loved only himself|mountain was no longer savage and wild[^.!?]*|valley was no longer dark and lonely[^.!?]*|terror in the joy|forgot everything in the world but joy|death slow winging to the dark)\b/i
    )?.[0];
    if (themeTonePhrase) return themeTonePhrase.trim();
  }

  if (standard === 'ELA.9.R.1.1' && subSkillId === 'style-technique-layer') {
    const stylePhrase = excerpt.match(
      /\b(?:like a pale star|as soft as moths|as if she too could go flying away among the clouds|like a great main-mast|old pine must have loved his new dependent|as though it were a heap of dry chaff tossed about by a whirlwind|as if he were on horseback|foul weeds|pale light|as in a mirror|something which glittered|Love is a smoke|fire sparkling in lovers’ eyes|sea nourish’d with lovers’ tears|madness most discreet|choking gall|preserving sweet|as though he would swallow[^,.]*|like hounds in the chase|savage and wild|lonely and dark|as if in dread[^,.]*)\b/i
    )?.[0];
    if (stylePhrase) return stylePhrase.trim();
  }

  if (standard === 'ELA.9.R.3.1' && subSkillId) {
    const r31PhraseRules: Record<string, RegExp> = {
      'metaphor-simile':
        /\b(?:Love is a smoke[^.!?]*|like a patient etheri[sz]ed upon a table|like a pale star|as soft as moths|as if she too could go flying away among the clouds|like two dragon-flies|as though it were a heap of dry chaff[^.!?]*|as though he would swallow[^,.]*|like hounds in the chase)\b/i,
      'personification-effect':
        /\b(?:yellow fog that rubs its back[^.!?]*|yellow smoke that rubs its muzzle[^.!?]*|The night, proceeding on with silent pace[^.!?]*|the fireplace confronted him[^.!?]*|furniture[^.!?]*intolerable inquiry[^.!?]*|the roof had turned itself into a gymnasium[^.!?]*)\b/i,
      'imagery-sensory-language':
        /\b(?:woods were already filled with shadows[^.!?]*|dusky shades of night[^.!?]*|yellow fog[^.!?]*|yellow smoke[^.!?]*|finest powder[^.!?]*|cold which was not of frost[^.!?]*|savage and wild|lonely and dark|bright green swamp grass[^.!?]*)\b/i,
      'symbol-object-meaning':
        /\b(?:white heron|heron[’']s secret|golden apples?|untasted wine[^.!?]*|flat and filmy|head of Medusa|turned into stone|window|fireplace|smoke|fog)\b/i,
      'mood-shift-effect':
        /\b(?:no longer savage and wild[^.!?]*|no longer dark and lonely[^.!?]*|terror in the joy|forgot everything in the world but joy|Then one day[^.!?]*|Now had the sun withdrawn[^.!?]*|no threat[’']?ning tempest[^.!?]*)\b/i,
    };
    const r31Phrase = excerpt.match(r31PhraseRules[subSkillId])?.[0];
    if (r31Phrase) return r31Phrase.trim();
  }

  if (standard === 'ELA.9.R.3.2' && subSkillId) {
    const r32PhraseRules: Record<string, RegExp> = {
      'chunk-complex-syntax':
        /\b[^.?!]*(?:although|because|while|when|which|who|that|therefore|however|but|yet|so that|whereas|nevertheless)[^.?!]*[.?!]/i,
      'preserve-original-meaning':
        /\b[^.?!]*(?:because|therefore|however|although|but|yet|if|when|while|so that|instead|rather than|unless|except|without|must|should|cannot|no longer|only)[^.?!]*[.?!]/i,
      'translate-archaic-or-formal-language':
        /\b[^.?!]*(?:hath|thou|thee|thy|shall|wherefore|hence|therefore|lest|whence|thus|consequently|publick|honou?r|doth|ne'er|o'er|forc[’']d|view[’']d|ev[’']ry|motive|sincerity|consideration|advantage|illustrious|dominion|manifest|expedient)[^.?!]*[.?!]/i,
      'paraphrase-claim-or-theme':
        /\b[^.?!]*(?:truth|therefore|thus|must|should|means|shows|purpose|motive|idea|answer|question|conclude|believe|I say|I profess|publick good|country|equal)[^.?!]*[.?!]/i,
    };
    const r32Phrase = excerpt.match(r32PhraseRules[subSkillId])?.[0];
    if (r32Phrase) return r32Phrase.trim();
  }

  if (standard === 'ELA.9.R.1.4' && subSkillId) {
    const r14PhraseRules: Record<string, RegExp> = {
      'in-medias-res':
        /\b(?:Arms, and the man I sing[^.!?]*|Tell me, O Muse[^.!?]*|who travelled far and wide after he had sacked[^.!?]*|Many cities did he visit[^.!?]*|many the woes he suffered[^.!?]*|So now all who escaped death[^.!?]*except Ulysses|was detained by the goddess Calypso[^.!?]*|All were attentive to the godlike man[^.!?]*|Renews the sad remembrance of our fate[^.!?]*|O goddess-born[^.!?]*escape[^.!?]*|The foes already have possess[’']d the wall[^.!?]*|I heard; and Heav[’']n[^.!?]*|To run where clashing arms and clamour calls[^.!?]*|A son and heir, young in his dwelling[^.!?]*|Sing, O goddess[^.!?]*|wrath of Achilles[^.!?]*|set them both on quarrelling[^.!?]*|already[^.!?]*|battle[^.!?]*)\b/i,
      'divine-intervention':
        /\b(?:Minerva descends[^.!?]*|by the order of Jupiter|miraculously endued with voice[^.!?]*|prophecy his fate[^.!?]*|prayed much and made drink offerings[^.!?]*|god|goddess|fate|heaven)\b/i,
      'epic-hero-traits':
        /\b(?:hero obstinately refuses[^.!?]*|rushes with fury to the combat[^.!?]*|lamentations for his friend[^.!?]*|brave|courage|honou?r|glory|endure)\b/i,
      'quest-journey-structure':
        /\b(?:who travelled far and wide after he had sacked[^.!?]*|trying to save his own life and bring his men safely home[^.!?]*|So now all who escaped death[^.!?]*except Ulysses|got to the land[^.!?]*great cave|Italian shore|we break our sleep[^.!?]*|Forsake the pleasing shore[^.!?]*|plow the deep|ship|sea|shore|return|home|voyage|journey)\b/i,
      'ritual-speech-oath':
        /\b(?:prayed much and made drink offerings[^.!?]*|bowl of sweet wine[^.!?]*|wine|offering|prayer|feast|oath|sacrifice|spoke|answered)\b/i,
      'theme-through-heroic-action':
        /\b(?:rushes with fury to the combat[^.!?]*|refuses all repast[^.!?]*|lamentations for his friend[^.!?]*|honou?r|fate|loyalty|home|death|glory|sacrifice)\b/i,
      'elevated-style-epic-simile':
        /\b(?:Sing, O goddess[^.!?]*|bright Orion, arm[’']d with burnish[’']d gold[^.!?]*|The night, proceeding on with silent pace[^.!?]*|like [^,.!?]+|as when [^,.!?]+|radiant|burnish[’']d|Muse|wrath)\b/i,
    };
    const r14Phrase = excerpt.match(r14PhraseRules[subSkillId])?.[0];
    if (r14Phrase) return r14Phrase.trim();
  }

  if (standard === 'ELA.9.R.1.2' && subSkillId) {
    const r12PhraseRules: Record<string, RegExp> = {
      'universal-theme':
        /\b(?:No, she must keep silence|she cannot tell the heron[’']s secret[^.!?]*|they loved themselves better than their brother[^.!?]*|this thing they would not do|filled with grief and rage[^.!?]*|wicked uncle, who loved only himself|Love is a smoke[^.!?]*|O brawling love[^.!?]*|She hath forsworn to love[^.!?]*|Do not swear at all[^.!?]*|too rash, too unadvised, too sudden|No time shall find me wanting to my truth[^.!?]*|To love so great[^.!?]*|All this trouble came from disobedience[^.!?]*)\b/i,
      'theme-development-moments':
        /\b(?:What is it that suddenly forbids her[^.!?]*|No, she must keep silence|she cannot tell the heron[’']s secret[^.!?]*|It was not long until they learned to cook[^.!?]*|They began at once to leave off[^.!?]*|precious spark hidden in the hollow center of the plant|given them fire and lifted them out of their wretchedness[^.!?]*|never would he beg for mercy[^.!?]*|he forgot everything in the world but joy|There was a terror in the joy|Alas for him|Warmer and warmer grew the air|in that terror he remembered|The heat of the sun had melted the wax[^.!?]*|Atalanta now ran forward[^.!?]*|Then Meleager rushed up[^.!?]*|mountain was no longer savage and wild[^.!?]*|valley was no longer dark and lonely[^.!?]*|turned into stone[^.!?]*|no longer|suddenly|at last)\b/i,
      'theme-through-conflict':
        /\b(?:Two households, both alike in dignity[^.!?]*|ancient grudge break to new mutiny[^.!?]*|From forth the fatal loins of these two foes[^.!?]*|huge serpent called the Python|carried them up to his dreadful den[^.!?]*|sea monster was close at hand[^.!?]*|opening his wide jaws[^.!?]*|Perseus drew his sharp sword and cut the chain[^.!?]*|No young man had ever spoken to her before[^.!?]*|filled her heart with fear|She turned and fled like a frightened deer|O Father Peneus, save me|Death is my son-in-law[^.!?]*|life, living, all is death[’']?s?|God[’']s bread, it makes me mad|I[’']ll not wed[^.!?]*|spoken so rashly[^.!?]*|never show his face[^.!?]*|hang, beg, starve, die|danger|death|power|pride)\b/i,
    };
    const r12Phrase = excerpt.match(r12PhraseRules[subSkillId])?.[0];
    if (r12Phrase) return r12Phrase.trim();
  }

  if (standard === 'ELA.9.R.1.3' && subSkillId) {
    const r13PhraseRules: Record<string, RegExp> = {
      'narrator-perspective':
        /\b(?:Sylvia’s heart gave a wild beat|she knew that strange white bird|the sea which Sylvia wondered and dreamed about|small and hopeful Sylvia|utmost bravery|knew that higher still[^.!?]*|No, she must keep silence|What is it that suddenly forbids her[^.!?]*|she cannot tell the heron[’']s secret[^.!?]*|Wondering over and over again[^.!?]*|The guest waked from a dream[^.!?]*|He was sure[^.!?]*|Alas for him|in that terror he remembered|he forgot everything in the world but joy)\b/i,
      'irony-reversal-contrast':
        /\b(?:I shall now therefore humbly propose[^.!?]*|not be liable to the least objection|young healthy child well nursed|delicious nourishing and wholesome food|stewed, roasted, baked, or boiled|Infant[’']?s flesh[^.!?]*|collateral advantage[^.!?]*|lessening the number of Papists[^.!?]*|I profess in the sincerity of my heart[^.!?]*|not the least personal interest[^.!?]*|no other motive than the publick good[^.!?]*|publick good of my country|giving some pleasure to the rich|Alas for him|Warmer and warmer grew the air|The heat of the sun had melted the wax[^.!?]*|he forgot everything in the world but joy|He was sure[^.!?]*)\b/i,
      'satire-exaggeration-ridicule':
        /\b(?:I shall now therefore humbly propose[^.!?]*|not be liable to the least objection|young healthy child well nursed|delicious nourishing and wholesome food|stewed, roasted, baked, or boiled|offered in sale[^.!?]*|reserved for breed[^.!?]*|Infant[’']?s flesh[^.!?]*|fattest child to the market|no other motive than the publick good[^.!?]*|publick good of my country[^.!?]*)\b/i,
    };
    const r13Phrase = excerpt.match(r13PhraseRules[subSkillId])?.[0];
    if (r13Phrase) return r13Phrase.trim();
  }

  if (standard === 'ELA.9.R.2.1' && subSkillId) {
    const r21PhraseRules: Record<string, RegExp> = {
      'chronological-sequence':
        /\b(?:three tasks lay before me; first[^.!?]*|secondly, to show[^.!?]*|thirdly, to show[^.!?]*|As early as 1826[^.!?]*|from that time till to-day[^.!?]*|For first, as I have already observed[^.!?]*|Thirdly, Whereas[^.!?]*|Fifthly, This food[^.!?]*|Sixthly, This would[^.!?]*)\b/i,
      'cause-effect-structure':
        /\b(?:and therefore whoever could find out[^.!?]*|therefore, reckoning a year after Lent[^.!?]*|therefore it will have one other collateral advantage[^.!?]*|will be thereby encreased[^.!?]*|consequently have their houses frequented[^.!?]*|has resulted in sending[^.!?]*|If carpenters are needed[^.!?]*)\b/i,
      'compare-contrast-structure':
        /\b(?:instead of being able to work[^.!?]*|instead of seeking that personal freedom[^.!?]*|from the top downward[^.!?]*|not at the top but at the bottom[^.!?]*|I would not deny[^.!?]*|but I _do_ say[^.!?]*|while the Negro teachers have been discouraged[^.!?]*|Nevertheless, I insist[^.!?]*|not to make men carpenters[^.!?]*|it is to make carpenters men[^.!?]*|it is only fair to point out[^.!?]*|very far from being confined[^.!?]*|more than we allow to sheep[^.!?]*|but more plentiful in March[^.!?]*)\b/i,
      'problem-solution-structure':
        /\b(?:melancholy object[^.!?]*|great additional grievance[^.!?]*|fair, cheap and easy method[^.!?]*|what course may be taken[^.!?]*|How then shall the leaders[^.!?]*|There can be but one answer[^.!?]*|proper training of Negro children[^.!?]*)\b/i,
      'example-evidence-structure':
        /\b(?:For instance[^.!?]*|These figures illustrate[^.!?]*|there are to-day in the United States thirty-four institutions[^.!?]*|Of these graduates[^.!?]*|returns as to occupations[^.!?]*|I will give you an instance[^.!?]*)\b/i,
      'opening-closing-shift':
        /\b(?:If this be true--and who can deny it--three tasks lay before me[^.!?]*|How then shall the leaders[^.!?]*|Let us see[^.!?]*|But, as to myself[^.!?]*|I profess in the sincerity of my heart[^.!?]*|The truth of this has been strikingly shown[^.!?]*|The most interesting question[^.!?]*|In earlier years[^.!?]*|Nevertheless, I insist[^.!?]*)\b/i,
    };
    const r21Phrase = excerpt.match(r21PhraseRules[subSkillId])?.[0];
    if (r21Phrase) return r21Phrase.trim();
  }

  if (standard === 'ELA.9.R.2.2' && subSkillId) {
    const r22PhraseRules: Record<string, RegExp> = {
      'central-idea-stated-implied':
        /\b(?:It is a melancholy object[^.!?]*|The question therefore is[^.!?]*|The most interesting question[^.!?]*|If this be true--and who can deny it--three tasks lay before me[^.!?]*|How then shall the leaders[^.!?]*|There can be but one answer[^.!?]*|I shall now therefore humbly propose[^.!?]*|I do therefore humbly offer it to publick consideration[^.!?]*|I think the advantages by the proposal[^.!?]*|The truth of this has been strikingly shown[^.!?]*|I say, therefore[^.!?]*|I conclude, therefore[^.!?]*|It is necessary, therefore[^.!?]*|The wise prince, therefore[^.!?]*)\b/i,
      'strong-vs-weak-evidence':
        /\b(?:These figures illustrate[^.!?]*|there are to-day in the United States thirty-four institutions[^.!?]*|Of these graduates[^.!?]*|returns as to occupations[^.!?]*|For instance[^.!?]*|computed the charge[^.!?]*|proper training of Negro children[^.!?]*)\b/i,
      'evidence-develops-central-idea':
        /\b(?:These figures illustrate[^.!?]*|The truth of this has been strikingly shown[^.!?]*|there are to-day in the United States thirty-four institutions[^.!?]*|Of these graduates[^.!?]*|returns as to occupations[^.!?]*|For instance[^.!?]*|therefore it will have one other collateral advantage[^.!?]*)\b/i,
      'best-evidence-for-claim':
        /\b(?:These figures illustrate[^.!?]*|there are to-day in the United States thirty-four institutions[^.!?]*|Of these graduates[^.!?]*|returns as to occupations[^.!?]*|For instance[^.!?]*|computed the charge[^.!?]*|will be thereby encreased[^.!?]*)\b/i,
      'detail-vs-central-idea':
        /\b(?:For instance[^.!?]*|computed the charge[^.!?]*|there are to-day[^.!?]*|Of these graduates[^.!?]*|more plentiful in March[^.!?]*|I grant this food will be somewhat dear[^.!?]*)\b/i,
      'central-idea-development-across-paragraphs':
        /\b(?:three tasks lay before me[^.!?]*|How then shall the leaders[^.!?]*|There can be but one answer[^.!?]*|These figures illustrate[^.!?]*|The most interesting question[^.!?]*|Nevertheless, I insist[^.!?]*|The truth of this has been strikingly shown[^.!?]*)\b/i,
    };
    const r22Phrase = excerpt.match(r22PhraseRules[subSkillId])?.[0];
    if (r22Phrase) return r22Phrase.trim();
  }

  if (standard === 'ELA.9.R.2.3' && subSkillId) {
    const r23PhraseRules: Record<string, RegExp> = {
      'logos-ethos-pathos':
        /\b(?:It is a melancholy object[^.!?]*|I shall now therefore humbly propose[^.!?]*|I have been assured by a very knowing American[^.!?]*|computed the charge[^.!?]*|These figures illustrate[^.!?]*|How then shall the leaders[^.!?]*|There can be but one answer[^.!?]*|I profess in the sincerity of my heart[^.!?]*|It has been necessary[^.!?]*|We few, we happy few[^.!?]*)\b/i,
      'logos-evidence-reasoning':
        /\b(?:computed the charge[^.!?]*|there are to-day in the United States thirty-four institutions[^.!?]*|Of these graduates[^.!?]*|returns as to occupations[^.!?]*|These figures illustrate[^.!?]*|therefore it will have one other collateral advantage[^.!?]*|For first[^.!?]*|Secondly[^.!?]*|Thirdly[^.!?]*|eighty-five per cent[^.!?]*|For two hundred and fifty years[^.!?]*|I conclude, therefore[^.!?]*|no principality is secure[^.!?]*)\b/i,
      'ethos-credibility-authority':
        /\b(?:I have been assured by a very knowing American[^.!?]*|I profess in the sincerity of my heart[^.!?]*|not the least personal interest[^.!?]*|no other motive than the publick good[^.!?]*|we are told by a grave author[^.!?]*|Scripture[^.!?]*|Nevertheless, I insist[^.!?]*|Mr\. C\.P\. Huntington[^.!?]*|late beloved Frederick Douglass[^.!?]*|I do not mean in any way to apologize[^.!?]*|I would set no limits[^.!?]*)\b/i,
      'pathos-emotional-appeal':
        /\b(?:It is a melancholy object[^.!?]*|beggars of the female sex[^.!?]*|children, all in rags[^.!?]*|importuning every passenger for an alms[^.!?]*|great additional grievance[^.!?]*|poor innocent babes[^.!?]*|deplorable state[^.!?]*|worked meant degradation[^.!?]*|curse of slavery[^.!?]*|We few, we happy few[^.!?]*|sheds his blood with me[^.!?]*)\b/i,
      'rhetorical-question-repetition':
        /\b(?:How then shall the leaders[^.!?]*|Was the work[^.!?]*|The most interesting question[^.!?]*|The question therefore[^.!?]*|For first[^.!?]*|Secondly[^.!?]*|Thirdly[^.!?]*|Fifthly[^.!?]*|Sixthly[^.!?]*|It has been necessary[^.!?]*|He that out-lives this day[^.!?]*|This day is call[^.!?]*|We few, we happy few[^.!?]*)\b/i,
      'figurative-language-purpose':
        /\b(?:melancholy object[^.!?]*|whole fabric of science[^.!?]*|living oracles[^.!?]*|book of nature[^.!?]*|universe stands continually open[^.!?]*|barbarous dominion stinks[^.!?]*|swallow up our people[^.!?]*|economic foundation[^.!?]*|raging rivers[^.!?]*|band of brothers[^.!?]*|household words[^.!?]*)\b/i,
      'purpose-fit-rhetorical-choice':
        /\b(?:I shall now therefore humbly propose[^.!?]*|I do therefore humbly offer it to publick consideration[^.!?]*|I think the advantages by the proposal[^.!?]*|computed the charge[^.!?]*|How then shall the leaders[^.!?]*|There can be but one answer[^.!?]*|These figures illustrate[^.!?]*|I profess in the sincerity of my heart[^.!?]*|I close, then, as I began[^.!?]*|fewer men, the greater share of honour[^.!?]*|If, therefore, your illustrious house[^.!?]*|This opportunity, therefore[^.!?]*|I compare her to one of those raging rivers[^.!?]*)\b/i,
    };
    const r23Phrase = excerpt.match(r23PhraseRules[subSkillId])?.[0];
    if (r23Phrase) return r23Phrase.trim();
  }

  if (standard === 'ELA.9.R.3.1' && subSkillId) {
    const r31PhraseRules: Record<string, RegExp> = {
      'metaphor-simile':
        /\b(?:Love is a smoke[^;.!?]*|like a patient etheri[sz]ed upon a table|Streets that follow like a tedious argument|like a pale star|as soft as moths|as if she too could go flying away among the clouds|like snowflakes|like two dragon-flies|as though it were a heap of dry chaff[^;.!?]*|as though he would swallow[^;.!?]*|black sack|black hole|like a hermitage|as if the stem of it were broken)\b/i,
      'personification-effect':
        /\b(?:The yellow fog that rubs its back upon the window-panes|The yellow smoke that rubs its muzzle on the window-panes|Licked its tongue into the corners of the evening|Curled once about the house, and fell asleep|The tree seemed to lengthen itself out|The old pine must have loved his new dependent|The night, proceeding on with silent pace[^;.!?]*)\b/i,
      'imagery-sensory-language':
        /\b(?:woods were already filled with shadows[^.!?]*|bright green swamp grass[^.!?]*|dusky shades of night[^.!?]*|yellow fog[^.!?]*|yellow smoke[^.!?]*|like a pale star|as soft as moths|At last the sun came up bewilderingly bright[^.!?]*)\b/i,
      'symbol-object-meaning':
        /\b(?:white heron|heron[’']s secret|golden apples?|head of Medusa|turned into stone|smoke made with the fume of sighs|black sack|black hole|In the place of death there was light)\b/i,
      'mood-shift-effect':
        /\b(?:terror in the joy|forgot everything in the world but joy|At last the sun came up bewilderingly bright|no longer savage and wild|no longer dark and lonely|no threat[’']?ning tempest[^.!?]*|made a sudden leap|In the place of death there was light|Death is over|There was no terror)\b/i,
    };
    const r31Phrase = excerpt.match(r31PhraseRules[subSkillId])?.[0];
    if (r31Phrase) return r31Phrase.trim();
  }

  const quoted = excerpt.match(/[“"][^”"]{20,130}[”"]/);
  if (quoted?.[0]) return quoted[0].replace(/[“”"]/g, '').trim();

  const all = sentences(excerpt);
  const r11Rules =
    standard === 'ELA.9.R.1.1' && subSkillId ? R11_QUESTION_CONFIG[subSkillId]?.phraseRules : null;
  const r14Rules =
    standard === 'ELA.9.R.1.4' && subSkillId
      ? {
          'in-medias-res': [/\bwrath|rage|quarrel|battle|already|began|Sing|Muse|Achilles\b/i],
          'divine-intervention': [/\bgod|goddess|Jove|Jupiter|Minerva|Apollo|heaven|fate|prayer|prophecy\b/i],
          'epic-hero-traits': [/\bhero|brave|courage|honou?r|glory|battle|spear|endure|rushes|refuses\b/i],
          'quest-journey-structure': [/\bjourney|ship|sea|shore|return|home|island|sail|voyage|wander\b/i],
          'ritual-speech-oath': [/\bprayer|offering|wine|feast|oath|sacrifice|spoke|said|answered\b/i],
          'theme-through-heroic-action': [/\bhonou?r|fate|loyalty|home|death|glory|choice|battle|friend\b/i],
          'elevated-style-epic-simile': [/\blike|as when|Sing|Muse|wrath|arms|heaven|radiant|burnish\b/i],
        }[subSkillId]
      : null;
  const scoringRules: Record<string, RegExp[]> = {
    'ELA.9.R.1.1': r11Rules ?? [
      /\bsavage and wild\b/i,
      /\blonely and dark\b/i,
      /\bas if in dread\b/i,
      /\bhuge serpent\b/i,
      /\bdreadful den\b/i,
      /\bwalk|stood|looked|saw|heard|voice|face|eyes\b/i,
    ],
    'ELA.9.R.1.2': [/\btruth|justice|freedom|power|duty|honor|pride|equal|hope|fear\b/i],
    'ELA.9.R.1.3': [
      /\bNo, she must keep silence\b/i,
      /\bnot be liable to the least objection\b/i,
      /\bdelicious nourishing and wholesome food\b/i,
      /\bI shall now therefore humbly propose\b/i,
      /\bAlas for him\b/i,
      /\bbut|however|seemed|thought|knew|remembered|profess|assured\b/i,
    ],
    'ELA.9.R.1.4': r14Rules ?? [/\bgod|goddess|jove|minerva|apollo|muse|fate|prayer|hero|ship|battle\b/i],
    'ELA.9.R.2.1': [/\bfirst|second|finally|because|therefore|however|although|problem|solution\b/i],
    'ELA.9.R.2.2': [
      /\bcentral|idea|point|claim|reason|evidence|because|therefore|example|support|shows|prove|illustrate|figures|truth|answer\b/i,
    ],
    'ELA.9.R.2.3': [/\bmust|should|we|you|our|believe|duty|justice|honor\b/i],
    'ELA.9.R.3.1': [/\blike|as if|as though|seemed|dark|cold|bright|shadow|silence\b/i],
    'ELA.9.R.3.4': [/\bwe|you|our|must|shall|should|why|how|therefore|justice|freedom\b/i],
  };

  const rules = scoringRules[standard] ?? [/[a-z]/i];
  const best =
    [...all].sort((a, b) => countMatches(b, rules) - countMatches(a, rules))[0] ??
    all[0] ??
    excerpt;

  const vividPhrase = best.match(
    /\b(?:savage and wild|lonely and dark|as if in dread[^,.]*|huge serpent[^,.]*|dreadful den|like [^,.]+|as though [^,.]+|as if [^,.]+)\b/i
  )?.[0];

  return (vividPhrase || best).slice(0, 140).trim();
}

function rotateChoices(
  correctIndexSeed: number,
  choices: Array<{ text: string; correct: boolean }>,
  options: { balanceLengths?: boolean } = {}
): Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }> {
  const labels = ['A', 'B', 'C', 'D'] as const;
  const balancedChoices = options.balanceLengths === false ? choices : balanceChoiceLengths(choices);
  const correct = balancedChoices.find((choice) => choice.correct) ?? balancedChoices[0];
  const distractors = balancedChoices.filter((choice) => choice !== correct);
  const correctSlot = correctIndexSeed % 4;
  const arranged: Array<{ text: string; correct: boolean }> = [];
  for (let index = 0; index < 4; index += 1) {
    arranged[index] = index === correctSlot ? correct : distractors.shift() ?? correct;
  }
  return arranged.map((choice, index) => ({ ...choice, label: labels[index] }));
}

function choiceWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function balanceChoiceLengths(choices: Array<{ text: string; correct: boolean }>) {
  const correct = choices.find((choice) => choice.correct);
  if (!correct) return choices;

  const correctWords = choiceWordCount(correct.text);
  const wrongChoices = choices.filter((choice) => !choice.correct);
  if (!wrongChoices.length) return choices;

  const maxWrong = Math.max(...wrongChoices.map((choice) => choiceWordCount(choice.text)));
  const avgWrong =
    wrongChoices.reduce((sum, choice) => sum + choiceWordCount(choice.text), 0) / wrongChoices.length;

  if (correctWords <= maxWrong + 4 && correctWords <= avgWrong + 5) return choices;

  const targetWords = Math.max(10, Math.min(correctWords - 2, correctWords));
  return choices.map((choice, index) =>
    choice.correct ? choice : { ...choice, text: extendDistractor(choice.text, targetWords, index) }
  );
}

function extendDistractor(text: string, targetWords: number, index: number) {
  const extensions = [
    'This misses the evidence in the excerpt.',
    'The passage points to a different effect.',
    'This does not explain the author’s move.',
    'The development of the passage points elsewhere.',
  ];
  let revised = text.trim();
  let extensionIndex = index;

  while (choiceWordCount(revised) < targetWords && extensionIndex < index + extensions.length) {
    const extension = extensions[extensionIndex % extensions.length];
    revised = `${revised.replace(/[.?!]\s*$/, '')}. ${extension}`;
    extensionIndex += 1;
  }

  return revised;
}

function r14QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  if (subSkillId === 'in-medias-res') {
    if (/\bArms, and the man I sing|forc[’']d by fate|left the Trojan shore/i.test(excerpt)) {
      return {
        stem: 'How does the opening of The Aeneid begin in the middle of a larger conflict?',
        correct:
          'It introduces Aeneas already exiled and struggling, so the reader enters a conflict that began before the poem.',
        distractors: [
          'It begins with Aeneas living peacefully in Rome after every conflict has already ended.',
          'It explains Aeneas’s childhood first, so the reader learns the story in full chronological order.',
          'It focuses only on the Muse and avoids naming the danger or pressure around Aeneas.',
        ],
      };
    }
    if (/\bRenews the sad remembrance of our fate|old foundations rent|Troy[’']s disaster/i.test(excerpt)) {
      return {
        stem: 'How does Aeneas’s speech place the reader inside an earlier conflict?',
        correct:
          'He begins with Troy already destroyed, making the reader infer the disaster as he retells it.',
        distractors: [
          'He begins before Troy is threatened, so the reader watches the conflict start slowly.',
          'He avoids the fall of Troy and tells only about a peaceful royal feast.',
          'He resolves the Trojan conflict immediately, making the speech mostly a celebration.',
        ],
      };
    }
    if (/\bTell me, O Muse|travelled far and wide|suffered much by sea|bring his men safely home/i.test(excerpt)) {
      return {
        stem: 'How does the opening of The Odyssey begin in the middle of Ulysses’s journey?',
        correct:
          'It starts after Troy has fallen, with Ulysses already suffering at sea and trying to return home.',
        distractors: [
          'It starts with Ulysses as a child before he has faced any conflict or voyage.',
          'It shows Ulysses safely home, so the journey has ended before the poem begins.',
          'It focuses only on the Sun-god’s cattle and leaves Ulysses out of the action.',
        ],
      };
    }
    if (/\bThe foes already have possess[’']d the wall|Troy nods from high|escape, by timely flight/i.test(excerpt)) {
      return {
        stem: 'How does the warning about Troy’s fall create an in medias res effect?',
        correct:
          'It drops the reader into a crisis already underway, with Troy collapsing and Aeneas urged to flee.',
        distractors: [
          'It explains the city’s founding before any danger appears in the story.',
          'It shows that Troy has already been saved and no action is needed.',
          'It shifts away from the conflict to describe Aeneas’s family history only.',
        ],
      };
    }
    if (/\bSo now all who escaped death|except Ulysses|detained by the goddess Calypso/i.test(excerpt)) {
      return {
        stem: 'How does the opening situation create an in medias res effect in The Odyssey?',
        correct:
          'It begins after other warriors have returned, leaving Ulysses still trapped in the middle of his struggle.',
        distractors: [
          'It begins before the war has happened, so no one has started a journey home.',
          'It shows Ulysses already ruling peacefully in Ithaca with no remaining trouble.',
          'It focuses on Calypso’s home without connecting her to Ulysses’s delayed return.',
        ],
      };
    }
    return {
      stem: /\bArms, and the man I sing|Tell me, O Muse|travelled far and wide|So now all who escaped death/i.test(
        excerpt
      )
        ? 'How does the opening place the reader in the middle of an already complicated journey?'
        : /\bAll were attentive|sad remembrance of our fate|old foundations rent/i.test(excerpt)
          ? 'How does Aeneas’s speech place the reader in the middle of an earlier conflict?'
        : /\bSing, O goddess|wrath of Achilles|quarrelling/i.test(excerpt)
        ? 'How does the opening focus on Achilles’s wrath shape the structure of the epic?'
        : `How does the epic beginning with "${phrase}" affect the reader’s understanding of the action?`,
      correct:
        'It begins with conflict already in motion, forcing the reader to infer the situation and feel immediate tension.',
      distractors: [
        'It gives a calm background summary before the real conflict begins.',
        'It introduces the hero’s family history as the main structure of the epic.',
        'It resolves the conflict first so the rest of the epic explains why peace lasts.',
      ],
    };
  }

  if (subSkillId === 'divine-intervention') {
    if (/\bJove counselled their destruction|thunderbolts|filled with fire and brimstone/i.test(excerpt)) {
      return {
        stem: 'How does Jove’s action shape the epic events in this excerpt?',
        correct:
          'Jove directly destroys the ship, showing that divine power can control human survival and loss.',
        distractors: [
          'Jove watches from a distance but has no effect on the voyage or the crew.',
          'The sailors cause the storm themselves, so the gods are only decorative background.',
          'The excerpt shows a human argument being settled without any supernatural force.',
        ],
      };
    }
    if (/\bCyllenius with command|descends the god|as the fates requir[’']d/i.test(excerpt)) {
      return {
        stem: 'How does the god’s mission to Carthage develop the epic action?',
        correct:
          'The divine messenger changes how the Trojans are received, connecting their welcome to fate.',
        distractors: [
          'The god arrives too late to affect the Trojans’ situation in Carthage.',
          'The queen changes the laws without any connection to fate or divine command.',
          'The passage uses the god only to describe the sky, not to affect action.',
        ],
      };
    }
    if (/\bNeptune drove him|nevertheless, he let him get safe out/i.test(excerpt)) {
      return {
        stem: 'How does Neptune’s role shape the return journey in the excerpt?',
        correct:
          'Neptune controls the wreck and survival, showing that the heroes’ returns depend on divine power.',
        distractors: [
          'Neptune is mentioned only as scenery and does not affect the sailors’ journey.',
          'The excerpt shows Ajax choosing shipwreck as a test of his own courage.',
          'The return journey succeeds because no god interferes with human plans.',
        ],
      };
    }
    return {
      stem: /\bMinerva|Jupiter|Jove/i.test(excerpt)
        ? 'How does Minerva’s intervention help develop the epic action?'
        : `How does the divine force connected to "${phrase}" shape the excerpt?`,
      correct:
        'It shows that supernatural power directly affects human events, making the action part of a larger epic order.',
      distractors: [
        'It shows that the human characters solve the problem without help from any outside force.',
        'It makes the divine reference decorative because it does not affect action, fate, or meaning.',
        'It shifts the excerpt away from the conflict and into an unrelated description of the setting.',
      ],
    };
  }

  if (subSkillId === 'epic-hero-traits') {
    if (/\bStern Hector waved his sword|Great Ajax saw|Warn[’']d he retreats/i.test(excerpt)) {
      return {
        stem: 'What heroic trait is shown through Hector and Ajax in this battle moment?',
        correct:
          'The warriors show courage under pressure as they continue fighting while reading danger on the battlefield.',
        distractors: [
          'The warriors avoid risk by leaving the battlefield before any danger appears.',
          'The passage focuses on ordinary work rather than courage, combat, or reputation.',
          'The warriors depend on private emotion instead of public action in battle.',
        ],
      };
    }
    if (/\bUlysses killed|Telemachus|rushed forward and regained their spears/i.test(excerpt)) {
      return {
        stem: 'What heroic trait is shown when Ulysses and his men rush forward?',
        correct:
          'They show battle courage and leadership by acting together after striking down their enemies.',
        distractors: [
          'They show caution by refusing to enter the fight after the spears are thrown.',
          'They show hospitality by welcoming enemies instead of confronting them.',
          'They show grief but no action that affects the battle or their survival.',
        ],
      };
    }
    if (/\bwith thy conquer[’']d master die|revenge my woe|courage/i.test(excerpt)) {
      return {
        stem: 'What epic hero trait is revealed by the warrior’s speech to his horse?',
        correct:
          'His speech reveals loyalty and honor because he links victory or death to shared duty.',
        distractors: [
          'His speech reveals that he wants to escape the battle and abandon revenge.',
          'His speech shows comic relief instead of a serious heroic value.',
          'His speech proves the horse, not the warrior, controls the conflict.',
        ],
      };
    }
    return {
      stem: /\brefuses all repast|lamentations for his friend|rushes with fury/i.test(excerpt)
        ? 'What epic hero trait is revealed by Achilles’s response in this excerpt?'
        : `What epic hero trait is suggested by "${phrase}"?`,
      correct:
        'It reveals a heroic trait such as loyalty, courage, pride, or endurance through the character’s action under pressure.',
      distractors: [
        'It reveals that the hero avoids risk and waits for others to solve the problem.',
        'It mainly shows the hero’s ordinary daily routine rather than an epic trait.',
        'It proves the hero has no emotional connection to the conflict.',
      ],
    };
  }

  if (subSkillId === 'quest-journey-structure') {
    if (/\bgot to the land|great cave|abode of a huge monster/i.test(excerpt)) {
      return {
        stem: 'How does reaching the Cyclops’s land develop the quest structure?',
        correct:
          'It moves the sailors from travel into a new trial, turning the journey into a dangerous encounter.',
        distractors: [
          'It ends the quest because the sailors have safely reached their final home.',
          'It focuses only on scenery and does not introduce any new obstacle.',
          'It shows the sailors choosing to abandon the voyage before facing danger.',
        ],
      };
    }
    if (/\bdetained by the goddess Calypso|go back to Ithaca|troubles were not yet over/i.test(excerpt)) {
      return {
        stem: 'How does Ulysses’s delay with Calypso establish the quest structure?',
        correct:
          'It shows that returning home is the central goal, but divine obstacles keep the journey unfinished.',
        distractors: [
          'It shows Ulysses has already completed the quest and no longer wants Ithaca.',
          'It makes Calypso a minor setting detail rather than an obstacle to return.',
          'It changes the epic from a journey into a simple description of island life.',
        ],
      };
    }
    if (/\bArms, and the man I sing|left the Trojan shore|Long labours, both by sea and land/i.test(excerpt)) {
      return {
        stem: 'How does Aeneas’s exile from Troy establish the epic quest structure?',
        correct:
          'It presents Aeneas as forced from home and driven through long trials toward a destined future.',
        distractors: [
          'It shows Aeneas already settled in his final city with no journey remaining.',
          'It focuses only on family history and avoids conflict, travel, or fate.',
          'It ends the quest before readers learn why Aeneas leaves Troy.',
        ],
      };
    }
    if (/\bTrojans reign in Italy|happy course|Grecian navy burn|drown the men/i.test(excerpt)) {
      return {
        stem: 'How does Juno’s anger about the Trojans reaching Italy develop the quest structure?',
        correct:
          'Her resistance shows that the journey to Italy is a fated goal blocked by divine opposition.',
        distractors: [
          'Her speech shows that the Trojans have already reached Italy without further obstacles.',
          'Her anger shifts the passage away from travel and into an unrelated family dispute.',
          'Her words prove that fate no longer matters once the ships leave Troy.',
        ],
      };
    }
    if (/\bTack to the larboard|stand off to sea|Veer starboard sea and land|Italian shore|Sicilia/i.test(excerpt)) {
      return {
        stem: 'How do the sailing directions help develop the epic quest structure?',
        correct:
          'They make the journey feel planned and dangerous as the travelers navigate toward Italy.',
        distractors: [
          'They show the travelers have stopped moving because the quest is already complete.',
          'They describe the sea only as scenery and give no sense of direction or risk.',
          'They shift the excerpt away from travel and into a private family conflict.',
        ],
      };
    }
    if (/\bPalinurus|Latian shore|steering view[’']d the stars|course from Afric/i.test(excerpt)) {
      return {
        stem: 'How does Palinurus’s course toward the Latian shore develop the quest structure?',
        correct:
          'It connects navigation, danger, and destination, keeping the journey toward Italy central.',
        distractors: [
          'It shows the journey has ended because Palinurus no longer guides the ship.',
          'It focuses on a battle scene that has no connection to travel or destination.',
          'It presents the stars as decoration without affecting the voyage or its risk.',
        ],
      };
    }
    if (/\bgot from under the ram|drive them down to the ship|crew rejoiced/i.test(excerpt)) {
      return {
        stem: 'How does the escape from the Cyclops’s cave develop the quest structure?',
        correct:
          'It turns survival into forward movement, letting the crew escape one trial and continue the voyage.',
        distractors: [
          'It shows the quest ending because the crew refuses to return to the ship.',
          'It focuses on the sheep only, so the escape does not affect the journey.',
          'It removes danger by showing that the Cyclops never threatened the crew.',
        ],
      };
    }
    if (/\bItalian shore|Forsake the pleasing shore|plow the deep|we break our sleep/i.test(excerpt)) {
      return {
        stem: 'How does leaving the shore develop the epic quest structure?',
        correct:
          'It moves the travelers from temporary rest back into the voyage toward their destined land.',
        distractors: [
          'It shows the travelers refusing the voyage because the shore is too dangerous.',
          'It ends the quest by showing that the travelers have already reached Rome.',
          'It describes the shore as scenery without affecting the movement of the journey.',
        ],
      };
    }
    return {
      stem: /\bTell me, O Muse|travelled far and wide|bring his men safely home|escaped death.*except Ulysses/i.test(
        excerpt
      )
        ? 'How does the opening description of Ulysses help establish the epic’s quest structure?'
        : /\bItalian shore|Forsake the pleasing shore|plow the deep|ship|sea|shore/i.test(excerpt)
        ? 'How does the sailors’ decision to leave the shore develop the quest structure?'
        : `How does the journey detail in "${phrase}" develop the epic structure?`,
      correct:
        'It marks another stage of the journey, showing the characters moving from temporary safety back into the larger quest.',
      distractors: [
        'It ends the journey by showing that the characters have already reached their final home.',
        'It mainly describes scenery without changing the direction or pressure of the quest.',
        'It shows the characters abandoning the journey because the setting is too dangerous.',
      ],
    };
  }

  if (subSkillId === 'ritual-speech-oath') {
    if (/\bfeast|olive|Resolve me, strangers|bring you peace or war/i.test(excerpt)) {
      return {
        stem: 'How does the formal welcome scene develop epic values?',
        correct:
          'The feast, olive branch, and formal speech test whether strangers will be received with peace or war.',
        distractors: [
          'The scene shows that the strangers enter without ceremony, questions, or public expectations.',
          'The feast is only a food detail and does not connect to hospitality or honor.',
          'The formal speech ends the conflict before anyone has to decide how to respond.',
        ],
      };
    }
    if (/\bhospitality|entertained him|learn Jove[’']s mind|Dodona/i.test(excerpt)) {
      return {
        stem: 'How does hospitality and seeking Jove’s will develop epic values here?',
        correct:
          'The passage connects guest-host duty with divine guidance, showing that honor depends on ritual obligations.',
        distractors: [
          'The passage shows Ulysses rejecting hospitality because treasure is more important.',
          'The passage treats Jove’s will as unrelated to decisions about returning home.',
          'The passage focuses only on wealth and avoids any formal epic value.',
        ],
      };
    }
    if (/\bheld wine up to my lips|pieces of meat into my hands|Take heart, Queen Penelope/i.test(excerpt)) {
      return {
        stem: 'How does Eurymachus’s speech use hospitality to shape the reader’s judgment?',
        correct:
          'He recalls Ulysses’s past kindness while secretly plotting harm, twisting an epic value for deception.',
        distractors: [
          'He rejects the value of hospitality by refusing to mention Ulysses or Penelope.',
          'He speaks honestly, so his words prove Telemachus has nothing to fear.',
          'He focuses only on food and avoids any connection to loyalty or trust.',
        ],
      };
    }
    if (/\bsacrificed the sheep|mixed the wine|laid their hands upon the good things/i.test(excerpt)) {
      return {
        stem: 'How does the feast and sacrifice develop epic values in this excerpt?',
        correct:
          'The formal meal connects community, ritual, and respect for sacred practice before action continues.',
        distractors: [
          'The meal shows the characters rejecting ritual and acting without shared customs.',
          'The feast is only comic relief and has no connection to values or order.',
          'The sacrifice proves the characters care about food more than honor or duty.',
        ],
      };
    }
    if (/\bpray[’']d|spare my life|clasp[’]d the hero[’]s knees/i.test(excerpt)) {
      return {
        stem: 'How does Magus’s plea to Aeneas develop epic values?',
        correct:
          'His formal plea tests mercy, honor, and duty in the middle of violent heroic action.',
        distractors: [
          'His plea removes the conflict because Aeneas no longer has to make a choice.',
          'His speech is casual conversation without any connection to honor or duty.',
          'His wealth becomes the only value that matters in the epic scene.',
        ],
      };
    }
    return {
      stem: /\bdrink offerings|sweet wine|prayed/i.test(excerpt)
        ? 'How do the prayer and drink offerings help develop epic values in the excerpt?'
        : `How does the formal moment connected to "${phrase}" help develop epic values?`,
      correct:
        'It shows that formal acts such as prayer, offering, speech, or hospitality connect human action to honor, duty, and the gods.',
      distractors: [
        'It shows that the characters reject ritual because practical action matters more than values.',
        'It mainly tells what the characters eat or drink without revealing any larger value.',
        'It presents the formal speech or ritual as a distraction from the epic’s meaning.',
      ],
    };
  }

  if (subSkillId === 'theme-through-heroic-action') {
    if (/\bGreedy of war where greater glory calls|springs to fight/i.test(excerpt)) {
      return {
        stem: 'How does Aeneas’s rush toward battle develop an epic theme?',
        correct:
          'His eagerness for glory connects heroic action to honor, reputation, and the cost of war.',
        distractors: [
          'His action shows that he wants peace more than reputation or battle.',
          'His movement toward battle is only a setting detail with no larger idea.',
          'His choice proves that glory has no place in epic conflict.',
        ],
      };
    }
    if (/\bHrunting|terrible journeys|battle-field sought|deeds of daring/i.test(excerpt)) {
      return {
        stem: 'How does the description of Hrunting develop a theme of heroic action?',
        correct:
          'The sword’s history connects Beowulf’s coming fight to courage, risk, and inherited honor.',
        distractors: [
          'The sword is described as ordinary equipment with no connection to heroic risk.',
          'The description shows Beowulf avoiding the fight because the weapon is old.',
          'The passage suggests that honor depends on comfort rather than danger.',
        ],
      };
    }
    if (/\bJove view[’']d the combat|fates|Patroclus[’] fall|last of days/i.test(excerpt)) {
      return {
        stem: 'How does Patroclus’s doomed action develop an epic theme?',
        correct:
          'His glory is tied to fate and death, showing the cost that can come with heroic action.',
        distractors: [
          'His action prevents fate from affecting the battle or his future.',
          'The passage treats battle as harmless because no consequence follows.',
          'The focus on Jove removes Patroclus from the theme of heroic action.',
        ],
      };
    }
    if (/\bdeath deliver[’']d|hard captivity|lawless pride|sustain[’]d the scorn/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s suffering develop an epic theme?',
        correct:
          'Her experience connects war to captivity and loss, showing glory’s human cost.',
        distractors: [
          'Her speech celebrates war as painless for those who are defeated.',
          'Her suffering is unrelated to the consequences of heroic conflict.',
          'Her words focus only on romance and avoid war, captivity, or loss.',
        ],
      };
    }
    return {
      stem: /\bfriend|lamentations|combat|fate|death/i.test(excerpt)
        ? 'How does the heroic action in this excerpt help develop an epic theme?'
        : `How does the heroic action connected to "${phrase}" develop a theme?`,
      correct:
        'It connects the hero’s choice to a larger idea such as loyalty, honor, fate, sacrifice, or the cost of glory.',
      distractors: [
        'It shows action for excitement but does not connect the hero’s choice to a larger idea.',
        'It makes the theme depend on background information outside the excerpt rather than evidence in the scene.',
        'It suggests that heroic choices have no consequences for the character or the epic.',
      ],
    };
  }

  if (subSkillId === 'elevated-style-epic-simile') {
    if (/\bbright Orion|burnish[’']d gold|nocturnal sky|silent pace/i.test(excerpt)) {
      return {
        stem: 'How does the elevated description of the night sky affect the epic style?',
        correct:
          'The formal celestial imagery makes the voyage feel guided by a vast, ordered universe.',
        distractors: [
          'The sky description makes the voyage sound casual and disconnected from epic scale.',
          'The language mainly explains a simple weather report without creating style.',
          'The imagery makes the scene comic instead of grand or serious.',
        ],
      };
    }
    if (/\bVulcan|ambrosial showers|through heaven, through earth/i.test(excerpt)) {
      return {
        stem: 'How does the elevated description of Juno’s chamber affect the epic style?',
        correct:
          'The divine materials and heavenly scale make the scene feel grander than ordinary description.',
        distractors: [
          'The description makes the goddess seem ordinary and removes the divine setting.',
          'The language focuses only on plot facts and avoids sensory or elevated detail.',
          'The chamber is described as plain, practical, and unrelated to epic style.',
        ],
      };
    }
    if (/\blike one black ceiling spread|Thunderer|clouds|battlement/i.test(excerpt)) {
      return {
        stem: 'How does the comparison to a black ceiling affect the battle scene?',
        correct:
          'The image makes the battle feel massive and enclosed, giving the action an epic scale.',
        distractors: [
          'The comparison makes the scene feel small, private, and removed from battle.',
          'The image explains only the weather and has no effect on the fighting.',
          'The comparison turns the battle into a peaceful domestic scene.',
        ],
      };
    }
    if (/\bflaming from the zenith|vault of heaven|like Mars himself/i.test(excerpt)) {
      return {
        stem: 'How does the elevated language around Patroclus affect the battle scene?',
        correct:
          'The cosmic and godlike language makes Patroclus’s fighting seem larger than ordinary combat.',
        distractors: [
          'The language makes Patroclus seem weak and disconnected from the battle.',
          'The description removes epic scale by focusing only on routine movement.',
          'The passage uses plain speech instead of elevated images or comparisons.',
        ],
      };
    }
    if (/\bTwelve golden beams|God of Day|arms divine|Roman line/i.test(excerpt)) {
      return {
        stem: 'How does the elevated description of the leaders affect the epic style?',
        correct:
          'The divine ancestry and ceremonial imagery make the meeting feel historically and spiritually important.',
        distractors: [
          'The description makes the leaders seem ordinary and unconnected to history.',
          'The imagery focuses only on practical travel details, not epic importance.',
          'The passage avoids ceremony and presents the meeting as casual conversation.',
        ],
      };
    }
    return {
      stem: /\bSing, O goddess|Muse/i.test(excerpt)
        ? 'How does the invocation create an elevated epic style?'
        : /\bbright Orion|radiant|burnish|silent pace/i.test(excerpt)
          ? 'How does the elevated description of the sky affect the epic style of the excerpt?'
          : `How does the elevated language in "${phrase}" affect the excerpt?`,
      correct:
        'It makes the moment feel larger and more formal than ordinary narration, giving the action an epic scale.',
      distractors: [
        'It makes the scene sound casual and realistic, reducing the importance of the action.',
        'It mainly clarifies the plot by removing the need to interpret the language.',
        'It shifts the excerpt into simple conversation instead of creating an elevated style.',
      ],
    };
  }

  return null;
}

function r12QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  if (subSkillId === 'universal-theme' || !subSkillId) {
    if (/\bNo, she must keep silence|heron[’']s secret|give its life away/i.test(excerpt)) {
      return {
        stem: 'Which universal theme is best supported by Sylvia’s choice in the excerpt?',
        correct:
          'Loyalty to what one values can require giving up a personal reward.',
        distractors: [
          'People should always tell the truth when another person asks for information.',
          'Curiosity is dangerous because it leads people away from their responsibilities.',
          'Nature is valuable only when people can use it to improve their lives.',
        ],
      };
    }

    if (/\bthey loved themselves better than their brother|this thing they would not do|Admetus|Alcestis/i.test(
      excerpt
    )) {
      return {
        stem: 'Which universal theme is best developed by the response to Admetus’s illness?',
        correct:
          'Love and loyalty are proven by sacrifice, not by words or past favors alone.',
        distractors: [
          'People should avoid helping others when the cost becomes personal.',
          'Sickness reveals that family members always make the same sacrifices.',
          'A person’s reputation matters more than the choices people make for them.',
        ],
      };
    }

    if (/\bNo time shall find me wanting to my truth|Euryalus/i.test(excerpt)) {
      return {
        stem: 'Which universal theme is supported by Euryalus’s promise?',
        correct:
          'A person’s character is tested by whether loyalty remains steady through good or bad fortune.',
        distractors: [
          'Success depends on avoiding risk whenever fortune becomes uncertain.',
          'Youth prevents people from making serious promises about the future.',
          'Truth matters only when other people are watching the choice being made.',
        ],
      };
    }

    if (/\bLove is a smoke|O brawling love|O loving hate/i.test(excerpt)) {
      return {
        stem: 'Which universal theme is developed through Romeo’s description of love?',
        correct:
          'Love can feel powerful and confusing because it creates opposite emotions at the same time.',
        distractors: [
          'Love becomes simple once people explain their feelings clearly.',
          'Love is mainly a public duty that people accept without emotion.',
          'Love disappears quickly when people experience sadness or conflict.',
        ],
      };
    }

    if (/\bfilled with grief and rage|wicked uncle, who loved only himself|Perdix|Daedalus/i.test(excerpt)) {
      return {
        stem: 'Which universal theme is best supported by the people’s response to Daedalus?',
        correct:
          'Selfish choices can harm others and cause a community to demand justice.',
        distractors: [
          'Talent excuses a person from responsibility when others are hurt.',
          'A community should ignore wrongdoing if the person has useful skills.',
          'Jealousy is harmless when it stays hidden from other people.',
        ],
      };
    }

    if (/\bprecious book of love|unbound lover|fair without the fair within|can you love the gentleman/i.test(
      excerpt
    )) {
      return {
        stem: 'Which universal theme is developed through Lady Capulet’s description of Paris?',
        correct:
          'People may judge love or marriage by outward appearance instead of inner character.',
        distractors: [
          'True love is always based on shared memories and personal choice.',
          'People should avoid reading because books hide a person’s real nature.',
          'Marriage removes all conflict between parents and children.',
        ],
      };
    }

    if (/\bAlas for him|he remembered|melted the wax|falling/i.test(excerpt)) {
      return {
        stem: 'Which universal theme is best supported by Icarus remembering the warning only after the wax has melted?',
        correct:
          'Ignoring wise limits can lead to consequences that a person understands too late.',
        distractors: [
          'People should avoid inventing new things because invention always leads to harm.',
          'Fear is more dangerous than pride because it prevents people from taking action.',
          'Help always arrives when people finally understand the danger they are facing.',
        ],
      };
    }

    if (/\bhe forgot everything in the world but joy|highest heavens|his father Daedalus/i.test(excerpt)) {
      return {
        stem: 'Which universal theme is best supported by Icarus forgetting Daedalus’s guidance as he flies higher?',
        correct:
          'Strong desire can make people ignore the guidance that would protect them.',
        distractors: [
          'Freedom is only meaningful when people follow every command without question.',
          'Parents should let children make every choice without offering warnings.',
          'Joy is harmful because it prevents people from ever learning from experience.',
        ],
      };
    }

    return {
      stem: `Which universal theme is best supported by "${phrase}"?`,
      correct:
        'A person’s choice or attitude can reveal a larger idea that applies beyond this one story.',
      distractors: [
        'A theme is strongest when it only summarizes what one character does.',
        'A theme should name the topic but avoid making a claim about life or people.',
        'A theme is developed only when the passage states the lesson directly.',
      ],
    };
  }

  if (subSkillId === 'theme-development-moments') {
    if (/\bNo, she must keep silence|What is it that suddenly forbids her|heron[’']s secret/i.test(excerpt)) {
      return {
        stem: 'How do Sylvia’s thoughts and silence develop the theme of the excerpt?',
        correct:
          'They show her moving from temptation toward protection, developing a theme about choosing loyalty over reward.',
        distractors: [
          'They show that Sylvia is confused because she does not understand what the hunter wants.',
          'They show that the theme changes from protecting nature to impressing another person.',
          'They show that Sylvia’s silence is accidental rather than a meaningful choice.',
        ],
      };
    }

    if (/\bIt was not long until they learned to cook|leave off their wild and savage habits|bright sunlight/i.test(
      excerpt
    )) {
      return {
        stem: 'How do the changes in human behavior help develop the theme of the excerpt?',
        correct:
          'They show progress developing step by step, suggesting that knowledge can transform how people live.',
        distractors: [
          'They show that people become better mainly because the setting changes around them.',
          'They suggest that survival matters more than learning or improvement.',
          'They prove that people were already civilized before receiving help.',
        ],
      };
    }

    if (/\bprecious spark hidden in the hollow center|flames|plant/i.test(excerpt)) {
      return {
        stem: 'How does Prometheus carrying the hidden spark help develop the theme?',
        correct:
          'It shows the first step in giving people knowledge, developing a theme about progress beginning with a risky choice.',
        distractors: [
          'It shows that fire is valuable only because it is hidden from ordinary people.',
          'It suggests that Prometheus takes fire for himself rather than to change human life.',
          'It proves that people already know how to use fire before Prometheus returns.',
        ],
      };
    }

    if (/\bgiven them fire and lifted them out of their wretchedness|never would he beg for mercy|sufferings/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Prometheus’s suffering help develop the theme of the excerpt?',
        correct:
          'It shows that helping others can require sacrifice, strengthening the theme that meaningful progress may have a cost.',
        distractors: [
          'It shows that Prometheus regrets helping people and wants to undo his choice.',
          'It suggests that punishment makes Prometheus deny the value of fire.',
          'It proves that the gods reward Prometheus for obeying them.',
        ],
      };
    }

    if (/\bAlas for him|he remembered|melted the wax|falling/i.test(excerpt)) {
      return {
        stem: 'How does Icarus’s realization develop the theme of the excerpt?',
        correct:
          'It shows that ignoring limits can lead to consequences that are understood too late.',
        distractors: [
          'It shows that courage always protects people from physical danger.',
          'It suggests that Icarus falls because others refuse to help him.',
          'It proves that invention is more dangerous than disobedience.',
        ],
      };
    }

    if (/\bhe forgot everything in the world but joy|There was a terror in the joy|highest heavens/i.test(excerpt)) {
      return {
        stem: 'How does Icarus’s joy during flight help develop the theme before his fall?',
        correct:
          'It shows his excitement growing into dangerous overconfidence, preparing the theme about desire outrunning caution.',
        distractors: [
          'It shows that Icarus stays careful because he remembers every warning from Daedalus.',
          'It suggests that flight becomes safe once Icarus forgets the world below him.',
          'It proves that Daedalus wants Icarus to fly as high as possible.',
        ],
      };
    }

    if (/\bAtalanta now ran forward|Meleager rushed up|boar could no longer stand/i.test(excerpt)) {
      return {
        stem: 'How do the actions against the boar help develop the theme of the excerpt?',
        correct:
          'They show courage building through repeated action, suggesting that danger is overcome through persistence and cooperation.',
        distractors: [
          'They show that the danger is minor because the boar stops fighting immediately.',
          'They suggest that Atalanta’s action has no effect on the outcome.',
          'They shift the theme away from courage and toward ordinary competition.',
        ],
      };
    }

    if (/\bDaphne|wild and shy as a fawn|as fleet of foot as the deer|child of the river/i.test(excerpt)) {
      return {
        stem: 'How does the early description of Daphne help begin the theme of her story?',
        correct:
          'It presents Daphne as closely connected to nature, preparing the theme about freedom and protection from unwanted control.',
        distractors: [
          'It shows that Daphne wants to leave nature behind and live among strangers.',
          'It suggests that Daphne is dangerous because other people fear her.',
          'It proves that Daphne already understands Apollo’s intentions before meeting him.',
        ],
      };
    }

    if (/\bso fair and gentle|treated him kindly|made them happier|Cecrops/i.test(excerpt)) {
      return {
        stem: 'How does the people’s changing response to Cecrops help develop the theme?',
        correct:
          'It shows that kindness and openness can turn fear of a stranger into learning and community.',
        distractors: [
          'It shows that the people remain suspicious because Cecrops refuses to speak with them.',
          'It suggests that Cecrops makes the people unhappy by reminding them of his homeland.',
          'It proves that the people help Cecrops only because he threatens them.',
        ],
      };
    }

    if (/\bApollo, who had always been so wise|grief and rage|learn the truth for himself|Coronis/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Apollo’s reaction to the report about Coronis help develop the theme?',
        correct:
          'It shows that even a wise person can make poor choices when grief and anger replace careful judgment.',
        distractors: [
          'It shows that Apollo calmly waits for proof before responding.',
          'It suggests that anger helps Apollo understand the truth more clearly.',
          'It proves that Coronis has already explained the situation to Apollo.',
        ],
      };
    }

    if (/\bIo, with a brave heart|gadfly was worse|heart was full of hope|land of Egypt/i.test(excerpt)) {
      return {
        stem: 'How does Io’s continued journey help develop the theme?',
        correct:
          'It shows that hope can help a person endure suffering long enough to reach a turning point.',
        distractors: [
          'It shows that Io’s suffering ends immediately once she starts traveling.',
          'It suggests that fear is the only reason Io continues her journey.',
          'It proves that Io gives up before reaching the place she was sent.',
        ],
      };
    }

    if (/\bTheseus strode boldly|At last he found AEgeus|lines of care/i.test(excerpt)) {
      return {
        stem: 'How do Theseus’s actions and his father’s condition help develop the theme?',
        correct:
          'They show a young hero choosing responsibility when he sees another person’s suffering.',
        distractors: [
          'They show that Theseus is interested mainly in gaining attention at the palace.',
          'They suggest that AEgeus’s sadness is unrelated to Theseus’s choice.',
          'They prove that family problems disappear as soon as a hero arrives.',
        ],
      };
    }

    if (/\bno longer savage and wild|no longer dark and lonely|music and song/i.test(excerpt)) {
      return {
        stem: 'How does the change in the mountain and valley help develop the theme?',
        correct:
          'The change shows that courage or order can transform a fearful place into one connected with peace and renewal.',
        distractors: [
          'The change shows that the setting matters less once the conflict is over.',
          'The change suggests that danger was imagined and never affected the people.',
          'The change shifts the theme away from courage and toward ordinary travel.',
        ],
      };
    }

    return {
      stem: `How does the moment connected to "${phrase}" help develop the theme?`,
      correct:
        'It adds another detail that deepens the same life idea instead of leaving the theme as a single event.',
      distractors: [
        'It repeats the plot without adding anything to the larger idea.',
        'It changes the topic so the earlier theme no longer matters.',
        'It gives background information that is unrelated to the character’s choice.',
      ],
    };
  }

  if (subSkillId === 'theme-through-conflict') {
    if (/\bTwo households, both alike in dignity|ancient grudge break to new mutiny|star-cross[’']d lovers/i.test(
      excerpt
    )) {
      return {
        stem: 'How does the opening conflict between the two households develop a theme?',
        correct:
          'It shows that a long-lasting feud can shape the lives and choices of the next generation.',
        distractors: [
          'It shows that the families have already solved their conflict before the story begins.',
          'It suggests that Romeo and Juliet are separated from the feud and unaffected by it.',
          'It proves that the conflict is only a private problem between two individual characters.',
        ],
      };
    }

    if (/\bPython|serpent|dreadful den|Apollo/i.test(excerpt)) {
      return {
        stem: 'How does the conflict with the Python help develop a theme in the excerpt?',
        correct:
          'It shows that confronting danger can turn fear into order or safety for others.',
        distractors: [
          'It shows that avoiding danger is the best way to protect a community.',
          'It suggests that the Python is mainly a symbol of ordinary nature.',
          'It proves that Apollo wants power more than he wants to help anyone.',
        ],
      };
    }

    if (/\bNo young man had ever spoken to her before|filled her heart with fear|Daphne/i.test(excerpt)) {
      return {
        stem: 'How does Daphne’s fear in the conflict help develop a theme?',
        correct:
          'It shows that unwanted pursuit can turn another person’s attention into danger rather than affection.',
        distractors: [
          'It shows that Daphne misunderstands Apollo because she does not know his name.',
          'It suggests that fear disappears once a character speaks politely.',
          'It proves that Daphne creates the conflict by refusing to listen.',
        ],
      };
    }

    if (/\bDeath is my son-in-law|death is my heir|life, living, all is death/i.test(excerpt)) {
      return {
        stem: 'How does Capulet’s reaction to Juliet’s apparent death develop a theme?',
        correct:
          'It shows how conflict and loss can make earlier concerns about control seem powerless.',
        distractors: [
          'It shows that Capulet is mainly focused on protecting the wedding celebration.',
          'It suggests that death solves the family conflict in a peaceful way.',
          'It proves that Capulet no longer cares about Juliet’s future.',
        ],
      };
    }

    if (/\bMedea|feared that when he should make himself known|her own power would be at an end|old king was filled with fear/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Medea’s fear of losing power help develop a theme?',
        correct:
          'It shows that fear of losing control can push a character toward harmful choices.',
        distractors: [
          'It shows that Medea wants Theseus recognized because it will make the king safer.',
          'It suggests that power has no effect on how characters treat one another.',
          'It proves that the old king understands the danger better than Medea does.',
        ],
      };
    }

    if (/\bsea monster|cut the chain|wide jaws|Perseus/i.test(excerpt)) {
      return {
        stem: 'How does Perseus’s conflict with the sea monster develop a theme?',
        correct:
          'It shows that courage means acting when another person is in immediate danger.',
        distractors: [
          'It shows that courage depends mostly on avoiding direct conflict.',
          'It suggests that the rescue matters less than Perseus’s reputation.',
          'It proves that danger disappears before the hero has to make a choice.',
        ],
      };
    }

    if (/\bhang, beg, starve, die|God[’']s bread|I[’']ll not wed|Juliet/i.test(excerpt)) {
      return {
        stem: 'How does Juliet’s conflict with Capulet help develop a theme?',
        correct:
          'It shows how family control can become destructive when a young person’s choice is denied.',
        distractors: [
          'It shows that Juliet and Capulet quickly agree because they want the same future.',
          'It suggests that Capulet gives Juliet freedom as soon as she explains herself.',
          'It proves that the conflict is mostly about money rather than family authority.',
        ],
      };
    }

    return {
      stem: `How does the conflict or consequence in "${phrase}" develop a theme?`,
      correct:
        'It uses pressure, danger, or consequence to reveal a larger idea about choices or human behavior.',
      distractors: [
        'It creates action but does not help the reader understand any larger idea.',
        'It makes the theme depend on the title rather than evidence in the excerpt.',
        'It resolves the problem before the character’s choice can matter.',
      ],
    };
  }

  return null;
}

function r13QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  if (subSkillId === 'narrator-perspective') {
    if (/\bNo, she must keep silence|heron[’']s secret|What is it that suddenly forbids her/i.test(excerpt)) {
      return {
        stem: 'How does the narrator’s focus on Sylvia’s thoughts shape the reader’s understanding of her choice?',
        correct:
          'It lets the reader see Sylvia’s inner conflict, so her silence feels like a deliberate moral choice.',
        distractors: [
          'It shows that Sylvia is confused because she does not understand what the hunter wants.',
          'It makes the reader trust the hunter’s perspective more than Sylvia’s perspective.',
          'It suggests that Sylvia stays silent only because her grandmother tells her not to speak.',
        ],
      };
    }

    if (/\bWondering over and over again|what the stranger would say|what he would think/i.test(excerpt)) {
      return {
        stem: 'How does the narrator’s access to Sylvia’s thoughts affect the reader’s understanding?',
        correct:
          'It shows Sylvia imagining the stranger’s reaction, which helps the reader understand the pressure behind her coming choice.',
        distractors: [
          'It shows that Sylvia has already decided to ignore the stranger completely.',
          'It makes the reader focus only on the physical danger of climbing down the tree.',
          'It proves that the stranger already knows where the heron’s nest is.',
        ],
      };
    }

    if (/\bThe guest waked from a dream|He was sure|must really be persuaded/i.test(excerpt)) {
      return {
        stem: 'How does the narrator’s shift to the guest’s expectation shape the reader’s understanding?',
        correct:
          'It shows that the guest assumes Sylvia can be persuaded, increasing the contrast with Sylvia’s private struggle.',
        distractors: [
          'It proves that the guest understands Sylvia’s loyalty to the heron.',
          'It removes tension because the guest no longer wants information from Sylvia.',
          'It suggests that Sylvia’s decision is unimportant to the guest’s plans.',
        ],
      };
    }

    if (/\bSylvia’s heart gave a wild beat|she knew that strange white bird|wondered and dreamed about/i.test(excerpt)) {
      return {
        stem: 'How does the narrator’s access to Sylvia’s memory help shape the reader’s understanding?',
        correct:
          'It shows Sylvia already knows the heron and its hidden world, so the reader understands why the choice matters to her.',
        distractors: [
          'It shows that Sylvia has no connection to the bird until the hunter explains it to her.',
          'It makes the reader focus only on the grandmother’s warning about the marsh.',
          'It proves that Sylvia is eager to give the stranger the exact location of the nest.',
        ],
      };
    }

    if (/\bsmall and hopeful Sylvia|utmost bravery|knew that higher still/i.test(excerpt)) {
      return {
        stem: 'How does the narrator’s focus on Sylvia’s climb shape the reader’s understanding?',
        correct:
          'It makes the reader see the climb through Sylvia’s effort and knowledge, so the search feels personal rather than accidental.',
        distractors: [
          'It suggests that Sylvia is careless because she has never climbed near the tree before.',
          'It shifts the passage away from Sylvia by making the tree the only important subject.',
          'It proves that the stranger has already taught Sylvia exactly where to climb.',
        ],
      };
    }

    if (/\bAlas for him|in that terror he remembered|forgot everything in the world but joy/i.test(excerpt)) {
      return {
        stem: 'How does the narrator’s perspective shape the reader’s understanding of Icarus?',
        correct:
          'It lets the reader see Icarus’s joy and danger together, making his fall feel both understandable and tragic.',
        distractors: [
          'It makes Icarus seem careful because the narrator says he remembers the danger early.',
          'It hides Icarus’s feelings so the reader only sees Daedalus’s reaction.',
          'It suggests that Icarus falls because Daedalus refuses to warn him.',
        ],
      };
    }
  }

  if (subSkillId === 'irony-reversal-contrast') {
    if (/\bAlas for him|forgot everything in the world but joy|The heat of the sun had melted the wax/i.test(excerpt)) {
      return {
        stem: 'How does the contrast between Icarus’s joy and the danger create irony?',
        correct:
          'The reader sees that the freedom making Icarus joyful is also leading him toward disaster.',
        distractors: [
          'The contrast shows that Icarus is safer when he flies higher.',
          'The contrast proves that Daedalus is unaware of any danger.',
          'The contrast makes the fall surprising because no warning has appeared in the excerpt.',
        ],
      };
    }

    if (/\bI shall now therefore humbly propose|least objection/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s phrase “least objection” create irony?',
        correct:
          'It makes the proposal sound harmless before the reader sees that the speaker’s logic is morally disturbing.',
        distractors: [
          'It shows that the speaker expects readers to reject the proposal because it is too emotional.',
          'It proves that the speaker is summarizing a plan that has already solved poverty.',
          'It shifts the passage away from the proposal and toward a personal memory.',
        ],
      };
    }

    if (/\bnot be liable to the least objection|humbly propose|delicious nourishing and wholesome food/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s calm wording create irony in the excerpt?',
        correct:
          'The speaker presents a horrifying idea as reasonable, so the reader recognizes the gap between tone and meaning.',
        distractors: [
          'The speaker uses emotional language to show that he is horrified by his own idea.',
          'The speaker admits that his proposal is weak and expects readers to reject it.',
          'The speaker changes the topic so the reader no longer thinks about poverty.',
        ],
      };
    }

    if (/\byoung healthy child well nursed|stewed, roasted, baked, or boiled/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s description of the child as “wholesome food” create irony?',
        correct:
          'The wording sounds practical and ordinary, but the reader understands that the subject is horrifying.',
        distractors: [
          'The wording shows that the speaker is openly grieving for poor children.',
          'The wording proves that the passage is mainly a cooking lesson with no social criticism.',
          'The wording makes the proposal seem impossible because the speaker refuses to give details.',
        ],
      };
    }

    if (/\bInfant[’']?s flesh|collateral advantage|lessening the number of Papists/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s phrase “collateral advantage” create irony?',
        correct:
          'It treats human suffering as a side benefit, exposing the gap between the speaker’s calm logic and the cruelty of the idea.',
        distractors: [
          'It shows that the speaker has stopped using economic logic and now speaks with compassion.',
          'It proves that the speaker is mainly concerned with the health of infants.',
          'It makes the passage less critical because it avoids mentioning any social problem.',
        ],
      };
    }

    if (/\bI profess in the sincerity of my heart|no other motive than the publick good/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s claim of public concern create irony?',
        correct:
          'The claim sounds noble, but the reader understands that the proposal has treated people as commodities.',
        distractors: [
          'The claim proves that the speaker has offered a compassionate plan for the poor.',
          'The claim removes irony because the speaker clearly explains his personal profit.',
          'The claim shifts the passage away from criticism and toward personal confession only.',
        ],
      };
    }

    if (/\bHe was sure|must really be persuaded|No, she must keep silence/i.test(excerpt)) {
      return {
        stem: 'How does the contrast between the guest’s expectation and Sylvia’s silence create irony?',
        correct:
          'The guest assumes Sylvia can be persuaded, while the reader sees her silence is becoming a firm choice.',
        distractors: [
          'The contrast shows that Sylvia and the guest both want the same outcome.',
          'The contrast proves that Sylvia never saw the heron and cannot help him.',
          'The contrast makes the grandmother the only character with private knowledge.',
        ],
      };
    }
  }

  if (subSkillId === 'satire-exaggeration-ridicule') {
    if (/\bI shall now therefore humbly propose|least objection/i.test(excerpt)) {
      return {
        stem: 'How does the phrase “humbly propose” help create satire?',
        correct:
          'It makes the speaker sound reasonable while preparing an absurd proposal, criticizing cold problem-solving that ignores humanity.',
        distractors: [
          'It shows that the speaker is too uncertain to make any real argument.',
          'It proves that the proposal is meant to be accepted literally by the reader.',
          'It creates sympathy for the speaker by showing that he is powerless.',
        ],
      };
    }

    if (/\bdelicious nourishing and wholesome food|stewed, roasted, baked, or boiled/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s description of children as food create satire?',
        correct:
          'It uses shocking false logic to criticize a society that treats poor people as economic objects.',
        distractors: [
          'It mainly gives practical cooking advice without criticizing society.',
          'It shows that the speaker is trying to comfort poor families through humor.',
          'It makes the proposal seem gentle because the language avoids economic terms.',
        ],
      };
    }

    if (/\boffered in sale|reserved for breed|sheep, black cattle, or swine/i.test(excerpt)) {
      return {
        stem: 'How does comparing children to livestock create satire?',
        correct:
          'It exaggerates economic language to expose the cruelty of treating human beings like property.',
        distractors: [
          'It shows that the speaker values children because he compares them to useful animals.',
          'It proves that livestock are the real subject of the passage.',
          'It softens the proposal by making it sound natural and harmless.',
        ],
      };
    }

    if (/\bInfant[’']?s flesh|collateral advantage|lessening the number of Papists/i.test(excerpt)) {
      return {
        stem: 'How does the phrase “collateral advantage” help create satire?',
        correct:
          'It makes cruelty sound like practical benefit, criticizing a society that treats suffering as a calculation.',
        distractors: [
          'It shows that the speaker is offering a gentle compromise for poor families.',
          'It proves that the speaker has abandoned his proposal and shifted to a religious lesson.',
          'It makes the passage mainly about farming rather than people.',
        ],
      };
    }

    if (/\bfattest child to the market|annual profit instead of expence|wives.*mares in foal/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s description of families and profit create satire?',
        correct:
          'It mocks the idea that family suffering can be solved by turning children into market goods.',
        distractors: [
          'It praises parents for becoming more loving without any economic pressure.',
          'It argues that poverty is solved when families spend less time together.',
          'It changes the focus from poverty to farming techniques only.',
        ],
      };
    }

    if (/\bno other motive than the publick good|giving some pleasure to the rich/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s final claim about his motive sharpen the satire?',
        correct:
          'It pretends to be selfless while revealing a plan that benefits the rich by exploiting the poor.',
        distractors: [
          'It proves that the speaker has no connection to the proposal’s effects.',
          'It shows that the speaker is criticizing himself more than society.',
          'It removes the satire because the speaker finally becomes fully sincere.',
        ],
      };
    }
  }

  return null;
}

function r21QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  if (subSkillId === 'chronological-sequence') {
    if (/\bthree tasks lay before me; first|secondly, to show|thirdly, to show/i.test(excerpt)) {
      return {
        stem: 'How does the numbered sequence help Du Bois develop his purpose?',
        correct:
          'It previews the order of his argument so the reader can follow what he will prove and why it matters.',
        distractors: [
          'It mainly entertains the reader by telling a personal story instead of organizing the claims he will prove.',
          'It shows that Du Bois has no clear plan for developing his argument or connecting each part.',
          'It shifts from argument to description before the reader understands how the major points connect.',
        ],
      };
    }
    if (/\bAs early as 1826|from that time till to-day|Fifty years ago|Even to-day/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use time order to develop his point about college access?',
        correct:
          'He traces change over time, showing that Black students gained some access while prejudice and limits still remained.',
        distractors: [
          'He lists colleges only to suggest that college access has always been equal and uncontested.',
          'He tells events out of order so the reader cannot follow the historical change in access.',
          'He shifts away from education and focuses only on personal memories that do not support his claim.',
        ],
      };
    }
    if (/\bFor first|Thirdly|Fifthly|Sixthly/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s numbered organization develop the speaker’s proposal?',
        correct:
          'It makes the speaker’s cruel idea sound orderly and practical by listing supposed benefits one after another.',
        distractors: [
          'It shows that the speaker is uncertain and cannot organize the reasons that support his proposal.',
          'It presents a personal story in chronological order so readers focus on the speaker’s childhood.',
          'It interrupts the proposal with unrelated details that weaken the satire and blur the argument.',
        ],
      };
    }
    return {
      stem: 'How does the sequence across these paragraphs help organize the author’s point?',
      correct:
        'It shows the order of ideas or evidence, helping the reader follow how the point develops.',
      distractors: [
        'It compares two unrelated ideas without showing the reader how either idea develops over time.',
        'It proves the author is ending the argument before giving the evidence needed to support it.',
        'It mainly adds figurative language instead of organizing the information into a clear sequence.',
      ],
    };
  }

  if (subSkillId === 'cause-effect-structure') {
    if (/\bInfant[’']?s flesh|therefore, reckoning a year after Lent|collateral advantage|lessening the number of Papists/i.test(excerpt)) {
      return {
        stem: 'How does the cause-and-effect reasoning in this section sharpen Swift’s satire?',
        correct:
          'The speaker connects birth rates, markets, and religion in a cold chain of logic, exposing how cruel his reasoning is.',
        distractors: [
          'The speaker shows compassion by explaining how families will be protected from harm by the proposal.',
          'The speaker mainly describes a religious celebration without connecting it to the economics of his plan.',
          'The speaker admits that his plan has no effects beyond feeding poor children during one season.',
        ],
      };
    }
    if (/\bwill be thereby encreased|consequently have their houses frequented|annual profit instead of expence/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s cause-and-effect structure develop the speaker’s economic argument?',
        correct:
          'It links the proposal to money, trade, and profit, making the speaker’s inhuman plan sound like a business solution.',
        distractors: [
          'It proves that the speaker rejects money as a reason and wants readers to focus only on mercy.',
          'It mainly compares two characters who disagree about the plan without showing any result.',
          'It shows that the problem has already been solved before the proposal begins to explain costs.',
        ],
      };
    }
    if (/\bhas resulted in sending|Do they earn a living|These figures illustrate/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use cause and effect to answer criticism of higher education?',
        correct:
          'He presents a criticism about job outcomes, then uses evidence to show education’s larger social value.',
        distractors: [
          'He avoids the criticism by changing the topic to unrelated schools instead of answering the concern.',
          'He argues that education causes students to reject leadership and abandon their communities completely.',
          'He presents only emotional language without showing any result connected to graduates or work.',
        ],
      };
    }
    if (/\bIf carpenters are needed|train men as carpenters|set them to teaching|refuse them living wages/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use cause and effect in the carpenters-and-teachers section?',
        correct:
          'He shows that mismatched training and unfair pay create waste, strengthening his argument for proper education.',
        distractors: [
          'He argues that trade training should replace all teacher training because schools no longer matter.',
          'He gives a random example that does not connect to education, wages, or public need.',
          'He claims that wages have no effect on the quality of teaching or professional preparation.',
        ],
      };
    }
    return {
      stem: 'How does the cause-and-effect structure across these paragraphs develop the author’s point?',
      correct:
        'It connects a condition or action to a result, making the author’s reasoning easier to follow.',
      distractors: [
        'It lists details randomly so the reader cannot tell which idea causes another or why it matters.',
        'It contrasts two speakers without explaining what result follows from either person’s claim.',
        'It gives a definition but does not show why anything happens or what consequence follows.',
      ],
    };
  }

  if (subSkillId === 'compare-contrast-structure') {
    if (/\binstead of being able to work|forced to employ all their time|turn thieves|leave their dear native country/i.test(excerpt)) {
      return {
        stem: 'How does Swift use contrast to frame the social problem at the beginning of the proposal?',
        correct:
          'He contrasts what poor mothers should do with what poverty forces them to do, making the problem urgent.',
        distractors: [
          'He contrasts two wealthy groups to show that poverty is not part of the issue at all.',
          'He shows that mothers and children have identical choices and equal opportunities in society.',
          'He shifts away from the problem by describing a peaceful family scene without public concern.',
        ],
      };
    }
    if (/\bfar from being confined|greater extent|professed beggars|whole number of infants/i.test(excerpt)) {
      return {
        stem: 'How does the contrast between a limited plan and a wider plan develop Swift’s argument?',
        correct:
          'It expands the problem from visible beggars to many poor families, preparing readers for a broader proposal.',
        distractors: [
          'It narrows the problem so only a few visible families are included in the proposal.',
          'It proves that the speaker has decided not to offer a proposal or discuss poverty.',
          'It changes the topic from poverty to college education without connecting the ideas.',
        ],
      };
    }
    if (/\binstead of seeking that personal freedom|stay and labor and wait/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use contrast to develop his point about college graduates?',
        correct:
          'He contrasts personal freedom with service to the community, showing that many graduates choose leadership and sacrifice.',
        distractors: [
          'He contrasts two unrelated careers without explaining their importance to the community or argument.',
          'He shows that educated graduates always leave their communities permanently and reject service.',
          'He argues that sacrifice has no connection to social leadership or community responsibility.',
        ],
      };
    }
    if (/\bfrom the bottom upward|from the top downward|pulls all that are worth the saving up/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use the contrast between “bottom upward” and “top downward” to develop his argument?',
        correct:
          'He contrasts two models of progress to argue that trained leaders can help lift the larger community.',
        distractors: [
          'He argues that social progress happens without leadership, education, or organized community support.',
          'He contrasts two locations but does not connect either image to his argument about progress.',
          'He shows that colleges weaken communities by separating students from others permanently.',
        ],
      };
    }
    if (/\bwhite public school teachers|Negro teachers|scholarships and good salaries|starvation wages/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use contrast to develop his argument about teacher preparation?',
        correct:
          'He contrasts supported white teachers with underpaid Black teachers to show how unequal investment affects schools.',
        distractors: [
          'He shows that both groups receive the same support, salaries, and professional encouragement.',
          'He shifts from education to farming without connecting the comparison to schools.',
          'He argues that teacher preparation is unnecessary for either group of educators.',
        ],
      };
    }
    if (/\breserved for breed|more than we allow to sheep|black cattle, or swine|offered in sale/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s comparison of children to livestock develop the satire?',
        correct:
          'It contrasts human children with animals sold for use, exposing the cruelty of treating poverty as a market problem.',
        distractors: [
          'It shows that the speaker values children more than any economic benefit from the proposal.',
          'It proves that livestock, not children, are the real focus of the speaker’s proposal.',
          'It makes the speaker’s plan seem compassionate because it avoids trade language completely.',
        ],
      };
    }
    if (/\bInfant[’']?s flesh will be in season|charge of nursing a beggar’s child|eight shillings neat profit/i.test(excerpt)) {
      return {
        stem: 'How does Swift contrast the cost of raising a child with the profit from selling one?',
        correct:
          'He turns a human life into a financial comparison, making the speaker’s economic logic sound horrifyingly cold.',
        distractors: [
          'He shows that the proposal protects children from being treated as products for profit.',
          'He contrasts two seasons of the year without connecting them to money or markets.',
          'He argues that landlords should stop profiting from poor families and tenants.',
        ],
      };
    }
    return {
      stem: 'How does the contrast across these paragraphs help develop the meaning of the excerpt?',
      correct:
        'It places two ideas or conditions side by side so the author’s point becomes clearer.',
      distractors: [
        'It presents both sides as exactly the same, so no new meaning is created.',
        'It changes the topic to an example that does not support the author’s point or comparison.',
        'It gives only a time sequence without comparing ideas, groups, or conditions.',
      ],
    };
  }

  if (subSkillId === 'problem-solution-structure') {
    if (/\bmelancholy object|great additional grievance|fair, cheap and easy method/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s problem-solution structure set up the satire?',
        correct:
          'He describes poverty as a public problem, then introduces a “solution” whose cruelty exposes false logic.',
        distractors: [
          'He presents a compassionate solution that removes the satire and protects poor families from harm.',
          'He avoids naming a problem and only describes the city’s beauty and peaceful streets.',
          'He solves the issue before explaining why anyone should care about poverty.',
        ],
      };
    }
    if (/\bwhat course may be taken|young labourers|cannot get work|For first/i.test(excerpt)) {
      return {
        stem: 'How does the problem-solution structure guide the reader through Swift’s proposal?',
        correct:
          'It moves from economic suffering to the speaker’s proposed benefits, making the satire imitate a practical policy argument.',
        distractors: [
          'It presents unrelated examples without any proposed response to the poverty described earlier.',
          'It shows that the speaker has no opinion about poverty, labor, or public policy.',
          'It focuses only on time order rather than on a problem and proposed response.',
        ],
      };
    }
    if (/\bHow then shall the leaders|There can be but one answer|schooled in the colleges and universities/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois’s problem-solution structure develop his argument about leadership?',
        correct:
          'He asks how leaders can be trained, then answers that colleges must prepare capable students.',
        distractors: [
          'He asks a question but refuses to offer any answer about leadership or education.',
          'He argues that leadership develops without education, training, or colleges.',
          'He presents a solution before explaining what problem it addresses or why it matters.',
        ],
      };
    }
    if (/\bmillions of our citizens in ignorance|not yet decently provided with public schools|reduce the already meagre school facilities/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use problem-solution structure to address schooling?',
        correct:
          'He identifies inadequate public education as the problem, then points toward fairer support and training.',
        distractors: [
          'He argues that the current school system already gives equal opportunity to all students.',
          'He presents schools as a minor detail unrelated to citizenship or public responsibility.',
          'He focuses only on personal success stories without naming a public problem.',
        ],
      };
    }
    return {
      stem: 'How does the problem-solution structure across these paragraphs help convey the author’s purpose?',
      correct:
        'It identifies an issue and points toward a response, helping the reader understand what the author wants solved.',
      distractors: [
        'It avoids naming the issue so the reader has to guess the author’s purpose.',
        'It describes a setting without connecting it to any proposed response or purpose.',
        'It concludes the argument before the problem is introduced or developed.',
      ],
    };
  }

  if (subSkillId === 'example-evidence-structure') {
    if (/\bthirty-four institutions|established in border States|Freedmen's Bureau|state institutions/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use institutional evidence to support his argument?',
        correct:
          'He gives numbers and school categories to show that higher education has a real history and foundation.',
        distractors: [
          'He uses numbers to show that no colleges existed for Black students during this period.',
          'He replaces evidence with a fictional story about one student’s private experience.',
          'He lists schools only to distract from his argument about education and leadership.',
        ],
      };
    }
    if (/\bOf these graduates|50 per cent|90 per cent|come South|stay and labor/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use statistics about graduates to develop his point?',
        correct:
          'The statistics show that many college-educated Black graduates serve their communities, supporting his claim about leadership.',
        distractors: [
          'The statistics show that graduates avoid community work whenever possible after college.',
          'The statistics prove that higher education has no practical effects on leadership.',
          'The statistics shift the argument away from education to entertainment and personal preference.',
        ],
      };
    }
    if (/\breturns as to occupations|Atlanta conference|These figures illustrate|group leader/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use evidence about occupations to answer a challenge?',
        correct:
          'He uses gathered data to answer doubts about graduates and show their community leadership.',
        distractors: [
          'He admits that there is no evidence about college graduates’ work or public role.',
          'He uses the data to argue that leadership is unnecessary for the community.',
          'He changes the topic from education to a personal complaint about employment.',
        ],
      };
    }
    if (/\bFor instance|barrel’d beef|swine’s flesh|Lord Mayor’s feast/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s example develop the satire in this section?',
        correct:
          'The example treats the proposal like ordinary trade evidence, making the speaker’s cruel logic sound absurdly practical.',
        distractors: [
          'The example proves that the speaker has abandoned the proposal and now rejects trade.',
          'The example creates sympathy by focusing on children’s safety and protection.',
          'The example shows that the passage is only about farming improvements and food supply.',
        ],
      };
    }
    return {
      stem: 'How does the example or evidence across these paragraphs help develop the author’s point?',
      correct:
        'It gives concrete support that makes the broader claim more specific and convincing.',
      distractors: [
        'It weakens the point by replacing evidence with an unrelated personal opinion.',
        'It signals a shift away from the author’s claim and into a new topic.',
        'It only repeats the title and does not add support for the author’s claim.',
      ],
    };
  }

  if (subSkillId === 'opening-closing-shift') {
    if (/\bIf this be true--and who can deny it--three tasks lay before me/i.test(excerpt)) {
      return {
        stem: 'How does this section help organize Du Bois’s argument?',
        correct:
          'It announces the argument’s major tasks, helping the reader understand the order and purpose.',
        distractors: [
          'It ends the argument before Du Bois gives any evidence or develops his claims.',
          'It changes the text into a fictional story with no clear claim or structure.',
          'It hides the topic so the reader cannot tell what will be argued next.',
        ],
      };
    }
    if (/\bHow then shall the leaders|There can be but one answer|Was the work of these college founders successful/i.test(excerpt)) {
      return {
        stem: 'How does the question-and-answer shift guide the reader in this section?',
        correct:
          'It moves from a leadership problem to an education answer, then prepares readers for evidence.',
        distractors: [
          'It moves away from education and refuses to answer the leadership question directly.',
          'It presents evidence before the reader knows what question is being answered or why.',
          'It makes the section mainly descriptive instead of argumentative or purposeful.',
        ],
      };
    }
    if (/\bWas the work of these college founders successful|Let us see|there are to-day/i.test(excerpt)) {
      return {
        stem: 'How does the phrase “Let us see” shape the structure of the section?',
        correct:
          'It shifts from asking whether colleges worked to presenting evidence that answers the question.',
        distractors: [
          'It signals that Du Bois is finished with evidence and will only summarize his opinion.',
          'It introduces an unrelated personal story about one college founder’s childhood.',
          'It shows that the question cannot be answered with evidence or examples.',
        ],
      };
    }
    if (/\bThe most interesting question|Do they earn a living|Fortunately, returns as to occupations/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois use the question at the start of this section?',
        correct:
          'It focuses the reader on a criticism of college education before Du Bois answers with evidence.',
        distractors: [
          'It avoids the criticism and shifts to a topic unrelated to work or education.',
          'It proves that Du Bois has no evidence to answer the question about graduates.',
          'It concludes the entire argument without developing a response to the criticism.',
        ],
      };
    }
    if (/\bBut, as to myself|I profess in the sincerity of my heart|least personal interest|publick good/i.test(excerpt)) {
      return {
        stem: 'How does the final shift in Swift’s proposal affect the satire?',
        correct:
          'The speaker closes by claiming public concern, intensifying the irony after treating people as commodities.',
        distractors: [
          'The speaker closes by admitting that his plan is purely for personal profit.',
          'The speaker shifts to a sincere apology that cancels the satire and cruelty.',
          'The speaker ends by proving that the proposal protects poor children from harm.',
        ],
      };
    }
    return {
      stem: 'How does the shift or placement of this section guide the reader?',
      correct:
        'It introduces, redirects, or concludes the author’s thinking so the reader understands the purpose of the section.',
      distractors: [
        'It hides the author’s purpose by removing the connection between ideas.',
        'It provides a minor detail that does not affect the structure of the text.',
        'It changes the text from informational writing into a fictional scene.',
      ],
    };
  }

  return null;
}

function r22QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  if (subSkillId === 'central-idea-stated-implied') {
    if (/\bthree tasks lay before me|first to show|secondly, to show|thirdly, to show/i.test(excerpt)) {
      return {
        stem: 'Which central idea is introduced by Du Bois’s list of “three tasks”?',
        correct:
          'Black leadership must be developed through education that responds to history, present conditions, and future needs.',
        distractors: [
          'College education has already solved the major problems facing Black communities.',
          'Industrial training should replace every other kind of education for Black students.',
          'The passage is mainly about one personal memory from Du Bois’s own schooling.',
        ],
      };
    }
    if (/\bHow then shall the leaders|There can be but one answer/i.test(excerpt)) {
      return {
        stem: 'Which choice best states the central idea developed in this section?',
        correct:
          'Preparing effective leaders requires serious education, not only narrow job training.',
        distractors: [
          'Communities should stop asking questions about leadership and education.',
          'Industrial work is unnecessary because every student should avoid practical skills.',
          'Leadership is presented as a natural talent that cannot be taught or developed.',
        ],
      };
    }
    if (/\bI shall now therefore humbly propose|melancholy object|poor people/i.test(excerpt)) {
      return {
        stem: 'Which central idea does Swift’s speaker develop in this section?',
        correct:
          'The speaker presents an extreme proposal to expose the cold logic used toward poverty.',
        distractors: [
          'The speaker mainly argues that poverty has already been solved by public charity.',
          'The speaker presents a realistic plan that should be accepted without criticism.',
          'The speaker focuses only on describing city streets without making a larger point.',
        ],
      };
    }
    if (/\bThe truth of this has been strikingly shown|marked improvement of white teachers/i.test(excerpt)) {
      return {
        stem: 'Which central idea is developed by the example of improved teachers?',
        correct:
          'Educational opportunity can improve teaching quality and strengthen the community it serves.',
        distractors: [
          'Teacher quality is unrelated to the education available to a community.',
          'The passage argues that schools should avoid measuring teacher improvement.',
          'The example mainly shows that education has no practical effect outside college.',
        ],
      };
    }
    if (/\bno principality is secure without having its own forces|own forces|dependent on good fortune/i.test(excerpt)) {
      return {
        stem: 'Which central idea does Machiavelli develop about a secure state?',
        correct:
          'A state is safer when it depends on its own forces instead of outside help or luck.',
        distractors: [
          'A state is strongest when it avoids developing its own defenses and waits for fortune.',
          'A prince should value outside armies more than any force controlled by his own state.',
          'Security depends mostly on appearing generous rather than preparing for danger.',
        ],
      };
    }
    if (/\bfortune being changeful|mankind steadfast in their ways|men are successful/i.test(excerpt)) {
      return {
        stem: 'Which central idea does Machiavelli develop about fortune and human behavior?',
        correct:
          'Success depends on whether a person’s habits fit changing circumstances.',
        distractors: [
          'People succeed because fortune never changes and choices rarely matter.',
          'The passage argues that human behavior changes faster than any circumstance.',
          'Machiavelli claims that cautious people are always more successful than bold people.',
        ],
      };
    }
  }

  if (subSkillId === 'strong-vs-weak-evidence' || subSkillId === 'best-evidence-for-claim') {
    if (/\bThese figures illustrate vividly the function of the college-bred Negro/i.test(excerpt)) {
      return {
        stem: 'Which evidence most directly supports Du Bois’s claim about the function of college-trained Black leaders?',
        correct:
          'The figures connect college training to graduates’ work, making the claim concrete instead of abstract.',
        distractors: [
          'The figures mainly show that Du Bois has stopped discussing leadership and education.',
          'The figures prove only that colleges existed, without connecting graduates to public work.',
          'The figures are interesting background details, but they do not relate to the author’s claim.',
        ],
      };
    }
    if (/\bthere are to-day in the United States thirty-four institutions|Of these graduates|returns as to occupations/i.test(excerpt)) {
      return {
        stem: 'Which evidence best supports Du Bois’s claim that college education produced practical results?',
        correct:
          'The passage gives figures about institutions, graduates, and occupations to show what college-trained students did.',
        distractors: [
          'The passage mentions that some people questioned education without showing what graduates accomplished.',
          'The passage names the United States, but that detail alone does not prove the effect of college education.',
          'The passage includes older dates, though the dates by themselves do not show practical outcomes.',
        ],
      };
    }
    if (/\bcomputed the charge|thousand families|pounds|profit/i.test(excerpt)) {
      return {
        stem: 'Which detail most strongly supports the speaker’s economic logic in the proposal?',
        correct:
          'The speaker calculates costs and profit to make the proposal sound like a practical financial plan.',
        distractors: [
          'The speaker mentions families, but that detail alone does not prove the financial reasoning.',
          'The speaker refers to a country setting without connecting it to the proposal’s economics.',
          'The speaker uses polite language, though politeness does not supply evidence for the plan.',
        ],
      };
    }
    if (/\bproper training of Negro children|If carpenters are needed|trained in carpentry/i.test(excerpt)) {
      return {
        stem: 'Which evidence best supports Du Bois’s point about proper training?',
        correct:
          'He argues that training must fit the work, so teachers need teacher preparation rather than unrelated trade training.',
        distractors: [
          'He mentions children generally, but that detail does not explain what kind of training teachers need.',
          'He refers to schooling without showing how preparation should connect to the actual job.',
          'He uses a question form, though the question alone does not prove the point about training.',
        ],
      };
    }
  }

  if (subSkillId === 'evidence-develops-central-idea') {
    if (/\bThese figures illustrate|there are to-day|Of these graduates|returns as to occupations/i.test(excerpt)) {
      return {
        stem: 'How do the figures about institutions and graduates develop Du Bois’s central idea?',
        correct:
          'They turn his claim into measurable proof, showing that college education produced graduates and work outcomes.',
        distractors: [
          'They shift away from education by focusing only on unrelated population counts.',
          'They weaken his claim because numbers make his argument less specific and less testable.',
          'They mainly provide background dates without showing whether education had results.',
        ],
      };
    }
    if (/\btherefore it will have one other collateral advantage|lessening the number of Papists/i.test(excerpt)) {
      return {
        stem: 'How does the “collateral advantage” detail develop the speaker’s proposal?',
        correct:
          'It adds another supposed benefit, making the speaker’s cruel logic seem more calculated and disturbing.',
        distractors: [
          'It shows that the speaker has abandoned the proposal and turned to a personal apology.',
          'It makes the proposal compassionate by focusing on religious unity and family safety.',
          'It removes the economic argument because the speaker refuses to list any benefits.',
        ],
      };
    }
    if (/\bThe truth of this has been strikingly shown|has resulted in sending/i.test(excerpt)) {
      return {
        stem: 'How does the example in this section develop the central idea?',
        correct:
          'It gives a concrete case that supports the author’s broader point about education and opportunity.',
        distractors: [
          'It replaces the central idea with a minor story that has no connection to education.',
          'It proves that the author has moved away from evidence and into pure opinion.',
          'It shows that the author’s main point depends only on one unrelated personal detail.',
        ],
      };
    }
  }

  if (subSkillId === 'detail-vs-central-idea') {
    return {
      stem: 'Which choice best explains why a true detail may still be weak support for the central idea?',
      correct:
        `A detail like "${phrase}" matters only if it helps prove the author’s main point, not merely because it appears in the excerpt.`,
      distractors: [
        'Any detail copied from the passage is automatically strong evidence for the central idea.',
        'A detail is strongest when it is surprising, even if it does not connect to the author’s point.',
        'A detail should be rejected only when it is false, never when it is true but too narrow.',
      ],
    };
  }

  if (subSkillId === 'central-idea-development-across-paragraphs') {
    if (/\bthree tasks lay before me|first to show|secondly, to show|thirdly, to show/i.test(excerpt)) {
      return {
        stem: 'How do the listed “three tasks” develop Du Bois’s central idea?',
        correct:
          'They show that his argument will connect past evidence, present need, and future purpose for educated leadership.',
        distractors: [
          'They show that the passage will avoid evidence and focus only on one personal story.',
          'They prove that Du Bois has already finished the argument before developing his support.',
          'They shift the passage away from leadership and into an unrelated description of colleges.',
        ],
      };
    }
    if (/\bHow then shall the leaders|There can be but one answer|Was the work of these college founders successful|Let us see/i.test(excerpt)) {
      return {
        stem: 'How do these paragraphs work together to develop Du Bois’s central idea?',
        correct:
          'They move from the need for educated leadership to evidence that colleges helped answer that need.',
        distractors: [
          'They move from evidence to an unrelated fictional scene, leaving the leadership question behind.',
          'They repeat the same detail in each paragraph without adding support to the central idea.',
          'They argue that college education should be ignored because practical needs no longer matter.',
        ],
      };
    }
    if (/\bThe most interesting question|Fortunately, returns as to occupations|Of these graduates/i.test(excerpt)) {
      return {
        stem: 'How does the second paragraph develop the question raised in the first paragraph?',
        correct:
          'It answers the question about graduates by giving evidence about their occupations and results.',
        distractors: [
          'It avoids answering the question and shifts to a story about unrelated family history.',
          'It repeats the question without adding evidence that helps evaluate the issue.',
          'It argues that evidence about graduates cannot help readers judge education.',
        ],
      };
    }
    if (/\bThese figures illustrate vividly the function of the college-bred Negro/i.test(excerpt)) {
      return {
        stem: 'How does the paragraph beginning “These figures illustrate” develop the previous evidence?',
        correct:
          'It explains what the numbers prove, connecting the data to the broader claim about educated leadership.',
        distractors: [
          'It rejects the earlier data and claims that numbers cannot support an argument.',
          'It introduces an unrelated topic that does not connect to education or leadership.',
          'It repeats the same question without explaining what the evidence shows.',
        ],
      };
    }
    if (/\bNevertheless, I insist|not to make men carpenters|to make carpenters men/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois’s contrast about “carpenters” develop the central idea?',
        correct:
          'It clarifies that practical training matters, but true education should develop the whole person.',
        distractors: [
          'It argues that practical training should replace every form of broader education.',
          'It changes the topic from education to construction without developing the claim.',
          'It suggests that colleges should avoid preparing students for work or leadership.',
        ],
      };
    }
  }

  return {
    stem: `How does "${phrase}" support or develop the central idea of the excerpt?`,
    correct:
      'It gives evidence that helps prove, clarify, or extend the author’s main point.',
    distractors: [
      'It is a true detail from the excerpt, but it does not connect to the author’s main point.',
      'It mainly changes the topic instead of helping the reader understand the central idea.',
      'It replaces the central idea with a minor fact that does not need further support.',
    ],
  };
}

function r23QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  if (subSkillId === 'pathos-emotional-appeal') {
    if (/\bIt is a melancholy object|beggars of the female sex|children, all in rags|importuning every passenger/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Swift’s opening description help establish the speaker’s purpose?',
        correct:
          'It makes poverty feel visible and urgent before the proposal turns morally disturbing.',
        distractors: [
          'It makes the scene sound peaceful so readers ignore the problem being described.',
          'It proves the speaker is mainly interested in describing ordinary city travel.',
          'It removes emotion from the passage before the speaker begins his argument.',
        ],
      };
    }
    if (/\bgreat additional grievance|poor innocent babes|deplorable state/i.test(excerpt)) {
      return {
        stem: 'How does the emotional language about poor children affect the reader?',
        correct:
          'It pushes the reader to recognize suffering before the speaker offers a shocking solution.',
        distractors: [
          'It shows that the children are comfortable and do not need public concern.',
          'It shifts attention away from poverty and toward the speaker’s private success.',
          'It makes the argument depend only on numbers without any emotional force.',
        ],
      };
    }
    if (/\bworked meant degradation|curse of slavery|idleness disgraceful|weak position/i.test(excerpt)) {
      return {
        stem: 'How does Washington’s loaded language about labor affect the reader?',
        correct:
          'It frames work as a moral and social issue, pushing readers to see training as necessary.',
        distractors: [
          'It makes labor seem unrelated to the educational argument in the passage.',
          'It suggests that Washington wants readers to reject all forms of work.',
          'It removes urgency by treating the problem as already solved.',
        ],
      };
    }
    if (/\bWe few, we happy few|band of brothers|sheds his blood with me|accursed they were not here/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Henry’s emotional language motivate his soldiers?',
        correct:
          'It turns danger into shared honor, making the soldiers feel proud to fight together.',
        distractors: [
          'It warns the soldiers that fighting together will bring them shame.',
          'It makes the battle seem ordinary and disconnected from honor.',
          'It suggests Henry wants the men to leave before he speaks to them.',
        ],
      };
    }
  }

  if (subSkillId === 'logos-evidence-reasoning') {
    if (/\bcomputed the charge|pounds|profit|thousand families/i.test(excerpt)) {
      return {
        stem: 'How do the speaker’s calculations affect the proposal?',
        correct:
          'They make a cruel idea sound like a practical financial plan, sharpening the satire.',
        distractors: [
          'They show that the speaker has stopped making an argument about poverty.',
          'They prove that the proposal is compassionate because it avoids economic details.',
          'They make the passage mostly a personal memory rather than a public proposal.',
        ],
      };
    }
    if (/\bThese figures illustrate|there are to-day|Of these graduates|returns as to occupations/i.test(excerpt)) {
      return {
        stem: 'How do Du Bois’s figures about institutions and graduates support his purpose?',
        correct:
          'They give measurable proof that college education produced leaders and useful work.',
        distractors: [
          'They show that education cannot be judged with evidence or real outcomes.',
          'They change the topic from education to unrelated population facts.',
          'They suggest that leadership should depend on opinion instead of preparation.',
        ],
      };
    }
    if (/\bFor first|Secondly|Thirdly|Fifthly|Sixthly/i.test(excerpt)) {
      return {
        stem: 'How does the numbered reasoning help the speaker develop the proposal?',
        correct:
          'It organizes the supposed benefits so the proposal appears logical and systematic.',
        distractors: [
          'It hides the speaker’s reasoning by refusing to connect one point to the next.',
          'It changes the passage into a fictional scene with no argumentative purpose.',
          'It shows that the speaker has no plan beyond one emotional description.',
        ],
      };
    }
    if (/\beighty-five per cent|For two hundred and fifty years|industrial development|worked and working/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Washington’s factual reasoning support his purpose?',
        correct:
          'It connects industrial education to real conditions, making his argument seem practical rather than abstract.',
        distractors: [
          'It shows that Washington wants readers to ignore practical work and focus only on theory.',
          'It turns the passage into a personal story with no larger claim about education.',
          'It weakens his point by avoiding evidence about labor, training, or Southern life.',
        ],
      };
    }
    if (/\bI conclude, therefore|no principality is secure|fortune being changeful|own forces/i.test(excerpt)) {
      return {
        stem: 'How does Machiavelli’s reasoning help achieve his purpose?',
        correct:
          'It turns political advice into a cause-and-effect claim about security and survival.',
        distractors: [
          'It makes political action seem random and unrelated to a ruler’s choices.',
          'It shifts from advice into a fictional scene without a claim or evidence.',
          'It suggests that security depends mainly on luck rather than preparation.',
        ],
      };
    }
  }

  if (subSkillId === 'ethos-credibility-authority') {
    if (/\bI am assured by our merchants/i.test(excerpt)) {
      return {
        stem: 'How does the speaker’s reference to “our merchants” affect the argument?',
        correct:
          'It borrows credibility from people connected to trade, making the economic logic sound informed.',
        distractors: [
          'It shows the speaker rejects outside knowledge and speaks only from emotion.',
          'It proves the proposal is unrelated to money, trade, or public policy.',
          'It makes the speaker seem less credible because he refuses to give any support.',
        ],
      };
    }
    if (/\bI have been assured by a very knowing American/i.test(excerpt)) {
      return {
        stem: 'How does the reference to “a very knowing American” affect the speaker’s argument?',
        correct:
          'It borrows authority from an outside source, making the absurd proposal sound more credible.',
        distractors: [
          'It shows that the speaker rejects expert opinion and relies only on emotion.',
          'It proves the proposal is unrelated to the social problem being discussed.',
          'It makes the speaker seem uncertain because he refuses to cite any support.',
        ],
      };
    }
    if (/\bwe are told by a grave author|eminent French physician/i.test(excerpt)) {
      return {
        stem: 'How does the reference to a “grave author” affect the speaker’s argument?',
        correct:
          'It makes the speaker’s disturbing reasoning sound supported by learned authority.',
        distractors: [
          'It shows that the speaker has no outside source for his reasoning.',
          'It turns the passage away from argument and into a private memory.',
          'It proves the speaker is using emotion instead of credibility.',
        ],
      };
    }
    if (/\bA very worthy person|true lover of his country|virtues I highly esteem/i.test(excerpt)) {
      return {
        stem: 'How does the description of the “very worthy person” affect the speaker’s credibility?',
        correct:
          'It presents the source as patriotic and respectable, making the refinement seem more trustworthy.',
        distractors: [
          'It presents the source as foolish and unconnected to the proposal.',
          'It shows the speaker refuses to consider ideas from anyone else.',
          'It makes the passage rely only on setting rather than credibility.',
        ],
      };
    }
    if (/\bI profess in the sincerity of my heart|no other motive than the publick good|not the least personal interest/i.test(
      excerpt
    )) {
      return {
        stem: 'How does the speaker’s claim of public concern affect the satire?',
        correct:
          'It makes him sound trustworthy while exposing how cruel his supposedly selfless logic has been.',
        distractors: [
          'It proves the proposal is gentle because the speaker openly admits personal profit.',
          'It removes the satirical effect by making the speaker reject his own plan.',
          'It shifts the argument away from public concern and into unrelated biography.',
        ],
      };
    }
    if (/\bScripture|grave author|living oracles|book of nature/i.test(excerpt)) {
      return {
        stem: 'How does the author’s reference to respected sources support his purpose?',
        correct:
          'It builds credibility by connecting the argument to authority the audience already respects.',
        distractors: [
          'It weakens the argument by showing that no authority can support the claim.',
          'It changes the text into a story that avoids persuasion or evidence.',
          'It suggests the author wants readers to ignore the main point of the passage.',
        ],
      };
    }
    if (/\bMr\. C\.P\. Huntington|late beloved Frederick Douglass|In the words of|public address/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Washington’s use of a respected source support his argument?',
        correct:
          'It adds credibility by showing that another public voice supports practical education.',
        distractors: [
          'It weakens the argument by replacing education with an unrelated personal memory.',
          'It proves that Washington refuses to use outside support for his claim.',
          'It shifts the passage away from education and toward a fictional character.',
        ],
      };
    }
    if (/\bopinion and judgment of wise men|many have written on this point|our experience has been/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Machiavelli’s reference to experience or other writers support his advice?',
        correct:
          'It positions his advice as grounded in tested judgment rather than unsupported opinion.',
        distractors: [
          'It shows that Machiavelli wants readers to ignore experience and judgment.',
          'It changes the passage into a fictional scene with no advice.',
          'It proves the argument depends only on emotional language.',
        ],
      };
    }
    if (/\bI do not mean in any way to apologize|I would not by any means have it understood|I would set no limits/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Washington’s careful qualification help his argument?',
        correct:
          'It shows fairness and limits possible objections, making readers more likely to trust his position.',
        distractors: [
          'It shows that Washington has abandoned his position and no longer believes it.',
          'It makes the passage depend only on emotion rather than credibility or reasoning.',
          'It proves that readers should ignore the central issue of education.',
        ],
      };
    }
  }

  if (subSkillId === 'rhetorical-question-repetition') {
    if (/\bHow then shall the leaders|There can be but one answer/i.test(excerpt)) {
      return {
        stem: 'How does Du Bois’s question about leaders guide the reader?',
        correct:
          'It frames leadership as a problem that education must answer.',
        distractors: [
          'It suggests that leadership is not connected to education or preparation.',
          'It ends the argument before Du Bois can offer any answer.',
          'It changes the passage into a description of one private event.',
        ],
      };
    }
    if (/\bWas the work|Let us see/i.test(excerpt)) {
      return {
        stem: 'How does the question “Was the work” help organize Du Bois’s argument?',
        correct:
          'It invites the reader to judge the claim and prepares the evidence that follows.',
        distractors: [
          'It shows that the author will avoid evidence and leave the question unanswered.',
          'It makes the passage focus on a fictional conflict instead of public argument.',
          'It proves the author believes the issue is too simple to discuss.',
        ],
      };
    }
    if (/\bThe question therefore is|How this number shall be reared and provided for/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s question about how children will be “provided for” shape the satire?',
        correct:
          'It frames poverty as a practical problem before the speaker offers a morally shocking answer.',
        distractors: [
          'It shows that the speaker plans to avoid giving any answer to the problem.',
          'It makes the children’s poverty seem already solved before the proposal begins.',
          'It shifts the passage away from public policy into an unrelated personal memory.',
        ],
      };
    }
    if (/\bin the first place|Firstly|Fourthly|Of these four things|successor to the Church|Alexander/i.test(excerpt)) {
      return {
        stem: 'How does Machiavelli’s repeated list structure shape the advice?',
        correct:
          'It organizes the ruler’s risks and responses, making the political strategy seem deliberate.',
        distractors: [
          'It makes the advice seem random because the actions have no sequence or purpose.',
          'It changes the passage into a personal memory instead of political reasoning.',
          'It shows that the ruler has no plan for responding to future threats.',
        ],
      };
    }
    if (/\bFor first|Secondly|Thirdly|Fifthly|Sixthly/i.test(excerpt)) {
      return {
        stem: 'How does the repeated list structure affect the proposal?',
        correct:
          'It makes the argument sound orderly, which intensifies the cold logic behind the satire.',
        distractors: [
          'It makes the argument seem disorganized because the points have no sequence.',
          'It removes the speaker’s purpose by replacing claims with unrelated setting details.',
          'It shows that the speaker is refusing to explain any benefit of the proposal.',
        ],
      };
    }
    if (/\bIt has been necessary\b/i.test(excerpt)) {
      return {
        stem: 'How does Washington’s repeated phrase “It has been necessary” shape the argument?',
        correct:
          'It emphasizes the lessons the race has had to learn, making his point feel urgent and cumulative.',
        distractors: [
          'It suggests that the lessons are optional and have no connection to his purpose.',
          'It shifts attention away from education and toward an unrelated setting detail.',
          'It proves Washington is finished with the argument before giving support.',
        ],
      };
    }
    if (/\bHe that out-lives this day|This day is call|Crispian|We few, we happy few/i.test(excerpt)) {
      return {
        stem: 'How does Henry’s repetition of “this day” and “Crispian” affect the speech?',
        correct:
          'It makes the battle feel memorable, turning the moment into a future source of honor.',
        distractors: [
          'It makes the battle seem forgettable and disconnected from the soldiers’ identity.',
          'It shows that Henry is mainly explaining the calendar rather than motivating men.',
          'It weakens the speech by avoiding any connection between danger and honor.',
        ],
      };
    }
  }

  if (subSkillId === 'figurative-language-purpose') {
    if (/\bmelancholy object/i.test(excerpt)) {
      return {
        stem: 'How does the phrase “melancholy object” support the speaker’s purpose at the opening?',
        correct:
          'It presents poverty as something sorrowful to look at, drawing readers into the social problem.',
        distractors: [
          'It makes poverty seem cheerful so readers will not expect a serious argument.',
          'It proves the passage is mainly about scenery rather than a public issue.',
          'It removes the speaker’s purpose by avoiding any emotional description.',
        ],
      };
    }
    if (/\bwhole fabric of science|book of nature|living oracles|universe stands continually open/i.test(excerpt)) {
      return {
        stem: 'How does the figurative language about science and nature support the author’s purpose?',
        correct:
          'It makes inquiry seem broad and orderly, helping defend the value of studying nature.',
        distractors: [
          'It makes scientific study seem narrow and unrelated to the author’s purpose.',
          'It shifts the passage away from argument and into a personal travel story.',
          'It suggests readers should avoid using evidence to understand the world.',
        ],
      };
    }
    if (/\bbarbarous dominion stinks|swallow up our people/i.test(excerpt)) {
      return {
        stem: 'How does the author’s figurative wording strengthen the argument?',
        correct:
          'It turns the danger into a vivid image, making the threat feel urgent to the reader.',
        distractors: [
          'It makes the danger seem harmless by describing it in neutral terms.',
          'It replaces the author’s argument with a detail that has no emotional effect.',
          'It proves the writer’s purpose is only to define a word literally.',
        ],
      };
    }
    if (/\bfoundation|economic foundation|upward course|laying the foundation/i.test(excerpt)) {
      return {
        stem: 'How does Washington’s “foundation” language support his purpose?',
        correct:
          'It presents practical labor as the base needed before broader progress can stand.',
        distractors: [
          'It suggests that practical labor is a decoration rather than a base for progress.',
          'It shifts the passage away from education and into unrelated architecture only.',
          'It proves that Washington wants to avoid explaining how progress begins.',
        ],
      };
    }
    if (/\braging rivers|sweeping away trees and buildings|fortune being changeful/i.test(excerpt)) {
      return {
        stem: 'How does Machiavelli’s comparison of fortune to a river support his purpose?',
        correct:
          'It makes fortune seem powerful but manageable, supporting his advice to prepare before danger comes.',
        distractors: [
          'It proves that fortune is harmless and requires no preparation.',
          'It shifts from political advice into scenery that has no effect on the point.',
          'It suggests rulers should wait passively because preparation cannot matter.',
        ],
      };
    }
    if (/\bband of brothers|household words|flowing Cups freshly remembred/i.test(excerpt)) {
      return {
        stem: 'How does the figurative language in Henry’s speech support his purpose?',
        correct:
          'It turns soldiers into a lasting brotherhood, making shared risk feel honorable.',
        distractors: [
          'It makes the soldiers seem separated from one another and unlikely to fight.',
          'It presents the battle as a private memory with no connection to courage.',
          'It weakens the speech by making honor seem unimportant to the men.',
        ],
      };
    }
  }

  if (subSkillId === 'purpose-fit-rhetorical-choice' || subSkillId === 'logos-ethos-pathos') {
    if (/\bI close, then, as I began|as a freeman he must learn to work|re-enforce argument with results/i.test(
      excerpt
    )) {
      return {
        stem: 'How does Washington’s closing claim fit his purpose?',
        correct:
          'It returns to his main contrast between forced labor and purposeful work as preparation for progress.',
        distractors: [
          'It abandons his main point and argues that education should avoid work entirely.',
          'It changes the passage into a private story without a public purpose.',
          'It suggests that freedom removes the need for training or discipline.',
        ],
      };
    }
    if (/\bIt has been necessary|worked and working|economic foundation/i.test(excerpt)) {
      return {
        stem: 'How does Washington’s appeal connect work to his larger purpose?',
        correct:
          'It frames work as necessary for freedom and progress, making industrial education feel urgent.',
        distractors: [
          'It argues that work is unrelated to education or progress.',
          'It treats freedom as a reason to avoid training and discipline.',
          'It shifts the passage away from public purpose into private memory.',
        ],
      };
    }
    if (/\bIt is a melancholy object|beggars of the female sex|children, all in rags/i.test(excerpt)) {
      return {
        stem: 'How does Swift’s opening appeal help prepare the reader for the satire?',
        correct:
          'It makes poverty feel urgent before the speaker’s proposal exposes cruel public reasoning.',
        distractors: [
          'It makes poverty seem harmless before the speaker offers a gentle solution.',
          'It avoids emotion so the reader focuses only on neutral statistics.',
          'It shifts the passage away from poverty and toward unrelated travel details.',
        ],
      };
    }
    if (/\bcomputed the charge|pounds|profit|thousand families/i.test(excerpt)) {
      return {
        stem: 'How do the speaker’s calculations help achieve Swift’s satirical purpose?',
        correct:
          'They make the proposal sound financially logical, exposing how cruel such reasoning is.',
        distractors: [
          'They make the proposal sound emotional and protective toward poor children.',
          'They prove the speaker has abandoned the economic argument entirely.',
          'They turn the excerpt into a neutral budget with no social criticism.',
        ],
      };
    }
    if (/\bI shall now therefore humbly propose|I do therefore humbly offer it to publick consideration/i.test(
      excerpt
    )) {
      return {
        stem: 'How does the speaker’s formal proposal language help achieve the satire’s purpose?',
        correct:
          'It makes an inhumane idea sound reasonable, exposing the danger of cold problem-solving.',
        distractors: [
          'It makes the proposal sound emotional and caring, removing the satirical criticism.',
          'It shows that the speaker is unsure and refuses to state a solution.',
          'It shifts the passage away from poverty and toward unrelated personal history.',
        ],
      };
    }
    if (/\bHow then shall the leaders|There can be but one answer/i.test(excerpt)) {
      return {
        stem: 'Why does Du Bois pair a question about leadership with a direct answer?',
        correct:
          'The question defines the problem, and the answer points readers toward education as the solution.',
        distractors: [
          'The question avoids the problem, and the answer changes to an unrelated topic.',
          'The question proves leadership cannot be taught or developed.',
          'The answer rejects education before the author explains the issue.',
        ],
      };
    }
    if (/\bThese figures illustrate|Of these graduates|returns as to occupations/i.test(excerpt)) {
      return {
        stem: 'How does using data fit Du Bois’s purpose in this section?',
        correct:
          'The data helps prove that college education has practical results, not just theoretical value.',
        distractors: [
          'The data suggests that practical results are impossible to measure.',
          'The data shifts away from education and into unrelated biography.',
          'The data weakens the argument by refusing to support any claim.',
        ],
      };
    }
    if (/\bcomputed the charge|pounds|profit|thousand families/i.test(excerpt)) {
      return {
        stem: 'How do the speaker’s calculations fit the purpose of Swift’s satire?',
        correct:
          'They make the proposal sound financially reasonable, exposing how cruel cold logic can become.',
        distractors: [
          'They make the proposal seem emotional and caring rather than calculated.',
          'They show the speaker has stopped discussing poverty or public policy.',
          'They turn the passage into a neutral math example with no satirical purpose.',
        ],
      };
    }
    if (/\bI close, then, as I began|as a freeman he must learn to work|industrial education/i.test(excerpt)) {
      return {
        stem: 'How does Washington’s closing claim fit his purpose?',
        correct:
          'It returns to his main contrast between being worked and learning to work as free preparation.',
        distractors: [
          'It abandons his main point and argues that education should avoid work entirely.',
          'It changes the passage into a private story without a public purpose.',
          'It suggests that freedom removes the need for training or discipline.',
        ],
      };
    }
    if (/\bfewer men, the greater share of honour|He that out-lives this day|band of brothers/i.test(excerpt)) {
      return {
        stem: 'How does Henry’s appeal to honor fit his purpose in the speech?',
        correct:
          'It turns being outnumbered into a reason for pride, encouraging the soldiers to fight.',
        distractors: [
          'It presents being outnumbered as proof that the soldiers should leave.',
          'It changes the speech into a neutral report with no motivational purpose.',
          'It shows Henry is more interested in gold than courage or loyalty.',
        ],
      };
    }
    if (/\bIf, therefore, your illustrious house|This opportunity, therefore|liberator appear/i.test(excerpt)) {
      return {
        stem: 'How does Machiavelli’s direct appeal fit his purpose near the end?',
        correct:
          'It pushes the audience toward action by presenting leadership as a timely opportunity.',
        distractors: [
          'It tells the audience that action is impossible and should be delayed.',
          'It shifts away from political advice into an unrelated historical list.',
          'It proves that the author’s purpose is only to describe past events.',
        ],
      };
    }
    if (/\braging rivers|sweeping away trees and buildings|fortune being changeful/i.test(excerpt)) {
      return {
        stem: 'How does Machiavelli’s river comparison fit his purpose?',
        correct:
          'It makes fortune seem dangerous but manageable, reinforcing his advice to prepare for change.',
        distractors: [
          'It makes fortune seem harmless, so the reader sees no reason to prepare.',
          'It shifts from advice into scenery that has no connection to political action.',
          'It suggests leaders should depend on chance instead of planning.',
        ],
      };
    }
  }

  return {
    stem: `How does the rhetorical choice in "${phrase}" help the author achieve a purpose?`,
    correct:
      'It shapes what the reader thinks, feels, or trusts so the author’s point becomes more persuasive.',
    distractors: [
      'It gives a true detail from the excerpt but does not affect the reader or the author’s purpose.',
      'It changes the passage into a story where persuasion and argument no longer matter.',
      'It removes the author’s point by focusing only on a minor background detail.',
    ],
  };
}

function r31QuestionPackage(excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  const quotedPhrase = quoteForStem(phrase);

  if (/\bLove is a smoke\b/i.test(phrase)) {
    return {
      stem: `How does the metaphor in "${quotedPhrase}" help show Romeo’s view of love?`,
      correct:
        'It shows love as painful and confusing, suggesting that Romeo experiences love as both desire and suffering.',
      distractors: [
        'It shows love as calm and predictable, suggesting that Romeo has control over his emotions.',
        'It presents love as a public duty, suggesting that Romeo is focused on family honor.',
        'It makes love seem simple, suggesting that Romeo understands his feelings clearly.',
      ],
    };
  }

  if (/\bpatient etheri[sz]ed\b/i.test(phrase)) {
    return {
      stem: `How does the simile in "${quotedPhrase}" shape the mood at the beginning of the poem?`,
      correct:
        'It makes the evening feel still and unsettling, creating a mood of unease instead of romance.',
      distractors: [
        'It makes the evening feel energetic and joyful, creating excitement before the speaker travels.',
        'It makes the city seem ordinary and practical, keeping the mood neutral and realistic.',
        'It makes the speaker seem confident, showing that he knows exactly where he wants to go.',
      ],
    };
  }

  if (
    subSkillId === 'personification-effect' &&
    /\byellow fog|yellow smoke|rubs its back|rubs its muzzle|Licked its tongue|Curled once\b/i.test(phrase)
  ) {
    return {
      stem: `How does the personification in "${quotedPhrase}" affect the mood of the poem?`,
      correct:
        'It makes the fog seem like a living creature moving through the city, creating a secretive and uneasy mood.',
      distractors: [
        'It makes the fog seem like a clear signal that the speaker should leave the city immediately.',
        'It makes the city seem bright and open, creating a mood of confidence and celebration.',
        'It explains the weather scientifically, keeping the focus on facts rather than mood.',
      ],
    };
  }

  if (subSkillId === 'symbol-object-meaning' && /\bwhite heron|heron[’']s secret\b/i.test(phrase)) {
    return {
      stem: `How does the repeated image of the "${quotedPhrase}" add meaning to the excerpt?`,
      correct:
        'It becomes more than a bird because it represents the natural world Sylvia feels responsible to protect.',
      distractors: [
        'It mainly gives the hunter an easy target, showing that Sylvia has no real choice to make.',
        'It becomes a symbol of danger because the bird threatens Sylvia and her grandmother.',
        'It simply identifies the kind of bird, so it does not add meaning beyond the plot.',
      ],
    };
  }

  if (subSkillId === 'symbol-object-meaning' && /\bblack sack|black hole|place of death.*light|death.*light\b/i.test(phrase)) {
    return {
      stem: `How does the image in "${quotedPhrase}" add meaning to Ivan Ilyich’s experience?`,
      correct:
        'It turns his suffering into a concrete image, helping the reader understand his movement from fear toward release.',
      distractors: [
        'It mainly identifies the room where Ivan Ilyich is lying, without developing his inner experience.',
        'It shows that Ivan Ilyich is physically trapped by other people rather than struggling inwardly.',
        'It proves that Ivan Ilyich has recovered from illness and no longer thinks about death.',
      ],
    };
  }

  if (subSkillId === 'mood-shift-effect' && /\bterror in the joy\b/i.test(phrase)) {
    return {
      stem: `How does the phrase "${quotedPhrase}" help create the mood of the excerpt?`,
      correct:
        'It blends excitement with fear, showing that Icarus’s flight feels thrilling but dangerous.',
      distractors: [
        'It shows that Icarus is bored by flying because the experience feels too easy.',
        'It shows that Daedalus has removed all danger by teaching Icarus how to fly.',
        'It makes the flight feel ordinary by focusing on practical details instead of emotion.',
      ],
    };
  }

  if (subSkillId === 'mood-shift-effect' && /\bIn the place of death there was light|Death is over|There was no terror\b/i.test(phrase)) {
    return {
      stem: `How does the language in "${quotedPhrase}" shift the mood near the end of the excerpt?`,
      correct:
        'It changes the mood from fear and suffering to release, showing that Ivan Ilyich no longer experiences death as terror.',
      distractors: [
        'It changes the mood from calm to panic, showing that Ivan Ilyich becomes more afraid of death.',
        'It keeps the mood neutral by focusing on what other people say around Ivan Ilyich.',
        'It shifts the mood toward anger, showing that Ivan Ilyich blames his family for his pain.',
      ],
    };
  }

  if (subSkillId === 'metaphor-simile') {
    return {
      stem: `How does the comparison in "${quotedPhrase}" affect the excerpt?`,
      correct:
        'It helps the reader understand the scene by turning the literal moment into a vivid feeling or idea.',
      distractors: [
        'It identifies the setting but does not affect how the reader understands the scene.',
        'It explains a character’s background instead of shaping the meaning of the moment.',
        'It gives a factual detail that removes the need to interpret the language.',
      ],
    };
  }

  if (subSkillId === 'personification-effect') {
    return {
      stem: `How does the personification in "${quotedPhrase}" shape the mood or meaning of the excerpt?`,
      correct:
        'It makes a nonhuman part of the scene feel active, so the mood becomes more intense or meaningful.',
      distractors: [
        'It gives a neutral description of the place without creating a mood.',
        'It explains what a character says, but it does not change the reader’s feeling.',
        'It makes the conflict disappear by turning the scene into ordinary background.',
      ],
    };
  }

  if (subSkillId === 'imagery-sensory-language') {
    return {
      stem: `How does the imagery in "${quotedPhrase}" help create the mood of the excerpt?`,
      correct:
        'It gives the reader concrete sensory details that make the atmosphere easier to feel and understand.',
      distractors: [
        'It gives a sensory detail, but the mood comes only from what the characters say.',
        'It explains the plot sequence without affecting the atmosphere of the scene.',
        'It shifts away from the passage’s mood by focusing on an unrelated fact.',
      ],
    };
  }

  if (subSkillId === 'symbol-object-meaning') {
    return {
      stem: `How does the image or object in "${quotedPhrase}" add meaning to the excerpt?`,
      correct:
        'It suggests an idea or feeling beyond the literal object, giving the moment a deeper meaning.',
      distractors: [
        'It names an object that matters only because it is physically present.',
        'It gives a minor detail that does not connect to mood, meaning, or reader understanding.',
        'It explains the setting without suggesting anything beyond the literal place.',
      ],
    };
  }

  if (subSkillId === 'mood-shift-effect') {
    return {
      stem: `How does the language in "${quotedPhrase}" help create or shift the mood?`,
      correct:
        'It changes or intensifies the feeling of the scene by using exact words that point to the new mood.',
      distractors: [
        'It keeps the mood unchanged even though the language becomes more vivid.',
        'It summarizes what happens next without affecting how the reader feels.',
        'It makes the passage less specific by removing the emotional details.',
      ],
    };
  }

  return null;
}

function r32QuestionPackage(_excerpt: string, phrase: string, subSkillId?: string | null): QuestionPackage | null {
  const quotedPhrase = quoteForStem(phrase);

  if (subSkillId === 'chunk-complex-syntax') {
    return {
      stem: `Which option best shows how to chunk and paraphrase the sentence beginning "${quotedPhrase}"?`,
      correct:
        'Break the sentence into its main idea and connected details, then restate those parts in the same order.',
      distractors: [
        'Use only the first detail from the sentence and ignore the later clauses.',
        'Choose the shortest restatement, even if it changes the relationship between ideas.',
        'Replace the sentence with a broad topic that leaves out the author’s exact point.',
      ],
    };
  }

  if (subSkillId === 'preserve-original-meaning') {
    return {
      stem: `Which paraphrase best preserves the meaning of "${quotedPhrase}"?`,
      correct:
        'It keeps the same key ideas and relationships while putting the wording in simpler language.',
      distractors: [
        'It adds a stronger claim than the original passage actually makes.',
        'It leaves out an important condition or contrast from the original wording.',
        'It changes the author’s meaning by turning a careful statement into an opposite idea.',
      ],
    };
  }

  if (subSkillId === 'translate-archaic-or-formal-language') {
    return {
      stem: `What is the best plain-language paraphrase of "${quotedPhrase}"?`,
      correct:
        'The hard wording should be translated into modern words while the author’s meaning stays the same.',
      distractors: [
        'The older wording should be copied exactly because paraphrase should not change any words.',
        'The formal words should be replaced with a new opinion that sounds easier to understand.',
        'The unfamiliar words should be skipped so the paraphrase only includes simple details.',
      ],
    };
  }

  if (subSkillId === 'paraphrase-claim-or-theme') {
    return {
      stem: `Which statement best paraphrases the main claim or point of this excerpt?`,
      correct:
        'It restates the author’s central point in clear language without adding a new claim.',
      distractors: [
        'It restates one small detail but misses the larger point the excerpt develops.',
        'It adds a new conclusion that is not supported by the excerpt.',
        'It changes the author’s point into a summary of background information only.',
      ],
    };
  }

  return null;
}

function anchorQuestion(standard: string, excerpt: string, seed = 0, subSkillId?: string | null) {
  const phrase = quoteForStem(selectEvidencePhrase(standard, excerpt, subSkillId));
  const lower = phrase.toLowerCase();
  const r11QuestionConfig =
    standard === 'ELA.9.R.1.1' && subSkillId ? R11_QUESTION_CONFIG[subSkillId] : null;
  const r11SettingPackage =
    standard === 'ELA.9.R.1.1' && subSkillId === 'setting-layer'
      ? r11SettingQuestionPackage(excerpt, phrase)
      : null;
  const r11PlotPackage =
    standard === 'ELA.9.R.1.1' && subSkillId === 'plot-conflict-layer'
      ? r11PlotConflictQuestionPackage(excerpt, phrase)
      : null;
  const r11CharacterPackage =
    standard === 'ELA.9.R.1.1' && subSkillId === 'characterization-layer'
      ? r11CharacterQuestionPackage(excerpt, phrase)
      : null;
  const r11PovPackage =
    standard === 'ELA.9.R.1.1' && subSkillId === 'point-of-view-layer'
      ? r11PointOfViewQuestionPackage(excerpt, phrase)
      : null;
  const r11ThemeTonePackage =
    standard === 'ELA.9.R.1.1' && subSkillId === 'theme-tone-layer'
      ? r11ThemeToneQuestionPackage(excerpt, phrase)
      : null;
  const r11StylePackage =
    standard === 'ELA.9.R.1.1' && subSkillId === 'style-technique-layer'
      ? r11StyleQuestionPackage(excerpt, phrase)
      : null;
  const r14Package = standard === 'ELA.9.R.1.4' ? r14QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r12Package = standard === 'ELA.9.R.1.2' ? r12QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r13Package = standard === 'ELA.9.R.1.3' ? r13QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r21Package = standard === 'ELA.9.R.2.1' ? r21QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r22Package = standard === 'ELA.9.R.2.2' ? r22QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r23Package = standard === 'ELA.9.R.2.3' ? r23QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r31Package = standard === 'ELA.9.R.3.1' ? r31QuestionPackage(excerpt, phrase, subSkillId) : null;
  const r32Package = standard === 'ELA.9.R.3.2' ? r32QuestionPackage(excerpt, phrase, subSkillId) : null;

  const stems: Record<string, string> = {
    'ELA.9.R.1.1':
      r11SettingPackage?.stem ??
      r11PlotPackage?.stem ??
      r11CharacterPackage?.stem ??
      r11PovPackage?.stem ??
      r11ThemeTonePackage?.stem ??
      r11StylePackage?.stem ??
      r11QuestionConfig?.stem(phrase) ??
      `How does the detail in "${phrase}" add a layer of meaning or style to the excerpt?`,
    'ELA.9.R.1.2': r12Package?.stem ?? `How does the excerpt help develop a universal theme?`,
    'ELA.9.R.1.3':
      r13Package?.stem ?? `How does the author's perspective or irony shape the reader's understanding?`,
    'ELA.9.R.1.4': r14Package?.stem ?? `How does this excerpt reflect an epic convention?`,
    'ELA.9.R.2.1':
      r21Package?.stem ?? `How does the structure of the paragraph help develop the author's purpose?`,
    'ELA.9.R.2.2': r22Package?.stem ?? `How does this paragraph support the central idea?`,
    'ELA.9.R.2.3': r23Package?.stem ?? `How does the author's language help achieve the purpose?`,
    'ELA.9.R.2.4': `How would this claim help develop one side of an argument?`,
    'ELA.9.R.3.1': r31Package?.stem ?? `How does the language in "${phrase}" help create mood?`,
    'ELA.9.R.3.2': r32Package?.stem ?? `Which statement best paraphrases the main idea of this excerpt?`,
    'ELA.9.R.3.3': `How could this source moment be compared with an adaptation?`,
    'ELA.9.R.3.4': `How does the author's rhetoric affect the reader?`,
  };

  const r11Correct =
    lower.includes('savage') || lower.includes('lonely') || lower.includes('dread')
      ? 'It establishes the setting as dangerous and uneasy, preparing the reader for Apollo’s conflict with the Python.'
      : lower.includes('shadows') || lower.includes('sunset') || lower.includes('woods')
        ? 'It makes the setting feel shadowed and transitional, helping the reader sense mood before the action develops.'
        : lower.includes('swamp') || lower.includes('sunshine')
          ? 'It makes the place feel vivid and hidden, helping the reader understand why the setting matters to the character’s choice.'
          : lower.includes('storm') || lower.includes('rain')
            ? 'It turns the setting into pressure on the characters, making the conflict feel larger and more urgent.'
      : lower.includes('serpent') || lower.includes('den')
        ? 'It turns the Python into the central threat, adding danger and urgency to Apollo’s arrival.'
        : 'It shows that the detail does more than report action; it adds a layer of meaning about the conflict, setting, or character.';

  const choicesByStandard: Record<string, Array<{ text: string; correct: boolean }>> = {
    'ELA.9.R.1.1': [
      {
        text: r11SettingPackage?.correct ??
          r11PlotPackage?.correct ??
          r11CharacterPackage?.correct ??
          r11PovPackage?.correct ??
          r11ThemeTonePackage?.correct ??
          r11StylePackage?.correct ??
          r11QuestionConfig?.correct ??
          (lower.includes('savage') || lower.includes('lonely') || lower.includes('dread')
            ? 'It presents the setting as threatening before the Python appears, making Apollo’s decision to build there feel dangerous.'
            : lower.includes('shadows') || lower.includes('sunset') || lower.includes('woods')
              ? 'It creates a shadowed evening setting, which helps establish mood before the character’s action continues.'
              : lower.includes('swamp') || lower.includes('sunshine')
                ? 'It makes the setting vivid and specific, showing why this place matters to what the character notices.'
                : lower.includes('storm') || lower.includes('rain')
                  ? 'It makes the setting feel powerful and threatening, increasing the pressure around the events.'
            : r11Correct),
        correct: true,
      },
      ...(
        r11SettingPackage?.distractors ??
        r11PlotPackage?.distractors ??
        r11CharacterPackage?.distractors ??
        r11PovPackage?.distractors ??
        r11ThemeTonePackage?.distractors ??
        r11StylePackage?.distractors ??
        r11QuestionConfig?.distractors ?? [
          'It shows that Apollo is unfamiliar with the land and must depend on the people who live there.',
          'It suggests that the valley is peaceful but misunderstood by the people who live near it.',
          'It shifts attention from Apollo’s plan to the daily lives of the people hiding among the rocks.',
        ]
      ).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.1.2': [
      {
        text:
          r12Package?.correct ??
          'It develops a broader idea about power, fear, courage, duty, or choice through a specific moment.',
        correct: true,
      },
      ...(r12Package?.distractors ?? [
        'It gives only a setting detail and does not connect to any larger idea.',
        'It resolves every conflict in the text immediately.',
        'It introduces a theme that contradicts the evidence in the paragraph.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.1.3': [
      {
        text:
          r13Package?.correct ??
          'It creates a gap between what is said, believed, or expected and what the reader understands.',
        correct: true,
      },
      ...(r13Package?.distractors ?? [
        'It explains the literal action without changing the reader’s understanding.',
        'It removes the narrator’s or speaker’s influence from the excerpt.',
        'It gives background information that is unrelated to irony or perspective.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.1.4': [
      {
        text:
          r14Package?.correct ??
          'It shows an epic convention by connecting heroic action, divine force, danger, or fate to the story structure.',
        correct: true,
      },
      ...(r14Package?.distractors ?? [
        'It removes the heroic problem and makes the scene ordinary.',
        'It focuses only on modern realistic dialogue.',
        'It avoids action, conflict, and supernatural influence.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.2.1': [
      {
        text:
          r21Package?.correct ??
          'It organizes the ideas so the reader can understand how the author’s purpose or meaning develops.',
        correct: true,
      },
      ...(r21Package?.distractors ?? [
        'It gives details without showing how the ideas are organized.',
        'It mainly creates mood through fictional setting details.',
        'It removes the connection between the author’s point and the evidence.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.2.2': [
      {
        text:
          r22Package?.correct ??
          'It gives evidence that helps prove, clarify, or extend the author’s main point.',
        correct: true,
      },
      ...(r22Package?.distractors ?? [
        'It is a true detail from the excerpt, but it does not connect to the author’s main point.',
        'It mainly changes the topic instead of helping the reader understand the central idea.',
        'It replaces the central idea with a minor fact that does not need further support.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.2.3': [
      {
        text:
          r23Package?.correct ??
          'It shapes what the reader thinks, feels, or trusts so the author’s point becomes more persuasive.',
        correct: true,
      },
      ...(r23Package?.distractors ?? [
        'It gives a true detail from the excerpt but does not affect the reader or the author’s purpose.',
        'It changes the passage into a story where persuasion and argument no longer matter.',
        'It removes the author’s point by focusing only on a minor background detail.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.3.1': [
      {
        text: r31Package?.correct ?? 'It creates mood through image-heavy or figurative language that makes the scene feel specific to the reader.',
        correct: true,
      },
      ...(r31Package?.distractors ?? [
        'It gives a neutral fact with no emotional effect.',
        'It changes the topic to an unrelated argument.',
        'It explains the author’s biography instead of shaping mood.',
      ]).map((text) => ({ text, correct: false })),
    ],
    'ELA.9.R.3.2': [
      {
        text:
          r32Package?.correct ??
          'It restates the original meaning accurately in simpler words without adding or deleting key ideas.',
        correct: true,
      },
      ...(r32Package?.distractors ?? [
        'It sounds simpler, but it changes one of the author’s key ideas.',
        'It repeats a detail from the passage without restating the larger meaning.',
        'It adds a new idea that is not supported by the excerpt.',
      ]).map((text) => ({ text, correct: false })),
    ],
  };

  const fallbackChoices = [
    {
      text: 'It uses exact evidence to develop the meaning, purpose, structure, mood, or effect of the excerpt.',
      correct: true,
    },
    { text: 'It repeats a minor detail without connecting to the author’s purpose.', correct: false },
    { text: 'It introduces a point that the paragraph does not develop.', correct: false },
    { text: 'It can be answered without reading the excerpt closely.', correct: false },
  ];

  return {
    stem: stems[standard] ?? `How does this excerpt develop the standard skill?`,
    choices: rotateChoices(seed, choicesByStandard[standard] ?? fallbackChoices),
  };
}

type R32GoldCard = {
  subSkillId: string;
  skillFocus: string;
  selection: string;
  exact: string;
  excerpt: string;
  evidence: string[];
  stem: string;
  correct: string;
  distractors: string[];
};

type R34GoldCard = {
  skillFocus: string;
  selection: string;
  exact: string;
  excerpt: string;
  evidence: string[];
  stem: string;
  correct: string;
  distractors: string[];
};

type R31PersonificationGoldCard = {
  selection: string;
  exact: string;
  excerpt: string;
  evidence: string[];
  stem: string;
  correct: string;
  distractors: string[];
};

type VocabularyGoldCard = {
  standard: 'ELA.9.V.1.1' | 'ELA.9.V.1.2' | 'ELA.9.V.1.3';
  subSkillId: string;
  skillFocus: string;
  selection: string;
  exact: string;
  excerpt: string;
  evidence: string[];
  stem: string;
  correct: string;
  distractors: string[];
};

function r31PersonificationGoldRows(maxRows: number): PullOutRow[] {
  const subSkillId = 'personification-effect';
  const skillFocus = 'Personification effect';
  const cards: R31PersonificationGoldCard[] = [
    {
      selection: 'The Love Song of J. Alfred Prufrock — T.S. Eliot',
      exact: 'fog personification excerpt',
      excerpt:
        'The yellow fog that rubs its back upon the window-panes, The yellow smoke that rubs its muzzle on the window-panes, Licked its tongue into the corners of the evening, Lingered upon the pools that stand in drains, Let fall upon its back the soot that falls from chimneys, Slipped by the terrace, made a sudden leap, And seeing that it was a soft October night, Curled once about the house, and fell asleep.',
      evidence: ['rubs its back', 'rubs its muzzle', 'Licked its tongue', 'Curled once about the house'],
      stem: 'How does the personification of the fog affect the mood of the excerpt?',
      correct:
        'It makes the fog seem like a quiet animal moving through the city, creating a secretive and uneasy mood.',
      distractors: [
        'It makes the fog seem like a clear warning that the speaker should leave immediately.',
        'It makes the city feel bright and open, creating confidence and celebration.',
        'It explains the weather scientifically, keeping the focus on facts instead of mood.',
      ],
    },
    {
      selection: 'The Love Song of J. Alfred Prufrock — T.S. Eliot',
      exact: 'fog asleep excerpt',
      excerpt:
        'Let fall upon its back the soot that falls from chimneys, Slipped by the terrace, made a sudden leap, And seeing that it was a soft October night, Curled once about the house, and fell asleep. And indeed there will be time For the yellow smoke that slides along the street, Rubbing its back upon the window-panes.',
      evidence: ['made a sudden leap', 'Curled once about the house', 'fell asleep', 'Rubbing its back'],
      stem: 'How does the fog “falling asleep” help shape the reader’s understanding of the scene?',
      correct:
        'It makes the city feel quiet but strange, as if the setting itself is alive and watching.',
      distractors: [
        'It shows the speaker has stopped noticing the city and is ready to act.',
        'It proves the weather has disappeared and no longer affects the mood.',
        'It turns the scene into a cheerful description of a peaceful morning.',
      ],
    },
    {
      selection: 'A White Heron — Sarah Orne Jewett',
      exact: 'pine tree climbing excerpt',
      excerpt:
        'The tree seemed to lengthen itself out as she went up, and to reach farther and farther upward. It was like a great main-mast to the voyaging earth; it must truly have been amazed that morning through all its ponderous frame as it felt this determined spark of human spirit creeping and climbing from higher branch to branch.',
      evidence: ['tree seemed to lengthen itself out', 'to reach farther and farther upward', 'must truly have been amazed'],
      stem: 'How does the personification of the tree affect the climbing scene?',
      correct:
        'It makes the tree feel like an active partner in Sylvia’s climb, increasing the wonder of the moment.',
      distractors: [
        'It makes the tree seem dangerous because it is trying to stop Sylvia from climbing.',
        'It shows Sylvia is imagining the tree because the climb is not actually happening.',
        'It removes the natural setting from the scene and focuses only on the hunter.',
      ],
    },
    {
      selection: 'A White Heron — Sarah Orne Jewett',
      exact: 'old pine support excerpt',
      excerpt:
        'Who knows how steadily the least twigs held themselves to advantage this light, weak creature on her way! The old pine must have loved his new dependent. More than all the hawks, and bats, and moths, and even the sweet-voiced thrushes, was the brave, beating heart of the solitary gray-eyed child. And the tree stood still and held away the winds that June morning while the dawn grew bright in the east.',
      evidence: ['twigs held themselves', 'old pine must have loved his new dependent', 'tree stood still and held away the winds'],
      stem: 'How does the personification of the old pine contribute to the excerpt?',
      correct:
        'It suggests nature is protecting Sylvia, making her choice feel connected to the natural world.',
      distractors: [
        'It suggests nature is trying to punish Sylvia for climbing too high.',
        'It shows the tree is unimportant because only the hunter shapes Sylvia’s choice.',
        'It makes the scene purely comic by treating the climb as an accident.',
      ],
    },
    {
      selection: 'The Aeneid — Virgil',
      exact: 'night sky excerpt',
      excerpt:
        'Now had the sun withdrawn his radiant light, And hills were hid in dusky shades of night. Close by the shore we lay; the sailors keep Their watches, and the rest securely sleep. The night, proceeding on with silent pace, Stood in her noon, and view’d with equal face Her steepy rise and her declining race.',
      evidence: ['sun withdrawn his radiant light', 'night, proceeding on with silent pace', 'view’d with equal face'],
      stem: 'How does the personification of night affect the epic setting?',
      correct:
        'It makes night feel controlled and watchful, giving the setting a formal, elevated mood.',
      distractors: [
        'It makes night seem careless and chaotic, proving the sailors cannot continue.',
        'It makes the setting ordinary by removing any sense of movement or presence.',
        'It shifts attention away from the voyage and focuses only on daylight.',
      ],
    },
  ];

  return cards.slice(0, maxRows).map((card, index): PullOutRow => ({
    number: index + 1,
    standard: 'R.3.1',
    subSkillId,
    skillFocus,
    selection: card.selection,
    exactLinesOrParagraphs: card.exact,
    excerpt: card.excerpt,
    whyThisExcerpt: whyThisExcerpt('ELA.9.R.3.1', subSkillId),
    moveStatementTemplate: moveTemplate('ELA.9.R.3.1', subSkillId),
    instructionalSupport: instructionalSupportFor('ELA.9.R.3.1', subSkillId, skillFocus),
    qualityGate: {
      status: 'gold',
      label: 'Gold card',
      checks: [
        'Teach layer pinned',
        'Personification is pointable',
        'Mood or meaning effect is clear',
        'FAST-style check present',
        'Distractors require thinking',
      ],
    },
    teacherTrust: {
      confidence: 'strong',
      officialTextMap: true,
      localSourceText: true,
      excerptWords: wordCount(card.excerpt),
      evidencePoints: card.evidence,
      useCase: '15-minute Promethean figurative-language pull-out',
      whyTrustIt:
        'This card gives students an exact nonhuman/human-action phrase and asks them to explain how it changes mood or meaning.',
    },
    anchorQuestion: {
      stem: card.stem,
      choices: rotateChoices(index, [
        { text: card.correct, correct: true },
        ...card.distractors.map((text) => ({ text, correct: false })),
      ]),
    },
  }));
}

function vocabularyGoldRows(
  standardCode: 'ELA.9.V.1.1' | 'ELA.9.V.1.2' | 'ELA.9.V.1.3',
  maxRows: number,
  requestedSubSkillId?: string | null
): PullOutRow[] {
  const cards: VocabularyGoldCard[] = [
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'tier-two-academic-word',
      skillFocus: 'Academic vocabulary in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 4-14',
      excerpt:
        'Security guard, truck driver, salesperson—year after year, these jobs appear on lists of the unhappiest careers. Although many factors can make a job dismal—unusual hours, low pay, no chance for advancement—these three gigs stand out for another reason: They’re characterized either by a lack of conversation or by obligatory but meaningless small talk. Psychologists have long said that connecting with others is central to well-being, but just how much conversation we require is under investigation.',
      evidence: ['dismal', 'unusual hours, low pay, no chance for advancement', 'unhappiest careers'],
      stem: 'Which meaning of “dismal” best fits the context of this excerpt?',
      correct:
        'Unpleasant or discouraging, because the sentence lists conditions that make the jobs unhappy.',
      distractors: [
        'Rewarding or exciting, because the jobs appear on lists year after year.',
        'Brief or temporary, because the author names several different careers.',
        'Confusing or hidden, because researchers are still studying conversation.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'tier-two-academic-word',
      skillFocus: 'Academic vocabulary in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 20-28',
      excerpt:
        'Researchers eavesdropped on undergraduates for four days, then cataloged each overheard conversation as either “small talk” (“What do you have there? Popcorn? Yummy!”) or “substantive” (“So did they get divorced soon after?”). They found that the second type correlated with happiness—the happiest students had roughly twice as many substantive talks as the unhappiest ones.',
      evidence: ['substantive', 'So did they get divorced soon after?', 'correlated with happiness'],
      stem: 'What does “substantive” mean as it is used in the excerpt?',
      correct:
        'Meaningful and serious, because the example involves a personal topic rather than casual chatter.',
      distractors: [
        'Noisy and public, because the researchers overheard the conversations.',
        'Short and unfinished, because only one example of the talk is shown.',
        'Polite and formal, because the students were speaking with one another.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'tier-two-academic-word',
      skillFocus: 'Academic vocabulary in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 47-56',
      excerpt:
        'Of course, some of us are better than others at turning small talk into something bigger. In one study, people who were rated “less curious” by researchers had trouble getting a conversation rolling on their own, and had greater luck building closeness with others when they were supplied with questions that encouraged personal disclosure. But people who were deemed “curious” needed no help transforming conversations about mundane things like favorite holidays into intimate exchanges.',
      evidence: ['mundane things like favorite holidays', 'intimate exchanges', 'personal disclosure'],
      stem: 'What does “mundane” mean in this context?',
      correct:
        'Ordinary or everyday, because favorite holidays are used as a simple conversation topic.',
      distractors: [
        'Deeply private, because an earlier question asks about crying in front of someone.',
        'Scientific or technical, because researchers rated people in the study.',
        'Angry or insulting, because the conversations involved disclosure.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'tier-two-academic-word',
      skillFocus: 'Academic vocabulary in context',
      selection: 'Industrial Education for the Negro — Booker T. Washington',
      exact: 'education foundation excerpt',
      excerpt:
        'I would not confine the race to industrial life, not even to agriculture, for example, although I believe that by far the greater part of the Negro race is best off in the country districts and must and should continue to live there. But I would teach the race that in industry the foundation must be laid.',
      evidence: ['confine', 'not even to agriculture', 'foundation must be laid'],
      stem: 'Which meaning of “confine” best fits Washington’s point?',
      correct:
        'Limit or restrict, because he says education should not trap students in only one kind of work.',
      distractors: [
        'Praise or honor, because he says industry can be an important foundation.',
        'Ignore or avoid, because he refuses to discuss agriculture or country life.',
        'Measure or count, because he compares different kinds of education.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'tier-two-academic-word',
      skillFocus: 'Academic vocabulary in context',
      selection: 'The Talented Tenth — W.E.B. Du Bois',
      exact: 'opening claim excerpt',
      excerpt:
        'The Negro race, like all races, is going to be saved by its exceptional men. The problem of education, then, among Negroes must first of all deal with the Talented Tenth; it is the problem of developing the best of this race that they may guide the mass away from the contamination and death of the worst.',
      evidence: ['exceptional men', 'developing the best', 'guide the mass'],
      stem: 'What does “exceptional” mean as it is used in this claim?',
      correct:
        'Unusually capable, because Du Bois says these people can be developed to guide others.',
      distractors: [
        'Completely ordinary, because he says they are the same as everyone else.',
        'Physically separated, because he says they should move away from society.',
        'Strictly wealthy, because he says education depends only on money.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'word-family-relationship',
      skillFocus: 'Word family relationship',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 27-39',
      excerpt:
        'Scientists believe that small talk could promote bonding. Late last year, Princeton researchers reported that ring-tailed lemurs reserve their call-and-response conversations, akin to human chitchat, for the animals they groom the most—suggesting that small talk maintains closeness with loved ones, and isn’t merely the stuff of awkward exchanges with strangers.',
      evidence: ['promote bonding', 'maintains closeness', 'conversations'],
      stem: 'Which related word best fits the idea developed by “bonding” in this excerpt?',
      correct:
        'Connection, because the excerpt explains that repeated communication can maintain closeness.',
      distractors: [
        'Isolation, because the excerpt says animals reserve calls for no one.',
        'Competition, because the excerpt says the animals argue for status.',
        'Confusion, because the excerpt says the talk has no social purpose.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'word-family-relationship',
      skillFocus: 'Word family relationship',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 33-40',
      excerpt:
        'Still, bantering with strangers could brighten your morning. In a series of experiments, psychologists gave Chicago commuters varying directions about whether to talk with fellow train passengers—something they typically avoided. Those told to chat with others reported a more pleasant journey than those told to “enjoy your solitude” or to do whatever they normally would.',
      evidence: ['solitude', 'talk with fellow train passengers', 'chat with others'],
      stem: 'Which word from the same word family best matches “solitude” in this context?',
      correct:
        'Solitary, because the comparison is between talking with others and being alone.',
      distractors: [
        'Solid, because the comparison is about how sturdy the train ride was.',
        'Socialize, because the word means the opposite of being alone.',
        'Solution, because the sentence explains how to solve a transit problem.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'word-family-relationship',
      skillFocus: 'Word family relationship',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 47-56',
      excerpt:
        'In one study, people who were rated “less curious” by researchers had trouble getting a conversation rolling on their own, and had greater luck building closeness with others when they were supplied with questions that encouraged personal disclosure. But people who were deemed “curious” needed no help transforming conversations about mundane things like favorite holidays into intimate exchanges.',
      evidence: ['curious', 'curious mindset', 'personal disclosure'],
      stem: 'Which related noun best matches the academic word “curious” in this excerpt?',
      correct:
        'Curiosity, because the passage describes interest that helps people ask better questions.',
      distractors: [
        'Currency, because the passage is about exchanging money during travel.',
        'Correction, because the passage says the researchers punished mistakes.',
        'Courtesy, because the passage focuses only on formal manners.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'word-family-relationship',
      skillFocus: 'Word family relationship',
      selection: 'Industrial Education for the Negro — Booker T. Washington',
      exact: 'education foundation excerpt',
      excerpt:
        'The object of all education is not to make men carpenters, it is to make carpenters men. On such a foundation as this will grow habits of thrift, a love of work, economy, ownership of property, bank accounts.',
      evidence: ['education', 'foundation', 'ownership of property'],
      stem: 'Which related form best fits Washington’s idea about “ownership”?',
      correct:
        'Own, because ownership means having or controlling property rather than merely using it.',
      distractors: [
        'Owe, because ownership means being unable to pay for property.',
        'Only, because ownership means choosing a single trade to study.',
        'Open, because ownership means leaving property available to everyone.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'word-family-relationship',
      skillFocus: 'Word family relationship',
      selection: 'The Talented Tenth — W.E.B. Du Bois',
      exact: 'education claim excerpt',
      excerpt:
        'The problem of education, then, among Negroes must first of all deal with the Talented Tenth; it is the problem of developing the best of this race that they may guide the mass away from the contamination and death of the worst.',
      evidence: ['education', 'developing the best', 'guide the mass'],
      stem: 'Which related verb best fits the meaning of “developing” in this excerpt?',
      correct:
        'Develop, because Du Bois is describing how education can build people’s ability to lead.',
      distractors: [
        'Delay, because Du Bois is arguing that education should be postponed.',
        'Deliver, because Du Bois is focusing on physically moving people somewhere.',
        'Divide, because Du Bois is explaining how to separate schools from leaders.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'academic-tone-precision',
      skillFocus: 'Academic tone and precision',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 20-32',
      excerpt:
        'Researchers eavesdropped on undergraduates for four days, then cataloged each overheard conversation as either “small talk” or “substantive.” They found that the second type correlated with happiness—the happiest students had roughly twice as many substantive talks as the unhappiest ones. Small talk, meanwhile, made up only 10 percent of their conversation, versus almost 30 percent of conversation among the least content students.',
      evidence: ['cataloged', 'correlated', 'roughly twice as many'],
      stem: 'Which replacement keeps the most precise academic meaning of “correlated”?',
      correct:
        'Was associated with, because the researchers found a relationship between conversation type and happiness.',
      distractors: [
        'Caused directly, because the excerpt proves every conversation produced happiness.',
        'Was ignored by, because the researchers did not track conversation type.',
        'Was confused with, because the researchers could not separate the two types.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'academic-tone-precision',
      skillFocus: 'Academic tone and precision',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 33-40',
      excerpt:
        'In a series of experiments, psychologists gave Chicago commuters varying directions about whether to talk with fellow train passengers—something they typically avoided. Those told to chat with others reported a more pleasant journey than those told to “enjoy your solitude” or to do whatever they normally would. None of the chatters reported being rebuffed.',
      evidence: ['experiments', 'reported', 'typically avoided', 'rebuffed'],
      stem: 'Which word best preserves the academic tone of “reported” in this excerpt?',
      correct:
        'Stated, because the sentence describes what participants communicated as a result.',
      distractors: [
        'Bragged, because the sentence suggests the participants were showing off.',
        'Whined, because the sentence suggests the participants were complaining.',
        'Gossiped, because the sentence suggests the participants spread rumors.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'academic-tone-precision',
      skillFocus: 'Academic tone and precision',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 41-46',
      excerpt:
        'Small talk can also help us feel connected to our surroundings. People who smiled at, made eye contact with, and briefly spoke with their Starbucks baristas reported a greater sense of belonging than those who rushed through the transaction. Similarly, one not yet published paper found that when volunteers broke the silence of the Tate Modern to chat with gallerygoers, the visitors felt happier and more connected to the exhibit than those who were not approached.',
      evidence: ['sense of belonging', 'transaction', 'exhibit'],
      stem: 'Which word best keeps the precise meaning of “transaction” in this context?',
      correct:
        'Exchange, because the sentence describes a brief interaction between customers and baristas.',
      distractors: [
        'Argument, because the sentence describes people disagreeing with baristas.',
        'Performance, because the sentence describes actors speaking to an audience.',
        'Experiment, because the sentence describes the result of one study.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'academic-tone-precision',
      skillFocus: 'Academic tone and precision',
      selection: 'Industrial Education for the Negro — Booker T. Washington',
      exact: 'education foundation excerpt',
      excerpt:
        'The object of all education is not to make men carpenters, it is to make carpenters men. On such a foundation as this will grow habits of thrift, a love of work, economy, ownership of property, bank accounts.',
      evidence: ['object of all education', 'foundation', 'habits of thrift'],
      stem: 'Which word best preserves the academic meaning of “foundation” in this excerpt?',
      correct:
        'Basis, because Washington describes the starting support on which later habits can grow.',
      distractors: [
        'Decoration, because Washington describes something added only for appearance.',
        'Conclusion, because Washington describes the final result after all growth ends.',
        'Distraction, because Washington describes something that interrupts education.',
      ],
    },
    {
      standard: 'ELA.9.V.1.1',
      subSkillId: 'academic-tone-precision',
      skillFocus: 'Academic tone and precision',
      selection: 'The Talented Tenth — W.E.B. Du Bois',
      exact: 'education claim excerpt',
      excerpt:
        'The problem of education, then, among Negroes must first of all deal with the Talented Tenth; it is the problem of developing the best of this race that they may guide the mass away from the contamination and death of the worst.',
      evidence: ['developing the best', 'guide the mass', 'contamination'],
      stem: 'Which word best matches the academic meaning of “guide” in this excerpt?',
      correct:
        'Lead, because Du Bois describes educated people helping direct the progress of others.',
      distractors: [
        'Hide, because Du Bois describes keeping educated people away from others.',
        'Follow, because Du Bois says leaders should be directed by the mass.',
        'Measure, because Du Bois is focused on counting students in schools.',
      ],
    },
    {
      standard: 'ELA.9.V.1.2',
      subSkillId: 'prefix-root-suffix',
      skillFocus: 'Word parts in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 4-14',
      excerpt:
        'Security guard, truck driver, salesperson—year after year, these jobs appear on lists of the unhappiest careers. Although many factors can make a job dismal—unusual hours, low pay, no chance for advancement—these three gigs stand out for another reason: They’re characterized either by a lack of conversation or by obligatory but meaningless small talk. Psychologists have long said that connecting with others is central to well-being, but just how much conversation we require is under investigation. In one study, college students who had substantive conversations were more content than their peers who exchanged mere pleasantries.',
      evidence: ['meaningless small talk', 'lack of conversation', 'obligatory', 'substantive conversations'],
      stem: 'How does the suffix in “meaningless” help clarify the author’s point about some small talk?',
      correct:
        'The suffix -less means “without,” so the word suggests that some required small talk lacks real value or purpose.',
      distractors: [
        'The suffix -less means “full of,” so the word suggests small talk is full of hidden meaning.',
        'The suffix -ness names a quality, so the word means small talk is a serious career skill.',
        'The suffix changes the word into a person, so the word describes someone who avoids conversation.',
      ],
    },
    {
      standard: 'ELA.9.V.1.2',
      subSkillId: 'prefix-root-suffix',
      skillFocus: 'Word parts in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 20-32',
      excerpt:
        'Researchers eavesdropped on undergraduates for four days, then cataloged each overheard conversation as either “small talk” (“What do you have there? Popcorn? Yummy!”) or “substantive” (“So did they get divorced soon after?”). They found that the second type correlated with happiness—the happiest students had roughly twice as many substantive talks as the unhappiest ones. Small talk, meanwhile, made up only 10 percent of their conversation, versus almost 30 percent of conversation among the least content students. But don’t write off chitchat just yet.',
      evidence: ['substantive', 'the second type correlated with happiness', 'twice as many substantive talks'],
      stem: 'How does the word part in “substantive” help the reader understand the kind of conversation being described?',
      correct:
        'The word relates to “substance,” so it describes conversations with real content rather than empty exchanges.',
      distractors: [
        'The word relates to “substitute,” so it describes conversations that replace happiness.',
        'The word part sub- means “under,” so it describes conversations that are hidden or secret.',
        'The ending -ive means “against,” so it describes conversations that create conflict.',
      ],
    },
    {
      standard: 'ELA.9.V.1.2',
      subSkillId: 'prefix-root-suffix',
      skillFocus: 'Word parts in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 27-39',
      excerpt:
        'Scientists believe that small talk (which linguists describe as a form of “phatic communication”) could promote bonding. Late last year, Princeton researchers reported that ring-tailed lemurs reserve their call-and-response conversations, akin to human chitchat, for the animals they groom the most—suggesting that small talk maintains closeness with loved ones, and isn’t merely the stuff of awkward exchanges with strangers. Still, bantering with strangers could brighten your morning. In a series of experiments, psychologists gave Chicago commuters varying directions about whether to talk with fellow train passengers—something they typically avoided.',
      evidence: ['communication', 'promote bonding', 'maintains closeness', 'call-and-response conversations'],
      stem: 'How does the word part in “communication” support the meaning of the sentence?',
      correct:
        'The word is connected to sharing or exchanging, which fits the idea of call-and-response talk that builds closeness.',
      distractors: [
        'The word means silence, which fits the idea that people avoid speaking to each other.',
        'The word means punishment, which fits the idea that small talk harms relationships.',
        'The word means travel, which fits the commuters riding with strangers.',
      ],
    },
    {
      standard: 'ELA.9.V.1.2',
      subSkillId: 'prefix-root-suffix',
      skillFocus: 'Word parts in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 33-40',
      excerpt:
        'Still, bantering with strangers could brighten your morning. In a series of experiments, psychologists gave Chicago commuters varying directions about whether to talk with fellow train passengers—something they typically avoided. Those told to chat with others reported a more pleasant journey than those told to “enjoy your solitude” or to do whatever they normally would. None of the chatters reported being rebuffed. And the results held for introverts and extroverts alike—which makes sense, since acting extroverted has a positive effect on introverts.',
      evidence: ['introverts and extroverts alike', 'acting extroverted', 'talk with fellow train passengers'],
      stem: 'How do the word parts in “introverts” and “extroverts” help clarify the research result?',
      correct:
        'The parts suggest inward-turned and outward-turned people, so the result applies to both quieter and more outgoing commuters.',
      distractors: [
        'The parts suggest older and younger people, so the result is mainly about age differences.',
        'The parts suggest wealthy and poor people, so the result is mainly about income.',
        'The parts suggest people traveling in opposite directions, so the result is about train routes.',
      ],
    },
    {
      standard: 'ELA.9.V.1.2',
      subSkillId: 'prefix-root-suffix',
      skillFocus: 'Word parts in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 47-56',
      excerpt:
        'Of course, some of us are better than others at turning small talk into something bigger. In one study, people who were rated “less curious” by researchers had trouble getting a conversation rolling on their own, and had greater luck building closeness with others when they were supplied with questions that encouraged personal disclosure (“When did you last cry in front of someone?”). But people who were deemed “curious” needed no help transforming conversations about mundane things like favorite holidays into intimate exchanges. A “curious mindset,” the authors concluded, can lead to “positive social interactions.”',
      evidence: ['personal disclosure', 'building closeness', 'intimate exchanges', 'positive social interactions'],
      stem: 'How does the word part in “disclosure” help explain what the supplied questions encouraged?',
      correct:
        'The word suggests opening or revealing, which fits questions that lead people to share personal information.',
      distractors: [
        'The word suggests closing off, which fits people refusing to answer personal questions.',
        'The word suggests counting, which fits researchers measuring the number of conversations.',
        'The word suggests traveling, which fits people moving from one conversation to another.',
      ],
    },
    {
      standard: 'ELA.9.V.1.3',
      subSkillId: 'context-clues',
      skillFocus: 'Word or phrase meaning in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 4-14',
      excerpt:
        'Security guard, truck driver, salesperson—year after year, these jobs appear on lists of the unhappiest careers. Although many factors can make a job dismal—unusual hours, low pay, no chance for advancement—these three gigs stand out for another reason: They’re characterized either by a lack of conversation or by obligatory but meaningless small talk. Psychologists have long said that connecting with others is central to well-being, but just how much conversation we require is under investigation. In one study, college students who had substantive conversations were more content than their peers who exchanged mere pleasantries.',
      evidence: ['unhappiest careers', 'unusual hours, low pay, no chance for advancement', 'dismal'],
      stem: 'What does “dismal” mean as it is used in this excerpt?',
      correct:
        'Unpleasant or discouraging, because the sentence lists conditions that make the jobs unhappy.',
      distractors: [
        'Popular or rewarding, because the jobs appear on lists year after year.',
        'Confusing or mysterious, because researchers are still studying conversation.',
        'Temporary or brief, because the author mentions several different careers.',
      ],
    },
    {
      standard: 'ELA.9.V.1.3',
      subSkillId: 'context-clues',
      skillFocus: 'Word or phrase meaning in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 20-28',
      excerpt:
        'Researchers eavesdropped on undergraduates for four days, then cataloged each overheard conversation as either “small talk” (“What do you have there? Popcorn? Yummy!”) or “substantive” (“So did they get divorced soon after?”). They found that the second type correlated with happiness—the happiest students had roughly twice as many substantive talks as the unhappiest ones. Small talk, meanwhile, made up only 10 percent of their conversation, versus almost 30 percent of conversation among the least content students. But don’t write off chitchat just yet.',
      evidence: ['Popcorn? Yummy!', 'So did they get divorced soon after?', 'substantive talks'],
      stem: 'What does “substantive” mean in this context?',
      correct:
        'Meaningful or serious, because the example focuses on an important personal topic rather than casual remarks.',
      distractors: [
        'Loud or public, because the researchers overheard the conversations.',
        'Short or unfinished, because the author gives only one example of the talk.',
        'Polite or formal, because the students were speaking with one another.',
      ],
    },
    {
      standard: 'ELA.9.V.1.3',
      subSkillId: 'context-clues',
      skillFocus: 'Word or phrase meaning in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 33-40',
      excerpt:
        'Still, bantering with strangers could brighten your morning. In a series of experiments, psychologists gave Chicago commuters varying directions about whether to talk with fellow train passengers—something they typically avoided. Those told to chat with others reported a more pleasant journey than those told to “enjoy your solitude” or to do whatever they normally would. None of the chatters reported being rebuffed. And the results held for introverts and extroverts alike—which makes sense, since acting extroverted has a positive effect on introverts.',
      evidence: ['Those told to chat with others reported a more pleasant journey', 'None of the chatters reported being rebuffed'],
      stem: 'What does “rebuffed” mean as it is used in this excerpt?',
      correct:
        'Rejected or turned away, because the sentence says none of the people who tried to chat had that happen.',
      distractors: [
        'Delayed or made late, because the people were riding trains.',
        'Entertained or amused, because the journeys were more pleasant.',
        'Observed or recorded, because the experiment involved researchers.',
      ],
    },
    {
      standard: 'ELA.9.V.1.3',
      subSkillId: 'context-clues',
      skillFocus: 'Word or phrase meaning in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 41-46',
      excerpt:
        'Small talk can also help us feel connected to our surroundings. People who smiled at, made eye contact with, and briefly spoke with their Starbucks baristas reported a greater sense of belonging than those who rushed through the transaction. Similarly, one not yet published paper found that when volunteers broke the silence of the Tate Modern to chat with gallerygoers, the visitors felt happier and more connected to the exhibit than those who were not approached.',
      evidence: ['feel connected to our surroundings', 'greater sense of belonging', 'felt happier and more connected'],
      stem: 'What does “sense of belonging” mean in this context?',
      correct:
        'A feeling of being connected or included in a place or group.',
      distractors: [
        'A feeling of being rushed because a task must be finished quickly.',
        'A feeling of being observed because strangers are watching closely.',
        'A feeling of being corrected because a study changed someone’s behavior.',
      ],
    },
    {
      standard: 'ELA.9.V.1.3',
      subSkillId: 'context-clues',
      skillFocus: 'Word or phrase meaning in context',
      selection: 'Do People Need Small Talk to Be Happy? — Stephanie Hayes',
      exact: 'lines 47-56',
      excerpt:
        'Of course, some of us are better than others at turning small talk into something bigger. In one study, people who were rated “less curious” by researchers had trouble getting a conversation rolling on their own, and had greater luck building closeness with others when they were supplied with questions that encouraged personal disclosure (“When did you last cry in front of someone?”). But people who were deemed “curious” needed no help transforming conversations about mundane things like favorite holidays into intimate exchanges. A “curious mindset,” the authors concluded, can lead to “positive social interactions.”',
      evidence: ['mundane things like favorite holidays', 'intimate exchanges', 'personal disclosure'],
      stem: 'What does “mundane” mean as it is used in this excerpt?',
      correct:
        'Ordinary or everyday, because favorite holidays are given as an example of a simple conversation topic.',
      distractors: [
        'Deeply private, because the previous question asks about crying in front of someone.',
        'Scientific or technical, because researchers rated the people in the study.',
        'Angry or insulting, because the conversations required personal disclosure.',
      ],
    },
  ];

  return cards
    .filter((card) => card.standard === standardCode)
    .filter((card) => !requestedSubSkillId || card.subSkillId === requestedSubSkillId)
    .slice(0, maxRows)
    .map((card, index): PullOutRow => ({
      number: index + 1,
      standard: standardCode.replace('ELA.9.', ''),
      subSkillId: card.subSkillId,
      skillFocus: card.skillFocus,
      selection: card.selection,
      exactLinesOrParagraphs: card.exact,
      excerpt: card.excerpt,
      whyThisExcerpt: whyThisExcerpt(standardCode, card.subSkillId),
      moveStatementTemplate: moveTemplate(standardCode, card.subSkillId),
      instructionalSupport: instructionalSupportFor(standardCode, card.subSkillId, card.skillFocus),
      qualityGate: {
        status: 'gold',
        label: 'Gold card',
        checks: [
          'Target word pinned',
          'Context is long enough to teach',
          'Evidence clue is pointable',
          'FAST-style vocabulary check present',
          'Distractors require context, not guessing',
        ],
      },
      teacherTrust: {
        confidence: 'strong',
        officialTextMap: true,
        localSourceText: true,
        excerptWords: wordCount(card.excerpt),
        evidencePoints: card.evidence,
        useCase: '15-minute Promethean vocabulary-in-context pull-out',
        whyTrustIt:
          'This card gives enough surrounding context for students to prove the word meaning from evidence instead of guessing from an isolated sentence.',
      },
      anchorQuestion: {
        stem: card.stem,
        choices: rotateChoices(index, [
          { text: card.correct, correct: true },
          ...card.distractors.map((text) => ({ text, correct: false })),
        ], { balanceLengths: false }),
      },
    }));
}

function excerptAroundSignals(raw: string, signals: RegExp[], options: { before?: number; after?: number } = {}) {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const allSentences = sentences(normalized);
  const hitIndex = allSentences.findIndex((sentence) => signals.some((signal) => signal.test(sentence)));
  if (hitIndex < 0) return null;
  const start = Math.max(0, hitIndex - (options.before ?? 1));
  const end = Math.min(allSentences.length, hitIndex + (options.after ?? 1) + 1);
  const excerpt = allSentences.slice(start, end).join(' ').replace(/\s+/g, ' ').trim();
  const words = wordCount(excerpt);
  if (words < 25 || words > 180) return null;
  return excerpt;
}

async function r34PremiumCardsFromSources(sourceEntries: ManifestEntry[]): Promise<R34GoldCard[]> {
  const specs: Array<{
    title: RegExp;
    exact: string;
    signals: RegExp[];
    evidence: string[];
    stem: string;
    correct: string;
    distractors: string[];
  }> = [
    {
      title: /^I Have a Dream$/i,
      exact: 'manual upload: dream/character excerpt',
      signals: [/I have a dream/i, /content of their character/i],
      evidence: ['I have a dream', 'little children', 'content of their character'],
      stem: 'How does King’s repeated “I have a dream” language affect the audience?',
      correct:
        'It turns his vision into a memorable hope, helping listeners imagine a more just future.',
      distractors: [
        'It makes the speech feel uncertain by suggesting the speaker has no clear goal.',
        'It shifts attention away from justice and focuses only on the speaker’s private life.',
        'It weakens the speech by repeating a phrase without building toward a larger idea.',
      ],
    },
    {
      title: /^Letter from Birmingham Jail$/i,
      exact: 'manual upload: justice network excerpt',
      signals: [/Injustice anywhere/i, /threat to justice everywhere/i, /inescapable network/i],
      evidence: ['Injustice anywhere', 'justice everywhere', 'inescapable network'],
      stem: 'How does King’s connected-image language affect the reader?',
      correct:
        'It makes injustice feel shared and urgent, pushing the reader to see local harm as everyone’s concern.',
      distractors: [
        'It makes injustice seem isolated, so readers can ignore problems outside their own city.',
        'It turns the letter into a private complaint with no connection to a larger audience.',
        'It suggests justice is mostly a legal detail rather than a moral responsibility.',
      ],
    },
    {
      title: /^Speech to the Troops at Tilbury$/i,
      exact: 'manual upload: body/king excerpt',
      signals: [/weak and feeble woman/i, /heart and stomach of a king/i],
      evidence: ['weak and feeble woman', 'heart and stomach of a king', 'my people'],
      stem: 'How does Queen Elizabeth’s contrast between body and heart affect her audience?',
      correct:
        'It turns a possible weakness into courage, encouraging the troops to trust her leadership.',
      distractors: [
        'It makes her seem uncertain by emphasizing that she is unable to lead in danger.',
        'It shifts the speech away from leadership and focuses only on her physical appearance.',
        'It tells the troops that courage matters less than rank, wealth, or inheritance.',
      ],
    },
    {
      title: /^The Danger of a Single Story$/i,
      exact: 'manual upload: single-story warning excerpt',
      signals: [/single story/i, /show a people as one thing/i, /only one story/i],
      evidence: ['single story', 'one thing', 'again and again'],
      stem: 'How does Adichie’s repeated phrase “single story” affect the reader?',
      correct:
        'It focuses the reader on how repeated narrow stories can distort understanding of people.',
      distractors: [
        'It suggests one story is usually enough to understand a culture completely.',
        'It shifts the talk away from perspective and focuses only on childhood memories.',
        'It argues that stories are dangerous because they should be avoided entirely.',
      ],
    },
  ];

  const cards: R34GoldCard[] = [];
  for (const spec of specs) {
    const entry = sourceEntries.find((item) => spec.title.test(item.title) && hasReadableSourceText(item));
    if (!entry) continue;
    const raw = await readSourceText(entry);
    const excerpt = excerptAroundSignals(raw, spec.signals);
    if (!excerpt) continue;
    cards.push({
      skillFocus: 'Rhetoric and reader effect',
      selection: `${entry.title}${entry.author ? ` — ${entry.author}` : ''}`,
      exact: spec.exact,
      excerpt,
      evidence: spec.evidence,
      stem: spec.stem,
      correct: spec.correct,
      distractors: spec.distractors,
    });
  }
  return cards;
}

function r32GoldRows(maxRows: number, requestedSubSkillId?: string | null): PullOutRow[] {
  const cards: R32GoldCard[] = [
    {
      subSkillId: 'chunk-complex-syntax',
      skillFocus: 'Chunk complex syntax',
      selection: 'A Modest Proposal — Jonathan Swift',
      exact: 'paragraph 14',
      excerpt:
        'I have been assured by a very knowing American of my acquaintance in London, that a young healthy child well nursed is, at a year old, a most delicious nourishing and wholesome food, whether stewed, roasted, baked, or boiled. I make no doubt that it will equally serve in a fricassee, or a ragout.',
      evidence: [
        'I have been assured by a very knowing American',
        'a young healthy child well nursed is, at a year old',
        'a most delicious nourishing and wholesome food',
      ],
      stem: 'Which option best paraphrases the full sentence without losing any key idea?',
      correct:
        'The speaker says a supposedly knowledgeable American told him that a healthy one-year-old child could be treated as food.',
      distractors: [
        'The speaker says an American acquaintance gave advice about feeding poor children, but not about using them as food.',
        'The speaker says healthy one-year-old children need nourishing meals prepared in several different ways.',
        'The speaker says people in London should nurse young children carefully before sending them away.',
      ],
    },
    {
      subSkillId: 'chunk-complex-syntax',
      skillFocus: 'Chunk complex syntax',
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'house divided excerpt',
      excerpt:
        'A house divided against itself cannot stand. I believe this government cannot endure, permanently half slave and half free. I do not expect the Union to be dissolved; I do not expect the house to fall; but I do expect it will cease to be divided.',
      evidence: [
        'cannot endure, permanently half slave and half free',
        'I do not expect the Union to be dissolved',
        'I do expect it will cease to be divided',
      ],
      stem: 'Which option best paraphrases Lincoln’s full point across these sentences?',
      correct:
        'Lincoln believes the nation will survive, but it cannot permanently remain split between slavery and freedom.',
      distractors: [
        'Lincoln believes the nation will immediately break apart because no compromise is possible.',
        'Lincoln believes slavery and freedom can continue together without changing the country.',
        'Lincoln believes the states should avoid discussing slavery to keep the Union peaceful.',
      ],
    },
    {
      subSkillId: 'chunk-complex-syntax',
      skillFocus: 'Chunk complex syntax',
      selection: 'The Talented Tenth — W.E.B. Du Bois',
      exact: 'opening claim excerpt',
      excerpt:
        'The Negro race, like all races, is going to be saved by its exceptional men. The problem of education, then, among Negroes must first of all deal with the Talented Tenth.',
      evidence: [
        'like all races',
        'saved by its exceptional men',
        'education... must first of all deal with the Talented Tenth',
      ],
      stem: 'Which option best paraphrases Du Bois’s claim in this excerpt?',
      correct:
        'Du Bois argues that education should first develop highly capable leaders who can help lift the race.',
      distractors: [
        'Du Bois argues that only a small group deserves education and everyone else should be ignored.',
        'Du Bois argues that all social problems can be solved without education.',
        'Du Bois argues that leadership matters less than job training for every student.',
      ],
    },
    {
      subSkillId: 'chunk-complex-syntax',
      skillFocus: 'Chunk complex syntax',
      selection: 'Industrial Education for the Negro — Booker T. Washington',
      exact: 'education purpose excerpt',
      excerpt:
        'I would not confine the race to industrial life, not even to agriculture, for example, although I believe that by far the greater part of the Negro race is best off in the country districts and must and should continue to live there. But I would teach the race that in industry the foundation must be laid.',
      evidence: [
        'I would not confine the race to industrial life',
        'although I believe',
        'best off in the country districts',
      ],
      stem: 'Which option best paraphrases Washington’s full sentence without losing the contrast?',
      correct:
        'Washington says Black people should not be limited to industrial or farm work, even though many may benefit from rural life.',
      distractors: [
        'Washington says Black people should be trained only for agriculture because industrial life has no value.',
        'Washington says rural districts should be avoided because they cannot support meaningful work.',
        'Washington says education should ignore work entirely and focus only on college study.',
      ],
    },
    {
      subSkillId: 'chunk-complex-syntax',
      skillFocus: 'Chunk complex syntax',
      selection: 'A White Heron — Sarah Orne Jewett',
      exact: 'choice excerpt',
      excerpt:
        'No, she must keep silence! What is it that suddenly forbids her and makes her dumb? Has she been nine years growing and now, when the great world for the first time puts out a hand to her, must she thrust it aside for a bird’s sake?',
      evidence: [
        'she must keep silence',
        'the great world... puts out a hand to her',
        'thrust it aside for a bird’s sake',
      ],
      stem: 'Which option best paraphrases Sylvia’s conflict in this excerpt?',
      correct:
        'Sylvia realizes she must stay silent and give up a tempting opportunity in order to protect the bird.',
      distractors: [
        'Sylvia realizes the bird has already escaped and no decision remains.',
        'Sylvia decides to tell the hunter everything because the world is rewarding her.',
        'Sylvia cannot answer because she does not understand what the hunter asked.',
      ],
    },
    {
      subSkillId: 'preserve-original-meaning',
      skillFocus: 'Preserve original meaning',
      selection: 'Romeo and Juliet — William Shakespeare',
      exact: 'balcony excerpt',
      excerpt:
        'Although I joy in thee, I have no joy of this contract tonight: It is too rash, too unadvised, too sudden; Too like the lightning, which doth cease to be Ere one can say “It lightens.” Sweet, good night!',
      evidence: [
        'too rash, too unadvised, too sudden',
        'Too like the lightning',
        'cease to be',
      ],
      stem: 'Which paraphrase best preserves Juliet’s meaning?',
      correct:
        'Juliet worries that their love is moving too quickly and may disappear as suddenly as lightning.',
      distractors: [
        'Juliet believes their love is careful, slow, and certain to last forever.',
        'Juliet thinks lightning proves that Romeo should leave immediately.',
        'Juliet says she no longer loves Romeo because the night is stormy.',
      ],
    },
    {
      subSkillId: 'preserve-original-meaning',
      skillFocus: 'Preserve original meaning',
      selection: 'A White Heron — Sarah Orne Jewett',
      exact: 'choice excerpt',
      excerpt:
        'No, she must keep silence! What is it that suddenly forbids her and makes her dumb? Has she been nine years growing and now, when the great world for the first time puts out a hand to her, must she thrust it aside for a bird’s sake?',
      evidence: ['No, she must keep silence', 'suddenly forbids her', 'makes her dumb'],
      stem: 'Which paraphrase best preserves the meaning of this moment?',
      correct:
        'Sylvia feels that something inside her prevents her from revealing what she knows.',
      distractors: [
        'Sylvia is silent because she has forgotten the answer.',
        'Sylvia refuses to speak because she wants to embarrass the hunter.',
        'Sylvia is unable to speak because no one has asked her a question.',
      ],
    },
    {
      subSkillId: 'preserve-original-meaning',
      skillFocus: 'Preserve original meaning',
      selection: 'A Modest Proposal — Jonathan Swift',
      exact: 'closing motive excerpt',
      excerpt:
        'I have no other motive than the publick good of my country, by advancing our trade, providing for infants, relieving the poor, and giving some pleasure to the rich. I have no children, by which I can propose to get a single penny.',
      evidence: ['no other motive', 'publick good of my country', 'relieving the poor'],
      stem: 'Which paraphrase best preserves the speaker’s stated motive?',
      correct:
        'The speaker claims his only purpose is to help the country by improving trade and addressing poverty.',
      distractors: [
        'The speaker admits that his main goal is to gain money and political power.',
        'The speaker says trade should be ignored because poverty is the only issue.',
        'The speaker argues that rich people should solve the problem without government action.',
      ],
    },
    {
      subSkillId: 'preserve-original-meaning',
      skillFocus: 'Preserve original meaning',
      selection: 'The Prince — Niccolò Machiavelli',
      exact: 'security excerpt',
      excerpt:
        'A prince ought to have no other aim or thought, nor select anything else for his study, than war and its rules and discipline. This is the sole art that belongs to him who rules, and it is of such force that it not only upholds those who are born princes, but often enables men to rise from a private station to that rank.',
      evidence: ['no other aim or thought', 'war and its rules and discipline'],
      stem: 'Which paraphrase best preserves Machiavelli’s meaning?',
      correct:
        'Machiavelli argues that a ruler should focus above all on war, military rules, and discipline.',
      distractors: [
        'Machiavelli argues that a ruler should avoid military matters whenever possible.',
        'Machiavelli argues that war is less important than entertainment and wealth.',
        'Machiavelli argues that only soldiers, not rulers, should study discipline.',
      ],
    },
    {
      subSkillId: 'preserve-original-meaning',
      skillFocus: 'Preserve original meaning',
      selection: 'The Love Song of J. Alfred Prufrock — T.S. Eliot',
      exact: 'self-doubt excerpt',
      excerpt:
        'And indeed there will be time To wonder, “Do I dare?” and, “Do I dare?” Time to turn back and descend the stair. Do I dare Disturb the universe? In a minute there is time For decisions and revisions which a minute will reverse.',
      evidence: ['Do I dare', 'decisions and revisions', 'a minute will reverse'],
      stem: 'Which paraphrase best preserves the speaker’s uncertainty?',
      correct:
        'The speaker hesitates because even small choices feel important and changeable to him.',
      distractors: [
        'The speaker is confident because he knows every decision will be permanent.',
        'The speaker is angry because other people refuse to let him make choices.',
        'The speaker is describing astronomy rather than his own hesitation.',
      ],
    },
    {
      subSkillId: 'translate-archaic-or-formal-language',
      skillFocus: 'Translate archaic or formal language',
      selection: 'Romeo and Juliet — William Shakespeare',
      exact: 'balcony excerpt',
      excerpt:
        'O Romeo, Romeo! wherefore art thou Romeo? Deny thy father and refuse thy name; Or, if thou wilt not, be but sworn my love, And I’ll no longer be a Capulet. ’Tis but thy name that is my enemy.',
      evidence: ['Deny thy father', 'refuse thy name', 'I’ll no longer be a Capulet'],
      stem: 'What is the best plain-language paraphrase of Juliet’s words?',
      correct:
        'Juliet wishes Romeo could reject his family name, or she could give up hers if he loves her.',
      distractors: [
        'Juliet asks Romeo to introduce her to his father before they speak again.',
        'Juliet says their family names make no difference and should be celebrated.',
        'Juliet tells Romeo she will stop loving him unless he becomes a Capulet.',
      ],
    },
    {
      subSkillId: 'translate-archaic-or-formal-language',
      skillFocus: 'Translate archaic or formal language',
      selection: 'St. Crispin’s Day Speech — William Shakespeare',
      exact: 'brotherhood excerpt',
      excerpt:
        'This day is called the feast of Crispian. He that outlives this day, and comes safe home, Will stand a tip-toe when this day is named. We few, we happy few, we band of brothers; For he to-day that sheds his blood with me Shall be my brother.',
      evidence: ['We few', 'band of brothers', 'sheds his blood with me'],
      stem: 'What is the best modern paraphrase of this formal language?',
      correct:
        'The king says the small group of soldiers will be bonded like brothers through shared sacrifice.',
      distractors: [
        'The king says only biological brothers should fight in the battle.',
        'The king says the army is too small to have any honor or unity.',
        'The king says the soldiers should leave because bloodshed has no meaning.',
      ],
    },
    {
      subSkillId: 'translate-archaic-or-formal-language',
      skillFocus: 'Translate archaic or formal language',
      selection: 'The Aeneid — Virgil',
      exact: 'opening excerpt',
      excerpt:
        'Arms, and the man I sing, who, forc’d by fate, And haughty Juno’s unrelenting hate, Expell’d and exil’d, left the Trojan shore. Long labours, both by sea and land, he bore, And in the doubtful war, before he won The Latian realm, and built the destin’d town.',
      evidence: ['Arms, and the man I sing', 'forc’d by fate', 'Expell’d and exil’d'],
      stem: 'What is the best plain-language paraphrase of this opening?',
      correct:
        'The speaker will tell about war and a man forced by fate and Juno’s hatred to leave Troy.',
      distractors: [
        'The speaker will explain how Juno rescued a man from war and brought him home.',
        'The speaker will describe a peaceful journey with no conflict or divine influence.',
        'The speaker will argue that fate has no effect on the man’s exile.',
      ],
    },
    {
      subSkillId: 'translate-archaic-or-formal-language',
      skillFocus: 'Translate archaic or formal language',
      selection: 'Electra — Sophocles',
      exact: 'agreement excerpt',
      excerpt:
        'I would thou didst the like: though I must own The right is on thy side, and not on mine. But if I must not seem to fail in this, I will not cease to mourn my father’s wrongs.',
      evidence: ['I would thou didst the like', 'The right is on thy side'],
      stem: 'What is the best plain-language paraphrase of this statement?',
      correct:
        'The speaker wishes the other person would act similarly, while admitting the other person is right.',
      distractors: [
        'The speaker says the other person is completely wrong and should be punished.',
        'The speaker refuses to admit any fault or agreement.',
        'The speaker says both people have the same opinion and no conflict remains.',
      ],
    },
    {
      subSkillId: 'translate-archaic-or-formal-language',
      skillFocus: 'Translate archaic or formal language',
      selection: 'A Modest Proposal — Jonathan Swift',
      exact: 'formal motive excerpt',
      excerpt:
        'I profess in the sincerity of my heart that I have not the least personal interest in endeavouring to promote this necessary work. I have no children, by which I can propose to get a single penny; the youngest being nine years old, and my wife past child-bearing.',
      evidence: ['profess in the sincerity of my heart', 'not the least personal interest', 'necessary work'],
      stem: 'What is the best plain-language paraphrase of this formal statement?',
      correct:
        'The speaker claims sincerely that he is not trying to benefit personally from his proposal.',
      distractors: [
        'The speaker admits openly that the proposal is meant to make him rich.',
        'The speaker says the work is unnecessary and should not be promoted.',
        'The speaker refuses to explain whether he has any personal interest.',
      ],
    },
    {
      subSkillId: 'paraphrase-claim-or-theme',
      skillFocus: 'Paraphrase claim or theme',
      selection: 'A White Heron — Sarah Orne Jewett',
      exact: 'choice excerpt',
      excerpt:
        'No, she must keep silence! What is it that suddenly forbids her and makes her dumb? Has she been nine years growing and now, when the great world for the first time puts out a hand to her, must she thrust it aside for a bird’s sake?',
      evidence: ['she must keep silence', 'the great world... puts out a hand', 'for a bird’s sake'],
      stem: 'Which statement best paraphrases the larger idea in this excerpt?',
      correct:
        'Sylvia chooses loyalty to nature even though speaking would give her a chance at reward and connection.',
      distractors: [
        'Sylvia chooses the hunter’s reward because it matters more than the bird.',
        'Sylvia stays silent because she does not understand what is happening.',
        'Sylvia learns that the outside world has no power to tempt her.',
      ],
    },
    {
      subSkillId: 'paraphrase-claim-or-theme',
      skillFocus: 'Paraphrase claim or theme',
      selection: 'The Talented Tenth — W.E.B. Du Bois',
      exact: 'central claim excerpt',
      excerpt:
        'The Negro race, like all races, is going to be saved by its exceptional men. The problem of education, then, among Negroes must first of all deal with the Talented Tenth; it is the problem of developing the best of this race that they may guide the mass away from the contamination and death of the worst.',
      evidence: ['like all races', 'saved by its exceptional men'],
      stem: 'Which statement best paraphrases Du Bois’s claim?',
      correct:
        'Du Bois claims that the progress of the race depends on developing exceptional leaders.',
      distractors: [
        'Du Bois claims that no leader can affect the progress of a race.',
        'Du Bois claims that only physical labor can improve society.',
        'Du Bois claims that education should avoid leadership and focus only on obedience.',
      ],
    },
    {
      subSkillId: 'paraphrase-claim-or-theme',
      skillFocus: 'Paraphrase claim or theme',
      selection: 'Industrial Education for the Negro — Booker T. Washington',
      exact: 'education purpose excerpt',
      excerpt:
        'The object of all education is not to make men carpenters, it is to make carpenters men. On such a foundation as this will grow habits of thrift, a love of work, economy, ownership of property, bank accounts.',
      evidence: ['object of all education', 'not to make men carpenters', 'make carpenters men'],
      stem: 'Which statement best paraphrases Washington’s point about education?',
      correct:
        'Education should build the whole person, not merely prepare someone for a job.',
      distractors: [
        'Education should remove skilled trades from schools completely.',
        'Education should train workers without developing judgment or character.',
        'Education should make carpentry more important than every other trade.',
      ],
    },
    {
      subSkillId: 'paraphrase-claim-or-theme',
      skillFocus: 'Paraphrase claim or theme',
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'house divided excerpt',
      excerpt:
        'A house divided against itself cannot stand. I believe this government cannot endure, permanently half slave and half free. I do not expect the Union to be dissolved; I do not expect the house to fall; but I do expect it will cease to be divided.',
      evidence: ['cannot endure', 'half slave and half free'],
      stem: 'Which statement best paraphrases Lincoln’s main point?',
      correct:
        'Lincoln argues that the United States cannot remain permanently divided over slavery.',
      distractors: [
        'Lincoln argues that slavery and freedom can coexist permanently without conflict.',
        'Lincoln argues that the government has already solved the slavery issue.',
        'Lincoln argues that the Union must dissolve immediately.',
      ],
    },
    {
      subSkillId: 'paraphrase-claim-or-theme',
      skillFocus: 'Paraphrase claim or theme',
      selection: 'Romeo and Juliet — William Shakespeare',
      exact: 'balcony excerpt',
      excerpt:
        'Although I joy in thee, I have no joy of this contract tonight: It is too rash, too unadvised, too sudden; Too like the lightning, which doth cease to be Ere one can say “It lightens.” Sweet, good night!',
      evidence: ['too rash, too unadvised, too sudden', 'Too like the lightning'],
      stem: 'Which statement best paraphrases Juliet’s concern?',
      correct:
        'Juliet worries that a love moving this quickly may be intense but unstable.',
      distractors: [
        'Juliet is certain that quick love is always stronger than careful love.',
        'Juliet is mainly explaining the weather rather than judging their relationship.',
        'Juliet wants Romeo to leave because she no longer has feelings for him.',
      ],
    },
  ];

  return cards
    .filter((card) => !requestedSubSkillId || card.subSkillId === requestedSubSkillId)
    .slice(0, maxRows)
    .map((card, index): PullOutRow => {
      const question = {
        stem: card.stem,
        choices: rotateChoices(index, [
          { text: card.correct, correct: true },
          ...card.distractors.map((text) => ({ text, correct: false })),
        ], { balanceLengths: false }),
      };
      const instructionalSupport = instructionalSupportFor('ELA.9.R.3.2', card.subSkillId, card.skillFocus);
      return {
        number: index + 1,
        standard: 'R.3.2',
        subSkillId: card.subSkillId,
        skillFocus: card.skillFocus,
        selection: card.selection,
        exactLinesOrParagraphs: card.exact,
        excerpt: card.excerpt,
        whyThisExcerpt: R32_SUB_SKILL_TEACHER_COPY[card.subSkillId].why,
        moveStatementTemplate: R32_SUB_SKILL_TEACHER_COPY[card.subSkillId].move,
        instructionalSupport,
        qualityGate: {
          status: 'gold',
          label: 'Gold card',
          checks: [
            'Teach layer pinned',
            'Excerpt is classroom-sized',
            'Meaning is paraphrasable',
            'FAST-style check present',
            'Distractors require thinking',
          ],
        },
        teacherTrust: {
          confidence: 'strong',
          officialTextMap: true,
          localSourceText: true,
          excerptWords: wordCount(card.excerpt),
          evidencePoints: card.evidence,
          useCase: '15-minute Promethean paraphrase pull-out',
          whyTrustIt:
            'This card asks students to preserve the original meaning, not just summarize the topic. The distractors add, omit, or twist meaning, which is the actual paraphrase skill.',
        },
        anchorQuestion: question,
      };
    });
}

async function r34GoldRows(maxRows: number, sourceEntries: ManifestEntry[]): Promise<PullOutRow[]> {
  const subSkillId = 'reader-belief-feeling-notice';
  const premiumCards = await r34PremiumCardsFromSources(sourceEntries);
  const fallbackCards: R34GoldCard[] = [
    {
      skillFocus: 'Rhetoric and reader effect',
      selection: 'A Modest Proposal — Jonathan Swift',
      exact: 'opening poverty excerpt',
      excerpt:
        'It is a melancholy object to those, who walk through this great town, or travel in the country, when they see the streets, the roads, and cabbin-doors crowded with beggars of the female sex, followed by three, four, or six children, all in rags, and importuning every passenger for an alms. These mothers, instead of being able to work for their honest livelihood, are forced to employ all their time in stroling to beg sustenance for their helpless infants.',
      evidence: [
        'melancholy object',
        'crowded with beggars',
        'children, all in rags',
        'helpless infants',
      ],
      stem: 'How does Swift’s opening description affect the reader?',
      correct:
        'It makes poverty feel visible and urgent, preparing the reader to see the issue as a public crisis.',
      distractors: [
        'It makes the scene feel ordinary, suggesting poverty is a small problem with little public importance.',
        'It focuses mainly on the speaker’s personal success, making him seem wealthy and powerful.',
        'It tells the reader that the mothers are lazy without showing any hardship around them.',
      ],
    },
    {
      skillFocus: 'Rhetoric and reader effect',
      selection: 'A Modest Proposal — Jonathan Swift',
      exact: 'satirical credibility excerpt',
      excerpt:
        'I profess in the sincerity of my heart that I have not the least personal interest in endeavouring to promote this necessary work. I have no children, by which I can propose to get a single penny; the youngest being nine years old, and my wife past child-bearing.',
      evidence: [
        'sincerity of my heart',
        'not the least personal interest',
        'necessary work',
      ],
      stem: 'How does the speaker’s claim of sincerity affect the reader’s understanding of the proposal?',
      correct:
        'It makes the speaker sound public-minded, which makes the cruel proposal seem falsely reasonable.',
      distractors: [
        'It makes the speaker seem upset, so the proposal becomes mostly an emotional confession.',
        'It shows the proposal is a private joke instead of a serious public argument.',
        'It proves the speaker has direct personal experience raising infants under the proposal.',
      ],
    },
    {
      skillFocus: 'Rhetoric and reader effect',
      selection: 'St. Crispin’s Day Speech — William Shakespeare',
      exact: 'brotherhood excerpt',
      excerpt:
        'This day is call’d the Feast of Crispian: He that out-lives this day, and comes safe home, Will stand a tip-toe when this day is named. Then shall our Names, Familiar in his mouth as household words, Be in their flowing Cups freshly remembred. We few, we happy few, we band of brothers: For he to day that sheds his blood with me, Shall be my brother.',
      evidence: [
        'This day',
        'our Names',
        'We few, we happy few',
        'band of brothers',
      ],
      stem: 'How does the repeated focus on “this day” and “we” affect the audience?',
      correct:
        'It makes the battle feel shared and honorable, turning the soldiers into a remembered brotherhood.',
      distractors: [
        'It makes the soldiers feel anonymous by suggesting no one will remember the battle.',
        'It suggests honor belongs only to nobles, so ordinary soldiers should leave.',
        'It shifts attention away from the soldiers and focuses on the enemy’s strength.',
      ],
    },
    {
      skillFocus: 'Rhetoric and reader effect',
      selection: 'The Love Song of J. Alfred Prufrock — T.S. Eliot',
      exact: 'rhetorical question excerpt',
      excerpt:
        'And indeed there will be time To wonder, “Do I dare?” and, “Do I dare?” Time to turn back and descend the stair. Do I dare Disturb the universe? In a minute there is time For decisions and revisions which a minute will reverse.',
      evidence: [
        'Do I dare?',
        'Do I dare Disturb the universe?',
        'decisions and revisions',
      ],
      stem: 'How do the repeated rhetorical questions affect the reader’s understanding of the speaker?',
      correct:
        'They reveal the speaker’s hesitation by making even small choices feel overwhelming.',
      distractors: [
        'They make the speaker seem confident because he answers each question immediately.',
        'They show the speaker is asking someone nearby for practical directions.',
        'They shift the poem from inner conflict to a public debate.',
      ],
    },
    {
      skillFocus: 'Rhetoric and reader effect',
      selection: 'Romeo and Juliet — William Shakespeare',
      exact: 'name argument excerpt',
      excerpt:
        '’Tis but thy name that is my enemy; Thou art thyself, though not a Montague. What’s Montague? It is nor hand, nor foot, Nor arm, nor face. What’s in a name? That which we call a rose By any other name would smell as sweet.',
      evidence: [
        'What’s Montague?',
        'What’s in a name?',
        'rose / any other name',
      ],
      stem: 'How do Juliet’s rhetorical questions about Romeo’s name affect the reader?',
      correct:
        'They separate Romeo from his family name, making the feud feel arbitrary.',
      distractors: [
        'They show Juliet believes Romeo’s name determines everything about his character.',
        'They make the rose image more important than Juliet’s argument about Romeo.',
        'They prove Juliet has stopped caring about Romeo because names no longer matter.',
      ],
    },
  ];

  const cards = [...premiumCards, ...fallbackCards].filter(
    (card, index, allCards) =>
      allCards.findIndex((item) => item.selection === card.selection && item.exact === card.exact) === index
  );

  return cards.slice(0, maxRows).map((card, index): PullOutRow => {
    const question = {
      stem: card.stem,
      choices: rotateChoices(index, [
        { text: card.correct, correct: true },
        ...card.distractors.map((text) => ({ text, correct: false })),
      ], { balanceLengths: false }),
    };
    const instructionalSupport = instructionalSupportFor('ELA.9.R.3.4', subSkillId, card.skillFocus);
    return {
      number: index + 1,
      standard: 'R.3.4',
      subSkillId,
      skillFocus: card.skillFocus,
      selection: card.selection,
      exactLinesOrParagraphs: card.exact,
      excerpt: card.excerpt,
      whyThisExcerpt: R34_SUB_SKILL_TEACHER_COPY[subSkillId].why,
      moveStatementTemplate: R34_SUB_SKILL_TEACHER_COPY[subSkillId].move,
      instructionalSupport,
      qualityGate: {
        status: 'gold',
        label: 'Gold card',
        checks: [
          'Teach layer pinned',
          'Rhetorical move is pointable',
          'Reader effect is clear',
          'FAST-style check present',
          'Distractors require thinking',
        ],
      },
      teacherTrust: {
        confidence: 'strong',
        officialTextMap: true,
        localSourceText: true,
        excerptWords: wordCount(card.excerpt),
        evidencePoints: card.evidence,
        useCase: '15-minute Promethean rhetoric pull-out',
        whyTrustIt:
          'This card gives students exact rhetoric to underline and asks how the language shapes reader belief, feeling, focus, or purpose.',
      },
      anchorQuestion: question,
    };
  });
}

function r24GoldRows(maxRows: number): PullOutRow[] {
  const skillFocus = 'Opposing claims and evidence comparison';
  const subSkillId = 'compare-evidence-development';
  const instructionalSupport = instructionalSupportFor('ELA.9.R.2.4', subSkillId, skillFocus);
  const cards = [
    {
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'paired debate excerpts: lines 28-43 / lines 598-613',
      excerpt:
        'Passage A: Lincoln argues, “A house divided against itself cannot stand.” He says the government “cannot endure permanently half slave and half free” and predicts it “will become all one thing, or all the other.”\n\nPassage B: Lincoln explains Douglas’s criticism: Douglas claims Lincoln’s words mean he favors “making all the States of this Union uniform” and “making war by the North upon the South for the extinction of slavery.” Lincoln responds that he “only said what I expected would take place.”',
      evidence: [
        'Lincoln claims the nation cannot permanently remain divided over slavery.',
        'Douglas criticizes Lincoln’s claim as a call for uniformity and conflict.',
        'The pair sets up a claim and counterclaim about what Lincoln’s argument means.',
      ],
      stem: 'Which choice best compares Lincoln’s claim with Douglas’s criticism of that claim?',
      correct:
        'Lincoln predicts the nation must resolve slavery, while Douglas frames that prediction as a threat of forced uniformity.',
      distractors: [
        'Lincoln claims the issue is already solved, while Douglas agrees no conflict remains.',
        'Lincoln argues for ignoring slavery, while Douglas says slavery should end immediately.',
        'Both speakers claim that the nation can remain half slave and half free permanently.',
      ],
    },
    {
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'paired debate excerpts: lines 74-84 / lines 432-453',
      excerpt:
        'Passage A: The Nebraska Act says its purpose is not “to legislate slavery into any Territory or State, nor to exclude it therefrom,” but to leave the people “perfectly free to form and regulate their domestic institutions in their own way.” When opponents wanted to state directly that territorial voters could exclude slavery, supporters voted that amendment down.\n\nPassage B: Lincoln argues that the Dred Scott decision says “the people of a Territory have no right to exclude slavery” and that if one person brings enslaved people into a territory, “all the rest of the people have no right to keep them out.”',
      evidence: [
        'The Nebraska Act claims people are free to regulate domestic institutions.',
        'Lincoln argues the court decision prevents territorial voters from excluding slavery.',
        'The comparison tests whether the claim of popular sovereignty is valid.',
      ],
      stem: 'How does Lincoln use evidence to challenge the claim of popular sovereignty?',
      correct:
        'He shows that the law’s promise of local choice is weakened by a court decision limiting that choice.',
      distractors: [
        'He shows that the Nebraska Act clearly gave territories unlimited power over slavery.',
        'He argues that popular sovereignty has nothing to do with territorial government.',
        'He claims the amendment passed and fully protected the right to exclude slavery.',
      ],
    },
    {
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'paired debate excerpts: lines 945-978 / lines 990-1005',
      excerpt:
        'Passage A: Lincoln says Douglas’s view of the Declaration of Independence narrows its meaning. Lincoln asks whether making exceptions to “all men are created equal” would “rub out the sentiment of liberty” and turn the argument into “the same old serpent” used by kings to justify ruling over others.\n\nPassage B: Lincoln compares the equality principle to Scripture’s command to be perfect: even if people cannot reach the ideal completely, it remains the standard. He argues that if freedom cannot be given to every person, “let us do nothing that will impose slavery upon any other creature.”',
      evidence: [
        'Lincoln challenges a narrower reading of the Declaration.',
        'Lincoln supports his own claim by treating equality as a guiding standard.',
        'The paired excerpts compare a criticized argument with Lincoln’s reasoning against it.',
      ],
      stem: 'Which comparison best evaluates Lincoln’s support for the equality principle?',
      correct:
        'He challenges exceptions to equality, then supports equality as a standard the nation should move toward.',
      distractors: [
        'He rejects the Declaration completely, then argues the nation needs no moral standard.',
        'He supports Douglas’s narrow reading, then says equality should not guide public action.',
        'He avoids evidence by discussing only personal feelings about political opponents.',
      ],
    },
    {
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'paired debate excerpts: lines 625-657 / lines 659-668',
      excerpt:
        'Passage A: Lincoln argues that the country endured half slave and half free because people believed slavery was “in course of ultimate extinction.” He points to the Constitution’s history and asks why the founders kept slavery out of new territory and allowed Congress to end the African slave trade.\n\nPassage B: Lincoln limits his claim by saying he has “no right” and “no inclination” for free states to interfere with slavery where it already exists. He says that if his words have ever been read that way, “I now correct it.”',
      evidence: [
        'Lincoln uses historical evidence to support restricting slavery’s spread.',
        'Lincoln also qualifies his position by rejecting interference where slavery already exists.',
        'The pair helps students evaluate the limits and validity of a claim.',
      ],
      stem: 'How does Lincoln’s qualification in Passage B affect the validity of his argument in Passage A?',
      correct:
        'It narrows his claim, showing he argues against slavery’s spread rather than direct interference everywhere.',
      distractors: [
        'It contradicts his argument by saying slavery should expand into every territory.',
        'It proves his historical evidence is irrelevant because he refuses to mention the founders.',
        'It changes his argument into a personal story with no claim about slavery.',
      ],
    },
    {
      selection: 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln',
      exact: 'paired debate excerpts: lines 1852-1872 / lines 1939-1956',
      excerpt:
        'Passage A: Lincoln says repealing the Missouri Compromise is “wrong in its direct effect,” because it lets slavery into Kansas and Nebraska, and “wrong in its prospective principle,” because it allows slavery to spread. He says he hates this indifference because of “the monstrous injustice of slavery itself.”\n\nPassage B: Lincoln clarifies that he has “no purpose” to interfere with slavery in states where it exists and “no purpose to introduce political and social equality.” Still, he argues that Black people are entitled to the natural rights of “life, liberty, and the pursuit of happiness.”',
      evidence: [
        'Lincoln opposes slavery’s spread on moral and political grounds.',
        'Lincoln clarifies the limits of his position while still defending natural rights.',
        'Students compare the strength and limits of one argument across paired excerpts.',
      ],
      stem: 'Which statement best evaluates how the two excerpts develop Lincoln’s argument?',
      correct:
        'Together, they show he opposes slavery’s spread while limiting his claim to natural rights, not full social equality.',
      distractors: [
        'Together, they show he supports slavery’s expansion while rejecting natural rights.',
        'Passage B cancels Passage A because Lincoln says slavery is not morally serious.',
        'Passage A and Passage B make unrelated claims with no shared issue or support.',
      ],
    },
  ];

  return cards.slice(0, maxRows).map((card, index) => {
    const question = {
      stem: card.stem,
      choices: rotateChoices(index, [
        { text: card.correct, correct: true },
        ...card.distractors.map((text) => ({ text, correct: false })),
      ]),
    };

    return {
      number: index + 1,
      standard: 'R.2.4',
      subSkillId,
      skillFocus,
      selection: card.selection,
      exactLinesOrParagraphs: card.exact,
      excerpt: card.excerpt,
      whyThisExcerpt: R24_SUB_SKILL_TEACHER_COPY[subSkillId].why,
      moveStatementTemplate: R24_SUB_SKILL_TEACHER_COPY[subSkillId].move,
      instructionalSupport,
      qualityGate: {
        status: 'gold',
        label: 'Gold card',
        checks: [
          'Teach layer pinned',
          'Two claims are separate',
          'Evidence is sortable by side',
          'FAST-style paired check present',
          'Distractors require thinking',
        ],
      },
      teacherTrust: {
        confidence: 'strong',
        officialTextMap: true,
        localSourceText: true,
        excerptWords: wordCount(card.excerpt),
        evidencePoints: card.evidence,
        useCase: '15-minute Promethean paired-argument pull-out',
        whyTrustIt:
          'The card pairs two arguments on the same issue, gives pointable evidence for each side, and asks students to compare support instead of choosing an opinion.',
      },
      anchorQuestion: question,
    };
  });
}

type R24DeepCard = {
  subSkillId: string;
  skillFocus: string;
  selection: string;
  exact: string;
  excerpt: string;
  evidence: string[];
  stem: string;
  correct: string;
  distractors: string[];
};

function r24DeepGoldRows(maxRows: number, requestedSubSkillId?: string | null): PullOutRow[] {
  const lincolnDouglas = 'The Lincoln-Douglas Debates — Stephen Douglas and Abraham Lincoln';
  const washingtonDuBois =
    'Industrial Education for the Negro — Booker T. Washington / The Talented Tenth — W.E.B. Du Bois';
  const cards: R24DeepCard[] = [
    {
      subSkillId: 'identify-opposing-claims',
      skillFocus: 'Identify opposing claims',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: house-divided claim / Douglas criticism',
      excerpt:
        'Passage A: Lincoln argues that the government “cannot endure permanently half slave and half free” and predicts it “will become all one thing, or all the other.”\n\nPassage B: Douglas criticizes Lincoln’s words as favoring “making all the States of this Union uniform” and “making war by the North upon the South for the extinction of slavery.”',
      evidence: [
        'Lincoln predicts the nation must resolve slavery.',
        'Douglas frames that prediction as forced uniformity and conflict.',
      ],
      stem: 'Which choice best compares Lincoln’s claim with Douglas’s criticism of that claim?',
      correct:
        'Lincoln predicts the nation must resolve slavery, while Douglas frames that prediction as a threat of forced uniformity.',
      distractors: [
        'Lincoln claims the issue is already solved, while Douglas agrees no conflict remains.',
        'Lincoln argues for ignoring slavery, while Douglas says slavery should end immediately.',
        'Both speakers claim that the nation can remain half slave and half free permanently.',
      ],
    },
    {
      subSkillId: 'identify-opposing-claims',
      skillFocus: 'Identify opposing claims',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: Nebraska Act / Dred Scott response',
      excerpt:
        'Passage A: The Nebraska Act says the people are “perfectly free to form and regulate their domestic institutions in their own way.”\n\nPassage B: Lincoln argues that Dred Scott says territorial voters have “no right to exclude slavery,” so if one person brings enslaved people into a territory, others have “no right to keep them out.”',
      evidence: [
        'One claim says voters are free to decide locally.',
        'Lincoln claims that a court decision limits that local choice.',
      ],
      stem: 'Which statement best identifies the opposing claims about popular sovereignty?',
      correct:
        'One claim says voters are free to decide slavery locally; Lincoln’s claim says that freedom is blocked by the court.',
      distractors: [
        'Both claims say territorial voters have complete power to exclude slavery.',
        'Both claims say courts should not affect slavery in the territories.',
        'Lincoln’s claim says voters caused the court decision by rejecting slavery.',
      ],
    },
    {
      subSkillId: 'identify-opposing-claims',
      skillFocus: 'Identify opposing claims',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: Declaration equality / equality ideal',
      excerpt:
        'Passage A: Lincoln says Douglas’s reading of the Declaration narrows “all men are created equal” and risks rubbing out “the sentiment of liberty.”\n\nPassage B: Lincoln compares equality to a command to be perfect: even if people cannot fully reach it, the principle remains the standard that should guide action.',
      evidence: [
        'Lincoln challenges a narrow reading of equality.',
        'Lincoln argues equality remains a guiding standard.',
      ],
      stem: 'What disagreement about equality is developed in these excerpts?',
      correct:
        'Lincoln challenges a narrow view of equality and argues that equality should remain a guiding standard.',
      distractors: [
        'Lincoln argues that equality should be erased because no person can fully reach it.',
        'Lincoln agrees that equality applies only to kings and not to ordinary people.',
        'Lincoln says the Declaration has no connection to arguments about slavery.',
      ],
    },
    {
      subSkillId: 'identify-opposing-claims',
      skillFocus: 'Identify opposing claims',
      selection: washingtonDuBois,
      exact: 'paired excerpts: industrial foundation / work plus ideals',
      excerpt:
        'Passage A: Washington argues that Black Americans needed to learn “the difference between being worked and working.” He says “working means civilization” and that races rise by “laying an economic foundation.”\n\nPassage B: Du Bois argues that “work alone will not do it unless inspired by the right ideals and guided by intelligence.” He says education “must not simply teach work—it must teach Life.”',
      evidence: [
        'Washington centers work and economic foundation.',
        'Du Bois argues work needs ideals, intelligence, and broader education.',
      ],
      stem: 'Which statement best identifies the difference between Washington’s and Du Bois’s claims?',
      correct:
        'Washington emphasizes industrial work as a foundation, while Du Bois argues work must be guided by broader education.',
      distractors: [
        'Washington rejects work entirely, while Du Bois says education should teach only manual labor.',
        'Both writers claim that higher education has no role in Black advancement.',
        'Both writers argue that economic development is impossible after slavery.',
      ],
    },
    {
      subSkillId: 'identify-opposing-claims',
      skillFocus: 'Identify opposing claims',
      selection: washingtonDuBois,
      exact: 'paired excerpts: practical schooling / higher education',
      excerpt:
        'Passage A: Washington says “mere book education” can leave young people without practical preparation. He argues that students need academic education combined with useful training.\n\nPassage B: Du Bois says the charge of too much higher education is “baseless.” He argues that Black communities need teachers, normal schools, and colleges.',
      evidence: [
        'Washington warns against schooling without practical preparation.',
        'Du Bois defends higher education as necessary for teachers and leaders.',
      ],
      stem: 'What is the central disagreement between these two excerpts?',
      correct:
        'Washington warns against impractical schooling, while Du Bois defends higher education as necessary for leadership and teaching.',
      distractors: [
        'Washington says students should avoid all training, while Du Bois says schools should teach no academic subjects.',
        'Both writers argue that schools should stop preparing teachers.',
        'Both writers claim practical training and higher education are exactly the same.',
      ],
    },
    {
      subSkillId: 'compare-evidence-development',
      skillFocus: 'Compare evidence development',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: Nebraska Act / Dred Scott',
      excerpt:
        'Passage A: The Nebraska Act claims local freedom over domestic institutions. A proposed amendment directly allowing voters to exclude slavery was voted down.\n\nPassage B: Lincoln points to Dred Scott as evidence that territorial voters cannot exclude slavery once it is brought there.',
      evidence: [
        'The law claims local freedom.',
        'The amendment vote and court decision limit that freedom.',
      ],
      stem: 'How does Lincoln use evidence to challenge the claim of popular sovereignty?',
      correct:
        'He shows that the law’s promise of local choice is weakened by a court decision limiting that choice.',
      distractors: [
        'He shows that the Nebraska Act clearly gave territories unlimited power over slavery.',
        'He argues that popular sovereignty has nothing to do with territorial government.',
        'He claims the amendment passed and fully protected the right to exclude slavery.',
      ],
    },
    {
      subSkillId: 'compare-evidence-development',
      skillFocus: 'Compare evidence development',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: founders’ actions / limited claim',
      excerpt:
        'Passage A: Lincoln uses the founders’ actions as evidence: they restricted slavery in new territory and allowed the end of the African slave trade.\n\nPassage B: Lincoln then says he does not claim a right or desire to interfere with slavery where it already exists.',
      evidence: [
        'Historical examples support restricting slavery’s spread.',
        'Lincoln limits the reach of the claim.',
      ],
      stem: 'How does Lincoln’s qualification in Passage B affect the support in Passage A?',
      correct:
        'It narrows the argument by showing his evidence supports restricting expansion, not interfering everywhere.',
      distractors: [
        'It proves his evidence is false because he refuses to discuss the Constitution.',
        'It changes the topic from slavery to a personal complaint about public speaking.',
        'It shows he supports expanding slavery into every new territory.',
      ],
    },
    {
      subSkillId: 'compare-evidence-development',
      skillFocus: 'Compare evidence development',
      selection: washingtonDuBois,
      exact: 'paired excerpts: trade list / college-trained staff list',
      excerpt:
        'Passage A: Washington supports industrial education by listing practical trades: carpenters, blacksmiths, wheelwrights, brick masons, engineers, cooks, laundresses, sewing women, and housekeepers.\n\nPassage B: Du Bois supports higher education by listing college-trained people helping at Tuskegee, including graduates of Harvard, Oberlin, Atlanta University, Fisk, and Smith.',
      evidence: [
        'Washington lists practical trades.',
        'Du Bois lists college-trained professionals.',
      ],
      stem: 'Which comparison best explains how both writers develop their claims?',
      correct:
        'Both use lists of examples, but Washington lists trades while Du Bois lists educated leaders and teachers.',
      distractors: [
        'Both rely only on personal feelings and avoid giving examples.',
        'Washington lists colleges, while Du Bois lists plantation trades.',
        'Both argue that no form of education needs trained teachers.',
      ],
    },
    {
      subSkillId: 'compare-evidence-development',
      skillFocus: 'Compare evidence development',
      selection: washingtonDuBois,
      exact: 'paired excerpts: city migration / higher education data',
      excerpt:
        'Passage A: Washington argues that schooling often teaches students about cities but “almost nothing about the country,” making it natural for students to leave rural districts.\n\nPassage B: Du Bois argues that Black enrollment in secondary and higher education must increase greatly to match the national average.',
      evidence: [
        'Washington uses cause and effect about schooling and migration.',
        'Du Bois uses comparison data about educational access.',
      ],
      stem: 'How is the evidence in the two passages different?',
      correct:
        'Washington uses a cause-and-effect example, while Du Bois uses comparison data to show a need.',
      distractors: [
        'Washington uses national enrollment data, while Du Bois discusses only rural migration.',
        'Both writers use the same statistic to prove the same solution.',
        'Neither writer gives support that connects to education.',
      ],
    },
    {
      subSkillId: 'compare-evidence-development',
      skillFocus: 'Compare evidence development',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: Missouri Compromise / natural rights',
      excerpt:
        'Passage A: Lincoln says repealing the Missouri Compromise is wrong because it lets slavery into Kansas and Nebraska and allows slavery to spread.\n\nPassage B: Lincoln clarifies that he does not argue for full social equality, but he defends natural rights: “life, liberty, and the pursuit of happiness.”',
      evidence: [
        'Lincoln opposes slavery’s spread.',
        'Lincoln defines the rights claim he is defending.',
      ],
      stem: 'Which statement best explains how the evidence develops Lincoln’s position?',
      correct:
        'It shows he opposes slavery’s spread while defining the specific rights claim he is defending.',
      distractors: [
        'It shows he supports slavery’s spread and rejects natural rights.',
        'It proves his argument has no position on slavery or rights.',
        'It shows he discusses only social equality and never mentions slavery.',
      ],
    },
    {
      subSkillId: 'evaluate-validity',
      skillFocus: 'Evaluate claim validity',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: popular sovereignty / Dred Scott',
      excerpt:
        'Passage A: Popular sovereignty claims the people are free to regulate slavery in a territory.\n\nPassage B: Lincoln argues that Dred Scott leaves territorial voters with no right to exclude slavery once it is brought there.',
      evidence: [
        'The first claim promises local control.',
        'The second excerpt supplies legal evidence against that control.',
      ],
      stem: 'Which answer best evaluates the validity of the popular sovereignty claim?',
      correct:
        'The claim is weakened because the evidence shows territorial voters may not actually control slavery.',
      distractors: [
        'The claim is proven because both excerpts show voters can exclude slavery without limits.',
        'The claim is unrelated because neither excerpt discusses territorial power.',
        'The claim is strengthened because the amendment passed and expanded local choice.',
      ],
    },
    {
      subSkillId: 'evaluate-validity',
      skillFocus: 'Evaluate claim validity',
      selection: washingtonDuBois,
      exact: 'paired excerpts: practical need / teacher need',
      excerpt:
        'Passage A: Washington argues that practical education matters because many students were trained “in everything but farming,” even though most Black people in Southern states lived in country districts.\n\nPassage B: Du Bois argues that the race needs teachers and colleges because first-class schools must train teachers and leaders.',
      evidence: [
        'Washington connects education to likely work and location.',
        'Du Bois connects education to teacher preparation and leadership.',
      ],
      stem: 'Which evaluation of the two claims is best supported?',
      correct:
        'Both claims are valid in context because each connects its solution to a specific community need.',
      distractors: [
        'Neither claim is valid because neither writer gives a reason for education.',
        'Only Washington’s claim is valid because Du Bois never explains why schools need teachers.',
        'Only Du Bois’s claim is valid because Washington never connects education to student lives.',
      ],
    },
    {
      subSkillId: 'evaluate-validity',
      skillFocus: 'Evaluate claim validity',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: equality exceptions / equality ideal',
      excerpt:
        'Passage A: Lincoln argues that narrowing “all men are created equal” would rub out the sentiment of liberty.\n\nPassage B: Lincoln compares equality to an ideal that people may not fully reach but still should use as a guide.',
      evidence: [
        'Lincoln explains the danger of exceptions.',
        'Lincoln gives a reason an ideal can still guide action.',
      ],
      stem: 'Why is Lincoln’s defense of equality logically valid in these excerpts?',
      correct:
        'He explains why weakening the principle is dangerous and why an imperfectly reached ideal can still guide action.',
      distractors: [
        'He proves equality is invalid because no person can ever act on an ideal.',
        'He avoids the Declaration and supports his point only with unrelated insults.',
        'He says exceptions to equality make liberty stronger for everyone.',
      ],
    },
    {
      subSkillId: 'evaluate-validity',
      skillFocus: 'Evaluate claim validity',
      selection: washingtonDuBois,
      exact: 'paired excerpts: economic foundation / work plus intelligence',
      excerpt:
        'Passage A: Washington argues that races rise by building an economic foundation through work, saving, and ownership.\n\nPassage B: Du Bois responds that “work alone will not do it” unless guided by intelligence and ideals.',
      evidence: [
        'Washington supports work as a foundation.',
        'Du Bois qualifies work by adding intelligence and ideals.',
      ],
      stem: 'How does Du Bois’s claim affect the validity of Washington’s claim?',
      correct:
        'It does not reject work, but it shows work is incomplete without intelligence and ideals.',
      distractors: [
        'It proves work has no value because Du Bois rejects every kind of labor.',
        'It strengthens Washington’s claim by saying education should teach only manual tasks.',
        'It changes the topic to farming without addressing work or education.',
      ],
    },
    {
      subSkillId: 'evaluate-validity',
      skillFocus: 'Evaluate claim validity',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: house-divided claim / Douglas criticism',
      excerpt:
        'Passage A: Lincoln says the country “cannot endure permanently half slave and half free” and predicts it will become “all one thing, or all the other.”\n\nPassage B: Douglas criticizes that claim as pushing the states toward forced uniformity and sectional conflict.',
      evidence: [
        'Lincoln makes a prediction about the nation’s future.',
        'Douglas attacks the prediction by describing its possible consequences.',
      ],
      stem: 'Which evaluation best explains the validity of Douglas’s criticism?',
      correct:
        'It is partly valid because it challenges the consequence of Lincoln’s claim, but it may overstate Lincoln’s position.',
      distractors: [
        'It is fully valid because Lincoln directly calls for immediate war between North and South.',
        'It is invalid because Douglas discusses a completely different topic from Lincoln.',
        'It is fully valid because both speakers agree the nation can remain divided forever.',
      ],
    },
    {
      subSkillId: 'evaluate-effectiveness',
      skillFocus: 'Evaluate argument effectiveness',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: founders’ evidence / qualification',
      excerpt:
        'Passage A: Lincoln uses the founders’ actions as evidence: they restricted slavery in new territory and allowed the end of the African slave trade.\n\nPassage B: Lincoln then says he does not claim a right or desire to interfere with slavery where it already exists.',
      evidence: [
        'Historical support makes the argument grounded.',
        'Qualification makes the claim harder to misrepresent.',
      ],
      stem: 'Why does Lincoln’s combination of evidence and qualification make his argument more effective?',
      correct:
        'It gives historical support while limiting the claim so opponents cannot easily misstate it.',
      distractors: [
        'It avoids evidence and relies only on emotional language.',
        'It makes the claim broader by demanding immediate interference everywhere.',
        'It shifts away from slavery and discusses only personal reputation.',
      ],
    },
    {
      subSkillId: 'evaluate-effectiveness',
      skillFocus: 'Evaluate argument effectiveness',
      selection: washingtonDuBois,
      exact: 'paired excerpts: trade examples / Tuskegee staff examples',
      excerpt:
        'Passage A: Washington lists practical trades learned through training.\n\nPassage B: Du Bois lists college-trained people working at Tuskegee and argues that Washington’s own school depends on educated teachers, scientists, historians, and leaders.',
      evidence: [
        'Washington makes practical training concrete.',
        'Du Bois uses Washington’s own institution as evidence for higher education.',
      ],
      stem: 'Which argument is more effective against the idea that higher education is unnecessary?',
      correct:
        'Du Bois’s argument, because he shows that even industrial schools depend on highly educated leaders and teachers.',
      distractors: [
        'Washington’s argument, because his list proves colleges do not need teachers.',
        'Du Bois’s argument, because he ignores Washington’s school completely.',
        'Washington’s argument, because naming trades proves higher education can never help anyone.',
      ],
    },
    {
      subSkillId: 'evaluate-effectiveness',
      skillFocus: 'Evaluate argument effectiveness',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: popular sovereignty claim / legal rebuttal',
      excerpt:
        'Passage A: Popular sovereignty is presented as local freedom: people in a territory regulate slavery for themselves.\n\nPassage B: Lincoln answers with legal evidence from Dred Scott, arguing that territorial voters have no right to exclude slavery.',
      evidence: [
        'The first argument uses the appealing idea of local choice.',
        'Lincoln’s argument uses a legal example to test whether local choice actually works.',
      ],
      stem: 'Which argument is more effective for challenging popular sovereignty?',
      correct:
        'Lincoln’s argument, because it uses a specific legal decision to show that local choice may be limited.',
      distractors: [
        'The popular sovereignty argument, because it proves courts cannot affect territorial voters.',
        'Lincoln’s argument, because it avoids evidence and only repeats a slogan.',
        'Neither argument is effective because both avoid the issue of territorial power.',
      ],
    },
    {
      subSkillId: 'evaluate-effectiveness',
      skillFocus: 'Evaluate argument effectiveness',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: moral claim / rights limitation',
      excerpt:
        'Passage A: Lincoln calls indifference to slavery’s spread wrong because of “the monstrous injustice of slavery itself.”\n\nPassage B: Lincoln clarifies that he does not argue for political and social equality, but he does defend natural rights.',
      evidence: [
        'Lincoln uses moral language.',
        'Lincoln narrows the issue to natural rights.',
      ],
      stem: 'Why might this argument be effective for Lincoln’s audience?',
      correct:
        'It makes a moral claim against slavery while narrowing the issue to rights the audience recognizes.',
      distractors: [
        'It avoids moral language and refuses to say what rights are involved.',
        'It argues only for social equality and never mentions slavery.',
        'It says slavery’s spread is unimportant because natural rights do not matter.',
      ],
    },
    {
      subSkillId: 'evaluate-effectiveness',
      skillFocus: 'Evaluate argument effectiveness',
      selection: washingtonDuBois,
      exact: 'paired excerpts: economic foundation / leadership claim',
      excerpt:
        'Passage A: Washington argues that a race rises by building an economic foundation through honorable labor, saving, and ownership.\n\nPassage B: Du Bois argues that the “Talented Tenth” must become leaders of thought and culture because “work alone will not do it.”',
      evidence: [
        'Washington appeals to practical stability.',
        'Du Bois appeals to leadership and long-term development.',
      ],
      stem: 'Which statement best evaluates the effectiveness of the two arguments?',
      correct:
        'Washington is effective for practical self-sufficiency, while Du Bois is effective for leadership and long-term advancement.',
      distractors: [
        'Washington is effective only because he rejects work, while Du Bois rejects education.',
        'Both arguments are ineffective because neither gives a clear goal.',
        'Du Bois is effective for farming advice, while Washington focuses only on colleges.',
      ],
    },
    {
      subSkillId: 'response-counterclaim',
      skillFocus: 'Response to counterclaim',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: Douglas criticism / Lincoln clarification',
      excerpt:
        'Passage A: Douglas’s criticism says Lincoln’s “house divided” claim means making all states uniform and making war by the North upon the South.\n\nPassage B: Lincoln answers by saying he did not call for interference where slavery already exists and that critics have made his claim too broad.',
      evidence: [
        'Douglas presents a criticism.',
        'Lincoln responds by narrowing and clarifying his claim.',
      ],
      stem: 'How does Lincoln respond to Douglas’s criticism?',
      correct:
        'He rejects the broad interpretation and clarifies that his claim is about slavery’s future direction.',
      distractors: [
        'He accepts Douglas’s claim and calls for immediate war between regions.',
        'He changes the subject by refusing to discuss slavery or the nation.',
        'He says Douglas has no criticism and agrees with every part of the speech.',
      ],
    },
    {
      subSkillId: 'response-counterclaim',
      skillFocus: 'Response to counterclaim',
      selection: lincolnDouglas,
      exact: 'paired debate excerpts: local choice claim / Dred Scott rebuttal',
      excerpt:
        'Passage A: Popular sovereignty says people in a territory are free to regulate slavery for themselves.\n\nPassage B: Lincoln challenges that claim by pointing to Dred Scott, which he says leaves territorial voters with no right to exclude slavery.',
      evidence: [
        'Popular sovereignty is the claim.',
        'Dred Scott is the counter-evidence.',
      ],
      stem: 'How does Lincoln’s reference to Dred Scott function as a response?',
      correct:
        'It challenges the claim of local choice by showing a legal barrier to excluding slavery.',
      distractors: [
        'It supports popular sovereignty by proving voters have unlimited choice.',
        'It avoids the topic because court decisions cannot affect territories.',
        'It answers the claim by saying slavery was already excluded everywhere.',
      ],
    },
    {
      subSkillId: 'response-counterclaim',
      skillFocus: 'Response to counterclaim',
      selection: washingtonDuBois,
      exact: 'paired excerpts: work as foundation / work alone is incomplete',
      excerpt:
        'Passage A: Washington argues that industrial education and work create the wealth and foundation from which higher education and opportunity can come.\n\nPassage B: Du Bois responds that work alone will not uplift a people unless it is guided by intelligence, ideals, and trained leaders.',
      evidence: [
        'Washington gives work a foundational role.',
        'Du Bois qualifies work rather than dismissing it.',
      ],
      stem: 'How does Du Bois respond to the claim that work is the main path upward?',
      correct:
        'He qualifies it by arguing that work needs intelligence, ideals, and leadership to become uplift.',
      distractors: [
        'He agrees completely and says education should teach only work.',
        'He rejects work by saying labor has no value for any community.',
        'He changes the issue from education to a story with no argument.',
      ],
    },
    {
      subSkillId: 'response-counterclaim',
      skillFocus: 'Response to counterclaim',
      selection: washingtonDuBois,
      exact: 'paired excerpts: practical schooling concern / Tuskegee rebuttal',
      excerpt:
        'Passage A: Washington warns that schooling can separate students from useful work they are fitted to do.\n\nPassage B: Du Bois answers criticism of higher training by showing that Washington’s own institution relies on college-trained teachers, scientists, historians, and leaders.',
      evidence: [
        'Washington raises a concern about impractical education.',
        'Du Bois uses Tuskegee as evidence for higher training.',
      ],
      stem: 'How does Du Bois use Tuskegee as a response to criticism of higher education?',
      correct:
        'He shows that higher education strengthens practical institutions by preparing their teachers and leaders.',
      distractors: [
        'He shows that practical institutions should measure success only by the number of trades offered.',
        'He agrees that practical schools matter, but treats college training as separate from their success.',
        'He argues that industrial education is useful only when it avoids academic leadership.',
      ],
    },
    {
      subSkillId: 'response-counterclaim',
      skillFocus: 'Response to counterclaim',
      selection: washingtonDuBois,
      exact: 'paired excerpts: practical education claim / higher education qualification',
      excerpt:
        'Passage A: Washington argues that practical education helps students prepare for useful work and economic independence.\n\nPassage B: Du Bois answers that practical work needs leaders, teachers, intelligence, and ideals; education must teach more than work alone.',
      evidence: [
        'Washington makes a practical education claim.',
        'Du Bois responds by qualifying practical work with leadership and intellectual training.',
      ],
      stem: 'How does Du Bois qualify Washington’s argument for practical education?',
      correct:
        'He accepts that work matters but argues that work must be guided by intelligence, ideals, and trained leaders.',
      distractors: [
        'He treats work as useful only when it is separated from leadership and intellectual training.',
        'He agrees with Washington by making practical skill the complete goal of education.',
        'He shifts the focus from leadership to economic independence without qualifying Washington’s claim.',
      ],
    },
  ];

  const filteredCards = requestedSubSkillId
    ? cards.filter((card) => card.subSkillId === requestedSubSkillId)
    : cards;

  return filteredCards.slice(0, maxRows).map((card, index) => {
    const instructionalSupport = instructionalSupportFor('ELA.9.R.2.4', card.subSkillId, card.skillFocus);
    const question = {
      stem: card.stem,
      choices: rotateChoices(index, [
        { text: card.correct, correct: true },
        ...card.distractors.map((text) => ({ text, correct: false })),
      ]),
    };

    return {
      number: index + 1,
      standard: 'R.2.4',
      subSkillId: card.subSkillId,
      skillFocus: card.skillFocus,
      selection: card.selection,
      exactLinesOrParagraphs: card.exact,
      excerpt: card.excerpt,
      whyThisExcerpt: R24_SUB_SKILL_TEACHER_COPY[card.subSkillId].why,
      moveStatementTemplate: R24_SUB_SKILL_TEACHER_COPY[card.subSkillId].move,
      instructionalSupport,
      qualityGate: {
        status: 'gold',
        label: 'Gold card',
        checks: [
          'Teach layer pinned',
          'Two claims are separate',
          'Evidence is sortable by side',
          'FAST-style paired check present',
          'Distractors require thinking',
        ],
      },
      teacherTrust: {
        confidence: 'strong',
        officialTextMap: true,
        localSourceText: true,
        excerptWords: wordCount(card.excerpt),
        evidencePoints: card.evidence,
        useCase: '15-minute Promethean paired-argument pull-out',
        whyTrustIt:
          'The card pairs arguments on the same issue and asks students to compare claims, evidence, validity, effectiveness, or counterclaim response.',
      },
      anchorQuestion: question,
    };
  });
}

function buildR24ArgumentLabs(): ArgumentLab[] {
  const allRows = r24DeepGoldRows(25);
  const bySubSkill = (strandId: string) => allRows.find((row) => row.subSkillId === strandId);
  const pickRows = (ids: string[]) =>
    ids.map((id) => bySubSkill(id)).filter((row): row is PullOutRow => Boolean(row));
  const standardSequence = [
    {
      label: 'Issue setup',
      minutes: 6,
      teacherMove: 'Frame the debate issue in plain English and define the two sides.',
      studentTask: 'Write the issue question and predict what each side will argue.',
    },
    {
      label: 'Source A claim map',
      minutes: 10,
      teacherMove: 'Model how to locate the claim and underline the evidence that supports it.',
      studentTask: 'Fill the left side of the two-column claim/evidence chart.',
    },
    {
      label: 'Source B claim map',
      minutes: 10,
      teacherMove: 'Guide students to keep the second claim separate from the first.',
      studentTask: 'Fill the right side of the chart and mark where the arguments disagree.',
    },
    {
      label: 'Validity and effectiveness check',
      minutes: 14,
      teacherMove: 'Press students to judge support quality, not personal agreement.',
      studentTask: 'Answer the FAST-style checks and justify one answer with exact evidence.',
    },
    {
      label: 'Written argument response',
      minutes: 15,
      teacherMove: 'Require a claim, evidence from both texts, and a because explanation.',
      studentTask: 'Write one paragraph: which argument is stronger and why?',
    },
  ];

  return [
    {
      id: 'lincoln-douglas-slavery-expansion',
      title: 'Lincoln-Douglas Argument Lab',
      issueQuestion: 'Can a nation remain divided over slavery, or must the conflict be resolved?',
      durationMinutes: 55,
      sourcePair: 'The Lincoln-Douglas Debates',
      teacherSetup:
        'Use this when you want the cleanest R.2.4 lesson. Students compare claim, counterclaim, legal evidence, qualification, validity, and effectiveness inside one historical debate.',
      studentProduct:
        'Two-column claim/evidence chart plus one paragraph evaluating which argument is better supported.',
      sequence: standardSequence,
      cards: allRows
        .filter((row) => row.selection.includes('Lincoln-Douglas'))
        .slice(0, 5),
    },
    {
      id: 'washington-dubois-education',
      title: 'Washington vs. Du Bois Argument Lab',
      issueQuestion: 'Should education focus first on practical work skills or broader intellectual leadership?',
      durationMinutes: 55,
      sourcePair: 'Booker T. Washington paired with W.E.B. Du Bois',
      teacherSetup:
        'Use this when you want a more teachable classroom debate about education, work, leadership, and community advancement.',
      studentProduct:
        'Two-column claim/evidence chart plus one paragraph explaining how Du Bois qualifies or challenges Washington.',
      sequence: standardSequence,
      cards: allRows
        .filter((row) => row.selection.includes('Washington') || row.selection.includes('Du Bois'))
        .slice(0, 5),
    },
    {
      id: 'r24-fast-sprint',
      title: 'R.2.4 FAST Sprint Lab',
      issueQuestion: 'How do readers compare opposing arguments and decide which support is stronger?',
      durationMinutes: 45,
      sourcePair: 'Mixed official argument texts',
      teacherSetup:
        'Use this for test-prep rhythm. Each card targets one R.2.4 move so students practice the whole standard in one class period.',
      studentProduct:
        'Five short claim/evidence reps and one exit ticket explaining the strongest argument.',
      sequence: [
        {
          label: 'Claim warm-up',
          minutes: 7,
          teacherMove: 'Model how to separate Passage A and Passage B claims.',
          studentTask: 'Write both claims in a two-column chart.',
        },
        {
          label: 'Evidence reps',
          minutes: 18,
          teacherMove: 'Cycle through compare evidence, validity, and effectiveness checks.',
          studentTask: 'Answer each FAST-style check and underline the evidence that proves it.',
        },
        {
          label: 'Counterclaim rep',
          minutes: 8,
          teacherMove: 'Show how one author answers, limits, or challenges the other.',
          studentTask: 'Write the counterclaim and response in one sentence.',
        },
        {
          label: 'Exit ticket',
          minutes: 12,
          teacherMove: 'Require evidence from both sides before students choose the stronger argument.',
          studentTask: 'Write one short paragraph evaluating the stronger support.',
        },
      ],
      cards: pickRows([
        'identify-opposing-claims',
        'compare-evidence-development',
        'evaluate-validity',
        'evaluate-effectiveness',
        'response-counterclaim',
      ]),
    },
  ].filter((lab) => lab.cards.length > 0);
}

function normalizeOfficialTitle(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getSupabaseApiKey() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRole &&
    (serviceRole.startsWith('eyJ') || serviceRole.startsWith('sb_secret_') || serviceRole.length > 80)
  ) {
    return serviceRole;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function hasReadableSourceText(entry: ManifestEntry) {
  return Boolean(entry.text_path || entry.manual_text?.trim());
}

async function readSourceText(entry: ManifestEntry) {
  if (entry.manual_text?.trim()) return entry.manual_text;
  if (!entry.text_path) return '';
  return fs.readFile(path.join(ROOT, entry.text_path), 'utf8').catch(() => '');
}

async function loadSupabaseManualUploadEntries(officialEntries: ManifestEntry[]) {
  supabaseManualUploadEntriesCache ??= loadSupabaseManualUploadEntriesOnce(officialEntries);
  return supabaseManualUploadEntriesCache;
}

async function loadSupabaseManualUploadEntriesOnce(officialEntries: ManifestEntry[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseApiKey();
  if (!url || !key) return [];

  try {
    const officialByTitle = new Map(officialEntries.map((entry) => [normalizeOfficialTitle(entry.title), entry]));
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('source_title, source_author, paragraph_text, word_count, created_at')
      .eq('source', 'manual_rights')
      .not('source_title', 'is', null)
      .order('created_at', { ascending: true })
      .limit(5000);

    if (error) {
      console.warn('[pullOutSheet] manual upload source lookup skipped:', error.message);
      return [];
    }

    const groups = new Map<string, SupabaseManualUploadRow[]>();
    for (const row of (data ?? []) as SupabaseManualUploadRow[]) {
      const key = normalizeOfficialTitle(row.source_title);
      if (!key || !row.paragraph_text?.trim() || !officialByTitle.has(key)) continue;
      const rows = groups.get(key) ?? [];
      rows.push(row);
      groups.set(key, rows);
    }

    return Array.from(groups.entries()).reduce<ManifestEntry[]>((entries, [key, rows]) => {
      const official = officialByTitle.get(key);
      if (!official || official.status === 'stored') return entries;

      const seen = new Set<string>();
      const chunks: string[] = [];
      for (const row of rows) {
        const chunk = row.paragraph_text?.trim();
        if (!chunk) continue;
        const chunkKey = chunk.slice(0, 220).toLowerCase();
        if (seen.has(chunkKey)) continue;
        seen.add(chunkKey);
        chunks.push(chunk);
      }

      const manualText = chunks.join('\n\n').trim();
      if (!manualText) return entries;

      entries.push({
        title: official.title,
        author: rows[0]?.source_author?.trim() || official.author,
        standards: official.standards,
        status: 'manual_upload',
        text_path: null,
        word_count: wordCount(manualText) || official.word_count || 0,
        manual_text: manualText,
      });
      return entries;
    }, []);
  } catch (error) {
    console.warn(
      '[pullOutSheet] manual upload source lookup skipped:',
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

async function loadManifest() {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw) as Manifest;
  const officialByTitle = new Map(
    manifest.entries.map((entry) => [normalizeOfficialTitle(entry.title), entry])
  );
  const manualOverrides = new Map<string, ManifestEntry>();

  try {
    const manualRaw = await fs.readFile(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8');
    const manualManifest = JSON.parse(manualRaw) as ManualUploadManifest;
    const manualEntries = Array.isArray(manualManifest.entries) ? manualManifest.entries : [];
    const archivedEntries = manualEntries
      .reduce<ManifestEntry[]>((entries, manualEntry) => {
        const key = normalizeOfficialTitle(manualEntry.title);
        const official = officialByTitle.get(key);
        if (!official || official.status === 'stored') return entries;
        entries.push({
          title: official.title,
          author: manualEntry.author || official.author,
          standards: official.standards,
          status: 'manual_upload',
          text_path: manualEntry.path,
          word_count: manualEntry.word_count || official.word_count || 0,
        });
        return entries;
      }, []);

    archivedEntries.forEach((entry) => manualOverrides.set(normalizeOfficialTitle(entry.title), entry));
  } catch {
    // Local manual archive is optional; Supabase manual uploads can still fill this layer.
  }

  const supabaseManualEntries = await loadSupabaseManualUploadEntries(manifest.entries);
  for (const entry of supabaseManualEntries) {
    const key = normalizeOfficialTitle(entry.title);
    if (!manualOverrides.has(key)) manualOverrides.set(key, entry);
  }

  if (!manualOverrides.size) return manifest;

  return {
    ...manifest,
    entries: manifest.entries.map((entry) => {
      const key = normalizeOfficialTitle(entry.title);
      return manualOverrides.get(key) ?? entry;
    }),
  };
}

export async function buildPullOutSheet(args: {
  standardCode: string;
  unitName?: string;
  maxRows?: number;
  subSkillId?: string | null;
  sourceTitle?: string | null;
}): Promise<PullOutSheet> {
  const standardCode = args.standardCode;
  const subSkillId = args.subSkillId ?? null;
  const sourceTitle = args.sourceTitle?.trim().toLowerCase() ?? null;
  const maxRows = Math.max(1, Math.min(18, args.maxRows ?? 1));
  const manifest = await loadManifest();
  const sourceEntries = manifest.entries
    .filter((entry) => (entry.status === 'stored' || entry.status === 'manual_upload') && hasReadableSourceText(entry) && entry.standards.includes(standardCode))
    .filter((entry) => !sourceTitle || entry.title.trim().toLowerCase() === sourceTitle)
    .filter(
      (entry) =>
        standardCode !== 'ELA.9.R.1.2' ||
        sourceTitle ||
        /^(?:A White Heron|Old Greek Stories|Icarus and Daedalus|Romeo and Juliet|A Modest Proposal)$/i.test(
          entry.title
        )
    )
    .filter(
      (entry) =>
        standardCode !== 'ELA.9.R.1.3' ||
        sourceTitle ||
        /^(?:A White Heron|Icarus and Daedalus|A Modest Proposal)$/i.test(entry.title)
    )
    .filter(
      (entry) =>
        standardCode !== 'ELA.9.R.2.1' ||
        sourceTitle ||
        /^(?:A Modest Proposal|The Talented Tenth)$/i.test(entry.title)
    )
    .filter(
      (entry) =>
        standardCode !== 'ELA.9.R.2.2' ||
        sourceTitle ||
        /^(?:A Modest Proposal|The Talented Tenth|Industrial Education for the Negro|Letter to the Grand Duchess Christina of Tuscany|Democracy in America|The Prince)$/i.test(
          entry.title
        )
    )
    .filter(
      (entry) =>
        standardCode !== 'ELA.9.R.2.3' ||
        sourceTitle ||
        /^(?:A Modest Proposal|The Talented Tenth|Industrial Education for the Negro|Letter to the Grand Duchess Christina of Tuscany|The Prince|St\. Crispin’s Day Speech)$/i.test(
          entry.title
        )
    )
    .filter(
      (entry) =>
        standardCode !== 'ELA.9.R.3.1' ||
        sourceTitle ||
        /^(?:A White Heron|Romeo and Juliet|The Love Song of J\. Alfred Prufrock|Icarus and Daedalus|Old Greek Stories|Animal Farm|1984|The Death of Ivan Ilyich|The Aeneid)$/i.test(
          entry.title
        )
    )
    .sort((a, b) => b.word_count - a.word_count);

  if (standardCode === 'ELA.9.R.2.4' && (!subSkillId || R24_SUB_SKILLS.some((move) => move.strandId === subSkillId))) {
    const rows = r24DeepGoldRows(maxRows, subSkillId);
    return {
      title: `Pull-Out Sheet — ${args.unitName || `${standardCode} ${STANDARD_LABELS[standardCode] ?? 'Reading Skill'}`}`,
      essentialQuestion:
        STANDARD_ESSENTIAL_QUESTIONS[standardCode] ?? 'How does exact evidence prove the reading skill?',
      standardsCoverageSummary: rows.reduce<Record<string, number>>((map, row) => {
        map[row.standard] = (map[row.standard] ?? 0) + 1;
        return map;
      }, {}),
      rows,
      teacherNotes: [
        'Use a two-column Promethean scaffold: Passage A claim/evidence and Passage B claim/evidence.',
        'Do not let students pick the side they like; force them to judge which support is more relevant and valid.',
        'Grade fast: two claims separated plus anchor question correct equals full credit for the rep.',
      ],
      sourceTexts: sourceEntries.map((entry) => ({
        title: entry.title,
        author: entry.author,
        status: entry.status,
        word_count: entry.word_count,
      })),
    };
  }

  if (standardCode === 'ELA.9.R.3.1' && subSkillId === 'personification-effect') {
    const rows = r31PersonificationGoldRows(maxRows);
    return {
      title: `Pull-Out Sheet — ${args.unitName || `${standardCode} ${STANDARD_LABELS[standardCode] ?? 'Reading Skill'}`}`,
      essentialQuestion:
        STANDARD_ESSENTIAL_QUESTIONS[standardCode] ?? 'How does figurative language create mood?',
      standardsCoverageSummary: rows.reduce<Record<string, number>>((map, row) => {
        map[row.standard] = (map[row.standard] ?? 0) + 1;
        return map;
      }, {}),
      rows,
      teacherNotes: [
        'Use a three-column Promethean scaffold: personified thing, human action, mood or meaning effect.',
        'Make students explain the effect of the personification instead of only naming the device.',
        'Grade fast: exact phrase underlined plus effect explanation plus anchor question correct.',
      ],
      sourceTexts: sourceEntries.map((entry) => ({
        title: entry.title,
        author: entry.author,
        status: entry.status,
        word_count: entry.word_count,
      })),
    };
  }

  if (standardCode === 'ELA.9.R.3.2' && (!subSkillId || R32_SUB_SKILLS.some((move) => move.strandId === subSkillId))) {
    const rows = r32GoldRows(maxRows, subSkillId);
    return {
      title: `Pull-Out Sheet — ${args.unitName || `${standardCode} ${STANDARD_LABELS[standardCode] ?? 'Reading Skill'}`}`,
      essentialQuestion:
        STANDARD_ESSENTIAL_QUESTIONS[standardCode] ?? 'How do I restate grade-level text accurately?',
      standardsCoverageSummary: rows.reduce<Record<string, number>>((map, row) => {
        map[row.standard] = (map[row.standard] ?? 0) + 1;
        return map;
      }, {}),
      rows,
      teacherNotes: [
        'Use a two-step Promethean scaffold: underline the meaning first, then choose the paraphrase.',
        'Force students to explain why wrong answers add, delete, or twist the original idea.',
        'Grade fast: accurate paraphrase plus one sentence explaining the kept meaning equals full credit.',
      ],
      sourceTexts: sourceEntries.map((entry) => ({
        title: entry.title,
        author: entry.author,
        status: entry.status,
        word_count: entry.word_count,
      })),
    };
  }

  if (standardCode === 'ELA.9.R.3.4' && (!subSkillId || R34_SUB_SKILLS.some((move) => move.strandId === subSkillId))) {
    const rows = await r34GoldRows(maxRows, sourceEntries);
    return {
      title: `Pull-Out Sheet — ${args.unitName || `${standardCode} ${STANDARD_LABELS[standardCode] ?? 'Reading Skill'}`}`,
      essentialQuestion:
        STANDARD_ESSENTIAL_QUESTIONS[standardCode] ?? 'How does rhetoric shape the reader?',
      standardsCoverageSummary: rows.reduce<Record<string, number>>((map, row) => {
        map[row.standard] = (map[row.standard] ?? 0) + 1;
        return map;
      }, {}),
      rows,
      teacherNotes: [
        'Use a three-column Promethean scaffold: rhetorical move, reader effect, author purpose.',
        'Do not let students stop at device labels; they must explain what the language does to the reader.',
        'Grade fast: exact rhetoric underlined plus reader-effect explanation plus anchor question correct.',
      ],
      sourceTexts: sourceEntries.map((entry) => ({
        title: entry.title,
        author: entry.author,
        status: entry.status,
        word_count: entry.word_count,
      })),
    };
  }

  if (standardCode === 'ELA.9.V.1.1' || standardCode === 'ELA.9.V.1.2' || standardCode === 'ELA.9.V.1.3') {
    const rows = vocabularyGoldRows(standardCode, maxRows, subSkillId);
    return {
      title: `Pull-Out Sheet — ${args.unitName || `${standardCode} ${STANDARD_LABELS[standardCode] ?? 'Vocabulary Skill'}`}`,
      essentialQuestion:
        STANDARD_ESSENTIAL_QUESTIONS[standardCode] ?? 'How does context prove word meaning?',
      standardsCoverageSummary: rows.reduce<Record<string, number>>((map, row) => {
        map[row.standard] = (map[row.standard] ?? 0) + 1;
        return map;
      }, {}),
      rows,
      teacherNotes: [
        'Use a three-step Promethean scaffold: target word, clue, meaning.',
        'For V.1.2, force students to confirm word-part clues with sentence context.',
        'For V.1.3, force students to explain why a familiar synonym is wrong in this exact context.',
      ],
      sourceTexts: sourceEntries.map((entry) => ({
        title: entry.title,
        author: entry.author,
        status: entry.status,
        word_count: entry.word_count,
      })),
    };
  }

  const candidates: Array<{
    entry: ManifestEntry;
    paragraph: string;
    paragraphNumber: number;
    paragraphEndNumber?: number;
    score: number;
  }> = [];

  for (const entry of sourceEntries.slice(0, 12)) {
    if (!hasReadableSourceText(entry)) continue;
    const raw = await readSourceText(entry);
    const paragraphs = paragraphize(raw);
    if (
      standardCode === 'ELA.9.R.2.1' ||
      standardCode === 'ELA.9.R.2.2' ||
      standardCode === 'ELA.9.R.2.3'
    )
      continue;
    paragraphs.forEach((paragraph, index) => {
      const score =
        scoreParagraph(standardCode, paragraph) +
        scoreForSubSkill(subSkillId, paragraph) +
        goldSetPriorityBonus(subSkillId, paragraph);
      if (score > 0) {
        candidates.push({ entry, paragraph, paragraphNumber: index + 1, score });
      }
    });
  }

  if (standardCode === 'ELA.9.R.3.2' && subSkillId) {
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        const paragraphSentences = sentences(paragraph);
        const windows = [
          ...paragraphSentences.map((sentence) => ({ text: sentence, start: index + 1, end: index + 1 })),
          ...paragraphSentences.slice(0, -1).map((sentence, sentenceIndex) => ({
            text: `${sentence} ${paragraphSentences[sentenceIndex + 1]}`.replace(/\s+/g, ' ').trim(),
            start: index + 1,
            end: index + 1,
          })),
          { text: paragraph, start: index + 1, end: index + 1 },
        ]
          .map((window) => ({ ...window, text: window.text.replace(/\s+/g, ' ').trim() }))
          .filter((window) => {
            const words = wordCount(window.text);
            return words >= 35 && words <= 220 && passesSubSkillClassroomGate(subSkillId, window.text);
          });

        windows.forEach((window, windowIndex) => {
          candidates.push({
            entry,
            paragraph: window.text,
            paragraphNumber: window.start,
            paragraphEndNumber: window.end,
            score:
              9800 -
              index -
              windowIndex +
              scoreForSubSkill(subSkillId, window.text) +
              goldSetPriorityBonus(subSkillId, window.text),
          });
        });
      });
    }
  }

  if (standardCode === 'ELA.9.R.1.1' && subSkillId === 'style-technique-layer') {
    const oldGreek = sourceEntries.find((entry) => entry.title === 'Old Greek Stories' && hasReadableSourceText(entry));
    if (oldGreek && hasReadableSourceText(oldGreek)) {
      const raw = await readSourceText(oldGreek);
      const paragraphs = paragraphize(raw);
      const mirrorIndex = paragraphs.findIndex((paragraph) => /\bas in a mirror\b/i.test(paragraph));
      if (mirrorIndex >= 0) {
        candidates.push({
          entry: oldGreek,
          paragraph: paragraphs[mirrorIndex],
          paragraphNumber: mirrorIndex + 1,
          score: 10000,
        });
      }
    }
  }

  if (standardCode === 'ELA.9.R.1.4' && subSkillId === 'in-medias-res') {
    const openingSignals = [
      /\bArms, and the man I sing\b/i,
      /\bTell me, O Muse\b/i,
      /\bSo now all who escaped death in battle or by shipwreck\b/i,
      /\bAll were attentive to the godlike man\b/i,
      /\bO goddess-born[^.?!]*escape\b/i,
      /\bThe foes already have possess[’']d the wall\b/i,
      /\bI heard; and Heav[’']n\b/i,
      /\bTo run where clashing arms and clamour calls\b/i,
      /\bA son and heir, young in his dwelling\b/i,
      /\bSing, O goddess\b/i,
    ];

    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        if (openingSignals.some((pattern) => pattern.test(paragraph))) {
          candidates.push({
            entry,
            paragraph,
            paragraphNumber: index + 1,
            score: 10000 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.1.4' && subSkillId === 'quest-journey-structure') {
    const questSignals = [
      /\bTell me, O Muse[^.?!]*travelled far and wide\b/i,
      /\bbring his men safely home\b/i,
      /\bdetained by the goddess Calypso\b/i,
      /\bgo back to Ithaca\b/i,
      /\bgot to the land[^.?!]*great cave\b/i,
      /\bgot from under the ram\b/i,
      /\bdrive them down to the ship\b/i,
      /\bArms, and the man I sing[^.?!]*forc[’']d by fate\b/i,
      /\bleft the Trojan shore\b/i,
      /\bTrojans reign in Italy\b/i,
      /\bhappy course\b/i,
      /\bGrecian navy burn\b/i,
      /\bTack to the larboard\b/i,
      /\bstand off to sea\b/i,
      /\bVeer starboard sea and land\b/i,
      /\bLatian shore\b/i,
      /\bItalian shore\b/i,
      /\bForsake the pleasing shore\b/i,
      /\bplow the deep\b/i,
    ];

    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        if (questSignals.some((pattern) => pattern.test(paragraph))) {
          candidates.push({
            entry,
            paragraph,
            paragraphNumber: index + 1,
            score: 9700 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.1.2' && subSkillId) {
    const r12GoldSignals: Record<string, RegExp[]> = {
      'universal-theme': [
        /\bNo, she must keep silence\b/i,
        /\bshe cannot tell the heron[’']s secret\b/i,
        /\bLove is a smoke\b/i,
        /\bO brawling love\b/i,
        /\bthey loved themselves better than their brother\b/i,
        /\bfilled with grief and rage\b/i,
      ],
      'theme-development-moments': [
        /\bIt was not long until they learned to cook their food\b/i,
        /\bThey began at once to leave off their wild and savage habits\b/i,
        /\bhe forgot everything in the world but joy\b/i,
        /\bThere was a terror in the joy\b/i,
        /\bAlas for him\b/i,
        /\bThe heat of the sun had melted the wax\b/i,
        /\bprecious spark hidden in the hollow center of the plant\b/i,
        /\bnever would he beg for mercy\b/i,
        /\bmountain was no longer savage and wild\b/i,
        /\bvalley was no longer dark and lonely\b/i,
        /\bNo, she must keep silence\b/i,
      ],
      'theme-through-conflict': [
        /\bTwo households, both alike in dignity\b/i,
        /\bancient grudge break to new mutiny\b/i,
        /\bhuge serpent called the Python\b/i,
        /\bcarried them up to his dreadful den\b/i,
        /\bNo young man had ever spoken to her before\b/i,
        /\bfilled her heart with fear\b/i,
        /\bO Father Peneus, save me\b/i,
        /\bPerseus drew his sharp sword and cut the chain\b/i,
        /\bsea monster was close at hand\b/i,
        /\bopening his wide jaws\b/i,
        /\bDeath is my son-in-law\b/i,
        /\blife, living, all is death\b/i,
        /\bhang, beg, starve, die\b/i,
      ],
    };

    const signals = r12GoldSignals[subSkillId] ?? [];
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        if (signals.some((pattern) => pattern.test(paragraph))) {
          candidates.push({
            entry,
            paragraph,
            paragraphNumber: index + 1,
            score: 9500 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.1.3' && subSkillId) {
    const r13GoldSignals: Record<string, RegExp[]> = {
      'narrator-perspective': [
        /\bSylvia’s heart gave a wild beat\b/i,
        /\bshe knew that strange white bird\b/i,
        /\bthe sea which Sylvia wondered and dreamed about\b/i,
        /\bsmall and hopeful Sylvia\b/i,
        /\butmost bravery\b/i,
        /\bknew that higher still\b/i,
        /\bNo, she must keep silence\b/i,
        /\bshe cannot tell the heron[’']s secret\b/i,
        /\bWondering over and over again\b/i,
        /\bThe guest waked from a dream\b/i,
        /\bHe was sure\b/i,
        /\bAlas for him\b/i,
        /\bin that terror he remembered\b/i,
        /\bhe forgot everything in the world but joy\b/i,
      ],
      'irony-reversal-contrast': [
        /\bI shall now therefore humbly propose\b/i,
        /\bnot be liable to the least objection\b/i,
        /\bdelicious nourishing and wholesome food\b/i,
        /\bInfant[’']?s flesh\b/i,
        /\bcollateral advantage\b/i,
        /\blessening the number of Papists\b/i,
        /\bI profess in the sincerity of my heart\b/i,
        /\bnot the least personal interest\b/i,
        /\bno other motive than the publick good\b/i,
        /\bpublick good of my country\b/i,
        /\bgiving some pleasure to the rich\b/i,
        /\bAlas for him\b/i,
        /\bThe heat of the sun had melted the wax\b/i,
        /\bHe was sure\b/i,
        /\bNo, she must keep silence\b/i,
      ],
      'satire-exaggeration-ridicule': [
        /\bI shall now therefore humbly propose\b/i,
        /\bnot be liable to the least objection\b/i,
        /\bdelicious nourishing and wholesome food\b/i,
        /\bcollateral advantage\b/i,
        /\blessening the number of Papists\b/i,
        /\boffered in sale\b/i,
        /\breserved for breed\b/i,
        /\bInfant[’']?s flesh\b/i,
        /\bfattest child to the market\b/i,
        /\bno other motive than the publick good\b/i,
      ],
    };

    const signals = r13GoldSignals[subSkillId] ?? [];
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        if (signals.some((pattern) => pattern.test(paragraph))) {
          candidates.push({
            entry,
            paragraph,
            paragraphNumber: index + 1,
            score: 9400 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.2.1' && subSkillId) {
    const r21GoldSignals: Record<string, RegExp[]> = {
      'chronological-sequence': [
        /\bthree tasks lay before me; first\b/i,
        /\bsecondly, to show\b/i,
        /\bthirdly, to show\b/i,
        /\bAs early as 1826\b/i,
        /\bfrom that time till to-day\b/i,
        /\bFor first, as I have already observed\b/i,
        /\bThirdly, Whereas\b/i,
        /\bFifthly, This food\b/i,
        /\bSixthly, This would\b/i,
      ],
      'cause-effect-structure': [
        /\band therefore whoever could find out\b/i,
        /\btherefore, reckoning a year after Lent\b/i,
        /\btherefore it will have one other collateral advantage\b/i,
        /\bwill be thereby encreased\b/i,
        /\bconsequently have their houses frequented\b/i,
        /\bhas resulted in sending\b/i,
        /\bIf carpenters are needed\b/i,
      ],
      'compare-contrast-structure': [
        /\binstead of being able to work\b/i,
        /\binstead of seeking that personal freedom\b/i,
        /\bfrom the top downward\b/i,
        /\bnot at the top but at the bottom\b/i,
        /\bI would not deny\b/i,
        /\bbut I _do_ say\b/i,
        /\bwhile the Negro teachers have been discouraged\b/i,
        /\bNevertheless, I insist\b/i,
        /\bnot to make men carpenters\b/i,
        /\bit is to make carpenters men\b/i,
        /\bit is only fair to point out\b/i,
        /\bvery far from being confined\b/i,
        /\bmore than we allow to sheep\b/i,
        /\bbut more plentiful in March\b/i,
      ],
      'problem-solution-structure': [
        /\bmelancholy object\b/i,
        /\bgreat additional grievance\b/i,
        /\bfair, cheap and easy method\b/i,
        /\bwhat course may be taken\b/i,
        /\bHow then shall the leaders\b/i,
        /\bThere can be but one answer\b/i,
        /\bproper training of Negro children\b/i,
      ],
      'example-evidence-structure': [
        /\bFor instance\b/i,
        /\bThese figures illustrate\b/i,
        /\bthere are to-day in the United States thirty-four institutions\b/i,
        /\bOf these graduates\b/i,
        /\breturns as to occupations\b/i,
        /\bI will give you an instance\b/i,
      ],
      'opening-closing-shift': [
        /\bIf this be true--and who can deny it--three tasks lay before me\b/i,
        /\bHow then shall the leaders\b/i,
        /\bLet us see\b/i,
        /\bBut, as to myself\b/i,
        /\bI profess in the sincerity of my heart\b/i,
        /\bThe truth of this has been strikingly shown\b/i,
        /\bThe most interesting question\b/i,
        /\bIn earlier years\b/i,
        /\bNevertheless, I insist\b/i,
      ],
    };

    const signals = r21GoldSignals[subSkillId] ?? [];
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        if (signals.some((pattern) => pattern.test(paragraph))) {
          const windowOptions = [
            paragraphs.slice(index, index + 3),
            paragraphs.slice(index, index + 2),
            paragraphs.slice(Math.max(0, index - 1), index + 2),
            paragraphs.slice(Math.max(0, index - 1), index + 1),
            [paragraph],
          ]
            .map((items) => items.filter(Boolean))
            .filter((items) => items.length > 0)
            .map((items) => ({
              items,
              text: items.join('\n\n'),
              startIndex: paragraphs.indexOf(items[0]),
            }));
          const bestWindow =
            windowOptions.find((option) => {
              const words = wordCount(option.text);
              return words >= 180 && words <= 380;
            }) ??
            windowOptions.find((option) => {
              const words = wordCount(option.text);
              return words >= 140 && words <= 420;
            }) ??
            windowOptions[0];

          if (!bestWindow) return;
          const startIndex = bestWindow.startIndex >= 0 ? bestWindow.startIndex : index;
          const endIndex = startIndex + bestWindow.items.length - 1;
          candidates.push({
            entry,
            paragraph: bestWindow.text,
            paragraphNumber: startIndex + 1,
            paragraphEndNumber: endIndex + 1,
            score: 9300 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.2.2' && subSkillId) {
    const r22GoldSignals: Record<string, RegExp[]> = {
      'central-idea-stated-implied': [
        /\bIt is a melancholy object\b/i,
        /\bThe question therefore is\b/i,
        /\bThe most interesting question\b/i,
        /\bIf this be true--and who can deny it--three tasks lay before me\b/i,
        /\bHow then shall the leaders\b/i,
        /\bThere can be but one answer\b/i,
        /\bI shall now therefore humbly propose\b/i,
        /\bI do therefore humbly offer it to publick consideration\b/i,
        /\bI think the advantages by the proposal\b/i,
        /\bThe truth of this has been strikingly shown\b/i,
        /\bThe whole fabric of science\b/i,
        /\bI say, therefore\b/i,
        /\bI conclude, therefore\b/i,
        /\bIt is necessary, therefore\b/i,
        /\bThe wise prince, therefore\b/i,
      ],
      'strong-vs-weak-evidence': [
        /\bThese figures illustrate\b/i,
        /\bthere are to-day in the United States thirty-four institutions\b/i,
        /\bOf these graduates\b/i,
        /\breturns as to occupations\b/i,
        /\bFor instance\b/i,
        /\bcomputed the charge\b/i,
        /\bproper training of Negro children\b/i,
      ],
      'evidence-develops-central-idea': [
        /\bThese figures illustrate\b/i,
        /\bThe truth of this has been strikingly shown\b/i,
        /\bthere are to-day in the United States thirty-four institutions\b/i,
        /\bOf these graduates\b/i,
        /\breturns as to occupations\b/i,
        /\bFor instance\b/i,
        /\btherefore it will have one other collateral advantage\b/i,
        /\bhas resulted in sending\b/i,
      ],
      'best-evidence-for-claim': [
        /\bThese figures illustrate\b/i,
        /\bthere are to-day in the United States thirty-four institutions\b/i,
        /\bOf these graduates\b/i,
        /\breturns as to occupations\b/i,
        /\bFor instance\b/i,
        /\bcomputed the charge\b/i,
        /\bwill be thereby encreased\b/i,
      ],
      'detail-vs-central-idea': [
        /\bFor instance\b/i,
        /\bcomputed the charge\b/i,
        /\bthere are to-day\b/i,
        /\bOf these graduates\b/i,
        /\bmore plentiful in March\b/i,
        /\bI grant this food will be somewhat dear\b/i,
      ],
      'central-idea-development-across-paragraphs': [
        /\bthree tasks lay before me\b/i,
        /\bHow then shall the leaders\b/i,
        /\bThere can be but one answer\b/i,
        /\bThese figures illustrate\b/i,
        /\bThe most interesting question\b/i,
        /\bNevertheless, I insist\b/i,
        /\bThe truth of this has been strikingly shown\b/i,
      ],
    };

    const signals = r22GoldSignals[subSkillId] ?? [];
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphize(raw);
      paragraphs.forEach((paragraph, index) => {
        if (signals.some((pattern) => pattern.test(paragraph))) {
          const windowOptions = [
            paragraphs.slice(index, index + 3),
            paragraphs.slice(index, index + 2),
            paragraphs.slice(Math.max(0, index - 1), index + 2),
            paragraphs.slice(Math.max(0, index - 1), index + 1),
            [paragraph],
          ]
            .map((items) => items.filter(Boolean))
            .filter((items) => items.length > 0)
            .map((items) => ({
              items,
              text: items.join('\n\n'),
              startIndex: paragraphs.indexOf(items[0]),
            }));
          const bestWindow =
            windowOptions.find((option) => {
              const words = wordCount(option.text);
              return words >= 180 && words <= 380;
            }) ??
            windowOptions.find((option) => {
              const words = wordCount(option.text);
              return words >= 140 && words <= 420;
            }) ??
            windowOptions[0];

          if (!bestWindow) return;
          const startIndex = bestWindow.startIndex >= 0 ? bestWindow.startIndex : index;
          const endIndex = startIndex + bestWindow.items.length - 1;
          candidates.push({
            entry,
            paragraph: bestWindow.text,
            paragraphNumber: startIndex + 1,
            paragraphEndNumber: endIndex + 1,
            score: 9300 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.2.3' && subSkillId) {
    const r23GoldSignals: Record<string, RegExp[]> = {
      'logos-ethos-pathos': [
        /\bIt is a melancholy object\b/i,
        /\bI shall now therefore humbly propose\b/i,
        /\bI have been assured by a very knowing American\b/i,
        /\bcomputed the charge\b/i,
        /\bIt has been necessary\b/i,
        /\bworked and working\b/i,
        /\bWe few, we happy few\b/i,
        /\bfewer men, the greater share of honour\b/i,
        /\bHow then shall the leaders\b/i,
        /\bThere can be but one answer\b/i,
        /\bThese figures illustrate\b/i,
        /\bI profess in the sincerity of my heart\b/i,
      ],
      'logos-evidence-reasoning': [
        /\bcomputed the charge\b/i,
        /\bthousand families\b/i,
        /\bpounds\b/i,
        /\bprofit\b/i,
        /\bThese figures illustrate\b/i,
        /\bthere are to-day in the United States thirty-four institutions\b/i,
        /\bOf these graduates\b/i,
        /\breturns as to occupations\b/i,
        /\btherefore it will have one other collateral advantage\b/i,
        /\beighty-five per cent\b/i,
        /\bFor two hundred and fifty years\b/i,
        /\bindustrial development\b/i,
        /\bI conclude, therefore\b/i,
        /\bno principality is secure\b/i,
        /\bown forces\b/i,
        /\bFor first\b/i,
        /\bSecondly\b/i,
        /\bThirdly\b/i,
      ],
      'ethos-credibility-authority': [
        /\bI have been assured by a very knowing American\b/i,
        /\bI profess in the sincerity of my heart\b/i,
        /\bnot the least personal interest\b/i,
        /\bno other motive than the publick good\b/i,
        /\bwe are told by a grave author\b/i,
        /\bScripture\b/i,
        /\bliving oracles\b/i,
        /\bNevertheless, I insist\b/i,
        /\bMr\. C\.P\. Huntington\b/i,
        /\blate beloved Frederick Douglass\b/i,
        /\bIn the words of\b/i,
        /\bI do not mean in any way to apologize\b/i,
        /\bI would set no limits\b/i,
        /\bI am assured by our merchants\b/i,
        /\bwe are told by a grave author\b/i,
        /\bA very worthy person\b/i,
        /\bopinion and judgment of wise men\b/i,
        /\bmany have written on this point\b/i,
        /\bour experience has been\b/i,
      ],
      'pathos-emotional-appeal': [
        /\bIt is a melancholy object\b/i,
        /\bbeggars of the female sex\b/i,
        /\bchildren, all in rags\b/i,
        /\bimportuning every passenger for an alms\b/i,
        /\bgreat additional grievance\b/i,
        /\bpoor innocent babes\b/i,
        /\bdeplorable state\b/i,
        /\bworked meant degradation\b/i,
        /\bcurse of slavery\b/i,
        /\bidleness disgraceful\b/i,
        /\bWe few, we happy few\b/i,
        /\bsheds his blood with me\b/i,
      ],
      'rhetorical-question-repetition': [
        /\bHow then shall the leaders\b/i,
        /\bWas the work\b/i,
        /\bThe most interesting question\b/i,
        /\bThe question therefore\b/i,
        /\bFor first\b/i,
        /\bSecondly\b/i,
        /\bThirdly\b/i,
        /\bFifthly\b/i,
        /\bSixthly\b/i,
        /\bIt has been necessary\b/i,
        /\bHe that out-lives this day\b/i,
        /\bThis day is call\b/i,
        /\bCrispian\b/i,
        /\bWe few, we happy few\b/i,
      ],
      'figurative-language-purpose': [
        /\bmelancholy object\b/i,
        /\bwhole fabric of science\b/i,
        /\bliving oracles\b/i,
        /\bbook of nature\b/i,
        /\buniverse stands continually open\b/i,
        /\bbarbarous dominion stinks\b/i,
        /\bswallow up our people\b/i,
        /\beconomic foundation\b/i,
        /\blaying the foundation\b/i,
        /\braging rivers\b/i,
        /\bband of brothers\b/i,
        /\bhousehold words\b/i,
      ],
      'purpose-fit-rhetorical-choice': [
        /\bI shall now therefore humbly propose\b/i,
        /\bI do therefore humbly offer it to publick consideration\b/i,
        /\bI think the advantages by the proposal\b/i,
        /\bcomputed the charge\b/i,
        /\bHow then shall the leaders\b/i,
        /\bThere can be but one answer\b/i,
        /\bThese figures illustrate\b/i,
        /\bI profess in the sincerity of my heart\b/i,
        /\bI close, then, as I began\b/i,
        /\bas a freeman he must learn to work\b/i,
        /\bfewer men, the greater share of honour\b/i,
        /\bIf, therefore, your illustrious house\b/i,
        /\bThis opportunity, therefore\b/i,
        /\bI compare her to one of those raging rivers\b/i,
      ],
    };

    const signals = r23GoldSignals[subSkillId] ?? [];
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = paragraphizeRhetoric(raw);
      paragraphs.forEach((paragraph, index) => {
        if (signals.some((pattern) => pattern.test(paragraph))) {
          const windowOptions = [
            paragraphs.slice(index, index + 3),
            paragraphs.slice(index, index + 2),
            paragraphs.slice(Math.max(0, index - 1), index + 2),
            paragraphs.slice(Math.max(0, index - 1), index + 1),
            [paragraph],
          ]
            .map((items) => items.filter(Boolean))
            .filter((items) => items.length > 0)
            .map((items) => ({
              items,
              text: items.join('\n\n'),
              startIndex: paragraphs.indexOf(items[0]),
            }));
          const bestWindow =
            windowOptions.find((option) => {
              const words = wordCount(option.text);
              return words >= 160 && words <= 360;
            }) ??
            windowOptions.find((option) => {
              const words = wordCount(option.text);
              return words >= 120 && words <= 420;
            }) ??
            windowOptions[0];

          if (!bestWindow) return;
          const startIndex = bestWindow.startIndex >= 0 ? bestWindow.startIndex : index;
          const endIndex = startIndex + bestWindow.items.length - 1;
          candidates.push({
            entry,
            paragraph: bestWindow.text,
            paragraphNumber: startIndex + 1,
            paragraphEndNumber: endIndex + 1,
            score: 9250 - index,
          });
        }
      });
    }
  }

  if (standardCode === 'ELA.9.R.3.1' && subSkillId) {
    const r31GoldSignals: Record<string, RegExp[]> = {
      'metaphor-simile': [
        /\bLove is a smoke\b/i,
        /\blike a patient etheri[sz]ed upon a table\b/i,
        /\blike a pale star\b/i,
        /\bas soft as moths\b/i,
        /\bas if she too could go flying away among the clouds\b/i,
        /\blike two dragon-flies\b/i,
        /\bas though it were a heap of dry chaff\b/i,
        /\bas though he would swallow\b/i,
        /\blike hounds in the chase\b/i,
      ],
      'personification-effect': [
        /\byellow fog that rubs its back\b/i,
        /\byellow smoke that rubs its muzzle\b/i,
        /\bThe night, proceeding on with silent pace\b/i,
        /\bsun withdrawn his radiant light\b/i,
        /\bview[’']d with equal face\b/i,
        /\bthe fireplace confronted him\b/i,
        /\bfurniture[^.!?]*intolerable inquiry\b/i,
        /\bthe roof had turned itself into a gymnasium\b/i,
        /\bold pine must have loved his new dependent\b/i,
        /\bThe tree seemed to lengthen itself out\b/i,
      ],
      'imagery-sensory-language': [
        /\bwoods were already filled with shadows\b/i,
        /\bdusky shades of night\b/i,
        /\byellow fog\b/i,
        /\byellow smoke\b/i,
        /\bfinest powder\b/i,
        /\bcold which was not of frost\b/i,
        /\bsavage and wild\b/i,
        /\blonely and dark\b/i,
        /\bbright green swamp grass\b/i,
      ],
      'symbol-object-meaning': [
        /\bwhite heron\b/i,
        /\bshe cannot tell the heron[’']s secret\b/i,
        /\bgolden apples?\b/i,
        /\buntasted wine\b/i,
        /\bflat and filmy\b/i,
        /\bhead of Medusa\b/i,
        /\bturned into stone\b/i,
      ],
      'mood-shift-effect': [
        /\bno longer savage and wild\b/i,
        /\bno longer dark and lonely\b/i,
        /\bterror in the joy\b/i,
        /\bforgot everything in the world but joy\b/i,
        /\bThen one day\b/i,
        /\bNow had the sun withdrawn\b/i,
      /\bno threat[’']?ning tempest\b/i,
      /\bIn the place of death there was light\b/i,
      /\bDeath is over\b/i,
      /\bThere was no terror\b/i,
      ],
    };

    const signals = r31GoldSignals[subSkillId] ?? [];
    for (const entry of sourceEntries) {
      if (!hasReadableSourceText(entry)) continue;
      const raw = await readSourceText(entry);
      const paragraphs = figurativeWindows(raw, signals);
      paragraphs.forEach((paragraph, index) => {
        if (signals.some((pattern) => pattern.test(paragraph))) {
          candidates.push({
            entry,
            paragraph,
            paragraphNumber: index + 1,
            score: 9200 - index,
          });
        }
      });
    }
  }

  const rows = candidates
    .sort((a, b) => b.score - a.score)
    .filter((candidate) => {
      if (subSkillId && scoreForSubSkill(subSkillId, candidate.paragraph) <= 0) {
        return false;
      }
      if (!passesSubSkillClassroomGate(subSkillId, candidate.paragraph)) {
        return false;
      }
      if (subSkillId === 'quest-journey-structure' && !isStrongQuestExcerpt(candidate.paragraph)) {
        return false;
      }
      return true;
    })
    .map((candidate, index): PullOutRow => {
      const rowSubSkillId = classifyPullOutSubSkill(standardCode, candidate.paragraph, subSkillId);
      const skillFocus = skillFocusFor(standardCode, candidate.paragraph, rowSubSkillId);
      const evidencePoints = evidencePointsFor(standardCode, candidate.paragraph, rowSubSkillId);
      const question = anchorQuestion(standardCode, candidate.paragraph, index, rowSubSkillId);
      const instructionalSupport = instructionalSupportFor(standardCode, rowSubSkillId, skillFocus);
      return {
        number: index + 1,
        standard: standardCode.replace('ELA.9.', ''),
        subSkillId: rowSubSkillId,
        skillFocus,
        selection: `${candidate.entry.title}${candidate.entry.author ? ` — ${candidate.entry.author}` : ''}`,
        exactLinesOrParagraphs:
          candidate.paragraphEndNumber && candidate.paragraphEndNumber !== candidate.paragraphNumber
            ? `paragraphs ${candidate.paragraphNumber}-${candidate.paragraphEndNumber}`
            : `paragraph ${candidate.paragraphNumber}`,
        excerpt: candidate.paragraph,
        structureWindow:
          candidate.paragraphEndNumber && candidate.paragraphEndNumber !== candidate.paragraphNumber
            ? {
                startParagraph: candidate.paragraphNumber,
                endParagraph: candidate.paragraphEndNumber,
                paragraphCount: candidate.paragraphEndNumber - candidate.paragraphNumber + 1,
              }
            : undefined,
        whyThisExcerpt: whyThisExcerpt(standardCode, rowSubSkillId),
        moveStatementTemplate: moveTemplate(standardCode, rowSubSkillId),
        instructionalSupport,
        qualityGate: qualityGateFor({
          standard: standardCode,
          subSkillId: rowSubSkillId,
          skillFocus,
          excerpt: candidate.paragraph,
          question,
          evidencePoints,
          instructionalSupport,
        }),
        teacherTrust: teacherTrustFor({
          standard: standardCode,
          excerpt: candidate.paragraph,
          evidencePoints,
          skillFocus,
        }),
        anchorQuestion: question,
      };
    })
    .filter((row, _index, allRows) =>
      allRows.findIndex(
        (item) =>
          item.selection === row.selection &&
          item.exactLinesOrParagraphs === row.exactLinesOrParagraphs &&
          item.subSkillId === row.subSkillId
      ) === _index
    )
    .filter((row) => row.teacherTrust.confidence === 'strong' || !subSkillId)
    .filter((row, _index, allRows) => {
      const textRows = allRows.filter((item) => item.selection === row.selection);
      const rowIndexForText = textRows.findIndex(
        (item) => item.exactLinesOrParagraphs === row.exactLinesOrParagraphs
      );
      const maxRowsPerText =
        subSkillId === 'plot-conflict-layer' ||
        subSkillId === 'characterization-layer' ||
        subSkillId === 'point-of-view-layer' ||
        subSkillId === 'theme-tone-layer' ||
        subSkillId === 'style-technique-layer' ||
        subSkillId === 'universal-theme' ||
        subSkillId === 'theme-development-moments' ||
        subSkillId === 'theme-through-conflict' ||
        subSkillId === 'narrator-perspective' ||
        subSkillId === 'irony-reversal-contrast' ||
        subSkillId === 'satire-exaggeration-ridicule' ||
        subSkillId === 'chronological-sequence' ||
        subSkillId === 'cause-effect-structure' ||
        subSkillId === 'compare-contrast-structure' ||
        subSkillId === 'problem-solution-structure' ||
        subSkillId === 'example-evidence-structure' ||
        subSkillId === 'opening-closing-shift' ||
        subSkillId === 'central-idea-stated-implied' ||
        subSkillId === 'strong-vs-weak-evidence' ||
        subSkillId === 'evidence-develops-central-idea' ||
        subSkillId === 'best-evidence-for-claim' ||
        subSkillId === 'detail-vs-central-idea' ||
        subSkillId === 'central-idea-development-across-paragraphs' ||
        subSkillId === 'logos-ethos-pathos' ||
        subSkillId === 'logos-evidence-reasoning' ||
        subSkillId === 'ethos-credibility-authority' ||
        subSkillId === 'pathos-emotional-appeal' ||
        subSkillId === 'rhetorical-question-repetition' ||
        subSkillId === 'figurative-language-purpose' ||
        subSkillId === 'purpose-fit-rhetorical-choice' ||
        subSkillId === 'metaphor-simile' ||
        subSkillId === 'personification-effect' ||
        subSkillId === 'imagery-sensory-language' ||
        subSkillId === 'symbol-object-meaning' ||
        subSkillId === 'mood-shift-effect' ||
        subSkillId === 'chunk-complex-syntax' ||
        subSkillId === 'preserve-original-meaning' ||
        subSkillId === 'translate-archaic-or-formal-language' ||
        subSkillId === 'paraphrase-claim-or-theme' ||
        subSkillId === 'in-medias-res' ||
        subSkillId === 'divine-intervention' ||
        subSkillId === 'epic-hero-traits' ||
        subSkillId === 'quest-journey-structure' ||
        subSkillId === 'ritual-speech-oath' ||
        subSkillId === 'theme-through-heroic-action' ||
        subSkillId === 'elevated-style-epic-simile'
          ? 5
          : 3;
      return rowIndexForText < maxRowsPerText;
    })
    .slice(0, maxRows)
    .map((row, index) => ({ ...row, number: index + 1 }));

  return {
    title: `Pull-Out Sheet — ${args.unitName || `${standardCode} ${STANDARD_LABELS[standardCode] ?? 'Reading Skill'}`}`,
    essentialQuestion:
      STANDARD_ESSENTIAL_QUESTIONS[standardCode] ?? 'How does exact evidence prove the reading skill?',
    standardsCoverageSummary: rows.reduce<Record<string, number>>((map, row) => {
      map[row.standard] = (map[row.standard] ?? 0) + 1;
      return map;
    }, {}),
    rows,
    teacherNotes: [
      'Promethean routine: project one paragraph, students paraphrase first, then apply the skill strategy.',
      'Grade fast: Cornell notes complete plus anchor question correct equals full credit for the rep.',
      'For literary standards, use a three-column chart: evidence, element/move, effect.',
      'For informational standards, use claim/support or structure/purpose charts.',
      'Use one row as a 15-minute mini lesson or stack 4–5 rows into an 80-minute Cornell block.',
    ],
    sourceTexts: sourceEntries.map((entry) => ({
      title: entry.title,
      author: entry.author,
      status: entry.status,
      word_count: entry.word_count,
    })),
  };
}

function textOption(entry: ManifestEntry) {
  return {
    title: entry.title,
    author: entry.author,
    status: entry.status,
    wordCount: entry.word_count,
    standards: entry.standards,
    hasLocalText: (entry.status === 'stored' || entry.status === 'manual_upload') && hasReadableSourceText(entry),
  };
}

export async function buildTextTeachingMap(args: {
  title?: string | null;
  maxRowsPerStandard?: number;
}): Promise<TextTeachingMap> {
  const manifest = await loadManifest();
  const texts = manifest.entries
    .map(textOption)
    .sort((a, b) => a.title.localeCompare(b.title));

  const requestedTitle = args.title?.trim().toLowerCase();
  const selectedEntry =
    manifest.entries.find((entry) => entry.title.trim().toLowerCase() === requestedTitle) ??
    manifest.entries.find((entry) => (entry.status === 'stored' || entry.status === 'manual_upload') && hasReadableSourceText(entry)) ??
    manifest.entries[0] ??
    null;

  if (!selectedEntry) {
    return {
      selectedText: null,
      texts,
      standards: [],
      emptyState: 'No official Grade 9 texts are registered yet.',
    };
  }

  const selectedText = textOption(selectedEntry);
  const maxRows = Math.max(1, Math.min(5, args.maxRowsPerStandard ?? 2));
  const standards = [];

  if (selectedText.hasLocalText) {
    for (const standardCode of selectedEntry.standards) {
      const sheet = await buildPullOutSheet({
        standardCode,
        maxRows,
        sourceTitle: selectedEntry.title,
      });
      standards.push({
        code: standardCode,
        title: STANDARD_LABELS[standardCode] ?? 'Official benchmark',
        readyPullOuts: sheet.rows.filter((row) => row.teacherTrust.confidence === 'strong').length,
        rows: sheet.rows,
      });
    }
  }

  return {
    selectedText,
    texts,
    standards,
    emptyState: selectedText.hasLocalText
      ? standards.some((standard) => standard.rows.length)
        ? null
        : 'This text is stored, but GOGI did not find classroom-sized pull-outs yet.'
      : 'This text is on the official Florida map, but GOGI does not have a local source file attached yet. Upload or sync the text first, then come back to generate teaching pull-outs.',
  };
}

export async function buildR11CoverageBoard(): Promise<R11CoverageBoard> {
  const items: R11CoverageItem[] = [];

  for (const subSkill of R11_SUB_SKILLS) {
    const sheet = await buildPullOutSheet({
      standardCode: 'ELA.9.R.1.1',
      subSkillId: subSkill.strandId,
      maxRows: R11_PULL_OUT_TARGET,
    });
    const strongRows = sheet.rows.filter((row) => row.teacherTrust.confidence === 'strong');
    const emergingRows = sheet.rows.filter((row) => row.teacherTrust.confidence === 'emerging');
    const strongCount = strongRows.length;
    items.push({
      strandId: subSkill.strandId,
      label: subSkill.label,
      studentMove: subSkill.studentMove,
      minimumPullOuts: R11_PULL_OUT_TARGET,
      strongCount,
      emergingCount: emergingRows.length,
      status:
        strongCount >= R11_PULL_OUT_TARGET
          ? 'ready'
          : strongCount > 0 || emergingRows.length > 0
            ? 'building'
            : 'needed',
      bestPullOut: strongRows[0] ?? null,
      pullOuts: strongRows,
    });
  }

  return {
    standardCode: 'ELA.9.R.1.1',
    title: 'ELA.9.R.1.1 Coverage Board',
    totalStrong: items.reduce((sum, item) => sum + item.strongCount, 0),
    targetStrong: items.reduce((sum, item) => sum + item.minimumPullOuts, 0),
    items,
  };
}

export async function buildTeachingReadinessBoard(args: {
  targetPerSkill?: number;
  maxStandards?: number;
} = {}): Promise<TeachingReadinessBoard> {
  const targetPerSkill = Math.max(1, Math.min(5, args.targetPerSkill ?? TEACHING_PULL_OUT_TARGET));
  const standardCodes = [...new Set(ELA9_READING_SKILL_MOVES.map((move) => move.standardCode))]
    .slice(0, args.maxStandards ?? 20);
  const manifest = await loadManifest();
  const standards: TeachingReadinessBoard['standards'] = [];

  for (const standardCode of standardCodes) {
    const moves = ELA9_READING_SKILL_MOVES.filter((move) => move.standardCode === standardCode);
    const guidance = getStandardGuidance(standardCode, moves);
    const skills: R11CoverageItem[] = [];

    for (const move of moves) {
      const sheet = await buildPullOutSheet({
        standardCode,
        subSkillId: move.strandId,
        maxRows: targetPerSkill,
      });
      const strongRows = sheet.rows.filter((row) => row.teacherTrust.confidence === 'strong');
      const emergingRows = sheet.rows.filter((row) => row.teacherTrust.confidence === 'emerging');
      const strongCount = strongRows.length;

      skills.push({
        strandId: move.strandId,
        label: move.label,
        studentMove: move.studentMove,
        passageMustHave: move.passageMustHave,
        fastStemFocus: move.fastStemFocus,
        commonMiss: move.commonMiss,
        scaffold: move.scaffold,
        masterySignal: move.masterySignal,
        minimumPullOuts: targetPerSkill,
        strongCount,
        emergingCount: emergingRows.length,
        status:
          strongCount >= targetPerSkill
            ? 'ready'
            : strongCount > 0 || emergingRows.length > 0
              ? 'building'
              : 'needed',
        bestPullOut: strongRows[0] ?? null,
        pullOuts: strongRows,
      });
    }

    standards.push({
      code: standardCode,
      title: STANDARD_LABELS[standardCode] ?? 'Official benchmark',
      standardText: guidance.standardText,
      stateGuidance: guidance.stateGuidance,
      studentsNeedToKnow: guidance.studentsNeedToKnow,
      needCoverage: moves.map((move) => {
        const skill = skills.find((item) => item.strandId === move.strandId);
        const best = skill?.bestPullOut ?? null;
        return {
          label: move.label,
          description: move.masterySignal,
          status: skill?.status ?? 'needed',
          strongCount: skill?.strongCount ?? 0,
          targetStrong: skill?.minimumPullOuts ?? targetPerSkill,
          bestText: best?.selection ?? null,
          bestLocation: best?.exactLinesOrParagraphs ?? null,
        };
      }),
      fastReportQuestions: getFastAldGuidanceForStandard(standardCode).map((item) => item.question),
      assessmentWeight: FAST_GRADE9_ASSESSMENT_WEIGHTS[standardCode] ?? DEFAULT_ASSESSMENT_WEIGHT,
      fastDemand: guidance.fastDemand,
      itemShape: guidance.itemShape,
      strategy: guidance.strategy,
      strongCount: skills.reduce((sum, skill) => sum + skill.strongCount, 0),
      targetStrong: skills.reduce((sum, skill) => sum + skill.minimumPullOuts, 0),
      argumentLabs: standardCode === 'ELA.9.R.2.4' ? buildR24ArgumentLabs() : undefined,
      availableTexts: manifest.entries
        .filter((entry) => entry.standards.includes(standardCode))
        .map((entry) => ({
          title: entry.title,
          author: entry.author,
          status: entry.status,
          wordCount: entry.word_count,
          hasLocalText: (entry.status === 'stored' || entry.status === 'manual_upload') && hasReadableSourceText(entry),
          textPath: entry.text_path,
        }))
        .sort((a, b) => Number(b.hasLocalText) - Number(a.hasLocalText) || a.title.localeCompare(b.title)),
      skills,
    });
  }

  return {
    targetPerSkill,
    totalStrong: standards.reduce((sum, standard) => sum + standard.strongCount, 0),
    targetStrong: standards.reduce((sum, standard) => sum + standard.targetStrong, 0),
    standards,
  };
}
