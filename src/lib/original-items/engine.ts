export type OriginalItemBenchmark =
  | 'ELA.9.R.1.1'
  | 'ELA.9.R.1.2'
  | 'ELA.9.R.1.3'
  | 'ELA.9.R.2.1'
  | 'ELA.9.R.2.2'
  | 'ELA.9.R.2.3'
  | 'ELA.9.R.2.4'
  | 'ELA.9.R.3.1'
  | 'ELA.9.R.3.3'
  | 'ELA.9.R.3.4'
  | 'ELA.9.V.1.2'
  | 'ELA.9.V.1.3';

export type OriginalPassageType = 'literary' | 'informational' | 'paired' | 'poetry' | 'argument';

export type OriginalItemDraft = {
  benchmark_code: OriginalItemBenchmark;
  reporting_category: 'RP' | 'RI' | 'RGV';
  grade: number;
  passage_type: OriginalPassageType;
  passage_title: string;
  passage_text: string;
  passage_word_count: number;
  item_type: 'multiple_choice' | 'multi_select' | 'evidence_based_2_part' | 'table_completion';
  stem_pattern: string;
  prompt_text: string;
  options: Array<{ letter: string; text: string }>;
  correct_answer: string;
  correct_rationale: string;
  distractor_rationales: Record<string, string>;
  remediation_hint: string;
  reassessment_plan: string;
  difficulty_estimate: number;
};

export type OriginalItemQualityGate = {
  score: number;
  status: 'strong_signal' | 'emerging_signal' | 'not_enough_data';
  decision: 'pass' | 'review' | 'reject';
  pattern: {
    id: string;
    name: string;
    evidenceDemand: string;
    releasedFastEvidence: string;
  };
  summary: string;
  checks: Array<{
    key: string;
    label: string;
    passed: boolean;
    points: number;
    maxPoints: number;
    note: string;
  }>;
};

type BenchmarkBlueprint = {
  reportingCategory: OriginalItemDraft['reporting_category'];
  itemType: OriginalItemDraft['item_type'];
  stemPattern: string;
  skill: string;
  trap: string;
  correctMove: string;
  evidenceDetail: string;
  remediationHint: string;
  reassessmentPlan: string;
  preferredPassageType: OriginalPassageType;
};

export type FastBenchmarkPattern = {
  id: string;
  name: string;
  benchmarkCode: OriginalItemBenchmark;
  reportingCategory: OriginalItemDraft['reporting_category'];
  passageType: OriginalPassageType;
  itemType: OriginalItemDraft['item_type'];
  stemFamily: string;
  stemFrames: string[];
  correctAnswerMoves: string[];
  distractorTraps: string[];
  evidenceDemand: string;
  releasedFastEvidence: string;
  remediationMove: string;
};

export const ORIGINAL_ITEM_BENCHMARKS: OriginalItemBenchmark[] = [
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
];

export const ORIGINAL_PASSAGE_TYPES: OriginalPassageType[] = [
  'literary',
  'informational',
  'paired',
  'poetry',
  'argument',
];

const TOPIC_VARIANTS = [
  'coastal flooding preparation plan',
  'school phone policy debate',
  'community garden water-use proposal',
  'after-school tutoring attendance study',
  'local transit safety improvement plan',
  'teen volunteer recruitment campaign',
  'library renovation funding proposal',
  'school lunch waste reduction study',
  'public art restoration debate',
  'storm shelter supply effort',
  'youth sports funding debate',
  'neighborhood recycling participation program',
];

const TITLE_VARIANTS: Record<OriginalPassageType, string[]> = {
  literary: ['The Last Meeting', 'Before the Vote', 'The Folder on the Table', 'What Mara Brought'],
  informational: [
    'A Plan That Could Last',
    'When Progress Is Visible',
    'The Work Behind a Good Idea',
    'Building Trust One Step at a Time',
  ],
  paired: [
    'Two Views on a Public Plan',
    'Progress and Planning',
    'A Shared Goal, Two Arguments',
    'What Comes First',
  ],
  poetry: [
    'Instructions for Carrying It',
    'One Honest Piece',
    'What the Room Holds',
    'Hand to Hand',
  ],
  argument: [
    'Good Intentions Need Plans',
    'The Case for a Complete Plan',
    'More Than a First Step',
    'Why Details Matter',
  ],
};

const CORRECT_LETTERS = ['A', 'B', 'C', 'D'] as const;

const STEM_VARIANTS = [
  'Which answer best shows how to {skill} in the passage?',
  'How does the passage require the reader to {skill}?',
  'Which response most accurately helps the reader {skill}?',
  'Which choice best uses the passage to {skill}?',
];

const PASSAGE_ANGLES = [
  {
    setting: 'after a week of public complaints',
    visibleAction: 'posting a handwritten progress chart in the front office',
    planningAction: 'building a schedule that assigned one small task to each group',
    consequence: 'people could finally see both what had changed and what still needed work',
  },
  {
    setting: 'after the first meeting ended with more questions than answers',
    visibleAction: 'turning one blank bulletin board into a map of possible solutions',
    planningAction: 'asking each volunteer to record evidence before proposing a fix',
    consequence: 'the project became easier to discuss because the choices were visible',
  },
  {
    setting: 'when early excitement started to fade',
    visibleAction: 'inviting students to test one small improvement before voting',
    planningAction: 'measuring which parts of the plan solved the original problem',
    consequence: 'support grew because the work felt specific instead of symbolic',
  },
  {
    setting: 'after several adults dismissed the idea as unrealistic',
    visibleAction: 'showing before-and-after photos from a similar effort',
    planningAction: 'listing the cost, maintenance needs, and timeline',
    consequence: 'the discussion shifted from whether change was possible to how it could last',
  },
];

type PassageAngle = (typeof PASSAGE_ANGLES)[number];

const LITERARY_PASSAGE_SEEDS = [
  {
    title: 'The Ferry Dock',
    text: `Mara waited at the edge of the old ferry dock while the last blue line of daylight slipped behind the marsh grass. The dock had been closed for years, but everyone in town still used it as a shortcut to the beach. Tonight, with the tide crawling underneath, every board seemed to answer her steps.

Across the channel, the lighthouse blinked once and then disappeared behind a sheet of fog. Mara had promised her brother she would bring back the notebook he had left in the bait house, but the small building looked farther away than it had in daylight. The wind moved through the reeds and dragged its fingers along the dock rail.

She stopped. The sound was not loud, but it made the whole place feel awake, as if the marsh had been waiting for someone to arrive. Mara told herself it was only a bird, only wind, only water rubbing against wood. Then the fog thinned just enough for her to see the bait house door standing open.`,
    image: 'the wind moved through the reeds and dragged its fingers along the dock rail',
    correct:
      'It makes the setting feel watchful and unsettling because the wind seems almost alive.',
    distractors: [
      'It shows that Mara feels excited because the wind is guiding her toward the bait house.',
      'It explains why the dock is unsafe because the rail is broken.',
      'It creates a peaceful mood because the wind moves gently through the reeds.',
    ],
  },
  {
    title: 'After the Storm',
    text: `The practice field was empty after the storm. Water shivered in the low places, and the goalposts stood at the far end like two pale bones against the sky. No one had bothered to reset the scoreboard; it flashed a single crooked zero whenever the wind pushed through the wires.

Noah stepped over a fallen branch and felt the grass give under his shoes. He had come back for the cleats he left beneath the bench, but the field looked less like a place for games than a place that had been abandoned mid-breath. Even the painted lines seemed to fade before they reached the end zone.

When the scoreboard flickered and went dark, Noah stopped walking. The silence after it felt larger than the sound itself.`,
    image: 'the goalposts stood at the far end like two pale bones against the sky',
    correct: 'It makes the field seem bleak and lifeless after the storm.',
    distractors: [
      'It shows that the field is ready for a game because the goalposts are still standing.',
      'It creates a joyful mood because Noah has returned to a familiar place.',
      'It proves that the storm caused no real damage to the field.',
    ],
  },
  {
    title: 'The Blue Bowl',
    text: `Lena found the blue bowl in the cabinet above the stove, wrapped in newspaper that had gone soft at the folds. Her grandmother used to set peaches in it every July, arranging them carefully even when no guests were coming. Now the kitchen table was bare except for a stack of envelopes and the small key her mother kept moving from one side to the other.

Outside, the moving truck coughed in the driveway. Lena held the bowl with both hands. A thin crack crossed the glaze like a river seen from far above, but the bowl did not break. Light from the window gathered inside it and made the empty center look almost full.

For a moment, Lena could not decide whether she was carrying something fragile or something that had already learned how to survive.`,
    image: 'the empty center look almost full',
    correct:
      'It suggests that the bowl carries memory and comfort even though the family is leaving.',
    distractors: [
      'It shows that Lena plans to fill the bowl with peaches before the move.',
      'It creates humor because the bowl is too small to hold the envelopes.',
      'It proves that the bowl is new because the light makes it shine.',
    ],
  },
] as const;

