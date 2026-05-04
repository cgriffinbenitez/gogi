export const C = {
  // Brand core
  navy: '#1F4E79',
  blue: '#2E75B6',
  blueLight: '#E6F1FB',
  blueMid: '#B5D4F4',
  // Status
  green: '#3B6D11',
  greenLight: '#C6EFCE',
  greenBorder: '#9FE1CB',
  amber: '#BA7517',
  amberLight: '#FAEEDA',
  red: '#A32D2D',
  redLight: '#FCEBEB',
  // Neutrals
  gray: '#888780',
  dark: '#2C2C2A',
  light: '#F2F2F2',
  border: '#CCCCCC',
  white: '#FFFFFF',
  yellow: '#FFF3A3',
  // Dark screen overlays (for Bridge + Mastery screens)
  darkCard: 'rgba(255,255,255,0.08)',
  darkBorder: 'rgba(255,255,255,0.15)',
  darkMuted: 'rgba(255,255,255,0.06)',
} as const;

export type GogiState = 'neutral' | 'engaged' | 'celebrate';

export const GOGI_STATES: Record<GogiState, { bg: string; ring: string }> = {
  neutral: { bg: C.navy, ring: C.blueMid },
  engaged: { bg: C.blue, ring: C.blueMid },
  celebrate: { bg: C.green, ring: C.greenBorder },
};

// Standard status system
export type StandardStatus = 'notStarted' | 'inDiagnostic' | 'inIntervention' | 'mastered';

export const STATUS_CONFIG: Record<
  StandardStatus,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    accent: string;
  }
> = {
  notStarted: { label: 'Not Started', bg: C.light, border: C.border, text: C.gray, accent: C.gray },
  inDiagnostic: {
    label: 'In Diagnostic',
    bg: C.blueLight,
    border: C.blue,
    text: C.blue,
    accent: C.blue,
  },
  inIntervention: {
    label: 'In Intervention',
    bg: C.amberLight,
    border: C.amber,
    text: C.amber,
    accent: C.amber,
  },
  mastered: {
    label: 'Mastered',
    bg: C.greenLight,
    border: C.green,
    text: C.green,
    accent: C.green,
  },
};

// Layer colors (diagnostic breakdown layers)
export const LAYER_CONFIG = {
  1: { bg: C.amberLight, border: C.amber, text: C.amber, label: 'PRE-READING' },
  2: { bg: C.blueLight, border: C.blue, text: C.blue, label: 'DURING READING' },
  3: { bg: C.greenLight, border: C.green, text: C.green, label: 'AFTER READING' },
} as const;

// Fonts — UI uses system-ui, PASSAGE TEXT ONLY uses Georgia
export const FONTS = {
  ui: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  passage: "Georgia, 'Times New Roman', serif",
} as const;

// Pilot standards
export const STANDARDS = {
  'ELA.9.R.1.1': {
    code: 'ELA.9.R.1.1',
    title: 'Key Details & Layers of Meaning',
    short: 'Layered Meaning',
  },
  'ELA.9.R.1.2': {
    code: 'ELA.9.R.1.2',
    title: 'Universal Themes in Literary Texts',
    short: 'Universal Themes',
  },
  'ELA.9.R.1.3': {
    code: 'ELA.9.R.1.3',
    title: 'Narrator Perspective, Irony & Satire',
    short: 'Perspective',
  },
  'ELA.9.R.2.1': {
    code: 'ELA.9.R.2.1',
    title: 'Text Structure & Purpose',
    short: 'Text Structure',
  },
  'ELA.9.R.2.2': {
    code: 'ELA.9.R.2.2',
    title: 'Central Idea & Support',
    short: 'Central Idea',
  },
  'ELA.9.R.2.3': {
    code: 'ELA.9.R.2.3',
    title: 'Rhetorical Appeals & Purpose',
    short: 'Rhetorical Appeals',
  },
  'ELA.9.R.2.4': {
    code: 'ELA.9.R.2.4',
    title: 'Compare Opposing Arguments',
    short: 'Argument Comparison',
  },
  'ELA.9.R.3.1': {
    code: 'ELA.9.R.3.1',
    title: 'Figurative Language & Mood',
    short: 'Figurative Mood',
  },
  'ELA.9.R.3.3': {
    code: 'ELA.9.R.3.3',
    title: 'Adaptations Across Texts',
    short: 'Adaptations',
  },
  'ELA.9.R.3.4': {
    code: 'ELA.9.R.3.4',
    title: 'Rhetoric & Reader Effect',
    short: 'Rhetoric',
  },
  'ELA.9.V.1.2': {
    code: 'ELA.9.V.1.2',
    title: 'Word Parts & Etymology',
    short: 'Word Parts',
  },
  'ELA.9.V.1.3': {
    code: 'ELA.9.V.1.3',
    title: 'Vocabulary in Context',
    short: 'Context Vocabulary',
  },
} as const;

// Power statements (mastery screen)
export const POWER_STATEMENTS: Record<string, string> = {
  'ELA.9.R.1.1':
    'You can now read between the lines of anything — a contract, a conversation, a news story. That is a skill that cannot be faked and cannot be taken from you.',
  'ELA.9.R.1.2':
    'You can now see what any story is really about underneath the plot. Every writer in history was trying to say something true about being human. You can hear it now.',
  'ELA.9.R.1.3':
    'You can now notice what the speaker sees, misses, or twists. That makes irony and perspective easier to catch.',
  'ELA.9.R.2.1':
    'You can now see how any piece of writing is built. That means you can take it apart — and you can build your own.',
  'ELA.9.R.2.2': 'You can now match a big idea to the proof that actually supports it.',
  'ELA.9.R.2.3': 'You can now see how an author uses appeals to move a reader toward a purpose.',
  'ELA.9.R.2.4':
    'You can now compare two arguments without mixing up their claims, evidence, or limits.',
  'ELA.9.R.3.1': 'You can now explain how figurative language creates a feeling in the reader.',
  'ELA.9.R.3.3': 'You can now see what changes when a writer retells or adapts a source.',
  'ELA.9.R.3.4': 'You can now explain how wording choices shape what a reader thinks or feels.',
  'ELA.9.V.1.2': 'You can now use word parts to unlock meaning instead of guessing.',
  'ELA.9.V.1.3': 'You can now use nearby clues to choose the meaning that actually fits.',
};

// Framing sentences (reading pane schema activation)
export const FRAMING_SENTENCES: Record<string, string> = {
  'ELA.9.R.1.1':
    "As you read, notice what Della's actions reveal — things implied, not stated directly.",
  'ELA.9.R.1.2': 'As you read, identify what the story is really about — beyond the plot events.',
  'ELA.9.R.1.3':
    'As you read, notice the gap between what is said and what the reader understands.',
  'ELA.9.R.2.1':
    'As you read, notice how the author organized this text and why that structure matters.',
  'ELA.9.R.2.2': 'As you read, keep asking which details support the central idea.',
  'ELA.9.R.2.3': 'As you read, notice how the author is trying to persuade the reader.',
  'ELA.9.R.2.4': 'As you read, keep each author’s claim and evidence in its own lane.',
  'ELA.9.R.3.1': 'As you read, notice how images and comparisons create a feeling.',
  'ELA.9.R.3.3': 'As you read, notice what the author keeps and changes from the source.',
  'ELA.9.R.3.4': 'As you read, notice what the author’s wording makes you think or feel.',
  'ELA.9.V.1.2': 'As you read, break unfamiliar words into meaningful parts.',
  'ELA.9.V.1.3': 'As you read, use nearby clues to test what a word means here.',
};
