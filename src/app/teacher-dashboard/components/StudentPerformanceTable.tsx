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
  'exceeding': 'bg-violet-100 text-violet-700',
  'on-track': 'bg-emerald-100 text-emerald-700',
  'at-risk': 'bg-amber-100 text-amber-700',
  'needs-support': 'bg-rose-100 text-rose-600',
  'no-data': 'bg-slate-100 text-slate-500',
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
    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
    <span className="text-xs font-mono tabular-nums text-slate-700 w-8">{value}</span>
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

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="text-slate-300" />;
    if (sortDir === 'asc') return <ChevronUp size={13} className="text-violet-600" />;
    if (sortDir === 'desc') return <ChevronDown size={13} className="text-violet-600" />;
    return <ChevronsUpDown size={13} className="text-slate-300" />;
  };

  return (
    <div className="card overflow-hidden">
      {/* Table header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Student Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} students</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.success('Export started — CSV will download shortly')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search students…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Filter size={12} /> Status:
            </span>
            {(['all', 'exceeding', 'on-track', 'at-risk', 'needs-support'] as const).map((s) => (
              <button
                key={`filter-${s}`}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  statusFilter === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
        <div className="bg-violet-600 px-5 py-3 flex items-center justify-between gap-4 slide-up">
          <span className="text-white text-sm font-semibold">
            {selectedIds.length} student{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('Message sent')}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              <MessageSquare size={13} /> Message
            </button>
            <button
              onClick={() => handleBulkAction('Flagged for review')}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              <Flag size={13} /> Flag
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 hover:bg-white/20 rounded-xl text-white/70 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading students…</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-base font-semibold text-rose-600">Failed to load students</p>
          <p className="text-sm text-slate-400 mt-1">{error}</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="w-10 px-4 py-3">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-violet-600 transition-colors">
                    {selectedIds.length === paginated.length && paginated.length > 0 ? (
                      <CheckSquare size={16} className="text-violet-600" />
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
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 transition-colors whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                const status = deriveStatus(student.fast_pm1_score, student.fast_pm2_score);
                return (
                  <tr
                    key={student.id}
                    className={`group transition-colors duration-100 ${
                      isSelected ? 'bg-violet-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelect(student.id)}
                        className="text-slate-300 hover:text-violet-600 transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-violet-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {student.full_name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-slate-800 whitespace-nowrap">{student.full_name}</span>
                      </div>
                    </td>

                    {/* Grade */}
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-slate-700">{student.grade_level ?? '—'}</span>
                    </td>

                    {/* FAST PM1 */}
                    <td className="px-3 py-3">
                      {student.fast_pm1_score !== null ? (
                        <ScoreBar
                          value={student.fast_pm1_score}
                          color={
                            student.fast_pm1_score >= 80 ? 'bg-emerald-500' :
                            student.fast_pm1_score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          }
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* FAST PM2 */}
                    <td className="px-3 py-3">
                      {student.fast_pm2_score !== null ? (
                        <ScoreBar
                          value={student.fast_pm2_score}
                          color={
                            student.fast_pm2_score >= 80 ? 'bg-emerald-500' :
                            student.fast_pm2_score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          }
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
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
                          onClick={() => router.push('/student-reading-task-screen')}
                          className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
                          title="View student work"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => toast.success(`Message sent to ${student.full_name}`)}
                          className="p-1.5 rounded-lg hover:bg-sky-100 text-slate-400 hover:text-sky-600 transition-colors"
                          title="Message student"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => toast.info(`${student.full_name} flagged for intervention`)}
                          className="p-1.5 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors"
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
              <span className="text-4xl block mb-3">🔍</span>
              <p className="text-base font-semibold text-slate-700">No students match your search</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting the search or status filter.</p>
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); }}
                className="mt-3 text-sm text-violet-600 font-semibold hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {students.length === 0 && (
            <div className="text-center py-16">
              <p className="text-base font-semibold text-slate-700">No students yet</p>
              <p className="text-sm text-slate-400 mt-1">Students assigned to you will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
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
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={`page-${p}`}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  page === p
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