const VOCAB_TEMPLATES = {
  'ELA.9.V.1.2': [
    {
      word: 'reconstruct',
      promptWord: 'reconstruct',
      sentence:
        'The committee decided to reconstruct the plan after the first version ignored cost, timing, and maintenance.',
      correct: 'build again in a better form',
      distractors: ['describe in detail', 'reject completely', 'hide from public view'],
      rationale: 'The prefix re- means again, and construct means build.',
    },
    {
      word: 'predictable',
      promptWord: 'predictable',
      sentence:
        'Students asked for a predictable schedule so volunteers would know exactly when their help was needed.',
      correct: 'able to be known ahead of time',
      distractors: ['difficult to improve', 'quickly forgotten', 'strongly opposed'],
      rationale: 'predict means tell before, and -able means able to be.',
    },
  ],
  'ELA.9.V.1.3': [
    {
      word: 'durable',
      promptWord: 'durable',
      sentence:
        'The group wanted a durable solution, not one that looked impressive for a week and then disappeared.',
      correct: 'able to last',
      distractors: ['easy to announce', 'popular for a short time', 'expensive to describe'],
      rationale: 'The contrast with lasting only a week shows that durable means able to last.',
    },
    {
      word: 'tentative',
      promptWord: 'tentative',
      sentence:
        'The first timeline was tentative because the group still needed approval, prices, and volunteers.',
      correct: 'not final or certain yet',
      distractors: ['careless and confusing', 'strongly proven', 'too expensive to attempt'],
      rationale: 'The missing approvals and details show the timeline is not final yet.',
    },
  ],
} satisfies Record<
  Extract<OriginalItemBenchmark, 'ELA.9.V.1.2' | 'ELA.9.V.1.3'>,
  Array<{
    word: string;
    promptWord: string;
    sentence: string;
    correct: string;
    distractors: string[];
    rationale: string;
  }>
>;

const BLUEPRINTS: Record<OriginalItemBenchmark, BenchmarkBlueprint> = {
  'ELA.9.R.1.1': {
    reportingCategory: 'RP',
    itemType: 'multiple_choice',
    stemPattern: 'key element effect',
    skill: 'explain how a key detail adds a layer of meaning',
    trap: 'choosing a true detail without explaining its effect',
    correctMove: 'connect the detail to a change in meaning, mood, or character understanding',
    evidenceDetail: 'the photograph of the abandoned lot',
    remediationHint:
      'Find the detail, name what changes because of it, then eliminate choices that only retell plot.',
    reassessmentPlan:
      'Give a new literary passage and ask how one detail changes the reader’s understanding.',
    preferredPassageType: 'literary',
  },
  'ELA.9.R.1.2': {
    reportingCategory: 'RP',
    itemType: 'evidence_based_2_part',
    stemPattern: 'theme plus evidence',
    skill: 'identify a theme and the evidence that develops it',
    trap: 'confusing topic with theme',
    correctMove: 'state the message about life and pair it with the strongest textual evidence',
    evidenceDetail: 'Mara choosing to show the photograph instead of reading prepared notes',
    remediationHint:
      'Turn the topic into a sentence that says what the text teaches, then prove it.',
    reassessmentPlan: 'Ask for theme in Part A and best supporting evidence in Part B.',
    preferredPassageType: 'literary',
  },
  'ELA.9.R.1.3': {
    reportingCategory: 'RP',
    itemType: 'multiple_choice',
    stemPattern: 'perspective and irony',
    skill: 'analyze how perspective shapes meaning',
    trap: 'reading only what happened and missing what the narrator reveals',
    correctMove: 'connect narration, irony, or character viewpoint to the reader’s interpretation',
    evidenceDetail: 'Mara arriving early so fewer people see her hesitation',
    remediationHint:
      'Ask who sees what, who misses what, and what the reader understands because of that gap.',
    reassessmentPlan: 'Use a fresh narrative excerpt with a perspective or irony question.',
    preferredPassageType: 'literary',
  },
  'ELA.9.R.2.1': {
    reportingCategory: 'RI',
    itemType: 'multiple_choice',
    stemPattern: 'structure and purpose',
    skill: 'analyze how structure develops purpose or meaning',
    trap: 'identifying a section without explaining why it is placed there',
    correctMove: 'connect organization to the author’s purpose',
    evidenceDetail: 'the shift from disagreement to a combined solution',
    remediationHint:
      'Label each section’s job, then ask why the author ordered the ideas that way.',
    reassessmentPlan:
      'Give a new informational passage and ask how a paragraph functions in the whole text.',
    preferredPassageType: 'informational',
  },
  'ELA.9.R.2.2': {
    reportingCategory: 'RI',
    itemType: 'evidence_based_2_part',
    stemPattern: 'central idea and support',
    skill: 'evaluate support for a central idea',
    trap: 'choosing a true detail that does not support the central idea',
    correctMove: 'match the detail to the exact claim it supports',
    evidenceDetail: 'the claim that visible progress and planning work best together',
    remediationHint:
      'Write the central idea in five words, then test each choice against that idea.',
    reassessmentPlan: 'Ask for central idea, then ask which detail best supports it.',
    preferredPassageType: 'informational',
  },
  'ELA.9.R.2.3': {
    reportingCategory: 'RI',
    itemType: 'multiple_choice',
    stemPattern: 'rhetorical appeal and purpose',
    skill: 'analyze how a rhetorical appeal helps the author achieve a purpose',
    trap: 'naming the topic without identifying the persuasive move',
    correctMove: 'connect the appeal to the author’s purpose and reader effect',
    evidenceDetail: 'the author using reported outcomes to build credibility',
    remediationHint: 'Name the appeal first, then explain why that move would persuade the reader.',
    reassessmentPlan:
      'Use a fresh informational argument and ask which appeal supports the author’s purpose.',
    preferredPassageType: 'argument',
  },
  'ELA.9.R.2.4': {
    reportingCategory: 'RI',
    itemType: 'table_completion',
    stemPattern: 'argument comparison',
    skill: 'compare how arguments develop claims and evidence',
    trap: 'mixing up claim, evidence, and counterclaim',
    correctMove: 'separate each author’s claim from the support used to build it',
    evidenceDetail: 'Passage 1’s focus on shared value and Passage 2’s focus on planning',
    remediationHint: 'Make a two-column claim/evidence chart before answering.',
    reassessmentPlan:
      'Use paired arguments and ask students to classify claims, evidence, and limitations.',
    preferredPassageType: 'paired',
  },
  'ELA.9.R.3.1': {
    reportingCategory: 'RGV',
    itemType: 'multiple_choice',
    stemPattern: 'figurative language effect',
    skill: 'explain how figurative language affects mood, meaning, tone, or reader understanding',
    trap: 'naming the device or feeling without explaining its effect in context',
    correctMove: 'connect image or phrase to the effect it creates for the reader',
    evidenceDetail: 'a figurative phrase that changes how the reader understands the scene',
    remediationHint:
      'Underline the image, say what it suggests in context, then choose the answer that explains what it does.',
    reassessmentPlan:
      'Use a short literary passage with figurative language and ask how it affects mood, meaning, tone, or reader understanding.',
    preferredPassageType: 'literary',
  },
  'ELA.9.R.3.3': {
    reportingCategory: 'RGV',
    itemType: 'multi_select',
    stemPattern: 'adaptation comparison',
    skill: 'compare how texts adapt a source idea',
    trap: 'matching surface similarity instead of changed meaning',
    correctMove: 'compare what each text keeps, changes, and emphasizes',
    evidenceDetail:
      'the way both passages discuss the same project but emphasize different concerns',
    remediationHint: 'Use a keep/change/emphasize chart before selecting answers.',
    reassessmentPlan: 'Use two short related texts and ask for two adaptation moves.',
    preferredPassageType: 'paired',
  },
  'ELA.9.R.3.4': {
    reportingCategory: 'RGV',
    itemType: 'multiple_choice',
    stemPattern: 'rhetoric and effect',
    skill: 'explain how rhetoric shapes meaning or impact',
    trap: 'spotting a rhetorical move without naming its effect',
    correctMove: 'connect the author’s choice to reader impact',
    evidenceDetail: 'the contrast between good intentions and complete plans',
    remediationHint: 'Name the move, then finish the sentence: this makes the reader...',
    reassessmentPlan: 'Give a new rhetorical excerpt and ask how one move affects the reader.',
    preferredPassageType: 'argument',
  },
  'ELA.9.V.1.2': {
    reportingCategory: 'RGV',
    itemType: 'multiple_choice',
    stemPattern: 'morphology meaning',
    skill: 'use word parts to determine meaning',
    trap: 'guessing from sentence vibe instead of using morphemes',
    correctMove: 'break the word into meaningful parts and test the meaning in context',
    evidenceDetail: 'a word whose prefix and root point to its meaning',
    remediationHint: 'Circle prefix, root, and suffix before reading answer choices.',
    reassessmentPlan: 'Use a new sentence with a morphologically rich word.',
    preferredPassageType: 'informational',
  },
  'ELA.9.V.1.3': {
    reportingCategory: 'RGV',
    itemType: 'multiple_choice',
    stemPattern: 'context meaning',
    skill: 'use context clues and connotation to determine word meaning',
    trap: 'choosing the most common definition instead of the contextual meaning',
    correctMove: 'use nearby clues and tone to test the meaning',
    evidenceDetail: 'nearby context that narrows the meaning of the target word',
    remediationHint:
      'Replace the word with each option and reject meanings that break the sentence logic.',
    reassessmentPlan: 'Use a new passage sentence and ask for contextual meaning.',
    preferredPassageType: 'informational',
  },
};

