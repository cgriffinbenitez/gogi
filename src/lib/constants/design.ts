export const C = {
  // Brand core
  navy:        '#1F4E79',
  blue:        '#2E75B6',
  blueLight:   '#E6F1FB',
  blueMid:     '#B5D4F4',
  // Status
  green:       '#3B6D11',
  greenLight:  '#C6EFCE',
  greenBorder: '#9FE1CB',
  amber:       '#BA7517',
  amberLight:  '#FAEEDA',
  red:         '#A32D2D',
  redLight:    '#FCEBEB',
  // Neutrals
  gray:        '#888780',
  dark:        '#2C2C2A',
  light:       '#F2F2F2',
  border:      '#CCCCCC',
  white:       '#FFFFFF',
  yellow:      '#FFF3A3',
  // Dark screen overlays (for Bridge + Mastery screens)
  darkCard:    'rgba(255,255,255,0.08)',
  darkBorder:  'rgba(255,255,255,0.15)',
  darkMuted:   'rgba(255,255,255,0.06)',
} as const;

export type GogiState = 'neutral' | 'engaged' | 'celebrate';

export const GOGI_STATES: Record<GogiState, { bg: string; ring: string }> = {
  neutral:   { bg: C.navy,  ring: C.blueMid     },
  engaged:   { bg: C.blue,  ring: C.blueMid     },
  celebrate: { bg: C.green, ring: C.greenBorder },
};

// Standard status system
export type StandardStatus = 'notStarted' | 'inDiagnostic' | 'inIntervention' | 'mastered';

export const STATUS_CONFIG: Record<StandardStatus, {
  label: string; bg: string; border: string; text: string; accent: string;
}> = {
  notStarted:     { label: 'Not Started',     bg: C.light,      border: C.border, text: C.gray,  accent: C.gray  },
  inDiagnostic:   { label: 'In Diagnostic',   bg: C.blueLight,  border: C.blue,   text: C.blue,  accent: C.blue  },
  inIntervention: { label: 'In Intervention', bg: C.amberLight, border: C.amber,  text: C.amber, accent: C.amber },
  mastered:       { label: 'Mastered',        bg: C.greenLight, border: C.green,  text: C.green, accent: C.green },
};

// Layer colors (diagnostic breakdown layers)
export const LAYER_CONFIG = {
  1: { bg: C.amberLight, border: C.amber, text: C.amber, label: 'PRE-READING'    },
  2: { bg: C.blueLight,  border: C.blue,  text: C.blue,  label: 'DURING READING' },
  3: { bg: C.greenLight, border: C.green, text: C.green, label: 'AFTER READING'  },
} as const;

// Fonts — UI uses system-ui, PASSAGE TEXT ONLY uses Georgia
export const FONTS = {
  ui:      "system-ui, -apple-system, 'Segoe UI', sans-serif",
  passage: "Georgia, 'Times New Roman', serif",
} as const;

// Pilot standards
export const STANDARDS = {
  'ELA.9.R.1.1': { code: 'ELA.9.R.1.1', title: 'Inferencing & Textual Evidence',     short: 'Inferencing'      },
  'ELA.9.R.1.2': { code: 'ELA.9.R.1.2', title: 'Universal Themes in Literary Texts', short: 'Universal Themes' },
  'ELA.9.R.2.1': { code: 'ELA.9.R.2.1', title: 'Text Structure & Purpose',           short: 'Text Structure'   },
} as const;

// Power statements (mastery screen)
export const POWER_STATEMENTS: Record<string, string> = {
  'ELA.9.R.1.1': 'You can now read between the lines of anything — a contract, a conversation, a news story. That is a skill that cannot be faked and cannot be taken from you.',
  'ELA.9.R.1.2': 'You can now see what any story is really about underneath the plot. Every writer in history was trying to say something true about being human. You can hear it now.',
  'ELA.9.R.2.1': 'You can now see how any piece of writing is built. That means you can take it apart — and you can build your own.',
};

// Framing sentences (reading pane schema activation)
export const FRAMING_SENTENCES: Record<string, string> = {
  'ELA.9.R.1.1': "As you read, notice what Della's actions reveal — things implied, not stated directly.",
  'ELA.9.R.1.2': 'As you read, identify what the story is really about — beyond the plot events.',
  'ELA.9.R.2.1': 'As you read, notice how the author organized this text and why that structure matters.',
};
