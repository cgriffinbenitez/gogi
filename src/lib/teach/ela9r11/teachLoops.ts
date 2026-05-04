import type { Ela9R11MisconceptionFlag } from '@/lib/diagnostic/ela9r11';
import type { TeachLoop, TeachStep, TeachStepType } from './types';

type LoopConfig = {
  flag: Ela9R11MisconceptionFlag;
  id: string;
  routeName: string;
  title: string;
  teacherDescription: string;
  why: string;
  missingMove: string;
  element: string;
  effect: string;
  evidence: string;
  weakEvidence: string;
  distractor: string;
};

const SAMPLE_PASSAGE = {
  title: 'The Spare Key',
  author: 'GOGI 9.R.1.1 teach sample',
  text:
    'Mina found the spare key under the mat, exactly where her father said it would be. She could have gone inside and avoided the rain. Instead, she waited on the porch until he came home, holding the key in her open palm.',
  focusEvidence: ['could have gone inside', 'Instead', 'waited', 'open palm'],
};

const TRANSFER_PASSAGE = {
  title: 'Transfer: The Last Bell',
  author: 'GOGI 9.R.1.1 transfer sample',
  text:
    'The final bell rang, but Luis stayed in his seat while the hallway filled with noise. He looked at the crumpled apology note in his hand, smoothed one corner with his thumb, and placed it carefully on Ms. Rivera’s desk before walking out.',
  focusEvidence: ['stayed in his seat', 'crumpled apology note', 'smoothed one corner', 'placed it carefully'],
  targetElement: 'characterization',
  targetEffect: 'reveals Luis is trying to make a careful, honest repair',
};

const STEP_TYPES: TeachStepType[] = [
  'skill_frame',
  'notice',
  'name_the_move',
  'explain_effect',
  'connect_to_meaning',
  'use_evidence',
  'build_response',
  'revise',
  'fade_support',
];

