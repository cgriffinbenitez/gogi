// useStreamingClaude.ts
// Hook for consuming Claude's SSE streaming responses from /api/claude.
// Falls back to non-streaming callClaude on any stream error.
//
// Usage:
//   const { content, isStreaming, error, startStreaming } = useStreamingClaude();
//   const finalText = await startStreaming('generate_protocol_step_content', { ... });
//
// `content` updates progressively as chunks arrive — bind it to UI state.
// `startStreaming` also returns the final accumulated string for cases where
// the caller needs the full text after the await resolves.

import { useState, useCallback } from 'react';
import { callClaude } from './callClaude';

export function useStreamingClaude() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStreaming = useCallback(
    async (action: string, payload: Record<string, string>): Promise<string> => {
      setContent('');
      setError(null);
      setIsStreaming(true);

      let accumulated = '';

      try {
        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentType = res.headers.get('content-type') ?? '';

        if (contentType.includes('text/event-stream') && res.body) {
          // ── Parse Anthropic SSE stream ─────────────────────────────────────
          // Anthropic events of interest:
          //   event: content_block_delta
          //   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Split on newlines, keep incomplete last line in buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data) as {
                  type: string;
                  delta?: { type: string; text?: string };
                };
                if (
                  parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  parsed.delta.text
                ) {
                  accumulated += parsed.delta.text;
                  setContent(accumulated);
                }
              } catch {
                // Skip non-JSON lines (event: lines, pings, etc.)
              }
            }
          }
        } else {
          // Server returned non-streaming JSON (e.g., action not in streaming set)
          const data = (await res.json()) as { text?: string };
          accumulated = data.text ?? '';
          setContent(accumulated);
        }
      } catch (err) {
        // ── Fallback: non-streaming callClaude ─────────────────────────────
        console.warn('[useStreamingClaude] Stream failed, falling back:', err);
        try {
          accumulated = await callClaude(action, payload);
          setContent(accumulated);
        } catch (fallbackErr) {
          const msg =
            fallbackErr instanceof Error ? fallbackErr.message : 'Failed to generate content';
          setError(msg);
        }
      } finally {
        setIsStreaming(false);
      }

      return accumulated;
    },
    [],
  );

  return { content, isStreaming, error, startStreaming };
}
