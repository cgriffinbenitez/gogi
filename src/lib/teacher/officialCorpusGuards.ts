export function standardShortCode(standardCode: string) {
  return standardCode.replace(/^ELA\.9\./, '');
}

export function normalizedStandardCode(standardCode: string) {
  return standardShortCode(standardCode).trim();
}

export function normalizedTextTitle(selectionOrTitle: string) {
  return selectionOrTitle
    .split(' — ')[0]
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const INFORMATIONAL_TEXT_TITLES = new Set([
  'a modest proposal',
  'choice: a tribute to dr. martin luther king, jr.',
  'democracy in america',
  'do people need small talk to be happy?',
  'finding mañana: a memoir of a cuban exodus',
  'i have a dream',
  'industrial education for the negro',
  'letter from birmingham jail',
  'letter to the grand duchess christina of tuscany',
  'nobel prize acceptance speech',
  'small talk is overrated',
  'speech to the troops at tilbury',
  'the danger of a single story',
  'the face of science',
  'the hero with a thousand faces',
  'the lincoln-douglas debates',
  'the prince',
  'the talented tenth',
  'unbroken: an olympian’s journey from airman to castaway to captive (adapted for young adults)',
  "unbroken: an olympian's journey from airman to castaway to captive (adapted for young adults)",
]);

const LITERARY_TEXT_TITLES = new Set([
  '1984',
  'a very old man with enormous wings',
  'a white heron',
  'animal farm',
  'antigone',
  'beowulf',
  'bringing my son to the police station to be fingerprinted',
  'electra',
  'icarus after the fall',
  'icarus and daedalus',
  'medea',
  'old greek stories',
  'romeo and juliet',
  'st. crispin’s day speech',
  "st. crispin's day speech",
  'the aeneid',
  'the death of ivan ilyich',
  'the epic of gilgamesh',
  'the iliad',
  'the love song of j. alfred prufrock',
  'the odyssey',
]);

export function textLane(selectionOrTitle: string): 'informational' | 'literary' | 'unknown' {
  const title = normalizedTextTitle(selectionOrTitle);
  if (INFORMATIONAL_TEXT_TITLES.has(title)) return 'informational';
  if (LITERARY_TEXT_TITLES.has(title)) return 'literary';
  return 'unknown';
}

export function isGenreCompatibleForStandard(selectionOrTitle: string, standardCode: string) {
  const standard = normalizedStandardCode(standardCode);
  const lane = textLane(selectionOrTitle);

  if (lane === 'unknown') return true;

  if (standard.startsWith('R.1.')) {
    return lane === 'literary' || normalizedTextTitle(selectionOrTitle) === 'a modest proposal';
  }

  if (standard.startsWith('R.2.')) {
    return lane === 'informational';
  }

  if (standard === 'R.3.4') {
    return lane === 'informational';
  }

  return true;
}

export function hasScholarlyOrNonStudentFacingSignals(args: {
  excerpt: string;
  question?: string;
  textTitleOrSelection?: string;
}) {
  const excerpt = args.excerpt.toLowerCase();
  const question = (args.question ?? '').toLowerCase();
  const scholarlySignals = [
    'dryden.',
    'coleridge',
    'langdon',
    'assyrian version',
    'ideograph',
    'tablet i',
    'tablet ii',
    'tablet iii',
    'tablet iv',
    'textual conjecture',
    'manuscript',
    'emendation',
    'variant reading',
  ];

  if (scholarlySignals.some((signal) => excerpt.includes(signal) || question.includes(signal))) return true;
  if (/\bline \d+\./i.test(args.excerpt)) return true;
  if (/\bnote \d+\b/i.test(args.excerpt) && /\bpage \d+\b/i.test(args.excerpt)) return true;
  if ((args.textTitleOrSelection ?? '').includes('Antigone') && /\b(OEDIPUS|THESEUS)\./.test(args.excerpt)) {
    return true;
  }

  return false;
}
