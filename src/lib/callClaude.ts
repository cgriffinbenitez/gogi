// callClaude.ts
// Shared utility for all client-side Claude API calls.
// Retries up to 3 times with exponential backoff. 30 second timeout per attempt.

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30_000;
const BASE_BACKOFF_MS = 500;

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

      if (!res.ok) {
        throw new Error(`Claude API error: ${res.status}`);
      }

      const data = await res.json();
      return (data.text as string) ?? '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on the last attempt
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(resolve =>
          setTimeout(resolve, BASE_BACKOFF_MS * 2 ** (attempt - 1)),
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
