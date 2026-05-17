import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type StandardRow = {
  id: string;
  code: string;
};

type QuestionRow = {
  id: string;
  standard_id: string;
  title: string | null;
  content: string | null;
  approved: boolean | null;
  flagged: boolean | null;
  correct_option: string | null;
  option_a_class: string | null;
  option_b_class: string | null;
  option_c_class: string | null;
  option_d_class: string | null;
};

type ReadinessIssue =
  | 'not_approved'
  | 'flagged'
  | 'missing_content'
  | 'missing_stem'
  | 'missing_option_a'
  | 'missing_option_b'
  | 'missing_option_c'
  | 'missing_option_d'
  | 'missing_correct'
  | 'missing_option_class'
  | 'invalid_option_class'
  | 'correct_option_not_classified_correct';

type AuditRow = {
  question: QuestionRow;
  issues: ReadinessIssue[];
};

const MIN_READY = Number(getArg('--min') ?? '10');
const STANDARD_FILTER = getArg('--standard');

const VALID_CLASSIFICATIONS = new Set([
  'correct',
  'schema_strategy_missing',
  'schema_deficit',
  'no_metacognitive_strategy',
  'vocabulary_gap',
  'morphology_gap',
  'syntax_barrier',
  'mood_misreading',
  'tone_misreading',
  'inferencing_literal',
  'inference_gap',
  'figurative_language_failure',
  'text_structure_confusion',
  'evidence_selection_gap',
  'main_idea_confusion',
  'theme_misidentification',
]);

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function loadEnvFile(path: string): void {
  const envPath = resolve(path);
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equals = trimmed.indexOf('=');
    if (equals === -1) continue;

    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function parseOptions(content: string): Record<'A' | 'B' | 'C' | 'D', string> {
  const opts = { A: '', B: '', C: '', D: '' };
  for (const line of content.split('\n')) {
    const match = line.trimStart().match(/^([A-D])[.)]\s*(.+)/);
    if (match) opts[match[1] as 'A' | 'B' | 'C' | 'D'] = match[2].trim();
  }
  return opts;
}

function parseField(content: string, prefix: string): string {
  const line = content.split('\n').find((candidate) => candidate.trimStart().startsWith(prefix));
  return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : '';
}

function optionClasses(question: QuestionRow): Record<'A' | 'B' | 'C' | 'D', string> {
  const content = question.content ?? '';
  return {
    A: question.option_a_class ?? parseField(content, 'DIAGNOSTIC_CLASSIFICATION_A:'),
    B: question.option_b_class ?? parseField(content, 'DIAGNOSTIC_CLASSIFICATION_B:'),
    C: question.option_c_class ?? parseField(content, 'DIAGNOSTIC_CLASSIFICATION_C:'),
    D: question.option_d_class ?? parseField(content, 'DIAGNOSTIC_CLASSIFICATION_D:'),
  };
}

function correctOption(question: QuestionRow): string {
  const fromColumn = question.correct_option?.replace(/[^A-D]/g, '') ?? '';
  if (fromColumn) return fromColumn;
  return parseField(question.content ?? '', 'CORRECT:').replace(/[^A-D]/g, '');
}

function auditQuestion(question: QuestionRow): AuditRow {
  const issues: ReadinessIssue[] = [];
  const content = question.content ?? '';
  const classes = optionClasses(question);
  const correct = correctOption(question);

  if (question.approved !== true) issues.push('not_approved');
  if (question.flagged === true) issues.push('flagged');
  if (!content) issues.push('missing_content');
  if (!parseField(content, 'QUESTION:')) issues.push('missing_stem');

  const options = parseOptions(content);
  if (!options.A) issues.push('missing_option_a');
  if (!options.B) issues.push('missing_option_b');
  if (!options.C) issues.push('missing_option_c');
  if (!options.D) issues.push('missing_option_d');

  if (!correct || !['A', 'B', 'C', 'D'].includes(correct)) {
    issues.push('missing_correct');
  }

  const missingClass = Object.values(classes).some((value) => !value);
  if (missingClass) issues.push('missing_option_class');

  const invalidClass = Object.values(classes).some((value) => value && !VALID_CLASSIFICATIONS.has(value));
  if (invalidClass) issues.push('invalid_option_class');

  if (correct && ['A', 'B', 'C', 'D'].includes(correct)) {
    const correctClass = classes[correct as 'A' | 'B' | 'C' | 'D'];
    if (correctClass && correctClass !== 'correct') {
      issues.push('correct_option_not_classified_correct');
    }
  }

  return { question, issues };
}

