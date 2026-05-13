'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpenCheck, CheckCircle2, RefreshCw, Send, XCircle } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';
import {
  getOfficialFastCoverageSummary,
  getOfficialFastPipelineSeedsForStandard,
  getOfficialFastTextModelsForStandard,
  isOfficialFastAlignedSource,
  type OfficialFastTextModel,
} from '@/lib/reading-wins/officialFastSources';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';

type PromotedQuestion = {
  id: string;
  content: string | null;
  title: string | null;
  option_a_text: string | null;
  option_b_text: string | null;
  option_c_text: string | null;
  option_d_text: string | null;
  correct_option: string | null;
  rationale: string | null;
  difficulty_level: number | null;
};

type GeneratedItemPreview = {
  question: string | null;
  options: string | null;
  answer: string | null;
  target_standard: string | null;
  target_skill: string | null;
  quality: string | null;
  teacher_trust_note: string | null;
  rationale: string | null;
  difficulty_level: number | null;
};

type GutenbergPassageRow = {
  id: string;
  created_at: string | null;
  reviewed_at: string | null;
  classification: string;
  source: string | null;
  standard_code: string | null;
  coverage_strand_id?: string | null;
  coverage_strand_label?: string | null;
  coverage_strand_signals?: string[] | null;
  paragraph_text: string;
  word_count: number;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  source_gutenberg_id: number | null;
  intervention_tier: number | null;
  target_signal: string | null;
  supporting_evidence: Array<{ element: string; rationale: string }> | null;
  non_supporting_evidence: Array<{ element: string; rationale: string }> | null;
  approval_status: string | null;
  approved: boolean | null;
  rejection_reason: string | null;
  generated_item_preview: GeneratedItemPreview | null;
  ald_purpose?: {
    score: number | null;
    questions: Array<{
      category_code: string;
      category_name: string;
      question: string;
      content_use: string;
    }>;
    reasons: string[];
  } | null;
  promoted_question_count: number;
  promoted_questions: PromotedQuestion[];
};

type PromotedReviewItem = {
  row: GutenbergPassageRow;
  question: PromotedQuestion;
  preview: GeneratedItemPreview;
  taxonomy: CleanTaxonomy;
};

type WorkbenchTab = 'overview' | 'official' | 'texts' | 'passages' | 'promoted' | 'harvest';

type ExcerptSort = 'newest' | 'ald' | 'readiness';

type TextCoverageRow = {
  title: string;
  author: string | null;
  pipeline_use: 'priority_seed' | 'style_model_only' | 'rights_limited_reference';
  source_documents: string[];
  standards: string[];
  uploaded_standards: string[];
  missing_standards: string[];
  uploaded_excerpt_count: number;
  stored_word_count: number;
  local_text_path: string | null;
  status: 'stored' | 'uploaded' | 'harvestable' | 'rights_needed' | 'style_model';
};

type OfficialTextLibraryEntry = {
  title: string;
  author: string | null;
  access: string;
  pipeline_use: string;
  source_documents: string[];
  standards: string[];
  gutenberg_ids: number[];
  discovered_gutenberg_id: number | null;
  status: 'stored' | 'manual_upload' | 'needs_upload' | 'reference_only' | 'needs_gutenberg_match' | 'fetch_failed';
  text_path: string | null;
  char_count: number;
  word_count: number;
  notes: string;
};

type OfficialTextLibraryManifest = {
  generated_at: string;
  scope: string;
  totals: {
    texts: number;
    stored: number;
    manual_upload?: number;
    needs_upload: number;
    reference_only: number;
    fetch_failed: number;
    needs_gutenberg_match: number;
  };
  by_standard: Record<string, { stored: number; total: number; texts: string[] }>;
  entries: OfficialTextLibraryEntry[];
};

type PassageReviewEntry = {
  row: GutenbergPassageRow;
  question: PromotedQuestion | null;
  preview: GeneratedItemPreview | null;
  taxonomy: CleanTaxonomy;
};

type HarvestStatus = {
  file: string;
  log_path: string;
  modified_at: string;
  status: 'starting' | 'fetching' | 'filtering' | 'writing' | 'complete' | 'failed' | 'quiet';
  tail: string[];
};

type HarvestIntelligence = {
  totals: {
    candidates_seen: number;
    suitable: number;
    rejected: number;
    write_errors: number;
    inserted: number;
  };
  books: Array<{
    title: string;
    author: string;
    total: number;
    suitable: number;
    rejected: number;
    errors: number;
    yield_rate: number;
    recommendation: string;
  }>;
  rejection_buckets: Array<{ label: string; count: number }>;
  recommendations: string[];
};

type LibraryStatusRow = {
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

const OFFICIAL_STANDARD_LABELS: Record<string, string> = {
  'ELA.9.R.1.4': 'Epic poetry',
  'ELA.9.R.3.2': 'Grade-level paraphrase',
  'ELA.9.V.1.2': 'Morphology',
  'ELA.9.V.1.3': 'Context and connotation',
};

function displayStatus(row: GutenbergPassageRow) {
  if (row.approval_status === 'approved' || row.approved) return 'approved';
  if (row.approval_status === 'rejected') return 'rejected';
  return 'pending_review';
}

function statusClasses(status: string) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function sourceLabel(row: GutenbergPassageRow) {
  const title = row.source_title?.trim() || 'Public domain passage';
  const author = row.source_author?.trim();
  const year = row.source_year ? ` (${row.source_year})` : '';
  return author ? `${title} — ${author}${year}` : `${title}${year}`;
}

function createdAtMs(row: GutenbergPassageRow) {
  const parsed = row.created_at ? Date.parse(row.created_at) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function titleKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function formatCreatedAt(value: string | null) {
  if (!value) return 'Date not recorded';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Date not recorded';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(parsed));
}

function officialSourceBadgeClasses(model: OfficialFastTextModel) {
  if (model.pipelineUse === 'priority_seed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (model.pipelineUse === 'style_model_only') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function officialSourceBadgeClassesForModel(model: OfficialFastTextModel, uploadedCount: number) {
  if (uploadedCount > 0) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return officialSourceBadgeClasses(model);
}

function officialSourceBadgeLabel(model: OfficialFastTextModel, uploadedCount = 0) {
  if (uploadedCount > 0) return 'Uploaded';
  if (model.pipelineUse === 'priority_seed') return 'Needs source';
  if (model.pipelineUse === 'style_model_only') return 'Style model';
  return 'Rights-needed';
}

function officialSourceUsageLine(model: OfficialFastTextModel, uploadedCount = 0) {
  if (uploadedCount > 0) {
    return `${uploadedCount} rights-managed excerpt candidate${
      uploadedCount === 1 ? '' : 's'
    } are now in GOGI for this work and standard.`;
  }
  if (model.pipelineUse === 'priority_seed') {
    return 'GOGI can harvest this public-domain text directly into the passage library.';
  }
  if (model.pipelineUse === 'style_model_only') {
    return 'Use this official FAST text to model rigor and item style; do not reuse as student passage text without rights.';
  }
  return 'Keep this work in the official registry. Upload/use excerpts only with school, publisher, public-domain, or other rights clearance.';
}

function textCoverageStatusClasses(status: TextCoverageRow['status']) {
  if (status === 'stored') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'uploaded') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'harvestable') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'style_model') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function textCoverageStatusLabel(status: TextCoverageRow['status']) {
  if (status === 'stored') return 'Stored';
  if (status === 'uploaded') return 'Uploaded';
  if (status === 'harvestable') return 'Needs source';
  if (status === 'style_model') return 'Style model';
  return 'Rights-needed';
}

function officialLibraryStatusClasses(status: OfficialTextLibraryEntry['status']) {
  if (status === 'stored') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'manual_upload') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'reference_only') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'fetch_failed' || status === 'needs_gutenberg_match') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function officialLibraryStatusLabel(status: OfficialTextLibraryEntry['status']) {
  if (status === 'stored') return 'Stored';
  if (status === 'manual_upload') return 'Manual full text';
  if (status === 'reference_only') return 'Reference only';
  if (status === 'fetch_failed') return 'Fetch failed';
  if (status === 'needs_gutenberg_match') return 'Needs Gutenberg match';
  return 'Needs upload';
}

function truncate(value: string, max = 560) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
}

function extractQuestionSection(content: string | null, section: string) {
  if (!content) return null;
  const pattern = new RegExp(`${section}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z_]+:|$)`, 'i');
  return content.match(pattern)?.[1]?.trim() ?? null;
}

