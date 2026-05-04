'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GogiNav } from '@/components/nav/GogiNav';
import { StandardTile } from '@/components/dashboard/StandardTile';
import { StreakCounter } from '@/components/dashboard/StreakCounter';
import {
  getStudentStandardStatus,
  type StandardStatusResult,
} from '@/lib/data/getStudentStandardStatus';
import { calculateStreak } from '@/lib/data/calculateStreak';
import { getActiveStandard } from '@/lib/data/getActiveStandard';
import { C, FONTS } from '@/lib/constants/design';
import { createClient } from '@/lib/supabase/client';
import { ELA9R11_SEED_ITEMS } from '@/lib/diagnostic/ela9r11';
import { standardCodeToRouteId } from '@/lib/fast/routing';
import { buildFastGrowthGoal, type FastGrowthGoal } from '@/lib/fast/growth';
import { getStudentFirstName, normalizeStudentDisplayName } from '@/lib/students/displayName';
import { NOAH_READING_WIN_PLAN, getNoahPrimaryReadingWin } from '@/lib/reading-wins/noahPlan';
import {
  FAST_GRADE9_READING_DEMANDS,
  getPrimaryFastReadingDemand,
} from '@/lib/reading-wins/fastSkillMap';
import {
  buildDailyReadingWinAssignment,
  parseDailyResponseEvidence,
  type DailyResponseEvidence,
} from '@/lib/reading-wins/dailyQueue';
import {
  analyzeReadingWinCoverage,
  type PromotedReadingWinQuestion,
} from '@/lib/reading-wins/sessionBuilder';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Standard {
  id: string;
  code: string;
  title: string;
}

interface Props {
  studentId: string;
  studentName: string;
  standards: Standard[];
}

interface DashboardData {
  streak: number;
  richData: Record<string, StandardStatusResult>; // keyed by standard code
  activeCode: string;
  activePhase: string;
}

interface FastProfileSummary {
  confidence_label: string | null;
  current_achievement_level: number | null;
  points_to_next_rung: number | null;
  next_rung_target: number | null;
  trajectory_data?: {
    assessments?: Array<{
      assessment_grade?: number | null;
      scale_score?: number | null;
      achievement_level?: number | null;
    }>;
  } | null;
  interpretation: {
    summary?: string;
    first_instructional_move?: string;
    growth_goal?: FastGrowthGoal | null;
    recommended_next_step?: {
      standard_code?: string;
      label?: string;
      reason?: string;
    };
    benchmark_evidence?: Array<{
      benchmark_code: string;
      pct_correct: number;
      attempts: number;
      evidence_label: string;
    }>;
    top_barriers?: Array<{
      code: string;
      label: string;
      strength: number;
      band: string;
      action: string;
    }>;
  } | null;
  top_weaknesses?: Array<{
    benchmark_code: string;
    pct_correct: number;
    attempts: number;
  }> | null;
}

type QuestionBankRow = PromotedReadingWinQuestion & {
  source_classification: string | null;
};

type JourneyStepState = 'done' | 'current' | 'locked';

type JourneyStep = {
  label: string;
  detail: string;
  state: JourneyStepState;
};

function diagnosticTotalForCode(code: string) {
  return code === 'ELA.9.R.1.1' ? ELA9R11_SEED_ITEMS.length : 10;
}

function routeForStudentWin(args: {
  standardCode: string;
  result: StandardStatusResult | undefined;
  hasFastProfile: boolean;
}) {
  const { standardCode, result, hasFastProfile } = args;
  const routeId = standardCodeToRouteId(standardCode);
  if (hasFastProfile) return `/standard/${routeId}/intervention`;
  if (!result || result.status === 'notStarted' || result.status === 'inDiagnostic') {
    return `/standard/${routeId}/diagnostic`;
  }
  if (result.status === 'mastered') return '/dashboard/student';
  if (result.phase === 'practice') return `/standard/${routeId}/practice`;
  return `/standard/${routeId}/bridge`;
}

