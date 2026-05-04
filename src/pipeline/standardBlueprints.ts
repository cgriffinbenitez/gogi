export type GutenbergPipelineClassification =
  | 'inferencing'
  | 'evidence_retrieval_failure'
  | 'tone_misreading'
  | 'mood_misreading'
  | 'figurative_language_failure'
  | 'comprehension_integration_failure'
  | 'topic_vs_theme_confusion'
  | 'structure_purpose_disconnect'
  | 'vocabulary_gap'
  | 'morphology_gap'
  | 'syntax_barrier'
  | 'schema_strategy_missing'
  | 'no_metacognitive_strategy';

export type GutenbergStandardPipelineBlueprint = {
  standardCode: string;
  teacherLabel: string;
  studentMove: string;
  harvestGoal: string;
  classifications: GutenbergPipelineClassification[];
  coverageStrands?: Array<{
    id: string;
    label: string;
    studentCanDo: string;
    harvestSignals: string[];
    classifications?: GutenbergPipelineClassification[];
  }>;
  passageRequirements: string[];
  rejectIf: string[];
  recommendedCommand: string;
};

export const GUTENBERG_STANDARD_BLUEPRINTS: GutenbergStandardPipelineBlueprint[] = [
  {
    standardCode: 'ELA.9.R.1.1',
    teacherLabel: 'Key literary elements add layers of meaning',
    studentMove:
      'Spot one meaningful detail, explain what it suggests, then explain why it matters.',
    harvestGoal:
      'Find literary excerpts where a setting detail, object, description, or action clearly adds meaning beyond the literal event.',
    classifications: ['inferencing', 'schema_strategy_missing', 'no_metacognitive_strategy'],
    coverageStrands: [
      {
        id: 'literal-detail-to-layer',
        label: 'Literal detail to deeper layer',
        studentCanDo:
          'Explain how one object, setting detail, description, or event adds meaning beyond what literally happens.',
        harvestSignals: ['symbolic object', 'revealing setting detail', 'plot detail with effect'],
      },
      {
        id: 'style-or-meaning-effect',
        label: 'Meaning or style effect',
        studentCanDo:
          'Connect the key element to an author effect such as mood, characterization, theme, tension, or style.',
        harvestSignals: ['style shift', 'mood-bearing detail', 'character-revealing action'],
      },
    ],
    passageRequirements: [
      'Literary prose with one pointable detail that carries deeper meaning or style.',
      'The deeper meaning must be recoverable from the excerpt alone.',
      'At least two supporting clues and two tempting non-supporting details.',
      'The passage should support a short Reading Win loop without whole-book context.',
    ],
    rejectIf: [
      'The “deeper meaning” depends on knowing the whole novel.',
      'The passage only asks students to summarize plot.',
      'The key detail is symbolic only through external historical, biblical, or classical schema.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.1.1 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.1.2',
    teacherLabel: 'Theme development across a literary text',
    studentMove: 'Turn the topic into a life lesson, then prove it with multiple moments.',
    harvestGoal:
      'Find excerpts where a universal theme is visible through character choice, conflict, contrast, or consequence.',
    classifications: ['topic_vs_theme_confusion', 'inferencing'],
    coverageStrands: [
      {
        id: 'topic-vs-theme',
        label: 'Topic vs. theme statement',
        studentCanDo:
          'Distinguish a subject like courage or loyalty from a universal statement about people, choices, or life.',
        harvestSignals: ['clear topic', 'universal theme possibility', 'topic-only distractor'],
      },
      {
        id: 'theme-development-moments',
        label: 'Theme developed through moments',
        studentCanDo:
          'Track how two or more story moments develop the same theme instead of treating one detail as the whole message.',
        harvestSignals: ['repeated idea', 'character choice', 'consequence or realization'],
      },
      {
        id: 'theme-evidence-fit',
        label: 'Evidence that proves theme',
        studentCanDo:
          'Choose details that actually develop the theme and reject true details that only match the topic.',
        harvestSignals: ['strong theme evidence', 'near-topic distractor', 'weak evidence'],
      },
    ],
    passageRequirements: [
      'Literary prose with a stable topic and a defensible universal theme.',
      'Multiple details must develop the same idea.',
      'Distractors should include topic-only and moral-sounding but unsupported options.',
    ],
    rejectIf: [
      'The passage only names a topic without developing a message.',
      'Multiple themes are equally plausible with no textual way to distinguish them.',
      'The theme requires whole-book context.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.1.2 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.1.3',
    teacherLabel: 'Narrator perspective, irony, and satire',
    studentMove: 'Compare what is said with what the reader understands.',
    harvestGoal:
      'Find excerpts where wording, narrator distance, exaggeration, reversal, or contrast creates irony, satire, or perspective-based meaning.',
    classifications: ['tone_misreading', 'inferencing'],
    coverageStrands: [
      {
        id: 'speaker-reader-gap',
        label: 'Speaker view vs. reader understanding',
        studentCanDo:
          'Explain the gap between what a narrator or speaker seems to say and what the reader understands.',
        harvestSignals: [
          'limited narrator',
          'reader knows more',
          'surface meaning vs intended meaning',
        ],
      },
      {
        id: 'irony-reversal-contrast',
        label: 'Irony through reversal or contrast',
        studentCanDo: 'Identify the contrast, reversal, or contradiction that creates irony.',
        harvestSignals: ['reversal', 'contradiction', 'unexpected contrast'],
      },
      {
        id: 'satire-exaggeration-ridicule',
        label: 'Satire and exaggeration',
        studentCanDo:
          'Explain how exaggeration, ridicule, or absurd contrast criticizes an idea or behavior.',
        harvestSignals: ['mocking language', 'absurd exaggeration', 'social criticism'],
      },
      {
        id: 'perspective-effect-evidence',
        label: 'Perspective effect with evidence',
        studentCanDo:
          'Select the wording that best proves the narrator’s attitude or perspective-based effect.',
        harvestSignals: ['attitude evidence', 'tone evidence', 'tempting literal detail'],
      },
    ],
    passageRequirements: [
      'A clear gap between surface meaning and intended meaning.',
      'Reader does not need outside context to notice the contrast.',
      'Enough evidence to compare speaker/narrator view with reader understanding.',
    ],
    rejectIf: [
      'Irony depends on knowing a historical institution or whole-book situation.',
      'The passage merely has a strong emotion but no perspective gap.',
      'The attitude is ambiguous between several readings.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.1.3 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.2.1',
    teacherLabel: 'Text structure and feature purpose',
    studentMove: 'Ask what job this part does in the whole text.',
    harvestGoal:
      'Find excerpts where a paragraph, contrast, sequence, example, or shift clearly helps build meaning or purpose.',
    classifications: ['structure_purpose_disconnect', 'syntax_barrier'],
    coverageStrands: [
      {
        id: 'structure-types',
        label: 'Recognize structure types',
        studentCanDo:
          'Identify description, problem/solution, chronological, compare/contrast, cause/effect, or sequence when it is doing real work.',
        harvestSignals: [
          'description',
          'problem solution',
          'chronological',
          'compare contrast',
          'cause effect',
        ],
      },
      {
        id: 'paragraph-job',
        label: 'Paragraph or section job',
        studentCanDo:
          'Explain whether a paragraph introduces, contrasts, extends, proves, shifts, or concludes an idea.',
        harvestSignals: ['paragraph shift', 'example paragraph', 'contrast paragraph', 'extension'],
      },
      {
        id: 'feature-purpose',
        label: 'Text feature purpose',
        studentCanDo:
          'Explain how headings, captions, charts, illustrations, annotations, or other features help convey meaning.',
        harvestSignals: ['heading', 'caption', 'chart or graph', 'annotation', 'footnote'],
      },
      {
        id: 'structure-to-author-purpose',
        label: 'Structure connected to purpose',
        studentCanDo:
          'Connect the structure or feature to what the author wants the reader to understand or notice.',
        harvestSignals: ['author purpose', 'meaning built by structure', 'reader effect'],
      },
    ],
    passageRequirements: [
      'Two or more connected paragraphs with a visible structural relationship.',
      'The structure must help the author build meaning or purpose.',
      'Students should be able to name the job of a part: contrast, example, shift, extension, cause, result.',
    ],
    rejectIf: [
      'The passage can only be summarized, not structurally analyzed.',
      'The structure is invisible without the surrounding chapter.',
      'Syntax difficulty blocks the structural target.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.2.1 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.2.2',
    teacherLabel: 'Central idea and supporting evidence',
    studentMove: 'Name the big idea, then choose the strongest proof.',
    harvestGoal:
      'Find excerpts where a central idea is developed through multiple details so students can distinguish strong evidence from true-but-weak details.',
    classifications: ['evidence_retrieval_failure', 'comprehension_integration_failure'],
    coverageStrands: [
      {
        id: 'central-idea-identification',
        label: 'Central idea identification',
        studentCanDo:
          'State the central idea in plain language instead of choosing a topic or isolated detail.',
        harvestSignals: ['clear central idea', 'topic distractor', 'detail-only distractor'],
      },
      {
        id: 'support-development',
        label: 'How support develops the idea',
        studentCanDo:
          'Explain how examples, facts, descriptions, or reasons develop the central idea across the passage.',
        harvestSignals: [
          'example support',
          'reason support',
          'description support',
          'development across paragraphs',
        ],
      },
      {
        id: 'strong-vs-weak-evidence',
        label: 'Strong vs. weak evidence',
        studentCanDo:
          'Choose the evidence that best supports the central idea and reject true but weaker details.',
        harvestSignals: ['strong evidence', 'weak related detail', 'irrelevant true detail'],
      },
    ],
    passageRequirements: [
      'At least two paragraphs with a clear central idea.',
      'One or more strong evidence details plus plausible weaker details.',
      'Evidence should be pointable and quoteable.',
    ],
    rejectIf: [
      'Only one sentence could reasonably be cited.',
      'Every detail supports the idea equally.',
      'The central idea is too broad or not developed inside the excerpt.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.2.2 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.2.3',
    teacherLabel: 'Rhetorical appeals and author purpose',
    studentMove: 'Name the persuasive move and explain why it helps the author.',
    harvestGoal:
      'Find public-domain speeches, essays, or arguments where facts, credibility, emotion, analogy, or figurative language clearly supports purpose.',
    classifications: ['structure_purpose_disconnect', 'figurative_language_failure'],
    coverageStrands: [
      {
        id: 'logos-ethos-pathos',
        label: 'Logos, ethos, and pathos',
        studentCanDo:
          'Identify whether the author is using logic, credibility, or emotion and explain why that appeal fits the purpose.',
        harvestSignals: ['logos', 'ethos', 'pathos', 'appeal tied to purpose'],
      },
      {
        id: 'figurative-language-for-purpose',
        label: 'Figurative language for purpose',
        studentCanDo:
          'Explain how figurative language helps the author achieve a persuasive or explanatory purpose.',
        harvestSignals: ['metaphor for persuasion', 'imagery for purpose', 'analogy'],
      },
      {
        id: 'appropriateness-of-appeal',
        label: 'Appropriateness of appeal',
        studentCanDo:
          'Judge why an appeal is appropriate or effective for the intended audience and purpose.',
        harvestSignals: ['audience fit', 'purpose fit', 'appeal effectiveness'],
      },
    ],
    passageRequirements: [
      'Argumentative or persuasive prose with an identifiable appeal or rhetorical move.',
      'The author purpose must be clear inside the excerpt.',
      'The passage should support effect questions, not just device labels.',
    ],
    rejectIf: [
      'The rhetoric requires historical background not supplied in the excerpt.',
      'The passage contains harmful historical language unsuitable for pilot students.',
      'The author purpose is not inferable from the selected excerpt.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.2.3 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.2.4',
    teacherLabel: 'Opposing arguments, claims, evidence, and validity',
    studentMove: 'Keep each side separate, then compare the strength of the proof.',
    harvestGoal:
      'Find paired or pairable argumentative excerpts where opposing claims can be compared without mixing them together.',
    classifications: ['comprehension_integration_failure', 'evidence_retrieval_failure'],
    coverageStrands: [
      {
        id: 'separate-opposing-claims',
        label: 'Separate opposing claims',
        studentCanDo: 'Keep each author’s claim separate when two texts address the same topic.',
        harvestSignals: ['opposing claim', 'same topic', 'claim sorting'],
      },
      {
        id: 'compare-evidence-development',
        label: 'Compare evidence development',
        studentCanDo:
          'Compare how each author develops the claim through evidence, reasoning, examples, or limitations.',
        harvestSignals: [
          'evidence comparison',
          'reasoning comparison',
          'same information different use',
        ],
      },
      {
        id: 'validity-effectiveness',
        label: 'Validity and effectiveness',
        studentCanDo:
          'Evaluate which claim is better supported and why the reasoning is or is not sound.',
        harvestSignals: ['sound reasoning', 'unsupported claim', 'weak evidence', 'validity'],
      },
    ],
    passageRequirements: [
      'Argumentative content with clear claim/evidence relationships.',
      'A passage or pair candidate that can support two-column comparison.',
      'Evidence quality should be distinguishable.',
    ],
    rejectIf: [
      'Only one argument is visible.',
      'The claim depends on missing historical context.',
      'The excerpt is too dense for a 25-30 minute Reading Win loop.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.2.4 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.3.1',
    teacherLabel: 'Figurative language effect',
    studentMove: 'Spot the nonliteral move, explain its meaning, then explain the effect.',
    harvestGoal:
      'Find literary excerpts where metaphor, simile, personification, imagery, or symbolism creates mood, meaning, or reader effect.',
    classifications: ['figurative_language_failure', 'mood_misreading'],
    coverageStrands: [
      {
        id: 'metaphor-simile',
        label: 'Metaphor and simile',
        studentCanDo:
          'Identify the comparison, explain the literal meaning, and connect it to the mood created in the passage.',
        harvestSignals: ['metaphor', 'simile', 'comparison without literal intent'],
        classifications: ['figurative_language_failure', 'mood_misreading'],
      },
      {
        id: 'personification',
        label: 'Personification',
        studentCanDo:
          'Explain how giving human action or feeling to a nonhuman thing shapes the scene’s mood.',
        harvestSignals: [
          'nonhuman subject with human verb',
          'human feeling applied to setting or object',
        ],
        classifications: ['figurative_language_failure', 'mood_misreading'],
      },
      {
        id: 'imagery-sensory-language',
        label: 'Imagery and sensory language',
        studentCanDo:
          'Use visual, auditory, tactile, or other sensory details to explain the atmosphere or emotional effect.',
        harvestSignals: [
          'visual imagery',
          'sound imagery',
          'tactile imagery',
          'sensory detail cluster',
        ],
        classifications: ['figurative_language_failure', 'mood_misreading'],
      },
      {
        id: 'hyperbole-understatement',
        label: 'Hyperbole and understatement',
        studentCanDo:
          'Recognize exaggeration or understatement and explain how it changes the reader’s feeling or interpretation.',
        harvestSignals: ['hyperbole', 'meiosis', 'understatement', 'exaggerated scale'],
        classifications: ['figurative_language_failure', 'mood_misreading'],
      },
      {
        id: 'sound-devices',
        label: 'Alliteration and onomatopoeia',
        studentCanDo:
          'Explain how repeated sounds or sound words contribute to mood rather than only naming the device.',
        harvestSignals: ['alliteration', 'onomatopoeia', 'repeated sound pattern'],
        classifications: ['figurative_language_failure', 'mood_misreading'],
      },
      {
        id: 'allusion-idiom-symbol',
        label: 'Allusion, idiom, and symbol',
        studentCanDo:
          'Explain figurative meaning when the passage gives enough context to unlock it without outside dependency.',
        harvestSignals: [
          'context-supported allusion',
          'idiom with surrounding clues',
          'symbolic detail',
        ],
        classifications: ['figurative_language_failure', 'schema_strategy_missing'],
      },
      {
        id: 'mood-effect-evidence',
        label: 'Mood effect with evidence',
        studentCanDo:
          'Select the best evidence and explain how the figurative language creates a specific mood.',
        harvestSignals: ['pointable mood evidence', 'literal distractors', 'effect language'],
        classifications: ['mood_misreading', 'evidence_retrieval_failure'],
      },
    ],
    passageRequirements: [
      'Figurative language must do real meaning-work.',
      'Meaning must be recoverable from the passage.',
      'There must be enough literal and figurative details to create useful distractors.',
    ],
    rejectIf: [
      'The figurative language is decorative only.',
      'The symbol only works if the student knows the whole book.',
      'The passage is so poetic or archaic that decoding blocks the target skill.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.3.1 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.3.3',
    teacherLabel: 'Adaptation across texts',
    studentMove: 'Notice what stayed the same, what changed, and how the meaning changed.',
    harvestGoal:
      'Find public-domain source/adaptation candidates where a mythic, classical, religious, or traditional pattern is reused or changed.',
    classifications: ['schema_strategy_missing', 'comprehension_integration_failure'],
    coverageStrands: [
      {
        id: 'source-pattern',
        label: 'Original source pattern',
        studentCanDo:
          'Recognize the source pattern, figure, conflict, or lesson before comparing adaptations.',
        harvestSignals: [
          'mythic pattern',
          'classical source',
          'religious source',
          'source summary',
        ],
      },
      {
        id: 'adaptation-same-and-changed',
        label: 'What stayed and what changed',
        studentCanDo: 'Compare what an adaptation keeps, changes, removes, or emphasizes.',
        harvestSignals: ['shared element', 'changed emphasis', 'shifted character or conflict'],
      },
      {
        id: 'adaptation-effect',
        label: 'Changed meaning or effect',
        studentCanDo:
          'Explain how the adaptation changes meaning, attitude, theme, or reader effect.',
        harvestSignals: ['changed theme', 'changed tone', 'new purpose', 'reader effect'],
      },
    ],
    passageRequirements: [
      'The source pattern must be explainable inside GOGI before the student compares.',
      'The adapted text must show a clear change in meaning, attitude, or emphasis.',
      'The comparison should be teachable without assuming specialist background knowledge.',
    ],
    rejectIf: [
      'The allusion is unexplained and schema-gated.',
      'The adaptation relationship is too subtle for a short remediation loop.',
      'The passage requires long source summaries to make sense.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.3.3 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.R.3.4',
    teacherLabel: 'Rhetoric and reader effect',
    studentMove: 'Explain what the wording makes the reader believe, feel, or notice.',
    harvestGoal:
      'Find essays, speeches, or literary nonfiction where rhetorical wording clearly shapes reader effect or author purpose.',
    classifications: [
      'tone_misreading',
      'structure_purpose_disconnect',
      'figurative_language_failure',
    ],
    coverageStrands: [
      {
        id: 'rhetorical-device-effect',
        label: 'Rhetorical device effect',
        studentCanDo:
          'Explain how repetition, analogy, contrast, rhetorical question, or figurative language affects the reader.',
        harvestSignals: [
          'repetition',
          'contrast',
          'analogy',
          'rhetorical question',
          'figurative wording',
        ],
      },
      {
        id: 'reader-belief-feeling-notice',
        label: 'Reader belief, feeling, or focus',
        studentCanDo: 'Name what the rhetoric makes the reader believe, feel, or notice.',
        harvestSignals: ['reader belief', 'emotional effect', 'attention focus'],
      },
      {
        id: 'rhetoric-to-purpose',
        label: 'Rhetoric connected to purpose',
        studentCanDo:
          'Connect the rhetorical move to the author’s purpose rather than only labeling the device.',
        harvestSignals: ['author purpose', 'effect on audience', 'purposeful wording'],
      },
    ],
    passageRequirements: [
      'A pointable rhetorical move with a clear reader effect.',
      'The effect should be explainable in plain language.',
      'The passage should support effect-based answer choices.',
    ],
    rejectIf: [
      'The question would only ask students to label a device.',
      'The effect depends on missing historical context.',
      'The passage uses harmful historical language unsuitable for the pilot.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.R.3.4 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.V.1.2',
    teacherLabel: 'Morphology and etymology in context',
    studentMove: 'Break the word into parts, define the parts, then test the meaning in context.',
    harvestGoal:
      'Find excerpts where roots, prefixes, suffixes, or derivations genuinely help unlock word meaning.',
    classifications: ['morphology_gap', 'vocabulary_gap'],
    coverageStrands: [
      {
        id: 'prefix-root-suffix',
        label: 'Prefix, root, and suffix meaning',
        studentCanDo: 'Break a word into meaningful parts and use those parts to predict meaning.',
        harvestSignals: ['prefix', 'root', 'suffix', 'derivation'],
      },
      {
        id: 'etymology-origin-clue',
        label: 'Etymology or origin clue',
        studentCanDo:
          'Use word origin or related-word knowledge when it helps determine meaning in context.',
        harvestSignals: ['etymology', 'origin clue', 'related word'],
      },
      {
        id: 'test-word-part-in-context',
        label: 'Test word parts in context',
        studentCanDo: 'Check whether the word-part meaning actually fits the sentence and passage.',
        harvestSignals: ['context test', 'meaning fit', 'nearby clue'],
      },
    ],
    passageRequirements: [
      'The target word should contain a useful word part.',
      'The surrounding sentence must let students test the word-part meaning.',
      'Distractors should include familiar-looking but wrong meanings.',
    ],
    rejectIf: [
      'The word part does not actually help.',
      'The word is too archaic or rare to transfer.',
      'The sentence gives no context for checking the meaning.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.V.1.2 --max-books 5 --max 12',
  },
  {
    standardCode: 'ELA.9.V.1.3',
    teacherLabel: 'Vocabulary in context and connotation',
    studentMove: 'Read around the word, replace it with a guess, then check tone and fit.',
    harvestGoal:
      'Find excerpts where Tier 2 vocabulary or connotative wording can be solved from context clues.',
    classifications: ['vocabulary_gap', 'figurative_language_failure'],
    coverageStrands: [
      {
        id: 'context-clues',
        label: 'Context clues',
        studentCanDo:
          'Use nearby definition, restatement, example, contrast, or surrounding detail to infer meaning.',
        harvestSignals: ['definition clue', 'restatement', 'example clue', 'contrast clue'],
      },
      {
        id: 'connotation-denotation',
        label: 'Connotation and denotation',
        studentCanDo:
          'Distinguish dictionary meaning from emotional or implied meaning in the passage.',
        harvestSignals: [
          'positive connotation',
          'negative connotation',
          'literal meaning',
          'emotional charge',
        ],
      },
      {
        id: 'word-relationships',
        label: 'Word relationships',
        studentCanDo:
          'Use synonym, antonym, contrast, category, or relationship clues to determine meaning.',
        harvestSignals: ['synonym', 'antonym', 'contrast relationship', 'category clue'],
      },
      {
        id: 'figurative-phrase-meaning',
        label: 'Figurative phrase meaning',
        studentCanDo:
          'Use context to determine the meaning of a figurative phrase, not just a single word.',
        harvestSignals: ['figurative phrase', 'idiomatic meaning', 'phrase in context'],
      },
    ],
    passageRequirements: [
      'Unfamiliar or charged wording must carry real meaning.',
      'Nearby context clues must support meaning recovery.',
      'The passage should support both meaning and evidence questions.',
    ],
    rejectIf: [
      'The word requires a dictionary because context gives no help.',
      'The vocabulary is domain-specific jargon.',
      'The word is archaic without transfer value for modern readers.',
    ],
    recommendedCommand:
      'npm run pipeline:standard -- --standard ELA.9.V.1.3 --max-books 5 --max 12',
  },
];

export const GUTENBERG_STANDARD_BLUEPRINT_BY_CODE = Object.fromEntries(
  GUTENBERG_STANDARD_BLUEPRINTS.map((blueprint) => [blueprint.standardCode, blueprint])
) as Record<string, GutenbergStandardPipelineBlueprint>;

export function getGutenbergStandardBlueprint(standardCode: string) {
  return GUTENBERG_STANDARD_BLUEPRINT_BY_CODE[standardCode] ?? null;
}

export function getClassificationsForStandard(standardCode: string) {
  return getGutenbergStandardBlueprint(standardCode)?.classifications ?? [];
}

export function getCoverageStrandsForStandard(standardCode: string) {
  return getGutenbergStandardBlueprint(standardCode)?.coverageStrands ?? [];
}

export function getClassificationsForCoverageStrand(standardCode: string, strandId: string) {
  const blueprint = getGutenbergStandardBlueprint(standardCode);
  const strand = blueprint?.coverageStrands?.find((item) => item.id === strandId);
  return strand?.classifications?.length
    ? strand.classifications
    : (blueprint?.classifications ?? []);
}
