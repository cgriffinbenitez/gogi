import fs from 'fs/promises';
import path from 'path';
import type { OfficialExcerptCandidate, OfficialExcerptInventory } from '@/lib/teacher/officialExcerptInventory';
import { auditOfficialExcerptInventory } from '@/lib/teacher/officialExcerptInventoryAudit';

export type OfficialAutoGoldCard = {
  id: string;
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  wordCount: number;
  whyThisWorks: string;
  skillStrategy: string;
  evidencePoints: string[];
  question: string;
  choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
  auditLabel: 'auto-ready';
};

export type OfficialAutoGoldCardText = {
  title: string;
  author: string | null;
  cards: OfficialAutoGoldCard[];
  cardCount: number;
};

export type OfficialAutoGoldCardCorpus = {
  generatedAt: string;
  summary: {
    autoReadyCards: number;
    textsWithAutoReadyCards: number;
    standardsRepresented: number;
  };
  texts: OfficialAutoGoldCardText[];
};

const INVENTORY_PATH = path.join(process.cwd(), 'data', 'official-text-library', 'teachable-excerpt-inventory.json');

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(value: string) {
  return normalize(value).replace(/\s+/g, '-').slice(0, 80);
}

function candidateKey(candidate: Pick<OfficialExcerptCandidate, 'textTitle' | 'textAuthor' | 'standardCode' | 'subSkillLabel' | 'location'>) {
  return `${candidate.textTitle}::${candidate.textAuthor ?? ''}::${candidate.standardCode}::${candidate.subSkillLabel}::${candidate.location}`;
}

function sentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 20);
}

function tokenHits(haystack: string, needle: string) {
  const normalizedHaystack = normalize(haystack);
  return normalize(needle)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && normalizedHaystack.includes(token)).length;
}

function evidencePointsFor(candidate: OfficialExcerptCandidate) {
  const scored = sentences(candidate.excerpt)
    .map((sentence) => ({
      sentence,
      score: candidate.evidenceSignals.reduce((sum, signal) => sum + tokenHits(sentence, signal), 0),
    }))
    .sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length);

  const best = scored.filter((item) => item.score > 0).slice(0, 3).map((item) => item.sentence);
  if (best.length >= 2) return best;
  return [...best, ...scored.slice(0, 3 - best.length).map((item) => item.sentence)].slice(0, 3);
}

function compact(value: string, max = 86) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function hasCleanClassroomText(candidate: OfficialExcerptCandidate) {
  const text = candidate.excerpt;
  if (!/[.!?"'”’]\s*$/.test(text.trim())) return false;
  if (/\[[^\]]*(?:\.\.\.|until|missing|illegible|fragment)[^\]]*\]/i.test(text) || /\.{6,}/.test(text)) return false;
  if (/[A-Za-z]¬\s+[A-Za-z]/.test(text)) return false;
  if (/\b[A-Za-z]+-\s+[a-z]/.test(text)) return false;
  if (/\btranslator|editor|preface|introduction|appendix|corrections to the text|original tale\b/i.test(text)) return false;
  if (/\bLine\s+\d+\.|\bl\.\s*\d+|Tablet\s+[IVXLC\d]+|Yale tablet|Assyrian version|parallel passage|Langdon|ideograph|variant reading|misreading|erroneous reading|note\s+\d+\s+on page/i.test(text)) return false;
  if (/(?:^|\s)_[^_\s][^_]{1,40}_(?:\s|$)/.test(text) && /\b(version|tablet|line|reading|text|note|passage)\b/i.test(text)) return false;
  if (/\b(born|died)\s+(?:about\s+)?\d{3,4}\b/i.test(text)) return false;
  return true;
}

