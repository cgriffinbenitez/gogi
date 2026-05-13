import { getGutenbergStandardBlueprint } from '../../pipeline/standardBlueprints';

export type FastItemBlueprint = {
  standardCode: string;
  defaultMove: string;
  bannedStemPatterns: RegExp[];
  requiredStemPatterns: RegExp[];
  strandMoves: Record<
    string,
    {
      moveLabel: string;
      requiredStemPatterns?: RegExp[];
      bannedStemPatterns?: RegExp[];
      stemFrames: string[];
    }
  >;
  defaultStemFrames: string[];
};

export type FastItemStemContext = {
  standardCode: string;
  strandId?: string | null;
  strandLabel?: string | null;
  targetSignal?: string | null;
  evidenceText?: string | null;
  variantIndex?: number;
};

const GENERIC_BANNED_STEMS = [
  /which sentence contains/i,
  /identify (the )?(simile|metaphor|figurative language|device)/i,
  /what type of (figurative language|device)/i,
  /purpose of the figurative language/i,
  /what does (it|this|the phrase|the comparison|the personification|the imagery) suggest in context/i,
];

const SHARED_EFFECT_PATTERNS = [
  /effect|suggest|develop|shape|purpose|understand|meaning|mood|tone|context|support|evidence|claim|theme|central idea|structure|appeal|word|phrase/i,
];

