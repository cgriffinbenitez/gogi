#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  buildTeachingReadinessAudit,
  teachingReadinessAuditMarkdown,
} from '../src/lib/teacher/teachingReadinessAudit';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const OUT_DIR = path.join(process.cwd(), 'data', 'teacher-readiness-audits');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const audit = await buildTeachingReadinessAudit({ targetPerSkill: 5, maxStandards: 20 });
  const jsonPath = path.join(OUT_DIR, 'latest.json');
  const mdPath = path.join(OUT_DIR, 'latest.md');

  fs.writeFileSync(jsonPath, JSON.stringify(audit, null, 2));
  fs.writeFileSync(mdPath, teachingReadinessAuditMarkdown(audit));

  console.log('Teaching readiness audit complete');
  console.log(`Strong cards: ${audit.totalStrong}/${audit.targetStrong}`);
  console.log(`Issues flagged: ${audit.issueCount}`);
  console.log(`Markdown: ${path.relative(process.cwd(), mdPath)}`);
  console.log(`JSON:     ${path.relative(process.cwd(), jsonPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