function ctaForStudentWin(result: StandardStatusResult | undefined) {
  if (!result || result.status === 'notStarted') return 'Start my gap win →';
  if (result.status === 'inDiagnostic') return 'Continue my gap check →';
  if (result.status === 'inIntervention') return 'Continue my reading win →';
  return 'View my progress →';
}

function buildJourneySteps(args: {
  hasFastProfile: boolean;
  layer0Complete: boolean;
  recommendedResult: StandardStatusResult | undefined;
  nextWinLabel: string;
}): JourneyStep[] {
  const diagnosticComplete =
    args.layer0Complete &&
    (args.recommendedResult?.status === 'inIntervention' ||
      args.recommendedResult?.status === 'mastered');
  const practiceStarted =
    args.layer0Complete && (args.recommendedResult?.sessionsAttempted ?? 0) > 0;
  const mastered = args.layer0Complete && args.recommendedResult?.status === 'mastered';

  return [
    {
      label: 'Starting evidence',
      detail: args.hasFastProfile ? 'FAST profile loaded' : 'Waiting on FAST profile',
      state: args.hasFastProfile ? 'done' : 'current',
    },
    {
      label: 'Support calibration',
      detail: args.layer0Complete ? 'Layer 0 complete' : 'Calibrate hints, chunks, and pacing',
      state: args.layer0Complete ? 'done' : args.hasFastProfile ? 'current' : 'locked',
    },
    {
      label: 'Gap win',
      detail: diagnosticComplete
        ? `${args.nextWinLabel} gap found`
        : args.layer0Complete
          ? `Check ${args.nextWinLabel}`
          : 'Unlocks after support calibration',
      state: diagnosticComplete ? 'done' : args.layer0Complete ? 'current' : 'locked',
    },
    {
      label: 'Practice proof',
      detail: practiceStarted ? 'Practice evidence logged' : 'Teach one move, then prove it',
      state: practiceStarted ? 'done' : diagnosticComplete ? 'current' : 'locked',
    },
    {
      label: 'Close the gap',
      detail: mastered ? 'Gap closed' : 'Recheck and keep building',
      state: mastered ? 'done' : practiceStarted ? 'current' : 'locked',
    },
  ];
}

