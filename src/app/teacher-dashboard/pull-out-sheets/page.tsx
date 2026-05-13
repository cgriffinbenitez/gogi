'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clipboard, Loader2, RefreshCw } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';

type PullOutSheet = {
  title: string;
  essentialQuestion: string;
  standardsCoverageSummary: Record<string, number>;
  rows: Array<{
    number: number;
    standard: string;
    selection: string;
    exactLinesOrParagraphs: string;
    skillFocus: string;
    excerpt: string;
    whyThisExcerpt: string;
    moveStatementTemplate: string;
    teacherTrust: {
      confidence: 'strong' | 'emerging' | 'weak';
      officialTextMap: boolean;
      localSourceText: boolean;
      excerptWords: number;
      evidencePoints: string[];
      useCase: string;
      whyTrustIt: string;
    };
    anchorQuestion: {
      stem: string;
      choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
    };
  }>;
  teacherNotes: string[];
  sourceTexts: Array<{ title: string; author: string | null; status: string; word_count: number }>;
};

const standardOptions = [
  ...FAST_GRADE9_READING_DEMANDS.map((demand) => ({
    code: demand.standardCode,
    title: demand.teacherTitle,
  })),
  { code: 'ELA.9.R.1.4', title: 'Epic poetry' },
  { code: 'ELA.9.R.3.2', title: 'Paraphrase grade-level text' },
].sort((a, b) => a.code.localeCompare(b.code));

function sheetToMarkdown(sheet: PullOutSheet) {
  const lines = [
    `# ${sheet.title}`,
    '',
    `Essential Question: ${sheet.essentialQuestion}`,
    '',
    `Standards Coverage Summary: ${Object.entries(sheet.standardsCoverageSummary)
      .map(([standard, count]) => `${standard}: ${count}`)
      .join(' · ')}`,
    '',
    '| # | Standard | Skill Focus | Selection | Exact Lines/Paragraphs | Why This Excerpt | Skill Strategy | Anchor Question |',
    '|---|---|---|---|---|---|---|---|',
    ...sheet.rows.map((row) => {
      const choices = row.anchorQuestion.choices
        .map((choice) => `${choice.label}. ${choice.correct ? `**${choice.text}**` : choice.text}`)
        .join('<br>');
      return `| ${row.number} | ${row.standard} | ${row.skillFocus} | ${row.selection} | ${row.exactLinesOrParagraphs} | ${row.whyThisExcerpt} | ${row.moveStatementTemplate} | ${row.anchorQuestion.stem}<br>${choices} |`;
    }),
    '',
    'Teacher Notes:',
    ...sheet.teacherNotes.map((note) => `- ${note}`),
  ];
  return lines.join('\n');
}

function compact(value: string, max = 460) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function confidenceColor(confidence: string) {
  if (confidence === 'strong') return C.green;
  if (confidence === 'emerging') return C.amber;
  return C.red;
}

function confidenceLabel(confidence: string) {
  if (confidence === 'strong') return 'Strong signal';
  if (confidence === 'emerging') return 'Emerging signal';
  return 'Teacher review';
}

