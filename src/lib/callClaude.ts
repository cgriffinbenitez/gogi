// callClaude.ts
// Shared utility for all client-side Claude API calls.
// Retries up to 3 times with exponential backoff. 30 second timeout per attempt.
// 429 rate-limit responses are never retried — the server message is surfaced directly.

import { toast } from 'sonner';

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30_000;
const BASE_BACKOFF_MS = 500;

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function callClaude(
  action: string,
  params: Record<string, string>,
): Promise<string> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
        signal: controller.signal,
      });

      // Rate limit — never retry, show the server's human-readable message
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body.error === 'string'
            ? body.error
            : "You've been working hard. Take a short break and come back in a few minutes.";
        toast.error(message, { duration: 8_000 });
        throw new RateLimitError(message);
      }

      if (!res.ok) {
        throw new Error(`Claude API error: ${res.status}`);
      }

      const data = await res.json();
      return (data.text as string) ?? '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry rate limit errors or on the last attempt
      if (lastError instanceof RateLimitError || attempt >= MAX_ATTEMPTS) break;

      await new Promise(resolve =>
        setTimeout(resolve, BASE_BACKOFF_MS * 2 ** (attempt - 1)),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