function Metric({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string | number;
  align?: 'left' | 'right';
}) {
  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          fontSize: 10,
          color: C.gray,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, color: C.navy, fontWeight: 950, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.blueMid}`,
        borderRadius: 8,
        padding: '9px 10px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.gray,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: C.navy, fontWeight: 900, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentDashboardContent({ studentId, studentName, standards }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [layer0Complete, setLayer0Complete] = useState<boolean>(false);
  const [layer0ExitComplete, setLayer0ExitComplete] = useState<boolean>(false);
  const [profileComplete, setProfileComplete] = useState<boolean>(false);
  const [fastProfile, setFastProfile] = useState<FastProfileSummary | null>(null);
  const [readyReadingWinCodes, setReadyReadingWinCodes] = useState<string[]>([]);
  const [recentReadingWinEvidence, setRecentReadingWinEvidence] = useState<DailyResponseEvidence[]>(
    []
  );

  // First name + last initial
  const normalizedStudentName = normalizeStudentDisplayName(studentName);
  const nameParts = normalizedStudentName.trim().split(' ');
  const firstName = getStudentFirstName(studentName);
  const displayName =
    nameParts.length >= 2 ? `${firstName} ${nameParts[nameParts.length - 1][0]}.` : firstName;

  // ── Data load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!studentId || standards.length === 0) return;

    async function load() {
      try {
        const standardIds = standards.map((s) => s.id);

        const [streak, statusMap, activeStandard] = await Promise.all([
          calculateStreak(studentId),
          getStudentStandardStatus(studentId, standardIds),
          getActiveStandard(studentId),
        ]);

        // Resolve active standard UUID → code
        let activeCode = activeStandard?.standardId ?? 'ELA.9.R.1.1';
        const matchByUuid = standards.find((s) => s.id === activeCode);
        if (matchByUuid) activeCode = matchByUuid.code;

        // Flatten statusMap: keyed by standard code for easy lookup in render
        const richData: Record<string, StandardStatusResult> = {};
        standards.forEach((s) => {
          richData[s.code] = statusMap[s.id] ?? {
            standardId: s.id,
            status: 'notStarted' as const,
            currentStatus: 'not_started',
            sessionId: null,
            phase: null,
            sessionsPassed: 0,
            sessionsAttempted: 0,
            lastSessionAt: null,
            diagnosticQuestionsAnswered: 0,
            diagnosticQuestionsTotal: diagnosticTotalForCode(s.code),
            currentIntervention: null,
            timeSpentMinutes: 0,
            skillGaps: [],
            vocabCheckComplete: false,
            vocabCoverageScore: null,
            gapsIdentified: [],
            gapsAddressed: [],
            currentGap: null,
          };
        });

        // Layer 0 + Reading profile completion — defensive: tables/columns may not exist yet
        try {
          const supabase = createClient();
          const [
            { data: pData },
            { data: layer0Data },
            { data: layer0ExitData },
            { data: fastData },
            { data: responseData },
            { data: questionData },
          ] = await Promise.all([
            supabase
              .from('students')
              .select('reading_profile_complete')
              .eq('id', studentId)
              .maybeSingle(),
            supabase
              .from('layer0_assessments')
              .select('id')
              .eq('student_id', studentId)
              .eq('administration_number', 1)
              .eq('status', 'completed')
              .maybeSingle(),
            supabase
              .from('layer0_assessments')
              .select('id')
              .eq('student_id', studentId)
              .eq('administration_number', 2)
              .eq('status', 'completed')
              .maybeSingle(),
            supabase
              .from('student_cognitive_profiles')
              .select(
                'confidence_label, current_achievement_level, points_to_next_rung, next_rung_target, trajectory_data, interpretation, top_weaknesses'
              )
              .eq('student_id', studentId)
              .eq('active', true)
              .order('generated_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('responses')
              .select('student_response, mastery_achieved, created_at')
              .eq('student_id', studentId)
              .eq('intervention_type', 'fast_reading_win_v1')
              .order('created_at', { ascending: false })
              .limit(20),
            supabase
              .from('questions')
              .select(
                'id, content, cognitive_skill_targeted, source_classification, difficulty_level, title, option_a_text, option_b_text, option_c_text, option_d_text, correct_option, rationale, source, is_released_item'
              )
              .eq('approved', true)
              .eq('flagged', false)
              .order('created_at', { ascending: false })
              .limit(800),
          ]);
          setLayer0Complete(Boolean(layer0Data?.id));
          setLayer0ExitComplete(Boolean(layer0ExitData?.id));
          setProfileComplete(pData?.reading_profile_complete ?? false);
          setFastProfile((fastData ?? null) as FastProfileSummary | null);
          setRecentReadingWinEvidence(
            (
              (responseData ?? []) as Array<{
                student_response: string | null;
                mastery_achieved?: boolean | null;
                created_at?: string | null;
              }>
            ).map(parseDailyResponseEvidence)
          );
          const questionRows = (questionData ?? []) as QuestionBankRow[];
          const readyCodes = FAST_GRADE9_READING_DEMANDS.filter((demand) => {
            const matchingQuestions = questionRows.filter(
              (question) =>
                question.cognitive_skill_targeted === demand.standardCode ||
                question.source_classification === demand.standardCode
            );
            return analyzeReadingWinCoverage({
              demand,
              questions: matchingQuestions,
            }).ready;
          }).map((demand) => demand.standardCode);
          setReadyReadingWinCodes(readyCodes);
        } catch {
          // Table/column not yet migrated — default false so card shows
          setReadyReadingWinCodes([]);
        }

        setData({
          streak,
          richData,
          activeCode,
          activePhase: activeStandard?.phase ?? 'diagnostic',
        });
        // Auto-open most active standard
        setActiveCard(null);
      } catch (err) {
        console.error('[StudentDashboard] load error:', err);
        // Fail open
        const richData: Record<string, StandardStatusResult> = {};
        standards.forEach((s) => {
          richData[s.code] = {
            standardId: s.id,
            status: 'notStarted',
            currentStatus: 'not_started',
            sessionId: null,
            phase: null,
            sessionsPassed: 0,
            sessionsAttempted: 0,
            lastSessionAt: null,
            diagnosticQuestionsAnswered: 0,
            diagnosticQuestionsTotal: diagnosticTotalForCode(s.code),
            currentIntervention: null,
            timeSpentMinutes: 0,
            skillGaps: [],
            vocabCheckComplete: false,
            vocabCoverageScore: null,
            gapsIdentified: [],
            gapsAddressed: [],
            currentGap: null,
          };
        });
        setData({ streak: 0, richData, activeCode: 'ELA.9.R.1.1', activePhase: 'diagnostic' });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId, standards]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
        <GogiNav rightContent={`${displayName} | South Dade SHS`} showLogout />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 52px)',
          }}
        >
          <p style={{ color: C.gray, fontSize: 14 }}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const { streak, richData } = data;
  const hasFastProfile = Boolean(fastProfile);
  const setupProfileComplete = profileComplete || hasFastProfile;
  const rawFastRecommendedCode =
    fastProfile?.interpretation?.recommended_next_step?.standard_code ?? data.activeCode;
  const fastRecommendedCode = standards.some((standard) => standard.code === rawFastRecommendedCode)
    ? rawFastRecommendedCode
    : 'ELA.9.R.1.1';
  const latestFastAssessment = fastProfile?.trajectory_data?.assessments?.[0];
  const fastGrowthGoal =
    fastProfile?.interpretation?.growth_goal ??
    buildFastGrowthGoal({
      scaleScore: latestFastAssessment?.scale_score,
      achievementLevel:
        latestFastAssessment?.achievement_level ?? fastProfile?.current_achievement_level,
      nextRungTarget: fastProfile?.next_rung_target,
      pointsToNextRung: fastProfile?.points_to_next_rung,
    });
  const primaryBarrierCode = fastProfile?.interpretation?.top_barriers?.[0]?.code ?? null;
  const dailyAssignment = buildDailyReadingWinAssignment({
    fastProfile,
    layer0Complete,
    standardStatuses: richData,
    availableStandardCodes: readyReadingWinCodes,
    recentResponses: recentReadingWinEvidence,
  });
  const dailyRecommendedCode = dailyAssignment.standardCode ?? fastRecommendedCode;
  const primaryFastDemand = getPrimaryFastReadingDemand(dailyRecommendedCode);
  const noahPrimaryWin =
    primaryBarrierCode === 'figurative_language_failure' ? getNoahPrimaryReadingWin() : null;
  const nextWinStandardLabel =
    dailyAssignment.studentTitle ??
    noahPrimaryWin?.studentTitle ??
    primaryFastDemand?.studentTitle ??
    fastProfile?.interpretation?.recommended_next_step?.label ??
    (dailyRecommendedCode === 'ELA.9.R.1.1' ? 'literary meaning' : 'your first reading move');
  const fastSignalSummary =
    dailyAssignment.kind === 'reading_win' || dailyAssignment.kind === 'needs_content_library'
      ? dailyAssignment.why
      : noahPrimaryWin && fastProfile?.current_achievement_level
        ? `FAST Level ${fastProfile.current_achievement_level} evidence points first to ${noahPrimaryWin.teacherTitle.toLowerCase()} (${noahPrimaryWin.standardCode}).`
        : primaryFastDemand && fastProfile?.current_achievement_level
          ? `FAST Level ${fastProfile.current_achievement_level} evidence points first to ${primaryFastDemand.teacherTitle.toLowerCase()} (${primaryFastDemand.standardCode}).`
          : fastProfile?.interpretation?.summary;
  const recommendedResult = richData[dailyRecommendedCode];
  const fallbackStudentWinRoute = routeForStudentWin({
    standardCode: dailyRecommendedCode,
    result: recommendedResult,
    hasFastProfile,
  });
  const studentWinRoute = dailyAssignment.route ?? fallbackStudentWinRoute;
  const studentWinCta = dailyAssignment.cta ?? ctaForStudentWin(recommendedResult);
  const journeySteps = buildJourneySteps({
    hasFastProfile,
    layer0Complete,
    recommendedResult,
    nextWinLabel: nextWinStandardLabel,
  });
  const currentJourneyStep = journeySteps.find((step) => step.state === 'current');
  const latestFastScore = latestFastAssessment?.scale_score ?? null;
  const levelLabel =
    fastProfile?.current_achievement_level !== null &&
    fastProfile?.current_achievement_level !== undefined
      ? `Level ${fastProfile.current_achievement_level}`
      : 'FAST profile';
  const visibleStandards = standards;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONTS.ui }}>
      <GogiNav rightContent={`${displayName} | Day ${streak} Streak | South Dade SHS`} showLogout />

      <main style={{ maxWidth: 980, margin: '0 auto', padding: '20px' }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '22px 24px',
            marginBottom: 16,
            boxShadow: '0 10px 28px rgba(31, 78, 121, 0.08)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: hasFastProfile
                ? 'minmax(0, 1.5fr) minmax(280px, 0.85fr)'
                : '1fr',
              gap: 20,
              alignItems: 'stretch',
            }}
            className="hero-grid"
          >
            <div>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 900, marginBottom: 8 }}>
                GOGI Reading Lab
              </div>
              <h1 style={{ margin: 0, color: C.navy, fontSize: 34, lineHeight: 1.08 }}>
                Welcome, {firstName}.
              </h1>
              <div
                style={{
                  marginTop: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: hasFastProfile ? C.amberLight : C.blueLight,
                  border: `1px solid ${hasFastProfile ? C.amber : C.blueMid}`,
                  borderRadius: 999,
                  padding: '7px 12px',
                  color: hasFastProfile ? '#633806' : C.navy,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                Today: {currentJourneyStep?.label ?? 'Start GOGI'}
              </div>
              <p
                style={{
                  color: C.dark,
                  fontSize: 15,
                  lineHeight: 1.55,
                  margin: '14px 0 0',
                  maxWidth: 560,
                  fontWeight: 500,
                }}
              >
                {hasFastProfile
                  ? 'GOGI found your starting point. Now each session should move one real gap: check it, learn the move, prove it.'
                  : 'Start with your reading evidence so GOGI can choose the right next move.'}
              </p>
              {fastSignalSummary && (
                <div
                  style={{
                    marginTop: 14,
                    borderLeft: `4px solid ${C.blue}`,
                    padding: '8px 0 8px 12px',
                    color: C.navy,
                    fontSize: 13,
                    lineHeight: 1.45,
                    fontWeight: 700,
                    maxWidth: 560,
                  }}
                >
                  {fastSignalSummary}
                </div>
              )}
              {hasFastProfile && (
                <button
                  onClick={() => router.push(layer0Complete ? studentWinRoute : '/layer0')}
                  style={{
                    marginTop: 16,
                    background: layer0Complete ? C.green : C.amber,
                    color: C.white,
                    border: 'none',
                    borderRadius: 8,
                    padding: '11px 18px',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: FONTS.ui,
                    boxShadow: '0 8px 18px rgba(31, 78, 121, 0.14)',
                  }}
                >
                  {layer0Complete ? studentWinCta : 'Calibrate my support →'}
                </button>
              )}
            </div>

            {hasFastProfile && (
              <div
                style={{
                  border: `1px solid ${C.blueMid}`,
                  background: '#F4F9FE',
                  borderRadius: 10,
                  padding: 16,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <Metric label="FAST score" value={latestFastScore ?? '—'} />
                  <Metric label="Current level" value={levelLabel} align="right" />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <MiniMetric
                    label="Next goal"
                    value={fastGrowthGoal?.next_rung_label ?? 'Next rung'}
                  />
                  <MiniMetric
                    label="This year"
                    value={fastGrowthGoal?.realistic_year_end_range ?? 'Build growth'}
                  />
                </div>
                {fastProfile?.points_to_next_rung !== null &&
                  fastProfile?.points_to_next_rung !== undefined && (
                    <div
                      style={{
                        borderTop: `1px solid ${C.blueMid}`,
                        paddingTop: 10,
                        color: C.navy,
                        fontSize: 13,
                        lineHeight: 1.4,
                        fontWeight: 800,
                      }}
                    >
                      {fastProfile.points_to_next_rung} points to{' '}
                      {fastGrowthGoal?.next_rung_label ?? 'the next rung'}
                    </div>
                  )}
              </div>
            )}
          </div>
        </section>

        {hasFastProfile && (
          <section
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '18px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 14,
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.navy }}>
                  Today&apos;s GOGI path
                </div>
                <div style={{ fontSize: 13, color: C.gray, marginTop: 4, lineHeight: 1.45 }}>
                  Every day should move one real gap: check it, learn the move, prove it.
                </div>
              </div>
              {layer0Complete && (
                <button
                  onClick={() => router.push(studentWinRoute)}
                  style={{
                    background: C.navy,
                    color: C.white,
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: FONTS.ui,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {studentWinCta}
                </button>
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: 8,
              }}
              className="journey-grid"
            >
              {journeySteps.map((step, index) => {
                const isDone = step.state === 'done';
                const isCurrent = step.state === 'current';
                return (
                  <div
                    key={step.label}
                    style={{
                      border: `1px solid ${
                        isDone ? C.greenBorder : isCurrent ? C.blueMid : C.border
                      }`,
                      background: isDone ? C.greenLight : isCurrent ? C.blueLight : C.light,
                      borderRadius: 8,
                      padding: '12px',
                      minHeight: 102,
                      boxShadow: isCurrent ? '0 8px 18px rgba(46, 117, 182, 0.12)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: isDone ? C.green : isCurrent ? C.blue : C.gray,
                        color: C.white,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 900,
                        marginBottom: 7,
                      }}
                    >
                      {isDone ? '✓' : index + 1}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: C.navy }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 5, lineHeight: 1.35 }}>
                      {step.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {noahPrimaryWin && (
          <section
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '18px',
              marginBottom: 14,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.navy }}>
                Noah&apos;s first Reading Wins
              </div>
              <div style={{ fontSize: 13, color: C.gray, marginTop: 4, lineHeight: 1.45 }}>
                These are the first gaps GOGI should check and teach from the FAST signal.
              </div>
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}
              className="wins-grid"
            >
              {NOAH_READING_WIN_PLAN.map((win, index) => (
                <div
                  key={win.id}
                  style={{
                    border: `1px solid ${index === 0 ? C.blueMid : C.border}`,
                    background: index === 0 ? C.blueLight : C.light,
                    borderRadius: 8,
                    padding: '12px',
                    minHeight: 154,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      color: C.blue,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      marginBottom: 7,
                    }}
                  >
                    {win.standardCode}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: C.navy, lineHeight: 1.25 }}>
                    {win.studentTitle}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 7, lineHeight: 1.35 }}>
                    {win.studentMove}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section A2: Layer 0 card — hidden once complete */}
        {!layer0Complete && !hasFastProfile && (
          <div
            style={{
              background: '#FFF7E8',
              border: `1px solid ${C.amber}`,
              borderRadius: 10,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: C.amber,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 800,
                  color: C.white,
                  flexShrink: 0,
                }}
              >
                L0
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#633806' }}>
                  {hasFastProfile
                    ? 'Next win: calibrate your support'
                    : 'Start with your Cognitive Capacity Check'}
                </div>
                <div style={{ fontSize: 13, color: '#633806', marginTop: 4, lineHeight: 1.4 }}>
                  This helps GOGI choose the right amount of hints, chunking, and pacing before your
                  first reading win.
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/layer0')}
              style={{
                background: C.amber,
                color: C.white,
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                flexShrink: 0,
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
              Calibrate my support →
            </button>
          </div>
        )}

        {/* Section A: Streak */}
        <div style={{ marginBottom: 16 }}>
          <StreakCounter streak={streak} />
        </div>

        {/* Section A3: Reading Profile card — hidden once complete */}
        {layer0Complete && !setupProfileComplete && (
          <div
            style={{
              background: C.redLight,
              border: `1px solid ${C.red}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Icon circle */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: C.red,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 800,
                  color: C.white,
                  flexShrink: 0,
                }}
              >
                R
              </div>
              {/* Text block */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#791F1F' }}>
                  Complete your Reading Profile first
                </div>
                <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>
                  Takes 12 minutes · Do this before your first diagnostic · Helps GOGI support you
                  correctly
                </div>
              </div>
            </div>
            {/* CTA */}
            <button
              onClick={() => router.push('/profile/reading')}
              style={{
                background: C.red,
                color: C.white,
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                flexShrink: 0,
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
              Start Reading Profile →
            </button>
          </div>
        )}

        {layer0Complete && hasFastProfile && (
          <div
            style={{
              background: C.greenLight,
              border: `1px solid ${C.green}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#27500A' }}>
                Your next win is ready
              </div>
              <div style={{ fontSize: 11, color: '#3B6D11', marginTop: 2, lineHeight: 1.5 }}>
                Start with {nextWinStandardLabel}. GOGI will check one gap, teach one move, and give
                you a quick proof point.
              </div>
            </div>
            <button
              onClick={() => router.push(studentWinRoute)}
              style={{
                background: C.green,
                color: C.white,
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                flexShrink: 0,
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
              {studentWinCta}
            </button>
          </div>
        )}

        {layer0Complete && setupProfileComplete && !hasFastProfile && !layer0ExitComplete && (
          <div
            style={{
              background: C.blueLight,
              border: `1px solid ${C.blueMid}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                Pilot exit Cognitive Capacity Check
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                Re-run Layer 0 at exit so GOGI can compare change over time.
              </div>
            </div>
            <button
              onClick={() => router.push('/layer0?exit=1')}
              style={{
                background: C.blue,
                color: C.white,
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
                flexShrink: 0,
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
              Start exit check →
            </button>
          </div>
        )}

        {/* Section B: Standards */}
        {layer0Complete && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.gray,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                marginBottom: 8,
              }}
            >
              YOUR READING WIN MAP
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                alignItems: 'start',
                gap: 10,
              }}
              className="standards-grid"
            >
              {visibleStandards.map((s) => {
                const result = richData[s.code];
                const status = result?.status ?? 'notStarted';

                return (
                  <div key={s.id}>
                    <StandardTile
                      standardId={s.code}
                      standardCode={s.code}
                      standardUuid={s.id}
                      title={s.title}
                      status={status}
                      sessionsPassed={result?.sessionsPassed ?? 0}
                      sessionsAttempted={result?.sessionsAttempted ?? 0}
                      currentIntervention={result?.currentIntervention ?? null}
                      diagnosticQuestionsAnswered={result?.diagnosticQuestionsAnswered ?? 0}
                      diagnosticQuestionsTotal={
                        result?.diagnosticQuestionsTotal ?? diagnosticTotalForCode(s.code)
                      }
                      timeSpentMinutes={result?.timeSpentMinutes ?? 0}
                      skillGaps={result?.skillGaps ?? []}
                      lastSessionAt={result?.lastSessionAt ?? null}
                      currentStatus={result?.currentStatus ?? 'not_started'}
                      vocabCheckComplete={result?.vocabCheckComplete ?? false}
                      vocabCoverageScore={result?.vocabCoverageScore ?? null}
                      gapsIdentified={result?.gapsIdentified ?? []}
                      gapsAddressed={result?.gapsAddressed ?? []}
                      currentGap={result?.currentGap ?? null}
                      profileComplete={setupProfileComplete}
                      isOpen={activeCard === s.code}
                      onToggle={() => setActiveCard((prev) => (prev === s.code ? null : s.code))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .standards-grid {
            grid-template-columns: 1fr !important;
          }
          .journey-grid {
            grid-template-columns: 1fr !important;
          }
          .wins-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
