'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  defs,
  linearGradient,
  stop,
  ReferenceLine,
} from 'recharts';

const COMPREHENSION_TREND = [
  { assignment: 'Assign 1', score: 71, effort: 78 },
  { assignment: 'Assign 2', score: 74, effort: 80 },
  { assignment: 'Assign 3', score: 69, effort: 75 },
  { assignment: 'Assign 4', score: 72, effort: 82 },
  { assignment: 'Assign 5', score: 65, effort: 70 },
  { assignment: 'Assign 6', score: 70, effort: 77 },
  { assignment: 'Assign 7', score: 66, effort: 73 },
  { assignment: 'Assign 8', score: 68, effort: 81 },
];

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-elevated px-4 py-3 min-w-[160px]">
      <p className="text-xs font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={`tt-${p.name}`} className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500 capitalize">{p.name}</span>
          <span className="text-xs font-bold" style={{ color: p.color }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

export default function ComprehensionDistributionChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={COMPREHENSION_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradEffort" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="assignment"
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
          domain={[50, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} />
        <Area
          type="monotone"
          dataKey="score"
          name="Comprehension"
          stroke="#7c3aed"
          strokeWidth={2.5}
          fill="url(#gradScore)"
          dot={{ fill: '#7c3aed', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#7c3aed' }}
        />
        <Area
          type="monotone"
          dataKey="effort"
          name="Effort"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#gradEffort)"
          dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#f59e0b' }}
          strokeDasharray="5 3"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}