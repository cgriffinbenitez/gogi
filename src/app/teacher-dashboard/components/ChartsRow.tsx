'use client';

import React, { useState } from 'react';
import StandardsCoverageChart from './StandardsCoverageChart';
import ComprehensionDistributionChart from './ComprehensionDistributionChart';

export default function ChartsRow() {
  const [activeChart, setActiveChart] = useState<'standards' | 'growth'>('standards');

  return (
    <div className="flex flex-col gap-4">
      {/* Standards Coverage */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">B.E.S.T. Standards Coverage</h3>
            <p className="text-xs text-slate-500 mt-0.5">Period 3 · Current unit mastery by standard</p>
          </div>
          <span className="badge bg-violet-100 text-violet-700 text-xs">ELA.8</span>
        </div>
        <StandardsCoverageChart />
      </div>

      {/* Comprehension over time */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Comprehension Score Trend</h3>
            <p className="text-xs text-slate-500 mt-0.5">Class average over last 8 assignments</p>
          </div>
          <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
            {(['standards', 'growth'] as const).map((tab) => (
              <button
                key={`chart-tab-${tab}`}
                onClick={() => setActiveChart(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  activeChart === tab
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'standards' ? 'Class Avg' : 'Growth'}
              </button>
            ))}
          </div>
        </div>
        <ComprehensionDistributionChart />
      </div>
    </div>
  );
}