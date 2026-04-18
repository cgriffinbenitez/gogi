import { createClient } from '@/lib/supabase/client';
import type { StandardStatus } from '@/lib/constants/design';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SkillGap {
  skill:           string;
  classification:  string;
  status:          'gap' | 'strong' | 'pending';
}

export interface StandardStatusResult {
  // Identity
  standardId:   string;
  status:       StandardStatus;
  currentStatus: string;     // raw standard_progress.current_status
  sessionId:    string | null;
  phase:        string | null;

  // Mastery track
  sessionsPassed:    number;
  sessionsAttempted: number;
  lastSessionAt:     string | null;

  // Diagnostic progress
  diagnosticQuestionsAnswered: number;
  diagnosticQuestionsTotal:    number;  // always 10

  // Intervention
  currentIntervention: string | null;   // e.g. 'vocabulary_frayer'

  // Engagement
  timeSpentMinutes: number;

  // Clinical intelligence
  skillGaps: SkillGap[];

  // Vocab readiness (Sprint L)
  vocabCheckComplete:  boolean;
  vocabCoverageScore:  number | null;

  // Sprint 3 — gap journey tracking
  gapsIdentified: string[];        // all gaps from diagnostic (2+ wrong each)
  gapsAddressed:  string[];        // gaps where student passed a practice session
  currentGap:     string | null;   // gap currently being targeted
}

// ─── Internal row types ───────────────────────────────────────────────────────

type ProgressRow = {
  standard_id:        string;
  current_status:     string;
  sessions_passed:    number;
  sessions_attempted: number;
  last_session_at:    string | null;
  gaps_identified:    string[] | null;
  gaps_addressed:     string[] | null;
  current_gap:        string | null;
};

type SessionRow = {
  id:                     string;
  standard_id:            string;
  phase:                  string;
  status:                 string;
  mastery_achieved:       boolean | null;
  time_spent_seconds:     number | null;
  started_at:             string | null;
  dominant_classification: string | null;
};

type ResponseRow = {
  standard_id:              string;
  session_id:               string;
  diagnostic_classification: string | null;
  mastery_achieved:          boolean | null;
};

// ─── Classification maps ──────────────────────────────────────────────────────

const CLASSIFICATION_LABELS: Record<string, string> = {
  schema_deficit:                    'Schema — background knowledge',
  vocabulary_gap:                    'Vocabulary — word meaning',
  inferencing_deficit:               'Inferencing — reading between lines',
  evidence_retrieval_failure:        'Finding text evidence',
  comprehension_integration_failure: 'Synthesizing meaning',
  morphology_gap:                    'Word structure',
  syntax_barrier:                    'Sentence structure',
  no_metacognitive_strategy:         'Reading strategy',
  CORRECT:                           'Comprehension',
};

