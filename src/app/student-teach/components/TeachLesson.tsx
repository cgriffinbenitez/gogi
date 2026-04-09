'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const lessonSections = [
  {
    id: 1,
    title: 'What Is a Universal Theme?',
    icon: '🌍',
    content: `A **universal theme** is a central message or insight about human life that appears across many different stories, cultures, and time periods. Unlike a topic (which is just a subject, like "friendship" or "loss"), a theme is a complete statement about that topic.

**Topic vs. Theme:**
- Topic: Friendship
- Theme: True friendship requires honesty, even when the truth is painful.

Universal themes resonate because they reflect experiences that all humans share — love, loss, courage, identity, belonging, and the passage of time.

**Common Universal Themes in Literature:**
• The struggle between good and evil
• The importance of family and tradition
• Coming of age and finding identity
• The power of perseverance in the face of hardship
• The conflict between individual freedom and social obligation
• The inevitability of change and the human response to it`,
    example: {
      title: 'Quick Example',
      text: 'In "The Old Man and the River," Elias returns to the river every morning even after his family has left and his community has changed. The theme is not simply "old man fishes" — it is: **Staying connected to meaningful rituals preserves identity and passes wisdom across generations.**',
    },
  },
  {
    id: 2,
    title: 'How Themes Develop in a Text',
    icon: '📈',
    content: `Authors don't just state themes directly — they **develop** them through literary elements. Your job as a reader is to trace how these elements work together to build the theme.

**Key Elements That Develop Theme:**

**1. Character Change (Arc)**
How does the character grow, change, or fail to change? What does that reveal about the theme?

**2. Conflict**
What is the character struggling against — themselves, another person, society, or nature? The nature of the conflict often points directly to the theme.

**3. Symbols**
Objects, places, or actions that represent larger ideas. A river might symbolize time or continuity. A garden might symbolize inherited identity.

**4. Repetition**
When an author repeats an image, phrase, or situation, pay attention — it's usually thematically significant.

**5. Resolution**
How the conflict resolves (or doesn't) reveals what the author believes about the theme.`,
    example: {
      title: 'Tracing Theme Development',text: 'In "The Last Garden," Yolanda initially resists the garden (conflict). She discovers her grandmother\'s journal (symbol). She plants tulips — something new (character change). The resolution: she understands the garden as a generational conversation. Each element builds toward the theme: **Individuals are part of a larger story that connects past, present, and future.**',
    },
  },
  {
    id: 3,
    title: 'Identifying Theme: A Step-by-Step Strategy',
    icon: '🔍',
    content: `Use this strategy every time you need to identify or analyze a theme:

**Step 1: Identify the Topic**
Ask: What is this story mostly about? (friendship, loss, courage, identity, change)

**Step 2: Notice What Happens to the Main Character**
Ask: What does the character want? What gets in the way? How do they respond?

**Step 3: Look for the Author's Message**
Ask: What does the story seem to be saying about that topic? What lesson or insight does the character's journey reveal?

**Step 4: State the Theme as a Complete Sentence**
Avoid one-word themes. Instead of "courage," write: "True courage means acting despite fear, not in the absence of it."

**Step 5: Find Evidence**
Identify 2–3 specific moments in the text that support your theme statement.`,
    example: {
      title: 'Strategy in Action',
      text: `**Text:** "The Weight of Wings" — Mara leaves home to escape her past, but her music teacher tells her she "plays like someone running away." At the recital, she plays toward something instead of away from it, then calls her mother.

**Step 1:** Topic = freedom / identity
**Step 2:** Mara wants freedom; her past blocks her; she learns to move toward connection
**Step 3:** Message = real freedom isn't escape — it's choosing your own path
**Step 4:** Theme = **True freedom comes not from running away from the past, but from consciously choosing what to carry forward.**
**Step 5:** Evidence = professor's comment, recital shift, phone call home`,
    },
  },
  {
    id: 4,
    title: 'Common Pitfalls to Avoid',icon: '⚠️',
    content: `Watch out for these common mistakes when analyzing universal themes:

**Pitfall 1: Stating a topic instead of a theme**
❌ "This story is about courage." ✅"This story shows that courage means continuing even when you have already lost everything."

**Pitfall 2: Overgeneralizing**
❌ "The theme is that life is hard."
✅ "The theme is that perseverance in the face of loss is what gives life meaning."

**Pitfall 3: Confusing plot with theme**
❌ "The theme is that the old man goes fishing every day." ✅"The theme is that meaningful rituals connect us to those we've lost and give us a sense of identity."

**Pitfall 4: Ignoring evidence**
A theme statement without textual support is just an opinion. Always anchor your theme to specific moments in the text.

**Pitfall 5: Assuming there is only one theme**
Complex literary texts often develop multiple themes simultaneously. You may be asked to identify the *most central* or *most fully developed* theme.`,
    example: {
      title: 'Fix the Mistake',
      text: `**Weak:** "The theme of 'The Last Garden' is gardening."**Better:** "The theme is that family traditions carry meaning across generations."**Strongest:** "The theme is that individuals are part of a living conversation with their ancestors — and that honoring that conversation while adding something new is how identity is preserved and renewed."`,
    },
  },
];

