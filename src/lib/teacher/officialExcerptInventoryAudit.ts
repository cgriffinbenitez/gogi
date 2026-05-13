import fs from 'fs/promises';
import path from 'path';
import type { OfficialExcerptCandidate, OfficialExcerptInventory } from '@/lib/teacher/officialExcerptInventory';

export type InventoryAuditIssue = {
  severity: 'blocker' | 'major' | 'minor';
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
  issue: string;
  excerptPreview: string;
};

export type InventoryAuditReport = {
  generatedAt: string;
  summary: {
    totalCandidates: number;
    readyCandidates: number;
    candidatesWithMajorRisk: number;
    candidatesWithIssues: number;
    blockers: number;
    major: number;
    minor: number;
    textsAudited: number;
    textsWithBlockers: number;
  };
  issues: InventoryAuditIssue[];
  byText: Array<{
    title: string;
    candidates: number;
    ready: number;
    blockers: number;
    major: number;
    minor: number;
  }>;
};

const INVENTORY_PATH = path.join(process.cwd(), 'data', 'official-text-library', 'teachable-excerpt-inventory.json');

function compact(value: string, max = 220) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function addIssue(args: {
  issues: InventoryAuditIssue[];
  candidate: OfficialExcerptCandidate;
  severity: InventoryAuditIssue['severity'];
  issue: string;
}) {
  args.issues.push({
    severity: args.severity,
    textTitle: args.candidate.textTitle,
    textAuthor: args.candidate.textAuthor,
    standardCode: args.candidate.standardCode,
    subSkillLabel: args.candidate.subSkillLabel,
    location: args.candidate.location,
    issue: args.issue,
    excerptPreview: compact(args.candidate.excerpt),
  });
}

function terminalPunctuation(value: string) {
  return /[.!?"'”’]\s*$/.test(value.trim());
}

function auditCandidate(candidate: OfficialExcerptCandidate) {
  const issues: InventoryAuditIssue[] = [];
  const text = candidate.excerpt;
  const words = candidate.wordCount;

  if (words < 120) {
    addIssue({ issues, candidate, severity: 'major', issue: `Too short for reliable instruction (${words} words).` });
  }
  if (words > 380) {
    addIssue({ issues, candidate, severity: 'major', issue: `Too long for quick projected instruction (${words} words).` });
  }
  if (!terminalPunctuation(text)) {
    addIssue({ issues, candidate, severity: 'blocker', issue: 'Excerpt appears cut off because it does not end with terminal punctuation.' });
  }
  if (/^\s*[a-z,;:)\]]/.test(text)) {
    addIssue({ issues, candidate, severity: 'blocker', issue: 'Excerpt appears to start mid-sentence.' });
  }
  if (/\[[^\]]*(?:\.\.\.|until|missing|illegible|fragment)[^\]]*\]/i.test(text) || /\.{6,}/.test(text)) {
    addIssue({ issues, candidate, severity: 'blocker', issue: 'Excerpt contains bracketed gaps or heavy ellipsis, so students cannot trust the passage.' });
  }
  if (/[A-Za-z]¬\s+[A-Za-z]/.test(text) || /build¬|stroll¬|deep¬|immedi¬|con¬/i.test(text)) {
    addIssue({ issues, candidate, severity: 'major', issue: 'Excerpt contains OCR/hyphenation artifacts that should be cleaned before use.' });
  }
  if (/\b(born|died)\s+(?:about\s+)?\d{3,4}\b/i.test(text) || /\btranslator|editor|preface|introduction\b/i.test(text)) {
    addIssue({ issues, candidate, severity: 'blocker', issue: 'Excerpt looks like editorial/biographical material instead of teachable source text.' });
  }
  if (candidate.score < 14) {
    addIssue({ issues, candidate, severity: 'major', issue: `Weak standard/subskill signal score (${candidate.score}).` });
  }
  if (candidate.evidenceSignals.length < 2) {
    addIssue({ issues, candidate, severity: 'major', issue: 'Too few evidence signals for trustworthy standard alignment.' });
  }
  if (/standard-aligned language in the passage/i.test(candidate.justification)) {
    addIssue({ issues, candidate, severity: 'major', issue: 'Justification is too generic; it needs pointable evidence.' });
  }
  if (/How does this excerpt help teach/i.test(candidate.suggestedQuestionStem)) {
    addIssue({ issues, candidate, severity: 'minor', issue: 'Question stem is a teacher-facing placeholder, not a student-ready FAST-style question yet.' });
  }
  if (candidate.standardCode === 'ELA.9.R.2.4' && candidate.paragraphCount < 2) {
    addIssue({ issues, candidate, severity: 'major', issue: 'Opposing-argument work usually needs paired/connected paragraphs, not a single paragraph.' });
  }
  if (candidate.standardCode === 'ELA.9.R.2.1' && candidate.paragraphCount < 2) {
    addIssue({ issues, candidate, severity: 'minor', issue: 'Text-structure work is stronger with at least two connected paragraphs.' });
  }

  return issues;
}

