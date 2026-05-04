'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileText,
  Repeat2,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { standardCodeToRouteId } from '@/lib/fast/routing';
import { buildFastGrowthGoal, type FastGrowthGoal } from '@/lib/fast/growth';
import { buildFastTrajectorySummary } from '@/lib/fast/trajectory';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import {
  buildDailyReadingWinAssignment,
  parseDailyResponseEvidence,
  type DailyResponseEvidence,
  type DailyStandardStatus,
} from '@/lib/reading-wins/dailyQueue';
import { getPrimaryFastReadingDemand } from '@/lib/reading-wins/fastSkillMap';

type Student = {
  id: string;
  full_name: string;
  grade_level: number | null;
};

type FastCategory = {
  category_code: string;
  category_name: string;
  achievement_level: string;
};

type FastItem = {
  question_number: number;
  benchmark_code: string;
  reporting_category: string | null;
  benchmark_description: string | null;
  points_earned: number;
  points_possible: number;
  is_correct: boolean;
};

type FastAssessment = {
  id: string;
  test_reason: string;
  assessment_grade: number | null;
  test_year: number;
  date_taken: string | null;
  scale_score: number | null;
  achievement_level: number | null;
  percentile_rank: number | null;
  parsed_at: string | null;
  raw_pdf_path: string | null;
  fast_category_performance: FastCategory[];
  fast_item_responses: FastItem[];
};

type FastProfile = {
  confidence_label: string | null;
  generated_at: string;
  current_achievement_level: number | null;
  next_rung_target: number | null;
  points_to_next_rung: number | null;
  interpretation: {
    summary?: string;
    first_instructional_move?: string;
    confidence_rationale?: string;
    recommended_next_step?: {
      label: string;
      reason: string;
      standard_code?: string;
    };
    growth_goal?: FastGrowthGoal | null;
    top_barriers?: Array<{
      code: string;
      label: string;
      band: string;
      strength: number;
      action: string;
    }>;
    benchmark_evidence?: Array<{
      benchmark_code: string;
      pct_correct: number;
      attempts: number;
      evidence_label: string;
    }>;
  } | null;
  top_weaknesses?: Array<{
    benchmark_code: string;
    pct_correct: number;
    attempts: number;
  }> | null;
};

