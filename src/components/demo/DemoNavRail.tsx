'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpenCheck,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Library,
  Route,
  Sparkles,
  Upload,
} from 'lucide-react';

const DEMO_LINKS = [
  { label: 'Cockpit', href: '/demo/cockpit?demoNav=1', icon: Route },
  { label: 'Welcome', href: '/welcome?preview=1&demoNav=1', icon: Sparkles },
  { label: 'First Win', href: '/first-win?preview=1&demoNav=1', icon: GraduationCap },
  {
    label: 'Reading Win',
    href: '/standard/ELA-9-R-3-1/intervention?preview=1&demoNav=1',
    icon: Gauge,
  },
  { label: 'Student', href: '/dashboard/student?demoNav=1', icon: LayoutDashboard },
  { label: 'FAST', href: '/teacher-dashboard/fast-upload?demoNav=1', icon: Upload },
  { label: 'Readiness', href: '/admin/reading-win-coverage?demoNav=1', icon: Library },
  { label: 'Builder', href: '/admin/original-items?demoNav=1', icon: BookOpenCheck },
];

export function DemoNavRail() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const demoNav = searchParams.get('demoNav') === '1' || pathname.startsWith('/demo/cockpit');

  if (!demoNav) return null;

  return (
    <aside className="demoRail" aria-label="Demo navigation">
      <div className="demoRailTitle">Demo mode</div>
      <div className="demoRailLinks">
        {DEMO_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href.split('?')[0];
          return (
            <button
              key={link.href}
              type="button"
              className={isActive ? 'active' : ''}
              onClick={() => router.push(link.href)}
              title={link.label}
            >
              <Icon size={15} />
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .demoRail {
          position: fixed;
          left: 50%;
          bottom: 18px;
          z-index: 9999;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: min(980px, calc(100vw - 24px));
          padding: 10px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
          color: #0f172a;
          font-family:
            Plus Jakarta Sans,
            Inter,
            system-ui,
            sans-serif;
          backdrop-filter: blur(16px);
        }

        .demoRailTitle {
          flex: 0 0 auto;
          border-right: 1px solid rgba(15, 23, 42, 0.12);
          padding: 0 10px 0 4px;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .demoRailLinks {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
        }

        button {
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #334155;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        button:hover,
        button.active {
          background: #0f172a;
          color: #ffffff;
        }

        @media (max-width: 720px) {
          .demoRail {
            align-items: stretch;
            flex-direction: column;
            width: calc(100vw - 24px);
          }

          .demoRailTitle {
            border-right: 0;
            border-bottom: 1px solid rgba(15, 23, 42, 0.12);
            padding: 0 0 8px;
          }

          .demoRailLinks {
            padding-bottom: 2px;
          }
        }
      `}</style>
    </aside>
  );
}
