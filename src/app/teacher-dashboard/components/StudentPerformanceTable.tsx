'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  MessageSquare,
  Flag,
  Filter,
  Download,
  X,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface DbStudent {
  id: string;
  teacher_id: string;
  full_name: string;
  grade_level: string;
  fast_pm1_score: number | null;
  fast_pm2_score: number | null;
  created_at: string;
}

type Status = 'exceeding' | 'on-track' | 'at-risk' | 'needs-support' | 'no-data';

function deriveStatus(pm1: number | null, pm2: number | null): Status {
  const score = pm2 ?? pm1;
  if (score === null) return 'no-data';
  if (score >= 80) return 'exceeding';
  if (score >= 70) return 'on-track';
  if (score >= 50) return 'at-risk';
  return 'needs-support';
}

type SortKey = keyof DbStudent | 'status';
type SortDir = 'asc' | 'desc' | null;

const STATUS_STYLES: Record<Status, string> = {
  'exceeding': 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30',
  'on-track': 'bg-[#1D9E75]/10 text-[#1D9E75]/80 border border-[#1D9E75]/20',
  'at-risk': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'needs-support': 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  'no-data': 'bg-white/[0.06] text-[#4B5563] border border-white/[0.08]',
};

const STATUS_LABELS: Record<Status, string> = {
  'exceeding': 'Exceeding',
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  'needs-support': 'Needs Support',
  'no-data': 'No Data',
};

