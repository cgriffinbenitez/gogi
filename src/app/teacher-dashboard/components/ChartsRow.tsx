'use client';

import React, { useState } from 'react';
import StandardsCoverageChart from './StandardsCoverageChart';
import ComprehensionDistributionChart from './ComprehensionDistributionChart';

export default function ChartsRow() {
  const [activeChart, setActiveChart] = useState<'standards' | 'growth'>('standards');

  return (
    <div className="flex flex-col gap-4">
      {/* Standards Coverage */}
      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">B.E.S.T. Standards Coverage</h3>
            <p className="text-xs text-[#4B5563] mt-0.5">Period 3 · Current unit mastery by standard</p>
          </div>
          <span className="badge bg-[#1D9E75]/20 text-[#1D9E75] border border-[#1D9E75]/30 text-xs">ELA.9</span>
        </div>
        <StandardsCoverageChart />
      </div>

      {/* Comprehension over time */}
      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Comprehension Score Trend</h3>
            <p className="text-xs text-[#4B5563] mt-0.5">Class average over last 8 assignments</p>
          </div>
          <div className="flex gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-xl p-1">
            {(['standards', 'growth'] as const).map((tab) => (
              <button
                key={`chart-tab-${tab}`}
                onClick={() => setActiveChart(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  activeChart === tab
                    ? 'bg-[#1D9E75] text-white'
                    : 'text-[#4B5563] hover:text-[#94A3B8]'
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