'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';

type WelcomeTeacherRow = {
  studentId: string;
  fullName: string;
  hasProfile: boolean;
  strength: {
    strengthLabel: string;
    gloss: string;
  };
  weaknessLabel: string;
  trajectory?: {
    delta?: number;
    variant: string;
  } | null;
  pointsToNextRung: number | null;
  nextRungTarget: number | null;
};

type SortMode = 'trajectory' | 'points' | 'last_name';

export default function TeacherWelcomeCardsPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [rows, setRows] = useState<WelcomeTeacherRow[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('trajectory');
  const [weaknessFilter, setWeaknessFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (role === 'student') {
      router.push('/dashboard/student');
      return;
    }

    async function load() {
      const response = await fetch(`/api/welcome/teacher/${user!.id}`);
      const body = (await response.json()) as { students?: WelcomeTeacherRow[]; error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Could not load Welcome cards.');
        return;
      }
      setRows(body.students ?? []);
    }

    load();
  }, [loading, role, router, user]);

  const weaknessOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.weaknessLabel))).sort();
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered =
      weaknessFilter === 'all' ? rows : rows.filter((row) => row.weaknessLabel === weaknessFilter);

    return [...filtered].sort((a, b) => {
      if (sortMode === 'points') {
        return (a.pointsToNextRung ?? 999) - (b.pointsToNextRung ?? 999);
      }
      if (sortMode === 'last_name') {
        const aLast = a.fullName.trim().split(/\s+/).slice(-1)[0] ?? a.fullName;
        const bLast = b.fullName.trim().split(/\s+/).slice(-1)[0] ?? b.fullName;
        return aLast.localeCompare(bLast);
      }
      return (b.trajectory?.delta ?? -999) - (a.trajectory?.delta ?? -999);
    });
  }, [rows, sortMode, weaknessFilter]);

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#111827]">
      <TeacherDashboardTopBar active="welcome" />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
              Welcome Cards
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Class reading profiles</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
            >
              <option value="trajectory">Sort by trajectory</option>
              <option value="points">Sort by next rung</option>
              <option value="last_name">Sort by last name</option>
            </select>
            <select
              value={weaknessFilter}
              onChange={(event) => setWeaknessFilter(event.target.value)}
              className="rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
            >
              <option value="all">All signals</option>
              {weaknessOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {visibleRows.map((row) => (
            <button
              key={row.studentId}
              type="button"
              onClick={() => router.push(`/teacher-dashboard/students/${row.studentId}/fast`)}
              className="w-full rounded-lg border border-[#D0D5DD] bg-white p-4 text-left shadow-sm transition hover:border-[#2E75B6]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-[#111827]">{row.fullName}</p>
                  <p className="mt-1 text-sm text-[#475467]">
                    {row.hasProfile
                      ? `Top-tier ${row.strength.strengthLabel} · ${row.weaknessLabel}`
                      : 'No FAST profile yet'}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-[#1D4ED8]">
                    {row.trajectory?.delta
                      ? `↑ +${row.trajectory.delta} pts`
                      : row.hasProfile
                        ? 'Starting line'
                        : 'Upload FAST'}
                  </p>
                  <p className="mt-1 text-[#667085]">
                    {row.pointsToNextRung === null || row.pointsToNextRung === undefined
                      ? 'Next rung pending'
                      : `→ ${row.nextRungTarget} (${row.pointsToNextRung} pts)`}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
