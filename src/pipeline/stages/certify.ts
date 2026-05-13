import type { FilterResult, Paragraph, PipelineOptions, TagResultV3 } from '../types';
import { buildGutenbergReadingWinQuestionInsert } from '../../lib/reading-wins/gutenbergBridge';
import { stemFitsFastItemBlueprint } from '../../lib/reading-wins/itemBlueprints';
import { getReadingSkillMove } from '../../lib/reading-wins/skillMoveMap';

type CertificationStatus = 'certified' | 'teacher_review' | 'rejected';

export type PassageCertificationResult = {
  status: CertificationStatus;
  certified: boolean;
  score: number;
  confidence: 'strong signal' | 'emerging signal' | 'not enough data';
  reasons: string[];
};

const TEACHER_ANALYSIS_LANGUAGE = [
  /enacts/i,
  /oppression/i,
  /accusers?/i,
  /inanimate/i,
  /tonally/i,
  /surface-level/i,
  /expository/i,
  /mislead/i,
  /symbolic register/i,
  /schema/i,
  /liminal/i,
  /juxtaposition/i,
  /foregrounds/i,
  /motif/i,
  /semantic/i,
  /unavoidable weight/i,
];

const HIGH_FRICTION_WORDS = [
  'whereon',
  'thereof',
  'hastened',
  'vacated',
  'furtive',
  'facile',
  'larder',
  'rendered',
  'cottager',
  'perchance',
  'thither',
  'hither',
  'wherefore',
  'whence',
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasTeacherAnalysisLanguage(value: string) {
  return TEACHER_ANALYSIS_LANGUAGE.some((pattern) => pattern.test(value));
}

function sentenceWordCounts(value: string) {
  return value
    .split(/[.!?]/)
    .map((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length)
    .filter(Boolean);
}

function readabilityProblems(text: string) {
  const normalized = normalize(text);
  const archaicHits = HIGH_FRICTION_WORDS.filter((word) => normalized.includes(word));
  const sentenceCounts = sentenceWordCounts(text);
  const longSentences = sentenceCounts.filter((count) => count >= 55).length;
  const averageSentenceLength =
    sentenceCounts.length > 0
      ? sentenceCounts.reduce((sum, count) => sum + count, 0) / sentenceCounts.length
      : 0;

  const reasons: string[] = [];
  if (archaicHits.length >= 4) {
    reasons.push(`high-friction vocabulary: ${archaicHits.slice(0, 5).join(', ')}`);
  }
  if (longSentences >= 2) {
    reasons.push('multiple 55+ word sentences');
  }
  if (averageSentenceLength >= 34 && sentenceCounts.length >= 3) {
    reasons.push(`dense average sentence length: ${Math.round(averageSentenceLength)} words`);
  }
  return reasons;
}

function strandEvidenceFits(input: {
  standardCode: string;
  coverageStrandId?: string;
  coverageStrandLabel?: string;
  coverageSignals?: string[];
  tagResult: TagResultV3;
}) {
  const strand = normalize(
    `${input.coverageStrandId ?? ''} ${input.coverageStrandLabel ?? ''} ${
      input.coverageSignals?.join(' ') ?? ''
    } ${input.tagResult.target_signal ?? ''}`
  );
  const supporting = input.tagResult.supporting_evidence ?? [];
  const evidenceText = normalize(
    supporting.map((item) => `${item.element} ${item.rationale}`).join(' ')
  );

  if (input.standardCode === 'ELA.9.R.3.1' && /metaphor|simile|comparison/.test(strand)) {
    return (
      /\bas if\b|\bas though\b|\blike\b|\bas\b|comparison|compares|metaphor|simile/.test(
        evidenceText
      ) && !/^personification$/.test(normalize(input.tagResult.target_signal))
    );
  }

  if (input.standardCode === 'ELA.9.R.3.1' && /personification/.test(strand)) {
    return /personification|human|alive|object|thing|furniture|nonhuman/.test(evidenceText);
  }

  if (input.standardCode === 'ELA.9.R.3.1' && /imagery|sensory/.test(strand)) {
    return /image|imagery|visual|sound|color|light|dark|cold|warm|touch|smell|taste|sensory/.test(
      evidenceText
    );
  }

  return true;
}

export function certifyPassageForPipeline(input: {
  paragraph: Paragraph;
  filterResult: FilterResult;
  tagResult: TagResultV3;
  opts: PipelineOptions;
}): PassageCertificationResult {
  const reasons: string[] = [];
  const standardCode = input.opts.standardCode;
  const strandId = input.opts.coverageStrandId;
  const strandLabel = input.opts.coverageStrandLabel;
  const coverageSignals = input.opts.coverageSignals;
  const supporting = input.tagResult.supporting_evidence ?? [];
  const nonSupporting = input.tagResult.non_supporting_evidence ?? [];

  if (!standardCode) reasons.push('missing standard code');
  if (!strandId && !strandLabel) reasons.push('missing coverage strand');
  if (
    standardCode &&
    !getReadingSkillMove({
      standardCode,
      strandId,
      strandLabel,
      targetSkill: input.tagResult.target_signal,
    })
  ) {
    reasons.push('no skill-move map exists for this standard/strand');
  }
  if (input.filterResult.q5 !== 'pass') reasons.push('filter did not prove item constructability');
  if (supporting.length < 1) reasons.push('missing supporting evidence');
  if (nonSupporting.length < 2) reasons.push('needs at least two distractor evidence anchors');

  const rationaleText = [...supporting, ...nonSupporting]
    .map((item) => item.rationale ?? '')
    .join(' ');
  if (hasTeacherAnalysisLanguage(rationaleText)) {
    reasons.push('tagger used teacher-analysis language instead of student-facing wording');
  }

  reasons.push(...readabilityProblems(input.paragraph.text));

  if (
    standardCode &&
    !strandEvidenceFits({
      standardCode,
      coverageStrandId: strandId,
      coverageStrandLabel: strandLabel,
      coverageSignals,
      tagResult: input.tagResult,
    })
  ) {
    reasons.push('supporting evidence does not cleanly match the selected strand');
  }

  const previewInsert = standardCode
    ? buildGutenbergReadingWinQuestionInsert(
        {
          id: input.paragraph.hash,
          classification: input.opts.classification,
          standard_code: standardCode,
          coverage_strand_id: strandId ?? null,
          coverage_strand_label: strandLabel ?? null,
          coverage_strand_signals: coverageSignals ?? null,
          paragraph_text: input.paragraph.text,
          word_count: input.paragraph.wordCount,
          source_title: input.paragraph.sourceTitle,
          source_author: input.paragraph.sourceAuthor,
          source_year: input.paragraph.sourceYear,
          source_gutenberg_id: input.paragraph.gutenbergId,
          intervention_tier: input.tagResult.intervention_tier,
          target_signal: input.tagResult.target_signal,
          supporting_evidence: supporting,
          non_supporting_evidence: nonSupporting,
          plausible_distractors: input.tagResult.plausible_distractors ?? null,
          tier_rationale: input.tagResult.tier_rationale,
        },
        { standardId: null }
      )
    : null;

  if (!previewInsert) {
    reasons.push('could not generate a certified FAST-style Reading Win item');
  } else if (
    standardCode &&
    !stemFitsFastItemBlueprint({
      standardCode,
      strandId,
      strandLabel,
      targetSignal: input.tagResult.target_signal,
      evidenceText: supporting[0]?.element,
      stem: previewInsert.content,
    })
  ) {
    reasons.push('generated item does not fit the FAST item blueprint');
  }

  const score = Math.max(0, 8 - reasons.length);
  const certified = reasons.length === 0;
  const confidence = certified ? 'strong signal' : score >= 6 ? 'emerging signal' : 'not enough data';

  return {
    status: certified ? 'certified' : score >= 6 ? 'teacher_review' : 'rejected',
    certified,
    score,
    confidence,
    reasons,
  };
}
