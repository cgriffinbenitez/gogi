import type { Paragraph, PipelineOptions } from '../types';

export type TeachingMomentMiningResult = {
  accepted: boolean;
  qualitySignal: 'strong_signal' | 'emerging_signal' | 'not_enough_data';
  targetEvidence?: string;
  skillMove?: string;
  teachingPoint?: string;
  studentMisconception?: string;
  scaffoldPrompt?: string;
  suggestedFastStem?: string;
  reasons: string[];
  warnings?: string[];
};

type EvidenceMatch = {
  text: string;
  index: number;
  reason: string;
  strength: number;
};

const HUMAN_ACTIONS =
  /(waited|whispered|called|confronted|asked|demanded|remembered|watched|listened|leaned|reached|gathered|slept|woke|accused|threatened|welcomed|refused|held|clung|pressed)/i;

const NONHUMAN_SUBJECTS =
  /(room|house|fire|fireplace|embers|table|chair|furniture|window|door|silence|quiet|wind|tree|pine|oak|forest|woods|sky|dawn|night|moon|sun|light|shadow|letter|paper|road|path|sea|water|field|garden|bell|voice|storm)/i;

const SENSORY_WORDS =
  /\b(bright|dark|dim|pale|gray|red|blue|gold|cold|warm|hot|icy|soft|rough|sharp|sweet|bitter|sour|smell|scent|sound|silent|quiet|loud|whisper|roar|glitter|gleam|shadow|light|mist|fog|smoke|crack|rustle|tremble|thick|thin)\b/gi;

const ABSTRACT_OR_EFFECT_WORDS =
  /(fear|danger|guilt|hope|lonely|alone|free|freedom|trapped|heavy|uneasy|peace|peaceful|calm|wild|strange|mystery|secret|joy|sad|grief|shame|wonder|threat|safe|power|pride|anxiety|restless|suspense|tension)/i;

const KEY_SETTING_OR_OBJECTS =
  /(island|woods|forest|tree|nest|bird|room|house|door|window|path|road|sea|shore|night|light|shadow|storm|garden|field|sky|chateau|gate|vault|barn|fire|table|letter|paper|apple|wings|mask|tomb|bed|wall|floor|roof|farm|cottage)/i;

const CHARACTER_REVEALING_ACTIONS =
  /(refused|hesitated|watched|hid|followed|climbed|turned|remembered|realized|decided|promised|betrayed|protected|searched|listened|stole|gave|kept|opened|closed|ran|fled|questioned|waited|whispered|trembled|laughed|cried|answered|looked|paused|stood|knelt|held|dropped|lifted)/i;

const CHARACTER_TRAIT_OR_CONFLICT_WORDS =
  /(proud|ashamed|afraid|brave|careful|careless|angry|gentle|cruel|kind|lonely|jealous|curious|desperate|determined|secret|conflict|choice|change|decision|wish|wanted|hoped|feared|dared|could not|would not|must|never|again)/i;

const PLOT_SHIFT_WORDS =
  /\b(but|then|suddenly|at last|no longer|instead|until|when|before|after|now|yet|however|therefore|because|although|once|again)\b/i;

const LOW_VALUE_COMPARISONS =
  /\b(seemed|looked|appeared|felt)\s+like\s+(a|an|the)?\s*(place|room|house|man|woman|child|thing|person|one|way)\b/i;

const HIGH_FRICTION =
  /\b(whereon|thereof|perchance|thither|hither|wherefore|whence|facile|larder|cottager)\b/gi;

