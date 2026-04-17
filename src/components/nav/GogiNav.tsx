'use client';

import { LogoutButton } from './LogoutButton';

interface GogiNavProps {
  subtitle?: string;
  rightContent?: string;
  showLogout?: boolean;
}

export function GogiNav({ subtitle, rightContent, showLogout }: GogiNavProps) {
  return (
    <nav
      style={{
        background: '#1F4E79',
        height: 52,
        width: '100%',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#ffffff',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            letterSpacing: '-0.5px',
          }}
        >
          GOGI
        </span>
        <span
          style={{
            fontSize: 12,
            color: '#B5D4F4',
            marginLeft: 8,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}
        >
          Adaptive Literacy
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {subtitle && (
          <span
            style={{
              fontSize: 13,
              color: '#B5D4F4',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            }}
          >
            {subtitle}
          </span>
        )}
        {rightContent && !subtitle && (
          <span
            style={{
              fontSize: 13,
              color: '#B5D4F4',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            }}
          >
            {rightContent}
          </span>
        )}
        {showLogout && <LogoutButton />}
      </div>
    </nav>
  );
}
