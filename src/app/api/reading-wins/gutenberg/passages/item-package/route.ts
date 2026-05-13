import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  buildGutenbergReadingWinQuestionInsert,
  type GutenbergPassageForReadingWin,
} from '@/lib/reading-wins/gutenbergBridge';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';
import { getFastAldGuidanceForStandard } from '@/lib/fast/achievementLevelDescriptions';

export const runtime = 'nodejs';

const PASSAGE_SELECT =
  'id, classification, source, standard_code, coverage_strand_id, coverage_strand_label, coverage_strand_signals, paragraph_text, word_count, paragraph_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale';
const REVIEWABLE_PASSAGE_SOURCES = ['gutenberg', 'manual_rights', 'official_text_library'];

type EvidencePoint = { element: string; rationale: string };
type GeneratedPackage = {
  target_signal?: string;
  supporting_evidence?: EvidencePoint[];
  non_supporting_evidence?: EvidencePoint[];
  plausible_distractors?: string[];
  intervention_tier?: number;
  tier_rationale?: string;
  item_patterns_supported?: string[];
  dominant_concept?: string | null;
  discrimination_item_type?: string;
  teacher_note?: string;
};

function getSupabaseApiKey() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRole &&
    (serviceRole.startsWith('eyJ') ||
      serviceRole.startsWith('sb_secret_') ||
      serviceRole.length > 80)
  ) {
    return serviceRole;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function textContainsEvidence(passageText: string, evidence: string) {
  const normalizedPassage = normalize(passageText);
  const normalizedEvidence = normalize(evidence);
  return normalizedEvidence.length >= 12 && normalizedPassage.includes(normalizedEvidence);
}

function compact(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).replace(/\s+\S*$/, '')}...`;
}

function chooseStrand(row: GutenbergPassageForReadingWin) {
  const standardCode = row.standard_code ?? null;
  const blueprint = standardCode ? getGutenbergStandardBlueprint(standardCode) : undefined;
  if (!blueprint?.coverageStrands?.length) return null;

  const existing = blueprint.coverageStrands.find((strand) => strand.id === row.coverage_strand_id);
  if (existing) return existing;

  const target = normalize(row.target_signal);
  const text = normalize(`${row.paragraph_text} ${row.coverage_strand_label ?? ''}`);

  if (standardCode === 'ELA.9.R.1.1') {
    return (
      blueprint.coverageStrands.find((strand) => strand.id === 'style-or-meaning-effect') ??
      blueprint.coverageStrands[0]
    );
  }

  if (standardCode === 'ELA.9.R.3.1') {
    const direct =
      /simile|metaphor|comparison|\blike\b|\bas if\b|\bas though\b/.test(`${target} ${text}`)
        ? 'metaphor-simile'
        : /personification|nonhuman|human/.test(`${target} ${text}`)
          ? 'personification'
          : /imagery|sensory|visual|sound|color|cold|light|dark/.test(`${target} ${text}`)
            ? 'imagery-sensory-language'
            : /symbol|allusion|idiom/.test(`${target} ${text}`)
              ? 'allusion-idiom-symbol'
              : 'mood-effect-evidence';
    return blueprint.coverageStrands.find((strand) => strand.id === direct) ?? blueprint.coverageStrands[0];
  }

  return blueprint.coverageStrands[0];
}

function classificationFor(row: GutenbergPassageForReadingWin) {
  const blueprint = row.standard_code ? getGutenbergStandardBlueprint(row.standard_code) : undefined;
  const strand = chooseStrand(row);
  return strand?.classifications?.[0] ?? blueprint?.classifications?.[0] ?? row.classification;
}

function parseJson(raw: string): GeneratedPackage | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as GeneratedPackage;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as GeneratedPackage;
    } catch {
      return null;
    }
  }
}

function buildPrompt(row: GutenbergPassageForReadingWin) {
  const strand = chooseStrand(row);
  const blueprint = row.standard_code ? getGutenbergStandardBlueprint(row.standard_code) : undefined;
  const aldGuidance = row.standard_code ? getFastAldGuidanceForStandard(row.standard_code) : [];
  const aldPromptLines = aldGuidance
    .map((item) => `- ${item.question} Content use: ${item.content_use}`)
    .join('\n');

  return `You are building one GOGI FAST-aligned item package from a teacher-uploaded official Grade 9 text excerpt.

Goal: tag this exact excerpt so GOGI can generate a student-ready Reading Win item. Do not write the final multiple-choice item. Return only evidence metadata.

