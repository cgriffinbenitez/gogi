#!/usr/bin/env tsx
/**
 * Mine stored official B.E.S.T./FAST texts into standard-aligned passage rows.
 *
 * This command deliberately does NOT generate questions and does NOT call Claude.
 * It only turns trusted official text files into reviewable content-library rows.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { extractPassageUnits, stripBookFrontMatter } from '../src/pipeline/stages/extract';
import { mineTeachingMoment } from '../src/pipeline/stages/mineTeachingMoments';
import { writePassageV3 } from '../src/pipeline/stages/write';
import { getGutenbergStandardBlueprint } from '../src/pipeline/standardBlueprints';
import { getFastAldGuidanceForStandard } from '../src/lib/fast/achievementLevelDescriptions';
import type { FetchedBook, PassageRowV3, PipelineOptions, TierKey } from '../src/pipeline/types';

type ManifestEntry = {
  title: string;
  author: string | null;
  standards: string[];
  discovered_gutenberg_id: number | null;
  gutenberg_ids: number[];
  status: string;
  text_path: string | null;
  word_count: number;
};

type Manifest = {
  entries: ManifestEntry[];
};

type ManualUploadManifest = {
  entries: Array<{
    title: string;
    author: string | null;
    word_count: number;
    path: string;
  }>;
};

type CoverageStrand = NonNullable<
  NonNullable<ReturnType<typeof getGutenbergStandardBlueprint>>['coverageStrands']
>[number];

type AldAlignment = {
  score: number;
  guidanceQuestions: string[];
  reasons: string[];
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

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function readArg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], name: string) {
  return args.includes(name);
}

function printHelp() {
  console.log(`
GOGI Official Text Library Miner

Usage:
  npm run library:mine-official
  npm run library:mine-official -- --standard ELA.9.R.1.1

Options:
  --standard          Optional. Mine only one standard.
  --max-per-text      Max excerpt rows per text/standard pair. Default: 8.
  --dry-run           Show what would be mined without writing rows.
  --help              Show this help.

Official-only guarantees:
  - Reads only data/official-text-library/manifest.json.
  - Mines only texts mapped to the selected Florida B.E.S.T. standard.
  - Uses only rows with status=stored and a local text file.
  - Does not query Gutendex, search authors, call Claude, or generate questions.
`);
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      `Official text manifest not found at ${path.relative(ROOT, MANIFEST_PATH)}. Run npm run library:official-texts first.`
    );
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  if (!fs.existsSync(MANUAL_UPLOAD_MANIFEST_PATH)) return manifest;

  const manualManifest = JSON.parse(fs.readFileSync(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8')) as ManualUploadManifest;
  const officialByTitle = new Map(manifest.entries.map((entry) => [normalizeTitle(entry.title), entry]));
  const manualByTitle = new Map((manualManifest.entries ?? []).map((entry) => [normalizeTitle(entry.title), entry]));

  return {
    ...manifest,
    entries: manifest.entries.map((entry) => {
      if (entry.status === 'stored') return entry;
      const manualEntry = manualByTitle.get(normalizeTitle(entry.title));
      const officialEntry = officialByTitle.get(normalizeTitle(entry.title));
      if (!manualEntry || !officialEntry) return entry;
      return {
        ...entry,
        author: manualEntry.author || entry.author,
        status: 'manual_upload',
        text_path: manualEntry.path,
        word_count: manualEntry.word_count || entry.word_count,
      };
    }),
  };
}

function sourceLabel(entry: ManifestEntry) {
  return `${entry.title} — ${entry.author ?? 'Unknown'}`;
}

function printOfficialOnlyRunReport(args: {
  manifest: Manifest;
  selectedStandard?: string;
  entries: ManifestEntry[];
}) {
  const officialInScope = args.manifest.entries.filter((entry) =>
    args.selectedStandard ? entry.standards.includes(args.selectedStandard) : true
  );
  const stored = officialInScope.filter(
    (entry) => (entry.status === 'stored' || entry.status === 'manual_upload') && entry.text_path
  );
  const needsUpload = officialInScope.filter((entry) => entry.status === 'needs_upload');
  const referenceOnly = officialInScope.filter((entry) => entry.status === 'reference_only');
  const unavailable = officialInScope.filter((entry) =>
    ['fetch_failed', 'needs_gutenberg_match'].includes(entry.status)
  );

  console.log('  Official-only guardrail: ON');
  console.log('  Source: data/official-text-library/manifest.json');
  console.log('  Broad Gutenberg search: OFF');
  console.log('  Claude calls: OFF');
  console.log('  Question generation: OFF');
  console.log(`  Official B.E.S.T. text rows in scope: ${officialInScope.length}`);
  console.log(`  Stored/eligible for mining: ${stored.length}`);
  console.log(`  Needs manual upload: ${needsUpload.length}`);
  console.log(`  Reference only: ${referenceOnly.length}`);
  console.log(`  Unavailable/fetch issue: ${unavailable.length}`);

  if (args.selectedStandard) {
    console.log('\n  Stored texts eligible for this run:');
    for (const entry of stored) {
      console.log(`    ✓ ${sourceLabel(entry)} (${entry.word_count.toLocaleString()} words)`);
    }

    if (needsUpload.length) {
      console.log('\n  Skipped because they need manual upload/rights-managed text:');
      for (const entry of needsUpload) console.log(`    • ${sourceLabel(entry)}`);
    }

    if (referenceOnly.length) {
      console.log('\n  Skipped because they are reference/style models only:');
      for (const entry of referenceOnly) console.log(`    • ${sourceLabel(entry)}`);
    }

    if (unavailable.length) {
      console.log('\n  Skipped because local official text is unavailable:');
      for (const entry of unavailable) console.log(`    • ${sourceLabel(entry)} (${entry.status})`);
    }
  }

  if (stored.length !== args.entries.length) {
    throw new Error('Official-only guardrail mismatch: selected entries do not match stored official text scope.');
  }
}

function stableNegativeId(title: string, author: string | null) {
  const hex = crypto.createHash('sha256').update(`${title}::${author ?? ''}`).digest('hex').slice(0, 7);
  return -parseInt(hex, 16);
}

function hashFor(args: { standard: string; title: string; text: string }) {
  return crypto
    .createHash('sha256')
    .update(`${args.standard}::${args.title}::${args.text}`)
    .digest('hex')
    .slice(0, 16);
}

function tierFromKey(tierKey: TierKey) {
  return Number(tierKey.slice(1)) as 1 | 2 | 3 | 4;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenHits(haystack: string, needle: string) {
  const normalizedNeedle = normalize(needle);
  if (!normalizedNeedle) return 0;
  if (haystack.includes(normalizedNeedle)) return 4;
  return normalizedNeedle
    .split(/\s+/)
    .filter((token) => token.length >= 4 && haystack.includes(token)).length;
}

function chooseCoverageStrand(args: {
  standard: string;
  text: string;
  mining: ReturnType<typeof mineTeachingMoment>;
}) {
  const blueprint = getGutenbergStandardBlueprint(args.standard);
  const strands = blueprint?.coverageStrands ?? [];
  if (!strands.length) return null;

  const haystack = normalize(
    [
      args.text,
      args.mining.targetEvidence,
      args.mining.skillMove,
      args.mining.teachingPoint,
      args.mining.reasons.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
  );

  const scored = strands
    .map((strand) => {
      let score = tokenHits(haystack, strand.label) + tokenHits(haystack, strand.id);
      for (const signal of strand.harvestSignals) score += tokenHits(haystack, signal);

      if (args.standard === 'ELA.9.R.1.4') {
        if (strand.id === 'divine-intervention' && /\b(minerva|jove|juno|apollo|venus|god|goddess|prayer|prophecy|fate)\b/i.test(args.text)) {
          score += 8;
        }
        if (strand.id === 'in-medias-res' && /\b(already|now|then|thus|when|after|battle|war|wrath|began|middle)\b/i.test(args.text)) {
          score += 3;
        }
        if (strand.id === 'ritual-speech-oath' && /\b(pray|prayer|offering|sacrifice|oath|speech|feast|wine|hospitality|burial)\b/i.test(args.text)) {
          score += 7;
        }
        if (strand.id === 'epic-hero-traits' && /\b(hero|brave|courage|honou?r|noble|leader|strong|valiant|clever|endure)\b/i.test(args.text)) {
          score += 7;
        }
        if (strand.id === 'quest-journey-structure' && /\b(journey|voyage|home|return|ship|sea|wander|test|trial|obstacle)\b/i.test(args.text)) {
          score += 7;
        }
        if (strand.id === 'theme-through-heroic-action' && /\b(loyal|loyalty|revenge|fate|duty|sacrifice|homecoming|honou?r|glory)\b/i.test(args.text)) {
          score += 6;
        }
        if (strand.id === 'elevated-style-epic-simile' && /\b(muse|sing|glory|renowned|noble|like|as when|as a|as the)\b/i.test(args.text)) {
          score += 6;
        }
      }

      return { strand, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].strand : strands[0];
}

const ALD_STANDARD_PATTERNS: Record<string, Array<{ re: RegExp; reason: string; weight: number }>> = {
  'ELA.9.R.1.1': [
    { re: /\b(mood|tone|purpose|meaning|style|setting|character|conflict|plot|point of view|narrator)\b/i, reason: 'matches report guidance for key elements, mood, tone, or purpose', weight: 5 },
    { re: /\b(change|shift|where|how do you know|evidence|support)\b/i, reason: 'supports the report move of proving where/how meaning changes', weight: 2 },
  ],
  'ELA.9.R.1.2': [
    { re: /\b(theme|universal|lesson|life|people|choice|multiple points|throughout|develop)\b/i, reason: 'matches report guidance for universal theme development', weight: 6 },
    { re: /\b(conflict|consequence|realized|learned|changed|evidence|support)\b/i, reason: 'supports theme evidence from more than one moment', weight: 3 },
  ],
  'ELA.9.R.1.3': [
    { re: /\b(narrator|perspective|point of view|irony|satire|ironic|mock|ridicule|exaggerat|contrast|basic perspective)\b/i, reason: 'matches report guidance for narrator perspective, irony, or satire', weight: 7 },
  ],
  'ELA.9.R.1.4': [
    { re: /\b(epic|hero|goddess|god|jove|minerva|fate|quest|journey|oath|prayer|theme|structure|character|in medias res)\b/i, reason: 'matches report guidance for epic character, structure, and theme', weight: 7 },
  ],
  'ELA.9.R.2.1': [
    { re: /\b(structure|feature|paragraph|section|purpose|meaning|compare|contrast|cause|effect|sequence|problem|solution)\b/i, reason: 'matches report guidance for text structures/features and purpose', weight: 7 },
  ],
  'ELA.9.R.2.2': [
    { re: /\b(central idea|main idea|support|evidence|develop|reason|example|detail|article|advertisement)\b/i, reason: 'matches report guidance for central idea support', weight: 7 },
  ],
  'ELA.9.R.2.3': [
    { re: /\b(purpose|ethos|pathos|logos|appeal|rhetorical|figurative|audience|straightforward purpose)\b/i, reason: 'matches report guidance for purpose through appeals or figurative language', weight: 7 },
  ],
  'ELA.9.R.2.4': [
    { re: /\b(opposing|argument|claim|supported|unsupported|evidence|validity|effective|same topic|table)\b/i, reason: 'matches report guidance for opposing claims and evidence support', weight: 8 },
  ],
  'ELA.9.R.3.1': [
    { re: /\b(figurative|mood|literal|message|simile|metaphor|personification|imagery|word choice|feeling)\b/i, reason: 'matches report guidance for figurative language, mood, and literal versus figurative message', weight: 8 },
  ],
  'ELA.9.R.3.2': [
    { re: /\b(paraphrase|restate|meaning|sentence|phrase|grade level|same meaning|without changing)\b/i, reason: 'matches grade-level paraphrase work', weight: 6 },
  ],
  'ELA.9.R.3.3': [
    { re: /\b(adapted|adaptation|original|mythical|classical|religious|similarities|differences|impact|retelling)\b/i, reason: 'matches report guidance for adaptation comparison', weight: 8 },
  ],
  'ELA.9.R.3.4': [
    { re: /\b(rhetoric|rhetorical|appeal|device|audience|purpose|reader|believe|feel|notice|appropriate)\b/i, reason: 'matches report guidance for rhetoric and audience effect', weight: 8 },
  ],
  'ELA.9.V.1.1': [
    { re: /\b(academic|precise|word|phrase|meaning|context|vocabulary)\b/i, reason: 'matches academic vocabulary meaning work', weight: 5 },
  ],
  'ELA.9.V.1.2': [
    { re: /\b(root|roots|etymology|derivation|derived|prefix|suffix|word part|common word roots)\b/i, reason: 'matches report guidance for roots, etymology, and derivations', weight: 8 },
  ],
  'ELA.9.V.1.3': [
    { re: /\b(context clue|context clues|connotation|denotation|unknown words|word relationship|reference material|background knowledge|figurative language)\b/i, reason: 'matches report guidance for context clues and word/phrase meaning', weight: 8 },
  ],
};

function scoreAldAlignment(args: {
  standard: string;
  text: string;
  mining: ReturnType<typeof mineTeachingMoment>;
  strand: CoverageStrand | null;
}): AldAlignment {
  const haystack = normalize(
    [
      args.text,
      args.mining.targetEvidence,
      args.mining.skillMove,
      args.mining.teachingPoint,
      args.strand?.label,
      args.strand?.studentCanDo,
      args.strand?.harvestSignals.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
  );
  const guidance = getFastAldGuidanceForStandard(args.standard);
  const guidanceHits = guidance
    .map((item) => {
      const text = `${item.question} ${item.content_use}`;
      const score = tokenHits(haystack, text);
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const patternHits = (ALD_STANDARD_PATTERNS[args.standard] ?? [])
    .filter((pattern) => pattern.re.test(args.text))
    .map((pattern) => pattern);
  const qualityBonus =
    args.mining.qualitySignal === 'strong_signal'
      ? 5
      : args.mining.qualitySignal === 'emerging_signal'
        ? 2
        : 0;

  return {
    score:
      guidanceHits.reduce((sum, item) => sum + item.score, 0) +
      patternHits.reduce((sum, item) => sum + item.weight, 0) +
      qualityBonus,
    guidanceQuestions: guidanceHits.slice(0, 3).map((item) => item.question),
    reasons: [
      ...guidanceHits.slice(0, 2).map((item) => `FAST report question: ${item.question}`),
      ...patternHits.slice(0, 3).map((item) => item.reason),
    ],
  };
}

function buildOfficialCandidateRow(args: {
  entry: ManifestEntry;
  standard: string;
  unit: ReturnType<typeof extractPassageUnits>[TierKey][number] & { tierKey: TierKey };
  mining: ReturnType<typeof mineTeachingMoment>;
  strand: CoverageStrand | null;
  ald: AldAlignment;
}): PassageRowV3 {
  const blueprint = getGutenbergStandardBlueprint(args.standard);
  const tier = tierFromKey(args.unit.tierKey);
  const strand = args.strand;
  const sourceId =
    args.entry.discovered_gutenberg_id ??
    args.entry.gutenberg_ids[0] ??
    stableNegativeId(args.entry.title, args.entry.author);

  return {
    classification: blueprint?.classifications[0] ?? 'official_text_candidate',
    standard_code: args.standard,
    coverage_strand_id: strand?.id ?? null,
    coverage_strand_label: strand?.label ?? blueprint?.teacherLabel ?? 'Official text library',
    coverage_strand_signals: strand?.harvestSignals ?? [blueprint?.harvestGoal ?? 'Official B.E.S.T./FAST mapped text'],
    paragraph_text: args.unit.text,
    word_count: args.unit.wordCount,
    paragraph_count: args.unit.paragraphCount,
    source: 'official_text_library',
    source_title: args.entry.title,
    source_author: args.entry.author,
    source_year: null,
    source_gutenberg_id: sourceId,
    approved: false,
    paragraph_hash: hashFor({
      standard: args.standard,
      title: args.entry.title,
      text: args.unit.text,
    }),
    pipeline_version: 'v4',
    target_signal: strand?.label ?? args.mining.targetEvidence ?? 'official_text_candidate',
    item_patterns_supported: ['official_text_library', 'no_question_generated'],
    supporting_evidence: args.mining.targetEvidence
      ? [{ element: args.mining.targetEvidence, rationale: args.mining.reasons.join('; ') }]
      : [],
    non_supporting_evidence: [],
    dominant_concept: strand?.studentCanDo ?? blueprint?.teacherLabel ?? 'Official B.E.S.T./FAST mapped content',
    plausible_distractors: [],
    craft_features: [],
    discrimination_item_type: 'paragraph_level',
    intervention_tier: tier,
    tagger_tier: null,
    word_count_tier: tier,
    tier_rationale:
      [
        `Official text library candidate only. Suggested instructional strand: ${strand?.label ?? blueprint?.teacherLabel ?? 'Official text library'}.`,
        `ALD alignment score: ${args.ald.score}.`,
        args.ald.reasons.length ? `ALD reasons: ${args.ald.reasons.join(' | ')}` : null,
        'No question package generated. Use as trusted source content for later excerpt review, Reading Wins, and lesson generation.',
      ]
        .filter(Boolean)
        .join(' '),
    q5_flag_5e_compatible: false,
    approval_status: 'pending_review',
  };
}

function tierPreference(tierKey: TierKey) {
  return ({ T1: 3, T2: 4, T3: 2, T4: 1 } as Record<TierKey, number>)[tierKey] ?? 0;
}

function candidateWordCountFit(wordCountValue: number) {
  if (wordCountValue >= 140 && wordCountValue <= 320) return 4;
  if (wordCountValue >= 100 && wordCountValue <= 380) return 2;
  return 0;
}

type OfficialMineCandidate = {
  unit: ReturnType<typeof extractPassageUnits>[TierKey][number] & { tierKey: TierKey };
  mining: ReturnType<typeof mineTeachingMoment>;
  strand: CoverageStrand | null;
  ald: AldAlignment;
  rankScore: number;
};

function rankOfficialCandidates(args: {
  standard: string;
  units: Array<ReturnType<typeof extractPassageUnits>[TierKey][number] & { tierKey: TierKey }>;
  opts: PipelineOptions;
}) {
  const candidates: OfficialMineCandidate[] = [];

  for (const unit of args.units) {
    const mining = mineTeachingMoment(unit, args.opts);
    if (!mining.accepted) continue;

    const strand = chooseCoverageStrand({ standard: args.standard, text: unit.text, mining });
    const ald = scoreAldAlignment({ standard: args.standard, text: unit.text, mining, strand });
    const warningPenalty = (mining.warnings?.length ?? 0) * 2;
    const rankScore =
      ald.score +
      tierPreference(unit.tierKey) +
      candidateWordCountFit(unit.wordCount) -
      warningPenalty;

    candidates.push({ unit, mining, strand, ald, rankScore });
  }

  return candidates.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.ald.score !== a.ald.score) return b.ald.score - a.ald.score;
    return a.unit.wordCount - b.unit.wordCount;
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printHelp();
    return;
  }

  const selectedStandard = readArg(args, '--standard');
  const maxPerText = Number(readArg(args, '--max-per-text') ?? '8');
  const dryRun = hasFlag(args, '--dry-run');
  const manifest = loadManifest();

  const entries = manifest.entries.filter(
    (entry) =>
      (entry.status === 'stored' || entry.status === 'manual_upload') &&
      entry.text_path &&
      (!selectedStandard || entry.standards.includes(selectedStandard))
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Text Library Mining');
  console.log(`  Scope: ${selectedStandard ?? 'all stored standards'}`);
  console.log(`  Max per text/standard: ${Number.isFinite(maxPerText) ? maxPerText : 8}`);
  console.log(`  Dry run: ${dryRun}`);
  printOfficialOnlyRunReport({ manifest, selectedStandard, entries });
  console.log('═══════════════════════════════════════════════════════\n');

  let mined = 0;
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const entry of entries) {
    const standards = selectedStandard ? [selectedStandard] : entry.standards;
    const textPath = path.join(ROOT, entry.text_path!);
    if (!fs.existsSync(textPath)) continue;

    const book: FetchedBook = {
      gutenbergId:
        entry.discovered_gutenberg_id ??
        entry.gutenberg_ids[0] ??
        stableNegativeId(entry.title, entry.author),
      title: entry.title,
      author: entry.author ?? 'Unknown',
      year: null,
      text: fs.readFileSync(textPath, 'utf8'),
    };
    const { strippedBook, charsSkipped } = stripBookFrontMatter(book);
    const unitsByTier = extractPassageUnits(strippedBook);
    const units = (['T1', 'T2', 'T3', 'T4'] as TierKey[]).flatMap((tierKey) =>
      unitsByTier[tierKey].map((unit) => ({ ...unit, tierKey }))
    );

    console.log(`\n[text] ${entry.title} — ${entry.author ?? 'Unknown'}`);
    console.log(`  words: ${entry.word_count.toLocaleString()} | front matter stripped: ${charsSkipped.toLocaleString()} chars | candidate units: ${units.length}`);

    for (const standard of standards) {
      const blueprint = getGutenbergStandardBlueprint(standard);
      const opts: PipelineOptions = {
        classification: blueprint?.classifications[0] ?? 'official_text_candidate',
        standardCode: standard,
        coverageStrandId: 'official-text-library',
        coverageStrandLabel: blueprint?.teacherLabel ?? 'Official text library',
        coverageSignals: [blueprint?.harvestGoal ?? 'Official B.E.S.T./FAST mapped text'],
        max: maxPerText,
        maxBooks: 1,
        dryRun,
        writeAllPassed: false,
      };

      const rankedCandidates = rankOfficialCandidates({ standard, units, opts });
      let writtenForPair = 0;
      let consideredForPair = 0;
      for (const candidate of rankedCandidates) {
        if (writtenForPair >= maxPerText) break;
        const row = buildOfficialCandidateRow({
          entry,
          standard,
          unit: candidate.unit,
          mining: candidate.mining,
          strand: candidate.strand,
          ald: candidate.ald,
        });
        mined++;
        consideredForPair++;

        if (dryRun) {
          writtenForPair++;
          continue;
        }

        const result = await writePassageV3(row);
        if (result.status === 'inserted') {
          inserted++;
          writtenForPair++;
        } else if (result.status === 'duplicate') {
          duplicates++;
        } else if (result.status === 'updated_existing') {
          writtenForPair++;
        } else {
          errors++;
          console.warn(`  [write-error] ${standard}: ${result.error}`);
        }
      }

      console.log(
        `  ${standard}: staged ${writtenForPair} from ${rankedCandidates.length} ALD-ranked candidate(s)` +
          (consideredForPair ? ` | top score ${rankedCandidates[0]?.rankScore ?? 0}` : '')
      );
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Official text library mining complete');
  console.log('  Official-only guardrail: confirmed');
  console.log(`  Candidate rows considered: ${mined}`);
  console.log(`  Inserted:                 ${inserted}`);
  console.log(`  Duplicates skipped:       ${duplicates}`);
  console.log(`  Errors:                   ${errors}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('[library:mine-official] failed:', err);
  process.exit(1);
});
