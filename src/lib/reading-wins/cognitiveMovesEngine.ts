export type CognitiveMove = {
  id: string;
  label: string;
  studentAction: string;
  teacherLookFor: string;
  weight: 1 | 2 | 3;
};

export type CognitiveBreakpoint = {
  id: string;
  label: string;
  failurePattern: string;
  repairMove: string;
};

export type TeachingProtocolStep = {
  id: string;
  label: string;
  teacherMove: string;
  studentMove: string;
};

export type ItemFormatProtocol = {
  format: 'single_stem' | 'evidence_based_2_part' | 'matrix' | 'multi_select';
  addedMoves: number;
  studentProtocol: string;
  failureRisk: string;
};

export type CognitiveMoveProfile = {
  standardCode: string;
  honestSkillName: string;
  skillSummary: string;
  chain: CognitiveMove[];
  breakpoints: CognitiveBreakpoint[];
  teachingProtocol: TeachingProtocolStep[];
  defaultFormat: ItemFormatProtocol['format'];
  difficultySignal: string;
  engineImplication: string;
};

export type CognitiveDifficultyEstimate = {
  moveCount: number;
  moveWeight: number;
  formatAddedMoves: number;
  totalLoad: number;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  signal: 'strong_signal' | 'emerging_signal' | 'not_enough_data';
  explanation: string;
};

export const FORMAT_PROTOCOLS: Record<ItemFormatProtocol['format'], ItemFormatProtocol> = {
  single_stem: {
    format: 'single_stem',
    addedMoves: 0,
    studentProtocol: 'Find the target text, execute the move chain once, then eliminate traps.',
    failureRisk: 'Student may answer from gist instead of completing the function move.',
  },
  evidence_based_2_part: {
    format: 'evidence_based_2_part',
    addedMoves: 2,
    studentProtocol:
      'Answer Part A, write the Part A idea in short words, then use it as an anchor for Part B.',
    failureRisk:
      'Student may get Part A right but lose the answer while shifting working memory into Part B.',
  },
  matrix: {
    format: 'matrix',
    addedMoves: 3,
    studentProtocol:
      'Treat each row as its own question: Passage 1, Passage 2, Both, then verify the row before moving on.',
    failureRisk:
      'Student may blend passages together or miss one row, causing the whole item to collapse.',
  },
  multi_select: {
    format: 'multi_select',
    addedMoves: 1,
    studentProtocol:
      'Read all choices, mark every defensible choice, eliminate untrue choices, then commit to the required count.',
    failureRisk:
      'Student may pick the strongest single answer and add a weak second answer without rechecking.',
  },
};