export const FAST_BENCHMARK_PATTERNS: Record<OriginalItemBenchmark, FastBenchmarkPattern[]> = {
  'ELA.9.R.1.1': [
    {
      id: 'r111-detail-effect',
      name: 'Key Detail Changes Meaning',
      benchmarkCode: 'ELA.9.R.1.1',
      reportingCategory: 'RP',
      passageType: 'literary',
      itemType: 'multiple_choice',
      stemFamily: 'key element effect',
      stemFrames: [
        'Which choice best explains how {evidenceDemand} adds meaning to the passage?',
        'How does {evidenceDemand} affect the reader’s understanding of the passage?',
      ],
      correctAnswerMoves: [
        'connect a key detail to a change in meaning, mood, or character understanding',
        'explain why the detail matters instead of only identifying it',
      ],
      distractorTraps: [
        'retells a true plot detail without explaining its effect',
        'names a character action but misses the change in meaning',
        'makes a broad theme claim without using the selected detail',
      ],
      evidenceDemand: 'a specific detail, image, or character action',
      releasedFastEvidence:
        'Released literary items ask students to explain how details shape meaning.',
      remediationMove: 'Have the student name the detail, name what changes, then connect both.',
    },
  ],
  'ELA.9.R.1.2': [
    {
      id: 'r112-theme-evidence',
      name: 'Theme Plus Evidence',
      benchmarkCode: 'ELA.9.R.1.2',
      reportingCategory: 'RP',
      passageType: 'literary',
      itemType: 'evidence_based_2_part',
      stemFamily: 'theme plus evidence',
      stemFrames: [
        'Which theme is best developed by {evidenceDemand}?',
        'Which response identifies the theme and the evidence that best supports it?',
      ],
      correctAnswerMoves: [
        'state the message about life and pair it with the strongest textual evidence',
        'turn a topic into a complete theme and prove it with the passage',
      ],
      distractorTraps: [
        'confuses topic with theme',
        'chooses true evidence that supports a different idea',
        'states a lesson that is too broad for the passage',
      ],
      evidenceDemand: 'a repeated decision, conflict, or turning point',
      releasedFastEvidence: 'Released literary items often pair theme with direct evidence.',
      remediationMove: 'Convert the topic into a sentence, then test each evidence choice.',
    },
  ],
  'ELA.9.R.1.3': [
    {
      id: 'r113-perspective-meaning',
      name: 'Perspective Shapes Interpretation',
      benchmarkCode: 'ELA.9.R.1.3',
      reportingCategory: 'RP',
      passageType: 'literary',
      itemType: 'multiple_choice',
      stemFamily: 'perspective and irony',
      stemFrames: [
        'How does the narrator’s perspective shape the meaning of {evidenceDemand}?',
        'Which choice best explains what the reader understands because of the perspective?',
      ],
      correctAnswerMoves: [
        'connect narration, irony, or character viewpoint to the reader’s interpretation',
        'explain what the reader notices that a character may not fully understand',
      ],
      distractorTraps: [
        'summarizes what happened without analyzing perspective',
        'treats the narrator and character as having the same understanding',
        'focuses on setting instead of viewpoint',
      ],
      evidenceDemand: 'a narrator comment, contrast, or limited character view',
      releasedFastEvidence:
        'Released prose items ask students to notice how viewpoint changes meaning.',
      remediationMove: 'Ask who knows what, who misses what, and what the reader can infer.',
    },
  ],
  'ELA.9.R.2.1': [
    {
      id: 'r221-structure-purpose',
      name: 'Structure Serves Purpose',
      benchmarkCode: 'ELA.9.R.2.1',
      reportingCategory: 'RI',
      passageType: 'informational',
      itemType: 'multiple_choice',
      stemFamily: 'structure and purpose',
      stemFrames: [
        'How does the structure of the passage help develop {evidenceDemand}?',
        'Why does the author organize the information this way?',
      ],
      correctAnswerMoves: [
        'connect organization to the author’s purpose',
        'explain how the order of ideas changes what the reader understands',
      ],
      distractorTraps: [
        'identifies a section without explaining its job',
        'summarizes a paragraph instead of explaining placement',
        'confuses topic order with author purpose',
      ],
      evidenceDemand: 'the author’s central purpose or progression of ideas',
      releasedFastEvidence:
        'Released informational items often ask why a paragraph or section appears where it does.',
      remediationMove: 'Label each section’s job, then explain why that order matters.',
    },
  ],
  'ELA.9.R.2.2': [
    {
      id: 'r222-central-idea-support',
      name: 'Central Idea Evidence Match',
      benchmarkCode: 'ELA.9.R.2.2',
      reportingCategory: 'RI',
      passageType: 'informational',
      itemType: 'evidence_based_2_part',
      stemFamily: 'central idea and support',
      stemFrames: [
        'Which choice best supports the central idea that lasting improvement needs both visible progress and careful planning?',
        'Which evidence most directly supports the passage’s central idea?',
      ],
      correctAnswerMoves: [
        'match the detail to the exact claim it supports',
        'choose evidence that supports the controlling idea rather than a side detail',
      ],
      distractorTraps: [
        'chooses a true detail that does not support the central idea',
        'chooses background information instead of direct support',
        'makes a claim broader than the passage evidence',
      ],
      evidenceDemand: 'visible progress and careful planning working together',
      releasedFastEvidence:
        'The extracted 2025 Grade 9 set includes central idea/support items where true details compete with best evidence.',
      remediationMove: 'Write the central idea in five words, then test each choice against it.',
    },
    {
      id: 'r222-detail-centrality',
      name: 'True Detail Versus Best Support',
      benchmarkCode: 'ELA.9.R.2.2',
      reportingCategory: 'RI',
      passageType: 'informational',
      itemType: 'multiple_choice',
      stemFamily: 'central idea and support',
      stemFrames: [
        'Which detail is most important to the passage’s central idea?',
        'Which answer best explains why the selected detail matters to the passage as a whole?',
      ],
      correctAnswerMoves: [
        'separate a merely true detail from the detail that best supports the central idea',
        'explain how one detail strengthens the passage’s controlling idea',
      ],
      distractorTraps: [
        'selects an interesting but secondary detail',
        'selects a detail from only one paragraph',
        'selects an answer that sounds important but is not tied to the central idea',
      ],
      evidenceDemand: 'one detail that connects back to the whole passage',
      releasedFastEvidence:
        'Released FAST support items require the student to choose the strongest evidence, not just any true statement.',
      remediationMove:
        'Cross out true-but-side details, then keep the choice that supports the whole passage.',
    },
  ],
  'ELA.9.R.2.3': [
    {
      id: 'r223-appeal-purpose',
      name: 'Rhetorical Appeal Supports Purpose',
      benchmarkCode: 'ELA.9.R.2.3',
      reportingCategory: 'RI',
      passageType: 'argument',
      itemType: 'multiple_choice',
      stemFamily: 'rhetorical appeal and purpose',
      stemFrames: [
        'How does the author use {evidenceDemand} to support the purpose of the passage?',
        'Which choice best explains how the rhetorical appeal helps persuade the reader?',
      ],
      correctAnswerMoves: [
        'identify the appeal and connect it to the author’s purpose',
        'explain why the persuasive move makes the claim more convincing',
      ],
      distractorTraps: [
        'names the topic without naming the appeal',
        'identifies evidence but not the purpose it serves',
        'chooses a reader effect that is not supported by the rhetorical move',
      ],
      evidenceDemand: 'expert evidence, reported outcomes, emotional appeal, or credibility move',
      releasedFastEvidence:
        'Released informational items ask how appeals help the author persuade the reader.',
      remediationMove:
        'Label the appeal in plain language, then finish: this helps the author because...',
    },
  ],
  'ELA.9.R.2.4': [
    {
      id: 'r224-claim-evidence-comparison',
      name: 'Compare Claims And Evidence',
      benchmarkCode: 'ELA.9.R.2.4',
      reportingCategory: 'RI',
      passageType: 'paired',
      itemType: 'table_completion',
      stemFamily: 'argument comparison',
      stemFrames: [
        'Which choice best compares how the two passages develop {evidenceDemand}?',
        'Complete the comparison by matching each passage with its claim and support.',
      ],
      correctAnswerMoves: [
        'separate each author’s claim from the support used to build it',
        'compare what each argument emphasizes and how evidence develops that emphasis',
      ],
      distractorTraps: [
        'mixes up claim, evidence, and counterclaim',
        'matches the passages by topic instead of argument role',
        'uses evidence from the wrong passage',
      ],
      evidenceDemand: 'claims, reasons, and evidence across paired arguments',
      releasedFastEvidence:
        'Released paired-text items ask students to compare argument development.',
      remediationMove: 'Make a two-column claim/evidence chart before answering.',
    },
  ],
  'ELA.9.R.3.1': [
    {
      id: 'r331-figurative-effect',
      name: 'Figurative Language Creates Effect',
      benchmarkCode: 'ELA.9.R.3.1',
      reportingCategory: 'RGV',
      passageType: 'literary',
      itemType: 'multiple_choice',
      stemFamily: 'figurative language effect',
      stemFrames: [
        'How does the figurative language in {evidenceDemand} affect the passage?',
        'Which choice best explains the effect of the image in context?',
        'How does the figurative phrase affect the reader’s understanding of the scene?',
      ],
      correctAnswerMoves: [
        'connect image or phrase to mood, tone, meaning, or reader understanding',
        'explain the effect of figurative language instead of naming the device',
        'use context to decide what the image does in the passage',
      ],
      distractorTraps: [
        'defines the phrase literally',
        'names a mood or tone without connecting it to the image',
        'chooses an effect that is true in general but not supported by the context',
      ],
      evidenceDemand: 'an image, comparison, personification, or phrase with contextual weight',
      releasedFastEvidence:
        'Released Grade 9 FAST items ask students to explain what figurative language does in the passage, not just identify a device.',
      remediationMove:
        'Underline the figurative phrase, translate the image in context, then explain its effect.',
    },
  ],
  'ELA.9.R.3.3': [
    {
      id: 'r333-adaptation-emphasis',
      name: 'Adaptation Keeps And Changes Meaning',
      benchmarkCode: 'ELA.9.R.3.3',
      reportingCategory: 'RGV',
      passageType: 'paired',
      itemType: 'multi_select',
      stemFamily: 'adaptation comparison',
      stemFrames: [
        'Which choice best shows how the second text adapts {evidenceDemand}?',
        'Which answers compare what the texts keep, change, and emphasize?',
      ],
      correctAnswerMoves: [
        'compare what each text keeps, changes, and emphasizes',
        'identify how a shared idea changes meaning across texts',
      ],
      distractorTraps: [
        'matches surface similarity instead of changed meaning',
        'focuses on only one text',
        'confuses shared topic with adaptation',
      ],
      evidenceDemand: 'a shared source idea or repeated concern across texts',
      releasedFastEvidence:
        'Released comparison items reward changed emphasis, not surface matching.',
      remediationMove: 'Use a keep/change/emphasize chart before selecting answers.',
    },
  ],
  'ELA.9.R.3.4': [
    {
      id: 'r334-rhetoric-impact',
      name: 'Rhetoric Shapes Reader Impact',
      benchmarkCode: 'ELA.9.R.3.4',
      reportingCategory: 'RGV',
      passageType: 'argument',
      itemType: 'multiple_choice',
      stemFamily: 'rhetoric and effect',
      stemFrames: [
        'How does the author’s rhetorical choice in {evidenceDemand} affect the reader?',
        'Which choice best explains the impact of the author’s wording?',
      ],
      correctAnswerMoves: [
        'connect the author’s choice to reader impact',
        'explain why the rhetorical move strengthens the argument',
      ],
      distractorTraps: [
        'spots a rhetorical move without naming its effect',
        'summarizes the claim instead of explaining impact',
        'chooses an effect that is not supported by the wording',
      ],
      evidenceDemand: 'a contrast, repeated phrase, or loaded word choice',
      releasedFastEvidence: 'Released rhetoric items ask what an author choice does to the reader.',
      remediationMove: 'Name the move, then finish: this makes the reader...',
    },
  ],
  'ELA.9.V.1.2': [
    {
      id: 'v112-morphology-context',
      name: 'Word Parts In Context',
      benchmarkCode: 'ELA.9.V.1.2',
      reportingCategory: 'RGV',
      passageType: 'informational',
      itemType: 'multiple_choice',
      stemFamily: 'morphology meaning',
      stemFrames: [
        'Based on the word parts and context, what does the word in {evidenceDemand} mean?',
        'Which choice best uses morphology and context to determine the word meaning?',
      ],
      correctAnswerMoves: [
        'break the word into meaningful parts and test the meaning in context',
        'use prefix, root, or suffix evidence and confirm it with sentence logic',
      ],
      distractorTraps: [
        'guesses from sentence vibe instead of using morphemes',
        'uses a familiar but wrong word part',
        'chooses a meaning that fits the topic but not the sentence',
      ],
      evidenceDemand: 'a sentence with a morphologically rich word',
      releasedFastEvidence: 'Released vocabulary items use both word-part knowledge and context.',
      remediationMove: 'Circle prefix, root, and suffix before testing answer choices.',
    },
  ],
  'ELA.9.V.1.3': [
    {
      id: 'v113-context-connotation',
      name: 'Context And Connotation Meaning',
      benchmarkCode: 'ELA.9.V.1.3',
      reportingCategory: 'RGV',
      passageType: 'informational',
      itemType: 'multiple_choice',
      stemFamily: 'context meaning',
      stemFrames: [
        'What does the word in {evidenceDemand} most nearly mean?',
        'Which meaning best fits the context and tone of the passage?',
      ],
      correctAnswerMoves: [
        'use nearby clues and tone to test the meaning',
        'choose the meaning that fits this sentence rather than the most common definition',
      ],
      distractorTraps: [
        'chooses the most common definition instead of the contextual meaning',
        'uses a synonym with the wrong connotation',
        'ignores the tone of the surrounding sentence',
      ],
      evidenceDemand: 'nearby context that narrows a target word',
      releasedFastEvidence: 'Released vocabulary items test precise meaning in context.',
      remediationMove:
        'Replace the word with each option and reject meanings that break the sentence logic.',
    },
  ],
};

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function keywordHits(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
}

