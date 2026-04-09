'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const ALERTS = [
  {
    id: 'alert-001',
    student: 'Darius Washington',
    issue: 'Comprehension dropped to 38% — below intervention threshold',
    severity: 'critical' as const,
    time: '14 min ago',
    standard: 'ELA.8.R.1.3',
  },
  {
    id: 'alert-002',
    student: 'Aaliyah Torres',
    issue: 'Has not started today\'s assignment after 45 minutes',
    severity: 'warning' as const,
    time: '32 min ago',
    standard: null,
  },
  {
    id: 'alert-003',
    student: 'Kevin Nguyen',
    issue: 'AI dependency score 6.2 hints/task — possible over-reliance',
    severity: 'warning' as const,
    time: '1 hr ago',
    standard: 'ELA.8.C.1.2',
  },
  {
    id: 'alert-004',
    student: 'Brianna Mitchell',
    issue: 'Evidence quality score 22% — responses too vague',
    severity: 'critical' as const,
    time: '2 hr ago',
    standard: 'ELA.8.R.1.3',
  },
];

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-400',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
};

export default function AlertsPanel() {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = ALERTS.filter((a) => !dismissed.includes(a.id));

  const handleDismiss = (id: string) => {
    setDismissed((prev) => [...prev, id]);
    toast.success('Alert dismissed');
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900">Student Alerts</h3>
          {visible.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold">
              {visible.length}
            </span>
          )}
        </div>
        <button
          onClick={() => toast.info('Full alerts view coming soon')}
          className="text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors flex items-center gap-0.5"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-6">
          <span className="text-3xl block mb-2">✅</span>
          <p className="text-sm font-semibold text-slate-700">No active alerts</p>
          <p className="text-xs text-slate-400 mt-1">All students are on track right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((alert) => {
            const styles = SEVERITY_STYLES[alert.severity];
            return (
              <div
                key={alert.id}
                className={`${styles.bg} ${styles.border} border rounded-xl p-3 flex gap-3 fade-in`}
              >
                <div className={`w-2 h-2 rounded-full ${styles.dot} mt-1.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-slate-800">{alert.student}</span>
                    {alert.standard && (
                      <span className={`badge ${styles.badge} text-xs font-mono`}>{alert.standard}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{alert.issue}</p>
                  <p className="text-xs text-slate-400 mt-1">{alert.time}</p>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}