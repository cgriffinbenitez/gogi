'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

type PullOutRow = {
  selection: string;
  exactLinesOrParagraphs: string;
  excerpt: string;
  skillFocus: string;
  whyThisExcerpt: string;
  moveStatementTemplate: string;
  instructionalSupport?: {
    title: string;
    teachFirst: string[];
    cornellNotes: string[];
    studentStrategy: string[];
    prometheanPrompt: string;
    successCriteria: string[];
  };
  teacherTrust: {
    confidence: 'strong' | 'emerging' | 'weak';
    evidencePoints: string[];
  };
  anchorQuestion: {
    stem: string;
    choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
  };
};

type LessonLaunch = {
  periodLabel: string;
  standardCode: string;
  subSkillId?: string | null;
  title: string;
  objective: string;
  pm3: {
    accuracy: string | null;
    misses: string | null;
  };
  essentialQuestion: string;
  teacherNotes: string[];
  lessonPackage?: {
    status: 'curated' | 'gold-card-fallback' | 'not-ready';
    label: string;
    standard: {
      code: string;
      title: string;
      officialText: string;
      stateGuidance: string[];
      studentsNeedToKnow: string[];
      fastDemand: string;
      itemShape: string;
      strategy: string;
      assessmentWeight: {
        category: string;
        percentOfTest: string;
        priority: 'highest' | 'high' | 'supporting';
        note: string;
      };
    };
    text: { selection: string; location: string } | null;
    textClean: string;
    vocabulary: Array<{ term: string; meaning: string; example: string }>;
    workedExample: { element: string; evidence: string; effect: string } | null;
    warnings: string[];
    blockers: string[];
  };
  anchor: PullOutRow | null;
  practiceRows: PullOutRow[];
  qualityWarnings?: string[];
};

type LessonSlide = {
  number: number;
  title: string;
  minutes: string;
  zone: 'TITLE' | 'NOTES' | 'VOCAB' | 'PASSAGE' | 'PAUSE' | 'CUE' | 'SUMMARY' | 'EXIT';
  heading: string;
  body: string[];
  task: string;
  passage?: PullOutRow | null;
  table?: Array<{ element: string; evidence: string; effect: string }>;
  question?: PullOutRow['anchorQuestion'];
};

function projectorSectionStyle(accent: string = C.blue): CSSProperties {
  return {
    background: C.white,
    border: `2px solid ${accent}`,
    borderRadius: 10,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    marginTop: 18,
    padding: 24,
  };
}

function sectionKicker(label: string) {
  return (
    <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000, letterSpacing: 1.1, textTransform: 'uppercase' }}>
      {label}
    </div>
  );
}

function paragraphBreaks(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

type TextBackgroundEntry = {
  pattern: RegExp;
  lines: string[];
  context?: string[];
  keyElements?: string[];
};

const TEXT_BACKGROUNDS: TextBackgroundEntry[] = [
  {
    pattern: /icarus and daedalus/i,
    lines: [
      'Daedalus is a brilliant inventor trapped on the island of Crete with his son, Icarus.',
      'To escape, Daedalus builds wings from feathers and wax and warns Icarus not to fly too high or too low.',
      'Icarus ignores the warning, flies too close to the sun, and the wax melts.',
      'The myth is often used to teach ambition, pride, risk, and the consequences of ignoring wisdom.',
    ],
  },
  {
    pattern: /old greek stories/i,
    lines: [
      'Old Greek Stories retells ancient myths about gods, heroes, monsters, and human choices.',
      'The stories often explain why something exists or teach a lesson about pride, fear, courage, or power.',
      'Characters face impossible problems where setting, conflict, and choices carry symbolic meaning.',
      'As you read, watch how one detail does more than move the plot: it reveals a deeper idea.',
    ],
  },
  {
    pattern: /aeneid/i,
    lines: [
      'The Aeneid follows Aeneas, a Trojan survivor trying to reach Italy and found a future nation.',
      'The poem combines war, wandering, fate, duty, and conflict between personal feeling and public responsibility.',
      'Gods and omens often shape what characters do, but characters still reveal themselves through choices.',
      'As you read, track how a detail or event connects to duty, fate, leadership, or sacrifice.',
    ],
  },
  {
    pattern: /odyssey/i,
    lines: [
      'The Odyssey follows Odysseus as he struggles to return home after the Trojan War.',
      'His journey tests his intelligence, loyalty, pride, and endurance.',
      'The story also follows his family at home, especially Telemachus and Penelope, as they face pressure from the suitors.',
      'As you read, pay attention to what actions and speeches reveal about character and values.',
    ],
  },
  {
    pattern: /iliad/i,
    lines: [
      'The Iliad is an epic poem set during the Trojan War.',
      'It focuses on honor, anger, pride, grief, leadership, and the cost of violence.',
      'War scenes often reveal character through speeches, choices, and reactions under pressure.',
      'As you read, look for how one heroic action or conflict develops a larger theme.',
    ],
  },
  {
    pattern: /romeo and juliet/i,
    lines: [
      'Romeo and Juliet is a tragedy about two young people from rival families in Verona.',
      'Their love grows inside a world shaped by family conflict, secrecy, and impulsive choices.',
      'The play uses dialogue, dramatic irony, conflict, and figurative language to build tension.',
      'As you read, watch how language and choices reveal emotion, risk, and consequence.',
    ],
  },
  {
    pattern: /a white heron/i,
    lines: [
      'A White Heron follows Sylvia, a young girl who lives close to nature in rural New England.',
      'A hunter asks her to help him find a rare white heron, forcing her to choose between reward and protection.',
      'The story uses setting, silence, and point of view to show Sylvia’s inner conflict.',
      'As you read, watch how nature details reveal what Sylvia values.',
    ],
  },
  {
    pattern: /modest proposal/i,
    lines: [
      'A Modest Proposal is a satirical essay about poverty and political cruelty in Ireland.',
      'Swift pretends to offer a shocking “solution” in order to expose how heartless real leaders sound.',
      'The speaker’s calm, logical tone is part of the satire because the idea itself is morally horrifying.',
      'As you read, look for the gap between what the speaker says and what Swift wants readers to understand.',
    ],
  },
  {
    pattern: /talented tenth/i,
    lines: [
      'The Talented Tenth is W.E.B. Du Bois’s argument about education and Black leadership.',
      'Du Bois argues that higher education can prepare leaders who lift communities through service, thought, and example.',
      'The essay uses claims, evidence, examples, and rhetorical pressure to answer critics.',
      'As you read, track how each reason supports the central idea.',
    ],
  },
  {
    pattern: /industrial education/i,
    lines: [
      'Industrial Education for the Negro presents Booker T. Washington’s argument about education and work.',
      'Washington emphasizes practical training, economic progress, and social stability.',
      'His argument often uses examples and cause-and-effect reasoning to persuade readers.',
      'As you read, track how his structure supports his purpose.',
    ],
  },
  {
    pattern: /lincoln-douglas/i,
    lines: [
      'The Lincoln-Douglas Debates were public political debates about slavery, law, and the future of the United States.',
      'Lincoln and Douglas often take opposing positions and challenge each other’s claims.',
      'The debate format makes argument, evidence, counterargument, and validity especially important.',
      'As you read, keep each speaker’s claim separate before judging which argument is better supported.',
    ],
  },
  {
    pattern: /i have a dream/i,
    lines: [
      'I Have a Dream is Martin Luther King Jr.’s speech calling for civil rights and justice.',
      'King combines American ideals, biblical language, repetition, imagery, and emotional appeals.',
      'The speech moves from injustice to hope, asking listeners to imagine a more equal future.',
      'As you read, watch how rhetoric builds urgency, hope, and purpose.',
    ],
  },
  {
    pattern: /letter from birmingham jail/i,
    lines: [
      'Letter from Birmingham Jail is Martin Luther King Jr.’s response to critics of civil rights protest.',
      'King explains why direct action is necessary when justice is delayed.',
      'He uses logic, credibility, moral reasoning, and emotional examples to defend nonviolent protest.',
      'As you read, track how each rhetorical move supports his purpose.',
    ],
  },
  {
    pattern: /danger of a single story/i,
    lines: [
      'The Danger of a Single Story is Chimamanda Ngozi Adichie’s speech about stereotypes and incomplete narratives.',
      'She explains how hearing only one version of a person or culture creates misunderstanding.',
      'The speech uses personal stories, contrast, and reflection to develop its central idea.',
      'As you read, watch how examples build the warning against oversimplifying people.',
    ],
  },
  {
    pattern: /prufrock|love song/i,
    lines: [
      'The Love Song of J. Alfred Prufrock is a modern poem spoken by an anxious, self-conscious speaker.',
      'The poem follows his thoughts as he worries about judgment, time, aging, and whether he can act.',
      'Its imagery, repetition, and fragmented movement reveal mood and inner conflict.',
      'As you read, track how style and figurative language create the speaker’s state of mind.',
    ],
  },
  {
    pattern: /beowulf/i,
    lines: [
      'Beowulf is an epic poem about a heroic warrior who battles monsters and protects communities.',
      'The poem values courage, loyalty, reputation, leadership, and sacrifice.',
      'Actions in battle often reveal character and develop themes about heroism and fate.',
      'As you read, watch how epic language makes one action feel larger than ordinary life.',
    ],
  },
  {
    pattern: /gilgamesh/i,
    lines: [
      'The Epic of Gilgamesh follows a powerful king whose friendship and losses change how he understands life.',
      'The epic explores pride, friendship, fear of death, and the search for lasting meaning.',
      'Characters often face tests that reveal what humans can and cannot control.',
      'As you read, track how conflict and consequence develop theme.',
    ],
  },
  {
    pattern: /antigone/i,
    lines: [
      'Antigone is a tragedy about a young woman who defies a ruler’s law to honor her brother.',
      'The conflict places family duty, religious duty, state power, and personal conscience against each other.',
      'Characters reveal their values through speeches, choices, and refusal to compromise.',
      'As you read, watch how opposing beliefs create tragic consequences.',
    ],
  },
  {
    pattern: /electra/i,
    lines: [
      'Electra is a Greek tragedy centered on grief, revenge, family loyalty, and justice.',
      'Electra mourns her father and longs for punishment against those who betrayed him.',
      'The play uses intense speeches and conflict to reveal character and theme.',
      'As you read, watch how emotion and duty shape each character’s choices.',
    ],
  },
  {
    pattern: /medea/i,
    lines: [
      'Medea is a Greek tragedy about betrayal, revenge, pride, and extreme emotional conflict.',
      'Medea has been wronged by Jason and uses speech and strategy to respond.',
      'The play forces readers to examine anger, justice, power, and consequences.',
      'As you read, track how character speech reveals motive and moral complexity.',
    ],
  },
  {
    pattern: /prince/i,
    context: [
      'Author: Niccolo Machiavelli, a political thinker from Florence, Italy.',
      'Time period: Renaissance Italy, when city-states, popes, armies, and ruling families fought for power.',
      'Genre: political argument, not a story with a traditional protagonist and antagonist.',
    ],
    lines: [
      'The Prince is Machiavelli’s political argument about power, leadership, and survival.',
      'Machiavelli explains how rulers gain, keep, and lose control.',
      'The text often uses examples, cause and effect, and blunt reasoning to develop its claims.',
      'As you read, track how structure and evidence support the political point.',
    ],
    keyElements: [
      'Main figure: the prince, meaning any ruler trying to gain or keep power.',
      'Main conflict: ideal morality versus practical survival in politics.',
      'Main question: What should a ruler do when being “good” is not enough to keep control?',
    ],
  },
  {
    pattern: /death of ivan ilyich/i,
    lines: [
      'The Death of Ivan Ilyich follows a man who confronts illness, fear, and the meaning of his life.',
      'As Ivan suffers, he begins to question the values and choices that shaped him.',
      'The story develops theme through inner conflict, social pressure, and realization.',
      'As you read, watch how details reveal what Ivan is beginning to understand.',
    ],
  },
  {
    pattern: /animal farm/i,
    lines: [
      'Animal Farm is an allegory about animals who overthrow humans but slowly recreate the same kind of oppression.',
      'The story uses animals and farm events to criticize power, propaganda, corruption, and betrayal.',
      'Small changes in rules, language, and behavior reveal the deeper political meaning.',
      'As you read, track how plot and irony show that the revolution is being corrupted.',
    ],
  },
  {
    pattern: /1984/i,
    lines: [
      '1984 is a dystopian novel about a society controlled by surveillance, propaganda, fear, and language manipulation.',
      'Winston Smith struggles to think independently in a world that punishes private truth.',
      'The text uses setting, conflict, and symbols to show how power controls people.',
      'As you read, watch how details reveal control, resistance, and fear.',
    ],
  },
];

function textOrientation(selection: string) {
  const match = TEXT_BACKGROUNDS.find((entry) => entry.pattern.test(selection));
  const lines = match?.lines ?? [
    `${selection} is today’s anchor text for practicing this reading skill.`,
    'You only need enough background to understand who or what the excerpt is focused on.',
    'As you read, track the main situation, the important detail, and what the detail helps reveal.',
    'The goal is not to memorize the whole work; the goal is to use the excerpt as evidence.',
  ];

  return {
    context: match?.context ?? [
      `Text: ${selection}`,
      'Purpose: get enough context to understand the excerpt without needing the full work first.',
      'Reader job: identify the speaker, situation, conflict, and detail that matters.',
    ],
    cliffNotes: lines.slice(0, 3),
    keyElements: match?.keyElements ?? [
      `Main situation: ${lines[0]}`,
      `Conflict or central idea: ${lines[1] ?? 'Use the excerpt to identify the central tension or idea.'}`,
      `What to track: ${lines[3] ?? lines[2] ?? 'Track the details that connect to today’s skill.'}`,
    ],
  };
}

function textBackgroundLines(selection: string) {
  return textOrientation(selection).cliffNotes;
}

function bellRingerForLesson(lesson: LessonLaunch) {
  const focus = lesson.anchor?.skillFocus.toLowerCase() ?? lesson.title.toLowerCase();
  const standard = lesson.standardCode;

  if (standard.includes('R.1.2')) {
    return {
      title: 'Bellringer: connect to a theme before we read',
      prompt:
        'Think about a time when someone learned a lesson from a choice, mistake, conflict, or consequence. What happened, and what larger lesson could someone take from it?',
      frame:
        'One time when someone learned a lesson from a choice, mistake, conflict, or consequence was ___. The larger lesson from this situation is ___ because ___.',
    };
  }

  if (standard.includes('R.1.1')) {
    return {
      title: 'Bellringer: notice how one detail can matter',
      prompt:
        'Describe a moment when one detail changed how you understood a person, place, situation, or conflict. What was the detail, and why did it matter?',
      frame:
        'The detail was ___. It changed my understanding because ___.',
    };
  }

  if (standard.includes('R.2')) {
    return {
      title: 'Bellringer: build an idea before we read',
      prompt:
        'Write about a time when someone tried to convince you of something. What claim did they make, and what evidence or reasoning made it stronger or weaker?',
      frame:
        'The claim was ___. The strongest/weakest support was ___ because ___.',
    };
  }

  if (standard.includes('R.3')) {
    return {
      title: 'Bellringer: pay attention to language',
      prompt:
        'Write about a word, phrase, image, or comparison that changed the way you understood something. What did the language make you picture or feel?',
      frame:
        'The language made me understand ___ because the words suggested ___.',
    };
  }

  return {
    title: `Bellringer: warm up for ${focus}`,
    prompt:
      'Write about a moment when exact words helped you understand something more clearly. What words mattered, and what did they help you figure out?',
    frame:
      'The words that mattered were ___. They helped me understand ___ because ___.',
  };
}

function LessonBellRinger({ lesson }: { lesson: LessonLaunch }) {
  const bellRinger = bellRingerForLesson(lesson);
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <section style={{ ...projectorSectionStyle(C.green), background: '#F0FDF4', minHeight: 'auto' }}>
      <div style={{ alignItems: 'flex-start', display: 'flex', gap: 18, justifyContent: 'space-between' }}>
        <div>
          {sectionKicker('Bellringer · 7 min')}
          <h2 style={{ color: C.dark, fontSize: 31, lineHeight: 1.1, margin: '7px 0' }}>{bellRinger.title}</h2>
        </div>
        <div
          style={{
            background: C.white,
            border: `2px solid ${C.green}`,
            borderRadius: 8,
            color: C.dark,
            fontSize: 22,
            fontWeight: 1000,
            lineHeight: 1.15,
            minWidth: 260,
            padding: '12px 14px',
            textAlign: 'right',
          }}
        >
          {todayLabel}
        </div>
      </div>
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.dark,
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1.38,
          marginTop: 14,
          padding: 18,
        }}
      >
        {bellRinger.prompt}
      </div>
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          marginTop: 14,
        }}
      >
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
          <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Student output</div>
          <div style={{ color: C.dark, fontSize: 18, fontWeight: 900, lineHeight: 1.35, marginTop: 6 }}>
            Write 3-5 complete sentences in your journal. Use one specific example from your own thinking or experience.
          </div>
        </div>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
          <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Sentence frame</div>
          <div style={{ color: C.blue, fontSize: 18, fontWeight: 1000, lineHeight: 1.35, marginTop: 6 }}>
            {bellRinger.frame}
          </div>
        </div>
      </div>
    </section>
  );
}

