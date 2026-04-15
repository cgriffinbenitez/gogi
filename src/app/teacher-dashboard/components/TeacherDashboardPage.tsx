'use client';

import React, { useState } from 'react';
import TeacherSidebar from './TeacherSidebar';
import TeacherTopbar from './TeacherTopbar';
import MetricsBentoGrid from './MetricsBentoGrid';
import ChartsRow from './ChartsRow';
import StudentPerformanceTable from './StudentPerformanceTable';
import AlertsPanel from './AlertsPanel';
import ActiveAssignmentPanel from './ActiveAssignmentPanel';

export type SidebarSection = 'dashboard' | 'assignments' | 'students' | 'standards' | 'reports' | 'settings';

export default function TeacherDashboardPage() {
  const [activeSection, setActiveSection] = useState<SidebarSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedClass, setSelectedClass] = useState('period-3');

  return (
    <div className="min-h-screen bg-[#0d0f12] flex">
      {/* Sidebar */}
      <TeacherSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}
      >
        <TeacherTopbar
          selectedClass={selectedClass}
          onClassChange={setSelectedClass}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="flex-1 overflow-y-auto px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl w-full mx-auto">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Class Dashboard</h1>
              <p className="text-[#94A3B8] text-sm mt-0.5">
                Period 3 · 9th Grade ELA
                <span className="ml-2 text-xs text-[#4B5563]">Last updated 2 min ago</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-[#1D9E75]/20 text-[#1D9E75] text-xs border border-[#1D9E75]/30">
                Live
              </span>
            </div>
          </div>

          {/* Metrics */}
          <MetricsBentoGrid />

          {/* Charts + Alerts row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
            <div className="xl:col-span-2">
              <ChartsRow />
            </div>
            <div className="xl:col-span-1 flex flex-col gap-6">
              <AlertsPanel />
              <ActiveAssignmentPanel />
            </div>
          </div>

          {/* Student table */}
          <div className="mt-6">
            <StudentPerformanceTable />
          </div>
        </main>
      </div>
    </div>
  );
}