export default function PullOutSheetsPage() {
  const searchParams = useSearchParams();
  const [standardCode, setStandardCode] = useState(searchParams.get('standard') ?? 'ELA.9.R.1.1');
  const [subSkillId, setSubSkillId] = useState(searchParams.get('subSkill') ?? '');
  const initialRows = Number(searchParams.get('rows') ?? 1);
  const [maxRows, setMaxRows] = useState([1, 4, 5, 8, 12, 15].includes(initialRows) ? initialRows : 1);
  const [sheet, setSheet] = useState<PullOutSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedStandard = useMemo(
    () => standardOptions.find((option) => option.code === standardCode),
    [standardCode]
  );

  async function loadSheet() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/teacher/pull-out-sheet?standard_code=${encodeURIComponent(
          standardCode
        )}&max_rows=${maxRows}${subSkillId ? `&sub_skill_id=${encodeURIComponent(subSkillId)}` : ''}`
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not build sheet.');
      setSheet(json.sheet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build sheet.');
      setSheet(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardCode, maxRows, subSkillId]);

  async function copyMarkdown() {
    if (!sheet) return;
    await navigator.clipboard.writeText(sheetToMarkdown(sheet));
    setCopied(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="pullouts" />
      <main style={{ maxWidth: 1260, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 360px',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={{ color: C.gray, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
              GOGI INSTRUCTIONAL SPINE
            </div>
            <h1 style={{ color: C.dark, fontSize: 36, lineHeight: 1.05, margin: '8px 0 10px' }}>
              Pull-Out Sheets
            </h1>
            <p style={{ color: C.gray, fontSize: 16, lineHeight: 1.55, maxWidth: 760 }}>
              Project one paragraph. Students paraphrase it, name the move, and answer one anchor
              question. This is the layer that feeds Cornell decks, Promethean mini-lessons, and
              GOGI practice.
            </p>
          </div>

          <div
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 16,
              display: 'grid',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Standard</span>
              <select
                value={standardCode}
                onChange={(event) => setStandardCode(event.target.value)}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  fontSize: 14,
                  minHeight: 42,
                  padding: '0 10px',
                }}
              >
                {standardOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} - {option.title}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Rows</span>
              <select
                value={maxRows}
                onChange={(event) => setMaxRows(Number(event.target.value))}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  fontSize: 14,
                  minHeight: 42,
                  padding: '0 10px',
                }}
              >
                <option value={1}>1 row</option>
                <option value={4}>4 rows</option>
                <option value={5}>5 rows</option>
                <option value={8}>8 rows</option>
                <option value={12}>12 rows</option>
                <option value={15}>15 rows</option>
              </select>
            </label>

            {standardCode === 'ELA.9.R.1.1' ? (
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>R.1.1 sub-skill</span>
                <select
                  value={subSkillId}
                  onChange={(event) => setSubSkillId(event.target.value)}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.dark,
                    fontSize: 14,
                    minHeight: 42,
                    padding: '0 10px',
                  }}
                >
                  <option value="">Best available</option>
                  <option value="setting-layer">Setting adds meaning/style</option>
                  <option value="plot-conflict-layer">Plot or conflict adds meaning</option>
                  <option value="characterization-layer">Characterization adds meaning</option>
                  <option value="point-of-view-layer">Point of view adds meaning</option>
                  <option value="theme-tone-layer">Theme or tone layer</option>
                  <option value="style-technique-layer">Style technique adds meaning</option>
                </select>
              </label>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={loadSheet}
                style={{
                  alignItems: 'center',
                  background: C.blue,
                  border: 'none',
                  borderRadius: 6,
                  color: C.white,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  justifyContent: 'center',
                  minHeight: 42,
                }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
              <button
                type="button"
                onClick={copyMarkdown}
                disabled={!sheet}
                style={{
                  alignItems: 'center',
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  cursor: sheet ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  justifyContent: 'center',
                  minHeight: 42,
                }}
              >
                <Clipboard size={15} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </section>

        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            marginTop: 18,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ alignItems: 'center', color: C.gray, display: 'flex', gap: 10, padding: 24 }}>
              <Loader2 size={18} className="animate-spin" />
              Building paragraph-level pull-outs...
            </div>
          ) : error ? (
            <div style={{ color: C.red, fontSize: 15, fontWeight: 800, padding: 24 }}>{error}</div>
          ) : sheet ? (
            <div>
              <div
                style={{
                  borderBottom: `1px solid ${C.border}`,
                  display: 'grid',
                  gap: 8,
                  padding: 18,
                }}
              >
                <h2 style={{ color: C.dark, fontSize: 24, margin: 0 }}>{sheet.title}</h2>
                <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  Essential Question: {sheet.essentialQuestion}
                </p>
                <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                  {selectedStandard?.code} · {selectedStandard?.title} · {sheet.sourceTexts.length}{' '}
                  stored official texts available
                </div>
              </div>

              {!sheet.rows.length ? (
                <div style={{ color: C.gray, fontSize: 15, lineHeight: 1.5, padding: 24 }}>
                  No stored text excerpts were found for this standard yet. Check the official text
                  checklist or upload/source the missing texts first.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12, padding: 16 }}>
                  {sheet.rows.map((row) => (
                    <article
                      key={`${row.selection}-${row.exactLinesOrParagraphs}-${row.number}`}
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        display: 'grid',
                        gap: 12,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                            #{row.number} · {row.standard} · {row.exactLinesOrParagraphs}
                          </div>
                          <h3 style={{ color: C.dark, fontSize: 18, margin: '4px 0 0' }}>
                            {row.selection}
                          </h3>
                        </div>
                        <div
                          style={{
                            background: C.light,
                            border: `1px solid ${confidenceColor(row.teacherTrust.confidence)}`,
                            borderRadius: 6,
                            color: confidenceColor(row.teacherTrust.confidence),
                            fontSize: 11,
                            fontWeight: 900,
                            padding: '5px 8px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {confidenceLabel(row.teacherTrust.confidence)}
                        </div>
                      </div>

                      <p
                        style={{
                          background: '#FBFCFF',
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          color: C.dark,
                          fontFamily: FONTS.passage,
                          fontSize: 15,
                          lineHeight: 1.65,
                          margin: 0,
                          padding: 12,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {row.excerpt.length <= 760 ? row.excerpt : compact(row.excerpt, 760)}
                      </p>

                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                        <div>
                          <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                            Skill focus
                          </div>
                          <p style={{ color: C.blue, fontSize: 13, fontWeight: 900, lineHeight: 1.5, margin: '4px 0 12px' }}>
                            {row.skillFocus}
                          </p>
                          <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                            Why this excerpt
                          </div>
                          <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.5, margin: '4px 0 0' }}>
                            {row.whyThisExcerpt}
                          </p>
                        </div>
                        <div>
                          <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                            Skill strategy
                          </div>
                          <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.5, margin: '4px 0 0' }}>
                            {row.moveStatementTemplate}
                          </p>
                        </div>
                      </div>

                      <div
                        style={{
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          display: 'grid',
                          gap: 10,
                          gridTemplateColumns: '220px 1fr',
                          padding: 12,
                        }}
                      >
                        <div>
                          <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                            Teacher trust check
                          </div>
                          <div
                            style={{
                              color: confidenceColor(row.teacherTrust.confidence),
                              fontSize: 18,
                              fontWeight: 900,
                              marginTop: 4,
                            }}
                          >
                            {confidenceLabel(row.teacherTrust.confidence)}
                          </div>
                          <div style={{ color: C.gray, fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
                            Official text map: {row.teacherTrust.officialTextMap ? 'yes' : 'no'}
                            <br />
                            Local source text: {row.teacherTrust.localSourceText ? 'yes' : 'no'}
                            <br />
                            Excerpt: {row.teacherTrust.excerptWords} words
                          </div>
                        </div>
                        <div>
                          <p style={{ color: C.dark, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                            {row.teacherTrust.whyTrustIt}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                            {row.teacherTrust.evidencePoints.map((point) => (
                              <span
                                key={point}
                                style={{
                                  background: '#EEF4FF',
                                  border: `1px solid ${C.blueMid}`,
                                  borderRadius: 999,
                                  color: C.navy,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '4px 8px',
                                }}
                              >
                                {point}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          background: '#FFF8E1',
                          border: `1px solid ${C.amber}`,
                          borderRadius: 6,
                          padding: 12,
                        }}
                      >
                        <div style={{ color: C.dark, fontSize: 13, fontWeight: 900 }}>
                          {row.anchorQuestion.stem}
                        </div>
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          {row.anchorQuestion.choices.map((choice) => (
                            <div
                              key={choice.label}
                              style={{
                                color: choice.correct ? C.green : C.dark,
                                fontSize: 13,
                                fontWeight: choice.correct ? 900 : 600,
                                lineHeight: 1.4,
                              }}
                            >
                              {choice.label}. {choice.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div
                style={{
                  background: C.navy,
                  color: C.white,
                  display: 'grid',
                  gap: 8,
                  padding: 18,
                }}
              >
                <div style={{ color: C.blueMid, fontSize: 11, fontWeight: 900 }}>TEACHER NOTES</div>
                {sheet.teacherNotes.map((note) => (
                  <div key={note} style={{ fontSize: 13, lineHeight: 1.45 }}>
                    {note}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
