'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, BookOpen, Users, BarChart3, Settings, ChevronLeft, ChevronRight, LogOut, Bell, Award } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import type { SidebarSection } from './TeacherDashboardPage';


interface TeacherSidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (s: SidebarSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_GROUPS = [
  {
    label: 'Classroom',
    items: [
      { id: 'dashboard' as SidebarSection, label: 'Dashboard', icon: LayoutDashboard, badge: null },
      { id: 'assignments' as SidebarSection, label: 'Assignments', icon: BookOpen, badge: '3' },
      { id: 'students' as SidebarSection, label: 'Students', icon: Users, badge: '2' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { id: 'standards' as SidebarSection, label: 'B.E.S.T. Standards', icon: Award, badge: null },
      { id: 'reports' as SidebarSection, label: 'Reports', icon: BarChart3, badge: null },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'settings' as SidebarSection, label: 'Settings', icon: Settings, badge: null },
    ],
  },
];

export default function TeacherSidebar({
  activeSection,
  onSectionChange,
  collapsed,
  onToggleCollapse,
}: TeacherSidebarProps) {
  const router = useRouter();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#0d0f12] border-r border-white/[0.08] flex flex-col z-40 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-white/[0.08] flex-shrink-0 ${
        collapsed ? 'justify-center px-3' : 'px-4 gap-3'
      }`}>
        <AppLogo size={36} onClick={() => router.push('/teacher-dashboard')} />
        {!collapsed && (
          <span className="font-bold text-[#1D9E75] text-xl tracking-tight">GOGI</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={`nav-group-${group.label}`} className="mb-5">
            {!collapsed && (
              <p className="text-xs font-semibold text-[#4B5563] uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={`nav-${item.id}`}
                    onClick={() => onSectionChange(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`sidebar-item ${
                      isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
                    } ${collapsed ? 'justify-center px-2' : ''} relative group`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && (
                      <span className="flex-1 text-left">{item.label}</span>
                    )}
                    {item.badge && !collapsed && (
                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                    {item.badge && collapsed && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold">
                        {item.badge}
                      </span>
                    )}
                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111418] border border-white/[0.08] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                        {item.label}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#111418]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/[0.08] p-2 flex flex-col gap-0.5">
        <button
          className={`sidebar-item sidebar-item-inactive relative group ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell size={18} className="flex-shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Notifications</span>}
          <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center font-bold flex-shrink-0 absolute top-1 right-1">
            4
          </span>
          {collapsed && (
            <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111418] border border-white/[0.08] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Notifications (4)
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#111418]" />
            </div>
          )}
        </button>

        <button
          onClick={() => router.push('/sign-up-login-screen')}
          className={`sidebar-item sidebar-item-inactive text-rose-500 hover:bg-red-500/10 hover:text-rose-400 ${collapsed ? 'justify-center px-2' : ''} group relative`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="flex-1 text-left">Sign Out</span>}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#111418] border border-white/[0.08] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Sign Out
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#111418]" />
            </div>
          )}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-20 w-7 h-7 bg-[#0d0f12] border border-white/[0.08] rounded-full flex items-center justify-center hover:bg-white/[0.06] hover:border-[#1D9E75]/40 transition-all z-50"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-[#4B5563]" />
        ) : (
          <ChevronLeft size={14} className="text-[#4B5563]" />
        )}
      </button>
    </aside>
  );
}