function hasGenericAiPassageTexture(draft: OriginalItemDraft) {
  const text = `${draft.passage_title} ${draft.passage_text}`.toLowerCase();
  const genericProjectTerms = [
    'student-led neighborhood project',
    'community project',
    'visible first step',
    'careful planning',
    'what still needed work',
    'project became easier to discuss',
    'progress chart',
  ];

  if (draft.passage_type === 'literary') {
    return genericProjectTerms.some((term) => text.includes(term));
  }

  return (
    text.includes('scenario') ||
    genericProjectTerms.filter((term) => text.includes(term)).length >= 3
  );
}

function hasFastStylePassageTexture(draft: OriginalItemDraft) {
  const text = draft.passage_text;
  const paragraphs = text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim().length > 0);
  const hasQuotedOrFigurativeTexture = /["“”]|\blike\b|\bas if\b|\bseemed\b|\bwhile\b/i.test(text);
  const hasConcreteDetail =
    /\b(wind|fog|dock|field|bowl|window|rain|water|scoreboard|lighthouse|kitchen|truck|grass|marsh|door)\b/i.test(
      text
    );

  if (draft.passage_type === 'literary' || draft.passage_type === 'poetry') {
    return (
      paragraphs.length >= 2 &&
      draft.passage_word_count >= 120 &&
      hasQuotedOrFigurativeTexture &&
      hasConcreteDetail
    );
  }

  return (
    paragraphs.length >= 2 &&
    /\bhowever\b|\bfor that reason\b|\bbecause\b|\btherefore\b|\bclaim\b|\bevidence\b/i.test(text)
  );
}

