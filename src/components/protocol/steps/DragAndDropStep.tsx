'use client';

// DragAndDropStep.tsx
// Student organizes draggable item cards into labeled category drop zones.
// Desktop: HTML5 drag-and-drop. Mobile: tap item to select, tap category to assign.
//
// content prop format — two sections separated by ---:
//   [Gogi instruction text]
//   ---
//   ITEMS: item one | item two | item three
//   CATEGORIES: Category One | Category Two
//
// Submitted string format:
//   CATEGORY: Main Idea → item one | item two
//   CATEGORY: Supporting Detail → item three

import React, { useState, useMemo } from 'react';
import GogiAvatar from '@/components/GogiAvatar';

export interface DragAndDropStepProps {
  content: string;
  scaffoldsActive: boolean;
  onSubmit: (response: string) => void;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseContent(content: string): {
  instruction: string;
  items: string[];
  categories: string[];
} {
  const delimIdx = content.search(/^---\s*$/m);
  const instruction = delimIdx === -1 ? content.trim() : content.slice(0, delimIdx).trim();
  const below = delimIdx === -1 ? '' : content.slice(delimIdx).replace(/^---\s*$/m, '').trim();

  let items: string[] = [];
  let categories: string[] = [];

  for (const line of below.split('\n')) {
    const itemsMatch = line.match(/^ITEMS:\s*(.+)$/);
    const categoriesMatch = line.match(/^CATEGORIES:\s*(.+)$/);
    if (itemsMatch) {
      items = itemsMatch[1].split('|').map(s => s.trim()).filter(Boolean);
    }
    if (categoriesMatch) {
      categories = categoriesMatch[1].split('|').map(s => s.trim()).filter(Boolean);
    }
  }

  return { instruction, items, categories };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    if (line.includes('**')) {
      const parts = line.split('**');
      return (
        <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">
          {parts.map((p, j) =>
            j % 2 === 1 ? (
              <strong key={j} className="font-semibold text-slate-900">{p}</strong>
            ) : (
              p
            ),
          )}
        </p>
      );
    }
    return <p key={i} className="text-slate-700 text-sm leading-relaxed mt-1">{line}</p>;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DragAndDropStep({
  content,
  scaffoldsActive,
  onSubmit,
}: DragAndDropStepProps) {
  const { instruction, items, categories } = useMemo(() => parseContent(content), [content]);

  // item text → category name (null = unassigned)
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    () => Object.fromEntries(items.map(item => [item, null])),
  );

  // desktop: item being dragged
  const [dragItem, setDragItem] = useState<string | null>(null);
  // desktop: category zone currently hovered
  const [dragOver, setDragOver] = useState<string | null>(null);
  // mobile: item selected via tap, waiting for category tap
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const unassigned = items.filter(item => assignments[item] === null);
  const allAssigned = items.length > 0 && items.every(item => assignments[item] !== null);
  const hasTapTarget = selectedItem !== null;

  const btnClass = scaffoldsActive
    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20';

  // ─── Desktop drag handlers ──────────────────────────────────────────────────

  function handleDragStart(item: string) {
    setDragItem(item);
    setSelectedItem(null);
  }

  function handleDragOver(e: React.DragEvent, category: string) {
    e.preventDefault();
    setDragOver(category);
  }

  function handleDrop(category: string) {
    if (!dragItem) return;
    setAssignments(prev => ({ ...prev, [dragItem]: category }));
    setDragItem(null);
    setDragOver(null);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  function handleDropToHolding(e: React.DragEvent) {
    e.preventDefault();
    if (!dragItem) return;
    setAssignments(prev => ({ ...prev, [dragItem]: null }));
    setDragItem(null);
    setDragOver(null);
  }

  // ─── Mobile tap handlers ────────────────────────────────────────────────────

  function handleItemTap(item: string) {
    // Tapping the already-selected item deselects it
    setSelectedItem(prev => (prev === item ? null : item));
  }

  function handleCategoryTap(category: string) {
    if (!selectedItem) return;
    setAssignments(prev => ({ ...prev, [selectedItem]: category }));
    setSelectedItem(null);
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────

  function handleReset() {
    setAssignments(Object.fromEntries(items.map(item => [item, null])));
    setSelectedItem(null);
    setDragItem(null);
    setDragOver(null);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!allAssigned) return;
    const lines = categories.map(cat => {
      const catItems = items.filter(item => assignments[item] === cat);
      return `CATEGORY: ${cat} → ${catItems.join(' | ')}`;
    });
    onSubmit(lines.join('\n'));
  }

  // ─── Guard ─────────────────────────────────────────────────────────────────

  if (!content.trim() || items.length === 0 || categories.length === 0) {
    return (
      <div className="p-4 md:p-6 flex items-center gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <p className="text-slate-400 text-sm animate-pulse">Gogi is preparing this activity…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Gogi instruction bubble ── */}
      <div className="flex items-start gap-3">
        <GogiAvatar />
        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex-1">
          <div className="space-y-0.5">{renderText(instruction)}</div>
        </div>
      </div>

      {/* ── Holding area (unassigned items) ── */}
      {unassigned.length > 0 && (
        <div
          className="bg-white/5 border border-white/10 rounded-xl p-3 min-h-[60px]"
          onDragOver={e => { e.preventDefault(); }}
          onDrop={handleDropToHolding}
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Items to sort
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(item => (
              <div
                key={item}
                draggable
                onDragStart={() => handleDragStart(item)}
                onClick={() => handleItemTap(item)}
                className={[
                  'px-3 py-2 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all',
                  selectedItem === item
                    ? 'bg-violet-700 border border-violet-400 text-white shadow-md shadow-violet-500/30'
                    : 'bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600',
                ].join(' ')}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Category drop zones ── */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catItems = items.filter(item => assignments[item] === cat);
          const isOver = dragOver === cat;

          return (
            <div
              key={cat}
              onDragOver={e => handleDragOver(e, cat)}
              onDrop={() => handleDrop(cat)}
              onDragLeave={handleDragLeave}
              onClick={() => hasTapTarget && handleCategoryTap(cat)}
              className={[
                'rounded-xl border-2 border-dashed p-3 min-h-[64px] transition-all',
                isOver
                  ? 'border-violet-400 bg-violet-900/20'
                  : hasTapTarget
                    ? 'border-violet-500/50 bg-violet-900/10 cursor-pointer'
                    : 'border-white/15 bg-white/3',
              ].join(' ')}
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {catItems.map(item => (
                  <div
                    key={item}
                    draggable
                    onDragStart={() => handleDragStart(item)}
                    onClick={e => { e.stopPropagation(); handleItemTap(item); }}
                    className={[
                      'px-3 py-2 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all',
                      selectedItem === item
                        ? 'bg-violet-700 border border-violet-400 text-white shadow-md shadow-violet-500/30'
                        : 'bg-emerald-900/60 border border-emerald-700/50 text-emerald-100 hover:bg-emerald-900/80',
                    ].join(' ')}
                  >
                    {item}
                  </div>
                ))}
                {catItems.length === 0 && (
                  <p className="text-slate-600 text-xs italic self-center">
                    {hasTapTarget ? 'Tap here to place selected item' : 'Drop here'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Controls row ── */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
        >
          Reset
        </button>
        <div className="flex items-center gap-3">
          {scaffoldsActive && !allAssigned && (
            <p className="text-xs text-slate-500">
              {selectedItem
                ? `"${selectedItem}" selected — tap a category`
                : 'Drag items into categories, or tap to select'}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!allAssigned}
            className={`flex-shrink-0 ${btnClass} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