const LOOP_CONFIGS: LoopConfig[] = [
  {
    flag: 'element_not_identified',
    id: 'element-recognition',
    routeName: 'Element Recognition Teach Loop',
    title: 'Find the author move',
    teacherDescription: 'Student does not locate the literary element the question is asking about.',
    why: 'You are learning how to spot the tool the author is using before you try to explain it.',
    missingMove: 'separate a literary element from a topic, detail, or plot event',
    element: 'characterization',
    effect: 'reveals what Mina values',
    evidence: 'Instead, she waited',
    weakEvidence: 'Mina found the spare key',
    distractor: 'plot event',
  },
  {
    flag: 'element_misidentified',
    id: 'element-sorting',
    routeName: 'Element Sorting Teach Loop',
    title: 'Sort the element correctly',
    teacherDescription: 'Student confuses one literary element with another.',
    why: 'You are learning to name the exact category before explaining what it does.',
    missingMove: 'distinguish the element from a similar category',
    element: 'characterization',
    effect: 'shows Mina choosing trust over convenience',
    evidence: 'holding the key in her open palm',
    weakEvidence: 'the porch was wet',
    distractor: 'setting',
  },
  {
    flag: 'function_not_explained',
    id: 'element-function',
    routeName: 'Element Function Teach Loop',
    title: 'Explain what the element does',
    teacherDescription: 'Student names an element but does not explain how it works in the passage.',
    why: 'You found the element. Now you need the part that says what it does.',
    missingMove: 'move from naming the element to explaining its function',
    element: 'characterization',
    effect: "reveals Mina's self-control and trust",
    evidence: 'could have gone inside and avoided the rain',
    weakEvidence: 'Mina waited',
    distractor: 'just naming the element',
  },
  {
    flag: 'effect_confused_with_summary',
    id: 'summary-to-analysis',
    routeName: 'Summary-to-Analysis Teach Loop',
    title: 'Turn summary into analysis',
    teacherDescription: 'Student retells what happened instead of explaining the effect on meaning or style.',
    why: 'You are learning the difference between what happened and why the author made it happen that way.',
    missingMove: 'turn a plot event into an analytical effect',
    element: 'characterization',
    effect: 'shows that trust matters more than comfort',
    evidence: 'Instead, she waited on the porch',
    weakEvidence: 'Mina was on the porch',
    distractor: 'summary',
  },
  {
    flag: 'meaning_connection_missing',
    id: 'meaning-connection',
    routeName: 'Meaning Connection Teach Loop',
    title: 'Answer the so what',
    teacherDescription: 'Student notices the element but does not connect it to deeper meaning.',
    why: 'You are learning to explain why the detail matters beyond the event.',
    missingMove: 'connect element to deeper meaning',
    element: 'characterization',
    effect: 'adds a layer about trust and responsibility',
    evidence: 'holding the key in her open palm',
    weakEvidence: 'the key was under the mat',
    distractor: 'surface meaning',
  },
  {
    flag: 'style_connection_missing',
    id: 'style-craft',
    routeName: "Style and Author's Craft Teach Loop",
    title: 'Connect craft to effect',
    teacherDescription: "Student misses how word choice or structure shapes the reader's experience.",
    why: "You are learning how the author's choices shape the way the passage feels and means.",
    missingMove: 'connect author craft to reader effect',
    element: 'contrast',
    effect: "slows the moment so Mina's choice feels deliberate",
    evidence: 'could have gone inside... Instead, she waited',
    weakEvidence: 'it was raining',
    distractor: 'unexplained craft',
  },
  {
    flag: 'literal_reading_only',
    id: 'layers-of-meaning',
    routeName: 'Layers of Meaning Teach Loop',
    title: 'Go past the literal event',
    teacherDescription: 'Student stays at the surface level and misses implied meaning.',
    why: 'You are learning to move from what the text says to what it suggests.',
    missingMove: 'infer a deeper layer from the literal detail',
    element: 'symbolism',
    effect: 'suggests trust is being protected, not just a door being opened',
    evidence: 'holding the key in her open palm',
    weakEvidence: 'the spare key was under the mat',
    distractor: 'literal detail',
  },
  {
    flag: 'evidence_irrelevant',
    id: 'evidence-precision',
    routeName: 'Evidence Precision Teach Loop',
    title: 'Choose evidence that proves it',
    teacherDescription: 'Student chooses text evidence that does not support the analysis.',
    why: 'You are learning to pick evidence that actually proves the claim you are making.',
    missingMove: 'match evidence directly to the claim',
    element: 'characterization',
    effect: 'shows Mina choosing trust over convenience',
    evidence: 'Instead, she waited',
    weakEvidence: 'the porch was wet because it rained',
    distractor: 'irrelevant evidence',
  },
  {
    flag: 'evidence_misread',
    id: 'evidence-interpretation',
    routeName: 'Evidence Interpretation Teach Loop',
    title: 'Read the evidence accurately',
    teacherDescription: 'Student selects relevant evidence but misunderstands what it says or implies.',
    why: 'You are learning to paraphrase the evidence before using it.',
    missingMove: 'explain what the evidence means in context',
    element: 'characterization',
    effect: 'shows Mina intentionally waits even though she has another choice',
    evidence: 'could have gone inside and avoided the rain',
    weakEvidence: 'Mina could not get inside',
    distractor: 'misread evidence',
  },
  {
    flag: 'evidence_too_general',
    id: 'sharp-evidence',
    routeName: 'Sharp Evidence Teach Loop',
    title: 'Make the evidence sharper',
    teacherDescription: 'Student chooses broad or vague evidence instead of the smallest useful proof.',
    why: 'You are learning to replace broad evidence with the exact words that prove your idea.',
    missingMove: 'choose the smallest useful evidence',
    element: 'characterization',
    effect: "shows Mina's choice is deliberate",
    evidence: 'Instead, she waited',
    weakEvidence: 'Mina found the spare key',
    distractor: 'too-broad evidence',
  },
  {
    flag: 'quote_without_function',
    id: 'evidence-to-explanation',
    routeName: 'Evidence-to-Explanation Teach Loop',
    title: 'Explain how the quote works',
    teacherDescription: 'Student includes evidence but does not explain how it supports the answer.',
    why: 'You are learning to connect evidence to reasoning instead of dropping a quote and stopping.',
    missingMove: 'attach evidence to explanation',
    element: 'characterization',
    effect: 'reveals Mina values trust',
    evidence: 'Instead, she waited',
    weakEvidence: 'Instead, she waited',
    distractor: 'quote drop',
  },
  {
    flag: 'analysis_too_vague',
    id: 'precision-specificity',
    routeName: 'Precision and Specificity Teach Loop',
    title: 'Make the analysis specific',
    teacherDescription: 'Student gives vague analytical language that is not anchored to the passage.',
    why: 'You are learning to replace vague phrases with exact effects.',
    missingMove: 'replace vague analysis with precise explanation',
    element: 'characterization',
    effect: 'reveals trust matters more than convenience',
    evidence: 'Instead, she waited',
    weakEvidence: 'it adds detail',
    distractor: 'vague wording',
  },
  {
    flag: 'theme_element_confusion',
    id: 'theme-through-element',
    routeName: 'Theme-through-Element Teach Loop',
    title: 'Build theme through an element',
    teacherDescription: 'Student names a theme but does not explain how a literary element develops it.',
    why: 'You are learning that theme is built through choices the author makes.',
    missingMove: 'connect theme to a specific literary element',
    element: 'characterization',
    effect: 'develops a theme about trust',
    evidence: 'holding the key in her open palm',
    weakEvidence: 'trust',
    distractor: 'theme only',
  },
  {
    flag: 'tone_mood_confusion',
    id: 'tone-mood',
    routeName: 'Tone and Mood Teach Loop',
    title: 'Separate tone from mood',
    teacherDescription: 'Student confuses author attitude with the feeling created for the reader.',
    why: 'You are learning to separate who feels what: author attitude versus reader feeling.',
    missingMove: 'distinguish tone from mood and explain its effect',
    element: 'mood',
    effect: 'creates a patient, tense feeling for the reader',
    evidence: 'waited on the porch',
    weakEvidence: 'her father said it would be',
    distractor: 'tone',
  },
  {
    flag: 'point_of_view_effect_missing',
    id: 'point-of-view-effect',
    routeName: 'Point of View Effect Teach Loop',
    title: 'Explain perspective effect',
    teacherDescription: 'Student identifies point of view but misses how it shapes what the reader knows or feels.',
    why: 'You are learning how perspective controls what the reader understands.',
    missingMove: 'connect point of view to reader understanding',
    element: 'point of view',
    effect: "keeps the reader close to Mina's choice without explaining it for her",
    evidence: 'Instead, she waited',
    weakEvidence: 'her father came home',
    distractor: 'narrator label',
  },
  {
    flag: 'figurative_language_effect_missing',
    id: 'figurative-effect',
    routeName: 'Figurative Language Effect Teach Loop',
    title: 'Explain figurative effect',
    teacherDescription: 'Student recognizes figurative language but misses its effect on meaning or feeling.',
    why: 'You are learning to explain what an image, comparison, or symbol adds.',
    missingMove: 'explain what the figure adds to meaning or style',
    element: 'symbolism',
    effect: 'turns the key into a sign of trust',
    evidence: 'holding the key in her open palm',
    weakEvidence: 'the key symbolizes a key',
    distractor: 'label only',
  },
  {
    flag: 'structure_effect_missing',
    id: 'structure-effect',
    routeName: 'Structure Effect Teach Loop',
    title: 'Explain how structure changes meaning',
    teacherDescription: 'Student misses how order, pacing, repetition, or contrast shapes meaning.',
    why: "You are learning to explain how the order of details changes the reader's understanding.",
    missingMove: 'connect structure to interpretation',
    element: 'contrast',
    effect: 'the shift from could have gone inside to waited makes the choice stand out',
    evidence: 'could have gone inside... Instead, she waited',
    weakEvidence: 'Mina waited on the porch',
    distractor: 'order without effect',
  },
];

