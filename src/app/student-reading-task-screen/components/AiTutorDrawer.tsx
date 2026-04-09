'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, RefreshCw } from 'lucide-react';

import { TASKS } from './StudentTaskPage';

interface AiTutorDrawerProps {
  open: boolean;
  onClose: () => void;
  currentTask: typeof TASKS[0];
  passageTitle: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-001',
    role: 'tutor',
    content: `Hi! I'm GOGI, your reading tutor. I'm here to help you think through the tasks — but I won't give you the answers directly. That's how your brain grows! 🧠\n\nWhat part of the current task are you finding tricky?`,
    timestamp: new Date(),
  },
];

const TUTOR_RESPONSES: Record<string, string[]> = {
  default: [
    "That's a great question! Let me help you think through it. Instead of telling you the answer, let me ask: what do you notice about how Delia responds to what's happening to the river?",
    "Good thinking! Now consider: what does the author repeat throughout the passage? Repetition often signals a theme. What idea keeps coming back?",
    "You're on the right track. Now ask yourself: what is the author trying to say about how people (or things) respond to change? Use evidence from the text to support your idea.",
    "Think about the final two sentences of the passage. What do Delia and the river have in common? That connection might be the heart of the theme.",
  ],
  theme: [
    "When identifying a theme, avoid summarizing the plot. Instead, ask: what lesson or insight does this story reveal about people, nature, or the world? Try to write it as a statement, not a question.",
    "A strong theme statement should be a complete sentence that expresses a universal idea. For example: 'Persistence in the face of loss can become a form of quiet resistance.' Does that pattern help you form yours?",
  ],
  evidence: [
    "For evidence, look for specific details — not general statements. Dialogue, concrete observations, and character actions make the strongest evidence. Which lines in the passage feel most specific and meaningful?",
    "When selecting evidence, ask: does this detail directly connect to my theme? If you have to stretch to explain the connection, it might not be the strongest choice. Keep looking!",
  ],
  reasoning: [
    "For your reasoning, use this structure: [Theme statement]. The author shows this when [evidence]. This matters because [explanation of connection]. Try drafting one sentence for each piece of evidence.",
    "Your reasoning should answer the question: WHY does this evidence support the theme? Don't just re-state what happens — explain what the detail reveals about the bigger idea.",
  ],
};

export default function AiTutorDrawer({ open, onClose, currentTask, passageTitle }: AiTutorDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [responseIndex, setResponseIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const getResponse = (input: string): string => {
    const lower = input.toLowerCase();
    let pool = TUTOR_RESPONSES.default;
    if (lower.includes('theme')) pool = TUTOR_RESPONSES.theme;
    else if (lower.includes('evidence') || lower.includes('highlight')) pool = TUTOR_RESPONSES.evidence;
    else if (lower.includes('reason') || lower.includes('explain')) pool = TUTOR_RESPONSES.reasoning;

    const response = pool[responseIndex % pool.length];
    setResponseIndex((i) => i + 1);
    return response;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Backend integration point: POST /api/ai-tutor/chat with { message, taskId, passageId, studentId }
    await new Promise((r) => setTimeout(r, 1200 + Math.floor(responseIndex * 100)));

    const tutorMsg: ChatMessage = {
      id: `msg-tutor-${Date.now()}`,
      role: 'tutor',
      content: getResponse(userMsg.content),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, tutorMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES);
    setResponseIndex(0);
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 slide-up"
        style={{ animation: 'slideInRight 0.25s ease-out forwards' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-700 to-indigo-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">GOGI AI Tutor</p>
              <p className="text-violet-200 text-xs">Guides your thinking — never gives answers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-xl hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title="Reset conversation"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Current task context */}
        <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex-shrink-0">
          <p className="text-xs text-violet-500 font-semibold uppercase tracking-wide mb-1">Current Task</p>
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentTask.typeIcon}</span>
            <div>
              <p className="text-sm font-semibold text-violet-800">{currentTask.type}</p>
              <p className="text-xs text-violet-600 font-mono">{currentTask.standard}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 fade-in ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {msg.role === 'tutor' && (
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user' ?'bg-violet-600 text-white rounded-tr-md' :'bg-slate-100 text-slate-800 rounded-tl-md'
                }`}
              >
                {msg.content.split('\n').map((line, li) => (
                  <span key={`line-${msg.id}-${li}`}>
                    {line}
                    {li < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 fade-in">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested prompts */}
        <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-thin flex-shrink-0">
          {[
            "I don't understand the task",
            "Help me find evidence",
            "What is a theme?",
            "How do I explain reasoning?",
          ].map((prompt) => (
            <button
              key={`prompt-${prompt}`}
              onClick={() => setInputValue(prompt)}
              className="flex-shrink-0 text-xs font-medium bg-violet-50 text-violet-600 border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-100 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-transparent transition-all">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the tutor anything…"
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
            >
              {isTyping ? (
                <Loader2 size={14} className="text-white animate-spin" />
              ) : (
                <Send size={14} className="text-white" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            The AI tutor asks questions to help you think — not to give answers.
          </p>
        </div>
      </div>
    </>
  );
}