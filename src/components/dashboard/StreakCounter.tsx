'use client';

import { C, FONTS } from '@/lib/constants/design';

export interface StreakCounterProps {
  streak: number;
}

export function StreakCounter({ streak }: StreakCounterProps) {
  return (
    <div
      style={{
        background: C.amberLight,
        border: `1px solid ${C.amber}`,
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: FONTS.ui,
      }}
    >
      {/* Amber circle with day number */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: C.amber,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#FFFFFF',
            fontFamily: FONTS.ui,
            lineHeight: 1,
          }}
        >
          {streak}
        </span>
      </div>

      {/* Text */}
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.amber,
            lineHeight: 1.3,
          }}
        >
          {streak === 0
            ? 'Start your streak today'
            : `Day ${streak} streak — keep it moving`}
        </div>
        {streak > 0 && (
          <div
            style={{
              fontSize: 12,
              color: C.dark,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {streak < 7
              ? `${7 - streak} more day${7 - streak !== 1 ? 's' : ''} to your first milestone. You showed up ${streak} day${streak !== 1 ? 's' : ''} in a row.`
              : `You showed up ${streak} day${streak !== 1 ? 's' : ''} in a row. Keep building.`}
          </div>
        )}
      </div>
    </div>
  );
}
