'use client';

import React, { useState } from 'react';
import { Search, Bell, ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TeacherTopbarProps {
  selectedClass: string;
  onClassChange: (c: string) => void;
  sidebarCollapsed: boolean;
}

const CLASS_OPTIONS = [
  { id: 'period-1', label: 'Period 1 — 8th ELA (28 students)' },
  { id: 'period-3', label: 'Period 3 — 8th ELA (31 students)' },
  { id: 'period-5', label: 'Period 5 — 7th ELA (26 students)' },
  { id: 'period-6', label: 'Period 6 — 8th ELA Advanced (24 students)' },
];

export default function TeacherTopbar({ selectedClass, onClassChange }: TeacherTopbarProps) {
  const [searchValue, setSearchValue] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  const selectedLabel = CLASS_OPTIONS.find((c) => c.id === selectedClass)?.label || '';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 xl:px-10 flex-shrink-0 z-30 sticky top-0">
      {/* Left — class selector */}
      <div className="relative">
        <button
          onClick={() => setShowClassDropdown((p) => !p)}
          className="flex items-center gap-2.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-xl px-4 py-2 transition-all duration-150"
        >
          <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">P3</span>
          </div>
          <span className="text-sm font-semibold text-slate-700 hidden md:block max-w-[240px] truncate">
            {selectedLabel}
          </span>
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
        </button>

        {showClassDropdown && (
          <div className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-elevated py-1.5 w-72 z-50 fade-in">
            {CLASS_OPTIONS.map((cls) => (
              <button
                key={`class-opt-${cls.id}`}
                onClick={() => { onClassChange(cls.id); setShowClassDropdown(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedClass === cls.id
                    ? 'bg-violet-50 text-violet-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cls.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center — search */}
      <div className="flex-1 max-w-sm mx-6 hidden md:block">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search students, standards…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => toast.success('Class data refreshed')}
          className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={16} />
        </button>

        <button className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 ml-1">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold">
            MR
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">Mrs. Reyes</p>
            <p className="text-xs text-slate-500">Period 3 · 8th ELA</p>
          </div>
        </div>
      </div>
    </header>
  );
}