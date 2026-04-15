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
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2'],
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
    standards: ['ELA.9.R.2.1'],
    lexile: '1020L',
  },
];

const STATUS_STYLES = {
  active: 'bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30',
  draft: 'bg-white/[0.06] text-[#94A3B8] border border-white/[0.08]',
  closed: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
};

export default function ActiveAssignmentPanel() {
  const router = useRouter();

  return (
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#1D9E75]" />
          <h3 className="text-sm font-bold text-white">Assignments</h3>
        </div>
        <button
          onClick={() => toast.info('Assignment builder coming soon')}
          className="flex items-center gap-1 text-xs text-[#1D9E75] hover:text-[#17825F] font-semibold transition-colors bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 px-2.5 py-1.5 rounded-lg"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {ACTIVE_ASSIGNMENTS.map((assign) => (
          <div
            key={assign.id}
            className="border border-white/[0.08] rounded-xl p-3 hover:border-[#1D9E75]/40 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer group"
            onClick={() => router.push('/student-reading-task-screen')}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{assign.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-[#4B5563]">{assign.type}</span>
                  <span className="text-[#4B5563]">·</span>
                  <span className="badge bg-white/[0.06] text-[#94A3B8] border border-white/[0.08] text-xs font-mono">{assign.lexile}</span>
                </div>
              </div>
              <span className={`badge ${STATUS_STYLES[assign.status]} text-xs capitalize flex-shrink-0`}>
                {assign.status}
              </span>
            </div>

            {assign.status === 'active' && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#4B5563] flex items-center gap-1">
                    <Users size={11} /> {assign.submittedCount}/{assign.totalStudents} submitted
                  </span>
                  <span className="text-xs font-bold text-[#94A3B8] tabular-nums">{assign.completionRate}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1D9E75] rounded-full transition-all duration-500"
                    style={{ width: `${assign.completionRate}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-[#4B5563]">
                <Clock size={11} /> Due {assign.dueDate}
              </span>
              <ChevronRight size={14} className="text-[#4B5563] group-hover:text-[#1D9E75] transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
