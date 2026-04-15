'use client';

import React from 'react';
import {
  CheckSquare,
  Brain,
  Award,
  AlertTriangle,
  Zap,
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

const METRICS = [
  {
    id: 'metric-completion',
    label: 'Task Completion Rate',
    value: '74%',
    subValue: '23 of 31 students',
    trend: 'up' as const,
    trendValue: '+6% vs last week',
    icon: CheckSquare,
    isHero: true,
    isAlert: false,
    detail: 'Current assignment: The River and the Stone',
    valueColor: 'text-[#1D9E75]',
  },
  {
    id: 'metric-comprehension',
    label: 'Avg Comprehension Score',
    value: '68%',
    subValue: 'Class average',
    trend: 'down' as const,
    trendValue: '-4% vs last assignment',
    icon: Brain,
    isHero: false,
    isAlert: false,
    detail: 'Below class target of 75%',
    valueColor: 'text-rose-400',
  },
  {
    id: 'metric-standards',
    label: 'B.E.S.T. Standards Mastery',
    value: '61%',
    subValue: '11 of 18 benchmarks',
    trend: 'up' as const,
    trendValue: '+3 benchmarks this month',
    icon: Award,
    isHero: false,
    isAlert: false,
    detail: 'Focus needed: ELA.9.R.1.1',
    valueColor: 'text-white',
  },
  {
    id: 'metric-atrisk',
    label: 'Students At Risk',
    value: '7',
    subValue: 'Need intervention now',
    trend: 'up' as const,
    trendValue: '+2 since Monday',
    icon: AlertTriangle,
    isHero: false,
    isAlert: true,
    detail: 'Comprehension below 50%',
    valueColor: 'text-amber-400',
  },
  {
    id: 'metric-effort',
    label: 'Avg Effort Index',
    value: '81%',
    subValue: 'Time-on-task + depth',
    trend: 'neutral' as const,
    trendValue: 'Stable',
    icon: Zap,
    isHero: false,
    isAlert: false,
    detail: '6 students below 60% effort',
    valueColor: 'text-white',
  },
  {
    id: 'metric-ai-dependency',
    label: 'Avg AI Dependency',
    value: '2.4',
    subValue: 'Hints per task avg',
    trend: 'down' as const,
    trendValue: '-0.6 vs last week',
    icon: Bot,
    isHero: false,
    isAlert: false,
    detail: 'Lower = more independence',
    valueColor: 'text-[#1D9E75]',
  },
];

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'neutral' }) => {
  if (trend === 'up') return <TrendingUp size={13} className="flex-shrink-0" />;
  if (trend === 'down') return <TrendingDown size={13} className="flex-shrink-0" />;
  return <Minus size={13} className="flex-shrink-0" />;
};

export default function MetricsBentoGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {METRICS.map((metric) => {
        const Icon = metric.icon;
        const isHero = metric.isHero;

        const trendPositive =
          (metric.trend === 'up' && metric.id !== 'metric-atrisk' && metric.id !== 'metric-comprehension') ||
          (metric.trend === 'down' && metric.id === 'metric-ai-dependency');
        const trendNegative =
          (metric.trend === 'down' && metric.id !== 'metric-ai-dependency') ||
          (metric.trend === 'up' && (metric.id === 'metric-atrisk'));

        return (
          <div
            key={metric.id}
            className={`bg-white/[0.06] border ${
              metric.isAlert ? 'border-amber-500/30 ring-1 ring-amber-500/20' : 'border-white/[0.08]'
            } rounded-2xl p-4 flex flex-col gap-3 ${
              isHero ? 'xl:col-span-2 2xl:col-span-2' : ''
            } hover:bg-white/[0.08] transition-colors duration-200 cursor-pointer`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-[#94A3B8]">
                <Icon size={20} />
              </div>
              {metric.isAlert && (
                <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">
                  Alert
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-wide leading-tight">
                {metric.label}
              </p>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold tabular-nums ${metric.valueColor}`}>
                  {metric.value}
                </span>
                {isHero && (
                  <span className="text-sm text-[#94A3B8] font-medium">{metric.subValue}</span>
                )}
              </div>
              {!isHero && (
                <p className="text-xs text-[#4B5563]">{metric.subValue}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-white/[0.06]">
              <span className={`flex items-center gap-1 text-xs font-semibold ${
                trendPositive ? 'text-[#1D9E75]' : trendNegative ? 'text-rose-400' : 'text-[#4B5563]'
              }`}>
                <TrendIcon trend={metric.trend} />
                {metric.trendValue}
              </span>
              <span className="text-xs text-[#4B5563] truncate max-w-[120px]">{metric.detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
