import fs from 'fs/promises';
import path from 'path';
import { extractPassageUnits, stripBookFrontMatter } from '@/pipeline/stages/extract';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';
import type { FetchedBook, TierKey } from '@/pipeline/types';

type ManifestEntry = {
  title: string;
  author: string | null;
  standards: string[];
  discovered_gutenberg_id?: number | null;
  gutenberg_ids?: number[];
  status: string;
  text_path: string | null;
  word_count: number;
};

type Manifest = {
  entries: ManifestEntry[];
};

type ManualUploadManifest = {
  entries?: Array<{
    title: string;
    author?: string | null;
    word_count?: number;
    path?: string | null;
  }>;
};

export type OfficialExcerptCandidate = {
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  subSkillLabel: string;
  studentCanDo: string;
  location: string;
  excerpt: string;
  wordCount: number;
  paragraphCount: number;
  score: number;
  tier: TierKey;
  justification: string;
  evidenceSignals: string[];
  suggestedQuestionStem: string;
};

export type OfficialExcerptInventoryText = {
  title: string;
  author: string | null;
  status: string;
  hasLocalText: boolean;
  wordCount: number;
  standards: string[];
  candidateCount: number;
  candidates: OfficialExcerptCandidate[];
};

export type OfficialExcerptInventory = {
  generatedAt: string;
  summary: {
    officialTexts: number;
    localTexts: number;
    textsWithCandidates: number;
    totalCandidates: number;
    standardsRepresented: number;
  };
  texts: OfficialExcerptInventoryText[];
};

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data', 'official-text-library', 'manifest.json');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(
  ROOT,
  'data',
  'official-text-library',
  'manual-uploads',
  'manifest.json'
);

const DEFAULT_MAX_PER_TEXT_STANDARD_STRAND = 50;

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function loadManifestWithManualUploads(): Promise<Manifest> {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')) as Manifest;
  const manualManifest = await readJsonIfExists<ManualUploadManifest>(MANUAL_UPLOAD_MANIFEST_PATH);
  const manualByTitle = new Map((manualManifest?.entries ?? []).map((entry) => [normalize(entry.title), entry]));
  const manualByTitleAuthor = new Map(
    (manualManifest?.entries ?? []).map((entry) => [`${normalize(entry.title)}::${normalize(entry.author)}`, entry])
  );

  return {
    entries: manifest.entries.map((entry) => {
      const manual =
        manualByTitleAuthor.get(`${normalize(entry.title)}::${normalize(entry.author)}`) ??
        manualByTitle.get(normalize(entry.title));
      if (!manual || entry.status === 'stored') return entry;
      return {
        ...entry,
        author: manual.author ?? entry.author,
        status: 'manual_upload',
        text_path: manual.path ?? entry.text_path,
        word_count: manual.word_count ?? entry.word_count,
      };
    }),
  };
}