function qualityStatus(score: number): OriginalItemQualityGate['status'] {
  if (score >= 85) return 'strong_signal';
  if (score >= 70) return 'emerging_signal';
  return 'not_enough_data';
}

function qualityDecision(score: number): OriginalItemQualityGate['decision'] {
  if (score >= 80) return 'pass';
  if (score >= 65) return 'review';
  return 'reject';
}

function addQualityCheck(
  checks: OriginalItemQualityGate['checks'],
  input: {
    key: string;
    label: string;
    passed: boolean;
    maxPoints: number;
    note: string;
  }
) {
  checks.push({
    ...input,
    points: input.passed ? input.maxPoints : 0,
  });
}

function hasBlueprintLanguage(options: Array<{ text: string }>) {
  const genericPatterns = [
    /^It connect\b/i,
    /^It state\b/i,
    /^It identify\b/i,
    /^It separate\b/i,
    /^It compare\b/i,
    /^It explain\b/i,
    /^It use\b/i,
    /^It names?\b/i,
    /^It summarizes?\b/i,
    /^It defines?\b/i,
    /^It chooses?\b/i,
    /^It matches?\b/i,
    /^It focuses?\b/i,
    /^It confuses?\b/i,
    /^It mixes?\b/i,
    /^It spots?\b/i,
    /^It retells?\b/i,
  ];

  return options.some((option) => genericPatterns.some((pattern) => pattern.test(option.text)));
}

function getPatternForVariant(benchmark: OriginalItemBenchmark, variantIndex: number) {
  const patterns = FAST_BENCHMARK_PATTERNS[benchmark];
  return patterns[variantIndex % patterns.length];
}

function topicForVariant(topic: string | undefined, variantIndex: number) {
  return topic?.trim() || TOPIC_VARIANTS[variantIndex % TOPIC_VARIANTS.length] || TOPIC_VARIANTS[0];
}

function titleForPassage(passageType: OriginalPassageType, variantIndex: number) {
  const titles = TITLE_VARIANTS[passageType];
  return titles[variantIndex % titles.length];
}

function passageSeed(
  benchmark: OriginalItemBenchmark,
  passageType: OriginalPassageType,
  topic: string,
  variantIndex = 0
) {
  const subject = topic.trim() || 'a student-run neighborhood project';
  const angle = PASSAGE_ANGLES[variantIndex % PASSAGE_ANGLES.length];
  const subjectPhrase = subject.match(/^(a|an|the)\s/i) ? subject : `the ${subject}`;
  const title = titleForPassage(passageType, variantIndex);
  if (passageType === 'literary') {
    const seed = LITERARY_PASSAGE_SEEDS[variantIndex % LITERARY_PASSAGE_SEEDS.length];
    if (seed) return { title: seed.title, text: seed.text };

    return {
      title,
      text: `Mara arrived before anyone else, mostly because arriving early gave her fewer chances to be seen hesitating at the door. The meeting room smelled faintly of dry markers and raincoats. On the whiteboard, someone had written ${subject} in block letters and underlined it twice, as if confidence could be drawn into existence.\n\nFor three weeks, Mara had carried the project in a blue folder that was beginning to split at the corners. She had lists, maps, survey notes, and one photograph connected to ${subject}. What she did not have was a speech. Every sentence she practiced sounded too small for what she wanted people to understand, especially ${angle.setting}.\n\nWhen the others entered, they talked over one another, laughing about homework and weekend plans. Mara kept her hands flat on the folder. Then Mr. Alvarez asked who wanted to begin. The room became quiet enough for her to hear the rain ticking against the windows. Mara opened the folder, but instead of reading from her notes, she began by ${angle.visibleAction}. "This is what we keep walking past," she said. By the end, ${angle.consequence}.`,
    };
  }

  if (passageType === 'poetry') {
    return {
      title,
      text: `Do not lift it all at once.\nLet one corner rise first,\nthe way morning tests a window.\n\nAsk who has been holding it alone.\nAsk what the silence has cost.\n\nSome burdens are not heavy\nbecause they are large,\nbut because everyone agrees\nnot to see them.\n\nSo carry one honest piece.\nPass it hand to hand.\nWatch how the room changes\nwhen no one pretends\nit is empty.`,
    };
  }

  if (passageType === 'paired') {
    return {
      title,
      text: `Passage 1\nThe city should invest in ${subjectPhrase} because small public changes can create lasting habits. When residents see a neglected space become useful, they are more likely to protect it, visit it, and imagine other improvements. The strongest first step would be ${angle.visibleAction}, because public progress can turn interest into participation.\n\nPassage 2\nSupporters of ${subjectPhrase} often describe the idea as simple, but simple ideas still require planning. Before money is spent, the city should ask who will maintain the project, how success will be measured, and whether the same funds could solve a more urgent problem. The plan should begin by ${angle.planningAction}. A good intention is not the same as a complete plan.`,
    };
  }

  return {
    title,
    text: `In many schools and neighborhoods, ${subjectPhrase} begins as a practical concern and becomes a test of priorities. People usually agree that improvement matters, but they disagree about where effort should begin, especially ${angle.setting}. Some residents ask for proof they can see. Others argue that a proposal should start with records, deadlines, and a way to measure whether the work is helping.\n\nThe strongest efforts usually combine both approaches. A public action, such as ${angle.visibleAction}, can build trust because people can point to a change instead of only hearing a promise. A documented plan, such as ${angle.planningAction}, can prevent energy from fading after the first announcement. Without public evidence, people may conclude that the effort is only talk. Without a maintenance plan, early progress can become difficult to protect.\n\nFor that reason, communities often succeed when they identify one manageable action, explain why it matters, and collect evidence about what happens next. This process does not solve every problem at once, but ${angle.consequence}. Over time, the habit of pairing action with evidence may matter as much as the first project itself.`,
  };
}