function strategyFor(candidate: OfficialExcerptCandidate) {
  const label = candidate.subSkillLabel.toLowerCase();
  if (candidate.standardCode === 'ELA.9.R.3.2') {
    return 'Break the sentence into chunks, restate each chunk in plain language, then check that the meaning did not change.';
  }
  if (candidate.standardCode.startsWith('ELA.9.V.')) {
    return 'Use the surrounding words as clues, test the meaning in the sentence, then choose the meaning that keeps the author’s idea intact.';
  }
  if (label.includes('setting')) {
    return 'Name the setting detail, describe the feeling or pressure it creates, then connect that effect to the conflict or meaning.';
  }
  if (label.includes('character')) {
    return 'Point to what the character says, thinks, or does, then explain what that reveals about the character or theme.';
  }
  if (label.includes('theme')) {
    return 'Turn the topic into a message about people or life, then prove it with exact evidence from the excerpt.';
  }
  if (label.includes('structure')) {
    return 'Name how the part is organized, then explain what job that organization does for the author’s purpose.';
  }
  if (label.includes('evidence') || label.includes('support') || label.includes('central')) {
    return 'Identify the central idea, find the strongest support, then explain how the support develops the idea.';
  }
  if (label.includes('rhetoric') || label.includes('appeal') || label.includes('purpose')) {
    return 'Name the rhetorical move, identify the intended reader effect, then connect it to the author’s purpose.';
  }
  return 'Name the evidence, explain what it suggests, then connect it to the standard skill instead of summarizing.';
}

function questionStemFor(candidate: OfficialExcerptCandidate, evidence: string[]) {
  const label = candidate.subSkillLabel.toLowerCase();
  const anchor = evidence[0] ? compact(evidence[0], 92) : 'this detail';
  const second = evidence[1] ? compact(evidence[1], 72) : anchor;

  if (candidate.standardCode === 'ELA.9.R.1.1') {
    if (label.includes('setting')) return `How does the setting detail "${anchor}" help shape the mood, conflict, or meaning of the passage?`;
    if (label.includes('character')) return `What does the detail "${anchor}" reveal about the character’s role or motives?`;
    if (label.includes('plot') || label.includes('conflict')) return `How does the conflict or consequence in "${anchor}" add tension or meaning to the passage?`;
    if (label.includes('point of view')) return `How does the viewpoint in "${anchor}" shape what the reader understands about the situation?`;
    if (label.includes('style')) return `How does the author’s word choice in "${anchor}" affect the style or meaning of the passage?`;
    return `How does the detail "${anchor}" add a layer of meaning or style to the passage?`;
  }
  if (candidate.standardCode === 'ELA.9.R.1.2') return `How does the detail "${anchor}" help develop a larger theme in the passage?`;
  if (candidate.standardCode === 'ELA.9.R.1.3') return `How does the contrast between "${anchor}" and "${second}" shape the reader’s understanding of irony, satire, or perspective?`;
  if (candidate.standardCode === 'ELA.9.R.1.4') return `How does "${anchor}" help develop an epic character, structure, or theme?`;
  if (candidate.standardCode === 'ELA.9.R.2.1') return `How does the organization around "${anchor}" help convey the author’s purpose or meaning?`;
  if (candidate.standardCode === 'ELA.9.R.2.2') return `How does the evidence in "${anchor}" help develop the central idea of the passage?`;
  if (candidate.standardCode === 'ELA.9.R.2.3') return `How does the author use "${anchor}" to appeal to the reader or achieve a purpose?`;
  if (candidate.standardCode === 'ELA.9.R.2.4') return `How does the claim or evidence in "${anchor}" help develop or evaluate one side of the argument?`;
  if (candidate.standardCode === 'ELA.9.R.3.1') return `How does the language in "${anchor}" help create or shift the mood of the passage?`;
  if (candidate.standardCode === 'ELA.9.R.3.2') return `Which statement best paraphrases the idea in "${anchor}" without changing its meaning?`;
  if (candidate.standardCode === 'ELA.9.R.3.4') return `How does the author’s rhetoric in "${anchor}" affect the reader?`;
  if (candidate.standardCode.startsWith('ELA.9.V.')) return `How does the context around "${anchor}" help clarify meaning?`;
  return `How does the detail "${anchor}" develop the standard skill?`;
}

