'use client';

import { FRAMING_SENTENCES, C, FONTS } from '@/lib/constants/design';

interface PassageHeaderProps {
  standardId: string;
}

export function PassageHeader({ standardId }: PassageHeaderProps) {
  const framing =
    FRAMING_SENTENCES[standardId] ??
    'As you read, pay close attention to how the author develops ideas.';

  return (
    <div
      style={{
        background: C.blueLight,
        borderBottom: `1px solid ${C.blueMid}`,
        padding: '12px 16px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        flexShrink: 0,
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: 3,
          background: C.blue,
          borderRadius: 2,
          alignSelf: 'stretch',
          flexShrink: 0,
        }}
      />

      {/* Right content */}
      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.blue,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 4,
            fontFamily: FONTS.ui,
          }}
        >
          BEFORE YOU READ
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: C.navy,
            lineHeight: 1.5,
            fontFamily: FONTS.ui,
          }}
        >
          {framing}
        </div>
      </div>
    </div>
  );
}
