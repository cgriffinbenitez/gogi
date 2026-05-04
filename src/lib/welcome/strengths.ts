export type WelcomeStrengthLabel = {
  strengthLabel: string;
  gloss: string;
};

export const WELCOME_STRENGTH_LABELS: Record<string, WelcomeStrengthLabel> = {
  'ELA.9.V.1.2': {
    strengthLabel: 'breaking words apart',
    gloss: 'You break apart words better than most readers in your grade.',
  },
  'ELA.9.V.1.3': {
    strengthLabel: 'word-meaning',
    gloss: 'You figure out new words from context better than most readers in your grade.',
  },
  'ELA.9.R.1.1': {
    strengthLabel: 'literary craft',
    gloss: 'You notice how writers use language better than most readers in your grade.',
  },
  'ELA.9.R.1.2': {
    strengthLabel: 'theme-finding',
    gloss: 'You spot what stories are really about better than most readers in your grade.',
  },
  'ELA.9.R.1.3': {
    strengthLabel: 'perspective-reading',
    gloss: 'You catch what narrators are really saying better than most readers in your grade.',
  },
  'ELA.9.R.1.4': {
    strengthLabel: 'classical-text reading',
    gloss: 'You handle older and classical texts better than most readers in your grade.',
  },
  'ELA.9.R.2.1': {
    strengthLabel: 'structure-reading',
    gloss: 'You see how nonfiction is built better than most readers in your grade.',
  },
  'ELA.9.R.2.2': {
    strengthLabel: 'argument-analysis',
    gloss: 'You evaluate evidence better than most readers in your grade.',
  },
  'ELA.9.R.2.3': {
    strengthLabel: 'rhetorical reading',
    gloss: 'You catch how authors persuade better than most readers in your grade.',
  },
  'ELA.9.R.2.4': {
    strengthLabel: 'argument-comparison',
    gloss: 'You compare opposing arguments better than most readers in your grade.',
  },
  'ELA.9.R.3.1': {
    strengthLabel: 'mood-reading',
    gloss: 'You feel the mood in writing better than most readers in your grade.',
  },
  'ELA.9.R.3.3': {
    strengthLabel: 'text-connections',
    gloss: 'You connect texts across cultures better than most readers in your grade.',
  },
  'ELA.9.R.3.4': {
    strengthLabel: 'rhetoric-analysis',
    gloss: 'You spot rhetorical moves better than most readers in your grade.',
  },
};

export function getWelcomeStrengthLabel(benchmarkCode: string | null | undefined) {
  if (!benchmarkCode) {
    return {
      strengthLabel: 'reading move',
      gloss: "We'll start with the strongest evidence in your record.",
    };
  }

  return (
    WELCOME_STRENGTH_LABELS[benchmarkCode] ?? {
      strengthLabel: 'reading move',
      gloss: "We'll start with the strongest evidence in your record.",
    }
  );
}