export default function TeachLesson() {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());

  const section = lessonSections[currentSection];
  const isLast = currentSection === lessonSections.length - 1;
  const allComplete = completedSections.size === lessonSections.length;

  const handleNext = () => {
    setCompletedSections(prev => new Set([...prev, currentSection]));
    if (!isLast) {
      setCurrentSection(prev => prev + 1);
    }
  };

  const handleFinish = () => {
    setCompletedSections(prev => new Set([...prev, currentSection]));
    router.push('/student-practice');
  };

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
        return <p key={i} className="font-bold text-white mt-4 mb-1">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.startsWith('•') || line.startsWith('•')) {
        return <li key={i} className="text-slate-300 text-sm ml-4 list-none flex gap-2"><span className="text-violet-400 mt-0.5">•</span><span>{line.replace(/^•\s*/, '')}</span></li>;
      }
      if (line.match(/^\*\*\d+\./)) {
        const parts = line.split('**');
        return (
          <p key={i} className="text-slate-300 text-sm mt-3">
            <span className="font-bold text-white">{parts[1]}</span>{parts[2] || ''}
          </p>
        );
      }
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} className="text-slate-300 text-sm mt-1">
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part)}
          </p>
        );
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-slate-300 text-sm mt-1">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-white tracking-tight">GOGI</span>
          <span className="text-violet-400 text-xs font-medium hidden sm:block">AI-Powered Literacy Platform</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-violet-400 font-mono">ELA.9.R.1.2</span>
          <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
            📚 Teach
          </span>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-400">Lesson Progress</span>
            <span className="text-xs text-violet-400 ml-auto">{completedSections.size}/{lessonSections.length} sections complete</span>
          </div>
          <div className="flex gap-1.5">
            {lessonSections.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSection(idx)}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  completedSections.has(idx) ? 'bg-emerald-500' :
                  idx === currentSection ? 'bg-violet-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-2xl flex-shrink-0">
              {section.icon}
            </div>
            <div>
              <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-0.5">
                Section {currentSection + 1} of {lessonSections.length}
              </div>
              <h1 className="text-white text-xl sm:text-2xl font-extrabold leading-tight">{section.title}</h1>
            </div>
          </div>

          {/* Content Card */}
          <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-6 mb-5">
            <div className="space-y-1">
              {renderContent(section.content)}
            </div>
          </div>

          {/* Example Box */}
          <div className="bg-violet-900/30 border border-violet-500/30 rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-violet-400 text-sm font-bold">💡 {section.example.title}</span>
            </div>
            <div className="space-y-1">
              {renderContent(section.example.text)}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
              disabled={currentSection === 0}
              className="px-5 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:border-violet-500/40 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {isLast ? (
              <button
                onClick={handleFinish}
                className="flex-1 max-w-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                <span>Lesson Complete — Start Practice</span>
                <span>→</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 max-w-xs bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>Next Section</span>
                <span>→</span>
              </button>
            )}
          </div>

          {/* Section Nav Pills */}
          <div className="mt-8 flex flex-wrap gap-2 justify-center">
            {lessonSections.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSection(idx)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  idx === currentSection
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : completedSections.has(idx)
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :'bg-white/5 border-white/10 text-slate-400 hover:border-violet-500/30 hover:text-white'
                }`}
              >
                {completedSections.has(idx) ? '✓ ' : ''}{s.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
