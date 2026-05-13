import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { validateLessonExcerptMarkdown } from '@/lib/teacher/lessonExcerptFiles';

export const runtime = 'nodejs';

const EXCERPTS_DIR = path.join(process.cwd(), 'data', 'lesson-generator', 'excerpts');

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return markdownFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
    })
  );
  return nested.flat();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code');
    const files = await markdownFiles(EXCERPTS_DIR);
    const packets = [];

    for (const file of files) {
      const markdown = await fs.readFile(file, 'utf8');
      const validation = validateLessonExcerptMarkdown(markdown);
      const excerpt = validation.excerpt;
      if (!excerpt) continue;
      if (standardCode && !excerpt.standards_supported.includes(standardCode)) continue;

      packets.push({
        id: excerpt.id || path.basename(file, '.md'),
        file: path.relative(process.cwd(), file),
        status: validation.ok ? 'ready' : 'needs_cleanup',
        title: excerpt.title,
        author: excerpt.author,
        chapter_or_section: excerpt.chapter_or_section,
        standards_supported: excerpt.standards_supported,
        text_clean: excerpt.text_clean,
        word_count: excerpt.text_clean.split(/\s+/).filter(Boolean).length,
        vocab: excerpt.vocab,
        worked_examples: excerpt.worked_examples,
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    packets.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ready' ? -1 : 1;
      return `${a.title} ${a.chapter_or_section}`.localeCompare(`${b.title} ${b.chapter_or_section}`);
    });

    return NextResponse.json({ packets });
  } catch (error) {
    console.error('[api/teacher/lesson-excerpts] error:', error);
    return NextResponse.json({ error: 'Could not load lesson excerpt packets.' }, { status: 500 });
  }
}
