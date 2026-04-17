'use client';

import { GOGI_STATES, type GogiState, FONTS } from '@/lib/constants/design';

interface GogiAvatarProps {
  state?: GogiState;
  size?: number;
  className?: string;
}

export function GogiAvatar({ state = 'neutral', size = 48, className }: GogiAvatarProps) {
  const { bg, ring } = GOGI_STATES[state];
  const fontSize = Math.max(12, Math.round(size * 0.38));

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        border: `3px solid ${ring}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          color: '#fff',
          fontWeight: 800,
          fontSize,
          fontFamily: FONTS.passage,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        G
      </span>
    </div>
  );
}
