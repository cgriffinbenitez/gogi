import { ELA9R11_MISCONCEPTIONS } from './misconceptions';
import { evaluateEla9R11ConstructedResponse } from './evaluateConstructedResponse';
import {
  ELA9R11_STANDARD_CODE,
  type Ela9R11DiagnosticItem,
  type Ela9R11DiagnosticResult,
  type Ela9R11ItemResult,
  type Ela9R11MisconceptionFlag,
  type Ela9R11StudentAnswer,
  type Ela9R11TeachRoute,
} from './types';

const DEFAULT_ROUTE: Ela9R11TeachRoute = 'strategy';

export function scoreEla9R11Diagnostic(
  items: Ela9R11DiagnosticItem[],
  answers: Ela9R11StudentAnswer[],
): Ela9R11DiagnosticResult {
  const answersByItem = new Map(answers.map((answer) => [answer.itemId, answer]));
  const itemResults: Ela9R11ItemResult[] = items.map((item) => {
    const answer = answersByItem.get(item.id);
    if (item.itemType === 'constructed_response') {
      const constructedEvaluation = answer?.constructedEvaluation
        ?? evaluateEla9R11ConstructedResponse(answer?.constructedResponse ?? '', item);
      const misconceptions = constructedEvaluation.accepted
        ? []
        : [constructedEvaluation.primaryMisconceptionFlag, ...constructedEvaluation.secondaryFlags];

      return {
        itemId: item.id,
        correct: constructedEvaluation.accepted,
        selectedLetter: null,
        subskill: item.subskill,
        keyElement: item.keyElement,
        layerOrEffect: item.layerOrEffect,
        misconceptions,
        teacherRationale: item.teacherRationale ?? item.teacherNote,
        correctAnswerRationale: item.correctAnswerRationale,
        constructedEvaluation,
      };
    }

    const selected = item.options.find((option) => option.letter === answer?.selectedLetter) ?? null;

    return {
      itemId: item.id,
      correct: selected?.correct ?? false,
      selectedLetter: selected?.letter ?? null,
      subskill: item.subskill,
      keyElement: item.keyElement,
      layerOrEffect: item.layerOrEffect,
      misconceptions: selected?.misconceptions ?? ['element_not_identified'],
      teacherRationale: item.teacherRationale ?? item.teacherNote,
      correctAnswerRationale: item.correctAnswerRationale,
      selectedRationale: selected?.rationale,
    };
  });

  const misconceptionCounts = countMisconceptions(itemResults);
  const orderedFlags = orderMisconceptions(misconceptionCounts);
  const primaryMisconception = orderedFlags[0] ?? null;
  const secondaryMisconceptions = orderedFlags.slice(1, 4);
  const recommendedRoute = primaryMisconception
    ? ELA9R11_MISCONCEPTIONS[primaryMisconception].route
    : DEFAULT_ROUTE;
  const correctItems = itemResults.filter((result) => result.correct).length;

  return {
    standardCode: ELA9R11_STANDARD_CODE,
    totalItems: items.length,
    correctItems,
    primaryMisconception,
    secondaryMisconceptions,
    recommendedRoute,
    routeReason: buildRouteReason(primaryMisconception, recommendedRoute),
    itemResults,
    teacherSummary: buildTeacherSummary(correctItems, items.length, primaryMisconception, secondaryMisconceptions),
  };
}

function countMisconceptions(results: Ela9R11ItemResult[]) {
  const counts = new Map<Ela9R11MisconceptionFlag, number>();
  for (const result of results) {
    if (result.correct) continue;
    for (const flag of result.misconceptions) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }
  return counts;
}

function orderMisconceptions(counts: Map<Ela9R11MisconceptionFlag, number>) {
  return [...counts.entries()]
    .sort(([flagA, countA], [flagB, countB]) => {
      if (countA !== countB) return countB - countA;
      return ELA9R11_MISCONCEPTIONS[flagB].priority - ELA9R11_MISCONCEPTIONS[flagA].priority;
    })
    .map(([flag]) => flag);
}

function buildRouteReason(primary: Ela9R11MisconceptionFlag | null, route: Ela9R11TeachRoute) {
  if (!primary) return 'No dominant misconception detected. Send the student to the general 9.R.1.1 strategy run.';
  const spec = ELA9R11_MISCONCEPTIONS[primary];
  return `${spec.label}: ${spec.studentNeed} Route to ${route}.`;
}

function buildTeacherSummary(
  correctItems: number,
  totalItems: number,
  primary: Ela9R11MisconceptionFlag | null,
  secondary: Ela9R11MisconceptionFlag[],
) {
  if (!primary) return `Student answered ${correctItems} of ${totalItems} items correctly. No clear misconception cluster yet.`;

  const primarySpec = ELA9R11_MISCONCEPTIONS[primary];
  const secondaryText = secondary.length
    ? ` Secondary flags: ${secondary.map((flag) => ELA9R11_MISCONCEPTIONS[flag].label).join(', ')}.`
    : '';

  return `Student answered ${correctItems} of ${totalItems} items correctly. Primary need: ${primarySpec.teacherDescription}${secondaryText}`;
}
