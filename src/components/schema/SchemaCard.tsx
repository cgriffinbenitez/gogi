'use client';

import { useState } from 'react';
import { FONTS } from '@/lib/constants/design';
import { MODE_LABELS } from '@/lib/schema/SchemaModeSelector';
import type { SchemaPayload } from '@/lib/schema/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORD_THRESHOLD = 15;

// ─── Dot anchor ───────────────────────────────────────────────────────────────

function Dot() {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: '#2E75B6', flexShrink: 0, marginTop: 5,
    }} />
  );
}

// ─── SchemaCard ───────────────────────────────────────────────────────────────

interface SchemaCardProps {
  payload: SchemaPayload;
  interventionId: string | null;
  studentId: string;
  onUnlock: () => void;
  introMessage?: string;
}

export function SchemaCard({
  payload,
  interventionId,
  studentId,
  onUnlock,
  introMessage,
}: SchemaCardProps) {
  const [prediction, setPrediction]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [feedback,   setFeedback]       = useState('');
  const [feedbackOk, setFeedbackOk]     = useState(false);
  const [unlocked,   setUnlocked]       = useState(false);

  const wordCount  = prediction.trim().split(/\s+/).filter(Boolean).length;
  const isValid    = wordCount >= WORD_THRESHOLD;
  const modeLabel  = MODE_LABELS[payload.schemaMode] ?? 'Schema';

  async function handleSubmit() {
    if (!isValid || submitting || unlocked) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/schema/submit-response', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaInterventionId: interventionId,
          studentId,
          responseText: prediction,
        }),
      });
      const data = await res.json() as { microFeedback?: string; unlockPassage?: boolean };
      setFeedback(data.microFeedback ?? "Good start. Keep that idea in mind as you read.");
      setFeedbackOk(true);
      setUnlocked(true);

      // Auto-proceed after brief feedback display
      setTimeout(() => onUnlock(), 2200);
    } catch {
      // Fail open — unlock anyway
      setUnlocked(true);
      setTimeout(() => onUnlock(), 800);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      fontFamily: FONTS.ui,
      overflowY: 'auto',
    }}>
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '24px 20px 40px',
      }}>

        {/* Optional intro message (for second-pass / teach context) */}
        {introMessage && (
          <div style={{
            background: '#E6F1FB',
            borderLeft: '3px solid #2E75B6',
            borderRadius: '0 6px 6px 0',
            padding: '10px 14px',
            marginBottom: 18,
            fontSize: 13,
            color: '#1F4E79',
            lineHeight: 1.5,
          }}>
            {introMessage}
          </div>
        )}

        {/* ── Top label row ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 14,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#2E75B6',
            textTransform: 'uppercase', letterSpacing: 1.5,
          }}>
            BEFORE YOU READ
          </div>
          <div style={{
            background: '#E6F1FB', border: '1px solid #B5D4F4',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 9, fontWeight: 700, color: '#0C447C',
          }}>
            {modeLabel}
          </div>
        </div>

        {/* ── Topic frame (most prominent) ── */}
        <div style={{
          fontSize: 16, fontWeight: 700, color: '#1F4E79',
          lineHeight: 1.5, margin: '14px 0 16px',
        }}>
          {payload.topicFrame}
        </div>

        {/* ── Knowledge anchors ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#888780',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
          }}>
            WHAT TO KNOW GOING IN
          </div>
          {payload.knowledgeAnchors.map((anchor, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6,
            }}>
              <Dot />
              <span style={{ fontSize: 13, color: '#2C2C2A', lineHeight: 1.45 }}>
                {anchor}
              </span>
            </div>
          ))}
        </div>

        {/* ── Bridge / analogy ── */}
        <div style={{
          background: '#E6F1FB', borderRadius: 8,
          padding: '10px 12px', margin: '12px 0',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#2E75B6',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
          }}>
            THINK OF IT THIS WAY
          </div>
          <div style={{ fontSize: 13, color: '#1F4E79', lineHeight: 1.5 }}>
            {payload.analogyOrBridge}
          </div>
        </div>

        {/* ── Misconception guardrail ── */}
        <div style={{
          background: '#FAEEDA', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#BA7517',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
          }}>
            DON&rsquo;T ASSUME
          </div>
          <div style={{ fontSize: 12, color: '#633806' }}>
            {payload.misconceptionGuardrail}
          </div>
        </div>

        {/* ── Reading lens ── */}
        <div style={{
          background: '#F2F2F2', borderLeft: '3px solid #2E75B6',
          borderRadius: '0 6px 6px 0', padding: '10px 12px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#888780',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
          }}>
            AS YOU READ, WATCH FOR:
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F4E79' }}>
            {payload.readingLens}
          </div>
        </div>

        {/* ── Prediction prompt ── */}
        <div style={{ marginBottom: feedbackOk ? 12 : 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#2E75B6',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
          }}>
            BEFORE YOU START — ANSWER THIS:
          </div>
          <div style={{
            fontSize: 14, color: '#2C2C2A', lineHeight: 1.5, marginBottom: 10,
          }}>
            {payload.predictionPrompt}
          </div>
          <textarea
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            disabled={unlocked}
            placeholder="Write your answer here..."
            style={{
              background: '#F2F2F2',
              border: `1.5px solid ${isValid ? '#3B6D11' : '#B5D4F4'}`,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              minHeight: 72,
              width: '100%',
              resize: 'none',
              fontFamily: FONTS.ui,
              color: '#2C2C2A',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
              cursor: unlocked ? 'not-allowed' : 'text',
            }}
          />
        </div>

        {/* ── Micro feedback ── */}
        {feedbackOk && feedback && (
          <div style={{
            background: '#C6EFCE', borderRadius: 6,
            padding: '8px 12px', fontSize: 12,
            color: '#27500A', marginBottom: 12,
          }}>
            {feedback}
          </div>
        )}

        {/* ── Unlock button ── */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting || unlocked}
          style={{
            width: '100%',
            background: isValid && !submitting && !unlocked ? '#1F4E79' : '#B5D4F4',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 10,
            padding: 13,
            fontSize: 14,
            fontWeight: 700,
            cursor: isValid && !submitting && !unlocked ? 'pointer' : 'not-allowed',
            fontFamily: FONTS.ui,
            transition: 'background 0.2s',
            marginTop: 8,
          }}
        >
          {submitting
            ? 'Saving your answer…'
            : unlocked
              ? 'Opening the passage…'
              : "I'm ready — Show me the passage →"}
        </button>
      </div>
    </div>
  );
}
