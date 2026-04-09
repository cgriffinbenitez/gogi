'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  lexile: string;
  lexileChange: number;
  comprehension: number;
  effortIndex: number;
  tasksCompleted: number;
  totalTasks: number;
  standardsMet: number;
  totalStandards: number;
  aiDependency: number;
  lastActive: string;
  status: 'on-track' | 'at-risk' | 'needs-support' | 'exceeding';
  evidenceQuality: number;
}

const STUDENTS: Student[] = [
  { id: 'stu-001', name: 'Marcus Johnson', lexile: '960L', lexileChange: 40, comprehension: 82, effortIndex: 88, tasksCompleted: 3, totalTasks: 3, standardsMet: 14, totalStandards: 18, aiDependency: 1.2, lastActive: '14 min ago', status: 'on-track', evidenceQuality: 78 },
  { id: 'stu-002', name: 'Aaliyah Torres', lexile: '820L', lexileChange: -10, comprehension: 51, effortIndex: 44, tasksCompleted: 0, totalTasks: 3, standardsMet: 7, totalStandards: 18, aiDependency: 0, lastActive: '52 min ago', status: 'at-risk', evidenceQuality: 30 },
  { id: 'stu-003', name: 'Darius Washington', lexile: '780L', lexileChange: -30, comprehension: 38, effortIndex: 52, tasksCompleted: 1, totalTasks: 3, standardsMet: 5, totalStandards: 18, aiDependency: 5.8, lastActive: '8 min ago', status: 'needs-support', evidenceQuality: 22 },
  { id: 'stu-004', name: 'Priya Nair', lexile: '1080L', lexileChange: 80, comprehension: 94, effortIndex: 97, tasksCompleted: 3, totalTasks: 3, standardsMet: 17, totalStandards: 18, aiDependency: 0.4, lastActive: '3 min ago', status: 'exceeding', evidenceQuality: 95 },
  { id: 'stu-005', name: 'Kevin Nguyen', lexile: '890L', lexileChange: 20, comprehension: 67, effortIndex: 61, tasksCompleted: 2, totalTasks: 3, standardsMet: 10, totalStandards: 18, aiDependency: 6.2, lastActive: '22 min ago', status: 'at-risk', evidenceQuality: 48 },
  { id: 'stu-006', name: 'Brianna Mitchell', lexile: '810L', lexileChange: -20, comprehension: 44, effortIndex: 58, tasksCompleted: 2, totalTasks: 3, standardsMet: 6, totalStandards: 18, aiDependency: 4.1, lastActive: '1 hr ago', status: 'needs-support', evidenceQuality: 22 },
  { id: 'stu-007', name: 'Jordan Rivera', lexile: '970L', lexileChange: 50, comprehension: 79, effortIndex: 84, tasksCompleted: 3, totalTasks: 3, standardsMet: 13, totalStandards: 18, aiDependency: 1.8, lastActive: '18 min ago', status: 'on-track', evidenceQuality: 72 },
  { id: 'stu-008', name: 'Destiny Freeman', lexile: '1020L', lexileChange: 60, comprehension: 88, effortIndex: 91, tasksCompleted: 3, totalTasks: 3, standardsMet: 15, totalStandards: 18, aiDependency: 0.9, lastActive: '5 min ago', status: 'exceeding', evidenceQuality: 89 },
  { id: 'stu-009', name: 'Tyler Okonkwo', lexile: '850L', lexileChange: 10, comprehension: 63, effortIndex: 70, tasksCompleted: 2, totalTasks: 3, standardsMet: 9, totalStandards: 18, aiDependency: 3.0, lastActive: '35 min ago', status: 'on-track', evidenceQuality: 55 },
  { id: 'stu-010', name: 'Sofia Mendez', lexile: '930L', lexileChange: 30, comprehension: 76, effortIndex: 79, tasksCompleted: 3, totalTasks: 3, standardsMet: 12, totalStandards: 18, aiDependency: 2.1, lastActive: '11 min ago', status: 'on-track', evidenceQuality: 68 },
  { id: 'stu-011', name: 'Elijah Carter', lexile: '760L', lexileChange: -40, comprehension: 42, effortIndex: 48, tasksCompleted: 1, totalTasks: 3, standardsMet: 5, totalStandards: 18, aiDependency: 7.0, lastActive: '2 hr ago', status: 'needs-support', evidenceQuality: 28 },
  { id: 'stu-012', name: 'Imani Brooks', lexile: '1000L', lexileChange: 70, comprehension: 91, effortIndex: 93, tasksCompleted: 3, totalTasks: 3, standardsMet: 16, totalStandards: 18, aiDependency: 0.6, lastActive: '7 min ago', status: 'exceeding', evidenceQuality: 92 },
];

type SortKey = keyof Student;
type SortDir = 'asc' | 'desc' | null;