function vocabTemplateFor(
  benchmark: OriginalItemBenchmark,
  variantIndex: number
): (typeof VOCAB_TEMPLATES)['ELA.9.V.1.2'][number] | null {
  if (benchmark !== 'ELA.9.V.1.2' && benchmark !== 'ELA.9.V.1.3') return null;
  const templates = VOCAB_TEMPLATES[benchmark];
  return templates[variantIndex % templates.length];
}

function vocabPassageSeed(
  benchmark: OriginalItemBenchmark,
  topic: string,
  variantIndex: number,
  template: NonNullable<ReturnType<typeof vocabTemplateFor>>
) {
  const subject = topic.trim() || topicForVariant(undefined, variantIndex);
  return {
    title: titleForPassage('informational', variantIndex),
    text: `In many schools and neighborhoods, the ${subject} begins with a simple question: what kind of change will actually last? People may agree that improvement matters, but agreement alone rarely creates a useful plan.\n\n${template.sentence} The sentence mattered because it helped the group move from a broad idea to a choice they could explain. Instead of relying on enthusiasm, the group looked at what the surrounding words made clear.\n\nThat habit made the discussion more precise. When students paused over one important word, they could test its meaning against the rest of the sentence and avoid choosing a definition that only sounded familiar.`,
  };
}

function rotate<T>(items: readonly T[], startIndex: number) {
  return [...items.slice(startIndex), ...items.slice(0, startIndex)];
}

function optionsForBlueprint(
  blueprint: BenchmarkBlueprint,
  pattern: FastBenchmarkPattern,
  correctLetter: (typeof CORRECT_LETTERS)[number],
  variantIndex: number,
  angle: PassageAngle
) {
  const optionsByLetter = optionsForPattern(pattern, correctLetter, variantIndex, angle);

  return CORRECT_LETTERS.map((letter) => ({
    letter,
    text: optionsByLetter[letter] ?? `It ${blueprint.trap}.`,
  }));
}

function concreteEvidenceDemand(
  pattern: FastBenchmarkPattern,
  angle: PassageAngle,
  variantIndex: number
) {
  const literarySeed = LITERARY_PASSAGE_SEEDS[variantIndex % LITERARY_PASSAGE_SEEDS.length];
  const map: Partial<Record<string, string>> = {
    'r111-detail-effect': 'Mara’s worn blue folder',
    'r112-theme-evidence': 'Mara’s decision to begin with evidence instead of a prepared speech',
    'r113-perspective-meaning': 'Mara’s view of the underlined words on the whiteboard',
    'r221-structure-purpose': 'the contrast between visible action and careful planning',
    'r223-appeal-purpose': 'examples of public progress and careful planning',
    'r224-claim-evidence-comparison': 'claims, reasons, and evidence across both passages',
    'r331-figurative-effect': `the phrase “${literarySeed.image}”`,
    'r333-adaptation-emphasis': 'the shared concern about whether public change can last',
    'r334-rhetoric-impact': 'the contrast between “only talk” and work that can last',
  };
  return map[pattern.id] ?? pattern.evidenceDemand;
}

function optionsForPattern(
  pattern: FastBenchmarkPattern,
  correctLetter: (typeof CORRECT_LETTERS)[number],
  variantIndex: number,
  angle: PassageAngle
) {
  const vocabTemplate = vocabTemplateFor(pattern.benchmarkCode, variantIndex);
  if (vocabTemplate) {
    return optionsForVocabPattern(vocabTemplate, correctLetter, variantIndex);
  }

  const correctDetails =
    pattern.id === 'r222-detail-centrality'
      ? [
          `A visible step can build trust, but a clear plan keeps the effort from fading.`,
          `The passage shows that progress is easier to maintain when people pair action with evidence.`,
        ]
      : [
          `A visible first step can build trust, and a clear plan can keep the work from fading.`,
          `The best efforts combine public progress with careful planning and measurement.`,
        ];
  const distractors = rotate(
    [
      `People disagree about where the effort should begin.`,
      `The project started as a practical concern in schools and neighborhoods.`,
      `Some people want immediate visible change.`,
      `The effort does not solve every problem at once.`,
    ],
    variantIndex % 4
  );

  if (!pattern.benchmarkCode.startsWith('ELA.9.R.2.2')) {
    return optionsForGeneralPattern(pattern, correctLetter, variantIndex, angle);
  }

  let distractorIndex = 0;
  const correctText = correctDetails[variantIndex % correctDetails.length];
  return CORRECT_LETTERS.reduce<Record<string, string>>((options, letter) => {
    if (letter === correctLetter) {
      options[letter] = correctText;
      return options;
    }

    options[letter] = distractors[distractorIndex] ?? angle.consequence;
    distractorIndex += 1;
    return options;
  }, {});
}

function optionsForVocabPattern(
  template: NonNullable<ReturnType<typeof vocabTemplateFor>>,
  correctLetter: (typeof CORRECT_LETTERS)[number],
  variantIndex: number
) {
  const distractors = rotate(template.distractors, variantIndex % template.distractors.length);
  let distractorIndex = 0;

  return CORRECT_LETTERS.reduce<Record<string, string>>((options, letter) => {
    if (letter === correctLetter) {
      options[letter] = template.correct;
      return options;
    }

    options[letter] = distractors[distractorIndex];
    distractorIndex += 1;
    return options;
  }, {});
}