function promotedQuestionPreview(question: PromotedQuestion): GeneratedItemPreview {
  return {
    question: extractQuestionSection(question.content, 'QUESTION'),
    options:
      extractQuestionSection(question.content, 'OPTIONS') ??
      [
        question.option_a_text ? `A. ${question.option_a_text}` : null,
        question.option_b_text ? `B. ${question.option_b_text}` : null,
        question.option_c_text ? `C. ${question.option_c_text}` : null,
        question.option_d_text ? `D. ${question.option_d_text}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    answer: question.correct_option,
    target_standard: extractQuestionSection(question.content, 'TARGET_STANDARD'),
    target_skill: extractQuestionSection(question.content, 'TARGET_SKILL'),
    quality: extractQuestionSection(question.content, 'FAST_ITEM_QUALITY'),
    teacher_trust_note: extractQuestionSection(question.content, 'TEACHER_TRUST_NOTE'),
    rationale: question.rationale,
    difficulty_level: question.difficulty_level,
  };
}

type ReviewDecision = {
  label: 'Strong candidate' | 'Teacher skim' | 'Reject risk';
  score: number;
  tone: 'green' | 'amber' | 'rose';
  reasons: string[];
};

type ReadinessDecision = {
  label: 'Ready for students' | 'Needs standard fix' | 'Needs student item' | 'Remove from library';
  tone: 'green' | 'blue' | 'amber' | 'rose';
  action: string;
  reasons: string[];
};

type CleanTaxonomy = {
  standardCode: string | null;
  strandId: string | null;
  strandLabel: string;
  skill: string;
  studentMove: string;
  itemType: string;
  harvestSignals: string[];
  metadataMatches: boolean;
};

const STRAND_HINTS: Record<string, Record<string, RegExp[]>> = {
  'ELA.9.R.1.1': {
    'literal-detail-to-layer': [
      /symbolic object|revealing setting|setting detail|object|description|plot detail/i,
    ],
    'style-or-meaning-effect': [
      /style shift|mood-bearing|character-revealing|characterization|theme|tension|effect/i,
    ],
  },
  'ELA.9.R.1.2': {
    'topic-vs-theme': [/topic|theme statement|universal statement|life lesson|moral/i],
    'theme-development-moments': [/repeated idea|character choice|consequence|realization|develop/i],
    'theme-evidence-fit': [/evidence|prove|support|near-topic|weak evidence|strong theme/i],
  },
  'ELA.9.R.1.3': {
    'speaker-reader-gap': [/reader knows|surface meaning|intended meaning|limited narrator|gap/i],
    'irony-reversal-contrast': [/irony|reversal|contradiction|unexpected contrast/i],
    'satire-exaggeration-ridicule': [/satire|mocking|ridicule|absurd|exaggeration|social criticism/i],
    'perspective-effect-evidence': [/attitude|perspective|tone evidence|wording|speaker/i],
  },
  'ELA.9.R.2.1': {
    'structure-types': [/description|problem solution|chronological|compare contrast|cause effect|sequence/i],
    'paragraph-job': [/paragraph|section|introduces|contrasts|extends|shift|concludes|example/i],
    'feature-purpose': [/heading|caption|chart|graph|annotation|footnote|feature/i],
    'structure-to-author-purpose': [/author purpose|meaning built|reader effect|purpose/i],
  },
  'ELA.9.R.2.2': {
    'central-idea-identification': [/central idea|main idea|topic distractor|detail-only/i],
    'support-development': [/develop|example support|reason support|description support|paragraphs/i],
    'strong-vs-weak-evidence': [/strong evidence|weak evidence|irrelevant|best supports|proof/i],
  },
  'ELA.9.R.2.3': {
    'logos-ethos-pathos': [/logos|ethos|pathos|logic|credibility|emotion|appeal/i],
    'figurative-language-for-purpose': [/metaphor|imagery|analogy|figurative.*purpose|persuasion/i],
    'appropriateness-of-appeal': [/audience fit|purpose fit|appropriate|effective|effectiveness/i],
  },
  'ELA.9.R.2.4': {
    'separate-opposing-claims': [/opposing claim|same topic|claim sorting|each side/i],
    'compare-evidence-development': [/evidence comparison|reasoning comparison|compare.*develop/i],
    'validity-effectiveness': [/validity|sound reasoning|unsupported claim|weak evidence|better supported/i],
  },
  'ELA.9.R.3.1': {
    'metaphor-simile': [/simile|metaphor|like|as if|as though|comparison without literal intent/i],
    personification: [/personification|nonhuman|human verb|human feeling/i],
    'imagery-sensory-language': [/imagery|sensory|visual|auditory|tactile|smell|sound|color|sight/i],
    'hyperbole-understatement': [/hyperbole|understatement|exaggerat|meiosis/i],
    'sound-devices': [/alliteration|onomatopoeia|sound device|repeated sound/i],
    'allusion-idiom-symbol': [/allusion|idiom|symbol|symbolic detail/i],
    'mood-effect-evidence': [/mood|ominous|dread|wistful|oppressive|tranquil|melancholy|eerie|effect language/i],
  },
  'ELA.9.R.3.3': {
    'source-pattern': [/source pattern|mythic|classical|religious|traditional|original source/i],
    'adaptation-same-and-changed': [/adaptation|stayed|changed|keeps|removes|emphasizes|shared element/i],
    'adaptation-effect': [/changed meaning|changed theme|changed tone|new purpose|reader effect/i],
  },
  'ELA.9.R.3.4': {
    'rhetorical-device-effect': [
      /repetition|contrast|analogy|rhetorical question|figurative wording|device effect/i,
    ],
    'reader-belief-feeling-notice': [/reader belief|emotional effect|attention focus|feel|notice/i],
    'rhetoric-to-purpose': [/author purpose|effect on audience|purposeful wording|purpose/i],
  },
  'ELA.9.V.1.2': {
    'prefix-root-suffix': [/prefix|root|suffix|derivation|word part/i],
    'etymology-origin-clue': [/etymology|origin clue|related word|word origin/i],
    'test-word-part-in-context': [/context test|meaning fit|nearby clue|fits the sentence/i],
  },
  'ELA.9.V.1.3': {
    'context-clues': [/context clue|definition clue|restatement|example clue|nearby/i],
    'connotation-denotation': [/connotation|denotation|emotional charge|positive|negative|literal meaning/i],
    'word-relationships': [/synonym|antonym|contrast relationship|category clue|relationship/i],
    'figurative-phrase-meaning': [/figurative phrase|idiomatic|phrase in context|idiom/i],
  },
};

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
}

function scoreStrandMatch(
  strand: NonNullable<
    NonNullable<ReturnType<typeof getGutenbergStandardBlueprint>>['coverageStrands']
  >[number],
  row: GutenbergPassageRow,
  standardCode: string,
  combined: string
) {
  let score = 0;
  const strandText = normalizeForMatch(
    `${strand.id} ${strand.label} ${strand.studentCanDo} ${strand.harvestSignals.join(' ')}`
  );
  const target = normalizeForMatch(row.target_signal ?? '');

  if (row.coverage_strand_id === strand.id) score += 100;
  if (row.coverage_strand_label === strand.label) score += 60;
  if (strand.classifications?.includes(row.classification as never)) score += 4;
  if (!strand.classifications && row.classification) score += 1;

  for (const signal of strand.harvestSignals) {
    const normalizedSignal = normalizeForMatch(signal);
    if (normalizedSignal && combined.includes(normalizedSignal)) score += 10;
    for (const token of normalizedSignal.split(' ').filter((item) => item.length > 3)) {
      if (combined.includes(token)) score += 2;
    }
  }

  for (const token of strandText.split(' ').filter((item) => item.length > 4)) {
    if (target && token === target) score += 6;
    else if (target && token.includes(target)) score += 3;
    else if (combined.includes(token)) score += 1;
  }

  for (const pattern of STRAND_HINTS[standardCode]?.[strand.id] ?? []) {
    if (pattern.test(combined)) score += 15;
  }

  return score;
}

function reviewDecision(row: GutenbergPassageRow): ReviewDecision {
  const reasons: string[] = [];
  let score = 0;
  const supportingCount = row.supporting_evidence?.length ?? 0;
  const nonSupportingCount = row.non_supporting_evidence?.length ?? 0;

  if (row.target_signal?.trim()) {
    score += 1;
    reasons.push(`clear target: ${row.target_signal}`);
  }
  if (supportingCount >= 2) {
    score += 1;
    reasons.push(`${supportingCount} supporting evidence points`);
  }
  if (nonSupportingCount >= 2) {
    score += 1;
    reasons.push(`${nonSupportingCount} distractor anchors`);
  }
  if (row.word_count >= 120 && row.word_count <= 280) {
    score += 1;
    reasons.push('student-manageable length');
  }
  if ((row.intervention_tier ?? 4) <= 2) {
    score += 1;
    reasons.push(`Tier ${row.intervention_tier}`);
  }
  if (row.generated_item_preview?.quality?.includes('strong signal')) {
    score += 1;
    reasons.push('student-ready practice item');
  }

  if (score >= 5) return { label: 'Strong candidate', score, tone: 'green', reasons };
  if (score >= 2) return { label: 'Teacher skim', score, tone: 'amber', reasons };
  return { label: 'Reject risk', score, tone: 'rose', reasons };
}

function reviewDecisionClasses(tone: ReviewDecision['tone']) {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function inferCleanTaxonomy(
  row: GutenbergPassageRow,
  blueprint: ReturnType<typeof getGutenbergStandardBlueprint> | undefined
): CleanTaxonomy {
  const standardCode = row.standard_code ?? blueprint?.standardCode ?? null;
  const target = row.target_signal?.toLowerCase().trim() ?? '';
  const evidenceText = (row.supporting_evidence ?? [])
    .map((item) => `${item.element} ${item.rationale}`)
    .join(' ')
    .toLowerCase();
  const previewText = [
    row.generated_item_preview?.question,
    row.generated_item_preview?.target_skill,
    row.generated_item_preview?.teacher_trust_note,
    row.generated_item_preview?.rationale,
  ]
    .filter(Boolean)
    .join(' ');
  const combined = normalizeForMatch(
    [
      target,
      row.classification,
      row.coverage_strand_label,
      row.coverage_strand_signals?.join(' '),
      evidenceText,
      previewText,
      row.paragraph_text.slice(0, 800),
    ]
      .filter(Boolean)
      .join(' ')
  );
  const strandScores =
    blueprint?.coverageStrands
      ?.map((item) => ({
        strand: item,
        score: standardCode ? scoreStrandMatch(item, row, standardCode, combined) : 0,
      }))
      .sort((a, b) => b.score - a.score) ?? [];
  let strand = strandScores[0]?.strand ?? blueprint?.coverageStrands?.[0] ?? null;

  if (blueprint?.standardCode === 'ELA.9.R.3.1') {
    const directR31 =
      target === 'simile' || target === 'metaphor'
        ? 'metaphor-simile'
        : target === 'imagery'
          ? 'imagery-sensory-language'
          : target === 'personification'
            ? 'personification'
            : target === 'hyperbole' || target === 'understatement'
              ? 'hyperbole-understatement'
              : target === 'symbol' || target === 'allusion' || target === 'idiom'
                ? 'allusion-idiom-symbol'
                : null;
    if (directR31) {
      strand = blueprint.coverageStrands?.find((item) => item.id === directR31) ?? strand;
    }
  }

  const skill =
    row.generated_item_preview?.target_skill ??
    row.coverage_strand_label ??
    row.target_signal ??
    strand?.label ??
    row.classification.replace(/_/g, ' ');
  const strandLabel = strand?.label ?? row.coverage_strand_label ?? skill;
  const studentMove =
    strand?.studentCanDo ?? blueprint?.studentMove ?? 'Use evidence to explain the reading move.';
  const itemType =
    blueprint?.standardCode === 'ELA.9.R.3.1'
      ? 'Meaning/effect in context'
      : blueprint?.teacherLabel ?? 'FAST-style evidence item';
  const metadataMatches = Boolean(
    standardCode &&
      row.standard_code === standardCode &&
      (!strand?.id || row.coverage_strand_id === strand.id) &&
      (!strand?.label || row.coverage_strand_label === strand.label)
  );

  return {
    standardCode,
    strandId: strand?.id ?? null,
    strandLabel,
    skill,
    studentMove,
    itemType,
    harvestSignals: strand?.harvestSignals ?? row.coverage_strand_signals ?? [],
    metadataMatches,
  };
}

function readinessClasses(tone: ReadinessDecision['tone']) {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function workflowStepFor(row: GutenbergPassageRow) {
  const rowStatus = displayStatus(row);
  const hasPackage = Boolean(row.generated_item_preview);
  const promoted = row.promoted_question_count > 0;

  if (promoted) {
    return {
      label: 'In student library',
      tone: 'green',
      next: 'This item is now available for student practice.',
    };
  }
  if (!hasPackage) {
    return {
      label: 'Step 1: Raw excerpt',
      tone: 'amber',
      next: 'Build the student question before approving or using this with students.',
    };
  }
  if (rowStatus !== 'approved') {
    return {
      label: 'Step 2: Review item',
      tone: 'blue',
      next: 'Read the generated question, choices, evidence, and trust note. Approve only if it looks FAST-aligned.',
    };
  }
  return {
    label: 'Step 3: Ready to promote',
    tone: 'green',
      next: 'This item is approved. Send it to the student library.',
  };
}

function generatedItemMatchesTaxonomy(
  preview: GeneratedItemPreview | null,
  taxonomy: CleanTaxonomy
) {
  if (!preview?.question) return false;
  const question = preview.question.toLowerCase();
  const weakGenericStem =
    /what does (it|this|the phrase|the comparison|the personification|the imagery) suggest in context/i.test(
      preview.question
    );
  const strand = `${taxonomy.strandId ?? ''} ${taxonomy.strandLabel}`.toLowerCase();
  const figurativeStrand =
    /metaphor|simile|personification|imagery|sensory|hyperbole|understatement|alliteration|onomatopoeia|allusion|idiom|symbol/.test(
      strand
    );

  if (weakGenericStem) return false;
  if (!figurativeStrand) return true;

  return (
    /(phrase|figurative|comparison|image|imagery|personification|symbol|allusion|idiom|sound|language|meaning|develop|mood|reader|understand|effect)/i.test(
      question
    ) &&
    !/read this detail from the passage:.*how does this detail affect the mood/i.test(question)
  );
}

function hasMetadataMismatch(
  row: GutenbergPassageRow,
  blueprint: ReturnType<typeof getGutenbergStandardBlueprint> | undefined
) {
  const taxonomy = inferCleanTaxonomy(row, blueprint);
  const target = row.target_signal?.toLowerCase().trim();
  if (!taxonomy.metadataMatches) return true;
  if (!target || !taxonomy.skill) return true;
  return false;
}

function readinessDecision(
  row: GutenbergPassageRow,
  blueprint?: ReturnType<typeof getGutenbergStandardBlueprint>
): ReadinessDecision {
  const reasons: string[] = [];
  const preview = row.generated_item_preview;
  const review = reviewDecision(row);

  if (review.label === 'Reject risk') {
    return {
      label: 'Remove from library',
      tone: 'rose',
      action: 'Reject',
      reasons: ['low review score', ...review.reasons],
    };
  }

  if (!preview) {
    return {
      label: 'Needs student item',
      tone: 'amber',
      action: 'Build student item',
      reasons: ['GOGI has not built the student question yet'],
    };
  }

  if (hasMetadataMismatch(row, blueprint)) {
    reasons.push('standard/strand/skill metadata needs cleanup');
    return {
      label: 'Needs standard fix',
      tone: 'blue',
      action: 'Fix standard tag',
      reasons,
    };
  }

  if (!preview.quality?.includes('strong signal')) {
    return {
      label: 'Needs student item',
      tone: 'amber',
      action: 'Rebuild student item',
      reasons: [
        `quality is ${preview.quality ?? 'not available'}`,
        'question, evidence, or answer choices need a stronger build',
      ],
    };
  }

  return {
    label: 'Ready for students',
    tone: 'green',
    action: 'Approve/send',
    reasons: ['strong student item', ...(preview.teacher_trust_note ? [preview.teacher_trust_note] : [])],
  };
}

export default function GutenbergLibraryPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [standardCode, setStandardCode] = useState(
    searchParams.get('standard') ?? searchParams.get('standard_code') ?? 'ELA.9.R.3.1'
  );
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [activeWorkbenchTab, setActiveWorkbenchTab] = useState<WorkbenchTab>(
      initialTab === 'passages' ||
      initialTab === 'promoted' ||
      initialTab === 'texts' ||
      initialTab === 'official' ||
      initialTab === 'harvest' ||
      initialTab === 'overview'
      ? initialTab
      : 'overview'
  );
  const [rows, setRows] = useState<GutenbergPassageRow[]>([]);
  const [excerptSort, setExcerptSort] = useState<ExcerptSort>('newest');
  const [showAdvancedReview, setShowAdvancedReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingRows, setRefreshingRows] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [miningOfficialTexts, setMiningOfficialTexts] = useState(false);
  const [harvesting, setHarvesting] = useState(false);
  const [harvestStatus, setHarvestStatus] = useState<HarvestStatus | null>(null);
  const [harvestIntelligence, setHarvestIntelligence] = useState<HarvestIntelligence | null>(null);
  const [libraryStatusRows, setLibraryStatusRows] = useState<LibraryStatusRow[]>([]);
  const [rightsCoverageCounts, setRightsCoverageCounts] = useState<Record<string, number>>({});
  const [officialLibrary, setOfficialLibrary] = useState<OfficialTextLibraryManifest | null>(null);
  const [syncingManualUploads, setSyncingManualUploads] = useState(false);
  const [textCoverageRows, setTextCoverageRows] = useState<TextCoverageRow[]>([]);
  const [textCoverageTotals, setTextCoverageTotals] = useState({
    texts: 0,
    stored: 0,
    uploaded: 0,
    harvestable: 0,
    rights_needed: 0,
    style_model: 0,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);
  const [manualImport, setManualImport] = useState({
    sourceTitle: '',
    sourceAuthor: '',
    rightsBasis: '',
    targetSignal: '',
    coverageStrandId: '',
    paragraphText: '',
    saveAsFullText: true,
  });

  const selectedDemand = FAST_GRADE9_READING_DEMANDS.find(
    (demand) => demand.standardCode === standardCode
  );
  const selectedBlueprint = getGutenbergStandardBlueprint(standardCode);
  const officialCoverageSummary = useMemo(() => getOfficialFastCoverageSummary(), []);
  const officialStandardOptions = useMemo(() => {
    const demandOptions = FAST_GRADE9_READING_DEMANDS.map((demand) => ({
      standardCode: demand.standardCode,
      label: demand.teacherTitle,
    }));
    const demandCodes = new Set(demandOptions.map((option) => option.standardCode));
    const officialOnlyOptions = officialCoverageSummary
      .filter((row) => !demandCodes.has(row.standardCode))
      .map((row) => ({
        standardCode: row.standardCode,
        label: OFFICIAL_STANDARD_LABELS[row.standardCode] ?? 'Official B.E.S.T. text map',
      }));

    return [...demandOptions, ...officialOnlyOptions].sort((a, b) =>
      a.standardCode.localeCompare(b.standardCode)
    );
  }, [officialCoverageSummary]);
  const selectedOfficialTexts = useMemo(
    () => getOfficialFastTextModelsForStandard(standardCode),
    [standardCode]
  );
  const selectedOfficialTextCards = useMemo(() => {
    const byWork = new Map<string, OfficialFastTextModel>();
    for (const model of selectedOfficialTexts) {
      const key = `${model.title.trim().toLowerCase()}::${model.author?.trim().toLowerCase() ?? ''}`;
      const existing = byWork.get(key);
      if (!existing) {
        byWork.set(key, model);
        continue;
      }

      byWork.set(key, {
        ...existing,
        sourceDocument:
          existing.sourceDocument === '2025 Grade 9 FAST ELA Reading Released Items'
            ? existing.sourceDocument
            : model.sourceDocument,
        pipelineUse:
          existing.pipelineUse === 'priority_seed' || model.pipelineUse === 'priority_seed'
            ? 'priority_seed'
            : existing.pipelineUse === 'style_model_only' || model.pipelineUse === 'style_model_only'
              ? 'style_model_only'
              : 'rights_limited_reference',
        access:
          existing.access === 'public_domain' || model.access === 'public_domain'
            ? 'public_domain'
            : existing.access,
        standards: [...new Set([...existing.standards, ...model.standards])],
        itemNumbers: [...new Set([...(existing.itemNumbers ?? []), ...(model.itemNumbers ?? [])])],
        gutenbergIds: [...new Set([...(existing.gutenbergIds ?? []), ...(model.gutenbergIds ?? [])])],
        priorityAuthors: [
          ...new Set([...(existing.priorityAuthors ?? []), ...(model.priorityAuthors ?? [])]),
        ],
        gutendexSearchTerms: [
          ...new Set([
            ...(existing.gutendexSearchTerms ?? []),
            ...(model.gutendexSearchTerms ?? []),
          ]),
        ],
      });
    }
    return [...byWork.values()];
  }, [selectedOfficialTexts]);
  const selectedOfficialSeeds = useMemo(
    () => getOfficialFastPipelineSeedsForStandard(standardCode),
    [standardCode]
  );
  const officialLibraryEntriesForStandard = useMemo(() => {
    return (officialLibrary?.entries ?? [])
      .filter((entry) => entry.standards.includes(standardCode))
      .sort((a, b) => {
        const rank: Record<OfficialTextLibraryEntry['status'], number> = {
          stored: 0,
          manual_upload: 1,
          needs_upload: 2,
          reference_only: 2,
          needs_gutenberg_match: 3,
          fetch_failed: 4,
        };
        const diff = rank[a.status] - rank[b.status];
        return diff || a.title.localeCompare(b.title);
      });
  }, [officialLibrary, standardCode]);
  const rightsManagedCountByOfficialTitle = rightsCoverageCounts;
  const officialLibraryEntryByTitle = useMemo(
    () => new Map((officialLibrary?.entries ?? []).map((entry) => [titleKey(entry.title), entry])),
    [officialLibrary]
  );
  const selectedOfficialCounts = useMemo(() => {
    return selectedOfficialTextCards.reduce(
      (counts, model) => {
        const key = titleKey(model.title);
        const officialEntry = officialLibraryEntryByTitle.get(key);
        const stored = officialEntry?.status === 'stored' || officialEntry?.status === 'manual_upload';
        const uploaded = (rightsManagedCountByOfficialTitle[key] ?? 0) > 0;
        const sourceAttemptedButNotStored =
          officialEntry &&
          ['needs_upload', 'fetch_failed', 'needs_gutenberg_match'].includes(officialEntry.status);
        counts.total += 1;
        if (stored || uploaded) counts.available += 1;
        if (stored) counts.stored += 1;
        else if (uploaded) counts.uploaded += 1;
        else if (sourceAttemptedButNotStored) counts.needsSource += 1;
        else if (model.pipelineUse === 'priority_seed') counts.harvestable += 1;
        else counts.reference += 1;
        return counts;
      },
      { total: 0, available: 0, stored: 0, uploaded: 0, harvestable: 0, needsSource: 0, reference: 0 }
    );
  }, [selectedOfficialTextCards, officialLibraryEntryByTitle, rightsManagedCountByOfficialTitle]);
  const uploadedOfficialTitlesByStandard = useMemo(() => {
    const byStandard = new Map<string, Set<string>>();
    for (const row of textCoverageRows) {
      if (row.status !== 'uploaded') continue;
      for (const standard of row.uploaded_standards) {
        const current = byStandard.get(standard) ?? new Set<string>();
        current.add(titleKey(row.title));
        byStandard.set(standard, current);
      }
    }
    return byStandard;
  }, [textCoverageRows]);
  const libraryStatusByStandard = useMemo(
    () => new Map(libraryStatusRows.map((row) => [row.standard_code, row])),
    [libraryStatusRows]
  );
  const standardsLibraryMap = useMemo(() => {
    return officialStandardOptions.map((option) => {
      const statusRow = libraryStatusByStandard.get(option.standardCode);
      const officialTexts =
        officialLibrary?.by_standard?.[option.standardCode] ?? {
          stored: 0,
          total: 0,
          texts: [] as string[],
        };
      const storedEntries = (officialLibrary?.entries ?? []).filter(
        (entry) =>
          entry.standards.includes(option.standardCode) &&
          (entry.status === 'stored' || entry.status === 'manual_upload')
      );
      const uploadedTitles = uploadedOfficialTitlesByStandard.get(option.standardCode) ?? new Set();
      const availableTitles = new Set(storedEntries.map((entry) => titleKey(entry.title)));
      for (const title of uploadedTitles) availableTitles.add(title);
      const officialTextNames =
        storedEntries.length > 0
          ? storedEntries.slice(0, 3).map((entry) => entry.title)
          : officialTexts.texts.slice(0, 3);

      return {
        standardCode: option.standardCode,
        label: option.label,
        officialStored: officialTexts.stored,
        officialAvailable: availableTitles.size || officialTexts.stored,
        officialUploaded: uploadedTitles.size,
        officialTotal: officialTexts.total,
        officialTextNames,
        pending: statusRow?.pending_review_passages ?? 0,
        approved: statusRow?.approved_passages ?? 0,
        questions: statusRow?.promoted_question_rows ?? 0,
        trustedQuestions: statusRow?.trusted_promoted_question_rows ?? 0,
      };
    });
  }, [officialStandardOptions, officialLibrary, uploadedOfficialTitlesByStandard, libraryStatusByStandard]);
  const workbenchTabs: Array<{
    id: WorkbenchTab;
    label: string;
    description: string;
  }> = [
    {
      id: 'overview',
      label: 'Start Here',
      description: 'What to do next',
    },
    {
      id: 'official',
      label: 'Official Texts',
      description: 'What GOGI has stored',
    },
    {
      id: 'texts',
      label: 'Upload Checklist',
      description: 'Track every Florida-listed work',
    },
    {
      id: 'passages',
      label: 'Mine Content',
      description: 'Extract official excerpts',
    },
    {
      id: 'promoted',
      label: 'Student Library',
      description: 'Check items students can receive',
    },
    {
      id: 'harvest',
      label: 'Pipeline Runs',
      description: 'Commands and logs',
    },
  ];

  const counts = useMemo(() => {
    return rows.reduce(
      (map, row) => {
        const next = displayStatus(row);
        map[next] += 1;
        if (row.promoted_question_count > 0) map.promoted += 1;
        return map;
      },
      { approved: 0, pending_review: 0, rejected: 0, promoted: 0 }
    );
  }, [rows, selectedBlueprint]);

  const reviewRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aDecision = reviewDecision(a);
      const bDecision = reviewDecision(b);
      const newestDiff = createdAtMs(b) - createdAtMs(a);
      if (excerptSort === 'newest') {
        return newestDiff || sourceLabel(a).localeCompare(sourceLabel(b));
      }
      if (excerptSort === 'ald') {
        const aldDiff = (b.ald_purpose?.score ?? -1) - (a.ald_purpose?.score ?? -1);
        if (aldDiff !== 0) return aldDiff;
        return newestDiff || bDecision.score - aDecision.score;
      }
      const readinessRank = {
        'Ready for students': 0,
        'Needs standard fix': 1,
        'Needs student item': 2,
        'Remove from library': 3,
      };
      const readinessDiff =
        readinessRank[readinessDecision(a, selectedBlueprint).label] -
        readinessRank[readinessDecision(b, selectedBlueprint).label];
      if (readinessDiff !== 0) return readinessDiff;
      const statusDiff =
        Number(displayStatus(a) !== 'pending_review') -
        Number(displayStatus(b) !== 'pending_review');
      if (statusDiff !== 0) return statusDiff;
      return bDecision.score - aDecision.score || newestDiff;
    });
  }, [rows, selectedBlueprint, excerptSort]);

  const coverageMap = useMemo(() => {
    const strands =
      selectedBlueprint?.coverageStrands?.map((strand) => ({
        id: strand.id,
        label: strand.label,
        studentCanDo: strand.studentCanDo,
        ready: 0,
        metadata: 0,
        regenerate: 0,
        reject: 0,
        total: 0,
      })) ?? [];
    const byId = new Map(strands.map((strand) => [strand.id, strand]));

    for (const row of rows) {
      const taxonomy = inferCleanTaxonomy(row, selectedBlueprint);
      const strand = taxonomy.strandId ? byId.get(taxonomy.strandId) : null;
      if (!strand) continue;
      const readiness = readinessDecision(row, selectedBlueprint);
      strand.total += 1;
      if (readiness.label === 'Ready for students') strand.ready += 1;
      else if (readiness.label === 'Needs standard fix') strand.metadata += 1;
      else if (readiness.label === 'Needs student item') strand.regenerate += 1;
      else strand.reject += 1;
    }

    return strands;
  }, [rows, selectedBlueprint]);

  const reviewSummary = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        if (displayStatus(row) !== 'pending_review') return summary;
        const decision = reviewDecision(row);
        if (decision.label === 'Strong candidate') summary.strong += 1;
        else if (decision.label === 'Teacher skim') summary.skim += 1;
        else summary.rejectRisk += 1;
        return summary;
      },
      { strong: 0, skim: 0, rejectRisk: 0 }
    );
  }, [rows, selectedBlueprint]);

  const readinessSummary = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        const decision = readinessDecision(row, selectedBlueprint);
        if (decision.label === 'Ready for students') summary.ready += 1;
        else if (decision.label === 'Needs standard fix') summary.metadata += 1;
        else if (decision.label === 'Needs student item') summary.regenerate += 1;
        else summary.reject += 1;
        return summary;
      },
      { ready: 0, metadata: 0, regenerate: 0, reject: 0 }
    );
  }, [rows, selectedBlueprint]);

  const workflowQueue = useMemo(() => {
    const needsPackage = rows.filter(
      (row) => readinessDecision(row, selectedBlueprint).label === 'Needs student item'
    );
    const studentReady = rows.filter(
      (row) => readinessDecision(row, selectedBlueprint).label === 'Ready for students'
    );
    const readyToPromote = studentReady.filter(
      (row) => displayStatus(row) === 'approved' && row.promoted_question_count === 0
    );

    return {
      uploadedTexts: textCoverageTotals.uploaded,
      needsPackage,
      studentReady,
      readyToPromote,
    };
  }, [rows, selectedBlueprint, textCoverageTotals.uploaded]);
  const selectedLibraryStatus = libraryStatusByStandard.get(standardCode);
  const selectedOfficialTextNames = officialLibraryEntriesForStandard
    .filter((entry) => entry.status === 'stored' || entry.status === 'manual_upload')
    .slice(0, 6)
    .map((entry) => entry.title);
  const minedExcerptByText = useMemo(() => {
    const byText = new Map<
      string,
      {
        title: string;
        author: string | null;
        excerpts: number;
        raw: number;
        ready: number;
        questions: number;
        tiers: Set<string>;
        strands: Map<string, number>;
      }
    >();

    for (const row of rows) {
      const title = row.source_title?.trim() || 'Untitled text';
      const author = row.source_author?.trim() || null;
      const key = `${title}::${author ?? ''}`;
      const existing =
        byText.get(key) ??
        {
          title,
          author,
          excerpts: 0,
          raw: 0,
          ready: 0,
          questions: 0,
          tiers: new Set<string>(),
          strands: new Map<string, number>(),
        };
      const readiness = readinessDecision(row, selectedBlueprint);
      const strand = inferCleanTaxonomy(row, selectedBlueprint).strandLabel;

      existing.excerpts += 1;
      existing.questions += row.promoted_question_count;
      if (readiness.label === 'Ready for students') existing.ready += 1;
      else existing.raw += 1;
      existing.tiers.add(`T${row.intervention_tier ?? '?'}`);
      existing.strands.set(strand, (existing.strands.get(strand) ?? 0) + 1);
      byText.set(key, existing);
    }

    return [...byText.values()].sort((a, b) => b.excerpts - a.excerpts || a.title.localeCompare(b.title));
  }, [rows, selectedBlueprint]);
  const minedExcerptByStrand = useMemo(() => {
    const byStrand = new Map<
      string,
      { label: string; excerpts: number; texts: Set<string>; ready: number; questions: number }
    >();

    for (const row of rows) {
      const taxonomy = inferCleanTaxonomy(row, selectedBlueprint);
      const key = taxonomy.strandLabel;
      const existing =
        byStrand.get(key) ??
        { label: key, excerpts: 0, texts: new Set<string>(), ready: 0, questions: 0 };
      existing.excerpts += 1;
      existing.texts.add(row.source_title?.trim() || 'Untitled text');
      existing.questions += row.promoted_question_count;
      if (readinessDecision(row, selectedBlueprint).label === 'Ready for students') {
        existing.ready += 1;
      }
      byStrand.set(key, existing);
    }

    return [...byStrand.values()].sort((a, b) => b.excerpts - a.excerpts || a.label.localeCompare(b.label));
  }, [rows, selectedBlueprint]);

  const needsSourceRows = useMemo(
    () =>
      textCoverageRows
        .filter((row) => row.status === 'rights_needed' || row.status === 'harvestable')
        .sort((a, b) => a.title.localeCompare(b.title)),
    [textCoverageRows]
  );

  const nonOfficialCandidateCount = useMemo(() => {
    return rows.filter(
      (row) =>
        displayStatus(row) !== 'rejected' &&
        !isOfficialFastAlignedSource({
          standardCode,
          sourceTitle: row.source_title,
          sourceAuthor: row.source_author,
          sourceGutenbergId: row.source_gutenberg_id,
        })
    ).length;
  }, [rows, standardCode]);

  const promotedReviewItems = useMemo<PromotedReviewItem[]>(() => {
    return rows.flatMap((row) => {
      const taxonomy = inferCleanTaxonomy(row, selectedBlueprint);
      return row.promoted_questions.map((question) => ({
        row,
        question,
        preview: promotedQuestionPreview(question),
        taxonomy,
      }));
    });
  }, [rows, selectedBlueprint]);

  const promotedReviewSummary = useMemo(() => {
    return promotedReviewItems.reduce(
      (summary, item) => {
        if (item.preview.quality?.includes('strong signal')) summary.strong += 1;
        else summary.needsSkim += 1;
        const label = item.preview.target_skill ?? item.taxonomy.strandLabel;
        summary.byStrand[label] = (summary.byStrand[label] ?? 0) + 1;
        return summary;
      },
      { strong: 0, needsSkim: 0, byStrand: {} as Record<string, number> }
    );
  }, [promotedReviewItems]);

  const passageReviewEntries = useMemo<PassageReviewEntry[]>(() => {
    return reviewRows.map((row) => ({
      row,
      question: null,
      preview: null,
      taxonomy: inferCleanTaxonomy(row, selectedBlueprint),
    }));
  }, [reviewRows, selectedBlueprint]);

  const visibleReviewEntries: PassageReviewEntry[] =
    activeWorkbenchTab === 'promoted' ? promotedReviewItems : passageReviewEntries;

  async function loadRows(options: { announce?: boolean } = {}) {
    if (options.announce) {
      setMessage('Refreshing Gutenberg passages...');
    }
    setLoading(true);
    setRefreshingRows(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        standard_code: standardCode,
        status,
        limit: '120',
        t: String(Date.now()),
      });
      const response = await fetch(`/api/reading-wins/gutenberg/passages?${params.toString()}`, {
        cache: 'no-store',
      });
      const body = (await response.json()) as { rows?: GutenbergPassageRow[]; error?: string };

      if (!response.ok) {
        setError(body.error ?? 'Could not load Gutenberg passages.');
        setRows([]);
        return;
      }

      const nextRows = body.rows ?? [];
      setRows(nextRows);
      if (options.announce) {
        setMessage(
          `Refreshed ${nextRows.length} Gutenberg passage${nextRows.length === 1 ? '' : 's'} at ${new Date().toLocaleTimeString()}.`
        );
      }
      await loadLibraryStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed.';
      setError(
        message === 'Failed to fetch'
          ? 'Refresh could not reach the local API. Make sure npm run dev is still running, then hard-refresh the browser.'
          : message
      );
    } finally {
      setLoading(false);
      setRefreshingRows(false);
    }
  }

  async function loadHarvestStatus() {
    const params = new URLSearchParams({ standard_code: standardCode });
    const response = await fetch(
      `/api/reading-wins/gutenberg/standard-harvest/status?${params.toString()}`
    );
    const body = (await response.json().catch(() => ({}))) as {
      latest?: HarvestStatus | null;
    };
    if (response.ok) setHarvestStatus(body.latest ?? null);
  }

  async function loadHarvestIntelligence() {
    const params = new URLSearchParams({ standard_code: standardCode });
    const response = await fetch(
      `/api/reading-wins/gutenberg/standard-harvest/intelligence?${params.toString()}`
    );
    const body = (await response.json().catch(() => ({}))) as {
      intelligence?: HarvestIntelligence | null;
    };
    if (response.ok) setHarvestIntelligence(body.intelligence ?? null);
  }

  async function loadLibraryStatus() {
    const response = await fetch(`/api/reading-wins/gutenberg/status?t=${Date.now()}`, {
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => ({}))) as {
      rows?: LibraryStatusRow[];
    };
    if (response.ok) setLibraryStatusRows(body.rows ?? []);
  }

  async function loadRightsCoverage() {
    try {
      const params = new URLSearchParams({ standard_code: standardCode, t: String(Date.now()) });
      const response = await fetch(
        `/api/reading-wins/gutenberg/rights-coverage?${params.toString()}`,
        { cache: 'no-store' }
      );
      const body = (await response.json().catch(() => ({}))) as {
        counts?: Record<string, number>;
      };
      if (response.ok) setRightsCoverageCounts(body.counts ?? {});
      else setNetworkNotice('GOGI could not reach Supabase for manual-upload coverage. If you are on school Wi-Fi, refresh again later from home Wi-Fi.');
    } catch {
      setNetworkNotice('GOGI could not reach Supabase for manual-upload coverage. If you are on school Wi-Fi, refresh again later from home Wi-Fi.');
    }
  }

  async function loadOfficialLibrary() {
    try {
      const response = await fetch(`/api/reading-wins/official-text-library?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as {
        manifest?: OfficialTextLibraryManifest;
        error?: string;
      };
      if (response.ok) {
        setOfficialLibrary(body.manifest ?? null);
      }
    } catch {
      setNetworkNotice('GOGI could not load the local official-text manifest. Make sure the dev server is still running.');
    }
  }

  async function syncManualUploadsIntoLocalLibrary() {
    setSyncingManualUploads(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/reading-wins/official-text-library/sync-manual-uploads', {
        method: 'POST',
      });
      const body = (await response.json().catch(() => ({}))) as {
        synced_texts?: number;
        preserved_full_texts?: number;
        total_manual_texts?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || 'GOGI could not sync manual uploads from Supabase.');
      }

      await Promise.all([loadOfficialLibrary(), loadTextCoverage(), loadRightsCoverage()]);
      setMessage(
        `Manual uploads synced: ${body.synced_texts ?? 0} mirrored from Supabase, ${body.preserved_full_texts ?? 0} full-text local files preserved. GOGI now sees ${body.total_manual_texts ?? 0} manual source texts locally.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GOGI could not sync manual uploads.';
      setNetworkNotice(
        `${message} If you are on school Wi-Fi, this is probably the Supabase network block. Try again from home Wi-Fi.`
      );
    } finally {
      setSyncingManualUploads(false);
    }
  }

  async function loadTextCoverage() {
    try {
      const response = await fetch(`/api/reading-wins/gutenberg/text-coverage?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as {
        rows?: TextCoverageRow[];
        totals?: typeof textCoverageTotals;
      };
      if (response.ok) {
        setTextCoverageRows(body.rows ?? []);
        setTextCoverageTotals(
          body.totals ?? {
            texts: 0,
            stored: 0,
            uploaded: 0,
            harvestable: 0,
            rights_needed: 0,
            style_model: 0,
          }
        );
        setNetworkNotice(null);
      } else {
        setNetworkNotice('GOGI could not reach Supabase for the text checklist. If you are on school Wi-Fi, this may be a network block, not broken data.');
      }
    } catch {
      setNetworkNotice('GOGI could not reach Supabase for the text checklist. If you are on school Wi-Fi, this may be a network block, not broken data.');
    }
  }

  async function updatePassage(passageId: string, nextStatus: 'approved' | 'rejected') {
    setWorkingId(passageId);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/reading-wins/gutenberg/passages/${passageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not update passage.');
      return;
    }

      setMessage(
        nextStatus === 'approved'
        ? 'Item approved. Next: send it to the student library.'
        : 'Passage rejected.'
    );
    if (nextStatus === 'approved' && status === 'pending') {
      setStatus('approved');
      return;
    }
    if (nextStatus === 'rejected' && status === 'pending') {
      setStatus('rejected');
      return;
    }
    await loadRows();
  }

  async function promotePassage(passageId: string) {
    setWorkingId(passageId);
    setError(null);
    setMessage(null);
    const response = await fetch('/api/reading-wins/gutenberg/promote-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passage_ids: [passageId], standard_code: standardCode }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      promoted_count?: number;
    };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not promote passage.');
      return;
    }

    setMessage(body.message ?? `Promoted ${body.promoted_count ?? 0} question rows.`);
    await loadRows();
  }

  async function mineOfficialTextsForStandard() {
    setMiningOfficialTexts(true);
    setError(null);
    setMessage(`Mining stored official texts for ${standardCode}...`);
    try {
      const response = await fetch('/api/reading-wins/official-text-library/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standard_code: standardCode, max_per_text: 2 }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        considered_count?: number | null;
        inserted_count?: number | null;
        duplicate_count?: number | null;
        error_count?: number | null;
      };

      if (!response.ok) {
        setError(body.error ?? 'Could not mine official texts.');
        setMessage(null);
        return;
      }

      setMessage(
        `${body.message ?? `${standardCode}: official text mining complete.`} Considered ${
          body.considered_count ?? 0
        }, inserted ${body.inserted_count ?? 0}, duplicates ${body.duplicate_count ?? 0}.`
      );
      await loadRows({ announce: false });
      await loadLibraryStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mine official texts.');
      setMessage(null);
    } finally {
      setMiningOfficialTexts(false);
    }
  }

  async function buildNextStudentItems() {
    const candidates = workflowQueue.needsPackage.slice(0, 5);
    if (!candidates.length) {
      setMessage('No raw excerpts are waiting for this standard. Mine or upload more official text first.');
      return;
    }
    await generateItemPackages(
      candidates.map((row) => row.id),
      'official excerpt'
    );
  }

  async function generateItemPackages(passageIds: string[], label = 'passage') {
    if (!passageIds.length) return;

    setWorkingId(passageIds.length === 1 ? passageIds[0] : 'batch-generate-items');
    setError(null);
    setMessage(
      `Building student practice item${passageIds.length === 1 ? '' : 's'} for ${passageIds.length} ${label}${passageIds.length === 1 ? '' : 's'}...`
    );
    try {
      const response = await fetch('/api/reading-wins/gutenberg/passages/item-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passage_ids: passageIds,
          standard_code: standardCode,
          limit: passageIds.length,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        generated_count?: number;
        student_ready_count?: number;
        failed_count?: number;
        failed?: Array<{ id: string; reason: string }>;
      };

      if (!response.ok) {
        setError(body.error ?? 'Could not build the student practice item.');
        setMessage(null);
        return;
      }

      const failureReason = body.failed?.[0]?.reason;
      const successCount = body.generated_count ?? 0;
      const readyCount = body.student_ready_count ?? 0;
      setMessage(
        successCount > 0
          ? `Built ${successCount} student practice item${
              successCount === 1 ? '' : 's'
            }. ${readyCount} passed the FAST preview gate.`
          : `GOGI did not build a student item from this excerpt. ${
              failureReason ? `Reason: ${failureReason}` : 'Try a stronger excerpt tied to the same standard.'
            }`
      );
      await loadRows({ announce: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown generation error.';
      setError(`Student item build failed: ${message}`);
      setMessage(null);
    } finally {
      setWorkingId(null);
    }
  }

  async function approveStrongCandidates() {
    const candidates = rows.filter(
      (row) =>
        displayStatus(row) === 'pending_review' && reviewDecision(row).label === 'Strong candidate'
    );
    if (!candidates.length) {
      setMessage('No strong pending candidates found for this filter.');
      return;
    }

    setWorkingId('batch-approve');
    setError(null);
    setMessage(null);
    let approvedCount = 0;

    for (const row of candidates) {
      const response = await fetch(`/api/reading-wins/gutenberg/passages/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (response.ok) approvedCount += 1;
    }

    setWorkingId(null);
    setStatus('approved');
    setMessage(
      `Approved ${approvedCount} strong candidate${approvedCount === 1 ? '' : 's'}. Next: send approved items to the student library.`
    );
  }

  async function approveStudentReadyPackages() {
    const candidates = rows.filter(
      (row) =>
        displayStatus(row) === 'pending_review' &&
        readinessDecision(row, selectedBlueprint).label === 'Ready for students'
    );
    if (!candidates.length) {
      setMessage('No ready-for-students items found for this filter.');
      return;
    }

    setWorkingId('batch-ready-approve');
    setError(null);
    setMessage(null);
    let approvedCount = 0;

    for (const row of candidates) {
      const response = await fetch(`/api/reading-wins/gutenberg/passages/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (response.ok) approvedCount += 1;
    }

    setWorkingId(null);
    setMessage(
      `Approved ${approvedCount} ready-for-students item${approvedCount === 1 ? '' : 's'}.`
    );
    await loadRows();
  }

  async function promoteStudentReadyPackages() {
    const candidates = rows.filter(
      (row) =>
        readinessDecision(row, selectedBlueprint).label === 'Ready for students' &&
        displayStatus(row) === 'approved' &&
        row.promoted_question_count === 0
    );
    if (!candidates.length) {
      setMessage('No approved student items found to send for this filter.');
      return;
    }

    setWorkingId('batch-ready-promote');
    setError(null);
    setMessage(null);
    const response = await fetch('/api/reading-wins/gutenberg/promote-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passage_ids: candidates.map((row) => row.id),
        standard_code: standardCode,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      promoted_count?: number;
    };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not send student items.');
      return;
    }

    setMessage(body.message ?? `Promoted ${body.promoted_count ?? 0} question rows.`);
    await loadRows();
  }

  async function regeneratePromotedPackages() {
    const passageIds = Array.from(new Set(promotedReviewItems.map((item) => item.row.id)));
    if (!passageIds.length) return;

    setWorkingId('regenerate-promoted');
    setError(null);
    setMessage(`Rebuilding ${passageIds.length} student-library item${passageIds.length === 1 ? '' : 's'} with the clean strand gate...`);
    const response = await fetch('/api/reading-wins/gutenberg/promote-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passage_ids: passageIds,
        standard_code: standardCode,
        replace_existing: true,
        limit: passageIds.length,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      promoted_count?: number;
    };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not regenerate promoted items.');
      return;
    }

    setMessage(
      body.message ??
        `Rebuilt ${body.promoted_count ?? 0} student-library item rows with clean strand alignment.`
    );
    await loadRows({ announce: false });
  }

  async function legacyNonOfficialPassages() {
    if (!nonOfficialCandidateCount) {
      setMessage('No non-official passage rows found in this view.');
      return;
    }

    setWorkingId('legacy-nonofficial');
    setError(null);
    setMessage(
      `Moving ${nonOfficialCandidateCount} non-official passage${
        nonOfficialCandidateCount === 1 ? '' : 's'
      } into the legacy archive...`
    );
    const response = await fetch('/api/reading-wins/gutenberg/legacy-nonofficial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standard_code: standardCode }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      legacy_passage_count?: number;
      removed_question_count?: number;
    };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not move old passage rows to legacy.');
      return;
    }

    setMessage(
      body.message ??
        `Moved ${body.legacy_passage_count ?? 0} old passage rows to legacy and removed ${
          body.removed_question_count ?? 0
        } promoted question rows.`
    );
    await loadRows({ announce: false });
  }

  async function importRightsManagedExcerpt() {
    const strand = selectedBlueprint?.coverageStrands?.find(
      (item) => item.id === manualImport.coverageStrandId
    );

    if (!manualImport.sourceTitle.trim()) {
      setError('Add the official work title before importing.');
      return;
    }
    if (!manualImport.rightsBasis.trim()) {
      setError('Add the rights/use basis before importing.');
      return;
    }
    if (manualImport.paragraphText.trim().split(/\s+/).filter(Boolean).length < 40) {
      setError('Paste at least 40 words of text before importing.');
      return;
    }

    setWorkingId('manual-import');
    setError(null);
    setMessage('Adding rights-managed excerpt to the review queue...');
    try {
      const response = await fetch('/api/reading-wins/gutenberg/manual-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallback_standard_code: standardCode,
          coverage_strand_id: strand?.id ?? null,
          coverage_strand_label: strand?.label ?? null,
          coverage_strand_signals: strand?.harvestSignals ?? null,
          classification: selectedBlueprint?.classifications?.[0] ?? 'manual_rights_import',
          target_signal:
            manualImport.targetSignal.trim() ||
            strand?.label ||
            selectedBlueprint?.teacherLabel ||
            'rights-managed excerpt',
          source_title: manualImport.sourceTitle,
          source_author: manualImport.sourceAuthor,
          rights_basis: manualImport.rightsBasis,
          paragraph_text: manualImport.paragraphText,
          save_as_full_text: manualImport.saveAsFullText,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        detected_standards?: string[];
        created_count?: number;
      };

      if (!response.ok) {
        setError(body.error ?? 'Could not add rights-managed excerpt.');
        setMessage(null);
        return;
      }

      setManualImport({
        sourceTitle: '',
        sourceAuthor: '',
        rightsBasis: '',
        targetSignal: '',
        coverageStrandId: '',
        paragraphText: '',
        saveAsFullText: true,
      });
      if ((body.created_count ?? 0) > 0) {
        setStatus('pending');
        setActiveWorkbenchTab('passages');
      }
      setMessage(body.message ?? 'Rights-managed excerpt added to the review queue.');
      await loadRightsCoverage();
      await loadTextCoverage();
      await loadRows({ announce: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown upload error.';
      setMessage(null);
      setError(`Import failed before GOGI could save it: ${message}`);
    } finally {
      setWorkingId(null);
    }
  }

  async function rejectFailedPackages() {
    const candidates = rows.filter(
      (row) =>
        displayStatus(row) !== 'rejected' &&
        readinessDecision(row, selectedBlueprint).label === 'Remove from library'
    );
    if (!candidates.length) {
      setMessage('No remove-from-library items found for this filter.');
      return;
    }

    setWorkingId('batch-reject');
    setError(null);
    setMessage(null);
    let rejectedCount = 0;

    for (const row of candidates) {
      const response = await fetch(`/api/reading-wins/gutenberg/passages/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      if (response.ok) rejectedCount += 1;
    }

    setWorkingId(null);
    setMessage(
      `Rejected ${rejectedCount} low-quality item${rejectedCount === 1 ? '' : 's'} from this view.`
    );
    await loadRows();
  }

  async function queueRegeneration() {
    const candidates = rows.filter(
      (row) => readinessDecision(row, selectedBlueprint).label === 'Needs student item'
    );
    if (!candidates.length) {
    setMessage('No rows need student items for this filter.');
      return;
    }
    await generateItemPackages(
      candidates.map((row) => row.id),
      'item-regeneration candidate'
    );
  }

  async function applyMetadataFixes() {
    const candidates = rows.filter(
      (row) => readinessDecision(row, selectedBlueprint).label === 'Needs standard fix'
    );
    if (!candidates.length) {
      setMessage('No metadata fixes found for this filter.');
      return;
    }

    setWorkingId('batch-metadata');
    setError(null);
    setMessage(null);

    const metadataRows = candidates.map((row) => {
      const taxonomy = inferCleanTaxonomy(row, selectedBlueprint);
      return {
        id: row.id,
        standard_code: taxonomy.standardCode,
        coverage_strand_id: taxonomy.strandId,
        coverage_strand_label: taxonomy.strandLabel,
        coverage_strand_signals: taxonomy.harvestSignals,
      };
    });

    try {
      const response = await fetch('/api/reading-wins/gutenberg/passages/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: metadataRows }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Could not apply metadata fixes.');
      }

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        updated?: number;
      };
      const updated = body.updated ?? metadataRows.length;
      setMessage(
        body.message ??
          `Applied clean standard/strand metadata to ${updated} item${
            updated === 1 ? '' : 's'
          }.`
      );
      setRows((currentRows) =>
        currentRows.map((row) => {
          const nextMetadata = metadataRows.find((item) => item.id === row.id);
          return nextMetadata
            ? {
                ...row,
                standard_code: nextMetadata.standard_code,
                coverage_strand_id: nextMetadata.coverage_strand_id,
                coverage_strand_label: nextMetadata.coverage_strand_label,
                coverage_strand_signals: nextMetadata.coverage_strand_signals,
              }
            : row;
        })
      );
      await loadRows();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not apply metadata fixes.';
      setError(
        message === 'Failed to fetch'
          ? 'The metadata update request could not reach the local API. Make sure npm run dev is still running, refresh this page, then try Apply metadata fixes again.'
          : message
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function promoteApprovedVisible() {
    const candidates = rows.filter(
      (row) => displayStatus(row) === 'approved' && row.promoted_question_count === 0
    );
    if (!candidates.length) {
      setMessage('No unpromoted approved passages found for this filter.');
      return;
    }

    setWorkingId('batch-promote');
    setError(null);
    setMessage(null);
    const response = await fetch('/api/reading-wins/gutenberg/promote-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passage_ids: candidates.map((row) => row.id),
        standard_code: standardCode,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      promoted_count?: number;
    };
    setWorkingId(null);

    if (!response.ok) {
      setError(body.error ?? 'Could not promote approved passages.');
      return;
    }

    setMessage(body.message ?? `Promoted ${body.promoted_count ?? 0} question rows.`);
    await loadRows();
  }

  async function startStandardHarvest() {
    setHarvesting(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/reading-wins/gutenberg/standard-harvest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        standard_code: standardCode,
        max: 12,
        max_books: 5,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      log_path?: string;
      classifications?: string[];
      coverage_strands?: Array<{ label: string }>;
      official_sources?: {
        priority_seed_count: number;
        reference_count: number;
        priority_titles: string[];
        reference_titles: string[];
      };
    };
    setHarvesting(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not start standard harvest.');
      return;
    }

    setMessage(
      [
        body.message ?? `${standardCode} harvest started.`,
        body.official_sources
          ? `${body.official_sources.priority_seed_count} harvestable official text${body.official_sources.priority_seed_count === 1 ? '' : 's'} and ${body.official_sources.reference_count} reference text${body.official_sources.reference_count === 1 ? '' : 's'} are steering the run.`
          : null,
        body.coverage_strands?.length
          ? `Strand-focused runs: ${body.coverage_strands.map((item) => item.label).join(', ')}.`
          : body.classifications?.length
            ? `Running: ${body.classifications.map((item) => item.replace(/_/g, ' ')).join(', ')}.`
            : null,
        body.log_path ? `Log: ${body.log_path}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    );
    await loadHarvestStatus();
    await loadHarvestIntelligence();
  }

  useEffect(() => {
    loadRows();
    loadHarvestStatus();
    loadHarvestIntelligence();
    loadLibraryStatus();
    loadRightsCoverage();
    loadOfficialLibrary();
    loadTextCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardCode, status]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TeacherDashboardTopBar active="gutenberg" />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
              GOGI Content Library
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Build FAST-Aligned Student Practice</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
              Pick a FAST standard, choose real literature excerpts, build student questions, and
              send only trusted items into the student library.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshingRows}
            onClick={() => loadRows({ announce: true })}
            className="inline-flex items-center gap-2 rounded-md bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingRows ? 'animate-spin' : ''}`} />
            {refreshingRows ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-3 shadow-sm">
          <div className="mb-3 rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-3 text-sm text-[#1E3A8A]">
            <span className="font-semibold">Simple path:</span> choose a standard → confirm the
            official texts are available → mine content → build student items → send trusted items
            to the student library.
          </div>
          {networkNotice ? (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              <span className="font-semibold">Network note:</span> {networkNotice}
            </div>
          ) : null}
          {error ? (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
              <span className="font-semibold">Needs attention:</span> {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
              {message}
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {workbenchTabs.map((tab) => {
              const active = activeWorkbenchTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveWorkbenchTab(tab.id)}
                  className={`rounded-md border px-4 py-3 text-left transition ${
                    active
                      ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]'
                      : 'border-transparent bg-white text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className="mt-1 block text-xs leading-5">{tab.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {activeWorkbenchTab === 'harvest' ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Pipeline logic
              </p>
              <h2 className="mt-1 text-xl font-semibold">The trusted content path</h2>
              <div className="mt-3 grid gap-2 text-sm text-[#475569] md:grid-cols-4">
                {[
                  'Run Gutenberg pipeline',
                  'Approve curated passages',
                  'Send to student library',
                  'Assign only ready standards',
                ].map((step, index) => (
                  <div key={step} className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <p className="text-xs font-semibold uppercase text-[#2563EB]">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 font-semibold text-[#0F172A]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                Official-source harvest
              </p>
              <p className="mt-2 text-sm leading-6 text-[#1E3A8A]">
                This run starts from the Florida B.E.S.T. text map for {standardCode}. GOGI uses
                stored or uploaded official texts first, then keeps reference-only texts visible to
                hold the rigor and item shape steady.
              </p>
              {selectedOfficialSeeds ? (
                <div className="mt-3 rounded-md border border-[#BFDBFE] bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[#1D4ED8]">
                    Priority source order
                  </p>
                  <div className="mt-2 space-y-2 text-xs leading-5 text-[#334155]">
                    <p>
                      <span className="font-semibold">Public-domain candidates:</span>{' '}
                      {selectedOfficialSeeds.priorityModels.map((model) => model.title).join(', ') ||
                        'No public-domain seeds configured yet.'}
                    </p>
                    <p>
                      <span className="font-semibold">Reference:</span>{' '}
                      {selectedOfficialSeeds.referenceModels.map((model) => model.title).join(', ') ||
                        'No rights-limited references configured.'}
                    </p>
                  </div>
                </div>
              ) : null}
              <code className="mt-3 block rounded-md bg-white p-3 text-xs text-[#0F172A]">
                {selectedBlueprint?.recommendedCommand ??
                  'npm run pipeline:standard -- --standard ELA.9.R.3.1 --max-books 5 --max 12'}
              </code>
              <button
                type="button"
                disabled={harvesting || !selectedBlueprint}
                onClick={startStandardHarvest}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#94A3B8]"
              >
                <Send className="h-4 w-4" />
                {harvesting
                  ? 'Starting harvest...'
                  : selectedBlueprint
                    ? 'Start official-source harvest'
                    : 'Pipeline blueprint needed'}
              </button>
            </div>
          </div>
          </section>
        ) : null}

        {activeWorkbenchTab === 'texts' ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Missing Texts Checklist
                </p>
                <h2 className="mt-1 text-xl font-semibold">Florida-listed works coverage</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                  Use this as the punch list. Stored works are already in GOGI. Uploaded works are
                  the rights-managed texts you pasted into GOGI. Needs-source works still need a
                  clean manual upload or a working source file before GOGI can use them.
                </p>
              </div>
              <button
                type="button"
                onClick={loadTextCoverage}
                className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh checklist
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-center text-sm md:grid-cols-5">
              {[
                ['Texts', textCoverageTotals.texts, 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]'],
                ['Stored', textCoverageTotals.stored, 'border-emerald-200 bg-emerald-50 text-emerald-800'],
                ['Uploaded', textCoverageTotals.uploaded, 'border-emerald-200 bg-emerald-50 text-emerald-800'],
                ['Needs source', textCoverageTotals.harvestable + textCoverageTotals.rights_needed, 'border-amber-200 bg-amber-50 text-amber-800'],
                ['Style model', textCoverageTotals.style_model, 'border-sky-200 bg-sky-50 text-sky-800'],
              ].map(([label, value, classes]) => (
                <div key={label} className={`rounded-md border px-3 py-2 ${classes}`}>
                  <p className="text-xs font-semibold uppercase">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {textCoverageRows.map((row) => (
                <article
                  key={`${row.title}-${row.author ?? 'unknown'}`}
                  className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${textCoverageStatusClasses(
                            row.status
                          )}`}
                        >
                          {textCoverageStatusLabel(row.status)}
                        </span>
                        {row.uploaded_excerpt_count > 0 ? (
                          <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800">
                            {row.uploaded_excerpt_count} excerpt candidates
                          </span>
                        ) : null}
                        {row.status === 'stored' || row.status === 'uploaded' ? (
                          <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800">
                            {row.stored_word_count.toLocaleString()} words stored
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-[#0F172A]">{row.title}</h3>
                      <p className="mt-1 text-sm text-[#64748B]">
                        {row.author ?? 'Author unknown'} · {row.source_documents.join(' + ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setManualImport((current) => ({
                          ...current,
                          sourceTitle: row.title,
                          sourceAuthor: row.author ?? '',
                        }));
                        setActiveWorkbenchTab('overview');
                      }}
                      className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155]"
                    >
                      Upload text
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {row.standards.map((standard) => {
                      const uploaded = row.uploaded_standards.includes(standard);
                      return (
                        <span
                          key={standard}
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                            uploaded
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-[#CBD5E1] bg-white text-[#334155]'
                          }`}
                        >
                          {standard}
                        </span>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeWorkbenchTab === 'official' ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                  Official Text Library
                </p>
                <h2 className="mt-1 text-xl font-semibold">Local source-file tracker</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                  This panel tracks the official source files saved in the local GOGI library.
                  Manual uploads are counted in the Upload Checklist and as available on each
                  standard. Use this panel to see what the Gutenberg/source-file build has stored.
                </p>
                {officialLibrary?.generated_at ? (
                  <p className="mt-1 text-xs text-[#64748B]">
                    Local manifest last built {new Date(officialLibrary.generated_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={syncManualUploadsIntoLocalLibrary}
                  disabled={syncingManualUploads}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                >
                  <RefreshCw className={`h-4 w-4 ${syncingManualUploads ? 'animate-spin' : ''}`} />
                  {syncingManualUploads ? 'Syncing uploads...' : 'Sync manual uploads'}
                </button>
                <button
                  type="button"
                  onClick={loadOfficialLibrary}
                  className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload local tracker
                </button>
              </div>
            </div>

            {officialLibrary ? (
              <>
                <div className="mt-4 grid gap-2 text-center text-sm md:grid-cols-6">
                  {[
                    ['Official works', officialLibrary.totals.texts, 'border-[#E2E8F0] bg-[#F8FAFC] text-[#334155]'],
                    ['Stored', officialLibrary.totals.stored, 'border-emerald-200 bg-emerald-50 text-emerald-800'],
                    [
                      'Manual uploads',
                      officialLibrary.totals.manual_upload ?? 0,
                      'border-emerald-200 bg-emerald-50 text-emerald-800',
                    ],
                    ['Needs source file', officialLibrary.totals.needs_upload, 'border-amber-200 bg-amber-50 text-amber-800'],
                    ['Reference', officialLibrary.totals.reference_only, 'border-sky-200 bg-sky-50 text-sky-800'],
                    [
                      'Failures',
                      officialLibrary.totals.fetch_failed + officialLibrary.totals.needs_gutenberg_match,
                      'border-rose-200 bg-rose-50 text-rose-800',
                    ],
                  ].map(([label, value, classes]) => (
                    <div key={label} className={`rounded-md border px-3 py-2 ${classes}`}>
                      <p className="text-xs font-semibold uppercase">{label}</p>
                      <p className="font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Coverage by standard
                    </p>
                    <div className="mt-3 max-h-[520px] overflow-auto pr-1">
                      {Object.entries(officialLibrary.by_standard)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([standard, row]) => {
                          const selected = standard === standardCode;
                          const storedTitles = new Set(
                            (officialLibrary?.entries ?? [])
                              .filter(
                                (entry) =>
                                  entry.standards.includes(standard) &&
                                  (entry.status === 'stored' || entry.status === 'manual_upload')
                              )
                              .map((entry) => titleKey(entry.title))
                          );
                          const uploadedTitles =
                            uploadedOfficialTitlesByStandard.get(standard) ?? new Set<string>();
                          const availableCount = new Set([
                            ...storedTitles,
                            ...uploadedTitles,
                          ]).size;
                          return (
                            <button
                              key={standard}
                              type="button"
                              onClick={() => setStandardCode(standard)}
                              className={`mb-2 w-full rounded-md border p-3 text-left ${
                                selected
                                  ? 'border-[#2563EB] bg-[#EFF6FF]'
                                  : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-[#0F172A]">
                                  {standard}
                                </span>
                                <span className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#334155]">
                                  {availableCount || row.stored}/{row.total} available
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                          Selected standard
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
                          {standardCode}
                        </h3>
                      </div>
                      <span className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#334155]">
                        {officialLibraryEntriesForStandard.filter((entry) => {
                          const uploadedCount =
                            rightsManagedCountByOfficialTitle[titleKey(entry.title)] ?? 0;
                          return entry.status === 'stored' || entry.status === 'manual_upload' || uploadedCount > 0;
                        }).length}
                        /{officialLibraryEntriesForStandard.length} available
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {officialLibraryEntriesForStandard.map((entry) => {
                        const uploadedCount =
                          rightsManagedCountByOfficialTitle[titleKey(entry.title)] ?? 0;
                        const available =
                          entry.status === 'stored' || entry.status === 'manual_upload' || uploadedCount > 0;
                        return (
                          <article
                            key={`${entry.title}-${entry.author ?? 'unknown'}`}
                            className={`rounded-md border p-4 ${
                              available
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-[#E2E8F0] bg-[#F8FAFC]'
                            }`}
                          >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <span
                                className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                                  uploadedCount > 0 && entry.status !== 'stored' && entry.status !== 'manual_upload'
                                    ? 'border-emerald-200 bg-white text-emerald-800'
                                    : officialLibraryStatusClasses(entry.status)
                                }`}
                              >
                                {uploadedCount > 0 && entry.status !== 'stored' && entry.status !== 'manual_upload'
                                  ? 'Uploaded'
                                  : officialLibraryStatusLabel(entry.status)}
                              </span>
                              <h4 className="mt-2 text-base font-semibold text-[#0F172A]">
                                {entry.title}
                              </h4>
                              <p className="mt-1 text-sm text-[#64748B]">
                                {entry.author ?? 'Author unknown'} · {entry.word_count.toLocaleString()} words
                              </p>
                            </div>
                            {entry.text_path ? (
                              <span className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800">
                                Local file
                              </span>
                            ) : null}
                            {uploadedCount > 0 ? (
                              <span className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800">
                                {uploadedCount} manual excerpt{uploadedCount === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {entry.standards.map((standard) => (
                              <span
                                key={standard}
                                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                                  standard === standardCode
                                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                                    : 'border-[#CBD5E1] bg-white text-[#334155]'
                                }`}
                              >
                                {standard}
                              </span>
                            ))}
                          </div>
                          {entry.text_path ? (
                            <p className="mt-3 font-mono text-[11px] text-[#64748B]">
                              {entry.text_path}
                            </p>
                          ) : uploadedCount > 0 ? (
                            <p className="mt-3 text-xs leading-5 text-emerald-900">
                              Manual rights-managed text is already staged for this work. It can
                              feed mined excerpt review even though it is not a local Gutenberg file.
                            </p>
                          ) : (
                            <p className="mt-3 text-xs leading-5 text-amber-900">
                              Upload/source text later, then rebuild the official library.
                            </p>
                          )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Build the official text library first, then refresh this tab.
              </div>
            )}
          </section>
        ) : null}

        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                FAST standard
              </span>
              <select
                value={standardCode}
                onChange={(event) => setStandardCode(event.target.value)}
                className="min-w-[280px] rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                {officialStandardOptions.map((option) => (
                  <option key={option.standardCode} value={option.standardCode}>
                    {option.standardCode} · {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Passage status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="legacy">Legacy archive</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Sort excerpts
              </span>
              <select
                value={excerptSort}
                onChange={(event) => setExcerptSort(event.target.value as ExcerptSort)}
                className="rounded-md border border-[#CBD5E1] px-3 py-2 text-sm"
              >
                <option value="newest">Newest mined first</option>
                <option value="ald">Best FAST Next Step match</option>
                <option value="readiness">Review queue order</option>
              </select>
            </label>
            <div className="ml-auto grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-amber-700">Pending</p>
                <p className="font-semibold">{counts.pending_review}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-emerald-700">Approved</p>
                <p className="font-semibold">{counts.approved}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-blue-700">Promoted</p>
                <p className="font-semibold">{counts.promoted}</p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-rose-700">Rejected</p>
                <p className="font-semibold">{counts.rejected}</p>
              </div>
            </div>
          </div>
          {activeWorkbenchTab === 'overview' ? (
            <section className="mt-5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                    Standards library map
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">
                    Pick the standard, then build the student work
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                    Step 1 is content: official texts stored, excerpts mined, and standards tied
                    to the right texts. Questions come after the content base is visible.
                  </p>
                </div>
                <span className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1 text-xs font-semibold text-[#334155]">
                  {standardsLibraryMap.length} standards
                </span>
              </div>
              <div className="mt-4 overflow-x-auto rounded-md border border-[#E2E8F0] bg-white">
                <div className="grid min-w-[920px] grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_0.7fr] gap-3 bg-[#F8FAFC] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  <span>Standard</span>
                  <span>Related official texts</span>
                  <span>Mined content</span>
                  <span>Student questions</span>
                  <span>Action</span>
                </div>
                {standardsLibraryMap.map((row) => {
                  const isSelected = row.standardCode === standardCode;
                  const questionTone =
                    row.trustedQuestions > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : row.questions > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]';
                  return (
                    <div
                      key={row.standardCode}
                      className={`grid min-w-[920px] grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_0.7fr] gap-3 border-t border-[#E2E8F0] px-4 py-3 text-sm ${
                        isSelected ? 'bg-[#EFF6FF]' : 'bg-white'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A]">{row.standardCode}</p>
                        <p className="mt-1 text-xs leading-5 text-[#64748B]">{row.label}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A]">
                          {row.officialAvailable}/{row.officialTotal || row.officialAvailable} available
                        </p>
                        {row.officialUploaded > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-emerald-700">
                            includes {row.officialUploaded} manual upload{row.officialUploaded === 1 ? '' : 's'}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs leading-5 text-[#64748B]">
                          {row.officialTextNames.length
                            ? row.officialTextNames.join(' · ')
                            : 'No official text stored yet'}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F172A]">
                          {row.pending} pending
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">{row.approved} approved</p>
                      </div>
                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${questionTone}`}
                        >
                          {row.trustedQuestions}/{row.questions} trusted
                        </span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setStandardCode(row.standardCode);
                            setStatus('all');
                            setActiveWorkbenchTab('passages');
                          }}
                          className="rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white"
                        >
                          Mine / View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
          {activeWorkbenchTab === 'overview' && needsSourceRows.length > 0 ? (
            <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Clean punch list
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">
                    Texts still needing a source
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-950">
                    These are the only official works GOGI cannot use yet. Everything marked
                    Stored or Uploaded is already available for mining/review.
                  </p>
                </div>
                <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                  {needsSourceRows.length} remaining
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {needsSourceRows.slice(0, 9).map((row) => (
                  <article
                    key={`${row.title}-${row.author ?? 'unknown'}`}
                    className="rounded-md border border-amber-200 bg-white p-3"
                  >
                    <p className="text-sm font-semibold text-[#0F172A]">{row.title}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{row.author ?? 'Author unknown'}</p>
                    <p className="mt-2 text-xs font-semibold text-amber-800">
                      {row.standards.slice(0, 4).join(' · ')}
                      {row.standards.length > 4 ? ` +${row.standards.length - 4}` : ''}
                    </p>
                  </article>
                ))}
              </div>
              {needsSourceRows.length > 9 ? (
                <p className="mt-3 text-xs text-amber-900">
                  Open Upload Checklist to see the full list.
                </p>
              ) : null}
            </section>
          ) : null}
          {activeWorkbenchTab === 'passages' ? (
            <section className="mt-5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                    Selected standard
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">
                    {standardCode} · {selectedDemand?.teacherTitle ?? selectedBlueprint?.teacherLabel}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">
                    Step 1: mine the stored official texts connected to this standard and organize
                    the excerpts. Student questions are Step 2.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      miningOfficialTexts ||
                      officialLibraryEntriesForStandard.filter(
                        (entry) => entry.status === 'stored' || entry.status === 'manual_upload'
                      ).length === 0
                    }
                    onClick={mineOfficialTextsForStandard}
                    className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                  >
                    {miningOfficialTexts ? 'Mining official texts...' : 'Mine stored texts'}
                  </button>
                  <button
                    type="button"
                    disabled={workingId === 'batch-generate-items' || workflowQueue.needsPackage.length === 0}
                    onClick={buildNextStudentItems}
                    className="rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] disabled:cursor-not-allowed disabled:text-[#94A3B8]"
                  >
                    Step 2: Build student items
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#DBEAFE] bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[#2563EB]">Official texts</p>
                  <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                    {officialLibraryEntriesForStandard.filter(
                      (entry) => entry.status === 'stored' || entry.status === 'manual_upload'
                    ).length}/
                    {officialLibraryEntriesForStandard.length}
                  </p>
                </div>
                <div className="rounded-md border border-amber-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-amber-700">Mined excerpts</p>
                  <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                    {rows.length}
                  </p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-emerald-700">Ready to send</p>
                  <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                    {workflowQueue.readyToPromote.length}
                  </p>
                </div>
                <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[#64748B]">Student questions</p>
                  <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                    {selectedLibraryStatus?.trusted_promoted_question_rows ?? 0}/
                    {selectedLibraryStatus?.promoted_question_rows ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-[#E2E8F0] bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Related texts in GOGI</p>
                <p className="mt-2 text-sm leading-6 text-[#334155]">
                  {selectedOfficialTextNames.length
                    ? selectedOfficialTextNames.join(' · ')
                    : 'No stored official texts yet for this standard.'}
                </p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-[#64748B]">
                      Mined excerpts by text
                    </p>
                    <span className="rounded-full border border-[#CBD5E1] px-2 py-1 text-xs font-semibold text-[#334155]">
                      {minedExcerptByText.length} texts
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <div className="grid min-w-[720px] grid-cols-[1.25fr_0.55fr_0.55fr_0.6fr_1.2fr] gap-3 border-b border-[#E2E8F0] pb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      <span>Text</span>
                      <span>Excerpts</span>
                      <span>Ready</span>
                      <span>Questions</span>
                      <span>Top skills</span>
                    </div>
                    {minedExcerptByText.length ? (
                      minedExcerptByText.map((item) => (
                        <div
                          key={`${item.title}-${item.author ?? 'unknown'}`}
                          className="grid min-w-[720px] grid-cols-[1.25fr_0.55fr_0.55fr_0.6fr_1.2fr] gap-3 border-b border-[#F1F5F9] py-3 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-[#0F172A]">{item.title}</p>
                            <p className="mt-1 text-xs text-[#64748B]">{item.author ?? 'Author unknown'}</p>
                          </div>
                          <p className="font-semibold text-[#0F172A]">{item.excerpts}</p>
                          <p className="font-semibold text-emerald-700">{item.ready}</p>
                          <p className="font-semibold text-[#2563EB]">{item.questions}</p>
                          <p className="text-xs leading-5 text-[#475569]">
                            {[...item.strands.entries()]
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3)
                              .map(([label, count]) => `${label} (${count})`)
                              .join(' · ') || 'Unsorted'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-sm text-[#64748B]">
                        No mined excerpts yet. Click Mine stored texts to build this library.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[#64748B]">
                    Mined excerpts by skill strand
                  </p>
                  <div className="mt-3 space-y-2">
                    {minedExcerptByStrand.length ? (
                      minedExcerptByStrand.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-[#0F172A]">{item.label}</p>
                            <span className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#334155]">
                              {item.excerpts}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#64748B]">
                            {item.texts.size} text{item.texts.size === 1 ? '' : 's'} · {item.ready}{' '}
                            ready · {item.questions} question rows
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#64748B]">No strand coverage yet.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={workflowQueue.readyToPromote.length === 0 || workingId === 'batch-ready-promote'}
                  onClick={promoteStudentReadyPackages}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                >
                  Send ready items to students
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedReview((current) => !current)}
                  className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#334155]"
                >
                  {showAdvancedReview ? 'Hide advanced excerpt review' : 'Show advanced excerpt review'}
                </button>
              </div>
            </section>
          ) : null}
          {activeWorkbenchTab === 'overview' ? (
            <section className="mt-3 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                    Content workflow
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">
                    Build student-ready FAST practice from official texts
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                    Work left to right: confirm the Florida text is in GOGI, build student
                    questions from raw excerpts, then send only trusted items to the student
                    library.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadRows({ announce: true })}
                  className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155]"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingRows ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-700">
                        Step 1
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
                        Official texts
                      </h3>
                    </div>
                    <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-800">
                      {workflowQueue.uploadedTexts} uploaded
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-blue-950">
                    See which Florida-listed works are uploaded or still rights-needed.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveWorkbenchTab('texts')}
                    className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Open text checklist
                  </button>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-amber-700">
                        Step 2
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
                        Build practice
                      </h3>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800">
                      {workflowQueue.needsPackage.length} need student items
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-amber-950">
                    Turn official excerpts into evidence-based FAST-style questions students can
                    answer.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStatus('all');
                        setActiveWorkbenchTab('passages');
                      }}
                      className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800"
                    >
                      Open build queue
                    </button>
                    <button
                      type="button"
                      disabled={
                        workingId === 'batch-generate-items' ||
                        workflowQueue.needsPackage.length === 0
                      }
                      onClick={() =>
                        generateItemPackages(
                          workflowQueue.needsPackage.map((row) => row.id),
                          'raw excerpt'
                        )
                      }
                      className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                    >
                      Build student items
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        Step 3
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
                        Student library
                      </h3>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800">
                      {workflowQueue.studentReady.length} ready
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    Approve and send only the items that passed the FAST quality gate.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={workflowQueue.studentReady.length === 0}
                      onClick={() => {
                        setStatus('all');
                        setActiveWorkbenchTab('passages');
                      }}
                      className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:text-[#94A3B8]"
                    >
                      Review ready items
                    </button>
                    <button
                      type="button"
                      disabled={
                        workingId === 'batch-ready-promote' ||
                        workflowQueue.readyToPromote.length === 0
                      }
                      onClick={promoteStudentReadyPackages}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                    >
                      Send ready items
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeWorkbenchTab === 'overview' ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="max-w-3xl text-sm leading-6 text-amber-900">
                Clean-start mode: hide old pre-official harvest rows from the working library.
                Keep only passages tied to the Florida FAST released text list or the B.E.S.T.
                Grade 9 text map for {standardCode}.
              </p>
              <button
                type="button"
                disabled={workingId === 'legacy-nonofficial' || nonOfficialCandidateCount === 0}
                onClick={legacyNonOfficialPassages}
                className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 disabled:cursor-not-allowed disabled:text-[#94A3B8]"
              >
                <XCircle className="h-4 w-4" />
                Legacy non-official ({nonOfficialCandidateCount})
              </button>
            </div>
          ) : null}
          {activeWorkbenchTab === 'overview' && selectedDemand ? (
            <p className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-sm leading-6 text-[#475569]">
              <span className="font-semibold text-[#0F172A]">{selectedDemand.studentTitle}:</span>{' '}
              {selectedDemand.fastDemand}
            </p>
          ) : null}
          {activeWorkbenchTab === 'overview' && selectedOfficialTexts.length ? (
            <div className="mt-3 rounded-md border border-[#CBD5E1] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                    Official B.E.S.T. text map
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Start here: Florida texts tied to {standardCode}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                    GOGI now routes harvests through this official text list first. Public-domain
                    texts feed passage harvesting. Rights-limited texts stay visible as teaching and
                    item-style references.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-[#64748B]">Texts</p>
                    <p className="font-semibold">{selectedOfficialCounts.total}</p>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-emerald-700">Available</p>
                    <p className="font-semibold">{selectedOfficialCounts.available}</p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-amber-700">Needs source</p>
                    <p className="font-semibold">
                      {selectedOfficialCounts.needsSource + selectedOfficialCounts.harvestable}
                    </p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-amber-700">Reference</p>
                    <p className="font-semibold">{selectedOfficialCounts.reference}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {selectedOfficialTextCards.map((model) => {
                  const officialEntry = officialLibraryEntryByTitle.get(titleKey(model.title));
                  const stored = officialEntry?.status === 'stored' || officialEntry?.status === 'manual_upload';
                  const uploadedCount =
                    rightsManagedCountByOfficialTitle[titleKey(model.title)] ?? 0;
                  const available = stored || uploadedCount > 0;
                  const sourceAttemptedButNotStored =
                    officialEntry &&
                    ['needs_upload', 'fetch_failed', 'needs_gutenberg_match'].includes(
                      officialEntry.status
                    );
                  const badgeClass = available
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : sourceAttemptedButNotStored
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : officialSourceBadgeClassesForModel(model, uploadedCount);
                  const badgeLabel = stored
                    ? 'Stored'
                    : sourceAttemptedButNotStored
                      ? 'Needs source'
                    : officialSourceBadgeLabel(model, uploadedCount);
                  return (
                    <div
                      key={`${model.sourceDocument}-${model.title}-${model.author ?? 'unknown'}`}
                      className={`rounded-md border p-3 ${
                        available
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-[#E2E8F0] bg-[#F8FAFC]'
                      }`}
                    >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{model.title}</p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {model.author ?? 'Author unknown'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${badgeClass}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {model.standards.map((standard) => (
                        <span
                          key={standard}
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                            standard === standardCode
                              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]'
                              : 'border-[#CBD5E1] bg-white text-[#334155]'
                          }`}
                        >
                          {standard}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#475569]">
                      {stored
                        ? 'This official text is already stored in GOGI and can feed mined excerpt review.'
                        : sourceAttemptedButNotStored
                          ? 'GOGI could not store this automatically from Gutenberg. Use the manual upload flow or another authorized source.'
                        : officialSourceUsageLine(model, uploadedCount)}
                    </p>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {activeWorkbenchTab === 'overview' ? (
            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Rights-managed import
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">
                    Attach a school-authorized excerpt
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-950">
                    Paste a classroom-authorized excerpt or full text from a Florida-listed work.
                    GOGI will match the title to the official text map, split long texts into
                    teachable excerpts, and create review rows for every standard tied to that work.
                    The current standard is only used as a fallback.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-blue-800">
                    Work title
                  </span>
                  <input
                    value={manualImport.sourceTitle}
                    onChange={(event) =>
                      setManualImport((current) => ({
                        ...current,
                        sourceTitle: event.target.value,
                      }))
                    }
                    placeholder="Letter from Birmingham Jail"
                    className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-blue-800">
                    Author
                  </span>
                  <input
                    value={manualImport.sourceAuthor}
                    onChange={(event) =>
                      setManualImport((current) => ({
                        ...current,
                        sourceAuthor: event.target.value,
                      }))
                    }
                    placeholder="Martin Luther King, Jr."
                    className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-blue-800">
                    Optional focus strand
                  </span>
                  <select
                    value={manualImport.coverageStrandId}
                    onChange={(event) =>
                      setManualImport((current) => ({
                        ...current,
                        coverageStrandId: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                  >
                    <option value="">Let GOGI route by official text map</option>
                    {selectedBlueprint?.coverageStrands?.map((strand) => (
                      <option key={strand.id} value={strand.id}>
                        {strand.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-blue-800">
                    Optional skill note
                  </span>
                  <input
                    value={manualImport.targetSignal}
                    onChange={(event) =>
                      setManualImport((current) => ({
                        ...current,
                        targetSignal: event.target.value,
                      }))
                    }
                    placeholder="rhetorical appeal, claim support, figurative effect..."
                    className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase text-blue-800">
                  Rights/use basis
                </span>
                <input
                  value={manualImport.rightsBasis}
                  onChange={(event) =>
                    setManualImport((current) => ({
                      ...current,
                      rightsBasis: event.target.value,
                    }))
                  }
                  placeholder="Teacher-provided classroom excerpt; district-approved instructional use"
                  className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase text-blue-800">
                  Text
                </span>
                <textarea
                  value={manualImport.paragraphText}
                  onChange={(event) =>
                    setManualImport((current) => ({
                      ...current,
                      paragraphText: event.target.value,
                    }))
                  }
                  rows={7}
                  placeholder="Paste the classroom-authorized excerpt or full text here."
                  className="w-full rounded-md border border-blue-200 px-3 py-2 text-sm leading-6"
                />
              </label>
              <label className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-blue-950">
                <input
                  type="checkbox"
                  checked={manualImport.saveAsFullText}
                  onChange={(event) =>
                    setManualImport((current) => ({
                      ...current,
                      saveAsFullText: event.target.checked,
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  Save this upload as the full official source text for this work.
                  Keep this checked when you paste a whole speech, essay, story, or book.
                </span>
              </label>
              <button
                type="button"
                disabled={workingId === 'manual-import'}
                onClick={importRightsManagedExcerpt}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
              >
                <Send className="h-4 w-4" />
                Add rights-managed text
              </button>
            </div>
          ) : null}
          {activeWorkbenchTab === 'overview' && selectedBlueprint ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                <p className="text-xs font-semibold uppercase text-[#2563EB]">
                  Standard-first harvest
                </p>
                <p className="mt-2 text-sm leading-6 text-[#1E3A8A]">
                  {selectedBlueprint.harvestGoal}
                </p>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">
                  Fallback harvest lenses
                </p>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  These are broad internal lenses. Strand cards below narrow the actual harvest.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedBlueprint.classifications.map((classification) => (
                    <span
                      key={classification}
                      className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-semibold text-[#334155]"
                    >
                      {classification.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Trust gate</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Approve only excerpts with clear evidence, teachable 9th-grade access, and no
                  whole-book or schema-gated dependency.
                </p>
              </div>
            </div>
          ) : null}
          {activeWorkbenchTab === 'overview' && selectedBlueprint?.coverageStrands?.length ? (
            <div className="mt-3 rounded-md border border-[#CBD5E1] bg-white p-3">
              <p className="text-xs font-semibold uppercase text-[#64748B]">
                Standard coverage strands
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedBlueprint.coverageStrands.map((strand) => (
                  <div
                    key={strand.id}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                  >
                    <p className="text-sm font-semibold text-[#0F172A]">{strand.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#475569]">{strand.studentCanDo}</p>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-[#64748B]">
                      Strand harvest lenses
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(strand.classifications ?? selectedBlueprint.classifications).map(
                        (classification) => (
                          <span
                            key={classification}
                            className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#1D4ED8]"
                          >
                            {classification.replace(/_/g, ' ')}
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase text-[#64748B]">
                      Harvest signals
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {strand.harvestSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-[11px] font-semibold text-[#334155]"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {activeWorkbenchTab === 'overview' && selectedBlueprint ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Must have</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-[#475569]">
                  {selectedBlueprint.passageRequirements.map((requirement) => (
                    <li key={requirement}>- {requirement}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-semibold uppercase text-rose-700">Reject if</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-rose-900">
                  {selectedBlueprint.rejectIf.map((rule) => (
                    <li key={rule}>- {rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>

        {error ? (
          <p className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        {!loading &&
        rows.length &&
        (activeWorkbenchTab === 'overview' || activeWorkbenchTab === 'passages') ? (
          <section
            className={`mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm ${
              activeWorkbenchTab === 'overview' ? 'hidden' : ''
            }`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Build queue
              </p>
              <h2 className="mt-1 text-lg font-semibold">What needs attention for this standard</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                Start with the amber cards below. Build one student item at a time, review the
                question, then approve and send it when it is strong.
              </p>
            </div>
            <div className="mt-4 grid gap-2 text-center text-sm md:grid-cols-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  Ready for students
                </p>
                <p className="font-semibold">{readinessSummary.ready}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-blue-700">
                  Standard fix
                </p>
                <p className="font-semibold">{readinessSummary.metadata}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-amber-700">
                  Need student item
                </p>
                <p className="font-semibold">{readinessSummary.regenerate}</p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-rose-700">Remove</p>
                <p className="font-semibold">{readinessSummary.reject}</p>
              </div>
            </div>
            {coverageMap.length ? (
              <details className="mt-4 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] p-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#334155]">
                  Show standard strand coverage
                </summary>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Standard coverage
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-[#0F172A]">
                      Ready reps by skill strand
                    </h3>
                  </div>
                  <p className="max-w-xl text-xs leading-5 text-[#64748B]">
                    This is the map GOGI will use to assign Noah the right skill reps: standard,
                    strand, skill, student move, and item type.
                  </p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {coverageMap.map((strand) => (
                    <div key={strand.id} className="rounded-md border border-[#E2E8F0] bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{strand.label}</p>
                          <p className="mt-1 text-xs leading-5 text-[#64748B]">
                            {strand.studentCanDo}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                          {strand.ready} ready
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px]">
                        <div className="rounded border border-emerald-100 bg-emerald-50 px-1 py-1 text-emerald-800">
                          {strand.ready} ready
                        </div>
                        <div className="rounded border border-blue-100 bg-blue-50 px-1 py-1 text-blue-800">
                          {strand.metadata} meta
                        </div>
                        <div className="rounded border border-amber-100 bg-amber-50 px-1 py-1 text-amber-800">
                          {strand.regenerate} regen
                        </div>
                        <div className="rounded border border-rose-100 bg-rose-50 px-1 py-1 text-rose-800">
                          {strand.reject} reject
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}

        {activeWorkbenchTab === 'harvest' && harvestStatus ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Latest harvest status
                </p>
                <h2 className="mt-1 text-lg font-semibold capitalize">
                  {harvestStatus.status === 'quiet'
                    ? 'No recent log activity'
                    : harvestStatus.status}
                </h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  Updated {new Date(harvestStatus.modified_at).toLocaleString()} ·{' '}
                  {harvestStatus.log_path}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadHarvestStatus();
                  loadHarvestIntelligence();
                  loadRows();
                }}
                className="inline-flex items-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155]"
              >
                <RefreshCw className="h-4 w-4" />
                Check now
              </button>
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-[#0F172A] p-3 text-xs leading-5 text-[#E2E8F0]">
              {harvestStatus.tail.join('\n')}
            </pre>
          </section>
        ) : null}

        {activeWorkbenchTab === 'harvest' && harvestIntelligence ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Harvest intelligence
                </p>
                <h2 className="mt-1 text-lg font-semibold">Source yield and failure patterns</h2>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  ['Seen', harvestIntelligence.totals.candidates_seen],
                  ['Suitable', harvestIntelligence.totals.suitable],
                  ['Rejected', harvestIntelligence.totals.rejected],
                  ['Inserted', harvestIntelligence.totals.inserted],
                  ['Errors', harvestIntelligence.totals.write_errors],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                  >
                    <p className="font-semibold text-[#64748B]">{label}</p>
                    <p className="mt-1 text-base font-semibold text-[#0F172A]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {harvestIntelligence.recommendations.length ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Recommendations</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                  {harvestIntelligence.recommendations.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Book yield</p>
                <div className="mt-2 space-y-2">
                  {harvestIntelligence.books.slice(0, 6).map((book) => (
                    <div
                      key={book.title}
                      className="rounded-md border border-[#E2E8F0] bg-white p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{book.title}</p>
                          <p className="text-xs text-[#64748B]">{book.author}</p>
                        </div>
                        <p className="rounded-full border border-[#CBD5E1] px-2 py-1 text-xs font-semibold">
                          {(book.yield_rate * 100).toFixed(1)}% yield
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#475569]">
                        {book.suitable}/{book.total} suitable · {book.errors} write errors ·{' '}
                        {book.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-xs font-semibold uppercase text-[#64748B]">Rejection patterns</p>
                <div className="mt-2 space-y-2">
                  {harvestIntelligence.rejection_buckets.map((bucket) => (
                    <div
                      key={bucket.label}
                      className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-white p-3 text-sm"
                    >
                      <span className="font-semibold capitalize text-[#334155]">
                        {bucket.label}
                      </span>
                      <span className="font-semibold text-[#0F172A]">{bucket.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            Loading Gutenberg passages...
          </p>
        ) : activeWorkbenchTab === 'promoted' && promotedReviewItems.length ? (
          <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Student library review
                </p>
                <h2 className="mt-1 text-lg font-semibold">Check student-facing practice items</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#475569]">
                  These are the questions students can receive. Review the question, answer choices,
                  correct answer, quality note, and source passage before using the set broadly.
                </p>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-3">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-blue-700">Promoted items</p>
                  <p className="font-semibold">{promotedReviewItems.length}</p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-emerald-700">
                    Strong signal
                  </p>
                  <p className="font-semibold">{promotedReviewSummary.strong}</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-amber-700">Needs skim</p>
                  <p className="font-semibold">{promotedReviewSummary.needsSkim}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={workingId === 'regenerate-promoted' || !promotedReviewItems.length}
                onClick={regeneratePromotedPackages}
                className="inline-flex items-center gap-2 rounded-md bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
              >
                <RefreshCw className={`h-4 w-4 ${workingId === 'regenerate-promoted' ? 'animate-spin' : ''}`} />
                Regenerate promoted set
              </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(promotedReviewSummary.byStrand).map(([label, count]) => (
                <span
                  key={label}
                  className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#334155]"
                >
                  {label}: {count}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {!loading &&
        rows.length &&
        ((activeWorkbenchTab === 'passages' && showAdvancedReview) ||
          (activeWorkbenchTab === 'promoted' && promotedReviewItems.length > 0)) ? (
          <div className="grid gap-4">
            {activeWorkbenchTab === 'passages' ? (
              <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E3A8A]">
                Showing {reviewRows.length} excerpt{reviewRows.length === 1 ? '' : 's'} sorted by{' '}
                <span className="font-semibold">
                  {excerptSort === 'newest'
                    ? 'newest mined first'
                    : excerptSort === 'ald'
                      ? 'strongest FAST Next Step match'
                      : 'review queue order'}
                </span>
                . Most recent excerpt:{' '}
                <span className="font-semibold">
                  {formatCreatedAt(reviewRows[0]?.created_at ?? null)}
                </span>
                .
              </div>
            ) : null}
            {visibleReviewEntries.map((entry) => {
              const row = entry.row;
              const rowStatus = displayStatus(row);
              const approved = rowStatus === 'approved';
              const promoted = row.promoted_question_count > 0;
              const decision = reviewDecision(row);
              const readiness = readinessDecision(row, selectedBlueprint);
              const taxonomy = entry.taxonomy;
              const generatedPreview = entry.preview ?? row.generated_item_preview;
              const itemMatchesTaxonomy = generatedPreview
                ? generatedItemMatchesTaxonomy(generatedPreview, taxonomy)
                : true;
              const workflowStep = workflowStepFor(row);
              return (
                <article
                  key={entry.question ? `${row.id}:${entry.question.id}` : row.id}
                  className="rounded-lg border border-[#CBD5E1] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(
                            rowStatus
                          )}`}
                        >
                          {rowStatus.replace('_', ' ')}
                        </span>
                        <span className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#2563EB]">
                          {row.classification.replace(/_/g, ' ')}
                        </span>
                        <span className="rounded-full border border-[#E2E8F0] px-2 py-1 text-xs font-semibold text-[#64748B]">
                          Tier {row.intervention_tier ?? '?'} · {row.word_count} words
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${reviewDecisionClasses(
                            decision.tone
                          )}`}
                        >
                          {decision.label} · {decision.score}/6
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${readinessClasses(
                            readiness.tone
                          )}`}
                        >
                          {readiness.label}
                        </span>
                        {!itemMatchesTaxonomy ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
                            Question/strand mismatch
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">{sourceLabel(row)}</h2>
                      <p className="mt-1 text-sm text-[#64748B]">
                        Target signal: {row.target_signal ?? 'not tagged'} · Clean strand:{' '}
                        {taxonomy.strandLabel} · Feeds {taxonomy.standardCode ?? 'unmapped'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#64748B]">
                        GOGI check: {decision.reasons.slice(0, 3).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#64748B]">
                        Queue action: {readiness.action} · {readiness.reasons.slice(0, 2).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#64748B]">
                        Skill strategy: {taxonomy.studentMove} · Item type: {taxonomy.itemType}
                      </p>
                      {activeWorkbenchTab === 'passages' ? (
                        <div
                          className={`mt-3 rounded-md border p-3 text-sm ${
                            workflowStep.tone === 'green'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                              : workflowStep.tone === 'blue'
                                ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                                : 'border-amber-200 bg-amber-50 text-amber-900'
                          }`}
                        >
                          <p className="font-semibold">{workflowStep.label}</p>
                          <p className="mt-1 text-xs leading-5">{workflowStep.next}</p>
                        </div>
                      ) : null}
                      {row.ald_purpose?.questions?.length ? (
                        <div className="mt-3 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">
                              FAST Next Step purpose
                            </p>
                            {row.ald_purpose.score !== null ? (
                              <span className="rounded-full border border-[#DBEAFE] bg-white px-2 py-1 text-[11px] font-semibold text-[#1D4ED8]">
                                ALD score {row.ald_purpose.score}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#0F172A]">
                            {row.ald_purpose.questions[0].question}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#334155]">
                            {row.ald_purpose.questions[0].content_use}
                          </p>
                          {row.ald_purpose.reasons.length ? (
                            <p className="mt-2 text-xs leading-5 text-[#64748B]">
                              Selected because: {row.ald_purpose.reasons.slice(0, 2).join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {generatedPreview && !itemMatchesTaxonomy ? (
                        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs leading-5 text-rose-900">
                          This item is tagged to {taxonomy.strandLabel}, but the question stem is
                          still using an older generic mood-detail pattern. Regenerate the promoted
                          set before using it with students.
                        </p>
                      ) : !generatedPreview ? (
                        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                          This is a raw passage candidate. It still needs GOGI evidence tagging and
                          a FAST-style student question before it can become student work.
                        </p>
                      ) : null}
                    </div>
                    {activeWorkbenchTab === 'passages' ? (
                      <div className="flex max-w-[220px] flex-wrap justify-end gap-2">
                        {!row.generated_item_preview && !promoted ? (
                          <button
                            type="button"
                            disabled={workingId === row.id}
                            onClick={() => generateItemPackages([row.id])}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${workingId === row.id ? 'animate-spin' : ''}`}
                            />
                            Build student item
                          </button>
                        ) : null}
                        {row.generated_item_preview && rowStatus !== 'approved' && !promoted ? (
                          <button
                            type="button"
                            disabled={workingId === row.id}
                            onClick={() => updatePassage(row.id, 'approved')}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-[#94A3B8]"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve item
                          </button>
                        ) : null}
                        {row.generated_item_preview && approved && !promoted ? (
                          <button
                            type="button"
                            disabled={workingId === row.id}
                            onClick={() => promotePassage(row.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94A3B8]"
                          >
                            <Send className="h-4 w-4" />
                            Send to student library
                          </button>
                        ) : null}
                        {promoted ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="h-4 w-4" />
                            Promoted
                          </span>
                        ) : null}
                        {rowStatus !== 'rejected' ? (
                          <button
                            type="button"
                            disabled={workingId === row.id || promoted}
                            onClick={() => updatePassage(row.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:text-[#94A3B8]"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        <BookOpenCheck className="h-4 w-4" />
                        Passage
                      </p>
                      <p className="whitespace-pre-line text-sm leading-7 text-[#334155]">
                        {truncate(row.paragraph_text)}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold uppercase text-emerald-700">
                          {generatedPreview ? 'Supporting evidence' : 'Evidence after item build'}
                        </p>
                        {generatedPreview ? (
                          (row.supporting_evidence ?? []).slice(0, 3).map((item) => (
                            <p key={item.element} className="mt-2 text-xs leading-5 text-emerald-900">
                              “{item.element}” · {item.rationale}
                            </p>
                          ))
                        ) : (
                          <p className="mt-2 text-xs leading-5 text-emerald-900">
                            This row is still raw. Click Build student item and GOGI will rebuild
                            the exact evidence, distractor anchors, and FAST-style question preview.
                          </p>
                        )}
                      </div>
                      <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-[#64748B]">
                          Student practice item
                        </p>
                        {generatedPreview ? (
                          <div className="mt-2 space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[11px] font-semibold text-[#1D4ED8]">
                                {generatedPreview.target_standard ?? row.standard_code}
                              </span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                                {generatedPreview.quality ?? 'quality pending'}
                              </span>
                              <span className="rounded-full border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#475569]">
                                Skill: {generatedPreview.target_skill ?? row.target_signal}
                              </span>
                            </div>
                            <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                              <p className="text-xs font-semibold uppercase text-[#64748B]">
                                Question
                              </p>
                              <p className="mt-1 text-sm font-semibold leading-6 text-[#0F172A]">
                                {generatedPreview.question}
                              </p>
                            </div>
                            <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-[#64748B]">
                                Choices
                              </p>
                              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-[#334155]">
                                {generatedPreview.options}
                              </pre>
                              <p className="mt-2 text-xs font-semibold text-[#0F172A]">
                                Correct answer: {generatedPreview.answer ?? '?'} · Difficulty{' '}
                                {generatedPreview.difficulty_level ?? '?'}
                              </p>
                            </div>
                            <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                              <p className="text-xs font-semibold uppercase text-[#2563EB]">
                                Teacher trust note
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[#1E3A8A]">
                                {generatedPreview.teacher_trust_note ??
                                  'This item was generated from tagged Gutenberg evidence.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-3">
                            <p className="text-xs font-semibold uppercase text-rose-700">
                              Not ready yet
                            </p>
                            <p className="mt-1 text-xs leading-5 text-rose-900">
                              This passage has not been converted into a trusted student question
                              yet. Next step: build the evidence, distractor anchors, and question
                              from this excerpt before sending it to the student library.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : !loading && activeWorkbenchTab === 'passages' && rows.length && !showAdvancedReview ? (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            Advanced raw excerpt cards are hidden. Use the standard panel above to build student
            items, or open advanced review only when you need to inspect individual excerpts.
          </p>
        ) : !loading && activeWorkbenchTab === 'promoted' && !promotedReviewItems.length ? (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            No student-library items found for this standard yet. Build, approve, and send student
            items first, then return here to audit what students can receive.
          </p>
        ) : !loading && activeWorkbenchTab === 'passages' && !rows.length ? (
          <p className="rounded-lg border border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
            No Gutenberg passages found for this standard/status yet. Run the batch pipeline for a
            mapped classification, then return here to curate.
          </p>
        ) : null}
      </div>
    </main>
  );
}
