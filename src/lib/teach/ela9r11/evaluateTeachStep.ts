import type { TeachLoop, TeachStep, TeachStepEvaluation } from './types';

const EFFECT_WORDS = [
  'shows',
  'reveals',
  'suggests',
  'creates',
  'develops',
  'emphasizes',
  'matters',
  'because',
  'so',
  'reader',
  'meaning',
  'style',
  'mood',
  'theme',
  'trust',
  'choice',
  'feeling',
];

export function evaluateEla9R11TeachStep(
  loop: TeachLoop,
  step: TeachStep,
  response: string,
  isMasteryCheck = false,
): TeachStepEvaluation {
  const clean = response.trim();
  const lower = clean.toLowerCase();

  if (!clean) {
    return revise('Put your thinking on the screen first. One short answer is enough to try.');
  }

  if (step.inputMode === 'chips') {
    return normalize(clean) === normalize(step.expectedMove)
      ? advance('That is the move. Keep going.')
      : revise(feedbackForChip(loop, step));
  }

  const hasElement = includesLoose(lower, loop.targetElement) || includesAny(lower, ['element', 'author uses', 'character', 'setting', 'structure', 'mood', 'tone', 'symbol']);
  const hasEvidence = includesLoose(lower, loop.preciseEvidence) || loop.samplePassage.focusEvidence.some((piece) => includesLoose(lower, piece));
  const hasEffect = includesLoose(lower, loop.targetEffect) || includesAny(lower, EFFECT_WORDS);
  const enoughWords = clean.split(/\s+/).filter(Boolean).length >= (isMasteryCheck ? 14 : 5);

  if (!enoughWords) {
    return revise('Make it a little more complete. Use the frame on the screen and add what the detail proves.');
  }

  if (step.stepType === 'explain_effect' && !hasEffect) {
    return revise('You named something from the text. Now finish the effect: what does it reveal, create, or show?');
  }

  if (step.stepType === 'connect_to_meaning' && !hasEffect) {
    return revise('Push to the so what. Explain what the reader understands because of that exact detail.');
  }

  if ((step.stepType === 'use_evidence' || step.stepType === 'build_response' || step.stepType === 'revise' || step.stepType === 'fade_support' || isMasteryCheck) && !hasEvidence) {
    return revise('Use sharper evidence from the passage. Look for the smallest highlighted phrase that proves the claim.');
  }

  if ((step.stepType === 'build_response' || step.stepType === 'revise' || step.stepType === 'fade_support' || isMasteryCheck) && !hasElement) {
    return revise(`Name the author move first. In this passage, look for ${loop.targetElement}.`);
  }

  if ((step.stepType === 'build_response' || step.stepType === 'revise' || step.stepType === 'fade_support' || isMasteryCheck) && !hasEffect) {
    return revise('You have evidence. Now explain what that evidence proves.');
  }

  return advance(isMasteryCheck
    ? 'That is a complete move: element, evidence, and effect.'
    : 'Good. You made the missing move.');
}

export function evaluateEla9R11TransferCheck(
  loop: TeachLoop,
  response: string,
): TeachStepEvaluation {
  const clean = response.trim();
  const lower = clean.toLowerCase();
  const hasElement = includesLoose(lower, loop.transferPassage.targetElement)
    || includesAny(lower, ['character', 'characterization', 'author uses', 'detail']);
  const hasEvidence = loop.transferPassage.focusEvidence.some((piece) => includesLoose(lower, piece));
  const hasEffect = includesLoose(lower, loop.transferPassage.targetEffect)
    || includesAny(lower, EFFECT_WORDS);
  const enoughWords = clean.split(/\s+/).filter(Boolean).length >= 14;

  if (!enoughWords) return revise('Make this a full response: author move, evidence, and what the evidence proves.');
  if (!hasEvidence) return revise('Use a precise detail from the new passage. Do not reuse the practice passage.');
  if (!hasElement) return revise('Name the author move in this new passage.');
  if (!hasEffect) return revise('You have the evidence. Now explain what it reveals, creates, or changes.');
  return advance('Transfer passed. You used the move on a new passage.');
}

function advance(feedback: string): TeachStepEvaluation {
  return { status: 'advance', feedback, score: 1 };
}

function revise(feedback: string): TeachStepEvaluation {
  return { status: 'revise', feedback, score: 0 };
}

function feedbackForChip(loop: TeachLoop, step: TeachStep) {
  if (step.stepType === 'notice' || step.stepType === 'use_evidence') {
    return `That detail may be related, but it is not sharp enough. Choose the smallest detail that proves the claim.`;
  }
  if (step.stepType === 'name_the_move') {
    return `That label does not fit the job this detail is doing. Look for ${loop.targetElement}.`;
  }
  return 'That choice keeps the answer too general. The job is to prove the exact claim, not just mention the story.';
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesLoose(text: string, target: string) {
  const normalizedTarget = normalize(target);
  if (!normalizedTarget) return false;
  return normalize(text).includes(normalizedTarget);
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}