Standard: ${row.standard_code}
Standard focus: ${blueprint?.teacherLabel ?? 'unknown'}
Coverage strand: ${strand?.label ?? row.coverage_strand_label ?? 'unknown'}
Student move: ${strand?.studentCanDo ?? blueprint?.studentMove ?? 'Use passage evidence to explain the reading move.'}
Harvest signals: ${(strand?.harvestSignals ?? row.coverage_strand_signals ?? []).join(', ') || 'none'}
FAST ISR achievement-level guidance:
${aldPromptLines || '- Use the standard focus and coverage strand as the instructional target.'}
Source: ${row.source_title ?? 'Unknown'} — ${row.source_author ?? 'Unknown'}

Passage:
"""
${row.paragraph_text}
"""

Rules:
- Quote only exact words that appear in the passage.
- Find the most teachable target in THIS excerpt, not the whole book.
- The target should help a student practice one of the FAST ISR guidance questions above whenever the excerpt supports it.
- supporting_evidence must include 2 or 3 exact phrase/sentence quotes that support the target.
- non_supporting_evidence must include 3 exact phrase/sentence quotes that are plausible distractor anchors but do not prove the target.
- Rationales must be student-facing, short, and concrete. No graduate-school language.
- For answer choice quality, distractor anchors must be plausible misunderstandings, not obviously irrelevant throwaways.
- If the excerpt cannot support this standard/strand, return target_signal: "TARGET_NOT_DETECTED" with teacher_note.

