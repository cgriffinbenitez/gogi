import { buildTeachingReadinessBoard, type PullOutRow } from '@/lib/teacher/pullOutSheet';

export type TeachingReadinessAudit = Awaited<ReturnType<typeof buildTeachingReadinessAudit>>;

function minWordsFor(row: PullOutRow) {
  if (row.standard === 'R.2.1' || row.standard === 'R.2.2' || row.standard === 'R.2.3') {
    return 120;
  }
  if (row.standard === 'R.2.4') return 33;
  if (row.standard === 'R.3.1') return 45;
  if (row.standard === 'R.3.2') return 31;
  if (row.standard === 'V.1.1' || row.standard === 'V.1.2' || row.standard === 'V.1.3') return 38;
  if (row.standard === 'R.3.4') return 40;
  return 55;
}

function evidenceMinimumFor(row: PullOutRow) {
  if (row.standard === 'R.2.1' || row.standard === 'R.2.2' || row.standard === 'R.2.3') {
    return row.teacherTrust.excerptWords >= 120 ? 1 : 2;
  }
  if (row.standard === 'R.2.4') return 2;
  if (row.standard === 'R.1.4') return 1;
  if (row.standard === 'R.3.1') return 1;
  return 2;
}

function auditRow(row: PullOutRow) {
  const issues: string[] = [];
  const words = row.teacherTrust.excerptWords;
  const minWords = minWordsFor(row);
  const correct = row.anchorQuestion.choices.find((choice) => choice.correct);
  const incorrect = row.anchorQuestion.choices.filter((choice) => !choice.correct);
  const longestWrong = Math.max(...incorrect.map((choice) => choice.text.length), 0);

  if (words < minWords) {
    issues.push(`Excerpt may be too short for instruction (${words} words; target ${minWords}+).`);
  }
  if (row.qualityGate && row.qualityGate.status !== 'gold') {
    issues.push(`Quality gate is ${row.qualityGate.label}.`);
  }
  if (row.standard === 'R.2.4' && !/Passage A:/i.test(row.excerpt)) {
    issues.push('Paired argument card is missing a clear Passage A label.');
  }
  if (row.standard === 'R.2.4' && !/Passage B:/i.test(row.excerpt)) {
    issues.push('Paired argument card is missing a clear Passage B label.');
  }
  if (row.teacherTrust.evidencePoints.length < evidenceMinimumFor(row)) {
    issues.push('Evidence signal is thin.');
  }
  if (/How does this excerpt develop the standard skill|How would this claim help develop/i.test(row.anchorQuestion.stem)) {
    issues.push('Question stem is too generic.');
  }
  if (correct && correct.text.length > longestWrong + 45) {
    issues.push('Correct answer is much longer than the distractors.');
  }
  if (!row.anchorQuestion.choices.some((choice) => choice.correct) || row.anchorQuestion.choices.length !== 4) {
    issues.push('FAST-style check is incomplete.');
  }

  return issues;
}

export async function buildTeachingReadinessAudit(args: {
  targetPerSkill?: number;
  maxStandards?: number;
  skipAdaptations?: boolean;
} = {}) {
  const board = await buildTeachingReadinessBoard({
    targetPerSkill: args.targetPerSkill ?? 5,
    maxStandards: args.maxStandards ?? 20,
  });
  const skippedStandards = args.skipAdaptations === false ? [] : ['ELA.9.R.3.3'];
  const standardsToAudit = board.standards.filter((standard) => !skippedStandards.includes(standard.code));

  const standards = standardsToAudit.map((standard) => {
    const skills = standard.skills.map((skill) => {
      const rowAudits = skill.pullOuts.map((row) => ({
        selection: row.selection,
        location: row.exactLinesOrParagraphs,
        words: row.teacherTrust.excerptWords,
        confidence: row.teacherTrust.confidence,
        quality: row.qualityGate?.label ?? 'No quality gate',
        stem: row.anchorQuestion.stem,
        issues: auditRow(row),
      }));
      return {
        strandId: skill.strandId,
        label: skill.label,
        strongCount: skill.strongCount,
        target: skill.minimumPullOuts,
        status: skill.status,
        issues: [
          ...(skill.strongCount < skill.minimumPullOuts
            ? [`Needs ${skill.minimumPullOuts - skill.strongCount} more strong card(s).`]
            : []),
          ...rowAudits.flatMap((row, index) =>
            row.issues.map((issue) => `Card ${index + 1}: ${issue}`)
          ),
        ],
        rows: rowAudits,
      };
    });
    return {
      code: standard.code,
      title: standard.title,
      strongCount: standard.strongCount,
      target: standard.targetStrong,
      issues: skills.flatMap((skill) => skill.issues.map((issue) => `${skill.label}: ${issue}`)),
      skills,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    skippedStandards,
    totalStrong: standards.reduce((sum, standard) => sum + standard.strongCount, 0),
    targetStrong: standards.reduce((sum, standard) => sum + standard.target, 0),
    issueCount: standards.reduce((sum, standard) => sum + standard.issues.length, 0),
    standards,
  };
}

export function teachingReadinessAuditMarkdown(audit: Awaited<ReturnType<typeof buildTeachingReadinessAudit>>) {
  const lines = [
    '# Teaching Readiness Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    `Strong cards: ${audit.totalStrong}/${audit.targetStrong}`,
    `Issues flagged: ${audit.issueCount}`,
    audit.skippedStandards.length ? `Skipped for now: ${audit.skippedStandards.join(', ')}` : '',
    '',
  ].filter(Boolean);

  for (const standard of audit.standards) {
    lines.push(`## ${standard.code} — ${standard.title}`);
    lines.push(`Strong cards: ${standard.strongCount}/${standard.target}`);
    if (!standard.issues.length) {
      lines.push('No audit issues flagged.');
    } else {
      for (const issue of standard.issues) lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
