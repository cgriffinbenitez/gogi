'use client';

// StudentDetailPage.tsx
// Teacher view of a single student's complete clinical picture.
// Shows student header, per-standard sections with session timeline and
// response detail, and a teacher override button for failed reassessments.

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { buildFastTrajectorySummary } from '@/lib/fast/trajectory';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbStudent {
  id: string;
  full_name: string;
  grade_level: string | null;
  fast_pm1_score: number | null;
  fast_pm2_score: number | null;
  teacher_id: string;
  // IRB pilot columns
  consent_on_file: boolean;
  consent_signed_date: string | null;
  consent_signed_by: string | null;
  assent_on_file: boolean;
  assent_signed_date: string | null;
  cohort_group: 'A' | 'B' | null;
}

interface DbStandard {
  id: string;
  code: string;
  title: string;
}

interface DbSession {
  id: string;
  standard_id: string;
  phase: string;
  status: string;
  mastery_achieved: boolean | null;
  started_at: string;
  completed_at: string | null;
  time_spent_seconds: number | null;
}

interface DbResponse {
  id: string;
  session_id: string | null;
  standard_id: string;
  cognitive_skill_targeted: string | null;
  diagnostic_classification: string | null;
  intervention_type: string | null;
  student_response: string | null;
  mastery_achieved: boolean | null;
  attempt_number: number | null;
  ai_feedback: string | null;
  teacher_override: boolean | null;
  created_at: string;
}

interface DbCognitiveProfile {
  working_memory_score: number;
  inferencing_score: number;
  vocab_breadth_score: number;
  syntax_score: number;
  overall_risk: string;
  administered_at: string;
}

interface DbLayer0Assessment {
  id: string;
  completed_at: string | null;
  administration_number: number;
  dsb_max_span: number | null;
  dsb_band: string | null;
  cpt_commission_errors: number | null;
  cpt_omission_errors: number | null;
  cpt_band: string | null;
  sdst_correct: number | null;
  sdst_attempted: number | null;
  sdst_band: string | null;
  rtv_band: string | null;
  cpt_rt_cv: number | null;
  layer0_composite: string | null;
  load_calibration: string | null;
  teacher_review_flag: boolean | null;
}

interface DbDiagnosticInsight {
  confidence_label: string;
  confidence_score: number;
  likely_driver: string;
  recommended_route: string | null;
  primary_misconception: string | null;
  secondary_misconceptions: string[] | null;
  insight: {
    instructionalHypothesis?: string;
    interventionDesign?: string[];
    prePostLookFors?: string[];
    teacherSummary?: string;
  } | null;
}

interface DbFastCognitiveProfile {
  classification_scores: Record<string, number> | null;
  benchmark_strengths: Record<string, { pct_correct?: number; attempts?: number }> | null;
  benchmark_weaknesses: Record<string, { pct_correct?: number; attempts?: number }> | null;
  current_achievement_level: number | null;
  next_rung_target: number | null;
  points_to_next_rung: number | null;
  top_strengths: Array<{ benchmark_code: string; pct_correct: number; attempts: number }> | null;
  top_weaknesses: Array<{ benchmark_code: string; pct_correct: number; attempts: number }> | null;
  confidence_label: string | null;
  interpretation: {
    summary?: string;
    first_instructional_move?: string;
    confidence_rationale?: string;
    top_barriers?: Array<{
      code: string;
      label: string;
      strength: number;
      band: string;
      action: string;
    }>;
    benchmark_evidence?: Array<{
      benchmark_code: string;
      pct_correct: number;
      attempts: number;
      evidence_label: string;
    }>;
    recommended_next_step?: {
      route: string;
      label: string;
      reason: string;
    };
  } | null;
  generated_at: string;
}

interface DbFastAssessment {
  id: string;
  test_reason: string;
  assessment_grade: number | null;
  test_year: number;
  date_taken: string | null;
  scale_score: number | null;
  achievement_level: number | null;
}

type StandardStatus = 'not_started' | 'in_progress' | 'mastered' | 'needs_support';

