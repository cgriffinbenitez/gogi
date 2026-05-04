export type ReadingWinLoopItem = {
  id: string;
  benchmarkCode: string;
  cognitiveMoveId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sourcePattern: string;
  context: string;
  anchor: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  scaffold: string;
  successCold: string;
  successScaffold: string;
  workedExample: string;
  transfer?: boolean;
};

export type ReadingWinSession = {
  benchmarkCode: string;
  studentTitle: string;
  teacherTitle: string;
  sourcePattern: string;
  passageTitle: string;
  passage: string;
  items: ReadingWinLoopItem[];
  transferPassageTitle: string;
  transferPassage: string;
  transferItem: ReadingWinLoopItem;
};

const SOURCE_PATTERN =
  '2025 Grade 9 FAST ELA released-bank pattern: short literary passage, selected figurative phrase, answer choices explain effect in context rather than naming a device.';

const PASSAGE = `Mara waited at the edge of the old ferry dock while the last blue line of daylight slipped behind the marsh grass. The dock had been closed for years, but everyone in town still used it as a shortcut to the beach. In summer, children ran across its boards without looking down. Tonight, with the tide crawling underneath, every board seemed to answer her steps.

Across the channel, the lighthouse blinked once and then disappeared behind a sheet of fog. Mara had promised her brother she would bring back the notebook he had left in the bait house, but the small building looked farther away than it had in daylight. The wind moved through the reeds and dragged its fingers along the dock rail.

She stopped. The sound was not loud, but it made the whole place feel awake, as if the marsh had been waiting for someone to arrive. A gull called once from somewhere she could not see. Mara told herself it was only a bird, only wind, only water rubbing against wood.

Then the fog thinned just enough for her to see the bait house door standing open.`;

const TRANSFER_PASSAGE =
  'The practice field was empty after the storm. Water shivered in the low places, and the goalposts stood at the far end like two pale bones against the sky. When Noah stepped onto the grass, his shoes sank slightly, and the scoreboard gave one weak flicker before going dark again.';

const baseItem = {
  benchmarkCode: 'ELA.9.R.3.1',
  sourcePattern: SOURCE_PATTERN,
} as const;

