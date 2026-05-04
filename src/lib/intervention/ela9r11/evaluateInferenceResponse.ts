import type { InferenceEvaluation, InferencePoint } from './types';

const GENERIC_WORDS = [
  'good',
  'bad',
  'sad',
  'happy',
  'mad',
  'thing',
  'stuff',
  'something',
  'shows emotion',
  'it shows feeling',
];

export function evaluateInferenceResponse(point: InferencePoint, response: string, attemptNumber: number): InferenceEvaluation {
  const normalized = response.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasEnoughWords = wordCount >= 6;
  const evidenceHits = point.evidence.filter((piece) => normalized.includes(piece.toLowerCase()));
  const hasEvidence = evidenceHits.length > 0 || /"[^"]+"/.test(response);
  const hasEffect = point.effectSignals.some((signal) => normalized.includes(signal.toLowerCase()));
  const isGeneric = GENERIC_WORDS.some((word) => normalized.includes(word));

  if (attemptNumber >= 2 && hasEnoughWords) {
    return {
      quality: 'partial',
      scaffoldMove: hasEvidence ? 'explain_the_effect' : 'find_the_move',
      feedback: `${point.guidedClose} ${point.continueCue}`,
      canAdvance: true,
    };
  }

  if (!hasEnoughWords || isGeneric) {
    return {
      quality: 'weak',
      scaffoldMove: 'find_the_move',
      feedback: point.scaffoldPrompts.find_the_move,
      canAdvance: false,
    };
  }

  if (hasEffect || hasEvidence) {
    return {
      quality: 'strong',
      scaffoldMove: hasEvidence ? 'prove_it_with_evidence' : 'explain_the_effect',
      feedback: `Yes. That is a real reader move. You used a clue from the passage to build understanding. ${point.continueCue}`,
      canAdvance: true,
    };
  }

  if (wordCount >= 10) {
    return {
      quality: 'partial',
      scaffoldMove: 'explain_the_effect',
      feedback: `${point.scaffoldPrompts.explain_the_effect} ${point.continueCue}`,
      canAdvance: true,
    };
  }

  return {
    quality: 'partial',
    scaffoldMove: 'find_the_move',
    feedback: point.scaffoldPrompts.find_the_move,
    canAdvance: false,
  };
}