Return strict JSON only:
{
  "target_signal": "specific skill/effect in 2-5 words",
  "supporting_evidence": [
    {"element": "exact quote from passage", "rationale": "student-facing reason it supports the target"}
  ],
  "non_supporting_evidence": [
    {"element": "exact quote from passage", "rationale": "student-facing reason it is tempting but not best"}
  ],
  "plausible_distractors": ["wrong idea 1", "wrong idea 2", "wrong idea 3"],
  "intervention_tier": 1,
  "tier_rationale": "why this excerpt is Tier 1-4",
  "item_patterns_supported": ["manual_rights_item_package"],
  "dominant_concept": "optional concept",
  "discrimination_item_type": "phrase_level",
  "teacher_note": "brief note"
}`;
}

async function generatePackage(row: GutenbergPassageForReadingWin) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000 });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 1800,
    temperature: 0.2,
    system:
      'You are a precise Grade 9 Florida FAST reading item evidence tagger. Return strict JSON only.',
    messages: [{ role: 'user', content: buildPrompt(row) }],
  });
  const raw = response.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim();
  return parseJson(raw);
}

function packageFailureReason(row: GutenbergPassageForReadingWin, generated: GeneratedPackage) {
  if (generated.target_signal === 'TARGET_NOT_DETECTED') {
    return generated.teacher_note ?? 'GOGI could not find a clear testable target in this excerpt.';
  }
  const supporting = (generated.supporting_evidence ?? []).filter(
    (item) => item.element && item.rationale && textContainsEvidence(row.paragraph_text, item.element)
  );
  const nonSupporting = (generated.non_supporting_evidence ?? []).filter(
    (item) => item.element && item.rationale && textContainsEvidence(row.paragraph_text, item.element)
  );

  if (supporting.length < 1) {
    return 'GOGI could not find an exact quoted support anchor in this excerpt.';
  }
  if (nonSupporting.length < 2) {
    return 'GOGI could not find enough plausible distractor anchors in this excerpt.';
  }
  return null;
}

function sanitizePackage(row: GutenbergPassageForReadingWin, generated: GeneratedPackage) {
  if (packageFailureReason(row, generated)) return null;
  const supporting = (generated.supporting_evidence ?? [])
    .filter((item) => item.element && item.rationale && textContainsEvidence(row.paragraph_text, item.element))
    .slice(0, 3)
    .map((item) => ({ element: compact(item.element, 180), rationale: compact(item.rationale, 170) }));
  const nonSupporting = (generated.non_supporting_evidence ?? [])
    .filter((item) => item.element && item.rationale && textContainsEvidence(row.paragraph_text, item.element))
    .slice(0, 3)
    .map((item) => ({ element: compact(item.element, 160), rationale: compact(item.rationale, 170) }));
  if (supporting.length < 1 || nonSupporting.length < 2) return null;

  const tier = [1, 2, 3, 4].includes(Number(generated.intervention_tier))
    ? Number(generated.intervention_tier)
    : row.intervention_tier || 2;

  return {
    target_signal: compact(generated.target_signal ?? row.target_signal ?? 'reading effect', 80),
    supporting_evidence: supporting,
    non_supporting_evidence: nonSupporting,
    plausible_distractors: (generated.plausible_distractors ?? []).map((item) => compact(item, 80)).slice(0, 3),
    intervention_tier: tier,
    tier_rationale: compact(generated.tier_rationale ?? generated.teacher_note ?? 'Manual item package generated from official text excerpt.', 240),
    item_patterns_supported: generated.item_patterns_supported?.length
      ? generated.item_patterns_supported
      : ['manual_rights_item_package'],
    dominant_concept: generated.dominant_concept ?? null,
    discrimination_item_type: ['phrase_level', 'sentence_level', 'paragraph_level'].includes(
      generated.discrimination_item_type ?? ''
    )
      ? generated.discrimination_item_type
      : 'sentence_level',
  };
}

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json().catch(() => ({}))) as {
      passage_ids?: string[];
      limit?: number;
      standard_code?: string;
    };
    const passageIds = body.passage_ids?.filter(Boolean) ?? [];
    const limitBase = body.limit ?? (passageIds.length || 10);
    const limit = Math.max(1, Math.min(30, Math.floor(Number(limitBase))));

    let query = supabase
      .from('intervention_passages')
      .select(PASSAGE_SELECT)
      .in('source', REVIEWABLE_PASSAGE_SOURCES)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (passageIds.length) query = query.in('id', passageIds);
    if (body.standard_code) query = query.eq('standard_code', body.standard_code);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as GutenbergPassageForReadingWin[];
    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        scanned_count: 0,
        generated_count: 0,
        student_ready_count: 0,
        failed_count: 0,
        failed: [],
        message:
          'No matching passage rows were found for item-package generation. Refresh the page and try the newest official-text row again.',
      });
    }

    let generatedCount = 0;
    let studentReadyCount = 0;
    const failed: Array<{ id: string; reason: string }> = [];

    for (const row of rows) {
      const strand = chooseStrand(row);
      const generated = await generatePackage({
        ...row,
        classification: classificationFor(row),
        coverage_strand_id: strand?.id ?? row.coverage_strand_id ?? null,
        coverage_strand_label: strand?.label ?? row.coverage_strand_label ?? null,
        coverage_strand_signals: strand?.harvestSignals ?? row.coverage_strand_signals ?? null,
      });
      if (!generated) {
        failed.push({ id: row.id, reason: 'model did not return valid JSON' });
        continue;
      }
      const sanitized = sanitizePackage(row, generated);
      if (!sanitized) {
        failed.push({
          id: row.id,
          reason: packageFailureReason(row, generated) ?? 'GOGI could not build a student item from this excerpt.',
        });
        continue;
      }

      const updatedRow = {
        ...row,
        classification: classificationFor(row),
        coverage_strand_id: strand?.id ?? row.coverage_strand_id ?? null,
        coverage_strand_label: strand?.label ?? row.coverage_strand_label ?? null,
        coverage_strand_signals: strand?.harvestSignals ?? row.coverage_strand_signals ?? null,
        ...sanitized,
      };
      const preview = buildGutenbergReadingWinQuestionInsert(updatedRow, { standardId: null });
      const { error: updateError } = await supabase
        .from('intervention_passages')
        .update({
          classification: updatedRow.classification,
          coverage_strand_id: updatedRow.coverage_strand_id,
          coverage_strand_label: updatedRow.coverage_strand_label,
          coverage_strand_signals: updatedRow.coverage_strand_signals,
          target_signal: sanitized.target_signal,
          supporting_evidence: sanitized.supporting_evidence,
          non_supporting_evidence: sanitized.non_supporting_evidence,
          plausible_distractors: sanitized.plausible_distractors,
          intervention_tier: sanitized.intervention_tier,
          tagger_tier: sanitized.intervention_tier,
          item_patterns_supported: sanitized.item_patterns_supported,
          dominant_concept: sanitized.dominant_concept,
          discrimination_item_type: sanitized.discrimination_item_type,
          tier_rationale: `${sanitized.tier_rationale} ${
            preview
              ? 'Generated student item passed the FAST preview gate.'
              : 'Generated student item still needs quality review.'
          }`,
        })
        .eq('id', row.id);
      if (updateError) throw new Error(updateError.message);

      generatedCount += 1;
      if (preview) studentReadyCount += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned_count: rows.length,
      generated_count: generatedCount,
      student_ready_count: studentReadyCount,
      failed_count: failed.length,
      failed,
      message: `Built student items for ${generatedCount} passage${
        generatedCount === 1 ? '' : 's'
      }. ${studentReadyCount} passed the FAST preview gate; ${failed.length} need a different excerpt or target.`,
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/passages/item-package] error:', err);
    const message = err instanceof Error ? err.message : 'Could not generate item package.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
