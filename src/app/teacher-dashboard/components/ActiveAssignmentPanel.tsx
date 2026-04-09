'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, Users, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';

const ACTIVE_ASSIGNMENTS = [
  {
    id: 'assign-001',
    title: 'The River and the Stone',
    type: 'Literary Nonfiction',
    dueDate: 'Apr 8, 2026',
    completionRate: 74,
    totalStudents: 31,
    submittedCount: 23,
    status: 'active' as const,
    standards: ['ELA.8.R.1.1', 'ELA.8.R.1.3'],
    lexile: '940L',
  },
  {
    id: 'assign-002',
    title: 'The Everglades: A River of Grass',
    type: 'Informational Text',
    dueDate: 'Apr 12, 2026',
    completionRate: 0,
    totalStudents: 31,
    submittedCount: 0,
    status: 'draft' as const,
    standards: ['ELA.8.R.2.1', 'ELA.8.C.1.2'],
    lexile: '1020L',
  },
];

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-slate-100 text-slate-600',
  closed: 'bg-rose-100 text-rose-700',
};

export default function ActiveAssignmentPanel() {
  const router = useRouter();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-900">Assignments</h3>
        </div>
        <button
          onClick={() => toast.info('Assignment builder coming soon')}
          className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {ACTIVE_ASSIGNMENTS.map((assign) => (
          <div
            key={assign.id}
            className="border border-slate-200 rounded-xl p-3 hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-150 cursor-pointer group"
            onClick={() => router.push('/student-reading-task-screen')}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{assign.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-slate-500">{assign.type}</span>
                  <span className="text-slate-300">·</span>
                  <span className="badge bg-violet-100 text-violet-600 text-xs font-mono">{assign.lexile}</span>
                </div>
              </div>
              <span className={`badge ${STATUS_STYLES[assign.status]} text-xs capitalize flex-shrink-0`}>
                {assign.status}
              </span>
            </div>

            {assign.status === 'active' && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Users size={11} /> {assign.submittedCount}/{assign.totalStudents} submitted
                  </span>
                  <span className="text-xs font-bold text-slate-700 tabular-nums">{assign.completionRate}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${assign.completionRate}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock size={11} /> Due {assign.dueDate}
              </span>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}