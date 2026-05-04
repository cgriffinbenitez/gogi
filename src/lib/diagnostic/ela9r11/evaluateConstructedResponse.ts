import { ELA9R11_MISCONCEPTIONS } from './misconceptions';
import type {
  Ela9R11AnalysisQuality,
  Ela9R11ConstructedResponseEvaluation,
  Ela9R11DiagnosticItem,
  Ela9R11EvidenceQuality,
  Ela9R11MisconceptionFlag,
} from './types';

const ELEMENT_WORDS = [
  'setting',
  'character',
  'characterization',
  'conflict',
  'plot',
  'point of view',
  'narrator',
  'theme',
  'mood',
  'tone',
  'symbol',
  'symbolism',
  'imagery',
  'figurative',
  'structure',
  'pacing',
  'repetition',
];

const MEANING_WORDS = [
  'shows',
  'suggests',
  'reveals',
  'creates',
  'develops',
  'builds',
  'emphasizes',
  'because',
  'so the reader',
  'this means',
  'makes the reader',
  'helps us understand',
];

const VAGUE_WORDS = ['interesting', 'important', 'good', 'bad', 'nice', 'cool', 'better'];

export function evaluateEla9R11ConstructedResponse(
  response: string,
  item: Ela9R11DiagnosticItem,
): Ela9R11ConstructedResponseEvaluation {
  const clean = response.trim();
  const lower = clean.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const flags: Ela9R11MisconceptionFlag[] = [];

  const namesElement = ELEMENT_WORDS.some((word) => lower.includes(word));
  const usesTargetEvidence = (item.evidenceTargets ?? []).some((target) => lower.includes(target.toLowerCase()));
  const usesQuotedEvidence = /["“”']/.test(clean);
  const usesEvidenceLanguage = /\b(text|passage|quote|detail|word|phrase|says|states)\b/.test(lower);
  const hasEvidence = usesTargetEvidence || usesQuotedEvidence || usesEvidenceLanguage;
  const hasMeaningMove = MEANING_WORDS.some((word) => lower.includes(word));
  const hasVagueAnalysis = VAGUE_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(lower));

  if (!clean || wordCount < 8) flags.push('analysis_too_vague');
  if (!namesElement) flags.push('element_not_identified');
  if (!hasEvidence) flags.push('evidence_too_general');
  if (hasEvidence && !usesTargetEvidence && !usesQuotedEvidence) flags.push('evidence_irrelevant');
  if (!hasMeaningMove) flags.push('effect_confused_with_summary');
  if (hasVagueAnalysis) flags.push('analysis_too_vague');
  if (namesElement && hasEvidence && !hasMeaningMove) flags.push('function_not_explained');

  const evidenceQuality: Ela9R11EvidenceQuality = !hasEvidence
    ? 'none'
    : usesTargetEvidence || usesQuotedEvidence
      ? 'strong'
      : 'partial';

  const analysisQuality: Ela9R11AnalysisQuality = !clean || wordCount < 8
    ? 'none'
    : hasMeaningMove && namesElement
      ? 'strong'
      : hasMeaningMove || namesElement
        ? 'partial'
        : 'summary_only';

  const uniqueFlags = [...new Set(flags)];
  const accepted = namesElement && hasEvidence && hasMeaningMove && wordCount >= 12;
  const primaryMisconceptionFlag = accepted
    ? 'function_not_explained'
    : uniqueFlags[0] ?? 'analysis_too_vague';
  const secondaryFlags = accepted ? [] : uniqueFlags.filter((flag) => flag !== primaryMisconceptionFlag).slice(0, 3);
  const route = ELA9R11_MISCONCEPTIONS[primaryMisconceptionFlag].route;

  return {
    accepted,
    primaryMisconceptionFlag,
    secondaryFlags,
    evidenceQuality,
    analysisQuality,
    studentFeedback: accepted
      ? 'You named the element, used text evidence, and explained what it adds.'
      : studentFeedbackFor(primaryMisconceptionFlag),
    teacherNote: accepted
      ? 'Student can connect a literary element to meaning/style with supporting evidence.'
      : `${ELA9R11_MISCONCEPTIONS[primaryMisconceptionFlag].teacherDescription} Evidence quality: ${evidenceQuality}. Analysis quality: ${analysisQuality}.`,
    recommendedRoute: route,
  };
}

function studentFeedbackFor(flag: Ela9R11MisconceptionFlag) {
  switch (flag) {
    case 'element_not_identified':
      return 'Name the literary move first, like mood, setting, character, symbol, or structure.';
    case 'evidence_too_general':
    case 'evidence_irrelevant':
      return 'Use a smaller piece of the text: one word, phrase, or detail that proves your idea.';
    case 'effect_confused_with_summary':
    case 'function_not_explained':
      return 'You have the event. Now explain what that detail makes the reader understand or feel.';
    default:
      return 'Make the answer more specific: name the element, point to evidence, and explain what it adds.';
  }
}