export const ELA9R11_TEACH_LOOPS: Record<Ela9R11MisconceptionFlag, TeachLoop> =
  Object.fromEntries(LOOP_CONFIGS.map((config) => [config.flag, buildLoop(config)])) as Record<Ela9R11MisconceptionFlag, TeachLoop>;

export function getEla9R11TeachLoop(flag: string | null | undefined): TeachLoop {
  if (flag && flag in ELA9R11_TEACH_LOOPS) {
    return ELA9R11_TEACH_LOOPS[flag as Ela9R11MisconceptionFlag];
  }
  return ELA9R11_TEACH_LOOPS.analysis_too_vague;
}

function buildLoop(config: LoopConfig): TeachLoop {
  return {
    id: config.id,
    standardCode: 'ELA.9.R.1.1',
    misconceptionFlag: config.flag,
    routeName: config.routeName,
    studentFriendlyTitle: config.title,
    teacherDescription: config.teacherDescription,
    whyThisLesson: config.why,
    samplePassage: SAMPLE_PASSAGE,
    transferPassage: TRANSFER_PASSAGE,
    targetElement: config.element,
    targetEffect: config.effect,
    anchorClaim: `${config.element} ${config.effect}.`,
    preciseEvidence: config.evidence,
    weakEvidence: config.weakEvidence,
    steps: STEP_TYPES.map((stepType, index) => buildStep(config, stepType, index + 1)),
    masteryCheck: {
      prompt: `Write a complete response: explain how ${config.element} adds meaning or style in the passage. Use sharp evidence.`,
      masteryCriteria: [
        `Names ${config.element} or a closely related author move`,
        'Uses a precise phrase from the passage instead of a broad plot detail',
        'Explains what the evidence reveals, creates, or changes',
      ],
      minimumScoreToPass: 3,
    },
  };
}