function evidenceProfile(value: string) {
  const text = normalize(value);
  if (/\b(fear|afraid|terror|dread|trembl|anxious|danger|threat|storm|death|fatal|fury|furious|rage|wrath)\b/.test(text)) {
    return {
      trait: 'fear, danger, anger, or urgency',
      mood: 'dangerous or tense',
      theme: 'pressure reveals what people value or fear',
      opposite: 'calm and secure',
    };
  }
  if (/\b(honou?r|fame|duty|country|king|gods|pray|vow|sacrifice|pious|divine|heaven|jove|minerva|juno)\b/.test(text)) {
    return {
      trait: 'duty, honor, faith, or loyalty',
      mood: 'serious or ceremonial',
      theme: 'duty and loyalty shape difficult choices',
      opposite: 'careless and selfish',
    };
  }
  if (/\b(grief|tears|weep|mourn|sorrow|pity|mercy|love|heart|sad|pain)\b/.test(text)) {
    return {
      trait: 'grief, compassion, love, or emotional conflict',
      mood: 'sorrowful or reflective',
      theme: 'loss and compassion change how people act',
      opposite: 'unfeeling and detached',
    };
  }
  if (/\b(swift|haste|hurry|rush|sudden|at once|immediate|quick|flew|advance|charge)\b/.test(text)) {
    return {
      trait: 'urgency, determination, or bold action',
      mood: 'fast-moving or suspenseful',
      theme: 'decisive action can change the direction of events',
      opposite: 'slow and uncertain',
    };
  }
  if (/\b(reason|therefore|because|cause|effect|result|evidence|prove|support|claim|argu|answer|question)\b/.test(text)) {
    return {
      trait: 'reasoning, support, or explanation',
      mood: 'logical or persuasive',
      theme: 'claims become stronger when they are supported by evidence',
      opposite: 'unsupported and unrelated',
    };
  }
  return {
    trait: 'pressure, motive, or change',
    mood: 'important or unsettled',
    theme: 'specific details reveal deeper meaning',
    opposite: 'simple and unimportant',
  };
}

function correctAnswerFor(candidate: OfficialExcerptCandidate, evidence: string[]) {
  const label = candidate.subSkillLabel.toLowerCase();
  const anchor = compact(evidence[0] ?? candidate.excerpt);
  const profile = evidenceProfile(`${anchor} ${candidate.excerpt}`);
  if (candidate.standardCode === 'ELA.9.R.3.2') {
    return `The passage says that an important action or problem is happening, and the paraphrase must keep that meaning clear.`;
  }
  if (candidate.standardCode.startsWith('ELA.9.V.')) {
    return `The surrounding context shows the word is connected to the passage’s main action or attitude.`;
  }
  if (label.includes('setting')) {
    return `The description makes the setting feel ${profile.mood}, which prepares the reader for pressure, conflict, or meaning.`;
  }
  if (label.includes('character')) {
    return `The evidence reveals ${profile.trait}, so the character feels more complex than a simple plot figure.`;
  }
  if (label.includes('plot') || label.includes('conflict')) {
    return `The moment raises the stakes because danger, choice, or consequence changes what can happen next.`;
  }
  if (label.includes('theme')) {
    return `The evidence points to the larger idea that ${profile.theme}.`;
  }
  if (label.includes('structure')) {
    return `The paragraph moves from one idea or action to another so the reader can see a cause, shift, contrast, or result.`;
  }
  if (label.includes('evidence') || label.includes('support') || label.includes('central')) {
    return `The evidence strengthens the central idea by showing a specific reason, example, result, or consequence.`;
  }
  if (label.includes('rhetoric') || label.includes('appeal') || label.includes('purpose')) {
    return `The language pushes the reader toward the author’s purpose by shaping trust, emotion, logic, or urgency.`;
  }
  if (label.includes('figurative') || label.includes('mood')) {
    return `The language creates a ${profile.mood} mood that changes how the reader experiences the scene.`;
  }
  return `The detail changes how the reader understands the passage because it adds meaning beyond the literal action.`;
}