function isReady(auditRow: AuditRow): boolean {
  return auditRow.issues.length === 0;
}

function isFallbackCandidate(auditRow: AuditRow): boolean {
  const blockingIssues = new Set<ReadinessIssue>([
    'flagged',
    'missing_content',
    'missing_stem',
    'missing_option_a',
    'missing_option_b',
    'missing_option_c',
    'missing_option_d',
    'missing_correct',
    'missing_option_class',
    'invalid_option_class',
    'correct_option_not_classified_correct',
  ]);

  return auditRow.issues.every((issue) => issue === 'not_approved') &&
    auditRow.issues.some((issue) => !blockingIssues.has(issue));
}

async function restGet<T>(path: string): Promise<T[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const rows: T[] = [];
  let start = 0;
  const pageSize = 1000;

  while (true) {
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${start}-${start + pageSize - 1}`,
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${response.status} ${text}`);
    }

    const page = JSON.parse(text || '[]') as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
    start += pageSize;
  }

  return rows;
}

function summarizeIssues(rows: AuditRow[]): Map<ReadinessIssue, number> {
  const counts = new Map<ReadinessIssue, number>();
  for (const row of rows) {
    for (const issue of row.issues) {
      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    }
  }
  return counts;
}

function printIssueSummary(rows: AuditRow[]): void {
  const issueCounts = summarizeIssues(rows);
  if (issueCounts.size === 0) return;

  for (const [issue, count] of Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${issue}: ${count}`);
  }
}

async function main(): Promise<void> {
  loadEnvFile('.env.local');

  const standards = await restGet<StandardRow>(
    `standards?select=id,code${STANDARD_FILTER ? `&code=eq.${encodeURIComponent(STANDARD_FILTER)}` : ''}&order=code.asc`,
  );

  const standardIds = standards.map((standard) => standard.id);
  if (standardIds.length === 0) {
    console.log(STANDARD_FILTER ? `No standard found for ${STANDARD_FILTER}.` : 'No standards found.');
    process.exitCode = 1;
    return;
  }

  const questions = await restGet<QuestionRow>(
    `questions?select=id,standard_id,title,content,approved,flagged,correct_option,option_a_class,option_b_class,option_c_class,option_d_class&standard_id=in.(${standardIds.join(',')})&order=created_at.desc`,
  );

  let failed = false;

  console.log(`Diagnostic readiness audit | minimum approved-ready questions: ${MIN_READY}`);
  console.log('');

  for (const standard of standards) {
    const auditRows = questions
      .filter((question) => question.standard_id === standard.id)
      .map(auditQuestion);

    const ready = auditRows.filter(isReady);
    const approvedRows = auditRows.filter((row) => row.question.approved === true);
    const approvedInvalid = approvedRows.filter((row) => !isReady(row));
    const fallbackCandidates = auditRows.filter(isFallbackCandidate);
    const status = ready.length >= MIN_READY ? 'READY' : 'NOT READY';

    if (status === 'NOT READY') failed = true;

    console.log(`${standard.code}`);
    console.log(`  Status: ${status}`);
    console.log(`  Approved ready: ${ready.length} / ${MIN_READY}`);
    console.log(`  Approved total: ${approvedRows.length}`);
    console.log(`  Fully usable top-up candidates: ${fallbackCandidates.length}`);
    console.log(`  Total question rows: ${auditRows.length}`);

    if (approvedInvalid.length > 0) {
      console.log('  Approved rows failing readiness:');
      printIssueSummary(approvedInvalid);
    }

    if (ready.length < MIN_READY) {
      const needed = MIN_READY - ready.length;
      console.log(`  Action: review and approve ${needed} more structurally valid question${needed === 1 ? '' : 's'}.`);
    }

    console.log('');
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
