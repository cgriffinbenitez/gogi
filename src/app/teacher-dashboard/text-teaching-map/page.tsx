'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

type TextTeachingMap = {
  selectedText: {
    title: string;
    author: string | null;
    status: string;
    wordCount: number;
    standards: string[];
    hasLocalText: boolean;
  } | null;
  texts: Array<{
    title: string;
    author: string | null;
    status: string;
    wordCount: number;
    standards: string[];
    hasLocalText: boolean;
  }>;
  standards: Array<{
    code: string;
    title: string;
    readyPullOuts: number;
    rows: Array<{
      number: number;
      standard: string;
      skillFocus: string;
      selection: string;
      exactLinesOrParagraphs: string;
      excerpt: string;
      whyThisExcerpt: string;
      moveStatementTemplate: string;
      teacherTrust: {
        confidence: 'strong' | 'emerging' | 'weak';
        evidencePoints: string[];
        whyTrustIt: string;
        excerptWords: number;
      };
      anchorQuestion: {
        stem: string;
        choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
      };
    }>;
  }>;
  emptyState: string | null;
};

function compact(value: string, max = 520) {
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
  if (confidence === 'strong') return 'Strong';
  if (confidence === 'emerging') return 'Teacher skim';
  return 'Needs better excerpt';
}

export default function TextTeachingMapPage() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState(searchParams.get('title') ?? '');
  const [map, setMap] = useState<TextTeachingMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedTitle = useMemo(
    () => title || map?.selectedText?.title || '',
    [map?.selectedText?.title, title]
  );

  async function loadMap(nextTitle = title) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/text-teaching-map?rows=2${nextTitle ? `&title=${encodeURIComponent(nextTitle)}` : ''}`
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not load text map.');
      setMap(json.map);
      if (!nextTitle && json.map?.selectedText?.title) setTitle(json.map.selectedText.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load text map.');
      setMap(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMap(title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="textmap" />
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            padding: 18,
          }}
        >
          <div>
            <div style={{ color: C.gray, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
              TEXT-FIRST TEACHING MAP
            </div>
            <h1 style={{ color: C.dark, fontSize: 34, lineHeight: 1.08, margin: '8px 0' }}>
              Teach From One Florida Text
            </h1>
            <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: 760 }}>
              Pick the text first. GOGI shows the official standards it can teach, then gives you
              precise Promethean excerpts and FAST-style checks tied to those standards.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Florida text</span>
              <select
                value={selectedTitle}
                onChange={(event) => {
                  setTitle(event.target.value);
                  void loadMap(event.target.value);
                }}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  fontSize: 14,
                  minHeight: 42,
                  padding: '0 10px',
                }}
              >
                {map?.texts.map((text) => (
                  <option key={`${text.title}-${text.author ?? ''}`} value={text.title}>
                    {text.title} {text.hasLocalText ? '' : '(needs source)'}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => loadMap(title)}
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
              Refresh Map
            </button>
          </div>
        </section>

        {loading ? (
          <div style={{ alignItems: 'center', color: C.gray, display: 'flex', gap: 10, padding: 24 }}>
            <Loader2 size={18} className="animate-spin" />
            Building text teaching map...
          </div>
        ) : error ? (
          <div style={{ color: C.red, fontWeight: 900, padding: 24 }}>{error}</div>
        ) : map?.selectedText ? (
          <>
            <section
              style={{
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                display: 'grid',
                gap: 10,
                marginTop: 16,
                padding: 16,
              }}
            >
              <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                {map.selectedText.hasLocalText ? 'LOCAL SOURCE READY' : 'SOURCE NEEDED'}
              </div>
              <h2 style={{ color: C.dark, fontSize: 24, margin: 0 }}>
                {map.selectedText.title}
                {map.selectedText.author ? ` — ${map.selectedText.author}` : ''}
              </h2>
              <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5 }}>
                Standards mapped by Florida: {map.selectedText.standards.join(', ')}
                <br />
                Local words: {map.selectedText.wordCount.toLocaleString()}
              </div>
            </section>

            {map.emptyState ? (
              <section
                style={{
                  background: '#FFF8E1',
                  border: `1px solid ${C.amber}`,
                  borderRadius: 8,
                  color: C.dark,
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginTop: 16,
                  padding: 16,
                }}
              >
                {map.emptyState}
              </section>
            ) : null}

            <section style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              {map.standards.map((standard) => (
                <article
                  key={standard.code}
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      display: 'flex',
                      gap: 12,
                      justifyContent: 'space-between',
                      padding: 14,
                    }}
                  >
                    <div>
                      <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                        {standard.code}
                      </div>
                      <h3 style={{ color: C.dark, fontSize: 20, margin: '3px 0 0' }}>
                        {standard.title}
                      </h3>
                    </div>
                    <div style={{ color: C.green, fontSize: 13, fontWeight: 900 }}>
                      {standard.readyPullOuts}/{standard.rows.length} strong
                    </div>
                  </div>

                  {standard.rows.length ? (
                    <div style={{ display: 'grid', gap: 12, padding: 14 }}>
                      {standard.rows.map((row) => (
                        <div
                          key={`${standard.code}-${row.exactLinesOrParagraphs}-${row.number}`}
                          style={{
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            display: 'grid',
                            gap: 10,
                            padding: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ color: C.blue, fontSize: 12, fontWeight: 900 }}>
                                {row.skillFocus} · {row.exactLinesOrParagraphs}
                              </div>
                              <div style={{ color: C.gray, fontSize: 12, marginTop: 3 }}>
                                {row.whyThisExcerpt}
                              </div>
                            </div>
                            <div
                              style={{
                                color: confidenceColor(row.teacherTrust.confidence),
                                fontSize: 11,
                                fontWeight: 900,
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
                              fontSize: 14,
                              lineHeight: 1.6,
                              margin: 0,
                              padding: 10,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {row.excerpt.length <= 520 ? row.excerpt : compact(row.excerpt)}
                          </p>
                          <div style={{ color: C.dark, fontSize: 13, fontWeight: 900 }}>
                            {row.anchorQuestion.stem}
                          </div>
                          <div style={{ display: 'grid', gap: 5 }}>
                            {row.anchorQuestion.choices.map((choice) => (
                              <div
                                key={choice.label}
                                style={{
                                  color: choice.correct ? C.green : C.dark,
                                  fontSize: 13,
                                  fontWeight: choice.correct ? 900 : 600,
                                  lineHeight: 1.35,
                                }}
                              >
                                {choice.label}. {choice.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: C.gray, fontSize: 14, lineHeight: 1.5, padding: 14 }}>
                      No pull-out candidates yet for this standard from this text.
                    </div>
                  )}
                </article>
              ))}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