function distractorsFor(candidate: OfficialExcerptCandidate, evidence: string[]) {
  const label = candidate.subSkillLabel.toLowerCase();
  const anchor = compact(evidence[0] ?? candidate.excerpt, 68);
  const second = compact(evidence[1] ?? evidence[0] ?? candidate.excerpt, 68);
  const profile = evidenceProfile(`${anchor} ${second} ${candidate.excerpt}`);
  if (candidate.standardCode === 'ELA.9.R.3.2') {
    return [
      `The scene is mainly about a peaceful moment where no important pressure or change appears.`,
      `The central problem is completely solved before the passage creates any tension.`,
      `The passage is mostly a list of background facts that do not connect to a larger idea.`,
    ];
  }
  if (candidate.standardCode.startsWith('ELA.9.V.')) {
    return [
      `The word means nearly the opposite of the attitude created by the surrounding sentence.`,
      `The context shows the word is unrelated to the passage’s main action or idea.`,
      `The word is best understood by its spelling alone, not by the nearby context.`,
    ];
  }
  if (label.includes('structure')) {
    return [
      `The paragraph is arranged randomly, so no cause, contrast, shift, or result can be traced.`,
      `The organization mainly hides the author’s purpose instead of helping the reader follow it.`,
      `The structure removes the relationship between the ideas and makes each sentence stand alone.`,
    ];
  }
  if (label.includes('theme')) {
    return [
      `The passage suggests that actions have no consequences for characters or communities.`,
      `The theme is only that events happen in order, with no broader message about life or people.`,
      `The passage avoids a larger idea and focuses only on a location or object.`,
    ];
  }
  if (label.includes('rhetoric') || label.includes('appeal') || label.includes('purpose')) {
    return [
      `The language stays neutral and does not try to affect the reader’s thinking or feeling.`,
      `The author weakens the purpose by avoiding evidence, emotion, credibility, or reasoning.`,
      `The passage mainly entertains with unrelated description instead of supporting a purpose.`,
    ];
  }
  if (label.includes('setting')) {
    return [
      `The place feels ${profile.opposite}, so it lowers the tension instead of building it.`,
      `The setting only names where the action happens and does not affect mood or meaning.`,
      `The description shows that the conflict has already been solved before the action begins.`,
    ];
  }
  if (label.includes('character')) {
    return [
      `The character is presented as ${profile.opposite}, so no motive or pressure is revealed.`,
      `The passage gives no useful clue about motive, trait, role, or relationship.`,
      `The character is mainly described through the location rather than words, choices, or actions.`,
    ];
  }
  if (label.includes('plot') || label.includes('conflict')) {
    return [
      `The moment removes tension because the problem is solved before any choice matters.`,
      `The event is only background information and does not change the situation.`,
      `The conflict shifts away from the passage and becomes unrelated to the characters.`,
    ];
  }
  return [
    `The passage only repeats background information and does not change the reader’s understanding.`,
    `The detail points away from the main idea instead of developing it.`,
    `The moment makes the passage less specific by removing conflict, mood, or purpose.`,
  ];
}

function choicesFor(candidate: OfficialExcerptCandidate, evidence: string[]) {
  const choices = [
    { label: 'A' as const, text: correctAnswerFor(candidate, evidence), correct: true },
    ...distractorsFor(candidate, evidence).map((text, index) => ({
      label: ['B', 'C', 'D'][index] as 'B' | 'C' | 'D',
      text,
      correct: false,
    })),
  ];
  const rotation = Math.abs(candidate.location.length + candidate.subSkillId.length) % 4;
  const rotated = [...choices.slice(rotation), ...choices.slice(0, rotation)];
  return rotated.map((choice, index) => ({ ...choice, label: ['A', 'B', 'C', 'D'][index] as 'A' | 'B' | 'C' | 'D' }));
}

function hasClassroomReadyItem(candidate: OfficialExcerptCandidate, question: string, choices: Array<{ text: string }>) {
  // Deterministic templates can mine and sort excerpts, but they are not trusted as final FAST item writers.
  // Finished cards should come from locked gold cards or the Claude-authored batch generator.
  return false;
  const combinedChoices = choices.map((choice) => choice.text).join(' ');
  if (
    /\b(It uses|It organizes|It lists|It treats|It gives a true detail|It makes a claim|It focuses on|in a way the excerpt does not develop|without using the excerpt’s exact evidence|only summarizes what happens)\b/i.test(
      combinedChoices
    )
  ) {
    return false;
  }
  if (candidate.standardCode === 'ELA.9.R.3.3') {
    return false;
  }
  if (
    candidate.standardCode === 'ELA.9.R.3.2' &&
    /\b(It restates|It changes the meaning|It copies words|It focuses on a smaller detail|without changing the author’s meaning)\b/i.test(
      combinedChoices
    )
  ) {
    return false;
  }
  if (
    /\b(this excerpt|the excerpt|this passage|the passage)\b/i.test(question) &&
    !/"[^"]{8,}"/.test(question) &&
    !/\b(paragraph|line|claim|word|phrase|detail|evidence|setting|speaker|narrator|character|author)\b/i.test(question)
  ) {
    return false;
  }
  return true;
}

