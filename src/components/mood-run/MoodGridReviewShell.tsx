'use client';

import { useState } from 'react';
import { ArrowLeft, Columns2, Eye, Workflow } from 'lucide-react';
import { MoodGridExperience } from '@/components/mood-run/MoodGridExperience';
import { moodRunScreens } from '@/components/mood-run/moodRunDemoData';

type MoodGridReviewShellProps = {
  standardCode?: string;
  onBack?: () => void;
};

export function MoodGridReviewShell({
  standardCode = 'ELA.9.R.1.1',
  onBack,
}: MoodGridReviewShellProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScreen = moodRunScreens[activeIndex];

  return (
    <div className="reviewPage">
      <header className="reviewHeader">
        <div className="headerLeft">
          {onBack && (
            <button
              aria-label="Back to current mood implementation"
              className="iconButton"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div className="headerKicker">{standardCode} · Side-by-side build</div>
            <h1>GOGI Mood Run redesign</h1>
          </div>
        </div>
        <div className="headerRight">
          <div className="statusPill">
            <Columns2 size={15} />
            Review route
          </div>
        </div>
      </header>

      <nav className="screenTabs" aria-label="Mood run screens">
        {moodRunScreens.map((screen, index) => (
          <button
            className={index === activeIndex ? 'active' : ''}
            key={screen.mode}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            <span>{index + 1}</span>
            {screen.mode === 'teach' ? 'Teach' : screen.mode === 'full' ? 'P1 full' : screen.mode === 'partial' ? 'P2 partial' : screen.mode === 'none' ? 'P3 none' : 'Reassess'}
          </button>
        ))}
      </nav>

      <section className="designNotes">
        <div>
          <Workflow size={18} />
          <span>Side-by-side structure: passage evidence, Mood Grid workspace, and Gogi coaching stay visible together on Chromebook.</span>
        </div>
        <div>
          <Eye size={18} />
          <span>Scaffold fade is visible across tabs: labels visible, labels on hover, 3 x 3 no labels, then fresh transfer.</span>
        </div>
      </section>

      <MoodGridExperience {...activeScreen} />

      <style jsx>{`
        .reviewPage {
          min-height: 100vh;
          background: #0e1413;
        }

        .reviewHeader {
          min-height: 64px;
          background: #0e1413;
          border-bottom: 1px solid #2d4139;
          color: #f3f7f5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 16px;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        .headerLeft,
        .headerRight {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .headerKicker {
          color: #4cc9a6;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .reviewHeader h1 {
          font-size: 18px;
          line-height: 24px;
          margin: 2px 0 0;
        }

        .iconButton,
        .statusPill {
          min-height: 44px;
          border-radius: 8px;
          border: 1px solid #2d4139;
          background: #18231f;
          color: #f3f7f5;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
        }

        .iconButton {
          width: 44px;
          cursor: pointer;
        }

        .statusPill {
          color: #a9b8b2;
          padding: 0 12px;
        }

        .screenTabs {
          background: #101715;
          border-bottom: 1px solid #2d4139;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 16px;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        .screenTabs button {
          min-height: 44px;
          border: 1px solid #2d4139;
          border-radius: 8px;
          background: #18231f;
          color: #a9b8b2;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .screenTabs button span {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #2d4139;
          color: #f3f7f5;
          display: grid;
          place-items: center;
          font-size: 11px;
        }

        .screenTabs button.active {
          background: #4cc9a6;
          border-color: #4cc9a6;
          color: #071015;
        }

        .screenTabs button.active span {
          background: #071015;
          color: #4cc9a6;
        }

        .designNotes {
          background: #101715;
          border-bottom: 1px solid #2d4139;
          color: #c8d5d0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 10px 16px;
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        .designNotes div {
          min-height: 44px;
          border: 1px solid #2d4139;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 650;
          line-height: 18px;
        }

        @media (max-width: 820px) {
          .reviewHeader,
          .headerLeft,
          .headerRight {
            align-items: stretch;
          }

          .reviewHeader {
            flex-direction: column;
          }

          .headerLeft,
          .headerRight {
            width: 100%;
          }

          .statusPill {
            flex: 1;
          }

          .designNotes {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