function buildStep(config: LoopConfig, stepType: TeachStepType, stepNumber: number): TeachStep {
  const base = {
    id: `${config.id}-${stepNumber}`,
    stepNumber,
    stepType,
    scaffoldLevel: (stepNumber <= 3 ? 1 : stepNumber <= 6 ? 2 : 3) as 1 | 2 | 3,
    feedbackRules: [
      {
        condition: 'missing_move',
        feedback: `Revise one thing: ${config.missingMove}.`,
        nextAction: 'revise' as const,
      },
    ],
  };

  switch (stepType) {
    case 'skill_frame':
      return {
        ...base,
        inputMode: 'chips',
        coachingNote: 'First, know the job. In 9.R.1.1, you are not just answering what happened. You are proving how an author move adds meaning or style.',
        studentPrompt: `Claim we are proving: ${config.element} ${config.effect}. What does your evidence need to do?`,
        expectedMove: 'prove the exact claim',
        options: ['prove the exact claim', 'repeat any detail from the plot', 'sound like a literary word'],
      };
    case 'notice':
      return {
        ...base,
        inputMode: 'chips',
        coachingNote: `Broad evidence can be related and still not prove enough. Sharp evidence is the smallest detail that does the most work.`,
        studentPrompt: 'Which detail is sharper for this claim?',
        expectedMove: config.evidence,
        options: [config.evidence, config.weakEvidence, 'the title only'],
      };
    case 'name_the_move':
      return {
        ...base,
        inputMode: 'chips',
        coachingNote: 'Now name the author move. This keeps the answer from becoming a random quote.',
        studentPrompt: 'What kind of author move are we analyzing?',
        expectedMove: config.element,
        options: [config.element, config.distractor, 'random detail'],
      };
    case 'explain_effect':
      return {
        ...base,
        inputMode: 'short_text',
        coachingNote: 'This is the part most students skip. Do not retell the event. Say what the detail does.',
        studentPrompt: `Finish the frame: The author uses ${config.element} to ___.`,
        expectedMove: config.effect,
      };
    case 'connect_to_meaning':
      return {
        ...base,
        inputMode: 'short_text',
        coachingNote: 'The so what turns an answer from summary into analysis.',
        studentPrompt: `Answer the so what: why does "${config.evidence}" matter?`,
        expectedMove: config.effect,
      };
    case 'use_evidence':
      return {
        ...base,
        inputMode: 'short_text',
        coachingNote: 'Now attach the evidence to the claim. The quote cannot sit alone.',
        studentPrompt: `Use this frame: "${config.evidence}" shows ___ because ___.`,
        expectedMove: `${config.evidence} ${config.effect}`,
      };
    case 'build_response':
      return {
        ...base,
        inputMode: 'text',
        coachingNote: 'Put the three parts together: author move, sharp evidence, effect.',
        studentPrompt: `Build the response using this order: ${config.element} + "${config.evidence}" + what it shows.`,
        expectedMove: `${config.element} ${config.evidence} ${config.effect}`,
      };
    case 'revise':
      return {
        ...base,
        inputMode: 'text',
        coachingNote: 'Revision is not punishment. It is where the answer gets sharper.',
        studentPrompt: 'Revise for one thing: make the evidence and effect connect clearly.',
        expectedMove: `${config.evidence} ${config.effect}`,
      };
    case 'fade_support':
      return {
        ...base,
        inputMode: 'text',
        coachingNote: 'Now the scaffolds fade. Same move, less help.',
        studentPrompt: 'Write the full move in your own words: author move, evidence, effect.',
        expectedMove: `${config.element} ${config.evidence} ${config.effect}`,
      };
  }
}