async function loadInventory() {
  return JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8')) as OfficialExcerptInventory;
}

export async function buildOfficialAutoGoldCardCorpus(): Promise<OfficialAutoGoldCardCorpus> {
  const inventory = await loadInventory();
  const audit = await auditOfficialExcerptInventory(inventory);
  const hardRejects = new Set(
    audit.issues
      .filter(
        (issue) =>
          issue.severity === 'blocker' ||
          /too short|too long|OCR|hyphenation|editorial|biographical|bracketed gaps|heavy ellipsis|cut off/i.test(
            issue.issue
          )
      )
      .map((issue) => `${issue.textTitle}::${issue.textAuthor ?? ''}::${issue.standardCode}::${issue.subSkillLabel}::${issue.location}`)
  );

  const texts: OfficialAutoGoldCardText[] = inventory.texts.map((text) => {
    const cards = text.candidates
      .filter((candidate) => !hardRejects.has(candidateKey(candidate)))
      .filter((candidate) => hasCleanClassroomText(candidate))
      .flatMap((candidate) => {
        const evidencePoints = evidencePointsFor(candidate);
        const id = slug(
          `${candidate.textTitle}-${candidate.standardCode}-${candidate.subSkillId}-${candidate.location}`
        );
        const question = questionStemFor(candidate, evidencePoints);
        const choices = choicesFor(candidate, evidencePoints);
        if (!hasClassroomReadyItem(candidate, question, choices)) return [];
        return [{
          id,
          textTitle: candidate.textTitle,
          textAuthor: candidate.textAuthor,
          standardCode: candidate.standardCode,
          standardTitle: candidate.standardTitle,
          subSkillId: candidate.subSkillId,
          subSkillLabel: candidate.subSkillLabel,
          location: candidate.location,
          excerpt: candidate.excerpt,
          wordCount: candidate.wordCount,
          whyThisWorks: candidate.justification,
          skillStrategy: strategyFor(candidate),
          evidencePoints,
          question,
          choices,
          auditLabel: 'auto-ready' as const,
        }];
      });

    return {
      title: text.title,
      author: text.author,
      cards,
      cardCount: cards.length,
    };
  });

  const autoReadyCards = texts.reduce((sum, text) => sum + text.cardCount, 0);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      autoReadyCards,
      textsWithAutoReadyCards: texts.filter((text) => text.cardCount > 0).length,
      standardsRepresented: new Set(texts.flatMap((text) => text.cards.map((card) => card.standardCode))).size,
    },
    texts: texts.sort((a, b) => b.cardCount - a.cardCount || a.title.localeCompare(b.title)),
  };
}

export function officialAutoGoldCardsMarkdown(corpus: OfficialAutoGoldCardCorpus) {
  const lines = [
    '# GOGI Auto-Ready Gold Cards',
    '',
    `Generated: ${corpus.generatedAt}`,
    `Auto-ready cards: ${corpus.summary.autoReadyCards}`,
    `Texts with auto-ready cards: ${corpus.summary.textsWithAutoReadyCards}`,
    `Standards represented: ${corpus.summary.standardsRepresented}`,
    '',
    '## Coverage',
    '',
    '| Text | Auto-Ready Cards |',
    '| --- | ---: |',
  ];

  for (const text of corpus.texts) {
    lines.push(`| ${text.title}${text.author ? ` — ${text.author}` : ''} | ${text.cardCount} |`);
  }

  lines.push('');
  lines.push('## Cards');
  lines.push('');

  for (const text of corpus.texts.filter((item) => item.cardCount > 0)) {
    lines.push(`### ${text.title}${text.author ? ` — ${text.author}` : ''}`);
    for (const card of text.cards) {
      lines.push(`- ${card.standardCode} / ${card.subSkillLabel} / ${card.location}: ${card.question}`);
      lines.push(`  - Why: ${card.whyThisWorks}`);
      lines.push(`  - Evidence: ${card.evidencePoints.join(' | ')}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
