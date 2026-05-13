import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  hasScholarlyOrNonStudentFacingSignals,
  isGenreCompatibleForStandard,
} from '@/lib/teacher/officialCorpusGuards';

export const runtime = 'nodejs';

const CLAUDE_READY_PATH = path.join(process.cwd(), 'data', 'official-text-library', 'claude-ready-gold-cards.json');

type ClaudeReadyCard = {
  textTitle: string;
  standardCode: string;
  excerpt: string;
  question: string;
};

type ClaudeReadyCorpus = {
  generatedAt: string;
  summary: {
    readyCards: number;
    textsWithCards: number;
    standardsRepresented: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    cards: ClaudeReadyCard[];
    cardCount: number;
  }>;
};

const EMPTY_CORPUS: ClaudeReadyCorpus = {
  generatedAt: new Date().toISOString(),
  summary: {
    readyCards: 0,
    textsWithCards: 0,
    standardsRepresented: 0,
  },
  texts: [],
};

function filterCorpus(corpus: ClaudeReadyCorpus): ClaudeReadyCorpus {
  const texts = corpus.texts
    .map((text) => {
      const cards = (text.cards ?? []).filter((card) => {
        if (!isGenreCompatibleForStandard(card.textTitle ?? text.title, card.standardCode)) return false;
        return !hasScholarlyOrNonStudentFacingSignals({
          excerpt: card.excerpt,
          question: card.question,
          textTitleOrSelection: card.textTitle ?? text.title,
        });
      });

      return { ...text, cards, cardCount: cards.length };
    })
    .filter((text) => text.cards.length > 0);

  return {
    ...corpus,
    summary: {
      readyCards: texts.reduce((sum, text) => sum + text.cards.length, 0),
      textsWithCards: texts.length,
      standardsRepresented: new Set(texts.flatMap((text) => text.cards.map((card) => card.standardCode))).size,
    },
    texts,
  };
}

export async function GET() {
  try {
    let corpus: ClaudeReadyCorpus = EMPTY_CORPUS;
    try {
      corpus = JSON.parse(await fs.readFile(CLAUDE_READY_PATH, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    return NextResponse.json({ ok: true, corpus: filterCorpus(corpus) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/teacher/official-claude-ready-cards] error:', error);
    const message = error instanceof Error ? error.message : 'Could not load Claude-ready cards.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