type StandardProgressRow = {
  standard_id: string;
  current_status: string | null;
  sessions_passed: number | null;
  sessions_attempted: number | null;
  current_gap: string | null;
  last_session_at: string | null;
  standards: { code: string; title: string } | { code: string; title: string }[] | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function confidenceLabel(value: string | null | undefined) {
  return (value ?? 'not_enough_data').replace(/_/g, ' ');
}

function normalizeProgressStatus(value: string | null | undefined): DailyStandardStatus['status'] {
  const status = (value ?? '').toLowerCase();
  if (status === 'mastered') return 'mastered';
  if (status.includes('diagnostic')) return 'inDiagnostic';
  if (status.includes('intervention') || status.includes('practice')) return 'inIntervention';
  return 'notStarted';
}

function buildStandardStatusMap(rows: StandardProgressRow[]) {
  return rows.reduce<Record<string, DailyStandardStatus | undefined>>((map, row) => {
    const standard = Array.isArray(row.standards) ? row.standards[0] : row.standards;
    if (!standard?.code) return map;
    map[standard.code] = {
      status: normalizeProgressStatus(row.current_status),
      sessionsAttempted: row.sessions_attempted ?? 0,
      sessionsPassed: row.sessions_passed ?? 0,
      currentGap: row.current_gap,
    };
    return map;
  }, {});
}

function trackerDecisionCopy(kind: string, signal?: string) {
  if (kind === 'needs_fast_profile') return 'Upload FAST evidence first';
  if (kind === 'needs_layer0') return 'Calibrate support before remediation';
  if (signal === 'repeat_for_transfer') return 'Repeat the same skill with better support';
  if (signal === 'increase_difficulty') return 'Raise difficulty or move to the next gap';
  if (signal === 'continue_gap') return 'Continue the current gap';
  return 'Start the highest-priority gap';
}

export default function StudentFastEvidencePage() {
  const router = useRouter();
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const [student, setStudent] = useState<Student | null>(null);
  const [assessments, setAssessments] = useState<FastAssessment[]>([]);
  const [profile, setProfile] = useState<FastProfile | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [layer0Complete, setLayer0Complete] = useState(false);
  const [standardStatuses, setStandardStatuses] = useState<
    Record<string, DailyStandardStatus | undefined>
  >({});
  const [recentReadingWinEvidence, setRecentReadingWinEvidence] = useState<DailyResponseEvidence[]>(
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const [studentRes, assessmentRes, profileRes, layer0Res, progressRes, responseRes] =
      await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, grade_level')
          .eq('id', studentId)
          .eq('teacher_id', user.id)
          .single(),
        supabase
          .from('fast_assessments')
          .select(
            `
          id,
          test_reason,
          assessment_grade,
          test_year,
          date_taken,
          scale_score,
          achievement_level,
          percentile_rank,
          parsed_at,
          raw_pdf_path,
          fast_category_performance(category_code, category_name, achievement_level),
          fast_item_responses(question_number, benchmark_code, reporting_category, benchmark_description, points_earned, points_possible, is_correct)
        `
          )
          .eq('student_id', studentId)
          .order('test_year', { ascending: false })
          .order('test_reason', { ascending: false }),
        supabase
          .from('student_cognitive_profiles')
          .select(
            'confidence_label, generated_at, current_achievement_level, next_rung_target, points_to_next_rung, interpretation, top_weaknesses'
          )
          .eq('student_id', studentId)
          .eq('active', true)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('layer0_assessments')
          .select('id')
          .eq('student_id', studentId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('standard_progress')
          .select(
            'standard_id, current_status, sessions_passed, sessions_attempted, current_gap, last_session_at, standards(code, title)'
          )
          .eq('student_id', studentId),
        supabase
          .from('responses')
          .select('student_response, mastery_achieved, created_at')
          .eq('student_id', studentId)
          .eq('intervention_type', 'fast_reading_win_v1')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

    if (studentRes.error || !studentRes.data) {
      setError('Student not found or you do not have access.');
      setLoading(false);
      return;
    }

    if (assessmentRes.error) {
      setError(assessmentRes.error.message);
      setLoading(false);
      return;
    }

    if (profileRes.error) {
      setError(profileRes.error.message);
      setLoading(false);
      return;
    }

    if (layer0Res.error && layer0Res.error.code !== 'PGRST116') {
      setError(layer0Res.error.message);
      setLoading(false);
      return;
    }

    if (progressRes.error) {
      setError(progressRes.error.message);
      setLoading(false);
      return;
    }

    if (responseRes.error) {
      setError(responseRes.error.message);
      setLoading(false);
      return;
    }

    const loadedAssessments = (assessmentRes.data ?? []) as FastAssessment[];
    setStudent(studentRes.data as Student);
    setAssessments(loadedAssessments);
    setProfile((profileRes.data ?? null) as FastProfile | null);
    setSelectedAssessmentId(loadedAssessments[0]?.id ?? null);
    setLayer0Complete(Boolean(layer0Res.data?.id));
    setStandardStatuses(buildStandardStatusMap((progressRes.data ?? []) as StandardProgressRow[]));
    setRecentReadingWinEvidence(
      (responseRes.data ?? []).map((row) => parseDailyResponseEvidence(row))
    );
    setLoading(false);
  }, [router, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedAssessment = useMemo(() => {
    return (
      assessments.find((assessment) => assessment.id === selectedAssessmentId) ??
      assessments[0] ??
      null
    );
  }, [assessments, selectedAssessmentId]);

  const itemSummary = useMemo(() => {
    const items = selectedAssessment?.fast_item_responses ?? [];
    const missed = items.filter((item) => !item.is_correct);
    return {
      total: items.length,
      missed: missed.length,
      correct: items.length - missed.length,
      missedItems: missed.sort((a, b) => a.question_number - b.question_number),
    };
  }, [selectedAssessment]);

  const recommendedStandardCode =
    profile?.interpretation?.recommended_next_step?.standard_code ?? 'ELA.9.R.1.1';
  const latestAssessment = assessments[0] ?? null;
  const trajectorySummary = buildFastTrajectorySummary(assessments);
  const availableStandardCodes = useMemo(() => {
    const codes = new Set<string>();
    assessments.forEach((assessment) => {
      assessment.fast_item_responses.forEach((item) => {
        if (item.benchmark_code) codes.add(item.benchmark_code);
      });
    });
    profile?.interpretation?.benchmark_evidence?.forEach((benchmark) => {
      if (benchmark.benchmark_code) codes.add(benchmark.benchmark_code);
    });
    profile?.top_weaknesses?.forEach((benchmark) => {
      if (benchmark.benchmark_code) codes.add(benchmark.benchmark_code);
    });
    Object.keys(standardStatuses).forEach((code) => codes.add(code));
    codes.add(recommendedStandardCode);
    codes.add('ELA.9.R.1.1');
    codes.add('ELA.9.R.3.1');
    return [...codes];
  }, [assessments, profile, recommendedStandardCode, standardStatuses]);
  const dailyAssignment = useMemo(
    () =>
      buildDailyReadingWinAssignment({
        fastProfile: profile,
        layer0Complete,
        standardStatuses,
        availableStandardCodes,
        recentResponses: recentReadingWinEvidence,
      }),
    [availableStandardCodes, layer0Complete, profile, recentReadingWinEvidence, standardStatuses]
  );
  const dailyStandardStatus = dailyAssignment.standardCode
    ? standardStatuses[dailyAssignment.standardCode]
    : null;
  const latestDailyEvidence =
    (dailyAssignment.standardCode
      ? recentReadingWinEvidence.find(
          (evidence) => evidence.standardCode === dailyAssignment.standardCode
        )
      : null) ??
    recentReadingWinEvidence[0] ??
    null;
  const dailyDemand =
    dailyAssignment.kind === 'reading_win'
      ? dailyAssignment.demand
      : getPrimaryFastReadingDemand(recommendedStandardCode);
  const growthGoal =
    profile?.interpretation?.growth_goal ??
    buildFastGrowthGoal({
      scaleScore: latestAssessment?.scale_score,
      achievementLevel: latestAssessment?.achievement_level ?? profile?.current_achievement_level,
      nextRungTarget: profile?.next_rung_target,
      pointsToNextRung: profile?.points_to_next_rung,
    });

  async function assignRecommendedDiagnostic() {
    if (!student) return;

    setAssigning(true);
    setAssignmentMessage(null);
    setError(null);

    const response = await fetch('/api/fast/assign-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: student.id,
        standard_code: recommendedStandardCode,
        reason: profile?.interpretation?.recommended_next_step?.reason ?? null,
      }),
    });

    const body = (await response.json()) as { error?: string };
    setAssigning(false);

    if (!response.ok) {
      setError(body.error ?? 'Could not assign diagnostic.');
      return;
    }

    setAssignmentMessage(
      `${recommendedStandardCode} diagnostic is now assigned. The student will see it on their dashboard after prerequisite checks.`
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0F172A] text-white">
        <TeacherDashboardTopBar active="roster" />
        <div className="px-6 py-8">
          <p>Loading FAST evidence...</p>
        </div>
      </main>
    );
  }

  if (error || !student) {
    return (
      <main className="min-h-screen bg-[#0F172A] text-white">
        <TeacherDashboardTopBar active="roster" />
        <div className="px-6 py-8">
          <button
            type="button"
            onClick={() => router.push('/dashboard/teacher')}
            className="mb-6 inline-flex items-center gap-2 text-sm text-[#BFDBFE]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
            {error ?? 'Could not load FAST evidence.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <TeacherDashboardTopBar active="roster" />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <button
          type="button"
          onClick={() => router.push(`/teacher-dashboard/students/${student.id}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#BFDBFE]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Student Profile
        </button>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              FAST Evidence
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{student.full_name}</h1>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Grade {student.grade_level ?? '—'} · ISR upload history and GOGI cold-start profile
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/teacher-dashboard/fast-upload')}
            className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
          >
            Upload another FAST report
          </button>
        </div>

        {assessments.length === 0 ? (
          <section className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-8 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
            <p className="font-semibold">No FAST reports uploaded yet</p>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Upload an ISR PDF to generate the cold-start profile.
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#93C5FD]" />
                  <h2 className="text-lg font-semibold">GOGI Interpretation</h2>
                </div>
                {profile ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#60A5FA]/30 bg-[#1D4ED8]/10 p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{profile.interpretation?.summary}</p>
                        <span className="rounded-full bg-[#DBEAFE] px-2 py-1 text-xs font-semibold capitalize text-[#1D4ED8]">
                          {confidenceLabel(profile.confidence_label)}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-[#BFDBFE]">
                        {profile.interpretation?.first_instructional_move}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[#93C5FD]">
                        {profile.interpretation?.confidence_rationale}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-wide text-[#94A3B8]">
                          Current rung
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          Level {profile.current_achievement_level ?? '—'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-wide text-[#94A3B8]">Next rung</p>
                        <p className="mt-1 text-lg font-semibold">
                          {growthGoal?.next_rung_label ?? profile.next_rung_target ?? '—'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-wide text-[#94A3B8]">
                          Points needed
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {profile.points_to_next_rung ?? '—'}
                        </p>
                      </div>
                    </div>

                    {growthGoal ? (
                      <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                          Growth goal
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <div>
                            <p className="text-xs text-emerald-100/70">Short term</p>
                            <p className="mt-1 font-semibold text-white">
                              {growthGoal.short_term_goal}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-100/70">Realistic year-end</p>
                            <p className="mt-1 font-semibold text-white">
                              {growthGoal.realistic_year_end_label}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-100/70">Stretch</p>
                            <p className="mt-1 font-semibold text-white">
                              {growthGoal.stretch_goal_label}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-emerald-100/75">
                          {growthGoal.rationale}
                        </p>
                      </div>
                    ) : null}

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                        Likely starting needs
                      </p>
                      <div className="space-y-3">
                        {(profile.interpretation?.top_barriers ?? []).map((barrier) => (
                          <div key={barrier.label}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                              <span>{barrier.label}</span>
                              <span className="text-[#BFDBFE]">{barrier.band}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                              <div
                                className="h-full rounded-full bg-[#60A5FA]"
                                style={{ width: `${barrier.strength}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {profile.interpretation?.recommended_next_step ? (
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                          Recommended next step
                        </p>
                        <p className="mt-1 font-semibold">
                          {profile.interpretation.recommended_next_step.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                          {profile.interpretation.recommended_next_step.reason}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={assignRecommendedDiagnostic}
                            disabled={assigning}
                            className="rounded-md bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:bg-[#64748B]"
                          >
                            {assigning
                              ? 'Assigning...'
                              : `Assign ${recommendedStandardCode} diagnostic`}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/standard/${standardCodeToRouteId(recommendedStandardCode)}/diagnostic`
                              )
                            }
                            className="rounded-md border border-[#60A5FA]/50 px-3 py-2 text-xs font-semibold text-[#BFDBFE]"
                          >
                            Preview diagnostic route
                          </button>
                        </div>
                        {assignmentMessage ? (
                          <p className="mt-2 text-xs leading-5 text-emerald-300">
                            {assignmentMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-[#94A3B8]">
                    No active FAST profile has been generated.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#93C5FD]" />
                  <h2 className="text-lg font-semibold">PM History</h2>
                </div>
                <div className="mb-4 rounded-lg border border-[#60A5FA]/20 bg-[#1D4ED8]/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#93C5FD]">
                    Trajectory
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#DBEAFE]">
                    {trajectorySummary.narrative}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[#94A3B8]">First</p>
                      <p className="mt-1 font-semibold text-white">
                        {trajectorySummary.first_score ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8]">Latest</p>
                      <p className="mt-1 font-semibold text-white">
                        {trajectorySummary.latest_score ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8]">Growth</p>
                      <p className="mt-1 font-semibold text-white">
                        {trajectorySummary.total_growth === null
                          ? '—'
                          : `${trajectorySummary.total_growth > 0 ? '+' : ''}${trajectorySummary.total_growth}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {trajectorySummary.points
                    .slice()
                    .reverse()
                    .map((assessment) => (
                      <button
                        key={assessment.id}
                        type="button"
                        onClick={() => setSelectedAssessmentId(assessment.id)}
                        className={`w-full rounded-lg border p-3 text-left ${
                          selectedAssessment?.id === assessment.id
                            ? 'border-[#60A5FA] bg-[#1D4ED8]/15'
                            : 'border-white/[0.08] bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">
                            {assessment.test_reason} {assessment.test_year}
                          </span>
                          <span className="text-sm text-[#BFDBFE]">
                            Scale {assessment.scale_score ?? '—'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[#94A3B8]">
                          Level {assessment.achievement_level ?? '—'} ·{' '}
                          {formatDate(assessment.date_taken)} ·{' '}
                          {assessments.find((row) => row.id === assessment.id)?.fast_item_responses
                            ?.length ?? 0}{' '}
                          items
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[#BFDBFE]">
                            {assessment.growth_from_previous === null
                              ? 'Baseline'
                              : `${assessment.growth_from_previous > 0 ? '+' : ''}${assessment.growth_from_previous} from previous`}
                          </span>
                          {assessment.crossed_rung_from_previous ? (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-200">
                              Rung moved
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-200" />
                    <h2 className="text-lg font-semibold">Daily Remediation Tracker</h2>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-emerald-50/75">
                    This is the teacher trust layer: what the student should work on next, why GOGI
                    chose it, and how the next session decision gets made.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold capitalize text-emerald-800">
                  {trackerDecisionCopy(
                    dailyAssignment.kind,
                    dailyAssignment.kind === 'reading_win'
                      ? dailyAssignment.recentSignal
                      : undefined
                  )}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-lg border border-white/[0.08] bg-[#0F172A]/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                        Assigned next
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">{dailyAssignment.teacherTitle}</h3>
                      <p className="mt-1 text-sm text-[#BFDBFE]">
                        Student sees: {dailyAssignment.studentTitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(dailyAssignment.route)}
                      className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-[#052E16]"
                    >
                      Preview student path
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-white/[0.05] p-3">
                      <p className="text-xs uppercase tracking-wide text-[#94A3B8]">Standard</p>
                      <p className="mt-1 font-semibold">
                        {dailyAssignment.standardCode ?? 'Layer 0'}
                      </p>
                      {dailyDemand ? (
                        <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
                          {dailyDemand.teacherTitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-lg bg-white/[0.05] p-3">
                      <p className="text-xs uppercase tracking-wide text-[#94A3B8]">Sessions</p>
                      <p className="mt-1 font-semibold">
                        {dailyStandardStatus?.sessionsPassed ?? 0}/
                        {dailyStandardStatus?.sessionsAttempted ?? 0} passed
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        {dailyStandardStatus?.status
                          ? dailyStandardStatus.status.replace(/([A-Z])/g, ' $1').trim()
                          : 'Not started'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.05] p-3">
                      <p className="text-xs uppercase tracking-wide text-[#94A3B8]">
                        Last transfer
                      </p>
                      <p className="mt-1 font-semibold">
                        {latestDailyEvidence?.transferCorrect === true
                          ? 'Passed'
                          : latestDailyEvidence?.transferCorrect === false
                            ? 'Needs another rep'
                            : 'No attempt yet'}
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        {formatDate(latestDailyEvidence?.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      Why this work
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#DBEAFE]">{dailyAssignment.why}</p>
                    <p className="mt-2 text-xs capitalize text-[#93C5FD]">
                      Signal confidence: {confidenceLabel(dailyAssignment.confidence)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0F172A]/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Repeat2 className="h-4 w-4 text-emerald-200" />
                    <h3 className="font-semibold">Session Loop</h3>
                  </div>
                  <div className="space-y-2">
                    {dailyAssignment.sessionPlan.map((step, index) => (
                      <div
                        key={step}
                        className="flex gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm leading-6 text-[#DBEAFE]"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-xs font-semibold text-[#052E16]">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      Tomorrow's rule
                    </p>
                    <p className="mt-2 text-sm leading-6 text-emerald-50/80">
                      {dailyAssignment.nextDecisionRule}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {selectedAssessment ? (
              <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-5">
                  <h2 className="mb-4 text-lg font-semibold">Category Performance</h2>
                  <div className="space-y-3">
                    {selectedAssessment.fast_category_performance.map((category) => (
                      <div key={category.category_code} className="rounded-lg bg-white/[0.04] p-3">
                        <p className="text-sm font-semibold">{category.category_name}</p>
                        <p className="mt-1 text-xs text-[#94A3B8]">
                          {category.category_code} · {category.achievement_level}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Item Evidence</h2>
                    <div className="text-sm text-[#94A3B8]">
                      {itemSummary.correct}/{itemSummary.total} correct · {itemSummary.missed}{' '}
                      missed
                    </div>
                  </div>

                  <div className="max-h-[520px] overflow-auto rounded-lg border border-white/[0.08]">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-[#111827] text-left text-xs uppercase tracking-wide text-[#94A3B8]">
                        <tr>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Benchmark</th>
                          <th className="px-3 py-2">Result</th>
                          <th className="px-3 py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selectedAssessment.fast_item_responses]
                          .sort((a, b) => a.question_number - b.question_number)
                          .map((item) => (
                            <tr key={item.question_number} className="border-t border-white/[0.06]">
                              <td className="px-3 py-2 font-mono">{item.question_number}</td>
                              <td className="px-3 py-2">{item.benchmark_code}</td>
                              <td className="px-3 py-2">
                                {item.is_correct ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-300">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Correct
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-300">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Missed
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-[#94A3B8]">
                                {item.benchmark_description ?? item.reporting_category ?? '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
