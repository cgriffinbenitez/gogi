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
    standard: 'ELA.9.R.1.1',
  },
  {
    id: 'alert-002',
    student: 'Aaliyah Torres',
    issue: "Has not started today's assignment after 45 minutes",
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
    standard: 'ELA.9.R.1.2',
  },
  {
    id: 'alert-004',
    student: 'Brianna Mitchell',
    issue: 'Evidence quality score 22% — responses too vague',
    severity: 'critical' as const,
    time: '2 hr ago',
    standard: 'ELA.9.R.1.1',
  },
];

const SEVERITY_STYLES = {
  critical: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10',
    dot: 'bg-rose-500',
    nameColor: 'text-white',
    badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    issueColor: 'text-[#94A3B8]',
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
    nameColor: 'text-white',
    badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    issueColor: 'text-[#94A3B8]',
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
    <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400" />
          <h3 className="text-sm font-bold text-white">Student Alerts</h3>
          {visible.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold">
              {visible.length}
            </span>
          )}
        </div>
        <button
          onClick={() => toast.info('Full alerts view coming soon')}
          className="text-xs text-[#1D9E75] hover:text-[#17825F] font-semibold transition-colors flex items-center gap-0.5"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm font-semibold text-white">No active alerts</p>
          <p className="text-xs text-[#4B5563] mt-1">All students are on track right now.</p>
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
                    <span className={`text-xs font-bold ${styles.nameColor}`}>{alert.student}</span>
                    {alert.standard && (
                      <span className={`badge ${styles.badge} text-xs font-mono`}>{alert.standard}</span>
                    )}
                  </div>
                  <p className={`text-xs ${styles.issueColor} leading-relaxed`}>{alert.issue}</p>
                  <p className="text-xs text-[#4B5563] mt-1">{alert.time}</p>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="text-[#4B5563] hover:text-[#94A3B8] transition-colors flex-shrink-0 mt-0.5"
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