const CLASSIFICATION_TO_INTERVENTION: Record<string, string> = {
  schema_deficit:                    'schema_building',
  no_metacognitive_strategy:         'strategy_card',
  vocabulary_gap:                    'vocabulary_frayer',
  morphology_gap:                    'morphology_breakdown',
  syntax_barrier:                    'vocabulary_frayer',
  inferencing_deficit:               'inferencing_scaffold',
  evidence_retrieval_failure:        'evidence_organizer',
  comprehension_integration_failure: 'synthesis_scaffold',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapProgressStatus(currentStatus: string | null): StandardStatus | null {
  switch (currentStatus) {
    case 'mastered':                        return 'mastered';
    case 'intervening':
    case 'practicing':
    case 'reinforcing':                     return 'inIntervention';
    default:                                return null;
  }
}

function buildSkillGaps(diagResponses: ResponseRow[]): SkillGap[] {
  const counts: Record<string, number> = {};
  let correctCount = 0;

  for (const r of diagResponses) {
    if (r.mastery_achieved === true) {
      correctCount++;
    } else if (r.diagnostic_classification) {
      const cls = r.diagnostic_classification;
      counts[cls] = (counts[cls] ?? 0) + 1;
    }
  }

  // Top 3 error classifications
  const gaps: SkillGap[] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cls, count]) => ({
      skill:          CLASSIFICATION_LABELS[cls] ?? cls,
      classification: cls,
      status:         count >= 3 ? 'gap' : 'pending',
    }));

  // Add strong row if student got several correct
  if (correctCount >= 3) {
    gaps.unshift({ skill: 'Comprehension', classification: 'CORRECT', status: 'strong' });
  }

  return gaps;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function getStudentStandardStatus(
  studentId:   string,
  standardIds: string[],
): Promise<Record<string, StandardStatusResult>> {
  const supabase = createClient();

  // Initialize defaults
  const results: Record<string, StandardStatusResult> = {};
  standardIds.forEach((id) => {
    results[id] = {
      standardId:                 id,
      status:                     'notStarted',
      currentStatus:              'not_started',
      sessionId:                  null,
      phase:                      null,
      sessionsPassed:             0,
      sessionsAttempted:          0,
      lastSessionAt:              null,
      diagnosticQuestionsAnswered: 0,
      diagnosticQuestionsTotal:    10,
      currentIntervention:         null,
      timeSpentMinutes:            0,
      skillGaps:                   [],
      vocabCheckComplete:          false,
      vocabCoverageScore:          null,
      gapsIdentified:              [],
      gapsAddressed:               [],
      currentGap:                  null,
    };
  });

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  const [progressResult, sessionsResult, responsesResult, vocabResult] = await Promise.all([
    supabase
      .from('standard_progress')
      .select('standard_id, current_status, sessions_passed, sessions_attempted, last_session_at, gaps_identified, gaps_addressed, current_gap')
      .eq('student_id', studentId)
      .in('standard_id', standardIds),

    supabase
      .from('sessions')
      .select('id, standard_id, phase, status, mastery_achieved, time_spent_seconds, started_at, dominant_classification')
      .eq('student_id', studentId)
      .in('standard_id', standardIds)
      .order('started_at', { ascending: false }),

    supabase
      .from('responses')
      .select('standard_id, session_id, diagnostic_classification, mastery_achieved')
      .eq('student_id', studentId)
      .in('standard_id', standardIds),

    // Vocab readiness — defensive: table may not exist yet
    Promise.resolve(
      supabase
        .from('vocab_readiness')
        .select('standard_id, coverage_score')
        .eq('student_id', studentId)
        .in('standard_id', standardIds)
    ).catch(() => ({ data: null, error: null })),
  ]);

  // ── Process vocab_readiness ─────────────────────────────────────────────────
  type VocabRow = { standard_id: string; coverage_score: number | null };
  const vocabByStd: Record<string, number | null> = {};
  ((vocabResult?.data ?? []) as unknown as VocabRow[]).forEach((row) => {
    vocabByStd[row.standard_id] = row.coverage_score ?? null;
  });

  // ── Process standard_progress ───────────────────────────────────────────────
  const progressByStd: Record<string, ProgressRow> = {};
  ((progressResult.data ?? []) as unknown as ProgressRow[]).forEach((row) => {
    progressByStd[row.standard_id] = row;
  });

  // ── Process sessions ────────────────────────────────────────────────────────
  const allSessions = (sessionsResult.data ?? []) as unknown as SessionRow[];

  const latestSessionPerStd:   Record<string, SessionRow>    = {};
  const diagSessionIdsByStd:   Record<string, Set<string>>   = {};
  const timeSumSecsByStd:      Record<string, number>        = {};
  const latestDiagClassByStd:  Record<string, string | null> = {};

  const seenLatest = new Set<string>();
  const seenDiag   = new Set<string>();

  for (const s of allSessions) {
    // Most recent session per standard (DESC order)
    if (!seenLatest.has(s.standard_id)) {
      seenLatest.add(s.standard_id);
      latestSessionPerStd[s.standard_id] = s;
    }

    // Sum time across all sessions for standard
    timeSumSecsByStd[s.standard_id] =
      (timeSumSecsByStd[s.standard_id] ?? 0) + (s.time_spent_seconds ?? 0);

    // Track diagnostic session IDs
    if (s.phase === 'diagnostic') {
      if (!diagSessionIdsByStd[s.standard_id]) {
        diagSessionIdsByStd[s.standard_id] = new Set();
      }
      diagSessionIdsByStd[s.standard_id].add(s.id);

      // Most recent diagnostic classification (first seen = most recent due to DESC sort)
      if (!seenDiag.has(s.standard_id)) {
        seenDiag.add(s.standard_id);
        latestDiagClassByStd[s.standard_id] = s.dominant_classification ?? null;
      }
    }
  }

  // ── Process responses ───────────────────────────────────────────────────────
  const allResponses = (responsesResult.data ?? []) as unknown as ResponseRow[];

  const diagRespsByStd: Record<string, ResponseRow[]> = {};
  for (const r of allResponses) {
    const diagSessions = diagSessionIdsByStd[r.standard_id];
    if (diagSessions?.has(r.session_id)) {
      if (!diagRespsByStd[r.standard_id]) diagRespsByStd[r.standard_id] = [];
      diagRespsByStd[r.standard_id].push(r);
    }
  }

  // ── Merge into results ──────────────────────────────────────────────────────
  standardIds.forEach((id) => {
    const progress       = progressByStd[id];
    const session        = latestSessionPerStd[id];
    const diagResps      = diagRespsByStd[id] ?? [];
    const timeMins       = Math.round((timeSumSecsByStd[id] ?? 0) / 60 * 10) / 10;
    const diagClass      = latestDiagClassByStd[id] ?? null;
    const intervention   = diagClass ? (CLASSIFICATION_TO_INTERVENTION[diagClass] ?? null) : null;
    const skillGaps      = buildSkillGaps(diagResps);
    const diagQsAnswered = diagResps.length;
    const vocabScore     = vocabByStd[id] ?? null;
    const vocabComplete  = vocabScore !== null;

    // Status from standard_progress (post-diagnostic)
    if (progress) {
      const mapped = mapProgressStatus(progress.current_status);
      if (mapped) {
        results[id] = {
          standardId:                  id,
          status:                      mapped,
          currentStatus:               progress.current_status,
          sessionId:                   session?.id ?? null,
          phase:                       session?.phase ?? null,
          sessionsPassed:              progress.sessions_passed    ?? 0,
          sessionsAttempted:           progress.sessions_attempted ?? 0,
          lastSessionAt:               progress.last_session_at    ?? null,
          diagnosticQuestionsAnswered: diagQsAnswered,
          diagnosticQuestionsTotal:    10,
          currentIntervention:         intervention,
          timeSpentMinutes:            timeMins,
          skillGaps,
          vocabCheckComplete:          vocabComplete,
          vocabCoverageScore:          vocabScore,
          gapsIdentified:              progress.gaps_identified ?? [],
          gapsAddressed:               progress.gaps_addressed  ?? [],
          currentGap:                  progress.current_gap     ?? null,
        };
        return;
      }
    }

    // Status from sessions (diagnostic / not-started)
    if (session) {
      let status: StandardStatus = 'notStarted';
      if (session.mastery_achieved) {
        status = 'mastered';
      } else if (session.phase === 'diagnostic') {
        status = 'inDiagnostic';
      } else if (['teach', 'practice'].includes(session.phase)) {
        status = 'inIntervention';
      }

      results[id] = {
        standardId:                  id,
        status,
        currentStatus:               session.phase ?? 'not_started',
        sessionId:                   session.id,
        phase:                       session.phase,
        sessionsPassed:              0,
        sessionsAttempted:           0,
        lastSessionAt:               session.started_at ?? null,
        diagnosticQuestionsAnswered: diagQsAnswered,
        diagnosticQuestionsTotal:    10,
        currentIntervention:         intervention,
        timeSpentMinutes:            timeMins,
        skillGaps,
        vocabCheckComplete:          vocabComplete,
        vocabCoverageScore:          vocabScore,
        gapsIdentified:              [],
        gapsAddressed:               [],
        currentGap:                  null,
      };
    }
  });

  return results;
}