export const FAST_ITEM_BLUEPRINTS: Record<string, FastItemBlueprint> = {
  'ELA.9.R.1.1': {
    standardCode: 'ELA.9.R.1.1',
    defaultMove: 'key element effect',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/detail|element|setting|description|action|meaning|style|effect/i],
    strandMoves: {
      'literal-detail-to-layer': {
        moveLabel: 'key detail',
        stemFrames: [
          'Read this detail from the passage: {quote}. What deeper meaning does this detail suggest?',
          'How does the detail {quote} add a layer of meaning to the passage?',
          'Which choice best explains why the author includes {quote}?',
        ],
      },
      'style-or-meaning-effect': {
        moveLabel: 'style or meaning detail',
        stemFrames: [
          'How does the author use {quote} to shape the passage’s meaning or style?',
          'What effect does {quote} have on the reader’s understanding of the passage?',
          'Which choice best explains how {quote} adds meaning to the scene?',
        ],
      },
    },
    defaultStemFrames: [
      'How does {quote} help develop the meaning of the passage?',
      'Which choice best explains the effect of {quote} in the passage?',
    ],
  },
  'ELA.9.R.1.2': {
    standardCode: 'ELA.9.R.1.2',
    defaultMove: 'theme development',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/theme|message|lesson|develop|support|evidence/i],
    strandMoves: {
      'topic-vs-theme': {
        moveLabel: 'theme statement',
        stemFrames: [
          'Which choice turns the topic of this passage into the strongest theme?',
          'Which statement best expresses the theme developed in the passage?',
        ],
      },
      'theme-development-moments': {
        moveLabel: 'theme development',
        stemFrames: [
          'How does {quote} help develop the passage’s theme?',
          'Which choice best explains how this moment develops the theme?',
        ],
      },
      'theme-evidence-fit': {
        moveLabel: 'theme evidence',
        stemFrames: [
          'Which choice best explains why {quote} supports the passage’s theme?',
          'Which evidence best supports the theme developed in the passage?',
        ],
      },
    },
    defaultStemFrames: [
      'Which choice best explains the theme developed by this passage?',
      'How does {quote} help develop the passage’s message?',
    ],
  },
  'ELA.9.R.1.3': {
    standardCode: 'ELA.9.R.1.3',
    defaultMove: 'perspective, irony, or satire',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/speaker|narrator|reader|perspective|irony|satire|attitude|contrast|gap/i],
    strandMoves: {
      'speaker-reader-gap': {
        moveLabel: 'speaker-reader gap',
        stemFrames: [
          'What gap does {quote} create between what is said and what the reader understands?',
          'Which choice best explains what the reader understands that the speaker does not?',
        ],
      },
      'irony-reversal-contrast': {
        moveLabel: 'ironic contrast',
        stemFrames: [
          'How does the contrast in {quote} create irony?',
          'Which choice best explains the irony created by this reversal?',
        ],
      },
      'satire-exaggeration-ridicule': {
        moveLabel: 'satirical exaggeration',
        stemFrames: [
          'How does the exaggeration in {quote} help criticize an idea or behavior?',
          'Which choice best explains the satirical effect of {quote}?',
        ],
      },
      'perspective-effect-evidence': {
        moveLabel: 'perspective evidence',
        stemFrames: [
          'What does {quote} show about the narrator’s perspective?',
          'Which choice best explains the attitude revealed by {quote}?',
        ],
      },
    },
    defaultStemFrames: [
      'Which choice best explains the speaker’s perspective in this passage?',
      'What does {quote} show about the narrator’s attitude?',
    ],
  },
  'ELA.9.R.2.1': {
    standardCode: 'ELA.9.R.2.1',
    defaultMove: 'structure and purpose',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/structure|section|paragraph|feature|organize|purpose|shift|contrast|cause|effect/i],
    strandMoves: {
      'structure-types': {
        moveLabel: 'structure type',
        stemFrames: [
          'Which choice best explains how this part of the passage is organized?',
          'How does the structure of this section help build meaning?',
        ],
      },
      'paragraph-job': {
        moveLabel: 'paragraph job',
        stemFrames: [
          'What job does this paragraph or section do in the passage?',
          'How does this part of the passage shift or extend the author’s idea?',
        ],
      },
      'feature-purpose': {
        moveLabel: 'text feature purpose',
        stemFrames: [
          'How does this feature help the reader understand the author’s purpose?',
          'Why does the author include this feature in the text?',
        ],
      },
      'structure-to-author-purpose': {
        moveLabel: 'structure-purpose connection',
        stemFrames: [
          'How does the structure help the author achieve a purpose?',
          'Which choice best explains why this part appears here?',
        ],
      },
    },
    defaultStemFrames: [
      'How does this part of the passage help the author build meaning?',
      'Which choice best explains the purpose of this section?',
    ],
  },
  'ELA.9.R.2.2': {
    standardCode: 'ELA.9.R.2.2',
    defaultMove: 'central idea and support',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/central idea|support|evidence|develop|proof|main idea/i],
    strandMoves: {
      'central-idea-identification': {
        moveLabel: 'central idea',
        stemFrames: [
          'Which choice best states the central idea of the passage?',
          'Which choice best separates the central idea from a single detail?',
        ],
      },
      'support-development': {
        moveLabel: 'support development',
        stemFrames: [
          'How does {quote} help develop the central idea?',
          'Which choice best explains how this evidence supports the central idea?',
        ],
      },
      'strong-vs-weak-evidence': {
        moveLabel: 'strong evidence',
        stemFrames: [
          'Which evidence best supports the central idea of the passage?',
          'Why is {quote} stronger evidence than a related detail?',
        ],
      },
    },
    defaultStemFrames: [
      'Which choice best matches the passage’s central idea to its strongest proof?',
      'How does {quote} develop the passage’s main idea?',
    ],
  },
  'ELA.9.R.2.3': {
    standardCode: 'ELA.9.R.2.3',
    defaultMove: 'appeal and purpose',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [
      /appeal|logos|ethos|pathos|purpose|audience|persuade|rhetorical|figurative/i,
    ],
    strandMoves: {
      'logos-ethos-pathos': {
        moveLabel: 'rhetorical appeal',
        stemFrames: [
          'Which appeal does the author use in {quote}, and why does it fit the purpose?',
          'How does this appeal help the author achieve a purpose?',
        ],
      },
      'figurative-language-for-purpose': {
        moveLabel: 'figurative language for purpose',
        stemFrames: [
          'How does the figurative language in {quote} help the author achieve a purpose?',
          'Which choice best explains how this image supports the author’s purpose?',
        ],
      },
      'appropriateness-of-appeal': {
        moveLabel: 'appropriate appeal',
        stemFrames: [
          'Why is this appeal appropriate for the author’s audience and purpose?',
          'Which choice best explains why this appeal is effective in context?',
        ],
      },
    },
    defaultStemFrames: [
      'How does the author use this appeal to achieve a purpose?',
      'Which choice best explains why {quote} is effective for the author’s purpose?',
    ],
  },
  'ELA.9.R.2.4': {
    standardCode: 'ELA.9.R.2.4',
    defaultMove: 'argument comparison',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/claim|argument|evidence|reasoning|valid|opposing|compare|support/i],
    strandMoves: {
      'separate-opposing-claims': {
        moveLabel: 'opposing claims',
        stemFrames: [
          'Which choice best separates the opposing claims in the texts?',
          'What is the key difference between the two claims?',
        ],
      },
      'compare-evidence-development': {
        moveLabel: 'evidence comparison',
        stemFrames: [
          'How does each author use evidence to develop the claim?',
          'Which choice best compares how the arguments are supported?',
        ],
      },
      'validity-effectiveness': {
        moveLabel: 'validity and support',
        stemFrames: [
          'Which claim is better supported, and why?',
          'Which choice best evaluates the strength of the reasoning?',
        ],
      },
    },
    defaultStemFrames: [
      'Which choice best compares how the claims are supported?',
      'How does the evidence affect the validity of the argument?',
    ],
  },
  'ELA.9.R.3.1': {
    standardCode: 'ELA.9.R.3.1',
    defaultMove: 'figurative language effect',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [
      /comparison|personification|imagery|image|symbol|sound|phrase|figurative|effect|meaning|mood|understanding|develop|reader/i,
    ],
    strandMoves: {
      'metaphor-simile': {
        moveLabel: 'comparison',
        stemFrames: [
          'How does the comparison in {quote} help develop the meaning of the passage?',
          'Which choice best explains the effect of the comparison in {quote}?',
          'How does the author use the comparison in {quote} to shape the reader’s understanding?',
        ],
      },
      personification: {
        moveLabel: 'personification',
        stemFrames: [
          'How does the personification in {quote} affect the meaning of the passage?',
          'Which choice best explains how the personification in {quote} shapes the reader’s understanding?',
          'How does describing something nonhuman in {quote} help develop the scene?',
        ],
      },
      'imagery-sensory-language': {
        moveLabel: 'imagery',
        stemFrames: [
          'How does the imagery in {quote} help establish the mood of the passage?',
          'Which choice best explains the effect of the image in {quote}?',
          'How does the sensory description in {quote} shape the reader’s understanding of the scene?',
        ],
      },
      'hyperbole-understatement': {
        moveLabel: 'exaggeration or understatement',
        stemFrames: [
          'How does the exaggeration or understatement in {quote} affect the meaning?',
          'Which choice best explains the effect of the exaggeration in {quote}?',
        ],
      },
      'sound-devices': {
        moveLabel: 'sound device',
        stemFrames: [
          'How does the sound device in {quote} affect the passage?',
          'Which choice best explains the effect of the repeated sound in {quote}?',
        ],
      },
      'allusion-idiom-symbol': {
        moveLabel: 'symbolic or figurative reference',
        stemFrames: [
          'How does the symbolic or figurative reference in {quote} develop the meaning of the passage?',
          'Which choice best explains the meaning of the figurative reference in {quote}?',
          'How does the author use {quote} to help the reader understand the passage’s larger meaning?',
        ],
      },
      'mood-effect-evidence': {
        moveLabel: 'mood evidence',
        stemFrames: [
          'Read this evidence from the passage: {quote}. How does it help create the mood?',
          'Which choice best explains how {quote} shapes the feeling of the passage?',
          'How does the language in {quote} affect the mood of the scene?',
          'Which choice best explains the effect of {quote} on the reader’s feeling?',
          'How does {quote} help the reader understand the atmosphere of the scene?',
          'Which choice best explains how {quote} contributes to the passage’s mood?',
        ],
        requiredStemPatterns: [/mood|feeling|atmosphere/i],
      },
    },
    defaultStemFrames: [
      'How does the figurative phrase {quote} affect the meaning of the passage?',
      'Which choice best explains how {quote} shapes the reader’s understanding?',
    ],
  },
  'ELA.9.R.3.3': {
    standardCode: 'ELA.9.R.3.3',
    defaultMove: 'adaptation comparison',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/adaptation|source|changed|same|keeps|meaning|effect|compare/i],
    strandMoves: {
      'source-pattern': {
        moveLabel: 'source pattern',
        stemFrames: [
          'Which source pattern is most important for understanding this adaptation?',
          'What original pattern does this passage rely on?',
        ],
      },
      'adaptation-same-and-changed': {
        moveLabel: 'same and changed',
        stemFrames: [
          'Which choice best explains what the adaptation keeps and changes?',
          'How does this version change the source pattern?',
        ],
      },
      'adaptation-effect': {
        moveLabel: 'adaptation effect',
        stemFrames: [
          'How does the adaptation change the meaning or effect of the source?',
          'Which choice best explains the effect of the change?',
        ],
      },
    },
    defaultStemFrames: [
      'Which choice best compares the source pattern and the adaptation?',
      'How does the adaptation change the meaning of the source?',
    ],
  },
  'ELA.9.R.3.4': {
    standardCode: 'ELA.9.R.3.4',
    defaultMove: 'rhetoric and reader effect',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/rhetorical|repetition|contrast|analogy|question|reader|effect|purpose|believe|feel|notice/i],
    strandMoves: {
      'rhetorical-device-effect': {
        moveLabel: 'rhetorical device',
        stemFrames: [
          'How does the rhetorical device in {quote} affect the reader?',
          'Which choice best explains the effect of this rhetorical move?',
        ],
      },
      'reader-belief-feeling-notice': {
        moveLabel: 'reader effect',
        stemFrames: [
          'What does {quote} make the reader believe, feel, or notice?',
          'Which choice best explains the reader effect created by {quote}?',
        ],
      },
      'rhetoric-to-purpose': {
        moveLabel: 'rhetoric-purpose connection',
        stemFrames: [
          'How does this rhetorical move help the author achieve a purpose?',
          'Which choice best connects {quote} to the author’s purpose?',
        ],
      },
    },
    defaultStemFrames: [
      'How does this rhetorical move affect the reader?',
      'Which choice best explains how {quote} supports the author’s purpose?',
    ],
  },
  'ELA.9.V.1.2': {
    standardCode: 'ELA.9.V.1.2',
    defaultMove: 'word parts in context',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/word|part|prefix|root|suffix|origin|meaning|context/i],
    strandMoves: {
      'prefix-root-suffix': {
        moveLabel: 'word part',
        stemFrames: [
          'Read this word from the passage: {quote}. How do its word parts help show its meaning?',
          'Which choice best uses the word parts in {quote} to determine meaning?',
        ],
      },
      'etymology-origin-clue': {
        moveLabel: 'word origin',
        stemFrames: [
          'How does the origin or related word clue help explain {quote}?',
          'Which choice best uses word origin to explain {quote}?',
        ],
      },
      'test-word-part-in-context': {
        moveLabel: 'word-part context check',
        stemFrames: [
          'Which meaning of {quote} best fits both the word parts and the context?',
          'How does the context confirm the word-part meaning of {quote}?',
        ],
      },
    },
    defaultStemFrames: [
      'Which meaning of {quote} best fits the word parts and context?',
      'How do the word parts help explain {quote} in context?',
    ],
  },
  'ELA.9.V.1.3': {
    standardCode: 'ELA.9.V.1.3',
    defaultMove: 'word meaning in context',
    bannedStemPatterns: GENERIC_BANNED_STEMS,
    requiredStemPatterns: [/word|phrase|meaning|context|clue|connotation|denotation|relationship/i],
    strandMoves: {
      'context-clues': {
        moveLabel: 'context clue',
        stemFrames: [
          'Read this wording from the passage: {quote}. Which meaning fits best in context?',
          'Which context clue best helps explain {quote}?',
        ],
      },
      'connotation-denotation': {
        moveLabel: 'connotation and denotation',
        stemFrames: [
          'Which choice best explains the connotation of {quote} in context?',
          'How does the word choice in {quote} affect the meaning of the passage?',
        ],
      },
      'word-relationships': {
        moveLabel: 'word relationship',
        stemFrames: [
          'Which relationship clue helps explain the meaning of {quote}?',
          'How do the surrounding words help explain {quote}?',
        ],
      },
      'figurative-phrase-meaning': {
        moveLabel: 'figurative phrase meaning',
        stemFrames: [
          'What does the figurative phrase {quote} mean in context?',
          'Which choice best explains the meaning of {quote} as it is used here?',
        ],
      },
    },
    defaultStemFrames: [
      'Which meaning of {quote} fits best in context?',
      'Which choice best uses context to explain {quote}?',
    ],
  },
};