export const CROSS_BENCHMARK_PRIMITIVES = [
  {
    id: 'content-vs-function',
    label: 'Content vs. function',
    studentMove: 'Ask: what does this say, and why did the author write it this way?',
    appliesTo: ['ELA.9.R.1.1', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.3.1', 'ELA.9.R.3.4'],
  },
  {
    id: 'part-a-anchor',
    label: 'Part A anchor',
    studentMove: 'Write the Part A idea in short words before reading Part B choices.',
    appliesTo: ['ELA.9.R.1.2', 'ELA.9.R.2.2', 'ELA.9.R.3.4'],
  },
  {
    id: 'row-by-row-matrix',
    label: 'Row-by-row matrix',
    studentMove: 'Answer each row as a separate mini-question before checking the whole table.',
    appliesTo: ['ELA.9.R.2.4', 'ELA.9.R.3.3'],
  },
  {
    id: 'two-column-tracking',
    label: 'Two-column tracking',
    studentMove: 'Keep Passage 1 and Passage 2 claims or effects in separate columns.',
    appliesTo: ['ELA.9.R.2.4', 'ELA.9.R.3.3'],
  },
] as const;

export const COGNITIVE_MOVE_PROFILES: Record<string, CognitiveMoveProfile> = {
  'ELA.9.R.1.1': {
    standardCode: 'ELA.9.R.1.1',
    honestSkillName: 'Author craft: content to function',
    skillSummary:
      'Recognize that an author chose a detail or style move deliberately, then explain what that choice does to meaning.',
    defaultFormat: 'single_stem',
    chain: [
      {
        id: 'identify-detail',
        label: 'Find the selected detail',
        studentAction:
          'Locate the exact detail, description, object, or line the item is asking about.',
        teacherLookFor: 'Student can point to the correct evidence before choosing an answer.',
        weight: 1,
      },
      {
        id: 'content-function-shift',
        label: 'Shift from content to function',
        studentAction: 'Ask what the detail does, not just what it says.',
        teacherLookFor:
          'Student uses a function verb such as emphasizes, foreshadows, contrasts, or reveals.',
        weight: 2,
      },
      {
        id: 'match-function',
        label: 'Match the function',
        studentAction: 'Choose the option that names the effect of the detail.',
        teacherLookFor: 'Student rejects answer choices that only summarize the content.',
        weight: 1,
      },
    ],
    breakpoints: [
      {
        id: 'content-trap',
        label: 'Stops at content',
        failurePattern:
          'Student chooses a true statement about the text but not the function of the detail.',
        repairMove:
          'Ask two questions for the same sentence: what does it say, and why this wording?',
      },
      {
        id: 'function-vocab-thin',
        label: 'Function vocabulary is thin',
        failurePattern:
          'Student cannot distinguish foreshadows, emphasizes, contrasts, reveals, and develops.',
        repairMove: 'Teach a small function-verb bank and require one verb in every explanation.',
      },
    ],
    teachingProtocol: [
      {
        id: 'content-function-t-chart',
        label: 'Content/function T-chart',
        teacherMove: 'Put the same sentence into two columns: what it says and what it does.',
        studentMove: 'Complete both columns before seeing answer choices.',
      },
      {
        id: 'eliminate-content-traps',
        label: 'Eliminate content traps',
        teacherMove: 'Mark which options retell content and which options name function.',
        studentMove: 'Cross out content-only choices before picking an answer.',
      },
    ],
    difficultySignal:
      'Items with three moves were easier than items requiring a fourth function-discrimination move.',
    engineImplication:
      'Instrument whether the student reaches the content-to-function shift; this is the core move.',
  },
  'ELA.9.R.1.2': {
    standardCode: 'ELA.9.R.1.2',
    honestSkillName: 'Theme claim plus evidence anchor',
    skillSummary:
      'Convert story content into a universal claim and hold that claim while choosing evidence that develops it.',
    defaultFormat: 'evidence_based_2_part',
    chain: [
      {
        id: 'extract-topic',
        label: 'Name the topic',
        studentAction: 'Say what the story is about in one or two words.',
        teacherLookFor: 'Student can separate topic from theme.',
        weight: 1,
      },
      {
        id: 'convert-theme',
        label: 'Convert topic to theme',
        studentAction: 'Turn the topic into a complete sentence about people, choices, or life.',
        teacherLookFor: 'Student produces a universal claim, not a plot summary.',
        weight: 2,
      },
      {
        id: 'test-universal',
        label: 'Run the universality test',
        studentAction: 'Ask whether the theme could be true in another story.',
        teacherLookFor: 'Student eliminates choices that are too narrow or too specific.',
        weight: 1,
      },
      {
        id: 'anchor-evidence',
        label: 'Anchor evidence to theme',
        studentAction: 'Hold the theme while choosing the details that develop it.',
        teacherLookFor: 'Student chooses evidence for the selected theme, not another true idea.',
        weight: 3,
      },
    ],
    breakpoints: [
      {
        id: 'topic-as-theme',
        label: 'Topic as theme',
        failurePattern:
          'Student picks a topic or moral-sounding line instead of a universal claim.',
        repairMove: 'Require theme answers to be complete sentences that work outside the story.',
      },
      {
        id: 'part-b-drift',
        label: 'Part B drift',
        failurePattern: 'Student gets the theme but picks evidence for a different theme.',
        repairMove: 'Write the Part A theme in five words before opening Part B.',
      },
    ],
    teachingProtocol: [
      {
        id: 'topic-to-theme',
        label: 'Topic to theme ladder',
        teacherMove: 'Start with one-word topic, then force a full sentence claim.',
        studentMove: 'Upgrade “friendship” into “shared goals can quickly build trust.”',
      },
      {
        id: 'part-a-memory-anchor',
        label: 'Part A memory anchor',
        teacherMove: 'Make the student carry a short Part A anchor into Part B.',
        studentMove: 'Use the anchor to reject evidence that proves a different idea.',
      },
    ],
    difficultySignal: 'Two-part theme items add working-memory load and drop performance sharply.',
    engineImplication:
      'Theme Reading Wins must log both theme recognition and evidence-anchor accuracy separately.',
  },
  'ELA.9.R.1.3': {
    standardCode: 'ELA.9.R.1.3',
    honestSkillName: 'Perspective gap detection',
    skillSummary:
      'Detect the gap between what is said, what is meant, and what the author lets the reader see.',
    defaultFormat: 'single_stem',
    chain: [
      {
        id: 'separate-voices',
        label: 'Separate voices',
        studentAction: 'Separate narrator, character, speaker, and author when needed.',
        teacherLookFor: 'Student does not collapse narrator perspective into author purpose.',
        weight: 2,
      },
      {
        id: 'detect-gap',
        label: 'Detect the gap',
        studentAction:
          'Notice what the reader understands that a character or speaker does not say directly.',
        teacherLookFor: 'Student can name the contrast or reversal.',
        weight: 2,
      },
      {
        id: 'name-effect',
        label: 'Name irony or satire effect',
        studentAction: 'Explain how the gap creates irony, criticism, or satire.',
        teacherLookFor: 'Student distinguishes irony from simple surprise.',
        weight: 2,
      },
    ],
    breakpoints: [
      {
        id: 'literal-only',
        label: 'Literal-only reading',
        failurePattern: 'Student reports what happened but misses the second layer of meaning.',
        repairMove: 'Ask: what does the reader know that is not being said directly?',
      },
      {
        id: 'dual-character-load',
        label: 'Dual-character load',
        failurePattern:
          'Student cannot hold two character postures at once to see the ironic contrast.',
        repairMove: 'Use a two-row posture chart before naming the irony.',
      },
    ],
    teachingProtocol: [
      {
        id: 'two-voice-model',
        label: 'Two-voice model',
        teacherMove: 'Explain narrator voice versus author choice with a quick non-test example.',
        studentMove: 'Say what the voice says, then what the author wants the reader to notice.',
      },
      {
        id: 'posture-chart',
        label: 'Posture chart',
        teacherMove: 'Chart character one posture and character two posture.',
        studentMove: 'Explain what the author shows by placing them next to each other.',
      },
    ],
    difficultySignal:
      'Move-count alone undercounts difficulty here; move-weight rises when dual tracking is required.',
    engineImplication:
      'Difficulty must account for move-weight, especially dual-character or narrator-author tracking.',
  },
  'ELA.9.R.2.1': {
    standardCode: 'ELA.9.R.2.1',
    honestSkillName: 'Structure to purpose',
    skillSummary:
      'Read informational text as something built for a purpose, then explain the job of a paragraph, sequence, feature, or structure.',
    defaultFormat: 'multi_select',
    chain: [
      {
        id: 'scope-target',
        label: 'Scope the target',
        studentAction: 'Stay inside the cited paragraph, section, or feature.',
        teacherLookFor:
          'Student does not answer from the whole passage when the stem scopes locally.',
        weight: 1,
      },
      {
        id: 'label-structure',
        label: 'Label the structure',
        studentAction: 'Name the structure or feature job.',
        teacherLookFor:
          'Student can use terms like example, cause/effect, sequence, contrast, or problem/solution.',
        weight: 2,
      },
      {
        id: 'connect-purpose',
        label: 'Connect structure to purpose',
        studentAction: 'Explain why the author put that structure there.',
        teacherLookFor: 'Student explains function, not just paragraph content.',
        weight: 2,
      },
    ],
    breakpoints: [
      {
        id: 'content-not-structure',
        label: 'Content, not structure',
        failurePattern: 'Student summarizes a paragraph instead of naming its structural job.',
        repairMove: 'Ask: what job does this paragraph do in the whole text?',
      },
      {
        id: 'scope-drift',
        label: 'Scope drift',
        failurePattern:
          'Student picks an answer true of the passage but not true of the cited section.',
        repairMove: 'Point to the cited lines before looking at options.',
      },
    ],
    teachingProtocol: [
      {
        id: 'five-structures',
        label: 'Five structures',
        teacherMove:
          'Teach sequence, compare/contrast, cause/effect, problem/solution, and description as live vocabulary.',
        studentMove: 'Label the section structure before choosing the purpose answer.',
      },
      {
        id: 'why-this-order',
        label: 'Why this order?',
        teacherMove: 'Ask what would be lost if the author organized it differently.',
        studentMove: 'Explain how order or feature changes reader understanding.',
      },
    ],
    difficultySignal:
      'Simple structure-function items are easy; select-two structure items add moves and drop sharply.',
    engineImplication:
      'Track scope discipline and multi-select protocol separately from structure knowledge.',
  },
  'ELA.9.R.2.2': {
    standardCode: 'ELA.9.R.2.2',
    honestSkillName: 'Central idea support evaluation',
    skillSummary:
      'Identify the central idea and evaluate which evidence actually develops it rather than merely mentioning the topic.',
    defaultFormat: 'evidence_based_2_part',
    chain: [
      {
        id: 'find-central-idea',
        label: 'Find the central idea',
        studentAction: 'Ask what every major section does work for.',
        teacherLookFor: 'Student rejects vivid topics that are not central.',
        weight: 2,
      },
      {
        id: 'make-anchor',
        label: 'Make a short anchor',
        studentAction: 'Write the central idea in short words before evaluating evidence.',
        teacherLookFor: 'Student can keep the controlling idea active.',
        weight: 1,
      },
      {
        id: 'support-vs-mention',
        label: 'Support versus mention',
        studentAction:
          'Choose evidence that develops the idea, not just evidence on the same topic.',
        teacherLookFor: 'Student can explain why a true detail is not the best support.',
        weight: 3,
      },
    ],
    breakpoints: [
      {
        id: 'central-idea-cascade',
        label: 'Central idea cascade',
        failurePattern: 'Wrong Part A makes all Part B evidence feel plausible.',
        repairMove: 'Central idea must pass the every-section test before Part B begins.',
      },
      {
        id: 'mention-as-support',
        label: 'Mention as support',
        failurePattern: 'Student chooses a true detail because it mentions the topic.',
        repairMove: 'Ask: does this detail make the central idea stronger?',
      },
    ],
    teachingProtocol: [
      {
        id: 'load-bearing-wall',
        label: 'Load-bearing wall',
        teacherMove: 'Frame central idea as the wall the passage is built around.',
        studentMove: 'Test whether each section supports that wall.',
      },
      {
        id: 'true-but-not-best',
        label: 'True but not best',
        teacherMove: 'Show a true distractor and ask why it is not the best support.',
        studentMove: 'Reject details that support a different idea.',
      },
    ],
    difficultySignal:
      'Two-part central-idea items cluster near 40 percent because Part B depends on Part A.',
    engineImplication: 'Log central-idea accuracy and evidence-support accuracy as separate moves.',
  },
  'ELA.9.R.2.3': {
    standardCode: 'ELA.9.R.2.3',
    honestSkillName: 'Rhetorical appeal to purpose',
    skillSummary:
      'Identify how an author uses logic, credibility, emotion, morality, evidence, or figurative language to achieve a purpose.',
    defaultFormat: 'single_stem',
    chain: [
      {
        id: 'name-appeal',
        label: 'Name the appeal',
        studentAction:
          'Decide whether the author is using logic, credibility, emotion, morality, or vivid language.',
        teacherLookFor: 'Student names the persuasive move before picking an option.',
        weight: 2,
      },
      {
        id: 'connect-purpose',
        label: 'Connect to purpose',
        studentAction:
          'Explain how the appeal supports what the author wants the reader to believe.',
        teacherLookFor: 'Student links appeal to purpose, not just topic.',
        weight: 2,
      },
      {
        id: 'verify-evidence',
        label: 'Verify with evidence',
        studentAction: 'Point to the sentence or detail that creates the appeal.',
        teacherLookFor: 'Student can prove the appeal using text, not vibes.',
        weight: 1,
      },
    ],
    breakpoints: [
      {
        id: 'appeal-vocab-gap',
        label: 'Appeal vocabulary gap',
        failurePattern: 'Student cannot decode terms like authority, logic, emotion, or morality.',
        repairMove: 'Teach appeal terms in plain language with one example each.',
      },
      {
        id: 'topic-not-purpose',
        label: 'Topic, not purpose',
        failurePattern:
          'Student notices the topic but cannot say what the author is trying to make the reader think.',
        repairMove: 'Ask: what belief is the author trying to build?',
      },
    ],
    teachingProtocol: [
      {
        id: 'appeal-sort',
        label: 'Appeal sort',
        teacherMove: 'Sort examples into facts/logic, expert credibility, emotion, and morality.',
        studentMove: 'Name the appeal before explaining the effect.',
      },
      {
        id: 'because-purpose',
        label: 'Because-purpose sentence',
        teacherMove: 'Force the sentence: this helps the author because...',
        studentMove: 'Complete the purpose link in one sentence.',
      },
    ],
    difficultySignal:
      'Appeal items become hard when vocabulary labels are missing or purpose is not explicit.',
    engineImplication: 'Diagnose rhetorical vocabulary separately from author-purpose reasoning.',
  },
  'ELA.9.R.2.4': {
    standardCode: 'ELA.9.R.2.4',
    honestSkillName: 'Two-argument simultaneous tracking',
    skillSummary:
      'Hold two arguments side-by-side, keep claims and evidence separate, and evaluate how each develops its position.',
    defaultFormat: 'matrix',
    chain: [
      {
        id: 'separate-passages',
        label: 'Separate the passages',
        studentAction: 'Build two lanes: Passage 1 says, Passage 2 says.',
        teacherLookFor: 'Student does not blend arguments into one gist.',
        weight: 3,
      },
      {
        id: 'claim-evidence-map',
        label: 'Map claim and evidence',
        studentAction: 'Name each author’s claim and one evidence type.',
        teacherLookFor: 'Student separates claim, reason, evidence, and limitation.',
        weight: 3,
      },
      {
        id: 'row-by-row',
        label: 'Answer row by row',
        studentAction: 'For matrix items, answer each row as its own question.',
        teacherLookFor: 'Student verifies each row before moving to the next.',
        weight: 2,
      },
    ],
    breakpoints: [
      {
        id: 'argument-blend',
        label: 'Argument blending',
        failurePattern:
          'Student remembers the topic but cannot attribute claims to the correct passage.',
        repairMove: 'Keep a visible two-column claim map while answering.',
      },
      {
        id: 'matrix-collapse',
        label: 'Matrix collapse',
        failurePattern:
          'Student treats the table as one big item instead of three independent decisions.',
        repairMove: 'Cover all but one row and answer one row at a time.',
      },
    ],
    teachingProtocol: [
      {
        id: 'two-column-map',
        label: 'Two-column map',
        teacherMove: 'Create Passage 1 and Passage 2 lanes for claim, evidence, and limit.',
        studentMove: 'Fill the lanes before looking at table choices.',
      },
      {
        id: 'matrix-rehearsal',
        label: 'Matrix rehearsal',
        teacherMove: 'Model one row, then release one row at a time.',
        studentMove: 'Say Passage 1, Passage 2, Both, or Neither for each row.',
      },
    ],
    difficultySignal:
      'Matrix argument items create the steepest difficulty cliff because every row compounds error risk.',
    engineImplication:
      'Multi-passage argument comparison needs its own pathway, not generic informational practice.',
  },
  'ELA.9.R.3.1': {
    standardCode: 'ELA.9.R.3.1',
    honestSkillName: 'Figurative language effect',
    skillSummary:
      'Identify a figurative move, interpret what the image means in context, and explain its effect on mood, tone, meaning, or reader understanding.',
    defaultFormat: 'single_stem',
    chain: [
      {
        id: 'spot-figurative',
        label: 'Spot the figurative move',
        studentAction: 'Notice the image, personification, exaggeration, or comparison.',
        teacherLookFor: 'Student isolates the exact phrase doing figurative work.',
        weight: 1,
      },
      {
        id: 'interpret-image',
        label: 'Interpret the image',
        studentAction: 'Say what the image suggests in this passage.',
        teacherLookFor: 'Student moves past literal meaning into the implied idea.',
        weight: 2,
      },
      {
        id: 'connect-effect',
        label: 'Connect to effect',
        studentAction: 'Explain what the figurative language changes for the reader.',
        teacherLookFor:
          'Student connects the phrase to mood, tone, meaning, or reader understanding.',
        weight: 2,
      },
      {
        id: 'context-discriminate',
        label: 'Use context to choose the effect',
        studentAction: 'Use surrounding context to choose the effect that best fits the passage.',
        teacherLookFor: 'Student can explain why a tempting effect is close but not correct.',
        weight: 2,
      },
    ],
    breakpoints: [
      {
        id: 'effect-vocab-thin',
        label: 'Effect vocabulary is thin',
        failurePattern:
          'Student can sense that the phrase matters but cannot name whether it affects mood, tone, meaning, or reader understanding.',
        repairMove:
          'Build a small effect-language bank with mood, tone, emphasis, contrast, and reader understanding.',
      },
      {
        id: 'literal-definition',
        label: 'Literal definition',
        failurePattern:
          'Student explains the phrase literally instead of what it suggests or does.',
        repairMove:
          'Ask: what image do the words create, and what does that image make you understand?',
      },
    ],
    teachingProtocol: [
      {
        id: 'effect-word-bank',
        label: 'Effect word bank',
        teacherMove:
          'Offer effect choices such as mood, tone, emphasis, contrast, reader expectation, and character understanding.',
        studentMove: 'Choose the effect category and prove it with the phrase.',
      },
      {
        id: 'figurative-mechanism',
        label: 'Figurative mechanism',
        teacherMove: 'Ask what is being compared or personified and what effect that creates.',
        studentMove: 'Write phrase → image/meaning → effect.',
      },
    ],
    difficultySignal:
      'Figurative-language items get harder when students must discriminate among multiple plausible effects, not just identify a device.',
    engineImplication:
      'Track device recognition, image interpretation, and effect explanation as separate moves within the R.3.1 band.',
  },
  'ELA.9.R.3.3': {
    standardCode: 'ELA.9.R.3.3',
    honestSkillName: 'Adaptation keep/change/message',
    skillSummary:
      'Compare how texts adapt a source by identifying what each keeps, changes, and emphasizes.',
    defaultFormat: 'matrix',
    chain: [
      {
        id: 'source-orientation',
        label: 'Source orientation',
        studentAction: 'Confirm the basic source story or pattern before comparing adaptations.',
        teacherLookFor: 'Student can distinguish knowledge gap from comparison-skill gap.',
        weight: 3,
      },
      {
        id: 'keep-change',
        label: 'Keep/change comparison',
        studentAction: 'Name what each adaptation keeps and changes.',
        teacherLookFor: 'Student does not stop at shared surface content.',
        weight: 2,
      },
      {
        id: 'changed-message',
        label: 'Changed message',
        studentAction: 'Explain how the change shifts the author’s message or attitude.',
        teacherLookFor: 'Student can identify divergent tone or purpose.',
        weight: 3,
      },
    ],
    breakpoints: [
      {
        id: 'source-knowledge-gap',
        label: 'Source knowledge gap',
        failurePattern:
          'Student cannot tell what was adapted because the source story is unfamiliar.',
        repairMove: 'Give a 60-second source summary, then retest the comparison move.',
      },
      {
        id: 'surface-similarity',
        label: 'Surface similarity',
        failurePattern: 'Student matches shared characters or events but misses changed meaning.',
        repairMove: 'Ask what stayed the same, what changed, and why the change matters.',
      },
    ],
    teachingProtocol: [
      {
        id: 'knowledge-or-skill',
        label: 'Knowledge or skill check',
        teacherMove: 'Briefly supply the source pattern and see whether performance jumps.',
        studentMove: 'Use the source summary to compare adaptations.',
      },
      {
        id: 'keep-change-emphasize',
        label: 'Keep/change/emphasize chart',
        teacherMove: 'Chart what each text keeps, changes, and emphasizes.',
        studentMove: 'Use the chart to answer comparison or matrix rows.',
      },
    ],
    difficultySignal:
      'Adaptation matrix items combine source knowledge, comparison, tone, and format load.',
    engineImplication:
      'The engine must flag knowledge gaps separately from adaptation-comparison skill gaps.',
  },
  'ELA.9.R.3.4': {
    standardCode: 'ELA.9.R.3.4',
    honestSkillName: 'Rhetorical move to reader effect',
    skillSummary:
      'Identify a rhetorical move and explain what it does to the reader’s thinking, feeling, or belief.',
    defaultFormat: 'evidence_based_2_part',
    chain: [
      {
        id: 'identify-rhetoric',
        label: 'Identify the rhetorical move',
        studentAction:
          'Notice rhetorical question, appeal, irony, allusion, contrast, or loaded wording.',
        teacherLookFor: 'Student can name the move in plain language.',
        weight: 2,
      },
      {
        id: 'reader-effect',
        label: 'Name reader effect',
        studentAction: 'Say what the move makes the reader think, feel, or notice.',
        teacherLookFor: 'Student moves from content to effect.',
        weight: 2,
      },
      {
        id: 'global-role',
        label: 'Connect to global role',
        studentAction: 'Connect the rhetorical move to the passage’s larger purpose or claim.',
        teacherLookFor: 'Student can carry Part A into Part B on paired items.',
        weight: 3,
      },
    ],
    breakpoints: [
      {
        id: 'rhetorical-vocab-gap',
        label: 'Rhetorical vocabulary gap',
        failurePattern: 'Student cannot decode rhetorical labels in the stem or choices.',
        repairMove:
          'Teach ethos, pathos, logos, rhetorical question, allusion, parallelism, and hyperbole in plain language.',
      },
      {
        id: 'content-instead-effect',
        label: 'Content instead of effect',
        failurePattern:
          'Student describes what the sentence says but not what it does to the reader.',
        repairMove: 'Require the sentence stem: this makes the reader...',
      },
    ],
    teachingProtocol: [
      {
        id: 'rhetoric-vocab',
        label: 'Rhetoric vocabulary',
        teacherMove: 'Build a small live vocabulary of rhetorical moves with quick examples.',
        studentMove: 'Name the move before explaining effect.',
      },
      {
        id: 'effect-sentence',
        label: 'Effect sentence',
        teacherMove: 'Prompt: this makes the reader think/feel/notice...',
        studentMove: 'Complete the effect sentence with text evidence.',
      },
    ],
    difficultySignal:
      'Two-part rhetoric items add global passage-awareness and drop performance heavily.',
    engineImplication:
      'Rhetoric Reading Wins must separately instrument move identification, reader effect, and global purpose.',
  },
  'ELA.9.V.1.2': {
    standardCode: 'ELA.9.V.1.2',
    honestSkillName: 'Bidirectional morphology',
    skillSummary:
      'Use roots, prefixes, suffixes, and etymology forward and backward to determine or locate word meaning.',
    defaultFormat: 'single_stem',
    chain: [
      {
        id: 'parse-parts',
        label: 'Parse word parts',
        studentAction: 'Break the word or clue into roots, prefixes, or suffixes.',
        teacherLookFor: 'Student knows the relevant high-yield roots.',
        weight: 3,
      },
      {
        id: 'assemble-meaning',
        label: 'Assemble meaning',
        studentAction: 'Combine the parts into a meaning.',
        teacherLookFor: 'Student can reason from part meanings, not guess from vibe.',
        weight: 2,
      },
      {
        id: 'reverse-search',
        label: 'Reverse search',
        studentAction: 'When given roots or meanings, find the word that contains those parts.',
        teacherLookFor: 'Student can see roots even in familiar words.',
        weight: 3,
      },
    ],
    breakpoints: [
      {
        id: 'root-knowledge-thin',
        label: 'Root knowledge thin',
        failurePattern:
          'Student has not been explicitly taught the root meanings needed for the item.',
        repairMove: 'Teach a finite high-yield root list and reuse it across content areas.',
      },
      {
        id: 'familiarity-blindness',
        label: 'Familiarity blindness',
        failurePattern:
          'Student skips familiar words because they do not look like vocabulary targets.',
        repairMove: 'Practice finding roots inside common words.',
      },
    ],
    teachingProtocol: [
      {
        id: 'root-bank',
        label: 'Root bank',
        teacherMove: 'Teach high-yield Latin and Greek roots explicitly.',
        studentMove: 'Use roots to predict meaning before choices.',
      },
      {
        id: 'forward-reverse',
        label: 'Forward and reverse morphology',
        teacherMove: 'Practice both word → parts → meaning and parts → word.',
        studentMove: 'Decode and reverse-search in the same session.',
      },
    ],
    difficultySignal:
      'Morphology becomes hard when the task reverses direction or relies on untaught roots.',
    engineImplication:
      'Classify morphology misses as content-knowledge gaps when root knowledge is absent.',
  },
  'ELA.9.V.1.3': {
    standardCode: 'ELA.9.V.1.3',
    honestSkillName: 'Context and connotation discipline',
    skillSummary:
      'Use surrounding context and tone to choose the meaning that fits this sentence, not just a familiar dictionary meaning.',
    defaultFormat: 'single_stem',
    chain: [
      {
        id: 'read-around',
        label: 'Read around the word',
        studentAction: 'Read at least one sentence before and after the target word.',
        teacherLookFor: 'Student uses surrounding clues before options.',
        weight: 1,
      },
      {
        id: 'generate-meaning',
        label: 'Generate a meaning',
        studentAction: 'Predict the word meaning from context before looking at options.',
        teacherLookFor: 'Student can state a rough meaning in their own words.',
        weight: 2,
      },
      {
        id: 'connotation-check',
        label: 'Check connotation',
        studentAction:
          'Decide whether the meaning is neutral, positive, negative, mild, or strong in this sentence.',
        teacherLookFor: 'Student rejects denotations that are too strong, too weak, or wrong-tone.',
        weight: 2,
      },
      {
        id: 'substitution-test',
        label: 'Substitution test',
        studentAction:
          'Place each answer choice into the sentence and keep the one that preserves meaning.',
        teacherLookFor: 'Student tests context rather than choosing from memory.',
        weight: 1,
      },
    ],
    breakpoints: [
      {
        id: 'denotation-only',
        label: 'Denotation only',
        failurePattern:
          'Student picks a possible dictionary meaning that does not fit the context.',
        repairMove: 'Require context and connotation before final answer.',
      },
      {
        id: 'underuses-surrounding-context',
        label: 'Underuses surrounding context',
        failurePattern:
          'Student jumps from underlined word to options without reading the clue sentence.',
        repairMove: 'Make the student point to one clue before choosing.',
      },
    ],
    teachingProtocol: [
      {
        id: 'two-pass-vocab',
        label: 'Two-pass vocabulary',
        teacherMove: 'Pass one: rough definition. Pass two: context tone and strength.',
        studentMove: 'Use both passes before choices.',
      },
      {
        id: 'replace-and-test',
        label: 'Replace and test',
        teacherMove: 'Model substitution using each option in the original sentence.',
        studentMove: 'Reject choices that break sentence logic or tone.',
      },
    ],
    difficultySignal:
      'Connotation requirements add a move and drop performance compared with generous context items.',
    engineImplication: 'Track denotation and connotation as separate vocabulary moves.',
  },
};

export function getCognitiveMoveProfile(standardCode: string) {
  return COGNITIVE_MOVE_PROFILES[standardCode] ?? null;
}

export function getFormatProtocol(format: ItemFormatProtocol['format']) {
  return FORMAT_PROTOCOLS[format];
}

export function estimateCognitiveDifficulty(
  profile: CognitiveMoveProfile,
  format: ItemFormatProtocol['format'] = profile.defaultFormat
): CognitiveDifficultyEstimate {
  const moveCount = profile.chain.length;
  const moveWeight = profile.chain.reduce((sum, move) => sum + move.weight, 0);
  const formatAddedMoves = FORMAT_PROTOCOLS[format].addedMoves;
  const totalLoad = moveWeight + formatAddedMoves;
  const tier = totalLoad >= 11 ? 'T4' : totalLoad >= 9 ? 'T3' : totalLoad >= 6 ? 'T2' : 'T1';
  const signal =
    profile.chain.length >= 3 && profile.breakpoints.length >= 2
      ? 'strong_signal'
      : profile.chain.length >= 2
        ? 'emerging_signal'
        : 'not_enough_data';

  return {
    moveCount,
    moveWeight,
    formatAddedMoves,
    totalLoad,
    tier,
    signal,
    explanation: `${profile.honestSkillName}: ${moveCount} core moves, ${moveWeight} weighted load, +${formatAddedMoves} format moves.`,
  };
}

export function getProfilesForPrimitive(primitiveId: string) {
  const primitive = CROSS_BENCHMARK_PRIMITIVES.find((item) => item.id === primitiveId);
  if (!primitive) return [];
  return primitive.appliesTo
    .map((standardCode) => COGNITIVE_MOVE_PROFILES[standardCode])
    .filter(Boolean);
}
