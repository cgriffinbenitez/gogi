'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, CheckCircle2, Database, FileCheck2, Filter, Gauge, GraduationCap, Layers3, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

type CorpusResponse = {
  ok: boolean;
  corpus: {
    summary: {
      officialTexts: number;
      locallyStoredTexts: number;
      textsWithGoldCards: number;
      totalGoldCards: number;
    };
  };
};

type ClaudeResponse = {
  ok: boolean;
  corpus: {
    summary: {
      readyCards: number;
      textsWithCards: number;
      standardsRepresented: number;
    };
  };
};

type AuditResponse = {
  ok: boolean;
  report: {
    summary: {
      classroomReadyCards: number;
      cardsWithMajorRisk: number;
      claudeReadyCardsAudited: number;
      standardsAudited: number;
    };
  };
};

type CoverageResponse = {
  summary?: {
    localTextsWithReadyCards: number;
    localSources: number;
    thinLocalTexts: number;
    standardsRepresented: number;
  };
};

const tabs = ['Pipeline', 'Quality Gates', 'Classroom Engine', 'Admin Story'] as const;
type Tab = (typeof tabs)[number];

function statCard(label: string, value: string | number, detail: string, tone: 'blue' | 'green' | 'amber' = 'blue') {
  const colors = {
    blue: { bg: C.blueLight, border: C.blue, text: C.blue },
    green: { bg: '#EEF8EA', border: C.green, text: C.green },
    amber: { bg: C.amberLight, border: C.amber, text: C.amber },
  }[tone];
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ color: colors.text, fontSize: 30, fontWeight: 950, marginTop: 3 }}>{value}</div>
      <div style={{ color: C.gray, fontSize: 12, fontWeight: 750, lineHeight: 1.4, marginTop: 3 }}>{detail}</div>
    </div>
  );
}

function stageCard(args: {
  icon: React.ReactNode;
  title: string;
  body: string;
  proof: string;
}) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
        <div
          style={{
            alignItems: 'center',
            background: C.blueLight,
            border: `1px solid ${C.blueMid}`,
            borderRadius: 8,
            color: C.blue,
            display: 'flex',
            height: 38,
            justifyContent: 'center',
            width: 38,
          }}
        >
          {args.icon}
        </div>
        <h3 style={{ color: C.dark, fontSize: 18, margin: 0 }}>{args.title}</h3>
      </div>
      <p style={{ color: C.dark, fontSize: 14, lineHeight: 1.55, margin: '12px 0 0' }}>{args.body}</p>
      <div
        style={{
          background: C.light,
          borderRadius: 7,
          color: C.gray,
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1.45,
          marginTop: 12,
          padding: 10,
        }}
      >
        {args.proof}
      </div>
    </div>
  );
}

function pill(text: string, tone: 'blue' | 'green' | 'amber' = 'blue') {
  const colors = {
    blue: { bg: C.blueLight, border: C.blue, text: C.blue },
    green: { bg: '#EEF8EA', border: C.green, text: C.green },
    amber: { bg: C.amberLight, border: C.amber, text: C.amber },
  }[tone];
  return (
    <span
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        color: colors.text,
        display: 'inline-flex',
        fontSize: 12,
        fontWeight: 900,
        padding: '7px 10px',
      }}
    >
      {text}
    </span>
  );
}

