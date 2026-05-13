#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import {
  buildOfficialCardQualityAudit,
  officialCardQualityAuditMarkdown,
} from '../src/lib/teacher/officialCardQualityAudit';

async function main() {
  const report = await buildOfficialCardQualityAudit();
  const outDir = path.join(process.cwd(), 'data', 'official-text-library', 'audits');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latest-card-quality-audit.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'latest-card-quality-audit.md'), officialCardQualityAuditMarkdown(report));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Card Quality Audit Complete');
  console.log(`  Cards audited:             ${report.summary.cardsAudited}`);
  console.log(`  Gold cards audited:        ${report.summary.goldCardsAudited}`);
  console.log(`  Auto-ready cards audited:  ${report.summary.autoReadyCardsAudited}`);
  console.log(`  Classroom-ready by rules:  ${report.summary.classroomReadyCards}`);
  console.log(`  Major/blocker risk:        ${report.summary.cardsWithMajorRisk}`);
  console.log(`  Blockers:                  ${report.summary.blockers}`);
  console.log(`  Major issues:              ${report.summary.major}`);
  console.log(`  Minor issues:              ${report.summary.minor}`);
  console.log('  JSON:                      data/official-text-library/audits/latest-card-quality-audit.json');
  console.log('  Summary:                   data/official-text-library/audits/latest-card-quality-audit.md');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[official-card-quality-audit] failed:', error);
  process.exit(1);
});
