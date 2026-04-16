/**
 * Strips diagnostic question markers from passage content before display or API use.
 *
 * Diagnostic content format in the questions table:
 *   PASSAGE: [literary text]
 *   QUESTION: [stem]
 *   A) [option]  B) [option]  C) [option]  D) [option]
 *   CORRECT: [letter]
 *
 * This utility returns only the literary passage text, cleaned of all artifacts.
 */
export function cleanPassageText(content: string): string {
  if (!content) return '';

  // Truncate at the first occurrence of any diagnostic marker
  // (handles both newline-preceded and line-start cases)
  const diagnosticMarkerRe = /\n(?:QUESTION:|CORRECT:|[A-D][).]\s)/;
  const markerIdx = content.search(diagnosticMarkerRe);
  let cleaned = markerIdx > 0 ? content.slice(0, markerIdx) : content;

  // Strip PASSAGE: prefix
  cleaned = cleaned.replace(/^PASSAGE:\s*/i, '');

  // Strip (Paragraph N) annotations
  cleaned = cleaned.replace(/\(Paragraph\s+\d+\)/gi, '');

  // Strip --- delimiter lines
  cleaned = cleaned.replace(/^-{2,}\s*$/gm, '');

  // Collapse 3+ newlines → double
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}
