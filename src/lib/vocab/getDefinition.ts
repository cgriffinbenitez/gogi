export interface VocabDefinition {
  word: string;
  part_of_speech: string;
  definition: string;
  example: string;
}

// Session-level in-memory cache — avoids duplicate network calls within one page load
const cache = new Map<string, VocabDefinition | null>();

export async function getDefinition(
  word: string,
  passageContext?: string,
): Promise<VocabDefinition | null> {
  const key = word.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch('/api/vocab/define', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, passageContext }),
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data: VocabDefinition = await res.json();
    cache.set(key, data);
    return data;
  } catch {
    cache.set(key, null);
    return null;
  }
}