function optionsForGeneralPattern(
  pattern: FastBenchmarkPattern,
  correctLetter: (typeof CORRECT_LETTERS)[number],
  variantIndex: number,
  angle: PassageAngle
) {
  const literarySeed = LITERARY_PASSAGE_SEEDS[variantIndex % LITERARY_PASSAGE_SEEDS.length];
  const optionSets: Partial<Record<string, { correct: string[]; distractors: readonly string[] }>> =
    {
      'r111-detail-effect': {
        correct: [
          'It shows that Mara has carried the project carefully, making her quiet start feel serious instead of uncertain.',
          'It makes the project feel personal to Mara because the folder holds proof of what others keep ignoring.',
        ],
        distractors: [
          'It proves that Mara has already convinced the room before she begins speaking.',
          'It shows that the meeting is mostly about replacing damaged school supplies.',
          'It suggests that Mara wants to avoid responsibility for the project.',
        ],
      },
      'r112-theme-evidence': {
        correct: [
          'Real change begins when someone turns private concern into public evidence.',
          'Courage can grow when a person chooses proof over a perfect speech.',
        ],
        distractors: [
          'People should avoid group projects unless adults lead them.',
          'Rainy weather often makes difficult meetings unsuccessful.',
          'Careful notes are less useful than speaking with confidence.',
        ],
      },
      'r113-perspective-meaning': {
        correct: [
          'Because Mara is unsure, the underlined words seem more like pressure than confidence.',
          'Mara’s hesitation makes the room feel intimidating before anyone challenges her idea.',
        ],
        distractors: [
          'The narrator shows that the other students already oppose Mara’s project.',
          'The perspective proves that Mr. Alvarez wrote the words to embarrass Mara.',
          'The narrator focuses on the weather to show that the meeting will be canceled.',
        ],
      },
      'r221-structure-purpose': {
        correct: [
          'The passage first presents a disagreement, then explains why successful plans need both action and evidence.',
          'The passage moves from competing views to a balanced solution that combines visibility with planning.',
        ],
        distractors: [
          'The passage lists unrelated examples to show that community projects usually fail.',
          'The passage begins with the solution so the reader does not need the later explanation.',
          'The passage is organized mainly to compare schools with neighborhoods.',
        ],
      },
      'r223-appeal-purpose': {
        correct: [
          `The example of ${angle.visibleAction} gives readers a practical reason to trust the author’s claim.`,
          `The reference to ${angle.planningAction} appeals to logic by showing how the plan could be evaluated.`,
        ],
        distractors: [
          'The author uses humor to make opponents of the project seem foolish.',
          'The author relies only on personal feelings instead of explaining the plan.',
          'The author changes the topic to avoid discussing whether the project can last.',
        ],
      },
      'r224-claim-evidence-comparison': {
        correct: [
          'Passage 1 emphasizes public benefits of a first visible step, while Passage 2 emphasizes planning before spending money.',
          'Passage 1 argues that visible progress builds support, while Passage 2 argues that support is not enough without maintenance plans.',
        ],
        distractors: [
          'Both passages argue that the project should be rejected because it is too expensive.',
          'Passage 1 focuses on maintenance costs, while Passage 2 focuses on neighborhood pride.',
          'Both passages use the same evidence to reach the same conclusion about immediate action.',
        ],
      },
      'r331-figurative-effect': {
        correct: [literarySeed.correct],
        distractors: literarySeed.distractors,
      },
      'r333-adaptation-emphasis': {
        correct: [
          'Both passages keep the idea of public improvement, but the second shifts attention from inspiration to responsibility.',
          'The second passage adapts the shared concern by questioning whether enthusiasm can become a sustainable plan.',
        ],
        distractors: [
          'The second passage changes the topic from public improvement to a private family conflict.',
          'Both passages treat planning as unnecessary once residents support the idea.',
          'The second passage repeats the first passage’s claim without changing its emphasis.',
        ],
      },
      'r334-rhetoric-impact': {
        correct: [
          'The contrast makes readers see that enthusiasm alone is weak unless it becomes organized action.',
          'The wording pushes readers to value plans that can be measured over promises that sound good briefly.',
        ],
        distractors: [
          'The contrast makes the reader distrust all student-led efforts.',
          'The wording proves that visible progress matters more than planning in every situation.',
          'The phrase shifts attention away from the author’s argument and toward the setting.',
        ],
      },
    };
  const set = optionSets[pattern.id] ?? {
    correct: [`The choice is supported by the passage and explains the effect in context.`],
    distractors: [
      'The choice is true but does not answer the question being asked.',
      'The choice repeats a detail without explaining its role in the passage.',
      'The choice makes a broad claim that the passage does not support.',
    ],
  };
  const distractors = rotate(set.distractors, variantIndex % set.distractors.length);
  const correctMove = set.correct[variantIndex % set.correct.length];
  let distractorIndex = 0;

  return CORRECT_LETTERS.reduce<Record<string, string>>((options, letter) => {
    if (letter === correctLetter) {
      options[letter] = correctMove;
      return options;
    }

    options[letter] = distractors[distractorIndex];
    distractorIndex += 1;
    return options;
  }, {});
}

function distractorRationalesForBlueprint(
  blueprint: BenchmarkBlueprint,
  pattern: FastBenchmarkPattern,
  correctLetter: (typeof CORRECT_LETTERS)[number],
  variantIndex: number
) {
  const distractors = rotate(
    pattern.distractorTraps,
    variantIndex % pattern.distractorTraps.length
  ).slice(0, 3);
  let distractorIndex = 0;

  return CORRECT_LETTERS.reduce<Record<string, string>>((rationales, letter) => {
    if (letter === correctLetter) {
      return rationales;
    }

    const distractor = distractors[distractorIndex];
    rationales[letter] =
      distractorIndex === 0
        ? `This answer ${distractor}. Common benchmark trap: ${blueprint.trap}.`
        : `This answer ${distractor}.`;
    distractorIndex += 1;
    return rationales;
  }, {});
}

export function buildOriginalFastAlignedDraft(input: {
  benchmarkCode: OriginalItemBenchmark;
  passageType?: OriginalPassageType;
  topic?: string;
  grade?: number;
  variantIndex?: number;
}): OriginalItemDraft {
  const blueprint = BLUEPRINTS[input.benchmarkCode];
  const variantIndex = input.variantIndex ?? 0;
  const pattern = getPatternForVariant(input.benchmarkCode, variantIndex);
  const passageType = input.passageType ?? pattern.passageType;
  const topic = topicForVariant(input.topic, variantIndex);
  const vocabTemplate = vocabTemplateFor(input.benchmarkCode, variantIndex);
  const passage = vocabTemplate
    ? vocabPassageSeed(input.benchmarkCode, topic, variantIndex, vocabTemplate)
    : passageSeed(input.benchmarkCode, passageType, topic, variantIndex);
  const angle = PASSAGE_ANGLES[variantIndex % PASSAGE_ANGLES.length];
  const correctAnswer = CORRECT_LETTERS[variantIndex % CORRECT_LETTERS.length];
  const stemTemplate = vocabTemplate
    ? `Read this sentence: "${vocabTemplate.sentence}" What does ${vocabTemplate.promptWord} mean as it is used in the sentence?`
    : pattern.stemFrames[variantIndex % pattern.stemFrames.length] ||
      STEM_VARIANTS[variantIndex % STEM_VARIANTS.length];
  const evidenceDemand = concreteEvidenceDemand(pattern, angle, variantIndex);
  const correctMove = pattern.correctAnswerMoves[variantIndex % pattern.correctAnswerMoves.length];
  const options = optionsForBlueprint(blueprint, pattern, correctAnswer, variantIndex, angle);
  const correctOption = options.find((option) => option.letter === correctAnswer);

  return {
    benchmark_code: input.benchmarkCode,
    reporting_category: pattern.reportingCategory,
    grade: input.grade ?? 9,
    passage_type: passageType,
    passage_title: passage.title,
    passage_text: passage.text,
    passage_word_count: wordCount(passage.text),
    item_type: pattern.itemType,
    stem_pattern: pattern.stemFamily,
    prompt_text: stemTemplate
      .replace('{skill}', blueprint.skill)
      .replace('{evidenceDemand}', evidenceDemand),
    options,
    correct_answer: correctAnswer,
    correct_rationale: vocabTemplate
      ? `${correctAnswer} is correct because ${vocabTemplate.rationale}`
      : `${correctAnswer} is correct because it supports the benchmark move: ${correctMove}. The answer is anchored in this passage detail: ${correctOption?.text ?? pattern.evidenceDemand}`,
    distractor_rationales: distractorRationalesForBlueprint(
      blueprint,
      pattern,
      correctAnswer,
      variantIndex
    ),
    remediation_hint: pattern.remediationMove,
    reassessment_plan: blueprint.reassessmentPlan,
    difficulty_estimate: pattern.itemType === 'multiple_choice' ? 2 : 3,
  };
}