interface StandardData {
  standard: DbStandard;
  sessions: DbSession[];
  responses: DbResponse[];
  diagnosticClassification: string | null;
  protocolAssigned: string | null;
  status: StandardStatus;
  hasTeacherOverride: boolean;
  latestFailedReassessSession: DbSession | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PILOT_STANDARD_CODES = ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'];

const PHASE_LABELS: Record<string, string> = {
  diagnostic: 'Diagnostic',
  teach: 'Teach',
  practice: 'Practice',
  reassess: 'Reassess',
};

const PHASE_COLORS: Record<string, string> = {
  diagnostic: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  teach: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  practice: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reassess: 'bg-[#1D9E75]/20 text-[#1D9E75] border-[#1D9E75]/30',
};

const STATUS_BADGE: Record<StandardStatus, string> = {
  not_started: 'bg-white/[0.06] text-[#4B5563] border-white/[0.08]',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  mastered: 'bg-[#1D9E75]/20 text-[#1D9E75] border-[#1D9E75]/30',
  needs_support: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const STATUS_LABEL: Record<StandardStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  mastered: 'Mastered',
  needs_support: 'Needs Support',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStandardStatus(sessions: DbSession[], hasOverride: boolean): StandardStatus {
  if (hasOverride) return 'mastered';
  const reassess = sessions.filter((s) => s.phase === 'reassess' && s.completed_at);
  if (reassess.some((s) => s.mastery_achieved === true)) return 'mastered';
  if (reassess.some((s) => s.mastery_achieved === false)) return 'needs_support';
  if (sessions.length > 0) return 'in_progress';
  return 'not_started';
}

function deriveOverallStatus(standards: StandardData[]): string {
  if (standards.length === 0) return 'No Data';
  const statuses = standards.map((s) => s.status);
  if (statuses.every((s) => s === 'mastered')) return 'All Mastered';
  if (statuses.some((s) => s === 'needs_support')) return 'Needs Support';
  if (statuses.some((s) => s === 'in_progress')) return 'In Progress';
  return 'Not Started';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMinutes(seconds: number | null): string {
  if (seconds === null) return '—';
  return `${Math.round(seconds / 60)} min`;
}

function truncate(text: string | null, len = 150): string {
  if (!text) return '—';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

// Cascade-tiebroken predicted gap — cascade order defines tie priority
function derivePredictedGap(p: DbCognitiveProfile): string {
  const dims = [
    { label: 'Vocab Breadth', score: p.vocab_breadth_score },
    { label: 'Syntactic Awareness', score: p.syntax_score },
    { label: 'Inferencing', score: p.inferencing_score },
    { label: 'Working Memory', score: p.working_memory_score },
  ];
  const lowest = dims.reduce((min, d) => (d.score < min.score ? d : min), dims[0]);
  return `Predicted gap: ${lowest.label}`;
}

function formatSignalLabel(code: string): string {
  const labels: Record<string, string> = {
    figurative_language_failure: 'Figurative and symbolic meaning',
    inferencing_literal: 'Literal reading when inference is needed',
    inferencing_schema: 'Inference schema/background knowledge',
    tone_misreading: 'Tone and speaker attitude',
    mood_misreading: 'Mood from word choice and details',
    vocabulary_gap: 'Vocabulary in context',
    evidence_retrieval_failure: 'Finding the right evidence',
    comprehension_integration_failure: 'Putting details together',
    topic_vs_theme_confusion: 'Theme versus topic',
    structure_purpose_disconnect: 'Structure and author purpose',
    no_metacognitive_strategy: 'Monitoring confusion',
    morphology_gap: 'Word parts and morphology',
    syntax_barrier: 'Sentence structure',
  };

  return labels[code] ?? code.replace(/_/g, ' ');
}

function fastSignalAction(code: string): string {
  const actions: Record<string, string> = {
    figurative_language_failure:
      'Start with figurative language, symbolism, and connotation using short text chunks.',
    inferencing_literal: 'Teach students to move from stated detail to supported inference.',
    inferencing_schema: 'Build background structure before asking for independent inference.',
    tone_misreading: 'Use speaker attitude, diction, and contrast work before full analysis.',
    mood_misreading: 'Have students name mood from concrete details before interpreting theme.',
    vocabulary_gap: 'Pre-teach high-leverage words and use context-clue routines.',
    evidence_retrieval_failure:
      'Practice locating and justifying the exact detail that proves an answer.',
    comprehension_integration_failure: 'Use two-detail synthesis before longer response work.',
    topic_vs_theme_confusion:
      'Separate what the text is about from what it says about life or people.',
    structure_purpose_disconnect: 'Connect paragraph structure to author purpose before analysis.',
    no_metacognitive_strategy: 'Add stop-and-check moments so students notice confusion early.',
    morphology_gap: 'Teach prefixes, roots, and suffixes tied to passage vocabulary.',
    syntax_barrier: 'Unpack long sentences before asking inference or theme questions.',
  };

  return actions[code] ?? 'Use a short diagnostic to confirm the instructional driver.';
}

function topFastSignals(profile: DbFastCognitiveProfile | null) {
  if (profile?.interpretation?.top_barriers?.length) {
    return profile.interpretation.top_barriers;
  }

  const entries = Object.entries(profile?.classification_scores ?? {})
    .filter(([, score]) => Number(score) > 0)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 5);
  const topScore = Number(entries[0]?.[1] ?? 0);

  return entries.map(([code, score]) => {
    const strength = topScore > 0 ? Math.round((Number(score) / topScore) * 100) : 0;
    return {
      code,
      label: formatSignalLabel(code),
      action: fastSignalAction(code),
      strength,
      band:
        strength >= 80 ? 'Strong signal' : strength >= 50 ? 'Moderate signal' : 'Emerging signal',
    };
  });
}

function formatAdministeredAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`bg-white/[0.06] rounded animate-pulse ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0d0f12] p-6 max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-5 w-24" />
      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-6 space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 space-y-3"
        >
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Expandable text ──────────────────────────────────────────────────────────

function ExpandableText({ text, label }: { text: string | null; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-[#4B5563] text-xs">—</span>;
  const needsExpand = text.length > 150;
  return (
    <div>
      <p className="text-[#94A3B8] text-xs leading-relaxed">{expanded ? text : truncate(text)}</p>
      {needsExpand && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[#1D9E75] text-xs font-semibold mt-1 hover:underline flex items-center gap-0.5"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Show {label}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Override modal ───────────────────────────────────────────────────────────

interface OverrideModalProps {
  studentName: string;
  standardCode: string;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}

function OverrideModal({
  studentName,
  standardCode,
  onConfirm,
  onCancel,
  saving,
}: OverrideModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#111418] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-[#1D9E75]" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Teacher Override</h3>
            <p className="text-[#4B5563] text-xs">This action is logged</p>
          </div>
        </div>
        <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
          Mark <span className="text-white font-semibold">{studentName}</span> as mastered on{' '}
          <span className="text-[#1D9E75] font-semibold">{standardCode}</span>? This will override
          the failed reassessment result and cannot be undone from the student view.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-[#94A3B8] text-sm font-semibold hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#17876A] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm Override'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Standard section ─────────────────────────────────────────────────────────

interface StandardSectionProps {
  data: StandardData;
  studentName: string;
  onOverrideComplete: () => void;
}

function StandardSection({ data, studentName, onOverrideComplete }: StandardSectionProps) {
  const {
    standard,
    sessions,
    responses,
    diagnosticClassification,
    protocolAssigned,
    status,
    hasTeacherOverride,
    latestFailedReassessSession,
  } = data;
  const [collapsed, setCollapsed] = useState(false);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);

  const toggleResponse = (id: string) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOverrideConfirm = async () => {
    setOverrideSaving(true);
    await supabase.from('responses').insert({
      student_id: (data as unknown as { studentId: string }).studentId,
      standard_id: standard.id,
      mastery_achieved: true,
      teacher_override: true,
    });
    setOverrideSaving(false);
    setShowOverrideModal(false);
    onOverrideComplete();
  };

  // Responses grouped by session_id
  const responsesBySession = responses.reduce<Record<string, DbResponse[]>>((acc, r) => {
    const key = r.session_id ?? 'unlinked';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const showOverrideButton =
    !hasTeacherOverride && latestFailedReassessSession !== null && status === 'needs_support';

  return (
    <>
      {showOverrideModal && (
        <OverrideModal
          studentName={studentName}
          standardCode={standard.code}
          onConfirm={handleOverrideConfirm}
          onCancel={() => setShowOverrideModal(false)}
          saving={overrideSaving}
        />
      )}

      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Section header */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.04] transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-bold text-sm font-mono">{standard.code}</span>
            <span className="text-[#4B5563] text-sm">{standard.title}</span>
            <span className={`badge text-xs border ${STATUS_BADGE[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            {hasTeacherOverride && (
              <span className="badge bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30 text-xs flex items-center gap-1">
                <ShieldCheck size={11} /> Override Active
              </span>
            )}
          </div>
          {collapsed ? (
            <ChevronDown size={16} className="text-[#4B5563] flex-shrink-0" />
          ) : (
            <ChevronUp size={16} className="text-[#4B5563] flex-shrink-0" />
          )}
        </button>

        {!collapsed && (
          <div className="border-t border-white/[0.08]">
            {/* Metadata row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-4 bg-white/[0.02] border-b border-white/[0.08]">
              <div>
                <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide mb-1">
                  Diagnostic Classification
                </p>
                <p className="text-sm text-[#94A3B8]">{diagnosticClassification ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide mb-1">
                  Protocol Assigned
                </p>
                <p className="text-sm text-[#94A3B8]">{protocolAssigned ?? '—'}</p>
              </div>
            </div>

            {/* Session timeline */}
            {sessions.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-[#4B5563] text-sm">No sessions started for this standard.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {sessions.map((session) => {
                  const sessionResponses = responsesBySession[session.id] ?? [];
                  const isTeachOrPractice =
                    session.phase === 'teach' || session.phase === 'practice';
                  const phaseColor =
                    PHASE_COLORS[session.phase] ??
                    'bg-white/[0.06] text-[#94A3B8] border-white/[0.08]';

                  return (
                    <div key={session.id} className="px-5 py-4">
                      {/* Session row */}
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`badge text-xs border ${phaseColor}`}>
                            {PHASE_LABELS[session.phase] ?? session.phase}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
                            <Clock size={12} />
                            <span>{formatDate(session.started_at)}</span>
                          </div>
                          {session.completed_at ? (
                            <span className="text-xs text-[#4B5563]">
                              → {formatDate(session.completed_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-400">In progress</span>
                          )}
                          {session.time_spent_seconds !== null && (
                            <span className="text-xs text-[#4B5563]">
                              · {formatMinutes(session.time_spent_seconds)}
                            </span>
                          )}
                        </div>
                        {session.phase === 'reassess' && session.completed_at && (
                          <div>
                            {session.mastery_achieved === true ? (
                              <span className="flex items-center gap-1 text-xs font-semibold text-[#1D9E75]">
                                <CheckCircle2 size={13} /> Passed
                              </span>
                            ) : session.mastery_achieved === false ? (
                              <span className="flex items-center gap-1 text-xs font-semibold text-rose-400">
                                <XCircle size={13} /> Did not pass
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Responses for teach/practice sessions */}
                      {isTeachOrPractice && sessionResponses.length > 0 && (
                        <div className="mt-3 space-y-2 pl-4 border-l border-white/[0.06]">
                          {sessionResponses.map((resp) => {
                            const isExpanded = expandedResponses.has(resp.id);
                            return (
                              <div
                                key={resp.id}
                                className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5"
                              >
                                {/* Response header */}
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {resp.attempt_number !== null && (
                                      <span className="text-xs text-[#4B5563] font-mono">
                                        #{resp.attempt_number}
                                      </span>
                                    )}
                                    {resp.intervention_type && (
                                      <span className="text-xs text-[#94A3B8] bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/[0.06]">
                                        {resp.intervention_type}
                                      </span>
                                    )}
                                    {resp.mastery_achieved !== null &&
                                      (resp.mastery_achieved ? (
                                        <span className="flex items-center gap-0.5 text-xs text-[#1D9E75]">
                                          <CheckCircle2 size={11} /> Passed
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5 text-xs text-rose-400">
                                          <XCircle size={11} /> Failed
                                        </span>
                                      ))}
                                  </div>
                                  <button
                                    onClick={() => toggleResponse(resp.id)}
                                    className="text-[#4B5563] hover:text-[#94A3B8] transition-colors flex-shrink-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp size={14} />
                                    ) : (
                                      <ChevronDown size={14} />
                                    )}
                                  </button>
                                </div>

                                {/* Always show truncated student response */}
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                                    Student Response
                                  </p>
                                  <ExpandableText
                                    text={resp.student_response}
                                    label="full response"
                                  />
                                </div>

                                {/* Expanded: show AI feedback */}
                                {isExpanded && (
                                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] space-y-1.5">
                                    <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                                      AI Feedback
                                    </p>
                                    <ExpandableText text={resp.ai_feedback} label="full feedback" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Teacher override */}
            {showOverrideButton && (
              <div className="px-5 py-4 border-t border-white/[0.08] bg-amber-500/[0.04]">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                    <p className="text-sm text-amber-400">
                      Reassessment failed. Teacher can override if in-person mastery is observed.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowOverrideModal(true)}
                    className="flex items-center gap-1.5 bg-[#1D9E75]/20 hover:bg-[#1D9E75]/30 text-[#1D9E75] border border-[#1D9E75]/30 text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex-shrink-0"
                  >
                    <ShieldCheck size={13} />
                    Mark as Mastered
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [student, setStudent] = useState<DbStudent | null>(null);
  const [standardsData, setStandardsData] = useState<StandardData[]>([]);
  const [cognitiveProfile, setCognitiveProfile] = useState<DbCognitiveProfile | null>(null);
  const [layer0Profile, setLayer0Profile] = useState<DbLayer0Assessment | null>(null);
  const [diagnosticInsight, setDiagnosticInsight] = useState<DbDiagnosticInsight | null>(null);
  const [fastProfile, setFastProfile] = useState<DbFastCognitiveProfile | null>(null);
  const [fastAssessments, setFastAssessments] = useState<DbFastAssessment[]>([]);
  const [fetchKey, setFetchKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // ── Auth ────────────────────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      router.push('/sign-up-login-screen');
      return;
    }

    // ── Student (verify belongs to this teacher) ────────────────────────────
    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, grade_level, fast_pm1_score, fast_pm2_score, teacher_id')
      .eq('id', studentId)
      .eq('teacher_id', user.id)
      .single();

    if (studentError || !studentRow) {
      setErrorMsg('Student not found or you do not have access.');
      setLoading(false);
      return;
    }
    setStudent(studentRow as DbStudent);

    // ── Standards ───────────────────────────────────────────────────────────
    const { data: standardRows } = await supabase
      .from('standards')
      .select('id, code, title')
      .in('code', PILOT_STANDARD_CODES)
      .order('code', { ascending: true });

    const standards = (standardRows ?? []) as DbStandard[];

    // ── Sessions + Responses + Cognitive Profile in parallel ───────────────
    const [
      sessionsRes,
      responsesRes,
      cogProfileRes,
      layer0Res,
      diagnosticInsightRes,
      fastProfileRes,
      fastAssessmentsRes,
    ] = await Promise.all([
      supabase
        .from('sessions')
        .select(
          'id, standard_id, phase, status, mastery_achieved, started_at, completed_at, time_spent_seconds'
        )
        .eq('student_id', studentId)
        .order('started_at', { ascending: true }),

      supabase
        .from('responses')
        .select(
          'id, session_id, standard_id, cognitive_skill_targeted, diagnostic_classification, intervention_type, student_response, mastery_achieved, attempt_number, ai_feedback, teacher_override, created_at'
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: true }),

      supabase
        .from('cognitive_profiles')
        .select(
          'working_memory_score, inferencing_score, vocab_breadth_score, syntax_score, overall_risk, administered_at'
        )
        .eq('student_id', studentId)
        .order('administered_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('layer0_assessments')
        .select(
          'id, completed_at, administration_number, dsb_max_span, dsb_band, cpt_commission_errors, cpt_omission_errors, cpt_band, sdst_correct, sdst_attempted, sdst_band, rtv_band, cpt_rt_cv, layer0_composite, load_calibration, teacher_review_flag'
        )
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .order('administration_number', { ascending: false })
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('diagnostic_insights')
        .select(
          'confidence_label, confidence_score, likely_driver, recommended_route, primary_misconception, secondary_misconceptions, insight'
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('student_cognitive_profiles')
        .select(
          'classification_scores, benchmark_strengths, benchmark_weaknesses, current_achievement_level, next_rung_target, points_to_next_rung, top_strengths, top_weaknesses, confidence_label, interpretation, generated_at'
        )
        .eq('student_id', studentId)
        .eq('active', true)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('fast_assessments')
        .select(
          'id, test_reason, assessment_grade, test_year, date_taken, scale_score, achievement_level'
        )
        .eq('student_id', studentId)
        .order('test_year', { ascending: false })
        .order('test_reason', { ascending: false }),
    ]);

    const allSessions = (sessionsRes.data ?? []) as DbSession[];
    const allResponses = (responsesRes.data ?? []) as DbResponse[];
    setCognitiveProfile((cogProfileRes.data ?? null) as DbCognitiveProfile | null);
    setLayer0Profile((layer0Res.data ?? null) as DbLayer0Assessment | null);
    setDiagnosticInsight((diagnosticInsightRes.data ?? null) as DbDiagnosticInsight | null);
    setFastProfile((fastProfileRes.data ?? null) as DbFastCognitiveProfile | null);
    setFastAssessments((fastAssessmentsRes.data ?? []) as DbFastAssessment[]);

    // ── Build per-standard data ─────────────────────────────────────────────
    const built: StandardData[] = standards.map((standard) => {
      const sessions = allSessions.filter((s) => s.standard_id === standard.id);
      const responses = allResponses.filter((r) => r.standard_id === standard.id);

      const hasTeacherOverride = responses.some((r) => r.teacher_override === true);

      // First diagnostic_classification from any diagnostic response
      const diagResponse = responses.find(
        (r) => r.diagnostic_classification && r.diagnostic_classification.length > 0
      );
      const diagnosticClassification = diagResponse?.diagnostic_classification ?? null;

      // First intervention_type from teach/practice responses
      const teachResponse = responses.find(
        (r) => r.intervention_type && r.intervention_type.length > 0
      );
      const protocolAssigned = teachResponse?.intervention_type ?? null;

      const status = deriveStandardStatus(sessions, hasTeacherOverride);

      const latestFailedReassessSession =
        sessions
          .filter((s) => s.phase === 'reassess' && s.mastery_achieved === false && s.completed_at)
          .slice(-1)[0] ?? null;

      return {
        standard,
        sessions,
        responses,
        diagnosticClassification,
        protocolAssigned,
        status,
        hasTeacherOverride,
        latestFailedReassessSession,
        // Attach studentId so StandardSection can use it in override insert
        studentId,
      } as StandardData & { studentId: string };
    });

    setStandardsData(built);
    setLoading(false);
  }, [studentId, router]);

  useEffect(() => {
    if (studentId) load();
  }, [studentId, load, fetchKey]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen bg-[#0d0f12]">
        <TeacherDashboardTopBar active="roster" />
        <PageSkeleton />
      </div>
    );

  // ── Error ────────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#0d0f12]">
        <TeacherDashboardTopBar active="roster" />
        <div className="flex min-h-[calc(100vh-52px)] items-center justify-center px-4">
          <div className="max-w-md w-full bg-white/[0.06] border border-rose-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-white font-bold text-xl mb-2">Unable to Load Student</h2>
            <p className="text-[#94A3B8] text-sm mb-6 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => router.push('/dashboard/teacher')}
              className="btn-primary w-full"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const overallStatus = deriveOverallStatus(standardsData);
  const overallStatusColor =
    overallStatus === 'All Mastered'
      ? 'text-[#1D9E75]'
      : overallStatus === 'Needs Support'
        ? 'text-rose-400'
        : overallStatus === 'In Progress'
          ? 'text-amber-400'
          : 'text-[#4B5563]';
  const fastTrajectory = buildFastTrajectorySummary(fastAssessments);

  return (
    <div className="min-h-screen bg-[#0d0f12]">
      <TeacherDashboardTopBar active="roster" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Back nav */}
        <button
          onClick={() => router.push('/dashboard/teacher')}
          className="flex items-center gap-1.5 text-[#4B5563] hover:text-[#94A3B8] text-sm transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Dashboard
        </button>

        {/* Student header */}
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#1D9E75]/20 border border-[#1D9E75]/30 flex items-center justify-center text-[#1D9E75] font-bold text-base flex-shrink-0">
                {student.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{student.full_name}</h1>
                <p className="text-sm text-[#4B5563]">
                  Grade {student.grade_level ?? '—'} · 9th Grade ELA
                </p>
              </div>
            </div>
            <div className={`text-sm font-semibold ${overallStatusColor}`}>{overallStatus}</div>
          </div>

          {/* FAST trajectory */}
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                FAST trajectory
              </p>
              <p className="text-xs text-[#94A3B8]">{fastTrajectory.narrative}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {fastTrajectory.points.length ? (
                fastTrajectory.points.map((point) => (
                  <div
                    key={point.id}
                    className="min-w-[110px] rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-[#94A3B8]">
                      {point.test_reason} {point.test_year}
                    </p>
                    <p className="mt-1 text-lg font-bold text-white">{point.scale_score ?? '—'}</p>
                    <p className="text-xs text-[#4B5563]">
                      Level {point.achievement_level ?? '—'}
                      {point.growth_from_previous === null
                        ? ' · baseline'
                        : ` · ${point.growth_from_previous > 0 ? '+' : ''}${point.growth_from_previous}`}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#4B5563]">
                  Upload a FAST report to show PM1, PM2, and PM3 growth here.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FAST COLD-START PROFILE */}
        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
              FAST Cold-Start Cognitive Profile
            </p>
            <div className="flex items-center gap-3">
              {fastProfile ? (
                <span className="text-xs text-[#4B5563]">
                  Generated {formatDate(fastProfile.generated_at)}
                </span>
              ) : (
                <span className="text-xs text-[#4B5563]">No FAST profile yet</span>
              )}
              <button
                type="button"
                onClick={() => router.push(`/teacher-dashboard/students/${student.id}/fast`)}
                className="text-xs font-semibold text-[#93C5FD] hover:text-white"
              >
                Full FAST evidence
              </button>
            </div>
          </div>

          {fastProfile ? (
            <div className="space-y-3">
              {fastProfile.interpretation?.summary ? (
                <div className="bg-[#1D4ED8]/10 border border-[#60A5FA]/30 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-white">
                      {fastProfile.interpretation.summary}
                    </p>
                    <span className="text-xs font-semibold text-[#BFDBFE] capitalize">
                      {(fastProfile.confidence_label ?? 'not_enough_data').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#BFDBFE] mt-2 leading-relaxed">
                    {fastProfile.interpretation.first_instructional_move}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                    Current rung
                  </p>
                  <p className="text-sm font-bold text-white mt-1">
                    Level {fastProfile.current_achievement_level ?? '—'}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                    {fastProfile.points_to_next_rung === null ||
                    fastProfile.points_to_next_rung === undefined
                      ? 'No next-rung target available yet.'
                      : `${fastProfile.points_to_next_rung} points to ${fastProfile.next_rung_target}.`}
                  </p>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                    Likely starting needs
                  </p>
                  <div className="mt-2 space-y-3">
                    {topFastSignals(fastProfile).length ? (
                      topFastSignals(fastProfile).map((signal, index) => (
                        <div key={signal.code} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-[#94A3B8]">{signal.label}</span>
                            <span className="font-semibold text-white">{signal.band}</span>
                          </div>
                          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2E75B6] rounded-full"
                              style={{ width: `${signal.strength}%` }}
                            />
                          </div>
                          {index === 0 ? (
                            <p className="text-xs text-[#94A3B8] leading-relaxed">
                              {signal.action}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        No missed-benchmark signal yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                    Benchmark accuracy to inspect
                  </p>
                  <div className="mt-2 space-y-1">
                    {(
                      fastProfile.interpretation?.benchmark_evidence ??
                      fastProfile.top_weaknesses ??
                      []
                    )
                      .slice(0, 4)
                      .map((weakness) => (
                        <div
                          key={weakness.benchmark_code}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="text-[#94A3B8]">{weakness.benchmark_code}</span>
                          <span className="font-mono font-bold text-white">
                            {Math.round(weakness.pct_correct * 100)}% correct
                          </span>
                        </div>
                      ))}
                    {!fastProfile.top_weaknesses?.length ? (
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        No benchmark weakness summary yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {fastProfile.interpretation?.recommended_next_step ? (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                    Recommended next step
                  </p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {fastProfile.interpretation.recommended_next_step.label}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {fastProfile.interpretation.recommended_next_step.reason}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[#94A3B8]">
              Upload a FAST ELA Reading ISR to create the student&apos;s starting cognitive signal
              map before Layer 0 calibration.
            </p>
          )}
        </div>

        {/* PRE-LITERARY COGNITIVE PROFILE */}
        <div
          className={`bg-white/[0.06] border ${layer0Profile?.teacher_review_flag ? 'border-amber-500/40' : 'border-white/[0.08]'} rounded-2xl p-5 sm:p-6`}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
              Layer 0 Cognitive Availability
            </p>
            {layer0Profile ? (
              <span className="text-xs text-[#4B5563]">
                Admin {layer0Profile.administration_number} ·{' '}
                {formatDate(layer0Profile.completed_at)}
              </span>
            ) : (
              <span className="text-xs text-[#4B5563]">Not yet administered</span>
            )}
          </div>

          {layer0Profile ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Working Memory',
                    value: layer0Profile.dsb_band,
                    detail: `Max span ${layer0Profile.dsb_max_span ?? '—'}`,
                  },
                  {
                    label: 'Attention',
                    value: layer0Profile.cpt_band,
                    detail: `${layer0Profile.cpt_commission_errors ?? '—'} commission · ${layer0Profile.cpt_omission_errors ?? '—'} omission`,
                  },
                  {
                    label: 'Speed',
                    value: layer0Profile.sdst_band,
                    detail: `${layer0Profile.sdst_correct ?? '—'} / ${layer0Profile.sdst_attempted ?? '—'} correct`,
                  },
                  {
                    label: 'Consistency',
                    value: layer0Profile.rtv_band,
                    detail: `RT-CV ${layer0Profile.cpt_rt_cv ?? '—'}`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3"
                  >
                    <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-white capitalize mt-1">
                      {item.value ?? 'pending'}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-1">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <p className="text-sm font-semibold text-white capitalize">
                  {(layer0Profile.load_calibration ?? 'standard').replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  {layer0Profile.load_calibration === 'maximum_reduction'
                    ? 'Use very small chunks, persistent supports, fewer choices, and teacher review.'
                    : layer0Profile.load_calibration === 'reduced'
                      ? 'Use shorter chunks, visible directions, and slower scaffold fading.'
                      : 'Use standard GOGI pacing and fade scaffolds on schedule.'}
                </p>
              </div>

              {layer0Profile.teacher_review_flag && (
                <div className="mt-4 flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/30 rounded-xl p-3">
                  <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    This student&apos;s cognitive availability profile suggests literacy
                    intervention may be limited until upstream factors are addressed. Consider
                    conferencing and/or counselor referral.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[#94A3B8]">
              Layer 0 results will appear here after the student completes the cognitive capacity
              check.
            </p>
          )}
        </div>

        {/* DIAGNOSTIC INSIGHT */}
        <div
          className={`bg-white/[0.06] border ${diagnosticInsight?.confidence_label === 'strong_signal' ? 'border-white/[0.08]' : 'border-amber-500/35'} rounded-2xl p-5 sm:p-6`}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
              Diagnostic Evidence Map
            </p>
            {diagnosticInsight ? (
              <span className="text-xs text-[#94A3B8] capitalize">
                {diagnosticInsight.confidence_label.replace(/_/g, ' ')} ·{' '}
                {diagnosticInsight.confidence_score}%
              </span>
            ) : (
              <span className="text-xs text-[#4B5563]">No diagnostic insight yet</span>
            )}
          </div>

          {diagnosticInsight ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                  Likely driver
                </p>
                <p className="text-sm font-bold text-white capitalize mt-1">
                  {diagnosticInsight.likely_driver.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                  {diagnosticInsight.insight?.instructionalHypothesis ??
                    'GOGI is collecting enough evidence to separate literacy gap from load interaction.'}
                </p>
              </div>

              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                  Misconception map
                </p>
                <p className="text-sm font-bold text-white mt-1">
                  {(diagnosticInsight.primary_misconception ?? 'No dominant gap').replace(
                    /_/g,
                    ' '
                  )}
                </p>
                <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                  Route: {(diagnosticInsight.recommended_route ?? 'strategy').replace(/-/g, ' ')}
                </p>
              </div>

              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                  Pre/post look-fors
                </p>
                <ul className="mt-2 space-y-1">
                  {(diagnosticInsight.insight?.prePostLookFors ?? []).slice(0, 3).map((item) => (
                    <li key={item} className="text-xs text-[#94A3B8] leading-relaxed">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#94A3B8]">
              After the student completes the ELA.9.R.1.1 diagnostic, GOGI will connect
              misconception evidence to Layer 0 and show confidence, likely driver, and intervention
              look-fors here.
            </p>
          )}
        </div>

        <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
              Pre-Literary Cognitive Profile
            </p>
            {cognitiveProfile ? (
              <span className="text-xs text-[#4B5563]">
                Administered {formatAdministeredAt(cognitiveProfile.administered_at)}
              </span>
            ) : (
              <span className="text-xs text-[#4B5563]">Not yet administered</span>
            )}
          </div>

          <div className="space-y-3">
            {(
              [
                { label: 'Working Memory', score: cognitiveProfile?.working_memory_score ?? null },
                { label: 'Inferencing', score: cognitiveProfile?.inferencing_score ?? null },
                { label: 'Vocab Breadth', score: cognitiveProfile?.vocab_breadth_score ?? null },
                { label: 'Syntactic Awareness', score: cognitiveProfile?.syntax_score ?? null },
              ] as { label: string; score: number | null }[]
            ).map(({ label, score }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-[#94A3B8]">{label}</p>
                  <p className="text-xs font-mono font-bold text-white">
                    {score !== null ? `${Math.round(score)}%` : '—%'}
                  </p>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2E75B6] rounded-full transition-all"
                    style={{ width: score !== null ? `${Math.round(score)}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-[#4B5563] mt-4">
            {cognitiveProfile
              ? derivePredictedGap(cognitiveProfile)
              : 'Predicted gap: pending Reading Profile'}
          </p>
        </div>

        {/* Per-standard sections */}
        {standardsData.length === 0 ? (
          <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl px-6 py-12 text-center">
            <p className="text-white font-semibold mb-1">No standards data yet</p>
            <p className="text-[#4B5563] text-sm">Standards will appear once seeded in Supabase.</p>
          </div>
        ) : (
          standardsData.map((sd) => (
            <StandardSection
              key={sd.standard.id}
              data={sd}
              studentName={student.full_name}
              onOverrideComplete={() => setFetchKey((k) => k + 1)}
            />
          ))
        )}
      </div>
    </div>
  );
}