function zoneStyle(zone: LessonSlide['zone']) {
  if (zone === 'TITLE') return { border: C.dark, bg: C.dark, text: C.white, stamp: 'LESSON LAUNCH' };
  if (zone === 'VOCAB') return { border: '#F2C14E', bg: '#FFF8E1', text: C.dark, stamp: '✎ VOCAB → NOTES COLUMN' };
  if (zone === 'PASSAGE') return { border: C.dark, bg: C.dark, text: C.white, stamp: 'PROJECTED TEXT' };
  if (zone === 'PAUSE') return { border: '#F2C14E', bg: '#F2C14E', text: C.dark, stamp: '⏸ PAUSE · 60 SEC' };
  if (zone === 'CUE') return { border: '#F2C14E', bg: '#FFF8E1', text: C.dark, stamp: '✎ CUE COLUMN (left)' };
  if (zone === 'SUMMARY') return { border: C.dark, bg: '#F8FAFC', text: C.dark, stamp: '✎ SUMMARY (bottom)' };
  if (zone === 'EXIT') return { border: C.green, bg: '#F0FDF4', text: C.dark, stamp: 'EXIT TICKET' };
  return { border: C.blue, bg: C.white, text: C.dark, stamp: '✎ NOTES COLUMN (right)' };
}

function evidenceTable(row: PullOutRow | null | undefined) {
  const evidence = row?.teacherTrust.evidencePoints?.slice(0, 3) ?? [];
  return evidence.map((point, index) => ({
    element: row?.skillFocus ?? 'Skill focus',
    evidence: point,
    effect:
      index === 0
        ? row?.whyThisExcerpt ?? 'This evidence helps prove the reading skill.'
        : 'Explain what this evidence makes the reader understand.',
  }));
}

function packageEvidenceTable(lesson: LessonLaunch) {
  const workedExample = lesson.lessonPackage?.workedExample;
  if (!workedExample) return evidenceTable(lesson.anchor);
  return [
    workedExample,
    {
      element: workedExample.element,
      evidence: lesson.anchor?.teacherTrust.evidencePoints?.[1] ?? 'Student-selected evidence from the excerpt',
      effect: 'Students complete this row by explaining the meaning, style, mood, purpose, or reader effect.',
    },
    {
      element: workedExample.element,
      evidence: lesson.anchor?.teacherTrust.evidencePoints?.[2] ?? 'Student-selected evidence from the excerpt',
      effect: 'Students complete this row with exact evidence and a complete effect explanation.',
    },
  ];
}

