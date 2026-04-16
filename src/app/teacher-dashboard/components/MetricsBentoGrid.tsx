'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckSquare,
  Users,
  Award,
  AlertTriangle,
  Clock,
  Star,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricData {
  totalSessionsCompleted: number | null;
  studentsCurrentlyActive: number | null;
  masteryRate: number | null;        // 0–100, null = no data
  avgTimePerSession: number | null;  // minutes, 1 decimal
  studentsAtRisk: number | null;
  standardsMasteredThisWeek: number | null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricSkeleton({ isHero = false }: { isHero?: boolean }) {
  return (
    <div
      className={`bg-white/[0.06] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3 ${
        isHero ? 'xl:col-span-2 2xl:col-span-2' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-white/[0.06] animate-pulse" />
      <div className="flex flex-col gap-1.5">
        <div className="h-2.5 w-28 bg-white/[0.06] rounded animate-pulse" />
        <div className="h-8 w-16 bg-white/[0.08] rounded animate-pulse mt-1" />
        <div className="h-2 w-20 bg-white/[0.06] rounded animate-pulse" />
      </div>
      <div className="mt-auto pt-1 border-t border-white/[0.06]">
        <div className="h-2 w-24 bg-white/[0.06] rounded animate-pulse" />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null, suffix = '', fallback = '—'): string {
  if (n === null) return fallback;
  return `${n}${suffix}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricsBentoGrid() {
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);

      // ── Auth ──────────────────────────────────────────────────────────────
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setMetrics({
          totalSessionsCompleted: null,
          studentsCurrentlyActive: null,
          masteryRate: null,
          avgTimePerSession: null,
          studentsAtRisk: null,
          standardsMasteredThisWeek: null,
        });
        setLoading(false);
        return;
      }

      // ── Teacher's students ────────────────────────────────────────────────
      const { data: studentRows } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', user.id);

      const studentIds = (studentRows ?? []).map((s) => s.id);

      if (studentIds.length === 0) {
        setMetrics({
          totalSessionsCompleted: 0,
          studentsCurrentlyActive: 0,
          masteryRate: null,
          avgTimePerSession: null,
          studentsAtRisk: 0,
          standardsMasteredThisWeek: 0,
        });
        setLoading(false);
        return;
      }

      // ── Parallel queries ──────────────────────────────────────────────────
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [completedRes, activeRes, reassessRes, timeRes] = await Promise.all([
        // 1. Total completed sessions
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('student_id', studentIds)
          .not('completed_at', 'is', null),

        // 2. Active sessions (started within last 30 min, not yet completed)
        supabase
          .from('sessions')
          .select('student_id')
          .in('student_id', studentIds)
          .is('completed_at', null)
          .gte('started_at', thirtyMinAgo),

        // 3. All completed reassess sessions (for mastery rate, at-risk, this-week)
        supabase
          .from('sessions')
          .select('student_id, standard_id, mastery_achieved, completed_at')
          .in('student_id', studentIds)
          .eq('phase', 'reassess')
          .not('completed_at', 'is', null),

        // 4. Time per session (completed, non-null time)
        supabase
          .from('sessions')
          .select('time_spent_seconds')
          .in('student_id', studentIds)
          .not('completed_at', 'is', null)
          .not('time_spent_seconds', 'is', null),
      ]);

      // ── Metric 1: Total Sessions Completed ────────────────────────────────
      const totalSessionsCompleted = completedRes.count ?? 0;

      // ── Metric 2: Students Currently Active ───────────────────────────────
      const activeStudentIds = new Set(
        (activeRes.data ?? []).map((s) => s.student_id as string),
      );
      const studentsCurrentlyActive = activeStudentIds.size;

      // ── Metrics 3, 5, 6 from reassess sessions ────────────────────────────
      const reassess = reassessRes.data ?? [];

      // Mastery rate: passed reassess / all completed reassess
      const passed = reassess.filter((s) => s.mastery_achieved === true).length;
      const masteryRate =
        reassess.length > 0 ? Math.round((passed / reassess.length) * 100) : null;

      // Students at risk: has failed reassess on a standard with no passing reassess
      // Group by student_id:standard_id
      const groups = new Map<string, { hasPassed: boolean; hasFailed: boolean }>();
      for (const s of reassess) {
        const key = `${s.student_id as string}:${s.standard_id as string}`;
        const g = groups.get(key) ?? { hasPassed: false, hasFailed: false };
        if (s.mastery_achieved === true) g.hasPassed = true;
        if (s.mastery_achieved === false) g.hasFailed = true;
        groups.set(key, g);
      }
      const atRiskStudents = new Set<string>();
      for (const [key, g] of groups) {
        if (g.hasFailed && !g.hasPassed) {
          atRiskStudents.add(key.split(':')[0]);
        }
      }
      const studentsAtRisk = atRiskStudents.size;

      // Standards mastered this week
      const masteredThisWeek = new Set<string>();
      for (const s of reassess) {
        if (
          s.mastery_achieved === true &&
          s.completed_at &&
          (s.completed_at as string) >= weekAgo
        ) {
          masteredThisWeek.add(`${s.student_id as string}:${s.standard_id as string}`);
        }
      }
      const standardsMasteredThisWeek = masteredThisWeek.size;

      // ── Metric 4: Avg Time Per Session ────────────────────────────────────
      const times = (timeRes.data ?? []).map(
        (s) => s.time_spent_seconds as number,
      );
      const avgTimePerSession =
        times.length > 0
          ? Math.round(
              (times.reduce((a, b) => a + b, 0) / times.length / 60) * 10,
            ) / 10
          : null;

      setMetrics({
        totalSessionsCompleted,
        studentsCurrentlyActive,
        masteryRate,
        avgTimePerSession,
        studentsAtRisk,
        standardsMasteredThisWeek,
      });
      setLoading(false);
    }

    fetchMetrics();
  }, []);

  // ── Loading skeletons ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        <MetricSkeleton isHero />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
    );
  }

  const m = metrics!;

  // Derived display values
  const masteryRateStr =
    m.masteryRate !== null ? `${m.masteryRate}%` : '—';
  const masteryRateColor =
    m.masteryRate === null
      ? 'text-[#4B5563]'
      : m.masteryRate >= 80
      ? 'text-[#1D9E75]'
      : m.masteryRate >= 50
      ? 'text-amber-400'
      : 'text-rose-400';

  const avgTimeStr =
    m.avgTimePerSession !== null ? `${m.avgTimePerSession} min` : '—';

  const atRiskAlert = (m.studentsAtRisk ?? 0) > 0;

  const activeColor =
    (m.studentsCurrentlyActive ?? 0) > 0 ? 'text-[#1D9E75]' : 'text-[#94A3B8]';

  const weeklyColor =
    (m.standardsMasteredThisWeek ?? 0) > 0 ? 'text-[#1D9E75]' : 'text-[#94A3B8]';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">

      {/* 1 — Total Sessions Completed (hero) */}
      <MetricCard
        id="metric-sessions"
        label="Sessions Completed"
        value={fmt(m.totalSessionsCompleted, '', '0')}
        subValue="all-time completed sessions"
        valueColor="text-[#1D9E75]"
        icon={CheckSquare}
        isHero
        isAlert={false}
        detail="Across all standards and students"
      />

      {/* 2 — Students Currently Active */}
      <MetricCard
        id="metric-active"
        label="Students Active Now"
        value={fmt(m.studentsCurrentlyActive, '', '0')}
        subValue="in session right now"
        valueColor={activeColor}
        icon={Users}
        isAlert={false}
        detail="Started within the last 30 minutes"
      />

      {/* 3 — Mastery Rate */}
      <MetricCard
        id="metric-mastery"
        label="Mastery Rate"
        value={masteryRateStr}
        subValue="reassessment pass rate"
        valueColor={masteryRateColor}
        icon={Award}
        isAlert={false}
        detail={m.masteryRate === null ? 'No reassessments yet' : 'Across all completed reassessments'}
      />

      {/* 4 — Avg Time Per Session */}
      <MetricCard
        id="metric-time"
        label="Avg Time Per Session"
        value={avgTimeStr}
        subValue="per completed session"
        valueColor="text-white"
        icon={Clock}
        isAlert={false}
        detail="Completed sessions only"
      />

      {/* 5 — Students At Risk */}
      <MetricCard
        id="metric-atrisk"
        label="Students At Risk"
        value={fmt(m.studentsAtRisk, '', '0')}
        subValue="failed reassessment, not yet mastered"
        valueColor="text-amber-400"
        icon={AlertTriangle}
        isAlert={atRiskAlert}
        detail={atRiskAlert ? 'Review and reassign teach phase' : 'No students currently at risk'}
      />

      {/* 6 — Standards Mastered This Week */}
      <MetricCard
        id="metric-weekly"
        label="Mastered This Week"
        value={fmt(m.standardsMasteredThisWeek, '', '0')}
        subValue="new masteries in last 7 days"
        valueColor={weeklyColor}
        icon={Star}
        isAlert={false}
        detail="Student + standard combinations"
      />

    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  id: string;
  label: string;
  value: string;
  subValue: string;
  valueColor: string;
  icon: React.ElementType;
  isHero?: boolean;
  isAlert: boolean;
  detail: string;
}

function MetricCard({
  label,
  value,
  subValue,
  valueColor,
  icon: Icon,
  isHero = false,
  isAlert,
  detail,
}: MetricCardProps) {
  return (
    <div
      className={`bg-white/[0.06] border ${
        isAlert
          ? 'border-amber-500/30 ring-1 ring-amber-500/20'
          : 'border-white/[0.08]'
      } rounded-2xl p-4 flex flex-col gap-3 ${
        isHero ? 'xl:col-span-2 2xl:col-span-2' : ''
      } hover:bg-white/[0.08] transition-colors duration-200`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-[#94A3B8]">
          <Icon size={20} />
        </div>
        {isAlert && (
          <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">
            Alert
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide leading-tight">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold tabular-nums ${valueColor}`}>
            {value}
          </span>
          {isHero && (
            <span className="text-sm text-[#94A3B8] font-medium">{subValue}</span>
          )}
        </div>
        {!isHero && (
          <p className="text-xs text-[#4B5563]">{subValue}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-white/[0.06]">
        <span className="text-xs text-[#4B5563] truncate">{detail}</span>
      </div>
    </div>
  );
}
