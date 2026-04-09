'use client';

import React, { useState, useCallback } from 'react';
import StudentTopBar from './StudentTopBar';
import PassagePanel from './PassagePanel';
import TaskPanel from './TaskPanel';
import AiTutorDrawer from './AiTutorDrawer';

export type TaskStep = 1 | 2 | 3;
export type HighlightedSpan = { start: number; end: number; text: string };

export const PASSAGE = {
  id: 'passage-001',
  title: 'The River and the Stone',
  author: 'Adapted from a Florida B.E.S.T. practice text',
  lexile: '940L',
  genre: 'Literary Nonfiction',
  wordCount: 412,
  estimatedMinutes: 8,
  gradeLevel: '8',
  bestStandards: ['ELA.8.R.1.1', 'ELA.8.R.1.3', 'ELA.8.C.1.2'],
  text: `For three hundred years, the Apalachicola River carved its way through the red clay hills of the Florida Panhandle, patient and unhurried, wearing down limestone and depositing sand bars in its slow migration to the Gulf. The river did not ask permission from the land. It simply moved, and the land changed.

Twelve-year-old Delia had grown up watching the river from the crooked porch of her grandmother's house in Blountstown. Every summer, the water rose and fell in cycles she had memorized without trying—the spring floods that swallowed the lower field, the August shallows where she could walk across on smooth stones, the October color of the water turning deep brown with tannins from upstream leaves. She knew the river the way she knew her own name.

But the summer she turned twelve was different. The river had been dropping for weeks, lower than anyone in the county could remember. The smooth stones she used to step across now sat high and dry, bleached pale by the sun. The cypress trees along the bank showed a white ring at their base—a waterline from a time when the river had been higher. Old Mr. Fenwick, who had lived on the river for seventy years, shook his head when Delia asked him about it.

"Upstream decisions," he said, which wasn't really an answer. But Delia understood, because she had been paying attention in Mrs. Carver's class about the dams and the water permits and the cities to the north that needed the water too. The river wasn't just a river anymore. It was a negotiation. That fall, Delia started keeping a journal. Every day she recorded the water level, the color, the animals she saw—or didn't see—along the bank. She photographed the white rings on the cypress trees. She wrote letters to the water management district that she never sent. She was building something she didn't have a name for yet: a record, a witness, an argument.

The river kept moving. Delia kept watching. Neither of them was willing to give up.`,
};

export const TASKS = [
  {
    id: 'task-001',
    step: 1 as TaskStep,
    type: 'Theme Identification',
    typeColor: 'violet',
    typeIcon: '🎯',
    standard: 'ELA.8.R.1.1',
    standardDesc: 'Analyze how theme is developed through characters, setting, and events',
    prompt: 'What is a central theme of "The River and the Stone"? Identify the theme in 1–2 sentences.',
    hint: 'Think about what both Delia and the river are doing throughout the story. What do their actions have in common?',
    placeholder: 'Type your theme statement here. Be specific — avoid vague phrases like "it\'s about nature."',
    maxWords: 50,
  },
  {
    id: 'task-002',step: 2 as TaskStep,type: 'Evidence Selection',typeColor: 'amber',typeIcon: '🔍',standard: 'ELA.8.R.1.3',standardDesc: 'Select and cite relevant textual evidence to support analysis',prompt: 'Highlight at least two pieces of evidence from the passage that support the theme you identified.',hint: 'Look for specific details about what Delia observes and what she decides to do. The evidence should connect directly to your theme.',placeholder: 'Highlight text in the passage on the left to select your evidence.',
    maxWords: 0,
  },
  {
    id: 'task-003',step: 3 as TaskStep,type: 'Reasoning Prompt',typeColor: 'emerald',typeIcon: '💡',standard: 'ELA.8.C.1.2',standardDesc: 'Explain how textual evidence supports a stated claim',prompt: 'Explain how your selected evidence supports the theme. What does the author want the reader to understand?',hint: 'Start with your theme, then connect each piece of evidence. Explain WHY the evidence supports the theme — don\'t just describe what happens.',
    placeholder: 'Write your reasoning here. Aim for 3–5 sentences that connect your evidence to the theme.',
    maxWords: 150,
  },
];

export default function StudentTaskPage() {
  const [currentStep, setCurrentStep] = useState<TaskStep>(1);
  const [taskResponses, setTaskResponses] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<HighlightedSpan[]>([]);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);

  const currentTask = TASKS.find((t) => t.step === currentStep)!;

  const handleResponseChange = useCallback((taskId: string, value: string) => {
    setTaskResponses((prev) => ({ ...prev, [taskId]: value }));
  }, []);

  const handleAddHighlight = useCallback((span: HighlightedSpan) => {
    setHighlights((prev) => [...prev, span]);
  }, []);

  const handleRemoveHighlight = useCallback((idx: number) => {
    setHighlights((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentTopBar
        currentStep={currentStep}
        totalSteps={TASKS.length}
        onAiTutorOpen={() => setAiDrawerOpen(true)}
        passageTitle={PASSAGE.title}
      />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Passage panel */}
        <PassagePanel
          passage={PASSAGE}
          highlightMode={highlightMode && currentStep === 2}
          highlights={highlights}
          onAddHighlight={handleAddHighlight}
          onRemoveHighlight={handleRemoveHighlight}
          currentStep={currentStep}
        />

        {/* Task panel */}
        <TaskPanel
          tasks={TASKS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          taskResponses={taskResponses}
          onResponseChange={handleResponseChange}
          highlights={highlights}
          highlightMode={highlightMode}
          onToggleHighlightMode={() => setHighlightMode((p) => !p)}
          onAiTutorOpen={() => setAiDrawerOpen(true)}
        />
      </div>

      {/* AI Tutor Drawer */}
      <AiTutorDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        currentTask={currentTask}
        passageTitle={PASSAGE.title}
      />
    </div>
  );
}