const ScoreBar = ({ value, max = 100, color }: { value: number; max?: number; color: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex-shrink-0">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
    <span className="text-xs font-mono tabular-nums text-[#94A3B8] w-8">{value}</span>
  </div>
);

export default function StudentPerformanceTable() {
  const router = useRouter();
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError('Could not authenticate user.');
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('students')
        .select('id, teacher_id, full_name, grade_level, fast_pm1_score, fast_pm2_score, created_at')
        .eq('teacher_id', user.id)
        .order('full_name', { ascending: true });

      if (queryError) {
        setError(queryError.message);
      } else {
        setStudents(data ?? []);
      }
      setLoading(false);
    }

    fetchStudents();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let data = [...students];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter((s) => s.full_name.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      data = data.filter((s) => deriveStatus(s.fast_pm1_score, s.fast_pm2_score) === statusFilter);
    }

    if (sortKey && sortDir) {
      data.sort((a, b) => {
        let av: string | number | null;
        let bv: string | number | null;

        if (sortKey === 'status') {
          av = deriveStatus(a.fast_pm1_score, a.fast_pm2_score);
          bv = deriveStatus(b.fast_pm1_score, b.fast_pm2_score);
        } else {
          av = a[sortKey as keyof DbStudent] as string | number | null;
          bv = b[sortKey as keyof DbStudent] as string | number | null;
        }

        if (av === null) return 1;
        if (bv === null) return -1;
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return data;
  }, [students, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginated.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginated.map((s) => s.id));
    }
  };

  const handleBulkAction = (action: string) => {
    toast.success(`${action} applied to ${selectedIds.length} student${selectedIds.length > 1 ? 's' : ''}`);
    setSelectedIds([]);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error('Could not authenticate. Please refresh and try again.');
        setExporting(false);
        return;
      }

      // Fetch all teacher's students
      const { data: studentRows } = await supabase
        .from('students')
        .select('id, full_name, grade_level, fast_pm1_score, fast_pm2_score')
        .eq('teacher_id', user.id)
        .order('full_name', { ascending: true });

      const allStudents = studentRows ?? [];

      if (allStudents.length === 0) {
        toast.info('No students to export yet.');
        setExporting(false);
        return;
      }

      const studentIds = allStudents.map((s) => s.id as string);

      // Fetch pilot standards, all sessions, all responses in parallel
      const [standardsRes, sessionsRes, responsesRes] = await Promise.all([
        supabase
          .from('standards')
          .select('id, code, title')
          .in('code', ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'])
          .order('code', { ascending: true }),
        supabase
          .from('sessions')
          .select('id, student_id, standard_id, phase, mastery_achieved, completed_at, time_spent_seconds')
          .in('student_id', studentIds),
        supabase
          .from('responses')
          .select('student_id, standard_id, diagnostic_classification, intervention_type, teacher_override')
          .in('student_id', studentIds),
      ]);

      const standards = standardsRes.data ?? [];
      const sessions = sessionsRes.data ?? [];
      const responses = responsesRes.data ?? [];

      // ── Build CSV ────────────────────────────────────────────────────────
      // Escape a single cell value: wrap in quotes if it contains comma, quote, or newline
      const esc = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const HEADERS = [
        'student_name',
        'student_grade',
        'standard_code',
        'standard_name',
        'diagnostic_classification',
        'protocol_assigned',
        'diagnostic_complete',
        'teach_complete',
        'practice_complete',
        'reassess_complete',
        'mastery_achieved',
        'teacher_override',
        'fast_pm1_score',
        'fast_pm2_score',
        'total_time_minutes',
      ];

      const rows: string[] = [HEADERS.join(',')];

      for (const student of allStudents) {
        for (const standard of standards) {
          const sid = student.id as string;
          const stid = standard.id as string;

          const studentSessions = sessions.filter(
            (s) => s.student_id === sid && s.standard_id === stid,
          );
          const studentResponses = responses.filter(
            (r) => r.student_id === sid && r.standard_id === stid,
          );

          const phaseComplete = (phase: string) =>
            studentSessions.some((s) => s.phase === phase && s.completed_at)
              ? 'yes'
              : 'no';

          const diagnosticClassification =
            studentResponses.find(
              (r) => r.diagnostic_classification && (r.diagnostic_classification as string).length > 0,
            )?.diagnostic_classification ?? '';

          const protocolAssigned =
            studentResponses.find(
              (r) => r.intervention_type && (r.intervention_type as string).length > 0,
            )?.intervention_type ?? '';

          const hasTeacherOverride = studentResponses.some(
            (r) => r.teacher_override === true,
          );

          const reassessSession = studentSessions
            .filter((s) => s.phase === 'reassess' && s.completed_at)
            .slice(-1)[0];

          const masteryAchieved =
            hasTeacherOverride
              ? 'yes (override)'
              : reassessSession?.mastery_achieved === true
              ? 'yes'
              : reassessSession?.mastery_achieved === false
              ? 'no'
              : '';

          const totalSeconds = studentSessions.reduce(
            (sum, s) => sum + ((s.time_spent_seconds as number | null) ?? 0),
            0,
          );
          const totalMinutes = totalSeconds > 0
            ? (Math.round(totalSeconds / 60 * 10) / 10).toFixed(1)
            : '';

          const row = [
            esc(student.full_name as string),
            esc(student.grade_level as string | null),
            esc(standard.code as string),
            esc(standard.title as string),
            esc(diagnosticClassification as string),
            esc(protocolAssigned as string),
            phaseComplete('diagnostic'),
            phaseComplete('teach'),
            phaseComplete('practice'),
            phaseComplete('reassess'),
            esc(masteryAchieved),
            hasTeacherOverride ? 'yes' : 'no',
            esc(student.fast_pm1_score as number | null),
            esc(student.fast_pm2_score as number | null),
            esc(totalMinutes),
          ].join(',');

          rows.push(row);
        }
      }

      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gogi-student-data-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Export] Failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="text-[#4B5563]" />;
    if (sortDir === 'asc') return <ChevronUp size={13} className="text-[#1D9E75]" />;
    if (sortDir === 'desc') return <ChevronDown size={13} className="text-[#1D9E75]" />;
    return <ChevronsUpDown size={13} className="text-[#4B5563]" />;
  };

  return (
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Table header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Student Performance</h3>
            <p className="text-xs text-[#4B5563] mt-0.5">{filtered.length} students</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8] hover:text-white bg-white/[0.06] hover:bg-white/[0.09] px-3 py-2 rounded-xl transition-colors border border-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search students…"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/50 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-[#4B5563]">
              <Filter size={12} /> Status:
            </span>
            {(['all', 'exceeding', 'on-track', 'at-risk', 'needs-support'] as const).map((s) => (
              <button
                key={`filter-${s}`}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  statusFilter === s
                    ? 'bg-[#1D9E75] text-white'
                    : 'bg-white/[0.06] text-[#94A3B8] hover:bg-white/[0.09] border border-white/[0.08]'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#1D9E75]/20 border-b border-[#1D9E75]/30 px-5 py-3 flex items-center justify-between gap-4 slide-up">
          <span className="text-[#1D9E75] text-sm font-semibold">
            {selectedIds.length} student{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('Message sent')}
              className="flex items-center gap-1.5 bg-white/[0.09] hover:bg-white/[0.12] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              <MessageSquare size={13} /> Message
            </button>
            <button
              onClick={() => handleBulkAction('Flagged for review')}
              className="flex items-center gap-1.5 bg-white/[0.09] hover:bg-white/[0.12] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              <Flag size={13} /> Flag
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 hover:bg-white/[0.09] rounded-xl text-[#94A3B8] hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-[#4B5563]">
          <Loader2 size={20} className="animate-spin text-[#1D9E75]" />
          <span className="text-sm">Loading students…</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-base font-semibold text-rose-400">Failed to load students</p>
          <p className="text-sm text-[#4B5563] mt-1">{error}</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/[0.08]">
                <th className="w-10 px-4 py-3">
                  <button onClick={toggleSelectAll} className="text-[#4B5563] hover:text-[#1D9E75] transition-colors">
                    {selectedIds.length === paginated.length && paginated.length > 0 ? (
                      <CheckSquare size={16} className="text-[#1D9E75]" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                {[
                  { key: 'full_name' as SortKey, label: 'Student' },
                  { key: 'grade_level' as SortKey, label: 'Grade' },
                  { key: 'fast_pm1_score' as SortKey, label: 'FAST PM1' },
                  { key: 'fast_pm2_score' as SortKey, label: 'FAST PM2' },
                  { key: 'status' as SortKey, label: 'Status' },
                ].map((col) => (
                  <th
                    key={`th-${col.key}`}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wide cursor-pointer hover:text-[#94A3B8] transition-colors whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#4B5563] uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {paginated.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                const status = deriveStatus(student.fast_pm1_score, student.fast_pm2_score);
                return (
                  <tr
                    key={student.id}
                    className={`group transition-colors duration-100 ${
                      isSelected ? 'bg-[#1D9E75]/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelect(student.id)}
                        className="text-[#4B5563] hover:text-[#1D9E75] transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-[#1D9E75]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1D9E75]/20 border border-[#1D9E75]/30 flex items-center justify-center text-[#1D9E75] text-xs font-bold flex-shrink-0">
                          {student.full_name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-white whitespace-nowrap">{student.full_name}</span>
                      </div>
                    </td>

                    {/* Grade */}
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-[#94A3B8]">{student.grade_level ?? '—'}</span>
                    </td>

                    {/* FAST PM1 */}
                    <td className="px-3 py-3">
                      {student.fast_pm1_score !== null ? (
                        <ScoreBar
                          value={student.fast_pm1_score}
                          color={
                            student.fast_pm1_score >= 80 ? 'bg-[#1D9E75]' :
                            student.fast_pm1_score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          }
                        />
                      ) : (
                        <span className="text-xs text-[#4B5563]">—</span>
                      )}
                    </td>

                    {/* FAST PM2 */}
                    <td className="px-3 py-3">
                      {student.fast_pm2_score !== null ? (
                        <ScoreBar
                          value={student.fast_pm2_score}
                          color={
                            student.fast_pm2_score >= 80 ? 'bg-[#1D9E75]' :
                            student.fast_pm2_score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          }
                        />
                      ) : (
                        <span className="text-xs text-[#4B5563]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <span className={`badge ${STATUS_STYLES[status]} text-xs whitespace-nowrap`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => router.push(`/teacher-dashboard/students/${student.id}`)}
                          className="p-1.5 rounded-lg hover:bg-[#1D9E75]/20 text-[#4B5563] hover:text-[#1D9E75] transition-colors"
                          title="View student profile"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => toast.success(`Message sent to ${student.full_name}`)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.09] text-[#4B5563] hover:text-[#94A3B8] transition-colors"
                          title="Message student"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => toast.info(`${student.full_name} flagged for intervention`)}
                          className="p-1.5 rounded-lg hover:bg-amber-500/20 text-[#4B5563] hover:text-amber-400 transition-colors"
                          title="Flag for intervention"
                        >
                          <Flag size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && students.length > 0 && (
            <div className="text-center py-16">
              <p className="text-base font-semibold text-white">No students match your search</p>
              <p className="text-sm text-[#4B5563] mt-1">Try adjusting the search or status filter.</p>
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="mt-3 text-sm text-[#1D9E75] font-semibold hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {students.length === 0 && (
            <div className="text-center py-16">
              <p className="text-base font-semibold text-white">No students yet</p>
              <p className="text-sm text-[#4B5563] mt-1">Students assigned to you will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <div className="px-5 py-4 border-t border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-[#4B5563]">
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-sm text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/50"
            >
              {[5, 10, 20].map((n) => (
                <option key={`per-page-${n}`} value={n}>{n}</option>
              ))}
            </select>
            <span>of {filtered.length} students</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-[#94A3B8] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={`page-${p}`}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  page === p
                    ? 'bg-[#1D9E75] text-white'
                    : 'text-[#94A3B8] hover:bg-white/[0.06]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-[#94A3B8] hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