function stableNegativeId(title: string, author: string | null) {
  let hash = 0;
  const value = `${title}::${author ?? ''}`;
  for (let index = 0; index < value.length; index++) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return -Math.abs(hash || 1);
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function tokenHits(haystack: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return 0;
  if (haystack.includes(normalizedPhrase)) return 8;
  return tokenize(phrase).filter((token) => haystack.includes(token)).length;
}

const SKILL_PATTERNS: Record<string, Array<{ re: RegExp; label: string; weight: number }>> = {
  'setting-layer': [
    { re: /\b(mountain|valley|shore|sea|forest|woods|road|house|room|city|night|day|storm|wind|dark|light|weather|place)\b/i, label: 'setting/place/time language', weight: 8 },
    { re: /\b(savage|wild|lonely|dark|bright|cold|silent|pleasant|dreary|safe|dangerous)\b/i, label: 'atmosphere or mood-setting diction', weight: 6 },
  ],
  'plot-conflict-layer': [
    { re: /\b(but|however|yet|suddenly|then|until|because|therefore|instead|refused|decided|escaped|struck|killed|fought|danger|fear|conflict)\b/i, label: 'event, consequence, or conflict marker', weight: 8 },
    { re: /\b(enemy|battle|death|threat|trouble|problem|against|attack|rescue|choice|command|punish)\b/i, label: 'problem or opposition language', weight: 6 },
  ],
  'characterization-layer': [
    { re: /\b(said|answered|cried|asked|thought|believed|feared|hoped|wished|promised|commanded|looked|seemed)\b/i, label: 'character speech, thought, or action', weight: 8 },
    { re: /\b(proud|brave|afraid|angry|gentle|cruel|wise|foolish|silent|bold|kind|haughty)\b/i, label: 'character trait language', weight: 6 },
  ],
  'point-of-view-layer': [
    { re: /\b(i|we|my|our|me|us|reader|narrator|seemed|appeared|knew|understood|thought|saw|heard)\b/i, label: 'viewpoint or perception language', weight: 7 },
  ],
  'theme-tone-layer': [
    { re: /\b(life|death|love|justice|honor|power|freedom|fear|hope|truth|duty|loyalty|pride|sacrifice|lesson|learned|human)\b/i, label: 'theme or tone concept language', weight: 8 },
  ],
  'style-technique-layer': [
    { re: /\b(like|as|as if|as though|metaphor|simile|repetition|sentence|phrase|word|voice|image|imagery)\b/i, label: 'style, diction, or figurative language signal', weight: 8 },
  ],
  'universal-theme': [
    { re: /\b(people|life|human|always|never|must|should|learn|lesson|truth|choice|consequence|love|power|freedom|justice)\b/i, label: 'universal theme language', weight: 9 },
  ],
  'topic-vs-theme': [
    { re: /\b(courage|loyalty|love|power|fear|freedom|justice|pride|revenge|duty|sacrifice|friendship)\b/i, label: 'theme topic that can become a theme statement', weight: 7 },
  ],
  'theme-development-moments': [
    { re: /\b(first|then|later|again|now|before|after|changed|realized|because|therefore|consequence)\b/i, label: 'multiple-moment development language', weight: 8 },
  ],
  'theme-through-conflict': [
    { re: /\b(conflict|struggle|battle|choice|consequence|punish|suffer|risk|lose|death|fear|refuse)\b/i, label: 'conflict or consequence develops theme', weight: 9 },
  ],
  'theme-evidence-fit': [
    { re: /\b(prove|show|because|therefore|example|reason|evidence|detail|support)\b/i, label: 'evidence-fit language', weight: 6 },
  ],
  'speaker-reader-gap': [
    { re: /\b(seemed|claimed|pretended|really|in fact|but|however|although|reader|knew|ignorant)\b/i, label: 'gap between statement and reality', weight: 9 },
  ],
  'irony-reversal-contrast': [
    { re: /\b(but|yet|however|although|instead|opposite|contrary|while|seemed|really|unexpected)\b/i, label: 'contrast or reversal', weight: 9 },
  ],
  'satire-exaggeration-ridicule': [
    { re: /\b(absurd|ridiculous|mock|fool|folly|proposal|modest|advantage|profit|beggar|children|eat|devour)\b/i, label: 'satire, exaggeration, or ridicule', weight: 9 },
  ],
  'perspective-effect-evidence': [
    { re: /\b(attitude|tone|seemed|thought|believed|claimed|spoke|said|reader|understand)\b/i, label: 'perspective evidence', weight: 7 },
  ],
  'in-medias-res': [
    { re: /\b(now|already|began|battle|war|wrath|middle|after|when|then|thus)\b/i, label: 'action already underway', weight: 8 },
  ],
  'divine-intervention': [
    { re: /\b(god|goddess|jove|juno|minerva|apollo|venus|prayer|pray|prophecy|fate|heaven|divine)\b/i, label: 'god, prayer, prophecy, or fate', weight: 10 },
  ],
  'epic-hero-traits': [
    { re: /\b(hero|brave|courage|honor|honour|noble|leader|strong|valiant|clever|endure|glory|renowned)\b/i, label: 'heroic trait language', weight: 9 },
  ],
  'quest-journey-structure': [
    { re: /\b(journey|voyage|ship|sea|shore|home|return|wander|road|trial|test|obstacle|quest)\b/i, label: 'journey, test, or return structure', weight: 9 },
  ],
  'ritual-speech-oath': [
    { re: /\b(speech|oath|pray|prayer|offering|sacrifice|feast|wine|hospitality|burial|vow)\b/i, label: 'ritual, oath, speech, or hospitality', weight: 9 },
  ],
  'theme-through-heroic-action': [
    { re: /\b(honor|honour|loyalty|fate|revenge|duty|sacrifice|homecoming|glory|courage|death)\b/i, label: 'epic theme through action', weight: 8 },
  ],
  'elevated-style-epic-simile': [
    { re: /\b(muse|sing|like|as when|as a|glory|noble|renowned|bright|mighty|divine)\b/i, label: 'elevated style or epic comparison', weight: 9 },
  ],
  'structure-types': [
    { re: /\b(first|second|finally|because|therefore|however|although|compared|instead|problem|solution|cause|effect)\b/i, label: 'visible structure signal', weight: 8 },
  ],
  'paragraph-job': [
    { re: /\b(for example|therefore|however|in short|thus|but|this|these|such|another|finally)\b/i, label: 'paragraph job transition', weight: 8 },
  ],
  'feature-purpose': [
    { re: /\b(heading|title|caption|table|chart|figure|note|section|chapter|letter|speech)\b/i, label: 'text feature or section marker', weight: 7 },
  ],
  'structure-to-author-purpose': [
    { re: /\b(purpose|reader|show|prove|explain|argue|persuade|warn|criticize|notice|understand)\b/i, label: 'structure connected to purpose', weight: 8 },
  ],
  'central-idea-identification': [
    { re: /\b(idea|important|main|central|point|claim|argue|believe|must|should|therefore)\b/i, label: 'central idea language', weight: 8 },
  ],
  'support-development': [
    { re: /\b(example|evidence|reason|because|fact|support|prove|show|illustrate|therefore)\b/i, label: 'support or evidence development', weight: 9 },
  ],
  'strongest-evidence': [
    { re: /\b(best|strong|prove|evidence|because|reason|fact|example|support|data|number)\b/i, label: 'strong evidence language', weight: 8 },
  ],
  'weak-or-irrelevant-evidence': [
    { re: /\b(only|merely|not|however|but|although|irrelevant|general|detail|specific)\b/i, label: 'evidence-quality contrast', weight: 7 },
  ],
  'ethos-credibility': [
    { re: /\b(we|i|experience|authority|honor|honour|truth|trust|credible|responsibility|duty)\b/i, label: 'credibility appeal', weight: 8 },
  ],
  'pathos-emotion': [
    { re: /\b(fear|hope|love|suffering|pain|children|death|heart|dream|freedom|justice|shame)\b/i, label: 'emotional appeal', weight: 8 },
  ],
  'logos-reasoning': [
    { re: /\b(reason|therefore|because|if|then|fact|evidence|number|prove|logic|conclude)\b/i, label: 'reasoning appeal', weight: 8 },
  ],
  'figurative-purpose': [
    { re: /\b(like|as|metaphor|simile|image|symbol|dream|light|dark|storm|fire|chain)\b/i, label: 'figurative language used for purpose', weight: 8 },
  ],
  'logos-ethos-pathos': [
    { re: /\b(reason|therefore|because|if|then|fact|evidence|check|promise|defaulted|bank|funds|justice)\b/i, label: 'logos or reasoning appeal', weight: 8 },
    { re: /\b(we|our|i|you|children|freedom|justice|dignity|suffering|hope|dream|faith|satisfied)\b/i, label: 'emotional or credibility appeal', weight: 8 },
  ],
  'figurative-language-for-purpose': [
    { re: /\b(check|bank|vault|funds|dark|sunlit|quicksands|rock|whirlwinds|storms|valley|mountain|dream|symphony|ring)\b/i, label: 'figurative language used for purpose', weight: 9 },
  ],
  'appropriateness-of-appeal': [
    { re: /\b(audience|brothers|children|america|nation|citizenship|freedom|justice|dignity|nonviolence|discipline|faith|together)\b/i, label: 'appeal fits audience or purpose', weight: 8 },
  ],
  'opposing-claims': [
    { re: /\b(claim|argument|opposing|against|support|evidence|valid|reason|however|although|but)\b/i, label: 'claim or counterclaim language', weight: 8 },
  ],
  'figurative-language-identification': [
    { re: /\b(like|as|metaphor|simile|personification|image|fire|dark|light|storm|shadow|voice)\b/i, label: 'figurative language signal', weight: 9 },
  ],
  'figurative-language-to-mood': [
    { re: /\b(dark|bright|cold|warm|silent|fear|terror|hope|joy|sorrow|lonely|wild|beautiful)\b/i, label: 'mood language', weight: 9 },
  ],
  'paraphrase-grade-level-text': [
    { re: /\b(that|which|because|therefore|although|however|means|shows|explains|describes)\b/i, label: 'paraphrasable grade-level sentence structure', weight: 7 },
  ],
  'rhetorical-device-effect': [
    { re: /\b(repeat|question|parallel|we|must|shall|let|now|therefore|because|dream)\b/i, label: 'rhetorical device or effect', weight: 8 },
  ],
  'rhetorical-appeal-effect': [
    { re: /\b(reason|fear|hope|trust|we|i|you|justice|freedom|duty|evidence|believe)\b/i, label: 'rhetorical appeal effect', weight: 8 },
  ],
  'academic-vocabulary-context': [
    { re: /\b(context|meaning|word|phrase|precise|academic|term|called|means|known)\b/i, label: 'academic vocabulary context', weight: 6 },
  ],
  'word-family-relationship': [
    { re: /\b(prefix|suffix|root|derived|derivation|origin|form|word|family)\b/i, label: 'word family or derivation clue', weight: 7 },
  ],
  'context-clue-meaning': [
    { re: /\b(called|means|that is|or|which|because|such as|for example|known as|rather)\b/i, label: 'context clue signal', weight: 8 },
  ],
  'connotation-denotation': [
    { re: /\b(word|phrase|tone|feeling|suggests|implies|negative|positive|cold|warm|savage|wild|haughty)\b/i, label: 'connotation or tone word', weight: 8 },
  ],
};

function scoreCandidate(args: {
  text: string;
  standardCode: string;
  strandId: string;
  strandLabel: string;
  strandSignals: string[];
}) {
  const haystack = normalize(args.text);
  const evidenceSignals: string[] = [];
  let score = 0;

  for (const signal of [args.strandLabel, ...args.strandSignals]) {
    const hits = tokenHits(haystack, signal);
    if (hits > 0) {
      score += hits;
      evidenceSignals.push(signal);
    }
  }

  for (const pattern of SKILL_PATTERNS[args.strandId] ?? []) {
    if (pattern.re.test(args.text)) {
      score += pattern.weight;
      evidenceSignals.push(pattern.label);
    }
  }

  if (args.text.length > 700 && args.text.length < 1900) score += 3;
  if (args.text.includes('\n\n')) score += 1;

  return {
    score,
    evidenceSignals: [...new Set(evidenceSignals)].slice(0, 6),
  };
}

function questionStemFor(args: {
  standardCode: string;
  strandLabel: string;
  textTitle: string;
}) {
  if (args.standardCode === 'ELA.9.R.2.4') {
    return `How does this excerpt help students compare claims, evidence, or validity in ${args.textTitle}?`;
  }
  if (args.standardCode.startsWith('ELA.9.V.')) {
    return `How can context in this excerpt help students determine word meaning or word relationships?`;
  }
  return `How does this excerpt help teach ${args.strandLabel.toLowerCase()}?`;
}

function justificationFor(args: {
  strandLabel: string;
  studentCanDo: string;
  evidenceSignals: string[];
}) {
  return `This excerpt is teachable for ${args.strandLabel} because it gives students pointable evidence for: ${args.studentCanDo} Signals found: ${args.evidenceSignals.join(', ') || 'standard-aligned language in the passage'}.`;
}

function unitTierPreference(tier: TierKey) {
  return ({ T1: 4, T2: 5, T3: 3, T4: 2 } as Record<TierKey, number>)[tier];
}

function cleanSourceTextForMining(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[A-Za-z]¬\s+[A-Za-z]/g, (match) => match.replace(/¬\s+/, ''))
    .replace(/\b([A-Za-z]+)-\s+([a-z][A-Za-z]+)\b/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function sentenceChunks(text: string) {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function fallbackPassageUnits(book: FetchedBook) {
  const source = cleanSourceTextForMining(book.text);
  const result: Record<TierKey, Array<{
    text: string;
    wordCount: number;
    paragraphCount: number;
    sourceTitle: string;
    sourceAuthor: string;
    sourceYear: number | null;
    gutenbergId: number;
  }>> = { T1: [], T2: [], T3: [], T4: [] };
  const seen = new Set<string>();

  const addUnit = (text: string, tier: TierKey, paragraphCount = 1) => {
    const cleaned = text.replace(/[ \t]+/g, ' ').trim();
    const wc = cleaned.split(/\s+/).filter(Boolean).length;
    const hasPoeticLineBreaks = cleaned.split('\n').filter((line) => line.trim().length > 0).length >= 4;
    if (wc < 80 || wc > 360) return;
    if (!/[.!?"'”’]\s*$/.test(cleaned) && !hasPoeticLineBreaks) return;
    const key = normalize(cleaned).split(/\s+/).slice(0, 35).join(' ');
    if (seen.has(key)) return;
    seen.add(key);
    result[tier].push({
      text: cleaned,
      wordCount: wc,
      paragraphCount,
      sourceTitle: book.title,
      sourceAuthor: book.author,
      sourceYear: book.year,
      gutenbergId: book.gutenbergId,
    });
  };

  const blocks = source
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, ' ').trim())
    .filter((block) => block.split(/\s+/).filter(Boolean).length >= 25);

  for (let start = 0; start < blocks.length; start++) {
    for (const spanLen of [1, 2, 3]) {
      const span = blocks.slice(start, start + spanLen);
      if (span.length !== spanLen) continue;
      addUnit(span.join('\n\n'), spanLen === 1 ? 'T1' : spanLen === 2 ? 'T2' : 'T3', spanLen);
    }
  }

  const sentences = sentenceChunks(source);
  for (let start = 0; start < sentences.length; start++) {
    let chunk = '';
    for (let end = start; end < sentences.length; end++) {
      chunk = `${chunk} ${sentences[end]}`.trim();
      const wc = chunk.split(/\s+/).filter(Boolean).length;
      if (wc >= 110) addUnit(chunk, wc <= 210 ? 'T1' : wc <= 270 ? 'T2' : 'T3', 1);
      if (wc > 320) break;
    }
  }

  addUnit(source, source.split(/\s+/).filter(Boolean).length <= 210 ? 'T1' : 'T2', blocks.length || 1);
  return result;
}

export async function buildOfficialExcerptInventory(options?: {
  maxPerTextStandardStrand?: number;
}): Promise<OfficialExcerptInventory> {
  const maxPerLane = options?.maxPerTextStandardStrand ?? DEFAULT_MAX_PER_TEXT_STANDARD_STRAND;
  const manifest = await loadManifestWithManualUploads();
  const texts: OfficialExcerptInventoryText[] = [];

  for (const entry of manifest.entries) {
    const hasLocalText = Boolean(entry.text_path) && (entry.status === 'stored' || entry.status === 'manual_upload');
    const inventoryText: OfficialExcerptInventoryText = {
      title: entry.title,
      author: entry.author,
      status: entry.status,
      hasLocalText,
      wordCount: entry.word_count,
      standards: entry.standards,
      candidateCount: 0,
      candidates: [],
    };

    if (!hasLocalText || !entry.text_path) {
      texts.push(inventoryText);
      continue;
    }

    const absoluteTextPath = path.join(ROOT, entry.text_path);
    let sourceText = '';
    try {
      sourceText = cleanSourceTextForMining(await fs.readFile(absoluteTextPath, 'utf8'));
    } catch {
      texts.push({ ...inventoryText, hasLocalText: false });
      continue;
    }

    const book: FetchedBook = {
      gutenbergId:
        entry.discovered_gutenberg_id ??
        entry.gutenberg_ids?.[0] ??
        stableNegativeId(entry.title, entry.author),
      title: entry.title,
      author: entry.author ?? 'Unknown',
      year: null,
      text: sourceText,
    };
    const { strippedBook } = stripBookFrontMatter(book);
    const extractedUnits = extractPassageUnits(strippedBook);
    const hasExtractedUnits = (['T1', 'T2', 'T3', 'T4'] as TierKey[]).some((tier) => extractedUnits[tier].length > 0);
    const unitsByTier = hasExtractedUnits ? extractedUnits : fallbackPassageUnits(book);
    const units = (['T1', 'T2', 'T3', 'T4'] as TierKey[]).flatMap((tier) =>
      unitsByTier[tier].map((unit, index) => ({ ...unit, tier, index }))
    );

    for (const standardCode of entry.standards) {
      const blueprint = getGutenbergStandardBlueprint(standardCode);
      if (!blueprint?.coverageStrands?.length) continue;

      for (const strand of blueprint.coverageStrands) {
        const candidates = units
          .map((unit) => {
            const scored = scoreCandidate({
              text: unit.text,
              standardCode,
              strandId: strand.id,
              strandLabel: strand.label,
              strandSignals: strand.harvestSignals,
            });
            return {
              unit,
              score: scored.score + unitTierPreference(unit.tier),
              evidenceSignals: scored.evidenceSignals,
            };
          })
          .filter((candidate) => candidate.score >= (entry.word_count < 140 ? 6 : 10) && candidate.evidenceSignals.length > 0)
          .sort((a, b) => b.score - a.score || a.unit.wordCount - b.unit.wordCount)
          .slice(0, maxPerLane);

        inventoryText.candidates.push(
          ...candidates.map((candidate, index): OfficialExcerptCandidate => ({
            textTitle: entry.title,
            textAuthor: entry.author,
            standardCode,
            standardTitle: blueprint.teacherLabel,
            subSkillId: strand.id,
            subSkillLabel: strand.label,
            studentCanDo: strand.studentCanDo,
            location: `${candidate.unit.paragraphCount} paragraph${candidate.unit.paragraphCount === 1 ? '' : 's'} · ${candidate.unit.tier} candidate ${index + 1}`,
            excerpt: candidate.unit.text,
            wordCount: candidate.unit.wordCount,
            paragraphCount: candidate.unit.paragraphCount,
            score: candidate.score,
            tier: candidate.unit.tier,
            justification: justificationFor({
              strandLabel: strand.label,
              studentCanDo: strand.studentCanDo,
              evidenceSignals: candidate.evidenceSignals,
            }),
            evidenceSignals: candidate.evidenceSignals,
            suggestedQuestionStem: questionStemFor({
              standardCode,
              strandLabel: strand.label,
              textTitle: entry.title,
            }),
          }))
        );
      }
    }

    inventoryText.candidates.sort(
      (a, b) =>
        a.standardCode.localeCompare(b.standardCode) ||
        a.subSkillLabel.localeCompare(b.subSkillLabel) ||
        b.score - a.score
    );
    inventoryText.candidateCount = inventoryText.candidates.length;
    texts.push(inventoryText);
  }

  const standardsRepresented = new Set(texts.flatMap((text) => text.candidates.map((candidate) => candidate.standardCode))).size;
  const totalCandidates = texts.reduce((sum, text) => sum + text.candidateCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      officialTexts: texts.length,
      localTexts: texts.filter((text) => text.hasLocalText).length,
      textsWithCandidates: texts.filter((text) => text.candidateCount > 0).length,
      totalCandidates,
      standardsRepresented,
    },
    texts: texts.sort((a, b) => b.candidateCount - a.candidateCount || a.title.localeCompare(b.title)),
  };
}

export function officialExcerptInventoryMarkdown(inventory: OfficialExcerptInventory) {
  const lines = [
    '# GOGI Official Excerpt Inventory',
    '',
    `Generated: ${inventory.generatedAt}`,
    `Official texts: ${inventory.summary.officialTexts}`,
    `Local source texts: ${inventory.summary.localTexts}`,
    `Texts with mined candidates: ${inventory.summary.textsWithCandidates}`,
    `Mined teachable candidates: ${inventory.summary.totalCandidates}`,
    `Standards represented: ${inventory.summary.standardsRepresented}`,
    '',
    '## Coverage',
    '',
    '| Text | Source | Mapped Standards | Mined Candidates |',
    '| --- | --- | --- | ---: |',
  ];

  for (const text of inventory.texts) {
    lines.push(
      `| ${text.title}${text.author ? ` — ${text.author}` : ''} | ${text.hasLocalText ? text.status : 'missing'} | ${text.standards.join(', ')} | ${text.candidateCount} |`
    );
  }

  lines.push('');
  lines.push('## Candidates By Text');
  lines.push('');

  for (const text of inventory.texts) {
    lines.push(`### ${text.title}${text.author ? ` — ${text.author}` : ''}`);
    lines.push(`Candidates: ${text.candidateCount}`);
    if (!text.candidates.length) {
      lines.push('No mined candidates yet.');
      lines.push('');
      continue;
    }
    for (const candidate of text.candidates) {
      lines.push(`- ${candidate.standardCode} / ${candidate.subSkillLabel} / ${candidate.location}: ${candidate.suggestedQuestionStem}`);
      lines.push(`  - Why: ${candidate.justification}`);
      lines.push(`  - Excerpt: ${candidate.excerpt.replace(/\s+/g, ' ').slice(0, 360)}${candidate.excerpt.length > 360 ? '...' : ''}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