function vocabularyAnchor(row: PullOutRow | null) {
  const text = row?.excerpt ?? '';
  const banned = new Set([
    'there',
    'their',
    'about',
    'which',
    'would',
    'could',
    'should',
    'because',
    'through',
    'before',
    'after',
    'evidence',
    'effect',
    'context',
    'analysis',
  ]);
  const candidates = [...new Set(text.match(/\b[A-Za-z][A-Za-z'-]{6,}\b/g) ?? [])]
    .filter((word) => !banned.has(word.toLowerCase()))
    .slice(0, 5);
  return candidates.length >= 4
    ? candidates.map((term) => ({
        term,
        definition: 'Use the sentence around this word to determine its precise meaning.',
      }))
    : [
        { term: 'precise', definition: 'Exact and careful.' },
        { term: 'reveals', definition: 'Shows something the reader should understand.' },
        { term: 'suggests', definition: 'Hints at an idea without stating it directly.' },
        { term: 'develops', definition: 'Builds or adds to an idea over the excerpt.' },
        { term: 'supports', definition: 'Gives proof for a claim or answer.' },
      ];
}

function lessonVocabularyAnchor(lesson: LessonLaunch) {
  const packageVocab = lesson.lessonPackage?.vocabulary ?? [];
  if (packageVocab.length) {
    return packageVocab.map((item) => ({
      term: item.term,
      definition: `${item.meaning} Example: ${item.example}`,
    }));
  }
  return vocabularyAnchor(lesson.anchor);
}

function splitNeedToKnow(item: string) {
  const [label, ...descriptionParts] = item.split(':');
  return {
    label: descriptionParts.length ? label.trim() : 'Skill move',
    description: descriptionParts.length ? descriptionParts.join(':').trim() : item,
  };
}

function SkillLessonCard({ lesson }: { lesson: LessonLaunch }) {
  const standard = lesson.lessonPackage?.standard;
  const visibleRows = lesson.practiceRows.slice(0, 6);

  if (!standard) return null;

  return (
    <section style={{ ...projectorSectionStyle(C.blue), background: C.white, minHeight: 'auto' }}>
      {sectionKicker('Launch Lesson Workspace')}
      <div style={{ alignItems: 'flex-start', display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
        <div>
          <h1 style={{ color: C.dark, fontSize: 36, lineHeight: 1.08, margin: '8px 0' }}>
            {standard.code}: {standard.title}
          </h1>
          <p style={{ color: C.dark, fontSize: 20, lineHeight: 1.35, margin: 0 }}>
            {standard.officialText}
          </p>
        </div>
        <div
          style={{
            background: '#FFF8E1',
            border: `2px solid #F2C14E`,
            borderRadius: 8,
            color: C.dark,
            minWidth: 260,
            padding: 14,
          }}
        >
          <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000, letterSpacing: 1 }}>
            Assessment Weight
          </div>
          <div style={{ fontSize: 26, fontWeight: 1000, lineHeight: 1.1, marginTop: 5 }}>
            {standard.assessmentWeight.percentOfTest}
          </div>
          <div style={{ color: C.dark, fontSize: 14, fontWeight: 900, lineHeight: 1.25, marginTop: 4 }}>
            {standard.assessmentWeight.category}
          </div>
          <div style={{ color: C.gray, fontSize: 12, fontWeight: 850, lineHeight: 1.25, marginTop: 5 }}>
            {standard.assessmentWeight.note}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          marginTop: 18,
        }}
      >
        {[
          ['Assessment demand', standard.fastDemand],
          ['Core strategy', standard.strategy],
          ['Question shape', standard.itemShape],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ color: C.gray, fontSize: 12, fontWeight: 1000 }}>{label}</div>
            <p style={{ color: C.dark, fontSize: 17, fontWeight: 850, lineHeight: 1.35, margin: '8px 0 0' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.75fr)', marginTop: 18 }}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Students need to know</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {standard.studentsNeedToKnow.map((item) => {
              const parsed = splitNeedToKnow(item);
              const highlighted =
                lesson.anchor?.skillFocus &&
                parsed.label.toLowerCase().includes(lesson.anchor.skillFocus.split(' ')[0]?.toLowerCase() ?? '');
              return (
                <div
                  key={item}
                  style={{
                    background: highlighted ? '#EFF6FF' : C.white,
                    border: `1px solid ${highlighted ? C.blue : C.border}`,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ color: highlighted ? C.blue : C.dark, fontSize: 16, fontWeight: 1000 }}>
                    {parsed.label}
                  </div>
                  <div style={{ color: C.dark, fontSize: 15, fontWeight: 750, lineHeight: 1.35, marginTop: 3 }}>
                    {parsed.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ background: '#EFF6FF', border: `1px solid ${C.blue}`, borderRadius: 8, padding: 16 }}>
            <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000 }}>Student notebook strategy</div>
            <p style={{ color: C.dark, fontSize: 19, fontWeight: 950, lineHeight: 1.35, margin: '8px 0 0' }}>
              {standard.strategy}
            </p>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Today’s 6-rep routine</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {visibleRows.map((row, index) => (
                <div key={`${row.selection}-${row.exactLinesOrParagraphs}-${index}`} style={{ display: 'grid', gap: 3 }}>
                  <div style={{ color: C.blue, fontSize: 14, fontWeight: 1000 }}>
                    Card {index + 1}: {
                      index < 2
                        ? `I Do ${index + 1}`
                        : index < 4
                          ? `We Do ${index - 1}`
                          : `You Do ${index - 3}`
                    }
                  </div>
                  <div style={{ color: C.dark, fontSize: 14, fontWeight: 850, lineHeight: 1.3 }}>
                    {row.selection} · {row.exactLinesOrParagraphs}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>State Assessment Guidance</div>
            <ul style={{ color: C.dark, fontSize: 14, fontWeight: 750, lineHeight: 1.35, margin: '8px 0 0', paddingLeft: 18 }}>
              {standard.stateGuidance.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

type ExplicitInstruction = {
  title: string;
  copyTitle: string;
  definition: string;
  notThis: string;
  thisIs: string;
  steps: string[];
  frame: string;
};

const EXPLICIT_INSTRUCTION_BY_STANDARD: Record<string, ExplicitInstruction> = {
  'ELA.9.R.1.1': {
    title: 'Explicit Instruction: Literary Elements Add Meaning',
    copyTitle: 'Copy this in your journal',
    definition:
      'A literary element adds meaning when it helps the reader understand more than the literal event.',
    notThis: 'Weak answer: It only tells what happened.',
    thisIs:
      'Strong answer: It explains how a detail affects meaning, mood, tone, theme, conflict, character, or style.',
    steps: [
      'Name the exact detail or element.',
      'Explain what is literally happening.',
      'Explain what deeper meaning the detail creates.',
      'Use exact evidence instead of general summary.',
    ],
    frame: 'The author uses ___ to show ___. This matters because ___.',
  },
  'ELA.9.R.1.2': {
    title: 'Explicit Instruction: Theme Development',
    copyTitle: 'Copy this in your journal',
    definition:
      'A theme is a complete message or lesson about life, people, choices, conflict, or society. A theme is not one word.',
    notThis: 'Not a theme: courage, fear, friendship, power.',
    thisIs:
      'Theme: People often understand the consequences of a choice only after it is too late to change it.',
    steps: [
      'Find the topic: What is this moment mostly about?',
      'Turn the topic into a complete life lesson.',
      'Use exact evidence from the text to prove how the theme develops.',
      'Avoid answers that only summarize what happened.',
    ],
    frame: 'The excerpt develops the theme that ___ because the evidence “___” shows ___.',
  },
  'ELA.9.R.1.3': {
    title: 'Explicit Instruction: Perspective, Irony, and Satire',
    copyTitle: 'Copy this in your journal',
    definition:
      'Perspective is the lens that shapes what the reader notices, trusts, questions, or understands. Irony and satire depend on a gap between surface meaning and deeper meaning.',
    notThis: 'Weak answer: It says the narrator has a point of view.',
    thisIs:
      'Strong answer: It explains the gap between what is said, expected, or believed and what the reader understands.',
    steps: [
      'Identify who is speaking, narrating, or being mocked.',
      'Name what the surface meaning seems to be.',
      'Name what the reader understands underneath.',
      'Explain how the gap creates irony, satire, or a shift in understanding.',
    ],
    frame: 'The surface meaning is ___, but the reader understands ___. This creates ___ because ___.',
  },
  'ELA.9.R.1.4': {
    title: 'Explicit Instruction: Epic Poetry',
    copyTitle: 'Copy this in your journal',
    definition:
      'Epic poetry uses heroic characters, journeys, speeches, gods, fate, elevated style, and cultural values to make events feel larger than ordinary life.',
    notThis: 'Weak answer: It only says the text is old, heroic, or about a battle.',
    thisIs:
      'Strong answer: It explains how an epic convention shapes character, structure, theme, or meaning.',
    steps: [
      'Name the epic convention you see.',
      'Point to the exact words that show it.',
      'Explain what value, conflict, or theme the convention reveals.',
      'Connect the convention to the larger meaning of the moment.',
    ],
    frame: 'This is an epic convention because ___. It develops ___ by showing ___.',
  },
  'ELA.9.R.2.1': {
    title: 'Explicit Instruction: Text Structure and Purpose',
    copyTitle: 'Copy this in your journal',
    definition:
      'Text structure is how an author organizes ideas. Structure matters because it helps the author build purpose, meaning, or a central point.',
    notThis: 'Weak answer: It only labels the structure.',
    thisIs:
      'Strong answer: It explains what the structure helps the reader understand.',
    steps: [
      'Name the structure: sequence, cause/effect, compare/contrast, problem/solution, examples, or shift.',
      'Mark the signal words or organization clues.',
      'Explain what idea the structure develops.',
      'Connect the structure to the author’s purpose.',
    ],
    frame: 'The author uses ___ structure to show ___. This helps the reader understand ___ because ___.',
  },
  'ELA.9.R.2.2': {
    title: 'Explicit Instruction: Central Idea and Support',
    copyTitle: 'Copy this in your journal',
    definition:
      'A central idea is the author’s main point. Strong support is evidence that directly proves, develops, clarifies, or extends that point.',
    notThis: 'Weak answer: It picks a true detail that does not prove the main point.',
    thisIs:
      'Strong answer: It identifies the central idea and explains why a specific detail is strong support.',
    steps: [
      'State the central idea in plain English.',
      'Find exact details that support that idea.',
      'Ask which detail makes the idea stronger.',
      'Reject details that are true but not central.',
    ],
    frame: 'The central idea is ___. The evidence “___” supports it because ___.',
  },
  'ELA.9.R.2.3': {
    title: 'Explicit Instruction: Rhetorical Appeals and Purpose',
    copyTitle: 'Copy this in your journal',
    definition:
      'A rhetorical move is a choice an author makes to influence the reader. Appeals to logic, credibility, emotion, repetition, questions, or figurative language help the author achieve a purpose.',
    notThis: 'Weak answer: It only names logos, ethos, pathos, or a device.',
    thisIs:
      'Strong answer: It explains how the move affects the reader and supports the author’s purpose.',
    steps: [
      'Name the rhetorical move.',
      'Explain what it makes the reader think, feel, trust, or notice.',
      'Connect that reader effect to the author’s purpose.',
      'Use exact words from the excerpt.',
    ],
    frame: 'The author uses ___ to make the reader ___. This supports the purpose by ___.',
  },
  'ELA.9.R.2.4': {
    title: 'Explicit Instruction: Opposing Arguments',
    copyTitle: 'Copy this in your journal',
    definition:
      'Opposing arguments take different positions on the same issue. To evaluate them, compare each claim and the evidence used to support it.',
    notThis: 'Weak answer: It chooses the side that sounds stronger or more emotional.',
    thisIs:
      'Strong answer: It judges which claim is better supported with relevant, logical, and sufficient evidence.',
    steps: [
      'Separate Argument A from Argument B.',
      'Write each side’s claim in plain English.',
      'List the evidence each side uses.',
      'Decide which argument is more valid or effective and explain why.',
    ],
    frame: 'Argument A claims ___. Argument B claims ___. The stronger argument is ___ because ___.',
  },
  'ELA.9.R.3.1': {
    title: 'Explicit Instruction: Figurative Language and Mood',
    copyTitle: 'Copy this in your journal',
    definition:
      'Figurative language creates mood when words, images, or comparisons shape the feeling of a scene.',
    notThis: 'Weak answer: It only labels the device as a simile, metaphor, or personification.',
    thisIs:
      'Strong answer: It explains how the language creates a feeling or changes the reader’s understanding.',
    steps: [
      'Point to the figurative or image-heavy language.',
      'Translate what it literally suggests.',
      'Name the mood or feeling it creates.',
      'Explain how that mood affects the passage.',
    ],
    frame: 'The phrase “___” creates a ___ mood because it makes the reader imagine ___.',
  },
  'ELA.9.R.3.2': {
    title: 'Explicit Instruction: Accurate Paraphrase',
    copyTitle: 'Copy this in your journal',
    definition:
      'To paraphrase means to restate the author’s meaning in your own words without changing, adding, or deleting important ideas.',
    notThis: 'Weak answer: It sounds simpler but changes the meaning.',
    thisIs:
      'Strong answer: It keeps the same who, what, when, where, why, and how in clearer language.',
    steps: [
      'Chunk the sentence into smaller parts.',
      'Restate each chunk in plain English.',
      'Keep every important idea from the original.',
      'Reread to make sure the meaning did not change.',
    ],
    frame: 'In my own words, this means ___, and I know the meaning stayed the same because ___.',
  },
  'ELA.9.R.3.3': {
    title: 'Explicit Instruction: Adaptation Across Texts',
    copyTitle: 'Copy this in your journal',
    definition:
      'An adaptation keeps some parts of a source text and changes others. The job is to explain what changed, what stayed, and why it matters.',
    notThis: 'Weak answer: It only says the two versions are different.',
    thisIs:
      'Strong answer: It explains how a change affects character, theme, tone, conflict, or meaning.',
    steps: [
      'Identify the source text and the adaptation.',
      'Name one important similarity.',
      'Name one important change.',
      'Explain how the change affects meaning or reader understanding.',
    ],
    frame: 'The adaptation keeps ___ but changes ___. This affects meaning because ___.',
  },
  'ELA.9.R.3.4': {
    title: 'Explicit Instruction: Rhetoric and Reader Effect',
    copyTitle: 'Copy this in your journal',
    definition:
      'Rhetoric is language used to shape what the reader thinks, feels, believes, or notices.',
    notThis: 'Weak answer: It only identifies a rhetorical question, repetition, or emotional word.',
    thisIs:
      'Strong answer: It explains the effect of the rhetorical choice on the reader.',
    steps: [
      'Name the rhetorical move.',
      'Point to the exact words.',
      'Explain what the move makes the reader think or feel.',
      'Connect that effect to the author’s larger point.',
    ],
    frame: 'The author uses ___ to make the reader ___. This strengthens the point because ___.',
  },
  'ELA.9.V.1.1': {
    title: 'Explicit Instruction: Academic Vocabulary',
    copyTitle: 'Copy this in your journal',
    definition:
      'Academic vocabulary means precise words used across school subjects to explain ideas clearly in reading, speaking, and writing.',
    notThis: 'Weak answer: It uses a word because it sounds smart.',
    thisIs:
      'Strong answer: It uses the word precisely because it fits the meaning and tone of the sentence.',
    steps: [
      'Read the sentence around the word.',
      'Decide the precise meaning in context.',
      'Check the word form and tone.',
      'Use the word in a complete academic sentence.',
    ],
    frame: 'The word ___ means ___ in this context. I can use it precisely by writing ___.',
  },
  'ELA.9.V.1.2': {
    title: 'Explicit Instruction: Word Parts and Origins',
    copyTitle: 'Copy this in your journal',
    definition:
      'Etymology and derivation help readers use word origins, roots, prefixes, suffixes, and related words to determine meaning.',
    notThis: 'Weak answer: It guesses from one word part without checking the sentence.',
    thisIs:
      'Strong answer: It uses the word part and the sentence context together.',
    steps: [
      'Break the word into meaningful parts.',
      'Define the prefix, root, suffix, or related word.',
      'Reread the sentence to test the meaning.',
      'Choose the meaning that fits both the word part and context.',
    ],
    frame: 'The part ___ means ___. In this sentence, the word most likely means ___ because ___.',
  },
  'ELA.9.V.1.3': {
    title: 'Explicit Instruction: Context and Connotation',
    copyTitle: 'Copy this in your journal',
    definition:
      'Denotation is the basic dictionary meaning. Connotation is the feeling or attitude a word carries in context.',
    notThis: 'Weak answer: It chooses a familiar synonym without checking tone.',
    thisIs:
      'Strong answer: It chooses the meaning that fits the sentence and the feeling of the passage.',
    steps: [
      'Read before and after the word.',
      'Replace the word with each possible meaning.',
      'Check whether the meaning and tone still fit.',
      'Choose the best meaning for this exact context.',
    ],
    frame: 'In this context, ___ means ___. The connotation is ___ because ___.',
  },
};

function explicitInstructionForLesson(lesson: LessonLaunch) {
  const standard = lesson.lessonPackage?.standard;
  const skillFocus = lesson.anchor?.skillFocus ?? lesson.title;
  return (
    EXPLICIT_INSTRUCTION_BY_STANDARD[lesson.standardCode] ?? {
      title: `Explicit Instruction: ${skillFocus}`,
      copyTitle: 'Copy this in your journal',
      definition: standard?.officialText ?? 'Today’s skill asks you to prove an answer with exact evidence from the text.',
      notThis: 'Weak answer: It only repeats or summarizes the passage.',
      thisIs: 'Strong answer: It uses exact evidence and explains what the evidence proves.',
      steps: [
        'Read the question before choosing evidence.',
        'Find the exact words that prove the answer.',
        'Explain what those words show.',
        'Eliminate answers that do not match the evidence.',
      ],
      frame: 'The evidence “___” proves ___ because ___.',
    }
  );
}

function ExplicitInstructionCard({ lesson }: { lesson: LessonLaunch }) {
  const instruction = explicitInstructionForLesson(lesson);

  return (
    <section style={{ ...projectorSectionStyle(C.blue), background: C.white, minHeight: 'auto' }}>
      {sectionKicker('Explicit Instruction · 12 min')}
      <h2 style={{ color: C.dark, fontSize: 31, lineHeight: 1.1, margin: '7px 0' }}>{instruction.title}</h2>
      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          marginTop: 14,
        }}
      >
        <div style={{ background: '#EFF6FF', border: `1px solid ${C.blue}`, borderRadius: 8, padding: 16 }}>
          <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000 }}>{instruction.copyTitle}</div>
          <div style={{ color: C.dark, fontSize: 21, fontWeight: 950, lineHeight: 1.35, marginTop: 8 }}>
            {instruction.definition}
          </div>
          <div style={{ color: C.dark, fontSize: 17, fontWeight: 850, lineHeight: 1.35, marginTop: 14 }}>
            <strong>Not this:</strong> {instruction.notThis}
          </div>
          <div style={{ color: C.dark, fontSize: 17, fontWeight: 850, lineHeight: 1.35, marginTop: 8 }}>
            <strong>This:</strong> {instruction.thisIs}
          </div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>How to do the skill</div>
          <div style={{ color: C.dark, display: 'grid', fontSize: 17, fontWeight: 850, gap: 8, lineHeight: 1.35, marginTop: 10 }}>
            {instruction.steps.map((step, index) => (
              <div key={step}>
                {index + 1}. {step}
              </div>
            ))}
          </div>
          <div
            style={{
              background: '#FFF8E1',
              border: '1px solid #F2C14E',
              borderRadius: 8,
              color: C.dark,
              fontSize: 18,
              fontWeight: 1000,
              lineHeight: 1.35,
              marginTop: 14,
              padding: 12,
            }}
          >
            Sentence frame: {instruction.frame}
          </div>
        </div>
      </div>
    </section>
  );
}

function exitTicketForLesson(lesson: LessonLaunch, anchorTextTitle: string) {
  const standard = lesson.standardCode;
  const textName = anchorTextTitle.replace(/\s+—\s+.+$/, '');

  if (standard.includes('R.1.2') && /prince/i.test(anchorTextTitle)) {
    return {
      prompt:
        'Do you agree with Machiavelli’s idea that rulers sometimes need force, fear, or strict control to gain and keep power?',
      output:
        'Write 3-5 complete sentences. State your position, explain why, and use one idea from today’s lesson as support.',
      frame:
        'I agree/disagree with Machiavelli because ___. One idea from today that supports my thinking is ___. This connects to theme because ___.',
    };
  }

  if (standard.includes('R.1.2')) {
    return {
      prompt:
        `What universal theme did ${textName} help develop today, and how could that theme apply beyond the text?`,
      output:
        'Write 3-5 complete sentences. Name the theme, explain it in your own words, and connect it to one moment from today.',
      frame:
        `A universal theme from ${textName} is ___. This theme applies beyond the text because ___. One moment that shows it is ___.`,
    };
  }

  if (standard.includes('R.1.1')) {
    return {
      prompt:
        `Which literary detail from ${textName} mattered most today, and what deeper meaning did it add?`,
      output:
        'Write 3-5 complete sentences. Name the detail, explain what it shows, and explain why it matters.',
      frame:
        `One important detail from ${textName} is ___. It adds meaning because ___. This matters to the reader because ___.`,
    };
  }

  if (standard.includes('R.1.3')) {
    return {
      prompt:
        `How did perspective, irony, or satire in ${textName} change what the reader understood?`,
      output:
        'Write 3-5 complete sentences. Explain the surface meaning and the deeper meaning.',
      frame:
        `On the surface, ___. But the reader understands ___. This changes the meaning because ___.`,
    };
  }

  if (standard.includes('R.1.4')) {
    return {
      prompt:
        `Which epic feature from ${textName} helped build character, structure, or theme today?`,
      output:
        'Write 3-5 complete sentences. Name the epic feature and explain its effect.',
      frame:
        `The epic feature I noticed was ___. It helped develop ___ because ___.`,
    };
  }

  if (standard.includes('R.2.1')) {
    return {
      prompt:
        `How did the structure of ${textName} help the author make a point today?`,
      output:
        'Write 3-5 complete sentences. Name the structure and explain what it helped the reader understand.',
      frame:
        `The author organized the text by ___. This structure helped show ___ because ___.`,
    };
  }

  if (standard.includes('R.2.2')) {
    return {
      prompt:
        `What central idea did ${textName} develop today, and what kind of support made that idea stronger?`,
      output:
        'Write 3-5 complete sentences. State the central idea and explain the support.',
      frame:
        `The central idea is ___. The author supports it by ___. This support is strong because ___.`,
    };
  }

  if (standard.includes('R.2.3') || standard.includes('R.3.4')) {
    return {
      prompt:
        `What rhetorical move from ${textName} was most effective today, and why did it work on the reader?`,
      output:
        'Write 3-5 complete sentences. Name the move, explain the reader effect, and connect it to purpose.',
      frame:
        `The author uses ___ to make the reader ___. This works because ___.`,
    };
  }

  if (standard.includes('R.2.4')) {
    return {
      prompt:
        'Which argument from today was better supported, and why?',
      output:
        'Write 3-5 complete sentences. State both sides briefly, then explain which side had stronger evidence.',
      frame:
        'One side argued ___. The other side argued ___. The stronger argument was ___ because ___.',
    };
  }

  if (standard.includes('R.3.1')) {
    return {
      prompt:
        `Which phrase or image from ${textName} created the strongest mood today?`,
      output:
        'Write 3-5 complete sentences. Name the phrase, identify the mood, and explain the effect.',
      frame:
        `The phrase “___” creates a ___ mood because ___.`,
    };
  }

  if (standard.includes('R.3.2')) {
    return {
      prompt:
        'What is one difficult idea from today that you can accurately restate in your own words?',
      output:
        'Write 3-5 complete sentences. Restate the idea and explain how you know your paraphrase kept the same meaning.',
      frame:
        'In my own words, this means ___. I know I kept the same meaning because ___.',
    };
  }

  if (standard.includes('R.3.3')) {
    return {
      prompt:
        'What changed between the source text and the adaptation, and why did that change matter?',
      output:
        'Write 3-5 complete sentences. Name one similarity, one change, and the effect of that change.',
      frame:
        'The adaptation keeps ___ but changes ___. This matters because ___.',
    };
  }

  if (standard.includes('V.')) {
    return {
      prompt:
        'Which word or phrase from today mattered most for understanding the text?',
      output:
        'Write 3-5 complete sentences. Explain the word’s meaning in context and why that meaning matters.',
      frame:
        'The word/phrase ___ means ___ in this context. This matters because ___.',
    };
  }

  return {
    prompt:
      `What is the most important thing you understood from ${textName} today?`,
    output:
      'Write 3-5 complete sentences. Use one specific idea from the lesson to support your answer.',
    frame:
      'The most important thing I understood today was ___. I know this because ___.',
  };
}

function LessonPracticeCard({
  badge,
  minutes,
  title,
  row,
  showAnswerKey,
  mode,
}: {
  badge: string;
  minutes: string;
  title: string;
  row: PullOutRow | null | undefined;
  showAnswerKey: boolean;
  mode: 'evidence' | 'question';
}) {
  if (!row) return null;
  const skillTarget = studentFacingSkillTarget(row);

  return (
    <section style={{ ...projectorSectionStyle(C.dark), background: C.white, minHeight: 'auto' }}>
      <div style={{ alignItems: 'flex-start', display: 'flex', gap: 14, justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            {badge}
          </div>
          <h2 style={{ color: C.dark, fontSize: 30, lineHeight: 1.1, margin: '7px 0 4px' }}>{title}</h2>
          <div style={{ color: C.gray, fontSize: 15, fontWeight: 900 }}>
            {row.selection} · {row.exactLinesOrParagraphs}
          </div>
        </div>
        <span
          style={{
            background: '#FFF8E1',
            border: '1px solid #F2C14E',
            borderRadius: 999,
            color: C.dark,
            fontSize: 14,
            fontWeight: 1000,
            padding: '8px 13px',
            whiteSpace: 'nowrap',
          }}
        >
          {minutes}
        </span>
      </div>

      <div
        style={{
          background: '#F8FAFC',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.dark,
          fontFamily: FONTS.passage,
          fontSize: 21,
          lineHeight: 1.48,
          marginTop: 16,
          padding: 18,
        }}
      >
        {paragraphBreaks(row.excerpt).map((paragraph) => (
          <p key={paragraph.slice(0, 64)} style={{ margin: '0 0 14px' }}>
            {paragraph}
          </p>
        ))}
        <div style={{ color: C.gray, fontFamily: FONTS.ui, fontSize: 13, fontWeight: 900, marginTop: 8 }}>
          Source: {row.selection}
        </div>
      </div>

      <div style={{ background: '#EFF6FF', border: `1px solid ${C.blue}`, borderRadius: 8, marginTop: 16, padding: 16 }}>
        {mode === 'evidence' ? (
          <>
            <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000 }}>Evidence hunt</div>
            <h3 style={{ color: C.dark, fontSize: 22, lineHeight: 1.25, margin: '6px 0 12px' }}>
              Box the exact words that help answer this question:
            </h3>
            <div
              style={{
                background: C.white,
                border: `2px solid ${C.blue}`,
                borderRadius: 8,
                color: C.dark,
                fontSize: 19,
                fontWeight: 950,
                lineHeight: 1.35,
                marginBottom: 12,
                padding: 12,
              }}
            >
              {row.anchorQuestion.stem}
            </div>
            <div style={{ color: C.dark, display: 'grid', fontSize: 17, fontWeight: 850, gap: 8, lineHeight: 1.35 }}>
              <div>1. Box the strongest evidence that proves the answer.</div>
              <div>2. Label what the evidence shows about {skillTarget}.</div>
              <div>3. Write: This evidence proves ___ because ___.</div>
            </div>
          </>
        ) : (
          <>
        <div style={{ color: C.blue, fontSize: 13, fontWeight: 1000 }}>Standards-aligned check</div>
        <h3 style={{ color: C.dark, fontSize: 22, lineHeight: 1.25, margin: '6px 0 12px' }}>
          {row.anchorQuestion.stem}
        </h3>
        <div style={{ display: 'grid', gap: 9 }}>
          {row.anchorQuestion.choices.map((choice) => (
            <div
              key={choice.label}
              style={{
                background: C.white,
                border: `2px solid ${showAnswerKey && choice.correct ? C.green : C.border}`,
                borderRadius: 8,
                color: showAnswerKey && choice.correct ? C.green : C.dark,
                fontSize: 17,
                fontWeight: 850,
                lineHeight: 1.35,
                padding: 12,
              }}
            >
              {choice.label}. {choice.text}
            </div>
          ))}
        </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Evidence points</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {row.teacherTrust.evidencePoints.slice(0, 4).map((point) => (
            <span
              key={point}
              style={{
                background: '#F8FAFC',
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                color: C.dark,
                fontSize: 13,
                fontWeight: 850,
                lineHeight: 1.25,
                padding: '7px 10px',
              }}
            >
              {point}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function studentFacingSkillTarget(row: PullOutRow) {
  const focus = row.skillFocus.toLowerCase();
  const question = row.anchorQuestion.stem.toLowerCase();

  if (focus.includes('theme') || question.includes('theme')) return 'the theme';
  if (focus.includes('central idea') || question.includes('central idea')) return 'the central idea';
  if (focus.includes('author purpose') || focus.includes('rhetoric') || focus.includes('appeal')) {
    return 'the author’s purpose';
  }
  if (focus.includes('structure') || question.includes('structure')) return 'the text structure';
  if (focus.includes('character')) return 'the character';
  if (focus.includes('setting')) return 'the setting';
  if (focus.includes('plot') || focus.includes('conflict')) return 'the conflict';
  if (focus.includes('point of view') || focus.includes('viewpoint')) return 'the point of view';
  if (focus.includes('tone')) return 'the tone';
  if (focus.includes('mood')) return 'the mood';
  if (focus.includes('word') || focus.includes('vocabulary') || focus.includes('connotation')) {
    return 'the word or phrase';
  }
  if (focus.includes('paraphrase') || focus.includes('syntax')) return 'the author’s meaning';

  return 'today’s skill';
}

function LessonRoutine({ lesson, showAnswerKey }: { lesson: LessonLaunch; showAnswerKey: boolean }) {
  const [modelOne, modelTwo, guidedOne, guidedTwo, togetherOne, aloneOne] = lesson.practiceRows;
  const fallback = modelOne ?? lesson.anchor;
  const anchorTextTitle = lesson.lessonPackage?.text?.selection ?? fallback?.selection ?? 'today’s anchor text';
  const orientation = textOrientation(anchorTextTitle);
  const exitTicket = exitTicketForLesson(lesson, anchorTextTitle);

  return (
    <>
      <section style={{ ...projectorSectionStyle(C.green), background: '#F0FDF4', minHeight: 'auto' }}>
        {sectionKicker('90-minute lesson routine')}
        <h2 style={{ color: C.dark, fontSize: 30, margin: '7px 0' }}>
          Bellringer, skill card, then six evidence-based reps
        </h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', marginTop: 14 }}>
          {[
            ['7 min', 'Bellringer'],
            ['12 min', 'Skill Card'],
            ['5 min', 'Text Setup'],
            ['16 min', 'I Do'],
            ['20 min', 'We Do'],
            ['23 min', 'You Do'],
            ['7 min', 'Exit'],
          ].map(([time, label]) => (
            <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ color: C.green, fontSize: 18, fontWeight: 1000 }}>{time}</div>
              <div style={{ color: C.dark, fontSize: 14, fontWeight: 900, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
        {lesson.practiceRows.length < 6 ? (
          <div
            style={{
              background: '#FFF8E1',
              border: '1px solid #F2C14E',
              borderRadius: 8,
              color: C.dark,
              fontSize: 15,
              fontWeight: 900,
              lineHeight: 1.35,
              marginTop: 12,
              padding: 12,
            }}
          >
            GOGI has {lesson.practiceRows.length} distinct card{lesson.practiceRows.length === 1 ? '' : 's'} ready for this lesson right now. It will not duplicate cards to fake a 90-minute lesson; this standard/text needs more approved reps before it is fully lesson-ready.
          </div>
        ) : null}
      </section>

      <section style={{ ...projectorSectionStyle('#F2C14E'), background: '#FFF8E1', minHeight: 'auto' }}>
        {sectionKicker('Text orientation · 5 min')}
        <h2 style={{ color: C.dark, fontSize: 30, margin: '7px 0' }}>
          Before we jump in: {anchorTextTitle}
        </h2>
        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            marginTop: 14,
          }}
        >
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Quick context</div>
            <ul style={{ color: C.dark, fontSize: 16, fontWeight: 850, lineHeight: 1.42, margin: '8px 0 0', paddingLeft: 18 }}>
              {orientation.context.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Cliff-notes version</div>
            <ul style={{ color: C.dark, fontSize: 16, fontWeight: 850, lineHeight: 1.42, margin: '8px 0 0', paddingLeft: 18 }}>
              {orientation.cliffNotes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 1000 }}>Story / argument map</div>
            <ul style={{ color: C.dark, fontSize: 16, fontWeight: 850, lineHeight: 1.42, margin: '8px 0 0', paddingLeft: 18 }}>
              {orientation.keyElements.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ExplicitInstructionCard lesson={lesson} />

      <LessonPracticeCard
        badge="I Do 1 · 8 min"
        minutes="Evidence model"
        title="Rep 1: model the evidence move"
        row={modelOne}
        showAnswerKey={showAnswerKey}
        mode="evidence"
      />

      <LessonPracticeCard
        badge="I Do 2 · 8 min"
        minutes="Question model"
        title="Rep 2: model the reasoning move"
        row={modelTwo}
        showAnswerKey={showAnswerKey}
        mode="question"
      />

      <LessonPracticeCard
        badge="We Do 1 · 10 min"
        minutes="Guided evidence"
        title="Rep 3: guided evidence analysis"
        row={guidedOne}
        showAnswerKey={showAnswerKey}
        mode="evidence"
      />

      <LessonPracticeCard
        badge="We Do 2 · 10 min"
        minutes="Guided item"
        title="Rep 4: guided standards-aligned reasoning"
        row={guidedTwo}
        showAnswerKey={showAnswerKey}
        mode="question"
      />

      <LessonPracticeCard
        badge="You Do 1 · 11 min"
        minutes="Independent evidence"
        title="Rep 5: students find and explain evidence independently"
        row={togetherOne}
        showAnswerKey={showAnswerKey}
        mode="evidence"
      />

      <LessonPracticeCard
        badge="You Do 2 · 12 min"
        minutes="Independent item"
        title="Rep 6: independent standards-aligned response"
        row={aloneOne}
        showAnswerKey={showAnswerKey}
        mode="question"
      />

      <section style={{ ...projectorSectionStyle('#F2C14E'), background: '#FFF8E1', minHeight: 'auto' }}>
        {sectionKicker('Exit / Close · 7 min')}
        <h2 style={{ color: C.dark, fontSize: 30, margin: '7px 0' }}>Exit Ticket</h2>
        <div
          style={{
            background: C.white,
            border: `2px solid ${C.dark}`,
            borderRadius: 8,
            color: C.dark,
            fontSize: 21,
            fontWeight: 950,
            lineHeight: 1.35,
            marginTop: 14,
            padding: 16,
          }}
        >
          {exitTicket.prompt}
        </div>
        <div style={{ color: C.dark, display: 'grid', fontSize: 18, fontWeight: 900, gap: 9, lineHeight: 1.35, marginTop: 14 }}>
          <div>{exitTicket.output}</div>
          <div>Frame: {exitTicket.frame}</div>
        </div>
      </section>
    </>
  );
}

function buildCornellSlides(lesson: LessonLaunch): LessonSlide[] {
  const [worked, guided, independent] = lesson.practiceRows;
  const anchor = worked ?? lesson.anchor;
  const support = anchor?.instructionalSupport;
  const vocab = lessonVocabularyAnchor(lesson);
  const standardGuidance = lesson.lessonPackage?.standard;

  const contentSlides: LessonSlide[] = [
    {
      number: 1,
      title: 'Phase 1 · Retrieval / Do Now',
      minutes: '2 MIN',
      zone: 'TITLE',
      heading: `${lesson.standardCode}: ${lesson.title}`,
      body: [
        lesson.periodLabel,
        '90-minute Cornell lesson · Retrieval → I Do → We Do → You Do Together → You Do Alone → Exit',
        lesson.objective,
      ],
      task: 'Name, date, period, and standard code at the top of your journal page.',
    },
    {
      number: 2,
      title: 'Phase 1 · Retrieval / Do Now',
      minutes: '6 MIN',
      zone: 'NOTES',
      heading: 'Do Now: retrieve what you already know',
      body: [
        '1. What is the difference between summary and analysis?',
        `2. What exact evidence could prove ${anchor?.skillFocus.toLowerCase() ?? 'a reading skill'}?`,
        '3. What makes an evidence-based answer stronger than a guess?',
        '4. What did we practice last time that connects to today?',
      ],
      task: 'Answer all four in the NOTES column. Be ready for cold-call review.',
    },
    {
      number: 3,
      title: 'Phase 2 · I Do: Focused Instruction',
      minutes: '5 MIN',
      zone: 'NOTES',
      heading: lesson.standardCode,
      body: [
        standardGuidance?.officialText ?? lesson.objective,
        `Today’s target: ${anchor?.skillFocus ?? lesson.title}`,
        `Essential question: ${lesson.essentialQuestion}`,
        lesson.pm3.accuracy ? `PM3 evidence: ${Math.round(Number(lesson.pm3.accuracy) * 100)}% correct · ${lesson.pm3.misses ?? '?'} missed item opportunities.` : 'PM3 evidence: selected from class need.',
      ],
      task: 'Copy the standard and underline the action verb.',
    },
    {
      number: 4,
      title: 'Phase 2 · I Do: Focused Instruction',
      minutes: '5 MIN',
      zone: 'NOTES',
      heading: support?.title ?? 'Teacher model: what the skill means',
      body: [
        ...(support?.teachFirst?.length ? support.teachFirst.slice(0, 3) : lesson.teacherNotes.slice(0, 3)),
        'Teacher think-aloud: I will name the skill, point to exact evidence, and explain the effect.',
      ],
      task: 'Copy the definition and the three-step strategy.',
    },
    {
      number: 5,
      title: 'Phase 2 · I Do: Focused Instruction',
      minutes: '5 MIN',
      zone: 'VOCAB',
      heading: 'Vocabulary anchor',
      body: vocab.slice(0, 5).map((item) => `${item.term}: ${item.definition}`),
      task: 'Copy the words. Underline any word you cannot explain yet.',
    },
    {
      number: 6,
      title: 'Phase 3 · We Do: Guided Practice',
      minutes: '6 MIN',
      zone: 'PASSAGE',
      heading: worked?.selection ?? anchor?.selection ?? 'Gold Card 1: teacher model',
      body: ['First read: teacher reads aloud.', 'Second read: students track and box the evidence the teacher names.'],
      task: 'Paraphrase the excerpt in one sentence. Then box the teacher-selected evidence.',
      passage: worked ?? anchor,
    },
    {
      number: 7,
      title: 'Phase 3 · We Do: Guided Practice',
      minutes: '8 MIN',
      zone: 'NOTES',
      heading: 'I Do model: evidence → skill → effect',
      body: [
        'Teacher models the full answer path.',
        'Students copy the model exactly first.',
        'Then students add one sentence explaining why the correct answer beats a summary-only answer.',
      ],
      task: 'Copy the model table and write one “why this answer wins” sentence.',
      table: packageEvidenceTable(lesson),
    },
    {
      number: 8,
      title: 'Phase 3 · We Do: Guided Practice',
      minutes: '6 MIN',
      zone: 'EXIT',
      heading: support?.prometheanPrompt ?? anchor?.anchorQuestion.stem ?? 'What does the evidence prove?',
      body: ['CFU: answer silently first.', 'Teacher cold-calls evidence, not guesses.', 'Class revises the answer together.'],
      task: 'Choose an answer, then write: I know because the text says ___.',
      question: worked?.anchorQuestion ?? anchor?.anchorQuestion,
    },
    {
      number: 9,
      title: 'Phase 4 · You Do Together: Collaborative Practice',
      minutes: '6 MIN',
      zone: 'PASSAGE',
      heading: guided?.selection ?? 'Gold Card 2: guided practice',
      body: ['Partner A reads the excerpt.', 'Partner B paraphrases it.', 'Both students underline the evidence that connects to the skill.'],
      task: 'Write a one-sentence paraphrase and underline the strongest evidence.',
      passage: guided ?? anchor,
    },
    {
      number: 10,
      title: 'Phase 4 · You Do Together: Collaborative Practice',
      minutes: '8 MIN',
      zone: 'NOTES',
      heading: 'Build the answer together',
      body: ['Use the sentence frame.', guided?.moveStatementTemplate ?? anchor?.moveStatementTemplate ?? 'When the author uses ___, it shows ___ because ___.', 'Teacher circulates and listens for the main misconception.'],
      task: 'Complete the evidence/effect table with your partner. Each student writes in their own journal.',
      table: evidenceTable(guided ?? anchor),
    },
    {
      number: 11,
      title: 'Phase 4 · You Do Together: Collaborative Practice',
      minutes: '6 MIN',
      zone: 'EXIT',
      heading: guided?.anchorQuestion.stem ?? 'Which answer is strongest?',
      body: ['Partners choose independently first.', 'Then compare.', 'You must explain why one wrong answer is tempting but wrong.'],
      task: 'Answer the question and write why one distractor is wrong.',
      question: guided?.anchorQuestion ?? anchor?.anchorQuestion,
    },
    {
      number: 12,
      title: 'Phase 5 · You Do Alone: Independent Practice',
      minutes: '8 MIN',
      zone: 'PASSAGE',
      heading: independent?.selection ?? 'Gold Card 3: independent practice',
      body: ['Solo work.', 'Read, paraphrase, and annotate before answering.', 'This is the assessment-format rep.'],
      task: 'Write a paraphrase, underline evidence, and answer without help.',
      passage: independent ?? guided ?? anchor,
    },
    {
      number: 13,
      title: 'Phase 5 · You Do Alone: Independent Practice',
      minutes: '5 MIN',
      zone: 'EXIT',
      heading: independent?.anchorQuestion.stem ?? 'Independent standards-aligned check',
      body: ['Choose the best answer.', 'Then justify it in two sentences.', 'Use one exact quote.'],
      task: 'Answer + quote + effect explanation.',
      question: independent?.anchorQuestion ?? guided?.anchorQuestion ?? anchor?.anchorQuestion,
    },
    {
      number: 14,
      title: 'Phase 5 · You Do Alone: Independent Practice',
      minutes: '5 MIN',
      zone: 'NOTES',
      heading: 'Revise before the grade',
      body: ['Check: Did I prove the answer with evidence?', 'Check: Did I explain effect instead of summary?', 'Check: Did I avoid the tempting distractor?'],
      task: 'Revise your justification. Add one sentence explaining why a wrong answer is wrong.',
    },
    {
      number: 15,
      title: 'Phase 6 · Exit / Close',
      minutes: '4 MIN',
      zone: 'CUE',
      heading: 'Cue column + summary',
      body: ['Write two cue questions your notes can answer.', 'Write a 2-sentence summary using today’s skill language.', 'This becomes tomorrow’s retrieval review.'],
      task: 'Finish cue questions and summary at the bottom of the page.',
    },
    {
      number: 16,
      title: 'Phase 6 · Exit / Close',
      minutes: '3 MIN',
      zone: 'EXIT',
      heading: 'Exit check and tomorrow’s retrieval prompt',
      body: ['Turn in the independent answer.', 'Teacher records reteach signal.', 'Tomorrow’s Do Now starts with the most common miss.'],
      task: 'On the last line, write: Tomorrow I need to remember ___.',
    },
  ];

  const pauses: Array<{ after: number; heading: string; task: string; body: string[] }> = [];

  const output: LessonSlide[] = [];
  for (const slide of contentSlides) {
    output.push(slide);
    const pause = pauses.find((item) => item.after === slide.number);
    if (pause) {
      output.push({
        number: 0,
        title: '⏸ Pause',
        minutes: '60 SEC',
        zone: 'PAUSE',
        heading: pause.heading,
        body: pause.body,
        task: pause.task,
      });
    }
  }

  return output.map((slide, index) => ({ ...slide, number: index + 1 }));
}

export default function LessonLaunchPage() {
  const searchParams = useSearchParams();
  const standardCode = searchParams.get('standard_code') ?? 'ELA.9.R.1.1';
  const period = searchParams.get('period') ?? 'Selected period';
  const title = searchParams.get('title') ?? standardCode;
  const subSkillId = searchParams.get('sub_skill_id') ?? '';
  const accuracy = searchParams.get('accuracy') ?? '';
  const misses = searchParams.get('misses') ?? '';
  const [lesson, setLesson] = useState<LessonLaunch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [projectorMode, setProjectorMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const launchUrl = useMemo(() => {
    const params = new URLSearchParams({
      standard_code: standardCode,
      period,
      title,
    });
    if (accuracy) params.set('accuracy', accuracy);
    if (misses) params.set('misses', misses);
    if (subSkillId) params.set('sub_skill_id', subSkillId);
    return `/api/teacher/lesson-launch?${params.toString()}`;
  }, [accuracy, misses, period, standardCode, subSkillId, title]);

  useEffect(() => {
    let cancelled = false;
    async function loadLesson() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(launchUrl, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not build lesson.');
        if (!cancelled) setLesson(json.lesson);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not build lesson.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadLesson();
    return () => {
      cancelled = true;
    };
  }, [launchUrl]);

  const slides = useMemo<LessonSlide[]>(() => [], []);
  const currentSlide = slides[Math.min(currentSlideIndex, Math.max(0, slides.length - 1))] ?? null;

  return (
    <main style={{ background: '#F8FAFC', minHeight: '100vh', paddingBottom: 60 }}>
      <TeacherDashboardTopBar />
      <div style={{ fontFamily: FONTS.ui, margin: '0 auto', maxWidth: 1280, padding: 22 }}>
        {loading ? (
          <div style={projectorSectionStyle()}>
            <Loader2 className="animate-spin" />
            <p style={{ color: C.gray, fontSize: 16, fontWeight: 850 }}>Building the board-ready lesson...</p>
          </div>
        ) : error ? (
          <div style={projectorSectionStyle(C.red)}>
            <h1 style={{ color: C.dark, fontSize: 32, margin: 0 }}>Lesson could not launch</h1>
            <p style={{ color: C.red, fontSize: 16, fontWeight: 850 }}>{error}</p>
          </div>
        ) : lesson ? (
          <>
            {projectorMode && currentSlide ? (
              <div
                style={{
                  background: '#0B1220',
                  bottom: 0,
                  left: 0,
                  padding: 18,
                  position: 'fixed',
                  right: 0,
                  top: 0,
                  zIndex: 50,
                }}
              >
                <section
                  style={{
                    ...projectorSectionStyle(zoneStyle(currentSlide.zone).border),
                    background: zoneStyle(currentSlide.zone).bg,
                    color: zoneStyle(currentSlide.zone).text,
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    height: 'calc(100vh - 36px)',
                    margin: 0,
                    overflow: 'hidden',
                    padding: 28,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                    <div>
                      <div
                        style={{
                          color:
                            currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                              ? '#CBD5E1'
                              : C.blue,
                          fontSize: 15,
                          fontWeight: 1000,
                          letterSpacing: 1.1,
                        }}
                      >
                        {lesson.periodLabel} · {currentSlide.title}
                      </div>
                      <h2
                        style={{
                          color: zoneStyle(currentSlide.zone).text,
                          fontSize: currentSlide.zone === 'TITLE' ? 58 : 46,
                          lineHeight: 1.04,
                          margin: '10px 0 8px',
                        }}
                      >
                        {currentSlide.heading}
                      </h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <span
                        style={{
                          background:
                            currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                              ? C.white
                              : '#FEF3C7',
                          borderRadius: 999,
                          color: C.dark,
                          fontSize: 16,
                          fontWeight: 1000,
                          padding: '8px 14px',
                        }}
                      >
                        {currentSlide.minutes}
                      </span>
                      <span
                        style={{
                          background:
                            currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                              ? 'rgba(255,255,255,0.12)'
                              : '#EFF6FF',
                          borderRadius: 7,
                          color:
                            currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                              ? C.white
                              : C.blue,
                          fontSize: 13,
                          fontWeight: 1000,
                          padding: '8px 13px',
                        }}
                      >
                        {lesson.standardCode}
                      </span>
                      <span
                        style={{
                          color:
                            currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                              ? '#CBD5E1'
                              : C.gray,
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        {currentSlide.number} / {slides.length}
                      </span>
                    </div>
                  </div>

                  <div style={{ minHeight: 0, overflowY: 'auto', paddingRight: 8 }}>
                    {currentSlide.passage ? (
                      <div
                        style={{
                          background: C.white,
                          border: `3px solid ${currentSlide.zone === 'PASSAGE' ? '#F2C14E' : C.dark}`,
                          borderRadius: 8,
                          color: C.dark,
                          fontFamily: FONTS.passage,
                          fontSize: 31,
                          lineHeight: 1.42,
                          marginTop: 18,
                          padding: 22,
                        }}
                      >
                        <div
                          style={{
                            color: C.blue,
                            fontFamily: FONTS.ui,
                            fontSize: 17,
                            fontWeight: 1000,
                            marginBottom: 10,
                          }}
                        >
                          {currentSlide.passage.selection} · {currentSlide.passage.exactLinesOrParagraphs}
                        </div>
                        {paragraphBreaks(currentSlide.passage.excerpt).map((paragraph) => (
                          <p key={paragraph.slice(0, 48)} style={{ margin: '0 0 16px' }}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    {currentSlide.table ? (
                      <div
                        style={{
                          background: C.white,
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          color: C.dark,
                          marginTop: 18,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '0.7fr 1fr 1.2fr',
                            background: '#EFF6FF',
                            color: C.blue,
                            fontSize: 16,
                            fontWeight: 1000,
                          }}
                        >
                          <div style={{ padding: 12 }}>ELEMENT</div>
                          <div style={{ padding: 12 }}>EVIDENCE</div>
                          <div style={{ padding: 12 }}>EFFECT</div>
                        </div>
                        {currentSlide.table.map((row, index) => (
                          <div
                            key={`${row.evidence}-${index}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '0.7fr 1fr 1.2fr',
                              borderTop: `1px solid ${C.border}`,
                              fontSize: 20,
                              fontWeight: 850,
                              lineHeight: 1.35,
                            }}
                          >
                            <div style={{ padding: 12 }}>{row.element}</div>
                            <div style={{ padding: 12 }}>“{row.evidence}”</div>
                            <div style={{ padding: 12 }}>{row.effect}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {currentSlide.body.length ? (
                      <div style={{ display: 'grid', gap: 13, marginTop: 18 }}>
                        {currentSlide.body.map((item) => (
                          <div
                            key={item}
                            style={{
                              color: zoneStyle(currentSlide.zone).text,
                              fontSize: currentSlide.zone === 'TITLE' ? 30 : 29,
                              fontWeight: 850,
                              lineHeight: 1.3,
                            }}
                          >
                            {currentSlide.zone === 'TITLE' ? null : (
                              <CheckCircle2
                                size={22}
                                color={currentSlide.zone === 'PASSAGE' ? '#F2C14E' : C.green}
                              />
                            )}{' '}
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {currentSlide.question ? (
                      <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                        {currentSlide.question.choices.map((choice) => (
                          <div
                            key={choice.label}
                            style={{
                              background: C.white,
                              border: `2px solid ${showAnswerKey && choice.correct ? C.green : C.border}`,
                              borderRadius: 8,
                              color: showAnswerKey && choice.correct ? C.green : C.dark,
                              fontSize: 26,
                              fontWeight: 900,
                              lineHeight: 1.32,
                              padding: 16,
                            }}
                          >
                            {choice.label}. {choice.text}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      alignItems: 'center',
                      display: 'grid',
                      gap: 12,
                      gridTemplateColumns: '1fr auto',
                      marginTop: 16,
                    }}
                  >
                    <div
                      style={{
                        background:
                          currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                            ? 'rgba(255,255,255,0.1)'
                            : '#FFF8E1',
                        border: `2px solid ${
                          currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                            ? 'rgba(255,255,255,0.18)'
                            : '#F2C14E'
                        }`,
                        borderRadius: 8,
                        color:
                          currentSlide.zone === 'TITLE' || currentSlide.zone === 'PASSAGE'
                            ? C.white
                            : C.dark,
                        fontSize: 25,
                        fontWeight: 1000,
                        lineHeight: 1.25,
                        padding: 16,
                      }}
                    >
                      ✎ {currentSlide.task}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setCurrentSlideIndex((index) => Math.max(index - 1, 0))}
                        style={{
                          background: C.white,
                          border: `1px solid ${C.border}`,
                          borderRadius: 999,
                          color: C.dark,
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 950,
                          padding: '10px 14px',
                        }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentSlideIndex((index) => Math.min(index + 1, slides.length - 1))}
                        style={{
                          background: C.blue,
                          border: `1px solid ${C.blue}`,
                          borderRadius: 999,
                          color: C.white,
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 950,
                          padding: '10px 14px',
                        }}
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAnswerKey((value) => !value)}
                        style={{
                          background: showAnswerKey ? C.dark : C.white,
                          border: `1px solid ${C.border}`,
                          borderRadius: 999,
                          color: showAnswerKey ? C.white : C.dark,
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 950,
                          padding: '10px 14px',
                        }}
                      >
                        {showAnswerKey ? 'Hide key' : 'Show key'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectorMode(false)}
                        style={{
                          background: '#111827',
                          border: '1px solid #111827',
                          borderRadius: 999,
                          color: C.white,
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 950,
                          padding: '10px 14px',
                        }}
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            <div style={{ position: 'sticky', top: 0, zIndex: 3, background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, padding: '10px 0' }}>
              <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                    GOGI LESSON WORKSPACE
                  </div>
                  <div style={{ color: C.dark, fontSize: 18, fontWeight: 1000 }}>
                    {lesson.periodLabel} · {lesson.standardCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnswerKey((value) => !value)}
                  style={{
                    background: showAnswerKey ? C.dark : C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 999,
                    color: showAnswerKey ? C.white : C.dark,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 950,
                    padding: '9px 13px',
                  }}
                >
                  {showAnswerKey ? 'Teacher key visible' : 'Show answer key'}
                </button>
              </div>
            </div>

            <SkillLessonCard lesson={lesson} />
            <LessonBellRinger lesson={lesson} />
            <LessonRoutine lesson={lesson} showAnswerKey={showAnswerKey} />

            {slides.map((slide) => {
              const style = zoneStyle(slide.zone);
              return (
                <section
                  id={`slide-${slide.number}`}
                  key={slide.number}
                  style={{
                    ...projectorSectionStyle(style.border),
                    background: style.bg,
                    color: style.text,
                    minHeight: '72vh',
                    scrollMarginTop: 70,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                    <div>
                      <div style={{ color: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? '#CBD5E1' : C.blue, fontSize: 13, fontWeight: 1000, letterSpacing: 1.1 }}>
                        {lesson.periodLabel} · {slide.title}
                      </div>
                      <h2 style={{ color: style.text, fontSize: slide.zone === 'TITLE' ? 48 : 38, lineHeight: 1.08, margin: '10px 0 8px' }}>
                        {slide.heading}
                      </h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <span style={{ background: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? C.white : '#FEF3C7', borderRadius: 999, color: C.dark, fontSize: 14, fontWeight: 1000, padding: '7px 12px' }}>
                        {slide.minutes}
                      </span>
                      <span style={{ background: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? 'rgba(255,255,255,0.12)' : '#EFF6FF', borderRadius: 7, color: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? C.white : C.blue, fontSize: 12, fontWeight: 1000, padding: '7px 12px' }}>
                        {lesson.standardCode}
                      </span>
                      <span style={{ background: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? 'rgba(255,255,255,0.12)' : '#EFF6FF', borderRadius: 7, color: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? C.white : C.blue, fontSize: 12, fontWeight: 1000, padding: '7px 12px' }}>
                        {style.stamp}
                      </span>
                      <span style={{ color: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? '#CBD5E1' : C.gray, fontSize: 12, fontWeight: 900 }}>
                        {slide.number} / {slides.length}
                      </span>
                    </div>
                  </div>

                  {slide.passage ? (
                    <div style={{ background: C.white, border: `3px solid ${slide.zone === 'PASSAGE' ? '#F2C14E' : C.dark}`, borderRadius: 8, color: C.dark, fontFamily: FONTS.passage, fontSize: 25, lineHeight: 1.45, marginTop: 18, padding: 22 }}>
                      <div style={{ color: C.blue, fontFamily: FONTS.ui, fontSize: 15, fontWeight: 1000, marginBottom: 10 }}>
                        {slide.passage.selection} · {slide.passage.exactLinesOrParagraphs}
                      </div>
                      {paragraphBreaks(slide.passage.excerpt).map((paragraph) => (
                        <p key={paragraph.slice(0, 48)} style={{ margin: '0 0 16px' }}>{paragraph}</p>
                      ))}
                    </div>
                  ) : null}

                  {slide.table ? (
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, color: C.dark, marginTop: 18, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 1.2fr', background: '#EFF6FF', color: C.blue, fontSize: 14, fontWeight: 1000 }}>
                        <div style={{ padding: 10 }}>ELEMENT</div>
                        <div style={{ padding: 10 }}>EVIDENCE</div>
                        <div style={{ padding: 10 }}>EFFECT</div>
                      </div>
                      {slide.table.map((row, index) => (
                        <div key={`${row.evidence}-${index}`} style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 1.2fr', borderTop: `1px solid ${C.border}`, fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>
                          <div style={{ padding: 10 }}>{row.element}</div>
                          <div style={{ padding: 10 }}>“{row.evidence}”</div>
                          <div style={{ padding: 10 }}>{row.effect}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {slide.body.length ? (
                    <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                      {slide.body.map((item) => (
                        <div key={item} style={{ color: style.text, fontSize: slide.zone === 'TITLE' ? 24 : 23, fontWeight: 850, lineHeight: 1.35 }}>
                          {slide.zone === 'TITLE' ? null : <CheckCircle2 size={19} color={slide.zone === 'PASSAGE' ? '#F2C14E' : C.green} />} {item}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {slide.question ? (
                    <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                      {slide.question.choices.map((choice) => (
                        <div
                          key={choice.label}
                          style={{
                            background: C.white,
                            border: `2px solid ${showAnswerKey && choice.correct ? C.green : C.border}`,
                            borderRadius: 8,
                            color: showAnswerKey && choice.correct ? C.green : C.dark,
                            fontSize: 22,
                            fontWeight: 900,
                            lineHeight: 1.35,
                            padding: 14,
                          }}
                        >
                          {choice.label}. {choice.text}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ background: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? 'rgba(255,255,255,0.1)' : '#FFF8E1', border: `2px solid ${slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? 'rgba(255,255,255,0.18)' : '#F2C14E'}`, borderRadius: 8, color: slide.zone === 'TITLE' || slide.zone === 'PASSAGE' ? C.white : C.dark, fontSize: 20, fontWeight: 1000, lineHeight: 1.35, marginTop: 20, padding: 16 }}>
                    ✎ {slide.task}
                  </div>
                </section>
              );
            })}
          </>
        ) : null}
      </div>
    </main>
  );
}
