'use client';

import { useMemo, useRef, useState } from 'react';
import { Eye, Workflow } from 'lucide-react';
import {
  GogiAvatar,
  GogiBubble,
  PassagePanel,
  TeachNav,
  TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';
import { MoodGridExperience } from '@/components/mood-run/MoodGridExperience';
import { moodRunScreens } from '@/components/mood-run/moodRunDemoData';
import { C, FONTS } from '@/lib/constants/design';

type MoodGridReviewShellProps = {
  standardCode?: string;
  onBack?: () => void;
};

function findEvidenceRanges(text: string, words: string[]): [number, number][] {
  const ranges: [number, number][] = [];

  words.forEach((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    let match;
    while ((match = re.exec(text)) !== null) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  });

  return ranges.sort((a, b) => a[0] - b[0]);
}

export function MoodGridReviewShell({
  standardCode = 'ELA.9.R.1.1',
  onBack,
}: MoodGridReviewShellProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeEvidence, setActiveEvidence] = useState<string[]>([]);
  const activeScreen = moodRunScreens[activeIndex];
  const passageRef = useRef<HTMLDivElement>(null);

  const passageText = activeScreen.passage.join('\n\n');
  const evidenceWords = activeScreen.evidenceWords.map((item) => item.word);
  const ranges = useMemo(
    () => findEvidenceRanges(passageText, activeEvidence.length ? activeEvidence : evidenceWords),
    [activeEvidence, evidenceWords, passageText],
  );

  const markStyle = {
    background: activeEvidence.length ? C.yellow : C.greenLight,
    color: activeEvidence.length ? C.dark : C.green,
    borderRadius: 2,
    padding: '0 2px',
  };

  function handleScreenChange(index: number) {
    setActiveIndex(index);
    setActiveEvidence([]);
  }

  function jumpToHighlight() {
    passageRef.current?.querySelector('mark')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  return (
    <div className="reviewPage">
      <TeachNav
        standardCode={standardCode}
        navLabel="Mood Read · Review Build"
        layerColor={C.greenBorder}
      />

      <div className="reviewStrip">
        <div className="reviewStripItem">
          <Workflow size={16} />
          <span>Native GOGI teach shell: passage, coaching, intervention.</span>
        </div>
        <div className="reviewStripItem">
          <Eye size={16} />
          <span>Scaffold fade: labels visible, labels on hover, 3 x 3 transfer.</span>
        </div>
        {onBack && (
          <button className="backButton" onClick={onBack} type="button">
            Current mood page
          </button>
        )}
      </div>

      <div className="screenTabs" aria-label="Mood run screens">
        {moodRunScreens.map((screen, index) => (
          <button
            className={index === activeIndex ? 'active' : ''}
            key={screen.mode}
            onClick={() => handleScreenChange(index)}
            type="button"
          >
            <span>{index + 1}</span>
            {screen.mode === 'teach' ? 'Teach' : screen.mode === 'full' ? 'P1 full' : screen.mode === 'partial' ? 'P2 partial' : screen.mode === 'none' ? 'P3 none' : 'Reassess'}
          </button>
        ))}
      </div>

      <div className="teach-3col reviewColumns">
        <PassagePanel
          passageTitle={activeScreen.passageTitle}
          passageAuthor="GOGI review passage"
          passageText={passageText}
          ranges={ranges}
          markStyle={markStyle}
          onJump={jumpToHighlight}
          panelRef={passageRef}
          loading={false}
          loadTimeout
        />

        <div className="coachColumn">
          <div className="sectionLabel">GOGI COACHING</div>
          <div className="coachBubbleRow">
            <GogiAvatar size={36} state="engaged" />
            <GogiBubble state="engaged">
              {activeScreen.gogiCopy}
            </GogiBubble>
          </div>

          <div className="moveCard">
            <div className="sectionLabel">MOOD READ MOVE</div>
            <div className="moveStep active">1. Pick words that change the air.</div>
            <div className="moveStep">2. Place the feeling on the grid.</div>
            <div className="moveStep">3. Defend it without revealing the answer.</div>
          </div>
        </div>

        <div className="interventionColumn">
          <MoodGridExperience
            {...activeScreen}
            onEvidenceChange={setActiveEvidence}
          />
        </div>
      </div>

      <style jsx>{`
        .reviewPage {
          background: ${C.white};
          display: flex;
          flex-direction: column;
          font-family: ${FONTS.ui};
          height: 100vh;
          overflow: hidden;
        }

        .reviewStrip {
          align-items: center;
          background: #f8f9fa;
          border-bottom: 1px solid ${C.border};
          display: flex;
          flex-shrink: 0;
          gap: 10px;
          padding: 8px 16px;
        }

        .reviewStripItem {
          align-items: center;
          background: ${C.white};
          border: 1px solid ${C.border};
          border-radius: 8px;
          color: ${C.dark};
          display: flex;
          flex: 1;
          gap: 8px;
          min-height: 38px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.35;
        }

        .backButton {
          background: ${C.navy};
          border: 0;
          border-radius: 8px;
          color: ${C.white};
          cursor: pointer;
          flex-shrink: 0;
          font-family: ${FONTS.ui};
          font-size: 12px;
          font-weight: 800;
          min-height: 38px;
          padding: 0 14px;
        }

        .screenTabs {
          background: ${C.white};
          border-bottom: 1px solid ${C.border};
          display: flex;
          flex-shrink: 0;
          gap: 8px;
          overflow-x: auto;
          padding: 8px 16px;
        }

        .screenTabs button {
          align-items: center;
          background: ${C.white};
          border: 1px solid ${C.border};
          border-radius: 8px;
          color: ${C.gray};
          cursor: pointer;
          display: inline-flex;
          gap: 8px;
          min-height: 40px;
          padding: 0 12px;
          font-family: ${FONTS.ui};
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .screenTabs button span {
          align-items: center;
          background: ${C.light};
          border-radius: 50%;
          color: ${C.gray};
          display: flex;
          height: 22px;
          justify-content: center;
          width: 22px;
          font-size: 11px;
        }

        .screenTabs button.active {
          background: ${C.blueLight};
          border-color: ${C.blue};
          color: ${C.blue};
        }

        .screenTabs button.active span {
          background: ${C.blue};
          color: ${C.white};
        }

        .reviewColumns {
          flex: 1;
          min-height: 0;
        }

        .coachColumn {
          border-right: 1px solid ${C.border};
          box-sizing: border-box;
          flex: 0 0 28%;
          height: 100%;
          overflow-y: auto;
          padding: 16px;
        }

        .sectionLabel {
          color: ${C.gray};
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.5px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .coachBubbleRow {
          align-items: flex-start;
          display: flex;
          gap: 10px;
        }

        .moveCard {
          background: #f8f9fa;
          border: 1px solid ${C.border};
          border-radius: 8px;
          margin-top: 18px;
          padding: 12px;
        }

        .moveStep {
          border-left: 3px solid ${C.border};
          color: ${C.dark};
          font-size: 12px;
          font-weight: 650;
          line-height: 1.45;
          margin-top: 8px;
          padding: 8px 10px;
        }

        .moveStep.active {
          background: ${C.greenLight};
          border-left-color: ${C.green};
          color: ${C.green};
        }

        .interventionColumn {
          box-sizing: border-box;
          flex: 1;
          height: 100%;
          overflow-y: auto;
          padding: 16px;
        }

        @media (max-width: 768px) {
          .reviewPage {
            height: auto;
            min-height: 100vh;
            overflow: visible;
          }

          .reviewStrip {
            align-items: stretch;
            flex-direction: column;
          }

          .reviewStripItem,
          .backButton {
            width: 100%;
          }

          .coachColumn {
            border-right: 0;
            flex: 0 0 auto;
            height: auto;
          }

          .interventionColumn {
            height: auto;
          }
        }

        ${TEACH_3COL_CSS(C.border)}
      `}</style>
    </div>
  );
}
