'use client';

import type React from 'react';
import { useState } from 'react';
import { BookOpen, FileCheck2, Printer, ShieldCheck } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

const standards = [
  { code: 'ELA.9.R.1.1', title: 'Key literary elements add layers of meaning', lessons: 6, questions: 30 },
  { code: 'ELA.9.R.1.2', title: 'Theme development across a literary text', lessons: 3, questions: 15 },
  { code: 'ELA.9.R.1.3', title: 'Narrator perspective, irony, and satire', lessons: 3, questions: 15 },
  { code: 'ELA.9.R.1.4', title: 'Epic poetry', lessons: 7, questions: 35 },
  { code: 'ELA.9.R.2.1', title: 'Text structure and feature purpose', lessons: 6, questions: 30 },
  { code: 'ELA.9.R.2.2', title: 'Central idea and supporting evidence', lessons: 6, questions: 30 },
  { code: 'ELA.9.R.2.3', title: 'Rhetorical appeals and author purpose', lessons: 7, questions: 35 },
  { code: 'ELA.9.R.2.4', title: 'Opposing arguments, claims, evidence, and validity', lessons: 5, questions: 25 },
  { code: 'ELA.9.R.3.1', title: 'Figurative language effect', lessons: 5, questions: 25 },
  { code: 'ELA.9.R.3.2', title: 'Paraphrase grade-level text', lessons: 4, questions: 20 },
  { code: 'ELA.9.R.3.4', title: 'Rhetoric and reader effect', lessons: 1, questions: 5 },
  { code: 'ELA.9.V.1.1', title: 'Academic vocabulary', lessons: 3, questions: 15 },
  { code: 'ELA.9.V.1.2', title: 'Etymology and derivations', lessons: 1, questions: 5 },
  { code: 'ELA.9.V.1.3', title: 'Context and connotation', lessons: 1, questions: 5 },
];

function workbookHref(standard: string, version: 'student' | 'teacher' | 'answers') {
  return `/api/teacher/workbook?standard=${encodeURIComponent(standard)}&version=${version}`;
}

export default function WorkbookBuilderPage() {
  const [standard, setStandard] = useState('ELA.9.R.1.1');
  const selected = standards.find((item) => item.code === standard) ?? standards[0];

  return (
    <main style={{ background: C.light, minHeight: '100vh', fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar />
      <div style={{ margin: '0 auto', maxWidth: 1180, padding: 24 }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24,
          }}
        >
          <p style={{ color: C.blue, fontSize: 13, fontWeight: 950, letterSpacing: '.12em', margin: '0 0 8px' }}>
            PRINTABLE CLASSROOM TOOL
          </p>
          <h1 style={{ color: C.dark, fontSize: 42, lineHeight: 1, margin: 0 }}>
            GOGI Workbook Builder
          </h1>
          <p style={{ color: C.gray, fontSize: 17, lineHeight: 1.55, margin: '14px 0 0', maxWidth: 850 }}>
            Build your own laminated Grade 9 FAST Reading workbook from GOGI gold cards. Start with one
            standard, print the student version, keep the teacher key, and use separate answer sheets all year.
          </p>

          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'minmax(260px, 1fr) repeat(3, minmax(160px, 190px))',
              marginTop: 22,
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: C.gray, fontSize: 12, fontWeight: 950 }}>Standard</span>
              <select
                value={standard}
                onChange={(event) => setStandard(event.target.value)}
                style={{
                  background: C.white,
                  border: `2px solid ${C.blue}`,
                  borderRadius: 8,
                  color: C.dark,
                  fontSize: 16,
                  fontWeight: 850,
                  minHeight: 46,
                  padding: '0 12px',
                }}
              >
                {standards.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} - {item.title}
                  </option>
                ))}
              </select>
            </label>

            <a href={workbookHref(standard, 'student')} target="_blank" rel="noreferrer" style={buttonStyle(C.blue)}>
              <BookOpen size={18} />
              Student workbook
            </a>
            <a href={workbookHref(standard, 'teacher')} target="_blank" rel="noreferrer" style={buttonStyle(C.green)}>
              <FileCheck2 size={18} />
              Teacher guide
            </a>
            <a href={workbookHref(standard, 'answers')} target="_blank" rel="noreferrer" style={buttonStyle(C.dark)}>
              <Printer size={18} />
              Answer sheet
            </a>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            marginTop: 16,
          }}
        >
          <InfoCard label="Selected standard" value={selected.code} detail={selected.title} />
          <InfoCard label="Workbook lessons" value={String(selected.lessons)} detail="One lesson per skill lane" />
          <InfoCard label="FAST-style items" value={String(selected.questions)} detail="Built from gold cards" />
          <InfoCard label="Audit status" value="Ready" detail="Uses the latest 290/290 baseline" />
        </section>

        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            marginTop: 16,
            padding: 22,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <ShieldCheck color={C.green} size={24} />
            <div>
              <h2 style={{ color: C.dark, fontSize: 22, margin: 0 }}>What this v1 does</h2>
              <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.55, margin: '6px 0 0' }}>
                This is the first hardwired workbook path: GOGI takes the Teaching Readiness gold cards,
                lays them out like a consumable practice book, and gives you three print views. The student
                workbook has no answers. The teacher guide has answers, evidence, and reteach prompts.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ color: C.gray, fontSize: 11, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: C.dark, fontSize: 26, fontWeight: 950, marginTop: 5 }}>{value}</div>
      <div style={{ color: C.gray, fontSize: 13, fontWeight: 800, marginTop: 2 }}>{detail}</div>
    </div>
  );
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    alignItems: 'center',
    background,
    border: `1px solid ${background}`,
    borderRadius: 8,
    color: C.white,
    display: 'inline-flex',
    fontSize: 14,
    fontWeight: 950,
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    padding: '0 14px',
    textDecoration: 'none',
  };
}
