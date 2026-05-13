import fs from 'fs/promises';
import path from 'path';
import { validateLessonExcerptMarkdown } from '../src/lib/teacher/lessonExcerptFiles';

async function collectMarkdownFiles(inputPath: string): Promise<string[]> {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) return inputPath.endsWith('.md') ? [inputPath] : [];

  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => collectMarkdownFiles(path.join(inputPath, entry.name)).catch(() => []))
  );
  return nested.flat();
}

async function main() {
  const target = process.argv[2] ?? 'data/lesson-generator/excerpts';
  const absoluteTarget = path.resolve(process.cwd(), target);
  const files = await collectMarkdownFiles(absoluteTarget);

  if (!files.length) {
    console.log(`No lesson excerpt markdown files found at ${target}`);
    return;
  }

  let failed = 0;
  for (const file of files) {
    const markdown = await fs.readFile(file, 'utf8');
    const result = validateLessonExcerptMarkdown(markdown);
    const relative = path.relative(process.cwd(), file);
    const label = result.ok ? 'PASS' : 'FAIL';
    console.log(`\n${label} ${relative}`);

    if (result.excerpt) {
      console.log(
        `  ${result.excerpt.title} — ${result.excerpt.author} · ${result.excerpt.standards_supported.join(', ')}`
      );
      console.log(
        `  ${result.excerpt.text_clean.split(/\s+/).filter(Boolean).length} words · ${result.excerpt.vocab.length} vocab · ${result.excerpt.worked_examples.length} worked examples`
      );
    }

    for (const warning of result.warnings) console.log(`  warning: ${warning}`);
    for (const error of result.errors) console.log(`  error: ${error}`);
    if (!result.ok) failed += 1;
  }

  if (failed) {
    console.error(`\n${failed}/${files.length} lesson excerpt files failed validation.`);
    process.exit(1);
  }

  console.log(`\nAll ${files.length} lesson excerpt files passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