function compact(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function wordCount(text: string) {
  return compact(text).split(/\s+/).filter(Boolean).length;
}

function sentenceWindows(text: string) {
  const matches = Array.from(text.matchAll(/[^.!?]+[.!?]["']?/g));
  return matches.map((match) => ({
    text: compact(match[0]),
    index: match.index ?? 0,
  }));
}

function contextAround(text: string, matchIndex: number) {
  const sentences = sentenceWindows(text);
  const center = sentences.findIndex((sentence) => {
    const end = sentence.index + sentence.text.length;
    return sentence.index <= matchIndex && end >= matchIndex;
  });
  if (center === -1) return compact(text);

  let start = Math.max(0, center - 2);
  let end = Math.min(sentences.length, center + 3);
  let excerpt = sentences.slice(start, end).map((sentence) => sentence.text).join(' ');

  while (wordCount(excerpt) < 150 && (start > 0 || end < sentences.length)) {
    if (start > 0) start--;
    if (wordCount(sentences.slice(start, end).map((sentence) => sentence.text).join(' ')) >= 150) {
      break;
    }
    if (end < sentences.length) end++;
    excerpt = sentences.slice(start, end).map((sentence) => sentence.text).join(' ');
  }

  excerpt = sentences.slice(start, end).map((sentence) => sentence.text).join(' ');
  return wordCount(excerpt) <= 380 ? excerpt : compact(text);
}

function findComparisonEvidence(text: string): EvidenceMatch[] {
  const matches: EvidenceMatch[] = [];
  const patterns = [
    { re: /\bas if\b[^.!?;]{8,120}/gi, bonus: 1 },
    { re: /\bas though\b[^.!?;]{8,120}/gi, bonus: 1 },
    { re: /\b(?:like|as)\s+(?:a|an|the)?\s*[^,.!?;]{4,80}/gi, bonus: 0 },
    { re: /\b(?:was|were|is|are|became|becomes)\s+(?:a|an|the)\s+[^,.!?;]{3,60}/gi, bonus: 0 },
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.re)) {
      const raw = compact(match[0]);
      if (raw.length < 12 || LOW_VALUE_COMPARISONS.test(raw)) continue;
      const hasEffect = ABSTRACT_OR_EFFECT_WORDS.test(raw) || ABSTRACT_OR_EFFECT_WORDS.test(text);
      matches.push({
        text: raw,
        index: match.index ?? 0,
        reason: hasEffect ? 'comparison carries an inferable effect' : 'comparison is pointable',
        strength: (hasEffect ? 3 : 2) + pattern.bonus,
      });
    }
  }

  return matches;
}

function findPersonificationEvidence(text: string): EvidenceMatch[] {
  const matches: EvidenceMatch[] = [];
  const sentences = sentenceWindows(text);
  for (const sentence of sentences) {
    if (!NONHUMAN_SUBJECTS.test(sentence.text) || !HUMAN_ACTIONS.test(sentence.text)) continue;
    const hit = sentence.text.length <= 180 ? sentence.text : `${sentence.text.slice(0, 177)}...`;
    matches.push({
      text: hit,
      index: sentence.index,
      reason: 'nonhuman subject is given human action or pressure',
      strength: ABSTRACT_OR_EFFECT_WORDS.test(sentence.text) ? 3 : 2,
    });
  }
  return matches;
}

function findImageryEvidence(text: string): EvidenceMatch[] {
  const sentences = sentenceWindows(text);
  const matches: EvidenceMatch[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const window = sentences.slice(i, i + 2).map((sentence) => sentence.text).join(' ');
    const hits = Array.from(window.matchAll(SENSORY_WORDS)).map((match) => match[0].toLowerCase());
    const uniqueHits = new Set(hits);
    if (uniqueHits.size < 3) continue;
    matches.push({
      text: window.length <= 220 ? window : `${window.slice(0, 217)}...`,
      index: sentences[i].index,
      reason: `sensory cluster: ${Array.from(uniqueHits).slice(0, 5).join(', ')}`,
      strength: uniqueHits.size >= 5 ? 3 : 2,
    });
  }
  return matches;
}

function findSymbolEvidence(text: string): EvidenceMatch[] {
  const sentences = sentenceWindows(text);
  const matches: EvidenceMatch[] = [];
  for (const sentence of sentences) {
    if (!/(object|letter|bird|tree|door|window|road|path|light|shadow|fire|room|house)/i.test(sentence.text)) {
      continue;
    }
    if (!ABSTRACT_OR_EFFECT_WORDS.test(sentence.text)) continue;
    matches.push({
      text: sentence.text.length <= 180 ? sentence.text : `${sentence.text.slice(0, 177)}...`,
      index: sentence.index,
      reason: 'concrete detail is tied to an abstract meaning or effect',
      strength: 2,
    });
  }
  return matches;
}

function findSettingOrObjectLayerEvidence(text: string): EvidenceMatch[] {
  const sentences = sentenceWindows(text);
  const matches: EvidenceMatch[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const window = sentences.slice(Math.max(0, i - 1), i + 2).map((sentence) => sentence.text).join(' ');
    if (!KEY_SETTING_OR_OBJECTS.test(window)) continue;
    const sensoryHits = new Set(
      Array.from(window.matchAll(SENSORY_WORDS)).map((match) => match[0].toLowerCase())
    );
    const hasLayer = ABSTRACT_OR_EFFECT_WORDS.test(window) || sensoryHits.size >= 3;
    if (!hasLayer) continue;
    const target = sentences[i].text.length <= 190 ? sentences[i].text : `${sentences[i].text.slice(0, 187)}...`;
    matches.push({
      text: target,
      index: sentences[i].index,
      reason:
        sensoryHits.size >= 3
          ? `setting or object detail carries style through sensory language: ${Array.from(sensoryHits).slice(0, 4).join(', ')}`
          : 'setting or object detail carries a deeper meaning or effect',
      strength: sensoryHits.size >= 4 || ABSTRACT_OR_EFFECT_WORDS.test(sentences[i].text) ? 3 : 2,
    });
  }
  return matches;
}

function findCharacterActionLayerEvidence(text: string): EvidenceMatch[] {
  const sentences = sentenceWindows(text);
  const matches: EvidenceMatch[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const window = sentences.slice(Math.max(0, i - 1), i + 2).map((sentence) => sentence.text).join(' ');
    if (!CHARACTER_REVEALING_ACTIONS.test(sentences[i].text)) continue;
    if (!CHARACTER_TRAIT_OR_CONFLICT_WORDS.test(window) && !ABSTRACT_OR_EFFECT_WORDS.test(window)) continue;
    const target = sentences[i].text.length <= 190 ? sentences[i].text : `${sentences[i].text.slice(0, 187)}...`;
    matches.push({
      text: target,
      index: sentences[i].index,
      reason: 'character action reveals motive, conflict, or characterization beyond the literal event',
      strength: CHARACTER_TRAIT_OR_CONFLICT_WORDS.test(sentences[i].text) ? 3 : 2,
    });
  }
  return matches;
}

function explainPlotLayer(sentence: string, window: string) {
  const context = `${sentence} ${window}`;
  if (/\b(calypso|minerva|jove|juno|apollo|venus|god|goddess|prayer|fate)\b/i.test(context)) {
    return 'a powerful force changes what the character can do next, adding meaning around fate, help, or dependence';
  }
  if (/\b(wind|sail|raft|ship|sea|island|shore|voyage|journey|home|return)\b/i.test(context)) {
    return 'the action turns the setting into movement, pushing the character from one stage of the journey into the next';
  }
  if (/\b(gave|sent|led|opened|closed|spread|guided|left|returned|arrived|escaped|departed)\b/i.test(context)) {
    return 'the action changes the character’s situation instead of merely describing what happened';
  }
  if (/\b(but|however|yet|instead|suddenly|at last|no longer)\b/i.test(sentence)) {
    return 'the shift signals a turn in the scene that changes tension, consequence, or meaning';
  }
  return 'the plot movement creates a consequence or new layer of meaning beyond the literal event';
}

function findPlotShiftLayerEvidence(text: string): EvidenceMatch[] {
  const sentences = sentenceWindows(text);
  const matches: EvidenceMatch[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const window = sentences.slice(Math.max(0, i - 1), i + 2).map((sentence) => sentence.text).join(' ');
    if (!PLOT_SHIFT_WORDS.test(sentences[i].text)) continue;
    if (!CHARACTER_REVEALING_ACTIONS.test(window) && !ABSTRACT_OR_EFFECT_WORDS.test(window)) continue;
    const target = sentences[i].text.length <= 190 ? sentences[i].text : `${sentences[i].text.slice(0, 187)}...`;
    matches.push({
      text: target,
      index: sentences[i].index,
      reason: explainPlotLayer(sentences[i].text, window),
      strength: ABSTRACT_OR_EFFECT_WORDS.test(window) ? 3 : 2,
    });
  }
  return matches;
}

function chooseBest(matches: EvidenceMatch[]) {
  return [...matches].sort((a, b) => b.strength - a.strength || a.text.length - b.text.length)[0];
}

function r31EvidenceForStrand(text: string, strandId?: string, strandLabel?: string) {
  const strand = `${strandId ?? ''} ${strandLabel ?? ''}`.toLowerCase();
  if (/metaphor|simile|comparison/.test(strand)) return chooseBest(findComparisonEvidence(text));
  if (/personification/.test(strand)) return chooseBest(findPersonificationEvidence(text));
  if (/imagery|sensory/.test(strand)) return chooseBest(findImageryEvidence(text));
  if (/allusion|idiom|symbol/.test(strand)) return chooseBest(findSymbolEvidence(text));
  if (/mood|effect/.test(strand)) {
    return chooseBest([
      ...findComparisonEvidence(text),
      ...findPersonificationEvidence(text),
      ...findImageryEvidence(text),
      ...findSymbolEvidence(text),
    ]);
  }
  return chooseBest([
    ...findComparisonEvidence(text),
    ...findPersonificationEvidence(text),
    ...findImageryEvidence(text),
    ...findSymbolEvidence(text),
  ]);
}

function r11EvidenceForStrand(text: string, strandId?: string, strandLabel?: string) {
  const strand = `${strandId ?? ''} ${strandLabel ?? ''}`.toLowerCase();
  const detailMatches = [
    ...findSettingOrObjectLayerEvidence(text),
    ...findSymbolEvidence(text),
    ...findPlotShiftLayerEvidence(text),
  ];
  const styleMatches = [
    ...findSettingOrObjectLayerEvidence(text),
    ...findImageryEvidence(text),
    ...findCharacterActionLayerEvidence(text),
    ...findPlotShiftLayerEvidence(text),
  ];

  if (/literal|detail|layer/.test(strand)) return chooseBest(detailMatches);
  if (/style|meaning|effect/.test(strand)) return chooseBest(styleMatches);
  return chooseBest([...detailMatches, ...styleMatches]);
}

function studentAccessWarnings(text: string) {
  const wc = wordCount(text);
  const warnings: string[] = [];
  if (wc < 120) warnings.push('excerpt is short for a FAST-style reading item');
  if (wc > 390) warnings.push('excerpt is long for a focused Reading Win item');
  const highFrictionHits = new Set(Array.from(text.matchAll(HIGH_FRICTION)).map((match) => match[0].toLowerCase()));
  if (highFrictionHits.size >= 3) {
    warnings.push(
      `high decoding friction before the target skill: ${Array.from(highFrictionHits).join(', ')}`
    );
  }
  return warnings;
}

export function mineTeachingMoment(
  paragraph: Paragraph,
  opts: PipelineOptions
): TeachingMomentMiningResult {
  if (!opts.standardCode) {
    return {
      accepted: true,
      qualitySignal: 'emerging_signal',
      reasons: ['no standard selected; skipped surgical standard mining'],
    };
  }

  const text = compact(paragraph.text);
  const warnings = studentAccessWarnings(text);

  if (opts.standardCode === 'ELA.9.R.3.1') {
    const evidence = r31EvidenceForStrand(text, opts.coverageStrandId, opts.coverageStrandLabel);
    if (!evidence) {
      return {
        accepted: true,
        qualitySignal: warnings.length ? 'not_enough_data' : 'emerging_signal',
        skillMove:
          'Keep the official-aligned passage in the library, then classify which R.3.1 opportunities it can support.',
        teachingPoint:
          'This passage is mapped to the benchmark, but it does not yet prove this exact strand. Do not generate a strand-specific FAST item until a question gate finds pointable evidence.',
        reasons: [
          `official-aligned content kept; no exact ${opts.coverageStrandLabel ?? opts.coverageStrandId ?? 'figurative language'} evidence labeled yet`,
        ],
        warnings,
      };
    }

    const excerpt = contextAround(text, evidence.index);
    const excerptWarnings = studentAccessWarnings(excerpt);

    const strong = evidence.strength >= 3;
    return {
      accepted: true,
      qualitySignal: strong && warnings.length === 0 && excerptWarnings.length === 0 ? 'strong_signal' : 'emerging_signal',
      targetEvidence: evidence.text,
      skillMove:
        'Find the exact figurative language, translate what it literally means, then explain what it does to the scene.',
      teachingPoint:
        'The question should point to one exact phrase and ask what that phrase suggests or creates in context.',
      studentMisconception:
        'The student may name the device or choose a nearby detail without explaining the effect of the exact wording.',
      scaffoldPrompt: `Reread this exact wording: "${evidence.text}". What is being compared or given human quality, and what feeling or idea does it create?`,
      suggestedFastStem: `Read this phrase from the passage: "${evidence.text}". How does this phrase help develop the meaning or mood of the passage?`,
      reasons: [evidence.reason],
      warnings: [...warnings, ...excerptWarnings],
    };
  }

  if (opts.standardCode === 'ELA.9.R.1.1') {
    const evidence = r11EvidenceForStrand(text, opts.coverageStrandId, opts.coverageStrandLabel);
    if (!evidence) {
      return {
        accepted: true,
        qualitySignal: warnings.length ? 'not_enough_data' : 'emerging_signal',
        skillMove:
          'Keep the official-aligned passage in the library, then classify which R.1.1 detail or element it can support.',
        teachingPoint:
          'This passage is mapped to the benchmark, but it does not yet prove a pointable key element. Do not generate a student item until a question gate finds an exact detail, action, or setting clue.',
        reasons: [
          `official-aligned content kept; no exact ${opts.coverageStrandLabel ?? opts.coverageStrandId ?? 'key literary element'} evidence labeled yet`,
        ],
        warnings,
      };
    }

    const excerpt = contextAround(text, evidence.index);
    const excerptWarnings = studentAccessWarnings(excerpt);
    const strong = evidence.strength >= 3;

    return {
      accepted: true,
      qualitySignal: strong && warnings.length === 0 && excerptWarnings.length === 0 ? 'strong_signal' : 'emerging_signal',
      targetEvidence: evidence.text,
      skillMove:
        'Point to the exact detail, say what it suggests beyond the literal event, then explain how it adds meaning or style.',
      teachingPoint:
        'The question should point to one exact literary element and ask how that element adds a layer of meaning, characterization, tension, mood, or style.',
      studentMisconception:
        'The student may summarize what happened instead of explaining why the author included that detail.',
      scaffoldPrompt: `Reread this exact detail: "${evidence.text}". What does it suggest beyond what literally happens, and why does that matter?`,
      suggestedFastStem: `Read this detail from the passage: "${evidence.text}". How does this detail add meaning or style to the passage?`,
      reasons: [evidence.reason],
      warnings: [...warnings, ...excerptWarnings],
    };
  }

  return {
    accepted: true,
    qualitySignal: 'emerging_signal',
    skillMove: 'Use the exact passage evidence to practice the selected standard.',
    teachingPoint:
      'This standard does not have a deterministic teaching-moment miner yet, so the passage can move to AI certification.',
    reasons: ['standard-specific deterministic miner not yet implemented'],
    warnings,
  };
}