export function evaluateOriginalItemQuality(draft: OriginalItemDraft): OriginalItemQualityGate {
  const blueprint = BLUEPRINTS[draft.benchmark_code];
  const matchingPatterns = FAST_BENCHMARK_PATTERNS[draft.benchmark_code];
  const pattern =
    matchingPatterns.find(
      (candidate) =>
        candidate.stemFamily === draft.stem_pattern &&
        candidate.itemType === draft.item_type &&
        candidate.passageType === draft.passage_type
    ) ??
    matchingPatterns.find((candidate) => candidate.stemFamily === draft.stem_pattern) ??
    matchingPatterns[0];
  const checks: OriginalItemQualityGate['checks'] = [];
  const skillKeywords = blueprint.skill.split(/\s+/).filter((word) => word.length > 4);
  const patternKeywords = [
    ...pattern.evidenceDemand.split(/\s+/),
    ...pattern.correctAnswerMoves.join(' ').split(/\s+/),
  ].filter((word) => word.length > 4);
  const promptEvidenceText = `${draft.prompt_text} ${draft.correct_rationale} ${draft.remediation_hint} ${draft.reassessment_plan}`;
  const correctAnswerLetters = draft.correct_answer
    .split(',')
    .map((letter) => letter.trim())
    .filter(Boolean);
  const optionLetters = new Set(draft.options.map((option) => option.letter));
  const distractorLetters = draft.options
    .map((option) => option.letter)
    .filter((letter) => !correctAnswerLetters.includes(letter));
  const correctOptionText = draft.options
    .filter((option) => correctAnswerLetters.includes(option.letter))
    .map((option) => option.text)
    .join(' ');
  const isVocabularyItem =
    draft.benchmark_code === 'ELA.9.V.1.2' || draft.benchmark_code === 'ELA.9.V.1.3';

  addQualityCheck(checks, {
    key: 'benchmark',
    label: 'Benchmark demand',
    maxPoints: 18,
    passed:
      draft.reporting_category === pattern.reportingCategory &&
      draft.stem_pattern === pattern.stemFamily &&
      (isVocabularyItem ||
        keywordHits(promptEvidenceText, skillKeywords) >= Math.min(2, skillKeywords.length)),
    note: `Matches ${draft.benchmark_code} through ${pattern.name}, not a generic reading question.`,
  });

  addQualityCheck(checks, {
    key: 'pattern',
    label: 'Released FAST item pattern',
    maxPoints: 14,
    passed:
      draft.item_type === pattern.itemType &&
      keywordHits(promptEvidenceText, patternKeywords) >= Math.min(2, patternKeywords.length),
    note: pattern.releasedFastEvidence,
  });

  addQualityCheck(checks, {
    key: 'passage_type',
    label: 'FAST-style passage fit',
    maxPoints: 14,
    passed:
      draft.passage_type === pattern.passageType ||
      (pattern.passageType === 'informational' &&
        ['informational', 'argument'].includes(draft.passage_type)) ||
      (pattern.passageType === 'literary' && ['literary', 'poetry'].includes(draft.passage_type)),
    note: `This pattern expects ${pattern.passageType} passages.`,
  });

  addQualityCheck(checks, {
    key: 'word_count',
    label: 'Passage length',
    maxPoints: 10,
    passed: draft.passage_word_count >= 90 && draft.passage_word_count <= 900,
    note: `${draft.passage_word_count} words keeps the draft usable for short remediation and reassessment.`,
  });

  addQualityCheck(checks, {
    key: 'passage_authenticity',
    label: 'FAST-style passage texture',
    maxPoints: 16,
    passed: hasFastStylePassageTexture(draft) && !hasGenericAiPassageTexture(draft),
    note: 'Passage needs concrete texture, text-specific evidence, and no generic worksheet framing.',
  });

  addQualityCheck(checks, {
    key: 'answer_key',
    label: 'Answer key integrity',
    maxPoints: 14,
    passed:
      draft.options.length >= 4 &&
      correctAnswerLetters.length >= 1 &&
      correctAnswerLetters.every((letter) => optionLetters.has(letter)),
    note: 'The correct answer must point to a visible option.',
  });

  addQualityCheck(checks, {
    key: 'distractors',
    label: 'Distractor logic',
    maxPoints: 14,
    passed:
      distractorLetters.length >= 3 &&
      distractorLetters.every((letter) => Boolean(draft.distractor_rationales[letter])) &&
      Object.values(draft.distractor_rationales).some((rationale) =>
        pattern.distractorTraps.some((trap) =>
          rationale.toLowerCase().includes(trap.toLowerCase().slice(0, 18))
        )
      ),
    note: `Distractors target FAST traps: ${pattern.distractorTraps.slice(0, 2).join('; ')}.`,
  });

  addQualityCheck(checks, {
    key: 'evidence',
    label: 'Evidence alignment',
    maxPoints: 16,
    passed:
      (isVocabularyItem &&
        /Read this sentence:/i.test(draft.prompt_text) &&
        draft.correct_rationale.toLowerCase().includes('because')) ||
      draft.correct_rationale.toLowerCase().includes(pattern.evidenceDemand.toLowerCase()) ||
      draft.options.some((option) =>
        option.text.toLowerCase().includes(pattern.evidenceDemand.toLowerCase())
      ) ||
      keywordHits(`${draft.correct_rationale} ${correctOptionText}`, patternKeywords) >= 2,
    note: 'The correct answer must be tied to the passage evidence demand, not just a generic skill.',
  });

  if (isVocabularyItem) {
    addQualityCheck(checks, {
      key: 'vocab_context',
      label: 'Vocabulary context',
      maxPoints: 14,
      passed:
        /Read this sentence:/i.test(draft.prompt_text) &&
        draft.prompt_text.includes('"') &&
        draft.options.every((option) => !/^It /i.test(option.text)) &&
        draft.correct_rationale.length >= 40,
      note: 'Vocabulary items need a target word, sentence context, meaning choices, and context/word-part rationale.',
    });
  }

  addQualityCheck(checks, {
    key: 'student_facing',
    label: 'Student-facing wording',
    maxPoints: 10,
    passed:
      draft.prompt_text.length >= 20 &&
      draft.options.every((option) => option.text.length >= (isVocabularyItem ? 6 : 20)) &&
      !draft.options.some((option) => /^It shows how to /i.test(option.text)) &&
      !hasBlueprintLanguage(draft.options),
    note: 'Answer choices should read like real passage-based choices, not generator notes.',
  });

  addQualityCheck(checks, {
    key: 'instructional_loop',
    label: 'Remediation loop',
    maxPoints: 14,
    passed:
      draft.remediation_hint.length >= 35 &&
      draft.reassessment_plan.length >= 35 &&
      keywordHits(`${draft.remediation_hint} ${draft.reassessment_plan}`, [
        'ask',
        'choose',
        'use',
        'find',
        'test',
      ]) >= 1,
    note: 'GOGI needs the item to drive what the student should do next.',
  });

  const maxScore = checks.reduce((sum, check) => sum + check.maxPoints, 0);
  const rawScore = checks.reduce((sum, check) => sum + check.points, 0);
  const score = Math.round((rawScore / maxScore) * 100);
  const criticalFailure = checks.some(
    (check) =>
      ['benchmark', 'answer_key', 'passage_authenticity', 'student_facing'].includes(check.key) &&
      !check.passed
  );
  const status = criticalFailure ? 'not_enough_data' : qualityStatus(score);
  const decision = criticalFailure ? 'reject' : qualityDecision(score);

  return {
    score,
    status,
    decision,
    pattern: {
      id: pattern.id,
      name: pattern.name,
      evidenceDemand: pattern.evidenceDemand,
      releasedFastEvidence: pattern.releasedFastEvidence,
    },
    summary:
      decision === 'pass'
        ? 'Strong enough to enter the draft bank as FAST-aligned original practice.'
        : decision === 'review'
          ? 'Close, but needs teacher/admin review before use.'
          : 'Not enough alignment evidence yet; regenerate or revise before use.',
    checks,
  };
}

export function buildOriginalFastAlignedDraftSet(input: {
  benchmarkCode: OriginalItemBenchmark;
  passageType?: OriginalPassageType;
  topic?: string;
  grade?: number;
  count?: number;
}) {
  const count = Math.max(1, Math.min(25, Math.floor(input.count ?? 1)));
  return Array.from({ length: count }).map((_, index) =>
    buildOriginalFastAlignedDraft({
      benchmarkCode: input.benchmarkCode,
      passageType: input.passageType,
      topic: topicForVariant(input.topic, index),
      grade: input.grade,
      variantIndex: index,
    })
  );
}

export function isOriginalBenchmark(value: string): value is OriginalItemBenchmark {
  return ORIGINAL_ITEM_BENCHMARKS.includes(value as OriginalItemBenchmark);
}

export function isOriginalPassageType(value: string): value is OriginalPassageType {
  return ORIGINAL_PASSAGE_TYPES.includes(value as OriginalPassageType);
}

export function getPreferredOriginalPassageType(benchmarkCode: OriginalItemBenchmark) {
  return BLUEPRINTS[benchmarkCode].preferredPassageType;
}