export async function auditOfficialExcerptInventory(inventory?: OfficialExcerptInventory): Promise<InventoryAuditReport> {
  const loaded =
    inventory ??
    (JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8')) as OfficialExcerptInventory);
  const issues = loaded.texts.flatMap((text) => text.candidates.flatMap((candidate) => auditCandidate(candidate)));
  const issueKey = (issue: InventoryAuditIssue) =>
    `${issue.textTitle}::${issue.textAuthor ?? ''}::${issue.standardCode}::${issue.subSkillLabel}::${issue.location}`;
  const candidatesWithIssues = new Set(issues.map(issueKey)).size;
  const candidatesWithMajorRisk = new Set(
    issues.filter((issue) => issue.severity === 'blocker' || issue.severity === 'major').map(issueKey)
  ).size;
  const allCandidates = loaded.texts.flatMap((text) => text.candidates);

  const byText = loaded.texts
    .map((text) => {
      const textIssues = issues.filter((issue) => issue.textTitle === text.title && issue.textAuthor === text.author);
      const majorRiskIssueCandidates = new Set(
        textIssues
          .filter((issue) => issue.severity === 'blocker' || issue.severity === 'major')
          .map(issueKey)
      );
      return {
        title: `${text.title}${text.author ? ` — ${text.author}` : ''}`,
        candidates: text.candidateCount,
        ready: Math.max(0, text.candidateCount - majorRiskIssueCandidates.size),
        blockers: textIssues.filter((issue) => issue.severity === 'blocker').length,
        major: textIssues.filter((issue) => issue.severity === 'major').length,
        minor: textIssues.filter((issue) => issue.severity === 'minor').length,
      };
    })
    .sort((a, b) => b.blockers - a.blockers || b.major - a.major || b.candidates - a.candidates);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCandidates: allCandidates.length,
      readyCandidates: Math.max(0, allCandidates.length - candidatesWithMajorRisk),
      candidatesWithMajorRisk,
      candidatesWithIssues,
      blockers: issues.filter((issue) => issue.severity === 'blocker').length,
      major: issues.filter((issue) => issue.severity === 'major').length,
      minor: issues.filter((issue) => issue.severity === 'minor').length,
      textsAudited: loaded.texts.length,
      textsWithBlockers: byText.filter((text) => text.blockers > 0).length,
    },
    issues,
    byText,
  };
}

export function officialExcerptInventoryAuditMarkdown(report: InventoryAuditReport) {
  const lines = [
    '# GOGI Official Excerpt Inventory Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Candidates audited: ${report.summary.totalCandidates}`,
    `Ready candidates: ${report.summary.readyCandidates}`,
    `Candidates with major/blocker risk: ${report.summary.candidatesWithMajorRisk}`,
    `Candidates with issues: ${report.summary.candidatesWithIssues}`,
    `Blockers: ${report.summary.blockers}`,
    `Major issues: ${report.summary.major}`,
    `Minor issues: ${report.summary.minor}`,
    `Texts audited: ${report.summary.textsAudited}`,
    `Texts with blockers: ${report.summary.textsWithBlockers}`,
    '',
    '## By Text',
    '',
    '| Text | Candidates | Ready | Blockers | Major | Minor |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const text of report.byText) {
    lines.push(`| ${text.title} | ${text.candidates} | ${text.ready} | ${text.blockers} | ${text.major} | ${text.minor} |`);
  }

  lines.push('');
  lines.push('## Issues');
  lines.push('');

  for (const issue of report.issues.slice(0, 1000)) {
    lines.push(`- **${issue.severity.toUpperCase()}** ${issue.textTitle}${issue.textAuthor ? ` — ${issue.textAuthor}` : ''} / ${issue.standardCode} / ${issue.subSkillLabel} / ${issue.location}: ${issue.issue}`);
    lines.push(`  - ${issue.excerptPreview}`);
  }
  if (report.issues.length > 1000) lines.push(`- ...${report.issues.length - 1000} more issues in JSON report.`);

  return `${lines.join('\n')}\n`;
}
