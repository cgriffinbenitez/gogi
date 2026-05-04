'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';

type TeacherDashboardTopBarProps = {
  active?:
    | 'roster'
    | 'welcome'
    | 'fast'
    | 'released'
    | 'original'
    | 'coverage'
    | 'gutenberg'
    | 'questions';
  teacherName?: string;
  school?: string;
};

export function TeacherDashboardTopBar({
  active,
  teacherName = 'Mr. Griffin',
  school = 'South Dade Senior High School',
}: TeacherDashboardTopBarProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const items = [
    { key: 'roster' as const, label: 'Roster', href: '/dashboard/teacher' },
    { key: 'welcome' as const, label: 'Welcome Cards', href: '/teacher/welcome-cards' },
    { key: 'fast' as const, label: 'FAST Upload', href: '/teacher-dashboard/fast-upload' },
    { key: 'coverage' as const, label: 'Library Readiness', href: '/admin/reading-win-coverage' },
    { key: 'gutenberg' as const, label: 'Gutenberg Library', href: '/admin/gutenberg-library' },
    { key: 'original' as const, label: 'Item Builder', href: '/admin/original-items' },
    { key: 'released' as const, label: 'FAST Booklets', href: '/admin/released-items' },
    { key: 'questions' as const, label: 'Question Bank', href: '/admin/questions' },
  ];

  return (
    <nav
      style={{
        background: C.navy,
        minHeight: 52,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        boxSizing: 'border-box' as const,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard/teacher')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 6,
            marginRight: 8,
          }}
          title="Back to roster"
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: C.white,
              fontFamily: FONTS.ui,
            }}
          >
            GOGI
          </span>
        </button>

        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              style={{
                background: isActive ? 'rgba(255,255,255,0.14)' : 'transparent',
                border: isActive ? '1px solid rgba(181,212,244,0.28)' : '1px solid transparent',
                borderRadius: 6,
                padding: '7px 12px',
                color: isActive ? C.white : C.blueMid,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONTS.ui,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            fontSize: 11,
            color: C.blueMid,
            whiteSpace: 'nowrap' as const,
            fontFamily: FONTS.ui,
          }}
        >
          {teacherName}&nbsp;|&nbsp;{school}&nbsp;|&nbsp;Pilot Cohort&nbsp;·&nbsp;Period 3
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            background: 'none',
            border: '1px solid rgba(181,212,244,0.3)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            color: C.blueMid,
            cursor: 'pointer',
            fontFamily: FONTS.ui,
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
