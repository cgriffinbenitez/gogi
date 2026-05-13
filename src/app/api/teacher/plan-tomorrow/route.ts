import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  FAST_GRADE9_READING_DEMANDS,
  getPrimaryFastReadingDemand,
} from '@/lib/reading-wins/fastSkillMap';

export const runtime = 'nodejs';

type PassageRow = {
  id: string;
  source: string | null;
  standard_code: string | null;
  coverage_strand_label: string | null;
  paragraph_text: string | null;
  word_count: number | null;
  source_title: string | null;
  source_author: string | null;
  intervention_tier: number | null;
  target_signal: string | null;
  supporting_evidence: unknown;
  approval_status: string | null;
  approved: boolean | null;
  rejection_reason: string | null;
  created_at: string | null;
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

function evidenceCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  if (typeof value === 'string' && value.trim()) return 1;
  return 0;
}

function sourceRank(source: string | null) {
  if (source === 'official_text_library') return 18;
  if (source === 'manual_rights') return 16;
  if (source === 'gutenberg') return 14;
  return 0;
}

function scorePassage(row: PassageRow) {
  const words = row.word_count ?? 0;
  const manageableLength =
    words >= 140 && words <= 360 ? 24 : words >= 90 && words <= 520 ? 12 : -12;
  const reviewScore = row.approved || row.approval_status === 'approved' ? 24 : 8;
  const evidenceScore = Math.min(18, evidenceCount(row.supporting_evidence) * 6);
  const strandScore = row.coverage_strand_label ? 14 : 0;
  const textScore = row.source_title ? 8 : 0;
  const tierScore = row.intervention_tier ? Math.max(0, 8 - row.intervention_tier) : 0;

  return (
    sourceRank(row.source) +
    manageableLength +
    reviewScore +
    evidenceScore +
    strandScore +
    textScore +
    tierScore
  );
}

function plainText(text: string | null, max = 520) {
  const compact = (text ?? '').replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trim()}...`;
}

function confidenceFor(row: PassageRow | null) {
  if (!row) return 'needs_content' as const;
  if (row.approved || row.approval_status === 'approved') return 'ready' as const;
  return 'teacher_skim' as const;
}

function buildPlan(row: PassageRow | null, standardCode: string, minutes: number) {
  const demand = getPrimaryFastReadingDemand(standardCode);
  const title = demand?.teacherTitle ?? 'Grade 9 reading standard';
  const standardText = demand?.standardText ?? 'Official Florida B.E.S.T. standard';
  const fastDemand = demand?.fastDemand ?? 'Students use evidence from the text to explain meaning.';
  const studentMove = demand?.studentMove ?? 'Name the detail, prove it, and explain why it matters.';
  const skillFocus = row?.coverage_strand_label || row?.target_signal || title;
  const textLabel = [row?.source_title, row?.source_author].filter(Boolean).join(' - ');
  const excerpt = row ? plainText(row.paragraph_text, 900) : '';
  const shortClass = minutes <= 60;

  return {
    standard: {
      code: standardCode,
      title,
      standardText,
      fastDemand,
      studentMove,
      itemShape: demand?.itemShape ?? 'FAST-style evidence item',
    },
    recommendation: row
      ? {
          passage_id: row.id,
          text: textLabel || 'Official text excerpt',
          source_title: row.source_title,
          source_author: row.source_author,
          excerpt,
          word_count: row.word_count,
          coverage_strand_label: row.coverage_strand_label,
          target_signal: row.target_signal,
          approval_status: row.approval_status,
          confidence: confidenceFor(row),
          skill_focus: skillFocus,
          why_this_text: [
            'It is tied to the Florida Grade 9 text map for this standard.',
            row.coverage_strand_label
              ? `It gives you a concrete skill focus: ${row.coverage_strand_label}.`
              : 'It gives you an official-text excerpt to anchor the lesson.',
            row.word_count
              ? `The excerpt is ${row.word_count} words, which is manageable for a focused class rep.`
              : 'The excerpt is already clipped for classroom use.',
          ],
          tomorrow_flow: [
            {
              label: 'Open',
              minutes: shortClass ? 5 : 8,
              move: `Name the standard and the FAST strategy: ${studentMove}`,
            },
            {
              label: 'Model',
              minutes: shortClass ? 12 : 18,
              move: `Read the excerpt once, then model how one detail connects to ${skillFocus}.`,
            },
            {
              label: 'Guided Rep',
              minutes: shortClass ? 15 : 22,
              move: 'Students annotate one new detail and explain what it adds to meaning, style, mood, purpose, or theme.',
            },
            {
              label: 'Independent Rep',
              minutes: shortClass ? 15 : 25,
              move: 'Students answer a FAST-style evidence question or write the answer in complete sentences.',
            },
            {
              label: 'Exit Ticket',
              minutes: shortClass ? 8 : 12,
              move: `One quote, one skill word, one explanation: how does the detail develop ${skillFocus}?`,
            },
          ],
          cornell_notes: [
            {
              cue: `What does ${standardCode} ask me to do?`,
              notes: standardText,
            },
            {
              cue: 'What is the exact skill strategy?',
              notes: studentMove,
            },
            {
              cue: 'What evidence should I look for?',
              notes: `A key word, event, description, structure, image, or contrast connected to ${skillFocus}.`,
            },
            {
              cue: 'How do I prove my answer?',
              notes: 'Use a direct quote, explain the literal meaning, then explain the author effect.',
            },
          ],
          exit_ticket:
            'Choose one important detail from the excerpt. Explain what it literally says, what it suggests, and how it adds meaning or style to the text.',
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code') ?? 'ELA.9.R.1.1';
    const minutes = Math.max(45, Math.min(90, Number(url.searchParams.get('minutes') ?? 90)));

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());
    const { data, error } = await supabase
      .from('intervention_passages')
      .select(
        'id, source, standard_code, coverage_strand_label, paragraph_text, word_count, source_title, source_author, intervention_tier, target_signal, supporting_evidence, approval_status, approved, rejection_reason, created_at'
      )
      .eq('standard_code', standardCode)
      .in('source', ['gutenberg', 'manual_rights', 'official_text_library'])
      .or('rejection_reason.is.null,rejection_reason.not.ilike.Legacy pre-official%')
      .order('created_at', { ascending: false })
      .limit(120);

    if (error) throw new Error(error.message);

    const candidates = ((data ?? []) as PassageRow[])
      .filter((row) => row.paragraph_text && row.approval_status !== 'rejected')
      .map((row) => ({ row, score: scorePassage(row) }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0]?.row ?? null;
    const plan = buildPlan(best, standardCode, minutes);

    return NextResponse.json({
      ok: true,
      ...plan,
      alternatives: candidates.slice(1, 6).map(({ row, score }) => ({
        passage_id: row.id,
        score,
        text: [row.source_title, row.source_author].filter(Boolean).join(' - '),
        coverage_strand_label: row.coverage_strand_label,
        word_count: row.word_count,
        confidence: confidenceFor(row),
        excerpt: plainText(row.paragraph_text, 260),
      })),
      standards: FAST_GRADE9_READING_DEMANDS.map((demand) => ({
        code: demand.standardCode,
        title: demand.teacherTitle,
      })),
      empty_state: best
        ? null
        : 'No official-text excerpts are ready for this standard yet. Mine the standard from the Content Library first, then come back here.',
    });
  } catch (err) {
    console.error('[api/teacher/plan-tomorrow] error:', err);
    const message = err instanceof Error ? err.message : 'Could not build tomorrow plan.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
