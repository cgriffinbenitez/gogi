import type { EvidenceWord, MoodGridExperienceProps } from './MoodGridExperience';

const passage = [
  'The hallway had gone quiet by the time Marisol reached the last classroom. A cold line of light showed under the door, thin as a blade.',
  'Inside, the desks sat in perfect rows. On the board, someone had written her name, then erased it badly enough that the letters still hovered there.',
  'She held her breath. Somewhere above the ceiling tiles, something clicked once, then stopped.',
];

const evidenceWords: EvidenceWord[] = [
  {
    word: 'quiet',
    sentence: 'The hallway had gone quiet by the time Marisol reached the last classroom.',
    signal: 'omission',
  },
  {
    word: 'cold',
    sentence: 'A cold line of light showed under the door, thin as a blade.',
    signal: 'diction',
  },
  {
    word: 'blade',
    sentence: 'A cold line of light showed under the door, thin as a blade.',
    signal: 'imagery',
  },
  {
    word: 'erased',
    sentence: 'On the board, someone had written her name, then erased it badly enough that the letters still hovered there.',
    signal: 'imagery',
  },
  {
    word: 'clicked',
    sentence: 'Somewhere above the ceiling tiles, something clicked once, then stopped.',
    signal: 'rhythm',
  },
];

export const moodRunScreens: MoodGridExperienceProps[] = [
  {
    mode: 'teach',
    title: 'Part One: Plot the feeling, not the event',
    passageTitle: 'Diagnostic Passage: The Last Classroom',
    passage,
    evidenceWords,
    prompt: 'Drag the marker where the words make the passage feel. Use an evidence chip before you trust the placement.',
    gogiCopy: 'You were reading what happened. That is normal. Mood Read asks a different question: what feeling are the words building in you?',
  },
  {
    mode: 'full',
    title: 'Practice 1: Full scaffold',
    passageTitle: 'Practice Passage A',
    passage,
    evidenceWords,
    prompt: 'The quadrant names are visible. Attach one word, then place the marker where that word pushes the mood.',
    gogiCopy: 'Use the labels while they are here. Your job is to connect a word to a direction on the grid, not to guess a mood name.',
  },
  {
    mode: 'partial',
    title: 'Practice 2: Partial scaffold',
    passageTitle: 'Practice Passage B',
    passage,
    evidenceWords,
    prompt: 'The labels only appear when you hover the grid. Try to orient from the axes first.',
    gogiCopy: 'This is the same move with less help. Start with dark or bright, then tense or calm. One axis at a time.',
  },
  {
    mode: 'none',
    title: 'Practice 3: No labels',
    passageTitle: 'Practice Passage C',
    passage,
    evidenceWords,
    prompt: 'No quadrant names now. Attach evidence and make a precise 3 x 3 placement.',
    gogiCopy: 'Bring a word with you. If you place the event instead of the feeling, the evidence will pull you back.',
  },
  {
    mode: 'reassess',
    title: 'Reassess: Fresh transfer',
    passageTitle: 'Fresh Passage: After the Bell',
    passage,
    evidenceWords,
    prompt: 'Choose two words from the passage, then place the feeling without scaffold labels.',
    gogiCopy: 'Fresh passage. Same move. Show that you can separate what happens from how the writing makes it feel.',
  },
];
