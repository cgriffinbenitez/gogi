import type { SupabaseClient } from '@supabase/supabase-js';
import type { FirstWinItem, FirstWinProtocol, FirstWinProtocolPayload } from './types';

const FALLBACK_STRENGTH_CLASSIFICATION = 'morphology_strength';

const BENCHMARK_STRENGTH_MAP: Array<{ pattern: RegExp; strength: string }> = [
  { pattern: /^ELA\.9\.V\.1\.[23]$/i, strength: 'morphology_strength' },
  { pattern: /^ELA\.9\.V\./i, strength: 'context_clue_strength' },
  { pattern: /^ELA\.9\.R\.2\./i, strength: 'evidence_retrieval_strength' },
  { pattern: /^ELA\.9\.R\.3\./i, strength: 'structural_reading_strength' },
  { pattern: /^ELA\.9\.R\.1\.1$/i, strength: 'figurative_strength' },
  { pattern: /^ELA\.9\.R\.1\.2$/i, strength: 'theme_strength' },
  { pattern: /^ELA\.9\.R\.1\.3$/i, strength: 'perspective_strength' },
];

type BenchmarkSummary = {
  benchmark_code?: string | null;
  pct_correct?: number | null;
  attempts?: number | null;
};

type ProfileRow = {
  id: string;
  top_strengths: BenchmarkSummary[] | null;
};

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isFirstWinAnswerCorrect(item: FirstWinItem, studentResponse: string) {
  return normalizeAnswer(item.correct_answer) === normalizeAnswer(studentResponse);
}

export function mapBenchmarkToStrengthClassification(benchmarkCode: string | null | undefined) {
  if (!benchmarkCode) return FALLBACK_STRENGTH_CLASSIFICATION;
  return (
    BENCHMARK_STRENGTH_MAP.find((row) => row.pattern.test(benchmarkCode))?.strength ??
    FALLBACK_STRENGTH_CLASSIFICATION
  );
}

export function selectTopStrength(profile: ProfileRow | null) {
  const top = [...(profile?.top_strengths ?? [])]
    .filter((row) => row.benchmark_code)
    .sort((a, b) => {
      if ((b.pct_correct ?? 0) !== (a.pct_correct ?? 0)) {
        return (b.pct_correct ?? 0) - (a.pct_correct ?? 0);
      }
      return (b.attempts ?? 0) - (a.attempts ?? 0);
    })[0];

  return {
    benchmarkCode: top?.benchmark_code ?? null,
    strengthClassification: mapBenchmarkToStrengthClassification(top?.benchmark_code),
  };
}

function hasProtocolContent(protocol: FirstWinProtocol | null) {
  return Boolean(protocol?.phase_a_content?.length && protocol.phase_b_content?.length);
}

export async function loadFirstWinProtocolForStudent(
  supabase: Pick<SupabaseClient, 'from'>,
  studentId: string
): Promise<FirstWinProtocolPayload> {
  const { data: profile, error: profileError } = await supabase
    .from('student_cognitive_profiles')
    .select('id, top_strengths')
    .eq('student_id', studentId)
    .eq('active', true)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const selected = selectTopStrength((profile ?? null) as ProfileRow | null);
  const { data: protocol, error: protocolError } = await supabase
    .from('first_win_protocols')
    .select('*')
    .eq('strength_classification_code', selected.strengthClassification)
    .maybeSingle();

  if (protocolError) throw new Error(protocolError.message);

  if (hasProtocolContent((protocol ?? null) as FirstWinProtocol | null)) {
    return {
      protocol: protocol as FirstWinProtocol,
      selectedStrengthClassification: selected.strengthClassification,
      selectedBenchmarkCode: selected.benchmarkCode,
      fallbackUsed: false,
    };
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('first_win_protocols')
    .select('*')
    .eq('strength_classification_code', FALLBACK_STRENGTH_CLASSIFICATION)
    .single();

  if (fallbackError) throw new Error(fallbackError.message);

  return {
    protocol: fallback as FirstWinProtocol,
    selectedStrengthClassification: selected.strengthClassification,
    selectedBenchmarkCode: selected.benchmarkCode,
    fallbackUsed: true,
  };
}

export function getFirstWinItem(protocol: FirstWinProtocol, phase: 'A' | 'B', itemIndex: number) {
  const items = phase === 'A' ? protocol.phase_a_content : protocol.phase_b_content;
  return items[itemIndex] ?? null;
}
