'use client';

import { C, type GogiState, FONTS } from '@/lib/constants/design';

interface GogiBubbleProps {
  children: React.ReactNode;
  state?: GogiState;
  className?: string;
}

const BUBBLE_STYLES: Record<GogiState, { bg: string; border: string; color: string }> = {
  neutral:   { bg: C.blueLight,  border: C.blueMid,     color: C.navy  },
  engaged:   { bg: C.blueLight,  border: C.blueMid,     color: C.navy  },
  celebrate: { bg: C.greenLight, border: C.greenBorder, color: C.green },
};

export function GogiBubble({ children, state = 'neutral', className }: GogiBubbleProps) {
  const { bg, border, color } = BUBBLE_STYLES[state];

  return (
    <div
      className={className}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '12px 12px 12px 2px',
        padding: '10px 13px',
        fontSize: 13,
        color,
        fontFamily: FONTS.ui,
        lineHeight: 1.55,
        maxWidth: '80%',
      }}
    >
      {children}
    </div>
  );
}