export default function HowGogiWorksPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Pipeline');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    officialTexts: 40,
    localSources: 36,
    claudeReady: 1265,
    auditReady: 892,
    heldForReview: 674,
    textsWithReady: 29,
    standardsRepresented: 12,
  });

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      try {
        const [corpusRes, claudeRes, auditRes, coverageRes] = await Promise.all([
          fetch('/api/teacher/official-teachable-corpus'),
          fetch('/api/teacher/official-claude-ready-cards'),
          fetch('/api/teacher/official-card-quality-audit'),
          fetch('/api/teacher/official-coverage-gaps').catch(() => null),
        ]);
        const corpusJson = (await corpusRes.json()) as CorpusResponse;
        const claudeJson = (await claudeRes.json()) as ClaudeResponse;
        const auditJson = (await auditRes.json()) as AuditResponse;
        const coverageJson = coverageRes?.ok ? ((await coverageRes.json()) as CoverageResponse) : null;
        if (!mounted) return;
        setStats({
          officialTexts: corpusJson.corpus.summary.officialTexts,
          localSources: corpusJson.corpus.summary.locallyStoredTexts,
          claudeReady: claudeJson.corpus.summary.readyCards,
          auditReady: auditJson.report.summary.classroomReadyCards,
          heldForReview: auditJson.report.summary.cardsWithMajorRisk,
          textsWithReady: coverageJson?.summary?.localTextsWithReadyCards ?? claudeJson.corpus.summary.textsWithCards,
          standardsRepresented: coverageJson?.summary?.standardsRepresented ?? auditJson.report.summary.standardsAudited,
        });
      } catch {
        // Keep the last known build numbers visible for admin walkthroughs.
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadStats();
    return () => {
      mounted = false;
    };
  }, []);

  const tabContent = useMemo(() => {
    if (activeTab === 'Pipeline') {
      return (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {stageCard({
            icon: <BookOpenCheck size={21} />,
            title: '1. Official Text Map',
            body: 'GOGI starts with the Florida-mapped Grade 9 text library, then checks which sources are stored locally and usable for instruction.',
            proof: 'The system separates public-domain stored texts, manual uploads, reference-only texts, and missing sources.',
          })}
          {stageCard({
            icon: <Layers3 size={21} />,
            title: '2. Excerpt Mining',
            body: 'Long works are broken into classroom-sized excerpts and tagged by benchmark, subskill, text signal, and teachability.',
            proof: 'The source pool is large, but raw mined excerpts are not shown as finished instruction.',
          })}
          {stageCard({
            icon: <Sparkles size={21} />,
            title: '3. Claude Item Writing',
            body: 'Claude receives one excerpt at a time and writes a passage-specific FAST-style card: question, answer choices, evidence, and teacher rationale.',
            proof: 'GOGI asks Claude to revise weak drafts before rejecting them, so fixable items get rescued.',
          })}
          {stageCard({
            icon: <ShieldCheck size={21} />,
            title: '4. GOGI Audit Gate',
            body: 'Every card is checked for excerpt integrity, question alignment, distractor quality, length, source trust, and standard fit.',
            proof: 'Cards with major or blocker issues are held back from the teacher-facing finished-card view.',
          })}
        </div>
      );
    }

    if (activeTab === 'Quality Gates') {
      return (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          {stageCard({
            icon: <Filter size={21} />,
            title: 'What Gets Blocked',
            body: 'GOGI blocks cards with generic stems, weak evidence, duplicate choices, editorial footnotes, OCR artifacts, mismatched sources, or questions that do not point back to the excerpt.',
            proof: 'This is why the system can generate aggressively without letting weak cards become classroom-ready.',
          })}
          {stageCard({
            icon: <CheckCircle2 size={21} />,
            title: 'What Gets Through',
            body: 'A finished card needs a real excerpt, a standard/subskill match, exact evidence points, a FAST-style question, one correct answer, and plausible distractors.',
            proof: 'The usable number is “Audit-ready cards,” not raw generated cards.',
          })}
          {stageCard({
            icon: <Gauge size={21} />,
            title: 'Why Held for Review Exists',
            body: 'Held cards are not failures of the product. They are proof that GOGI has editorial judgment and refuses to show questionable content as ready-to-teach.',
            proof: `${stats.heldForReview.toLocaleString()} cards are currently held back instead of being shown to teachers as finished.`,
          })}
          {stageCard({
            icon: <FileCheck2 size={21} />,
            title: 'Why This Matters',
            body: 'The hardest part of ELA prep is not finding texts. It is producing precise, text-dependent questions that actually make students practice the tested reading move.',
            proof: 'GOGI turns official texts into a vetted instructional bank rather than a pile of PDFs.',
          })}
        </div>
      );
    }

    if (activeTab === 'Classroom Engine') {
      return (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {stageCard({
            icon: <GraduationCap size={21} />,
            title: 'Teaching Readiness',
            body: 'A teacher can open a standard, see the subskills students must know, then pull finished excerpts and FAST-style checks tied to that skill.',
            proof: 'This supports explicit instruction, Cornell notes, guided practice, independent practice, and exit tickets.',
          })}
          {stageCard({
            icon: <Database size={21} />,
            title: 'Official Corpus',
            body: 'The corpus is the library view: text by text, standard by standard, finished card by finished card.',
            proof: `${stats.textsWithReady} local texts currently have ready cards across ${stats.standardsRepresented} standards.`,
          })}
          {stageCard({
            icon: <ArrowRight size={21} />,
            title: 'Class Planner',
            body: 'Student performance data can point the teacher toward the weakest classwide standards, then GOGI can surface the ready cards that match those needs.',
            proof: 'The long-term engine is data → standard need → excerpt card → lesson/workbook/small-group task.',
          })}
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
          <h3 style={{ color: C.dark, fontSize: 22, margin: 0 }}>The Admin Version</h3>
          <p style={{ color: C.dark, fontSize: 16, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 980 }}>
            GOGI is building a Florida Grade 9 ELA instructional bank from official texts. The system stores the texts,
            mines teachable excerpts, generates FAST-style questions with Claude, audits each card, and shows only the
            classroom-ready cards to the teacher. The goal is precision instruction: every passage, question, and
            distractor is tied to a benchmark and a specific reading move.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {pill('Official Florida text map', 'blue')}
          {pill('Standards and subskills', 'blue')}
          {pill('Claude-authored item writing', 'green')}
          {pill('GOGI audit gates', 'green')}
          {pill('Teacher-ready excerpts', 'amber')}
          {pill('FAST-style distractors', 'amber')}
        </div>
      </div>
    );
  }, [activeTab, stats]);

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="how" />
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: C.blue, fontSize: 12, fontWeight: 950, letterSpacing: 1.2 }}>ADMIN WALKTHROUGH</div>
              <h1 style={{ color: C.dark, fontSize: 40, lineHeight: 1.05, margin: '8px 0' }}>How GOGI Works</h1>
              <p style={{ color: C.gray, fontSize: 16, lineHeight: 1.55, margin: 0, maxWidth: 900 }}>
                A plain-English view of how GOGI turns official Grade 9 texts into audited, FAST-aligned instructional cards.
              </p>
            </div>
            {loading ? (
              <div style={{ alignItems: 'center', color: C.gray, display: 'flex', fontSize: 13, fontWeight: 800, gap: 8 }}>
                <Loader2 className="animate-spin" size={17} />
                Loading live build stats
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginTop: 18 }}>
            {statCard('Official Texts', stats.officialTexts, 'Florida-mapped Grade 9 works', 'blue')}
            {statCard('Local Sources', stats.localSources, 'Texts GOGI can mine or reference', 'blue')}
            {statCard('Claude-Ready', stats.claudeReady.toLocaleString(), 'Cards written and saved', 'green')}
            {statCard('Audit-Ready', stats.auditReady.toLocaleString(), 'Cards passing classroom gates', 'green')}
            {statCard('Held Back', stats.heldForReview.toLocaleString(), 'Cards blocked for review', 'amber')}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? C.dark : C.white,
                  border: `1px solid ${activeTab === tab ? C.dark : C.border}`,
                  borderRadius: 999,
                  color: activeTab === tab ? C.white : C.dark,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 950,
                  minHeight: 34,
                  padding: '0 14px',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ background: C.light, borderRadius: 8, marginTop: 16, padding: 16 }}>{tabContent}</div>
        </section>
      </main>
    </div>
  );
}
