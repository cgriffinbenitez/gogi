'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Highlighter, Lightbulb, ChevronRight, ChevronLeft, CheckCircle, Loader2, Bot } from 'lucide-react';
import type { TaskStep, HighlightedSpan } from './StudentTaskPage';
import { TASKS } from './StudentTaskPage';

interface TaskPanelProps {
  tasks: typeof TASKS;
  currentStep: TaskStep;
  onStepChange: (step: TaskStep) => void;
  taskResponses: Record<string, string>;
  onResponseChange: (taskId: string, value: string) => void;
  highlights: HighlightedSpan[];
  highlightMode: boolean;
  onToggleHighlightMode: () => void;
  onAiTutorOpen: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const TYPE_BORDER: Record<string, string> = {
  violet: 'border-violet-400',
  amber: 'border-amber-400',
  emerald: 'border-emerald-400',
};

export default function TaskPanel({
  tasks,
  currentStep,
  onStepChange,
  taskResponses,
  onResponseChange,
  highlights,
  highlightMode,
  onToggleHighlightMode,
  onAiTutorOpen,
}: TaskPanelProps) {
  const [showHint, setShowHint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  const task = tasks.find((t) => t.step === currentStep)!;
  const response = taskResponses[task.id] || '';
  const wordCount = response.trim().split(/\s+/).filter(Boolean).length;
  const isEvidenceTask = task.step === 2;
  const hasContent = isEvidenceTask ? highlights.length >= 1 : response.trim().length > 20;

  const handleSubmitStep = async () => {
    if (!hasContent) {
      toast.error(
        isEvidenceTask
          ? 'Please highlight at least one piece of evidence in the passage.' :'Please write a response before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    // Backend integration point: POST /api/tasks/:taskId/submit with { response, highlights, timeSpent }
    await new Promise((r) => setTimeout(r, 1000));
    setIsSubmitting(false);
    setSubmitted((prev) => ({ ...prev, [currentStep]: true }));

    if (currentStep < 3) {
      toast.success(`Task ${currentStep} submitted! Moving to the next step.`);
      setTimeout(() => {
        onStepChange((currentStep + 1) as TaskStep);
        setShowHint(false);
      }, 600);
    } else {
      toast.success('All tasks complete! Great work — your teacher will review your responses.');
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 overflow-hidden" style={{ flex: 1 }}>
      {/* Task type header */}
      <div className={`border-b-4 ${TYPE_BORDER[task.typeColor]} bg-white px-6 py-4 flex-shrink-0`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border ${TYPE_COLORS[task.typeColor]}`}>
              {task.typeIcon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`badge border ${TYPE_COLORS[task.typeColor]} text-xs`}>
                  Task {task.step} of {tasks.length}
                </span>
                <span className={`badge border ${TYPE_COLORS[task.typeColor]} text-xs font-mono`}>
                  {task.standard}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">{task.type}</h3>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {tasks.map((t) => (
              <div
                key={`dot-${t.id}`}
                className={`rounded-full transition-all duration-200 ${
                  t.step === currentStep
                    ? 'w-6 h-3 bg-violet-600'
                    : submitted[t.step]
                    ? 'w-3 h-3 bg-emerald-500' :'w-3 h-3 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Standard description */}
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          <span className="font-semibold text-slate-600">Standard: </span>
          {task.standardDesc}
        </p>
      </div>

      {/* Task body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin flex flex-col gap-5">
        {/* Task prompt */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Your Task</p>
          <p className="text-base text-slate-900 leading-relaxed font-medium">{task.prompt}</p>
        </div>

        {/* Hint */}
        <div>
          <button
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-2 text-sm font-semibold text-amber-600 hover:text-amber-800 transition-colors"
          >
            <Lightbulb size={16} className="text-amber-500" />
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
          {showHint && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-4 fade-in">
              <p className="text-sm text-amber-800 leading-relaxed">{task.hint}</p>
            </div>
          )}
        </div>

        {/* Evidence task UI */}
        {isEvidenceTask ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onToggleHighlightMode}
              className={`flex items-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95 border-2 ${
                highlightMode
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                  : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Highlighter size={18} />
              {highlightMode ? 'Highlighting ON — select text in passage' : 'Start Highlighting Evidence'}
            </button>

            {highlights.length === 0 ? (
              <div className="bg-amber-50 border border-dashed border-amber-300 rounded-xl p-6 text-center">
                <span className="text-3xl mb-2 block">🔍</span>
                <p className="text-sm font-semibold text-amber-700">No evidence selected yet</p>
                <p className="text-xs text-amber-600 mt-1">
                  Turn on highlighting and select text from the passage that supports your theme.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {highlights.map((h, i) => (
                  <div
                    key={`task-hl-${i + 1}`}
                    className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{h.text}&rdquo;</p>
                  </div>
                ))}
                <p className="text-xs text-slate-500 text-center">
                  {highlights.length} piece{highlights.length !== 1 ? 's' : ''} of evidence selected
                  {highlights.length >= 2 && (
                    <span className="text-emerald-600 font-semibold"> ✓ Minimum met</span>
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Text response task UI */
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Your Response</label>
            {task.maxWords > 0 && (
              <p className="text-xs text-slate-400">
                Aim for 30–{task.maxWords} words. Be specific and use evidence from the text.
              </p>
            )}
            <textarea
              value={response}
              onChange={(e) => onResponseChange(task.id, e.target.value)}
              placeholder={task.placeholder}
              rows={7}
              className="input-field resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono tabular-nums ${
                task.maxWords > 0 && wordCount > task.maxWords ? 'text-rose-500' : 'text-slate-400'
              }`}>
                {wordCount} {task.maxWords > 0 ? `/ ${task.maxWords}` : ''} words
              </span>
              {wordCount >= 10 && (
                <span className="text-xs text-emerald-600 font-semibold">
                  ✓ Good start
                </span>
              )}
            </div>
          </div>
        )}

        {/* AI Tutor nudge */}
        <button
          onClick={onAiTutorOpen}
          className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 hover:bg-violet-100 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-violet-700">Ask the AI Tutor</span>
            <span className="text-xs text-violet-500">
              Stuck? Get a hint — the tutor guides your thinking, not gives answers.
            </span>
          </div>
          <ChevronRight size={16} className="text-violet-400 ml-auto group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <button
          onClick={() => {
            if (currentStep > 1) {
              onStepChange((currentStep - 1) as TaskStep);
              setShowHint(false);
            }
          }}
          disabled={currentStep === 1}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <div className="flex items-center gap-2 flex-1 justify-center">
          {submitted[currentStep] && (
            <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold">
              <CheckCircle size={16} />
              Submitted
            </div>
          )}
        </div>

        <button
          onClick={handleSubmitStep}
          disabled={isSubmitting || (submitted[currentStep] && currentStep === 3)}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
            currentStep === 3
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
          style={{ minWidth: '160px' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting…
            </>
          ) : currentStep === 3 ? (
            <>
              <CheckCircle size={16} />
              Submit All Tasks
            </>
          ) : (
            <>
              {isEvidenceTask ? 'Confirm Evidence' : 'Submit Response'}
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}