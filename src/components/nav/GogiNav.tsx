'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LogoutButton } from './LogoutButton';

interface GogiNavProps {
  subtitle?:          string;
  rightContent?:      string;
  showLogout?:        boolean;
  showDashboardLink?: boolean;
}

export function GogiNav({ subtitle, rightContent, showLogout, showDashboardLink }: GogiNavProps) {
  const router = useRouter();
  const { role } = useAuth();

  function handleHomeClick() {
    router.push(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
  }

  return (
    <nav
      style={{
        background:     '#1F4E79',
        height:         52,
        width:          '100%',
        padding:        '0 20px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
        boxSizing:      'border-box',
      }}
    >
      {/* Left — brand (home button) */}
      <button
        onClick={handleHomeClick}
        style={{
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          display:     'flex',
          alignItems:  'center',
          gap:         8,
          padding:     '4px 8px',
          borderRadius: 6,
          transition:  'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        title="Back to dashboard"
      >
        {/* Mini book icon */}
        <div style={{ filter: 'drop-shadow(0 0 5px rgba(0,200,255,0.8))', flexShrink: 0, lineHeight: 0 }}>
          <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="navBookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#0066aa" />
              </linearGradient>
              <linearGradient id="navNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#ffbb00" />
                <stop offset="100%" stopColor="#ff6600" />
              </linearGradient>
            </defs>
            <path d="M32 52 L8 43 L8 14 L32 21 Z"  fill="rgba(0,212,255,0.06)" stroke="url(#navBookGrad)" strokeWidth="1.8" />
            <path d="M32 52 L56 43 L56 14 L32 21 Z" fill="rgba(0,212,255,0.06)" stroke="url(#navBookGrad)" strokeWidth="1.8" />
            <line x1="32" y1="21" x2="32" y2="52" stroke="url(#navBookGrad)" strokeWidth="2" />
            <circle cx="21" cy="27" r="2.5" fill="url(#navNodeGrad)" />
            <circle cx="43" cy="27" r="2.5" fill="url(#navNodeGrad)" />
            <circle cx="32" cy="34" r="3"   fill="url(#navNodeGrad)" />
            <line x1="32" y1="34" x2="21" y2="27" stroke="#ffbb00" strokeWidth="1" opacity="0.6" />
            <line x1="32" y1="34" x2="43" y2="27" stroke="#ffbb00" strokeWidth="1" opacity="0.6" />
          </svg>
        </div>
        <span style={{
          fontSize:      15,
          fontWeight:    800,
          color:         '#ffffff',
          fontFamily:    "system-ui, -apple-system, 'Segoe UI', sans-serif",
          letterSpacing: '-0.5px',
        }}>
          GOGI
        </span>
        <span style={{
          fontSize:   10,
          color:      '#B5D4F4',
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}>
          Adaptive Literacy
        </span>
      </button>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {subtitle && (
          <span style={{
            fontSize:   13,
            color:      '#B5D4F4',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}>
            {subtitle}
          </span>
        )}
        {rightContent && !subtitle && (
          <span style={{
            fontSize:   13,
            color:      '#B5D4F4',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}>
            {rightContent}
          </span>
        )}
        {showDashboardLink && (
          <button
            onClick={handleHomeClick}
            style={{
              fontSize:   11,
              color:      'rgba(181,212,244,0.5)',
              cursor:     'pointer',
              background: 'none',
              border:     'none',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              transition: 'color 0.2s',
              padding:    0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#B5D4F4'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(181,212,244,0.5)'; }}
          >
            ← Dashboard
          </button>
        )}
        {showLogout && <LogoutButton />}
      </div>
    </nav>
  );
}
