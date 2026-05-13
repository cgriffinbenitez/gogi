#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import {
  auditOfficialExcerptInventory,
  officialExcerptInventoryAuditMarkdown,
} from '../src/lib/teacher/officialExcerptInventoryAudit';

async function main() {
  const report = await auditOfficialExcerptInventory();
  const outDir = path.join(process.cwd(), 'data', 'official-text-library', 'audits');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latest-excerpt-inventory-audit.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'latest-excerpt-inventory-audit.md'), officialExcerptInventoryAuditMarkdown(report));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Excerpt Inventory Audit Complete');
  console.log(`  Candidates audited:       ${report.summary.totalCandidates}`);
  console.log(`  Ready candidates:         ${report.summary.readyCandidates}`);
  console.log(`  Major/blocker risk:       ${report.summary.candidatesWithMajorRisk}`);
  console.log(`  Candidates with issues:   ${report.summary.candidatesWithIssues}`);
  console.log(`  Blockers:                 ${report.summary.blockers}`);
  console.log(`  Major issues:             ${report.summary.major}`);
  console.log(`  Minor issues:             ${report.summary.minor}`);
  console.log('  JSON:                     data/official-text-library/audits/latest-excerpt-inventory-audit.json');
  console.log('  Summary:                  data/official-text-library/audits/latest-excerpt-inventory-audit.md');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[official-excerpt-inventory-audit] failed:', error);
  process.exit(1);
});
