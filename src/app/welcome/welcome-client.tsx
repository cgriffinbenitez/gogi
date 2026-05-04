'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StudentWelcomePayload } from '@/lib/welcome/payload';
import type { ReactNode } from 'react';

type WelcomeClientProps = {
  studentId: string;
  preview?: boolean;
  loginReplay?: boolean;
};

type FrameKey = 'greeting' | 'trajectory' | 'strength' | 'destination' | 'generic';

type TimedFrame = {
  key: FrameKey;
  content: ReactNode;
  cta?: string;
};

export default function WelcomeClient({
  studentId,
  preview = false,
  loginReplay = false,
}: WelcomeClientProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<StudentWelcomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const frameStartedAt = useRef(Date.now());
  const frameEvents = useRef<Array<{ frame_key: string; time_on_frame_ms: number }>>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/welcome/student/${studentId}`);
      const body = (await response.json()) as {
        error?: string;
        welcomeCompletedAt?: string | null;
        payload?: StudentWelcomePayload;
      };

      if (!response.ok || !body.payload) {
        setError(body.error ?? 'Could not load Welcome.');
        setLoading(false);
        return;
      }

      if (body.welcomeCompletedAt && !preview && !loginReplay) {
        router.replace('/dashboard/student');
        return;
      }

      setPayload(body.payload);
      setLoading(false);
    }

    load();
  }, [loginReplay, preview, router, studentId]);

  const frames = useMemo<TimedFrame[]>(() => {
    if (!payload) return [];

    if (!payload.hasProfile) {
      return [
        {
          key: 'generic',
          content: (
            <>
              <h1>Welcome, {payload.firstName}.</h1>
              <p>Let&apos;s begin.</p>
            </>
          ),
          cta: 'Begin',
        },
      ];
    }

    const built: TimedFrame[] = [
      {
        key: 'greeting',
        content: <h1>Welcome, {payload.firstName}.</h1>,
      },
    ];

    if (payload.frames.trajectory) {
      built.push({
        key: 'trajectory',
        content: (
          <div className="truthFrame">
            {payload.frames.trajectory.scores.length > 1 ? (
              <div className="scoreLine">{payload.frames.trajectory.scores.join(' -> ')}</div>
            ) : null}
            {payload.frames.trajectory.copy.split('\n').map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ),
      });
    }

    if (payload.frames.strength) {
      const strength = payload.frames.strength;
      built.push({
        key: 'strength',
        content: (
          <div className="truthFrame">
            {strength.relative ? (
              <p>{strength.gloss}</p>
            ) : (
              <>
                <p>You&apos;re strong at {strength.strengthLabel}.</p>
                <p>{strength.gloss}</p>
              </>
            )}
          </div>
        ),
      });
    }

    if (payload.frames.destination) {
      const destination = payload.frames.destination;
      built.push({
        key: 'destination',
        content: (
          <div className="destinationGrid">
            <div className="scoreCard">
              <span>{destination.scoreLabel ?? 'Score'}</span>
              <strong>{destination.currentScore ?? 'Ready'}</strong>
            </div>
            <div className="destinationCopy">
              {destination.copy.split('\n').map((line) => (
                <p key={line}>{line}</p>
              ))}
              {destination.yearGoalRange ? (
                <div className="goalStrip">
                  <span>This year&apos;s target</span>
                  <strong>{destination.yearGoalRange}</strong>
                </div>
              ) : null}
            </div>
          </div>
        ),
        cta: 'Begin',
      });
    }

    return built;
  }, [payload]);

  async function advance() {
    const current = frames[frameIndex];
    if (!current || !payload) return;

    frameEvents.current.push({
      frame_key: current.key,
      time_on_frame_ms: Date.now() - frameStartedAt.current,
    });
    frameStartedAt.current = Date.now();

    if (frameIndex < frames.length - 1) {
      setFrameIndex((index) => index + 1);
      return;
    }

    if (!preview && !loginReplay) {
      await fetch(`/api/welcome/student/${studentId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: frameEvents.current }),
      });
    }

    router.push(
      preview
        ? `${payload.doorwayTarget}?preview=1`
        : loginReplay
          ? '/dashboard/student'
          : payload.doorwayTarget
    );
  }

  if (loading) {
    return (
      <main className="welcomeRoot">
        <p className="loading">Loading...</p>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (error || !payload || frames.length === 0) {
    return (
      <main className="welcomeRoot">
        <div className="frame">
          <p>{error ?? "Let's begin."}</p>
          <button onClick={() => router.push('/dashboard/student')}>Begin</button>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  const currentFrame = frames[frameIndex];
  const isFinal = frameIndex === frames.length - 1;

  return (
    <main className="welcomeRoot" onClick={() => !isFinal && advance()}>
      <section className="frame" key={currentFrame.key}>
        {currentFrame.content}
        {isFinal ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              advance();
            }}
          >
            {currentFrame.cta ?? 'Begin'}
          </button>
        ) : (
          <div className="tapHint">Tap to continue</div>
        )}
      </section>

      <div className="dots" aria-hidden="true">
        {frames.map((frame, index) => (
          <span key={frame.key} className={index === frameIndex ? 'active' : ''} />
        ))}
      </div>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .welcomeRoot {
    min-height: 100vh;
    background: #07111f;
    color: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .frame {
    width: min(820px, 100%);
    min-height: 360px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
  }

  h1 {
    font-size: 56px;
    line-height: 1.02;
    font-weight: 800;
    margin: 0;
    letter-spacing: 0;
  }

  p {
    font-size: 38px;
    line-height: 1.16;
    font-weight: 720;
    margin: 0;
    letter-spacing: 0;
  }

  .scoreLine {
    color: #93c5fd;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0;
  }

  .truthFrame {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .destinationGrid {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 34px;
    align-items: center;
  }

  .scoreCard {
    aspect-ratio: 1;
    border-radius: 18px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(147,197,253,0.24);
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 24px;
    box-shadow: 0 22px 60px rgba(0,0,0,0.24);
  }

  .scoreCard span,
  .goalStrip span {
    color: #93c5fd;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .scoreCard strong {
    margin-top: 10px;
    color: #ffffff;
    font-size: 54px;
    line-height: 1;
    letter-spacing: 0;
  }

  .destinationCopy {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .goalStrip {
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 14px;
    border-radius: 999px;
    background: rgba(37,99,235,0.16);
    border: 1px solid rgba(147,197,253,0.25);
    padding: 10px 16px;
  }

  .goalStrip strong {
    color: #ffffff;
    font-size: 18px;
    letter-spacing: 0;
  }

  .tapHint {
    color: #94a3b8;
    font-size: 14px;
    font-weight: 650;
    margin-top: 36px;
  }

  button {
    align-self: flex-start;
    border: 0;
    border-radius: 10px;
    background: #ffffff;
    color: #07111f;
    padding: 13px 24px;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
  }

  .dots {
    position: fixed;
    bottom: 28px;
    display: flex;
    gap: 8px;
  }

  .dots span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: rgba(255,255,255,0.22);
  }

  .dots span.active {
    width: 24px;
    background: #ffffff;
  }

  .loading {
    color: #94a3b8;
    font-size: 16px;
  }

  @media (max-width: 640px) {
    .welcomeRoot {
      align-items: flex-start;
      padding-top: 96px;
    }

    h1 {
      font-size: 42px;
    }

    p {
      font-size: 30px;
    }

    .scoreLine {
      font-size: 24px;
    }

    .destinationGrid {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .scoreCard {
      width: 150px;
      aspect-ratio: 1;
    }

    .scoreCard strong {
      font-size: 44px;
    }

    .goalStrip {
      align-items: flex-start;
      flex-direction: column;
      border-radius: 14px;
      gap: 4px;
    }
  }
`;