const STATUS_STYLES: Record<Student['status'], string> = {
  'on-track': 'bg-emerald-100 text-emerald-700',
  'at-risk': 'bg-amber-100 text-amber-700',
  'needs-support': 'bg-rose-100 text-rose-600',
  'exceeding': 'bg-violet-100 text-violet-700',
};

const STATUS_LABELS: Record<Student['status'], string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  'needs-support': 'Needs Support',
  'exceeding': 'Exceeding',
};

const ScoreBar = ({ value, max = 100, color }: { value: number; max?: number; color: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
    <span className="text-xs font-mono tabular-nums text-slate-700 w-8">{value}%</span>
  </div>
);

export default function StudentPerformanceTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Student['status'] | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let data = [...STUDENTS];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter((s) => s.name.toLowerCase().includes(q) || s.status.includes(q));
    }
    if (statusFilter !== 'all') {
      data = data.filter((s) => s.status === statusFilter);
    }
    if (sortKey && sortDir) {
      data.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [search, statusFilter, sortKey, sortDir]);

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
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} students · Period 3</p>
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
            {(['all', 'on-track', 'at-risk', 'needs-support', 'exceeding'] as const).map((s) => (
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

      {/* Table */}
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
                { key: 'name' as SortKey, label: 'Student' },
                { key: 'lexile' as SortKey, label: 'Lexile' },
                { key: 'comprehension' as SortKey, label: 'Comprehension' },
                { key: 'effortIndex' as SortKey, label: 'Effort Index' },
                { key: 'tasksCompleted' as SortKey, label: 'Tasks Done' },
                { key: 'standardsMet' as SortKey, label: 'Standards Met' },
                { key: 'evidenceQuality' as SortKey, label: 'Evidence Quality' },
                { key: 'aiDependency' as SortKey, label: 'AI Dependency' },
                { key: 'lastActive' as SortKey, label: 'Last Active' },
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
                        {student.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <span className="font-semibold text-slate-800 whitespace-nowrap">{student.name}</span>
                    </div>
                  </td>

                  {/* Lexile */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-slate-700">{student.lexile}</span>
                      <span className={`text-xs font-semibold ${
                        student.lexileChange > 0 ? 'text-emerald-600' : student.lexileChange < 0 ? 'text-rose-500' : 'text-slate-400'
                      }`}>
                        {student.lexileChange > 0 ? `+${student.lexileChange}` : student.lexileChange}
                      </span>
                    </div>
                  </td>

                  {/* Comprehension */}
                  <td className="px-3 py-3">
                    <ScoreBar
                      value={student.comprehension}
                      color={student.comprehension >= 75 ? 'bg-emerald-500' : student.comprehension >= 55 ? 'bg-amber-400' : 'bg-rose-500'}
                    />
                  </td>

                  {/* Effort Index */}
                  <td className="px-3 py-3">
                    <ScoreBar
                      value={student.effortIndex}
                      color={student.effortIndex >= 75 ? 'bg-sky-500' : student.effortIndex >= 55 ? 'bg-amber-400' : 'bg-rose-400'}
                    />
                  </td>

                  {/* Tasks Done */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3].map((t) => (
                        <div
                          key={`task-dot-${student.id}-${t}`}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            t <= student.tasksCompleted
                              ? 'bg-violet-600 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Standards Met */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                      {student.standardsMet}
                      <span className="text-slate-400 font-normal">/{student.totalStandards}</span>
                    </span>
                  </td>

                  {/* Evidence Quality */}
                  <td className="px-3 py-3">
                    <ScoreBar
                      value={student.evidenceQuality}
                      color={student.evidenceQuality >= 70 ? 'bg-emerald-500' : student.evidenceQuality >= 50 ? 'bg-amber-400' : 'bg-rose-500'}
                    />
                  </td>

                  {/* AI Dependency */}
                  <td className="px-3 py-3">
                    <span className={`font-mono text-xs font-semibold tabular-nums ${
                      student.aiDependency <= 2 ? 'text-emerald-600' :
                      student.aiDependency <= 4 ? 'text-amber-600': 'text-rose-600'
                    }`}>
                      {student.aiDependency.toFixed(1)} hints
                    </span>
                  </td>

                  {/* Last Active */}
                  <td className="px-3 py-3">
                    <span className="text-xs text-slate-500 whitespace-nowrap">{student.lastActive}</span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3">
                    <span className={`badge ${STATUS_STYLES[student.status]} text-xs whitespace-nowrap`}>
                      {STATUS_LABELS[student.status]}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => router.push('/student-reading-task-screen')}
                        className="p-1.5 rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors relative group/tooltip"
                        title="View student work"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => toast.success(`Message sent to ${student.name}`)}
                        className="p-1.5 rounded-lg hover:bg-sky-100 text-slate-400 hover:text-sky-600 transition-colors"
                        title="Message student"
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        onClick={() => toast.info(`${student.name} flagged for intervention`)}
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

        {filtered.length === 0 && (
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
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
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