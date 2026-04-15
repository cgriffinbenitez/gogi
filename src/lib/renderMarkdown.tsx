// renderMarkdown.tsx
// Shared line-by-line markdown renderer for Gogi AI responses.
// Handles: blank lines, **heading-only** lines, mixed **bold** inline,
// numbered lists, bullet lists, and plain paragraphs.
// Used in TeachSession and ReassessSession.

import React from 'react';

export function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) {
      return <div key={i} className="h-2" />;
    }

    // **Heading** — entire line is bold
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      return (
        <p key={i} className="font-bold text-white mt-4 mb-1 text-sm">
          {line.replace(/\*\*/g, '')}
        </p>
      );
    }

    // Mixed **bold** inline
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-slate-300 text-sm mt-1 leading-relaxed">
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="text-white font-semibold">
                {part}
              </strong>
            ) : (
              part
            ),
          )}
        </p>
      );
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      return (
        <p key={i} className="text-slate-300 text-sm mt-2 leading-relaxed ml-2">
          {line}
        </p>
      );
    }

    // Bullet list item
    if (/^[-•]\s/.test(line)) {
      return (
        <li key={i} className="text-slate-300 text-sm mt-1 ml-4 list-disc leading-relaxed">
          {line.replace(/^[-•]\s/, '')}
        </li>
      );
    }

    return (
      <p key={i} className="text-slate-300 text-sm mt-1 leading-relaxed">
        {line}
      </p>
    );
  });
}