function quoteEvidence(value?: string | null) {
  return value ? `“${value}”` : 'the quoted language';
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
}

export function getFastItemBlueprint(standardCode: string) {
  return FAST_ITEM_BLUEPRINTS[standardCode] ?? null;
}

export function getFastItemBlueprintCoverageSummary() {
  return Object.keys(FAST_ITEM_BLUEPRINTS).map((standardCode) => {
    const pipelineBlueprint = getGutenbergStandardBlueprint(standardCode);
    const itemBlueprint = FAST_ITEM_BLUEPRINTS[standardCode];
    return {
      standardCode,
      pipelineStrands: pipelineBlueprint?.coverageStrands?.length ?? 0,
      itemStrands: Object.keys(itemBlueprint.strandMoves).length,
      complete:
        (pipelineBlueprint?.coverageStrands ?? []).every((strand) =>
          Boolean(itemBlueprint.strandMoves[strand.id])
        ) ?? false,
    };
  });
}

export function inferFastItemMove(context: FastItemStemContext) {
  const blueprint = getFastItemBlueprint(context.standardCode);
  const byId = context.strandId ? blueprint?.strandMoves[context.strandId] : null;
  if (byId) return byId;

  const strandLabel = normalize(context.strandLabel ?? '');
  const target = normalize(context.targetSignal ?? '');
  const matched = Object.entries(blueprint?.strandMoves ?? {}).find(([id, move]) => {
    const text = normalize(`${id} ${move.moveLabel}`);
    return Boolean(
      (strandLabel && text.includes(strandLabel)) ||
        (target && text.includes(target)) ||
        (target && normalize(move.moveLabel).includes(target))
    );
  });

  return matched?.[1] ?? null;
}

export function buildFastItemStem(context: FastItemStemContext) {
  const blueprint = getFastItemBlueprint(context.standardCode);
  if (!blueprint) return 'Which answer best explains what the passage shows?';

  const move = inferFastItemMove(context);
  const frames = move?.stemFrames.length ? move.stemFrames : blueprint.defaultStemFrames;
  const frame = frames[Math.abs(context.variantIndex ?? 0) % frames.length];
  return frame.replaceAll('{quote}', quoteEvidence(context.evidenceText));
}

export function stemFitsFastItemBlueprint(context: FastItemStemContext & { stem: string }) {
  const blueprint = getFastItemBlueprint(context.standardCode);
  if (!blueprint) return true;

  const move = inferFastItemMove(context);
  const banned = [...blueprint.bannedStemPatterns, ...(move?.bannedStemPatterns ?? [])];
  if (banned.some((pattern) => pattern.test(context.stem))) return false;

  const required = move?.requiredStemPatterns?.length
    ? move.requiredStemPatterns
    : blueprint.requiredStemPatterns.length
      ? blueprint.requiredStemPatterns
      : SHARED_EFFECT_PATTERNS;

  return required.some((pattern) => pattern.test(context.stem));
}
