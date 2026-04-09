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
import Icon from '@/components/ui/AppIcon';


// Grid plan: 6 cards → grid-cols-4 → row 1: hero spans 2 cols + 2 regular, row 2: 3 regular cards (last spans 2 to fill)
// Actually: 6 cards → 3-col × 2 rows works cleanly at xl, with hero spanning 2 at 2xl

const METRICS = [
  {
    id: 'metric-completion',
    label: 'Task Completion Rate',
    value: '74%',
    subValue: '23 of 31 students',
    trend: 'up' as const,
    trendValue: '+6% vs last week',
    icon: CheckSquare,
    color: 'emerald',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    iconClass: 'bg-emerald-100 text-emerald-600',
    valueClass: 'text-emerald-700',
    isHero: true,
    detail: 'Current assignment: The River and the Stone',
  },
  {
    id: 'metric-comprehension',
    label: 'Avg Comprehension Score',
    value: '68%',
    subValue: 'Class average',
    trend: 'down' as const,
    trendValue: '-4% vs last assignment',
    icon: Brain,
    color: 'rose',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    iconClass: 'bg-rose-100 text-rose-600',
    valueClass: 'text-rose-600',
    isHero: false,
    detail: 'Below class target of 75%',
  },
  {
    id: 'metric-standards',
    label: 'B.E.S.T. Standards Mastery',
    value: '61%',
    subValue: '11 of 18 benchmarks',
    trend: 'up' as const,
    trendValue: '+3 benchmarks this month',
    icon: Award,
    color: 'violet',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    iconClass: 'bg-violet-100 text-violet-600',
    valueClass: 'text-violet-700',
    isHero: false,
    detail: 'Focus needed: ELA.8.R.1.3',
  },
  {
    id: 'metric-atrisk',
    label: 'Students At Risk',
    value: '7',
    subValue: 'Need intervention now',
    trend: 'up' as const,
    trendValue: '+2 since Monday',
    icon: AlertTriangle,
    color: 'amber',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-300',
    iconClass: 'bg-amber-100 text-amber-600',
    valueClass: 'text-amber-700',
    isHero: false,
    detail: 'Comprehension below 50%',
    isAlert: true,
  },
  {
    id: 'metric-effort',
    label: 'Avg Effort Index',
    value: '81%',
    subValue: 'Time-on-task + depth',
    trend: 'neutral' as const,
    trendValue: 'Stable',
    icon: Zap,
    color: 'sky',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    iconClass: 'bg-sky-100 text-sky-600',
    valueClass: 'text-sky-700',
    isHero: false,
    detail: '6 students below 60% effort',
  },
  {
    id: 'metric-ai-dependency',
    label: 'Avg AI Dependency',
    value: '2.4',
    subValue: 'Hints per task avg',
    trend: 'down' as const,
    trendValue: '-0.6 vs last week',
    icon: Bot,
    color: 'indigo',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    iconClass: 'bg-indigo-100 text-indigo-600',
    valueClass: 'text-indigo-700',
    isHero: false,
    detail: 'Lower = more independence',
  },
];

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'neutral' }) => {
  if (trend === 'up') return <TrendingUp size={13} className="flex-shrink-0" />;
  if (trend === 'down') return <TrendingDown size={13} className="flex-shrink-0" />;
  return <Minus size={13} className="flex-shrink-0" />;
};

export default function MetricsBentoGrid() {
  return (
    // 6 cards: hero spans 2 cols on xl+, rest are 1 col each
    // Row 1: hero(2) + 2 regular = 4 cols
    // Row 2: 3 regular (last spans 2 to fill 4 cols)
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {METRICS.map((metric, idx) => {
        const Icon = metric.icon;
        const isHero = metric.isHero;

        const trendPositive =
          (metric.trend === 'up' && metric.color !== 'amber' && metric.color !== 'rose') ||
          (metric.trend === 'down' && metric.id === 'metric-ai-dependency');
        const trendNegative =
          (metric.trend === 'down' && metric.id !== 'metric-ai-dependency') ||
          (metric.trend === 'up' && (metric.color === 'amber' || metric.color === 'rose'));

        return (
          <div
            key={metric.id}
            className={`metric-card border ${metric.borderClass} ${metric.bgClass} ${
              isHero ? 'xl:col-span-2 2xl:col-span-2' : ''
            } ${idx === 5 ? 'lg:col-span-1 xl:col-span-1 2xl:col-span-1' : ''} ${
              metric.isAlert ? 'ring-2 ring-amber-300 ring-offset-1' : ''
            } hover:shadow-elevated transition-shadow duration-200 cursor-pointer`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${metric.iconClass}`}>
                <Icon size={20} />
              </div>
              {metric.isAlert && (
                <span className="badge bg-amber-100 text-amber-700 border border-amber-300 text-xs">
                  ⚠ Alert
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">
                {metric.label}
              </p>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold tabular-nums ${metric.valueClass}`}>
                  {metric.value}
                </span>
                {isHero && (
                  <span className="text-sm text-slate-500 font-medium">{metric.subValue}</span>
                )}
              </div>
              {!isHero && (
                <p className="text-xs text-slate-500">{metric.subValue}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-black/5">
              <span className={`flex items-center gap-1 text-xs font-semibold ${
                trendPositive ? 'text-emerald-600' : trendNegative ?'text-rose-500': 'text-slate-500'
              }`}>
                <TrendIcon trend={metric.trend} />
                {metric.trendValue}
              </span>
              <span className="text-xs text-slate-400 truncate max-w-[120px]">{metric.detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}