export const R31_FIGURATIVE_LANGUAGE_SESSION: ReadingWinSession = {
  benchmarkCode: 'ELA.9.R.3.1',
  studentTitle: 'Break down figurative language',
  teacherTitle: 'Figurative language effect',
  sourcePattern: SOURCE_PATTERN,
  passageTitle: 'The Ferry Dock',
  passage: PASSAGE,
  items: [
    {
      ...baseItem,
      id: 'r31-effect-drill-1',
      cognitiveMoveId: 'spot-figurative',
      difficulty: 1,
      context: 'The wind moved through the reeds and dragged its fingers along the dock rail.',
      anchor: 'dragged its fingers',
      prompt: 'How does the personification in this sentence affect the passage?',
      options: [
        'It makes the setting feel unsettling because the wind seems alive and aware of Mara.',
        'It shows that Mara is moving quickly because the wind is pushing her toward the bait house.',
        'It explains why the dock is dangerous because the rail is broken and difficult to hold.',
        'It suggests that the weather is peaceful because the wind is moving gently through the reeds.',
      ],
      correctAnswer:
        'It makes the setting feel unsettling because the wind seems alive and aware of Mara.',
      scaffold:
        'First spot the move: wind cannot literally drag fingers. Then ask what that human action makes the setting feel like.',
      successCold: 'Yes. You named what the figurative words do to the setting.',
      successScaffold: 'That is the move: phrase, image, effect.',
      workedExample:
        'Example: if fog “swallows” a road, the fog feels threatening because it is doing an action a living thing might do.',
    },
    {
      ...baseItem,
      id: 'r31-effect-drill-2',
      cognitiveMoveId: 'interpret-image',
      difficulty: 2,
      context:
        'Across the channel, the lighthouse blinked once and then disappeared behind a sheet of fog.',
      anchor: 'blinked once and then disappeared',
      prompt: 'Which answer best explains the effect of this image?',
      options: [
        'It builds uncertainty because the only visible guide appears briefly and then is hidden.',
        'It creates relief because the lighthouse proves Mara is close to the beach.',
        'It adds humor because the lighthouse seems to be playing a trick on Mara.',
        'It shows confidence because Mara knows exactly where she is going.',
      ],
      correctAnswer:
        'It builds uncertainty because the only visible guide appears briefly and then is hidden.',
      scaffold:
        'Ask what changes when the light disappears. The best answer explains the effect of that change, not just the object being described.',
      successCold: 'Clean. You explained how the image changes what the reader feels.',
      successScaffold: 'Right. You used the image to explain the effect.',
      workedExample:
        'Example: if a candle goes out in a hallway, the detail can create uncertainty because the character loses a guide.',
    },
    {
      ...baseItem,
      id: 'r31-effect-drill-3',
      cognitiveMoveId: 'connect-effect',
      difficulty: 3,
      context:
        'The sound was not loud, but it made the whole place feel awake, as if the marsh had been waiting for someone to arrive.',
      anchor: 'the whole place feel awake',
      prompt: 'How does the figurative language affect the reader’s understanding of the setting?',
      options: [
        'It suggests the setting feels watchful, as though Mara has entered a place that notices her.',
        'It suggests the setting is crowded, as though many people are hiding near the dock.',
        'It suggests the setting is cheerful, as though the marsh is welcoming Mara home.',
        'It suggests the setting is ordinary, as though Mara has no reason to be careful.',
      ],
      correctAnswer:
        'It suggests the setting feels watchful, as though Mara has entered a place that notices her.',
      scaffold:
        'Do not stop at “awake.” Ask what an awake place would seem able to do. Then connect that idea to Mara’s situation.',
      successCold: 'Yes. You connected the figurative idea to reader understanding.',
      successScaffold: 'Exactly. The answer explains what the phrase makes the reader understand.',
      workedExample:
        'Example: if a house seems to “listen,” the reader may understand the place as tense or watchful.',
    },
    {
      ...baseItem,
      id: 'r31-effect-drill-4',
      cognitiveMoveId: 'context-discriminate',
      difficulty: 4,
      context: 'Mara told herself it was only a bird, only wind, only water rubbing against wood.',
      anchor: 'only a bird, only wind, only water',
      prompt: 'How does the repeated phrase “only” affect the meaning of the paragraph?',
      options: [
        'It shows Mara trying to make ordinary explanations feel convincing even though she is uneasy.',
        'It shows Mara remembering facts about the marsh that make her feel fully prepared.',
        'It shows Mara becoming annoyed because natural sounds are interrupting her search.',
        'It shows Mara deciding that the dock is safe because every sound has a simple cause.',
      ],
      correctAnswer:
        'It shows Mara trying to make ordinary explanations feel convincing even though she is uneasy.',
      scaffold:
        'This one is harder. The words sound reassuring, but the context is tense. Pick the answer that holds both ideas.',
      successCold: 'Strong. You used context to avoid the too-literal answer.',
      successScaffold:
        'Right. FAST often rewards the answer that explains the function in context.',
      workedExample:
        'Example: a character repeating “nothing is wrong” may actually reveal that something feels wrong.',
    },
    {
      ...baseItem,
      id: 'r31-effect-drill-5',
      cognitiveMoveId: 'connect-effect',
      difficulty: 5,
      context: 'Then the fog thinned just enough for her to see the bait house door standing open.',
      anchor: 'the fog thinned just enough',
      prompt:
        'Which choice best explains how this description contributes to the ending of the passage?',
      options: [
        'It increases suspense because Mara can finally see the destination, but the open door raises a new concern.',
        'It resolves the conflict because Mara immediately learns that the notebook is inside the bait house.',
        'It shifts the tone to playful because the fog reveals that Mara’s fear was unnecessary.',
        'It emphasizes the setting’s beauty because the fog clears and the marsh becomes easy to see.',
      ],
      correctAnswer:
        'It increases suspense because Mara can finally see the destination, but the open door raises a new concern.',
      scaffold:
        'Track the effect at the end: what does the description reveal, and what new question does it create?',
      successCold: 'Excellent. You explained how the description changes the ending.',
      successScaffold: 'Yes. You connected the image to its job in the passage.',
      workedExample:
        'Example: if a door slowly opens at the end of a scene, the detail can create suspense by revealing a new problem.',
    },
  ],
  transferPassageTitle: 'After the Storm',
  transferPassage: TRANSFER_PASSAGE,
  transferItem: {
    ...baseItem,
    id: 'r31-transfer-1',
    cognitiveMoveId: 'connect-effect',
    difficulty: 4,
    context: TRANSFER_PASSAGE,
    anchor: 'like two pale bones',
    prompt: 'New passage. How does the simile affect the reader’s understanding of the setting?',
    options: [
      'It makes the field seem bleak and lifeless after the storm.',
      'It makes the field seem exciting because a game is about to begin.',
      'It makes the field seem safe because the storm has already passed.',
      'It makes the field seem crowded because many players have just left.',
    ],
    correctAnswer: 'It makes the field seem bleak and lifeless after the storm.',
    scaffold: '',
    successCold:
      'You explained figurative language on a passage you had never seen. That is transfer.',
    successScaffold: '',
    workedExample: '',
    transfer: true,
  },
};
