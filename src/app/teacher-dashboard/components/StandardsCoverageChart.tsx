'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

const STANDARDS_DATA = [
  { standard: 'ELA.9.R.1.1', label: 'Inferencing', mastery: 72, target: 75 },
  { standard: 'ELA.9.R.1.2', label: 'Universal Themes', mastery: 65, target: 75 },
  { standard: 'ELA.9.R.2.1', label: 'Text Structure', mastery: 48, target: 75 },
  { standard: 'ELA.9.R.2.2', label: 'Figurative Lang.', mastery: 81, target: 75 },
  { standard: 'ELA.9.R.3.1', label: 'Author Purpose', mastery: 59, target: 75 },
  { standard: 'ELA.9.C.1.2', label: 'Reasoning', mastery: 77, target: 75 },
  { standard: 'ELA.9.C.1.5', label: 'Argument', mastery: 53, target: 75 },
  { standard: 'ELA.9.V.1.1', label: 'Vocabulary', mastery: 44, target: 75 },
];

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: typeof STANDARDS_DATA[0] }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#111418] border border-white/[0.08] rounded-xl shadow-elevated px-4 py-3">
      <p className="text-xs font-bold text-white mb-1">{d.standard}</p>
      <p className="text-xs text-[#4B5563] mb-2">{d.label}</p>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${d.mastery >= d.target ? 'text-[#1D9E75]' : 'text-rose-400'}`}>
          {d.mastery}% mastery
        </span>
        <span className="text-xs text-[#4B5563]">/ {d.target}% target</span>
      </div>
    </div>
  );
};

export default function StandardsCoverageChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={STANDARDS_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <ReferenceLine y={75} stroke="#1D9E75" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target', fill: '#1D9E75', fontSize: 10, position: 'insideTopRight' }} />
        <Bar dataKey="mastery" radius={[6, 6, 0, 0]}>
          {STANDARDS_DATA.map((entry) => (
            <Cell
              key={`cell-std-${entry.standard}`}
              fill={entry.mastery >= entry.target ? '#1D9E75' : entry.mastery >= 60 ? '#f59e0b' : '#ef4444'}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}