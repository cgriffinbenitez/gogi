export function validateResponse(text: string, prompt?: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 25) return false;

  // Require at least 2 sentence-ending punctuation marks
  const sentenceEndings = (trimmed.match(/[.!?]/g) ?? []).length;
  if (sentenceEndings < 2) return false;

  // Block single-character repetition (iiiii, kkkkk, etc.)
  if (/^(.)\1+$/.test(trimmed)) return false;

  // Block common bypass attempts
  const bypasses = ['idk', 'i dont know', 'n/a', 'na', 'ok', 'okay', 'yes', 'no', 'none', 'same', 'good', 'fine'];
  if (bypasses.includes(trimmed.toLowerCase())) return false;

  // Block pure repetition of the prompt
  if (prompt) {
    const promptWords = prompt.toLowerCase().split(/\s+/);
    const responseWords = trimmed.toLowerCase().split(/\s+/);
    const overlap = responseWords.filter(w => promptWords.includes(w)).length;
    if (overlap / responseWords.length > 0.8) return false;
  }

  return true;
}

export function getValidationMessage(text: string): string {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (!trimmed) return 'Write your response here — at least two full sentences.';
  if (wordCount < 25) return 'Write more — at least 3-4 full sentences to show your thinking.';
  return 'Write more — at least 3-4 full sentences to show your thinking.';
}
