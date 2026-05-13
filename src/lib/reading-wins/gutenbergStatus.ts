import { FAST_GRADE9_READING_DEMANDS } from './fastSkillMap';
import { mapGutenbergClassificationToFastStandard } from './gutenbergBridge';

export type GutenbergPipelinePassageStatusRow = {
  id: string;
  classification: string | null;
  source?: string | null;
  standard_code?: string | null;
  approval_status: string | null;
  approved: boolean | null;
  source_title: string | null;
  source_author: string | null;
};

export type GutenbergPromotedQuestionStatusRow = {
  content: string | null;
  cognitive_skill_targeted: string | null;
  source_classification: string | null;
  source?: string | null;
};

export type GutenbergReadingWinStatusRow = {
  standard_code: string;
  teacher_title: string;
  approved_passages: number;
  pending_review_passages: number;
  rejected_passages: number;
  unpromoted_approved_passages: number;
  promoted_question_rows: number;
  trusted_promoted_question_rows: number;
  audit_promoted_question_rows: number;
  sample_titles: string[];
};

export function extractGutenbergPassageIdFromQuestion(content: string | null) {
  if (!content) return null;
  return (
    content.match(/Project Gutenberg passage ([0-9a-f-]{8,})/i)?.[1] ??
    content.match(/GOGI rights-managed passage ([0-9a-f-]{8,})/i)?.[1] ??
    null
  );
}

function normalizedApprovalStatus(row: GutenbergPipelinePassageStatusRow) {
  if (row.approval_status === 'approved' || row.approved === true) return 'approved';
  if (row.approval_status === 'rejected') return 'rejected';
  return 'pending_review';
}

function section(content: string | null, label: string) {
  if (!content) return '';
  const pattern = new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z_ ]+:\\n|$)`, 'i');
  return content.match(pattern)?.[1]?.trim() ?? '';
}

function hasWeakGenericStem(questionText: string) {
  return /what does (it|this|the phrase|the comparison|the personification|the imagery) suggest in context/i.test(
    questionText
  );
}

function isTrustedPromotedQuestion(question: GutenbergPromotedQuestionStatusRow) {
  const quality = section(question.content, 'FAST_ITEM_QUALITY');
  const targetSkill = section(question.content, 'TARGET_SKILL');
  const questionText = section(question.content, 'QUESTION');
  const trustNote = section(question.content, 'TEACHER_TRUST_NOTE');
  const hasSkillMove = Boolean(section(question.content, 'GOGI_SKILL_MOVE'));

  return (
    /strong signal/i.test(quality) &&
    Boolean(targetSkill) &&
    !/official_text_candidate|official benchmark-aligned content/i.test(targetSkill) &&
    Boolean(questionText) &&
    !hasWeakGenericStem(questionText) &&
    Boolean(trustNote) &&
    hasSkillMove
  );
}

export function buildGutenbergReadingWinStatus(args: {
  passages: GutenbergPipelinePassageStatusRow[];
  promotedQuestions: GutenbergPromotedQuestionStatusRow[];
}): GutenbergReadingWinStatusRow[] {
  const promotedPassageIds = new Set(
    args.promotedQuestions
      .map((question) => extractGutenbergPassageIdFromQuestion(question.content))
      .filter((id): id is string => Boolean(id))
  );
  const rowsByStandard = new Map<string, GutenbergReadingWinStatusRow>();

  for (const demand of FAST_GRADE9_READING_DEMANDS) {
    rowsByStandard.set(demand.standardCode, {
      standard_code: demand.standardCode,
      teacher_title: demand.teacherTitle,
      approved_passages: 0,
      pending_review_passages: 0,
      rejected_passages: 0,
      unpromoted_approved_passages: 0,
      promoted_question_rows: args.promotedQuestions.filter(
        (question) =>
          question.cognitive_skill_targeted === demand.standardCode ||
          question.source_classification === demand.standardCode
      ).length,
      trusted_promoted_question_rows: args.promotedQuestions.filter(
        (question) =>
          (question.cognitive_skill_targeted === demand.standardCode ||
            question.source_classification === demand.standardCode) &&
          isTrustedPromotedQuestion(question)
      ).length,
      audit_promoted_question_rows: 0,
      sample_titles: [],
    });
    const row = rowsByStandard.get(demand.standardCode)!;
    row.audit_promoted_question_rows =
      row.promoted_question_rows - row.trusted_promoted_question_rows;
  }

  for (const passage of args.passages) {
    const standardCode =
      passage.standard_code?.trim() ||
      (passage.classification
        ? mapGutenbergClassificationToFastStandard(passage.classification)
        : null);
    if (!standardCode) continue;

    const row = rowsByStandard.get(standardCode);
    if (!row) continue;

    const status = normalizedApprovalStatus(passage);
    if (status === 'approved') {
      row.approved_passages += 1;
      if (!promotedPassageIds.has(passage.id)) {
        row.unpromoted_approved_passages += 1;
      }
    } else if (status === 'rejected') {
      row.rejected_passages += 1;
    } else {
      row.pending_review_passages += 1;
    }

    const title = passage.source_title?.trim();
    const author = passage.source_author?.trim();
    const label = title ? (author ? `${title} — ${author}` : title) : null;
    if (label && row.sample_titles.length < 3 && !row.sample_titles.includes(label)) {
      row.sample_titles.push(label);
    }
  }

  return [...rowsByStandard.values()].filter(
    (row) =>
      row.approved_passages > 0 ||
      row.pending_review_passages > 0 ||
      row.rejected_passages > 0 ||
      row.promoted_question_rows > 0
  );
}
