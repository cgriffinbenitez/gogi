'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';

type CorpusCard = {
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  skillLabel: string;
  selection: string;
  location: string;
  excerpt: string;
  question: string;
  choices: Array<{ label: string; text: string; correct: boolean }>;
  evidencePoints: string[];
  quality: string;
  confidence: string;
};

type CorpusText = {
  title: string;
  author: string | null;
  status: string;
  wordCount: number;
  hasLocalText: boolean;
  standards: string[];
  cards: CorpusCard[];
  cardCount: number;
  standardsWithCards: string[];
  standardsWithoutCards: string[];
};

type Corpus = {
  generatedAt: string;
  summary: {
    officialTexts: number;
    locallyStoredTexts: number;
    textsWithGoldCards: number;
    totalGoldCards: number;
    standardsRepresented: number;
    locallyStoredWithoutGoldCards: number;
    officialTextsWithoutLocalSource: number;
  };
  texts: CorpusText[];
};

type InventoryCandidate = {
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  subSkillLabel: string;
  studentCanDo: string;
  location: string;
  excerpt: string;
  wordCount: number;
  paragraphCount: number;
  score: number;
  tier: string;
  justification: string;
  evidenceSignals: string[];
  suggestedQuestionStem: string;
};

type Inventory = {
  summary: {
    officialTexts: number;
    localTexts: number;
    textsWithCandidates: number;
    totalCandidates: number;
    standardsRepresented: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    candidateCount: number;
    candidates: InventoryCandidate[];
  }>;
};

type AutoGoldCard = {
  id: string;
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  wordCount: number;
  whyThisWorks: string;
  skillStrategy: string;
  evidencePoints: string[];
  question: string;
  choices: Array<{ label: string; text: string; correct: boolean }>;
  auditLabel: 'auto-ready';
};

type ClaudeReadyCard = Omit<AutoGoldCard, 'auditLabel'> & {
  textTitle: string;
  textAuthor: string | null;
  auditLabel: 'claude-ready';
};

type AutoGoldCorpus = {
  summary: {
    autoReadyCards: number;
    textsWithAutoReadyCards: number;
    standardsRepresented: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    cards: AutoGoldCard[];
    cardCount: number;
  }>;
};

type ClaudeReadyCorpus = {
  summary: {
    readyCards: number;
    textsWithCards: number;
    standardsRepresented: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    cards: ClaudeReadyCard[];
    cardCount: number;
  }>;
};

type CardQualityAudit = {
  summary: {
    classroomReadyCards: number;
    cardsWithMajorRisk: number;
    blockers: number;
    major: number;
    minor: number;
    claudeReadyCardsAudited?: number;
  };
  issues: Array<{
    severity: 'blocker' | 'major' | 'minor';
    layer: 'gold' | 'auto-ready' | 'claude-ready';
    textTitle: string;
    textAuthor: string | null;
    standardCode: string;
    subSkillLabel: string;
    location: string;
  }>;
};

const STANDARD_FALLBACK_LABELS: Record<string, string> = {
  'ELA.9.R.1.1': 'Key literary elements add layers of meaning',
  'ELA.9.R.1.2': 'Theme development across a literary text',
  'ELA.9.R.1.3': 'Narrator perspective, irony, and satire',
  'ELA.9.R.1.4': 'Epic poetry',
  'ELA.9.R.2.1': 'Text structure and feature purpose',
  'ELA.9.R.2.2': 'Central idea and supporting evidence',
  'ELA.9.R.2.3': 'Rhetorical appeals and author purpose',
  'ELA.9.R.2.4': 'Opposing arguments, claims, evidence, and validity',
  'ELA.9.R.3.1': 'Figurative language effect',
  'ELA.9.R.3.2': 'Paraphrase grade-level text',
  'ELA.9.R.3.3': 'Adaptation across texts',
  'ELA.9.R.3.4': 'Rhetoric and reader effect',
  'ELA.9.V.1.1': 'Academic vocabulary',
  'ELA.9.V.1.2': 'Etymology and derivations',
  'ELA.9.V.1.3': 'Context and connotation',
};

function pillStyle(bg: string, color: string = C.dark, border: string = C.border) {
  return {
    alignItems: 'center',
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 999,
    color,
    display: 'inline-flex',
    fontSize: 12,
    fontWeight: 900,
    minHeight: 26,
    padding: '0 10px',
  };
}

function compact(value: string, max = 420) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function sourceAttribution(title: string, author: string | null | undefined) {
  return author ? `${title} — ${author}` : title;
}

function sourceLabel(text: CorpusText) {
  if (text.hasLocalText) return text.status === 'manual_upload' ? 'Uploaded' : 'Stored';
  if (text.status === 'reference_only') return 'Reference';
  return 'Missing source';
}

function sourceColor(text: CorpusText) {
  if (text.hasLocalText) return { bg: '#EEF8EA', color: C.green, border: C.green };
  if (text.status === 'reference_only') return { bg: C.light, color: C.gray, border: C.border };
  return { bg: C.redLight, color: C.red, border: C.red };
}

function groupCards(cards: CorpusCard[]) {
  const map = new Map<string, { key: string; title: string; cards: CorpusCard[] }>();
  for (const card of cards) {
    const key = `${card.standardCode}::${card.skillLabel}`;
    const existing = map.get(key);
    if (existing) {
      existing.cards.push(card);
    } else {
      map.set(key, {
        key,
        title: `${card.standardCode} · ${card.skillLabel}`,
        cards: [card],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function groupCandidates(candidates: InventoryCandidate[]) {
  const map = new Map<string, { key: string; title: string; candidates: InventoryCandidate[] }>();
  for (const candidate of candidates) {
    const key = `${candidate.standardCode}::${candidate.subSkillLabel}`;
    const existing = map.get(key);
    if (existing) {
      existing.candidates.push(candidate);
    } else {
      map.set(key, {
        key,
        title: `${candidate.standardCode} · ${candidate.subSkillLabel}`,
        candidates: [candidate],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

type ReadyCard = AutoGoldCard | ClaudeReadyCard;

function groupReadyCards<T extends ReadyCard>(cards: T[]) {
  const map = new Map<string, { key: string; title: string; cards: T[] }>();
  for (const card of cards) {
    const key = `${card.standardCode}::${card.subSkillLabel}`;
    const existing = map.get(key);
    if (existing) {
      existing.cards.push(card);
    } else {
      map.set(key, {
        key,
        title: `${card.standardCode} · ${card.subSkillLabel}`,
        cards: [card],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function auditIssueKey(args: {
  layer: 'gold' | 'auto-ready' | 'claude-ready';
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
}) {
  return [
    args.layer,
    args.textTitle,
    args.textAuthor ?? '',
    args.standardCode,
    args.subSkillLabel,
    args.location,
  ].join('::');
}

export default function OfficialTeachableCorpusPage() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [autoGold, setAutoGold] = useState<AutoGoldCorpus | null>(null);
  const [claudeReady, setClaudeReady] = useState<ClaudeReadyCorpus | null>(null);
  const [cardAudit, setCardAudit] = useState<CardQualityAudit | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [standardFilter, setStandardFilter] = useState('all');
  const [browseMode, setBrowseMode] = useState<'standard' | 'text'>('standard');
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'gold'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'covered' | 'gaps' | 'missing'>('all');
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCorpus() {
    setLoading(true);
    setError(null);
    try {
      const [corpusRes, inventoryRes, autoGoldRes, claudeReadyRes, auditRes] = await Promise.all([
        fetch('/api/teacher/official-teachable-corpus'),
        fetch('/api/teacher/official-excerpt-inventory?maxPerLane=10'),
        fetch('/api/teacher/official-auto-gold-cards'),
        fetch('/api/teacher/official-claude-ready-cards'),
        fetch('/api/teacher/official-card-quality-audit'),
      ]);
      const corpusJson = await corpusRes.json();
      const inventoryJson = await inventoryRes.json();
      const autoGoldJson = await autoGoldRes.json();
      const claudeReadyJson = await claudeReadyRes.json();
      const auditJson = await auditRes.json();
      if (!corpusRes.ok || !corpusJson.ok) {
        throw new Error(corpusJson.error ?? 'Could not load official corpus.');
      }
      if (!inventoryRes.ok || !inventoryJson.ok) {
        throw new Error(inventoryJson.error ?? 'Could not load excerpt inventory.');
      }
      if (!autoGoldRes.ok || !autoGoldJson.ok) {
        throw new Error(autoGoldJson.error ?? 'Could not load auto-ready gold cards.');
      }
      if (!claudeReadyRes.ok || !claudeReadyJson.ok) {
        throw new Error(claudeReadyJson.error ?? 'Could not load classroom-ready cards.');
      }
      if (!auditRes.ok || !auditJson.ok) {
        throw new Error(auditJson.error ?? 'Could not load card quality audit.');
      }
      setCorpus(corpusJson.corpus);
      setInventory(inventoryJson.inventory);
      setAutoGold(autoGoldJson.corpus);
      setClaudeReady(claudeReadyJson.corpus);
      setCardAudit(auditJson.report);
      setSelectedTitle((current) => current ?? corpusJson.corpus.texts[0]?.title ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load official corpus.');
      setCorpus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCorpus();
  }, []);

  const standardOptions = useMemo(() => {
    if (!corpus) return [];
    return [...new Set(corpus.texts.flatMap((text) => text.standards))].sort();
  }, [corpus]);

  const standardTitleMap = useMemo(() => {
    const titles = new Map<string, string>();
    Object.entries(STANDARD_FALLBACK_LABELS).forEach(([code, title]) => titles.set(code, title));
    corpus?.texts.forEach((text) => {
      text.cards.forEach((card) => titles.set(card.standardCode, card.standardTitle));
    });
    inventory?.texts.forEach((text) => {
      text.candidates.forEach((candidate) => titles.set(candidate.standardCode, candidate.standardTitle));
    });
    autoGold?.texts.forEach((text) => {
      text.cards.forEach((card) => titles.set(card.standardCode, card.standardTitle));
    });
    claudeReady?.texts.forEach((text) => {
      text.cards.forEach((card) => titles.set(card.standardCode, card.standardTitle));
    });
    return titles;
  }, [autoGold, claudeReady, corpus, inventory]);

  const standardLabel = (standard: string) => `${standard} — ${standardTitleMap.get(standard) ?? 'Official benchmark'}`;

  const majorRiskCardKeys = useMemo(() => {
    const keys = new Set<string>();
    cardAudit?.issues
      .filter((issue) => issue.severity === 'blocker' || issue.severity === 'major')
      .forEach((issue) => {
        keys.add(auditIssueKey(issue));
      });
    return keys;
  }, [cardAudit]);

  const isGoldCardAuditReady = (text: CorpusText, card: CorpusCard) =>
    !majorRiskCardKeys.has(
      auditIssueKey({
        layer: 'gold',
        textTitle: text.title,
        textAuthor: text.author,
        standardCode: card.standardCode,
        subSkillLabel: card.skillLabel,
        location: card.location,
      })
    );

  const isAutoCardAuditReady = (text: { title: string; author: string | null }, card: AutoGoldCard) =>
    !majorRiskCardKeys.has(
      auditIssueKey({
        layer: 'auto-ready',
        textTitle: text.title,
        textAuthor: text.author,
        standardCode: card.standardCode,
        subSkillLabel: card.subSkillLabel,
        location: card.location,
      })
    );

  const isClaudeCardAuditReady = (text: { title: string; author: string | null }, card: ClaudeReadyCard) =>
    !majorRiskCardKeys.has(
      auditIssueKey({
        layer: 'claude-ready',
        textTitle: text.title,
        textAuthor: text.author,
        standardCode: card.standardCode,
        subSkillLabel: card.subSkillLabel,
        location: card.location,
      })
    );

  const filteredTexts = useMemo(() => {
    if (!corpus) return [];
    const needle = query.trim().toLowerCase();
    return corpus.texts.filter((text) => {
      const autoText = autoGold?.texts.find((item) => item.title === text.title);
      const claudeText = claudeReady?.texts.find((item) => item.title === text.title);
      const goldForStandard =
        standardFilter === 'all'
          ? text.cards.filter((card) => isGoldCardAuditReady(text, card)).length
          : text.cards.filter((card) => card.standardCode === standardFilter && isGoldCardAuditReady(text, card)).length;
      const autoForStandard =
        standardFilter === 'all'
          ? autoText?.cards.filter((card) => isAutoCardAuditReady(autoText, card)).length ?? 0
          : autoText?.cards.filter((card) => card.standardCode === standardFilter && isAutoCardAuditReady(autoText, card)).length ?? 0;
      const claudeForStandard =
        standardFilter === 'all'
          ? claudeText?.cards.filter((card) => isClaudeCardAuditReady(claudeText, card)).length ?? 0
          : claudeText?.cards.filter((card) => card.standardCode === standardFilter && isClaudeCardAuditReady(claudeText, card)).length ?? 0;
      const readyForFilter = goldForStandard + autoForStandard + claudeForStandard;
      const matchesQuery =
        !needle ||
        text.title.toLowerCase().includes(needle) ||
        (text.author ?? '').toLowerCase().includes(needle);
      const matchesStandard = standardFilter === 'all' || text.standards.includes(standardFilter);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'covered' && readyForFilter > 0) ||
        (statusFilter === 'gaps' &&
          text.hasLocalText &&
          (standardFilter === 'all' ? text.standardsWithoutCards.length > 0 : readyForFilter === 0)) ||
        (statusFilter === 'missing' && !text.hasLocalText);
      return matchesQuery && matchesStandard && matchesStatus;
    });
  }, [autoGold, claudeReady, corpus, majorRiskCardKeys, query, standardFilter, statusFilter]);

  const selectedText =
    filteredTexts.find((text) => text.title === selectedTitle) ??
    corpus?.texts.find((text) => text.title === selectedTitle) ??
    filteredTexts[0] ??
    null;
  const selectedInventoryText = inventory?.texts.find((text) => text.title === selectedText?.title) ?? null;
  const selectedAutoGoldText = autoGold?.texts.find((text) => text.title === selectedText?.title) ?? null;
  const selectedClaudeReadyText = claudeReady?.texts.find((text) => text.title === selectedText?.title) ?? null;
  const selectedStandard = standardFilter === 'all' ? null : standardFilter;
  const selectedGoldCards = selectedText
    ? selectedText.cards.filter((card) => (!selectedStandard || card.standardCode === selectedStandard) && isGoldCardAuditReady(selectedText, card))
    : [];
  const selectedAutoReadyCards = selectedAutoGoldText
    ? selectedAutoGoldText.cards.filter((card) => (!selectedStandard || card.standardCode === selectedStandard) && isAutoCardAuditReady(selectedAutoGoldText, card))
    : [];
  const selectedClaudeReadyCards = selectedClaudeReadyText
    ? selectedClaudeReadyText.cards.filter((card) => (!selectedStandard || card.standardCode === selectedStandard) && isClaudeCardAuditReady(selectedClaudeReadyText, card))
    : [];
  const selectedRawCandidates = selectedInventoryText
    ? selectedInventoryText.candidates.filter((candidate) => !selectedStandard || candidate.standardCode === selectedStandard)
    : [];
  const showGold = readinessFilter === 'all' || readinessFilter === 'gold';
  const showClaude = readinessFilter === 'all';
  const showAuto = false;
  const showRaw = false;
  const readyTextCount = useMemo(() => {
    if (!corpus) return 0;
    return corpus.texts.filter((text) => {
      const claudeText = claudeReady?.texts.find((item) => item.title === text.title && item.author === text.author);
      const gold = text.cards.filter((card) => isGoldCardAuditReady(text, card)).length;
      const claudeCount = claudeText?.cards.filter((card) => isClaudeCardAuditReady(claudeText, card)).length ?? 0;
      return gold + claudeCount > 0;
    }).length;
  }, [claudeReady, corpus, majorRiskCardKeys]);
  const coveredStandardCount = useMemo(() => {
    const standards = new Set<string>();
    corpus?.texts.forEach((text) => {
      text.cards.filter((card) => isGoldCardAuditReady(text, card)).forEach((card) => standards.add(card.standardCode));
    });
    claudeReady?.texts.forEach((text) => {
      text.cards.filter((card) => isClaudeCardAuditReady(text, card)).forEach((card) => standards.add(card.standardCode));
    });
    return standards.size;
  }, [claudeReady, corpus, majorRiskCardKeys]);
  const needsAttentionCount = Math.max(0, (corpus?.summary.locallyStoredTexts ?? 0) - readyTextCount);

  const standardCommandRows = useMemo(() => {
    if (!corpus || !selectedStandard) return [];
    return corpus.texts
      .filter((text) => text.standards.includes(selectedStandard))
      .map((text) => {
        const autoText = autoGold?.texts.find((item) => item.title === text.title);
        const claudeText = claudeReady?.texts.find((item) => item.title === text.title);
        const inventoryText = inventory?.texts.find((item) => item.title === text.title);
        const goldCount = text.cards.filter((card) => card.standardCode === selectedStandard && isGoldCardAuditReady(text, card)).length;
        const autoCount = autoText?.cards.filter((card) => card.standardCode === selectedStandard && isAutoCardAuditReady(autoText, card)).length ?? 0;
        const claudeCount = claudeText?.cards.filter((card) => card.standardCode === selectedStandard && isClaudeCardAuditReady(claudeText, card)).length ?? 0;
        const rawCount = inventoryText?.candidates.filter((candidate) => candidate.standardCode === selectedStandard).length ?? 0;
        return { text, goldCount, autoCount, claudeCount, rawCount, readyCount: goldCount + autoCount + claudeCount };
      })
      .sort((a, b) => b.readyCount - a.readyCount || b.rawCount - a.rawCount || a.text.title.localeCompare(b.text.title));
  }, [autoGold, claudeReady, corpus, inventory, majorRiskCardKeys, selectedStandard]);

  useEffect(() => {
    if (filteredTexts.length > 0 && !filteredTexts.some((text) => text.title === selectedTitle)) {
      setSelectedTitle(filteredTexts[0].title);
    }
  }, [filteredTexts, selectedTitle]);

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="corpus" />
      <main style={{ maxWidth: 1380, margin: '0 auto', padding: '28px 20px 56px' }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: C.blue, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
                OFFICIAL TEACHABLE CORPUS
              </div>
              <h1 style={{ color: C.dark, fontSize: 34, lineHeight: 1.08, margin: '8px 0' }}>
                Text → Standard → Excerpt Map
              </h1>
              <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: 900 }}>
                Every official text GOGI knows about, organized by the classroom-ready excerpts and FAST-style questions
                you can actually teach.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'start', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={loadCorpus}
                style={{
                  alignItems: 'center',
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.dark,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
              <a
                href="/api/teacher/official-teachable-corpus?format=claude"
                target="_blank"
                rel="noreferrer"
                style={{
                  alignItems: 'center',
                  background: C.blue,
                  border: `1px solid ${C.blue}`,
                  borderRadius: 6,
                  color: C.white,
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                  textDecoration: 'none',
                }}
              >
                Claude packet
                <ExternalLink size={15} />
              </a>
              <a
                href="/api/teacher/official-teachable-corpus?format=markdown"
                target="_blank"
                rel="noreferrer"
                style={{
                  alignItems: 'center',
                  background: C.green,
                  border: `1px solid ${C.green}`,
                  borderRadius: 6,
                  color: C.white,
                  display: 'inline-flex',
                  fontSize: 13,
                  fontWeight: 900,
                  gap: 8,
                  minHeight: 40,
                  padding: '0 13px',
                  textDecoration: 'none',
                }}
              >
                Summary export
              </a>
            </div>
          </div>

          {loading ? (
            <div style={{ alignItems: 'center', display: 'flex', gap: 10, marginTop: 20 }}>
              <Loader2 size={18} className="animate-spin" />
              Building the official text map...
            </div>
          ) : error ? (
            <div style={{ ...pillStyle(C.redLight, C.red, C.red), marginTop: 16 }}>{error}</div>
          ) : corpus ? (
            <>
              <div
                style={{
                  background: C.light,
                  borderRadius: 8,
                  display: 'grid',
                  gap: 10,
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  marginTop: 16,
                  padding: 12,
                }}
              >
                {[
                  ['Classroom-ready cards', cardAudit?.summary.classroomReadyCards ?? 0],
                  ['Texts ready to teach', `${readyTextCount}/${corpus.summary.locallyStoredTexts}`],
                  ['Standards covered', coveredStandardCount],
                  ['Texts needing coverage', needsAttentionCount],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>{label}</div>
                    <div style={{ color: C.dark, fontSize: 26, fontWeight: 900 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  gridTemplateColumns: '0.72fr 1fr 0.9fr 0.8fr',
                  marginTop: 14,
                }}
              >
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Browse by</span>
                  <div
                    style={{
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      minHeight: 42,
                      overflow: 'hidden',
                    }}
                  >
                    {[
                      ['standard', 'Standard'],
                      ['text', 'Text'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBrowseMode(value as typeof browseMode)}
                        style={{
                          background: browseMode === value ? C.blue : C.white,
                          border: 0,
                          color: browseMode === value ? C.white : C.dark,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Search text or author</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Animal Farm, MLK, Homer..."
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.dark,
                      fontSize: 14,
                      minHeight: 42,
                      padding: '0 12px',
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Filter by standard</span>
                  <select
                    value={standardFilter}
                    onChange={(event) => setStandardFilter(event.target.value)}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.dark,
                      fontSize: 14,
                      minHeight: 42,
                      padding: '0 10px',
                    }}
                  >
                    <option value="all">All standards</option>
                    {standardOptions.map((standard) => (
                      <option key={standard} value={standard}>
                        {standardLabel(standard)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Show</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.dark,
                      fontSize: 14,
                      minHeight: 42,
                      padding: '0 10px',
                    }}
                  >
                  <option value="all">All card-ready texts</option>
                    <option value="covered">Texts with teachable excerpts</option>
                    <option value="gaps">Stored texts with standard gaps</option>
                    <option value="missing">Missing source texts</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
                <span style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>
                  Choose official text ({filteredTexts.length} shown)
                </span>
                <select
                  value={selectedText?.title ?? ''}
                  onChange={(event) => {
                    setSelectedTitle(event.target.value);
                    setOpenCards({});
                  }}
                  style={{
                    border: `1px solid ${C.blue}`,
                    borderRadius: 6,
                    color: C.dark,
                    fontSize: 15,
                    fontWeight: 800,
                    minHeight: 46,
                    padding: '0 12px',
                  }}
                >
                  {filteredTexts.map((text) => {
                    const autoText = autoGold?.texts.find((item) => item.title === text.title);
                    const claudeText = claudeReady?.texts.find((item) => item.title === text.title);
                    const autoReady = selectedStandard
                      ? autoText?.cards.filter((card) => card.standardCode === selectedStandard && isAutoCardAuditReady(autoText, card)).length ?? 0
                      : autoText?.cards.filter((card) => isAutoCardAuditReady(autoText, card)).length ?? 0;
                    const claudeCount = selectedStandard
                      ? claudeText?.cards.filter((card) => card.standardCode === selectedStandard && isClaudeCardAuditReady(claudeText, card)).length ?? 0
                      : claudeText?.cards.filter((card) => isClaudeCardAuditReady(claudeText, card)).length ?? 0;
                    const gold = selectedStandard
                      ? text.cards.filter((card) => card.standardCode === selectedStandard && isGoldCardAuditReady(text, card)).length
                      : text.cards.filter((card) => isGoldCardAuditReady(text, card)).length;
                    const available = gold + autoReady + claudeCount;
                    return (
                      <option key={`${text.title}-${text.author ?? 'unknown'}`} value={text.title}>
                        {text.title}
                        {text.author ? ` — ${text.author}` : ''} · {sourceLabel(text)} · {available} ready cards
                      </option>
                    );
                  })}
                </select>
              </label>

              <div
                style={{
                  alignItems: 'center',
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'space-between',
                  marginTop: 12,
                  padding: 10,
                }}
              >
                <div>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 900 }}>Card view</div>
                  <div style={{ color: C.dark, fontSize: 13, fontWeight: 800, marginTop: 2 }}>
                    Show classroom-ready cards, with an optional view for hand-reviewed cards only.
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {[
                    ['all', 'Ready to teach'],
                    ['gold', 'Reviewed only'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReadinessFilter(value as typeof readinessFilter)}
                      style={{
                        background: readinessFilter === value ? C.dark : C.white,
                        border: `1px solid ${readinessFilter === value ? C.dark : C.border}`,
                        borderRadius: 999,
                        color: readinessFilter === value ? C.white : C.dark,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 900,
                        minHeight: 30,
                        padding: '0 12px',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {browseMode === 'standard' ? (
                <div
                  style={{
                    background: selectedStandard ? C.blueLight : C.amberLight,
                    border: `1px solid ${selectedStandard ? C.blueMid : C.amber}`,
                    borderRadius: 8,
                    marginTop: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ color: C.blue, fontSize: 12, fontWeight: 900, letterSpacing: 0.8 }}>
                    STANDARD COMMAND VIEW
                  </div>
                  {selectedStandard ? (
                    <>
                      <h3 style={{ fontSize: 20, margin: '5px 0 6px' }}>{standardLabel(selectedStandard)}</h3>
                      <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.45, margin: 0 }}>
                        Best available texts for this standard, sorted by classroom-ready passages first.
                      </p>
                      <div
                        style={{
                          display: 'grid',
                          gap: 8,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          marginTop: 10,
                        }}
                      >
                        {standardCommandRows.slice(0, 12).map(({ text, readyCount }) => (
                          <button
                            key={`${selectedStandard}-${text.title}-${text.author ?? 'unknown'}`}
                            type="button"
                            onClick={() => {
                              setSelectedTitle(text.title);
                              setOpenCards({});
                            }}
                            style={{
                              background: selectedText?.title === text.title ? C.white : 'rgba(255,255,255,0.72)',
                              border: `1px solid ${selectedText?.title === text.title ? C.blue : C.border}`,
                              borderRadius: 8,
                              color: C.dark,
                              cursor: 'pointer',
                              padding: 10,
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 900 }}>{sourceAttribution(text.title, text.author)}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                              <span style={pillStyle(readyCount > 0 ? '#EEF8EA' : C.amberLight, readyCount > 0 ? C.green : C.amber, readyCount > 0 ? C.green : C.amber)}>
                                {readyCount} available passages
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: C.dark, fontSize: 14, fontWeight: 800, lineHeight: 1.45, marginTop: 6 }}>
                      Pick a standard above to see the strongest texts and excerpts for that skill.
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{ marginTop: 16 }}>
                <section
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    minHeight: 520,
                    padding: 16,
                  }}
                >
                  {selectedText ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ color: C.blue, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
                            OFFICIAL TEXT
                          </div>
                          <h2 style={{ fontSize: 28, lineHeight: 1.12, margin: '5px 0' }}>
                            {selectedText.title}
                            {selectedText.author ? (
                              <span style={{ color: C.gray, fontWeight: 700 }}> — {selectedText.author}</span>
                            ) : null}
                          </h2>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                            <span style={pillStyle(sourceColor(selectedText).bg, sourceColor(selectedText).color, sourceColor(selectedText).border)}>
                              {sourceLabel(selectedText)}
                            </span>
                            <span style={pillStyle(C.light)}>{selectedText.wordCount.toLocaleString()} words</span>
                            <span style={pillStyle(C.blueLight, C.blue, C.blue)}>
                              {selectedGoldCards.length + selectedClaudeReadyCards.length} classroom-ready cards
                            </span>
                            {selectedGoldCards.length > 0 ? (
                              <span style={pillStyle('#EEF8EA', C.green, C.green)}>
                                {selectedGoldCards.length} reviewed
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                          gridTemplateColumns: '1fr 1fr',
                          marginTop: 16,
                        }}
                      >
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ color: C.gray, fontSize: 12, fontWeight: 900 }}>Official standards this text can feed</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {selectedText.standards.map((standard) => (
                              <span key={standard} style={pillStyle(C.blueLight, C.blue, C.blue)}>
                                {standard}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ color: C.gray, fontSize: 12, fontWeight: 900 }}>Coverage right now</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {selectedText.standardsWithCards.length > 0 ? (
                              selectedText.standardsWithCards.map((standard) => (
                                <span key={standard} style={pillStyle('#EEF8EA', C.green, C.green)}>
                                  {standard}
                                </span>
                              ))
                            ) : (
                              <span style={pillStyle(C.redLight, C.red, C.red)}>No gold-card coverage yet</span>
                            )}
                          </div>
                          {selectedText.standardsWithoutCards.length > 0 ? (
                            <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
                              Still needs cards: {selectedText.standardsWithoutCards.join(', ')}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {showGold ? <div style={{ marginTop: 18 }}>
                        <h3 style={{ fontSize: 20, margin: '0 0 10px' }}>Reviewed Gold Cards</h3>
                        <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>
                          These are the locked exemplar cards. Treat this layer as the highest-confidence teacher-ready set.
                        </p>
                        {selectedGoldCards.length === 0 ? (
                          <div
                            style={{
                              background: selectedText.hasLocalText ? C.amberLight : C.redLight,
                              border: `1px solid ${selectedText.hasLocalText ? C.amber : C.red}`,
                              borderRadius: 8,
                              color: selectedText.hasLocalText ? C.dark : C.red,
                              fontWeight: 800,
                              padding: 14,
                            }}
                          >
                            {selectedText.hasLocalText
                              ? 'This text is stored, but GOGI has not curated gold-card excerpts for it yet.'
                              : 'This text is on the official map, but GOGI does not have a local source file yet.'}
                          </div>
                        ) : (
                          groupCards(selectedGoldCards).map((group) => (
                            <div key={group.key} style={{ marginBottom: 18 }}>
                              <div
                                style={{
                                  alignItems: 'center',
                                  display: 'flex',
                                  gap: 8,
                                  justifyContent: 'space-between',
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ color: C.dark, fontSize: 16, fontWeight: 900 }}>{group.title}</div>
                                <span style={pillStyle(C.light)}>{group.cards.length} excerpt cards</span>
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {group.cards.map((card, index) => {
                                  const cardKey = `${group.key}-${card.location}-${index}`;
                                  const isOpen = openCards[cardKey] ?? index === 0;
                                  return (
                                    <article
                                      key={cardKey}
                                      style={{
                                        border: `1px solid ${isOpen ? C.blue : C.border}`,
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenCards((current) => ({ ...current, [cardKey]: !isOpen }))
                                        }
                                        style={{
                                          background: isOpen ? C.blueLight : C.white,
                                          border: 0,
                                          color: C.dark,
                                          cursor: 'pointer',
                                          display: 'grid',
                                          gap: 6,
                                          padding: 12,
                                          textAlign: 'left',
                                          width: '100%',
                                        }}
                                      >
                                        <div style={{ color: C.blue, fontSize: 13, fontWeight: 900 }}>
                                          {card.location} · {card.quality}
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 900 }}>{card.question}</div>
                                        {!isOpen ? (
                                          <div style={{ color: C.gray, fontSize: 13 }}>{compact(card.excerpt, 180)}</div>
                                        ) : null}
                                      </button>
                                      {isOpen ? (
                                        <div style={{ display: 'grid', gap: 14, padding: 12 }}>
                                          <div
                                            style={{
                                              background: C.white,
                                              borderLeft: `4px solid ${C.blue}`,
                                              color: C.dark,
                                              fontFamily: FONTS.passage,
                                              fontSize: 16,
                                              lineHeight: 1.65,
                                              padding: '4px 0 4px 12px',
                                              userSelect: 'text',
                                            }}
                                          >
                                            {card.excerpt}
                                          </div>
                                          <div
                                            style={{
                                              color: C.gray,
                                              fontSize: 12,
                                              fontStyle: 'italic',
                                              fontWeight: 800,
                                              marginTop: -8,
                                              textAlign: 'right',
                                              userSelect: 'text',
                                            }}
                                          >
                                            Source: {sourceAttribution(selectedText.title, selectedText.author)}
                                          </div>
                                          <div>
                                            <div style={{ color: C.gray, fontSize: 12, fontWeight: 900 }}>FAST-style check</div>
                                            <div style={{ display: 'grid', gap: 6, marginTop: 7 }}>
                                              {card.choices.map((choice) => (
                                                <div
                                                  key={`${cardKey}-${choice.label}`}
                                                  style={{
                                                    background: choice.correct ? '#EEF8EA' : C.white,
                                                    border: `1px solid ${choice.correct ? C.green : C.border}`,
                                                    borderRadius: 7,
                                                    color: choice.correct ? C.green : C.dark,
                                                    fontSize: 14,
                                                    fontWeight: choice.correct ? 900 : 700,
                                                    lineHeight: 1.45,
                                                    padding: '8px 10px',
                                                    userSelect: 'text',
                                                  }}
                                                >
                                                  {choice.label}. {choice.text}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div>
                                            <div style={{ color: C.gray, fontSize: 12, fontWeight: 900 }}>Evidence points</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 7 }}>
                                              {card.evidencePoints.map((point, pointIndex) => (
                                                <span
                                                  key={`${cardKey}-evidence-${pointIndex}`}
                                                  style={{
                                                    ...pillStyle(C.blueLight, C.blue, C.blueMid),
                                                    height: 'auto',
                                                    lineHeight: 1.35,
                                                    maxWidth: '100%',
                                                    paddingBottom: 5,
                                                    paddingTop: 5,
                                                    userSelect: 'text',
                                                  }}
                                                >
                                                  {compact(point, 150)}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </article>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div> : null}

                      {showClaude ? <div style={{ marginTop: 24 }}>
                        <h3 style={{ fontSize: 20, margin: '0 0 10px' }}>Additional Classroom-Ready FAST Cards</h3>
                        <p style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>
                          Passage-specific cards that passed GOGI's quality audit.
                        </p>
                        {selectedClaudeReadyCards.length === 0 ? (
                          <div
                            style={{
                              background: C.amberLight,
                              border: `1px solid ${C.amber}`,
                              borderRadius: 8,
                              color: C.dark,
                              fontWeight: 800,
                              padding: 14,
                            }}
                          >
                            No additional classroom-ready cards yet for this text and standard.
                          </div>
                        ) : (
                          groupReadyCards(selectedClaudeReadyCards).map((group) => (
                            <div key={`claude-${group.key}`} style={{ marginBottom: 18 }}>
                              <div
                                style={{
                                  alignItems: 'center',
                                  display: 'flex',
                                  gap: 8,
                                  justifyContent: 'space-between',
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ color: C.dark, fontSize: 16, fontWeight: 900 }}>{group.title}</div>
                                <span style={pillStyle('#EEF8EA', C.green, C.green)}>
                                  {group.cards.length} ready
                                </span>
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {group.cards.map((card, cardIndex) => {
                                  const readyCardKey = `${group.key}-${card.id}-${card.location}-${cardIndex}`;
                                  return (
                                    <article
                                      key={readyCardKey}
                                      style={{
                                        border: `1px solid ${C.green}`,
                                        borderRadius: 8,
                                        padding: 12,
                                      }}
                                    >
                                      <div style={{ color: C.green, fontSize: 13, fontWeight: 900 }}>
                                        {card.location} · {card.wordCount} words · Ready to teach
                                      </div>
                                      <div style={{ fontSize: 15, fontWeight: 900, marginTop: 5 }}>
                                        {card.question}
                                      </div>
                                      <div
                                        style={{
                                          color: C.dark,
                                          fontFamily: FONTS.passage,
                                          fontSize: 15,
                                          lineHeight: 1.6,
                                          marginTop: 10,
                                          whiteSpace: 'pre-line',
                                          userSelect: 'text',
                                        }}
                                      >
                                        {card.excerpt}
                                      </div>
                                      <div
                                        style={{
                                          color: C.gray,
                                          fontSize: 12,
                                          fontStyle: 'italic',
                                          fontWeight: 800,
                                          marginTop: 6,
                                          textAlign: 'right',
                                          userSelect: 'text',
                                        }}
                                      >
                                        Source: {sourceAttribution(card.textTitle, card.textAuthor)}
                                      </div>
                                      <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
                                        <strong>Why:</strong> {card.whyThisWorks}
                                      </div>
                                      <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                                        <strong>Strategy:</strong> {card.skillStrategy}
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                                        {card.evidencePoints.map((point, index) => (
                                          <span
                                            key={`${readyCardKey}-evidence-${index}`}
                                            style={{
                                              ...pillStyle(C.blueLight, C.blue, C.blueMid),
                                              height: 'auto',
                                              lineHeight: 1.35,
                                              maxWidth: '100%',
                                              paddingBottom: 5,
                                              paddingTop: 5,
                                              userSelect: 'text',
                                            }}
                                          >
                                            {compact(point, 150)}
                                          </span>
                                        ))}
                                      </div>
                                      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                                        {card.choices.map((choice) => (
                                          <div
                                            key={`${readyCardKey}-${choice.label}`}
                                            style={{
                                              background: choice.correct ? '#EEF8EA' : C.white,
                                              border: `1px solid ${choice.correct ? C.green : C.border}`,
                                              borderRadius: 7,
                                              color: choice.correct ? C.green : C.dark,
                                              fontSize: 14,
                                              fontWeight: choice.correct ? 900 : 700,
                                              lineHeight: 1.45,
                                              padding: '8px 10px',
                                              userSelect: 'text',
                                            }}
                                          >
                                            {choice.label}. {choice.text}
                                          </div>
                                        ))}
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div> : null}

                      {showAuto ? <div style={{ marginTop: 24 }}>
                        <h3 style={{ fontSize: 20, margin: '0 0 10px' }}>Legacy Auto Cards</h3>
                        {selectedAutoReadyCards.length === 0 ? (
                          <div
                            style={{
                              background: C.amberLight,
                              border: `1px solid ${C.amber}`,
                              borderRadius: 8,
                              color: C.dark,
                              fontWeight: 800,
                              padding: 14,
                            }}
                          >
                            No legacy auto cards for this text. Use classroom-ready or reviewed cards instead.
                          </div>
                        ) : (
                          groupReadyCards(selectedAutoReadyCards).map((group) => (
                            <div key={group.key} style={{ marginBottom: 18 }}>
                              <div
                                style={{
                                  alignItems: 'center',
                                  display: 'flex',
                                  gap: 8,
                                  justifyContent: 'space-between',
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ color: C.dark, fontSize: 16, fontWeight: 900 }}>{group.title}</div>
                                <span style={pillStyle('#EEF8EA', C.green, C.green)}>
                                  {group.cards.length} legacy auto
                                </span>
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {group.cards.map((card, cardIndex) => {
                                  const autoCardKey = `${group.key}-${card.id}-${card.location}-${cardIndex}`;
                                  return (
                                  <article
                                    key={autoCardKey}
                                    style={{
                                      border: `1px solid ${C.green}`,
                                      borderRadius: 8,
                                      padding: 12,
                                    }}
                                  >
                                    <div style={{ color: C.green, fontSize: 13, fontWeight: 900 }}>
                                      {card.location} · {card.wordCount} words · auto-ready
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 900, marginTop: 5 }}>
                                      {card.question}
                                    </div>
                                    <div
                                      style={{
                                        color: C.dark,
                                        fontFamily: FONTS.passage,
                                        fontSize: 15,
                                        lineHeight: 1.6,
                                        marginTop: 10,
                                        userSelect: 'text',
                                      }}
                                    >
                                      {card.excerpt}
                                    </div>
                                    <div
                                      style={{
                                        color: C.gray,
                                        fontSize: 12,
                                        fontStyle: 'italic',
                                        fontWeight: 800,
                                        marginTop: 6,
                                        textAlign: 'right',
                                        userSelect: 'text',
                                      }}
                                    >
                                      Source: {sourceAttribution(selectedText.title, selectedText.author)}
                                    </div>
                                    <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
                                      <strong>Why:</strong> {card.whyThisWorks}
                                    </div>
                                    <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
                                      <strong>Strategy:</strong> {card.skillStrategy}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                                      {card.evidencePoints.map((point, index) => (
                                        <span
                                          key={`${autoCardKey}-evidence-${index}`}
                                          style={{
                                            ...pillStyle(C.blueLight, C.blue, C.blueMid),
                                            height: 'auto',
                                            lineHeight: 1.35,
                                            maxWidth: '100%',
                                            paddingBottom: 5,
                                            paddingTop: 5,
                                            userSelect: 'text',
                                          }}
                                        >
                                          {compact(point, 150)}
                                        </span>
                                      ))}
                                    </div>
                                    <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                                      {card.choices.map((choice) => (
                                        <div
                                          key={`${autoCardKey}-${choice.label}`}
                                          style={{
                                            background: choice.correct ? '#EEF8EA' : C.white,
                                            border: `1px solid ${choice.correct ? C.green : C.border}`,
                                            borderRadius: 7,
                                            color: choice.correct ? C.green : C.dark,
                                            fontSize: 14,
                                            fontWeight: choice.correct ? 900 : 700,
                                            lineHeight: 1.45,
                                            padding: '8px 10px',
                                            userSelect: 'text',
                                          }}
                                        >
                                          {choice.label}. {choice.text}
                                        </div>
                                      ))}
                                    </div>
                                  </article>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div> : null}

                      {showRaw ? <div style={{ marginTop: 24 }}>
                        <h3 style={{ fontSize: 20, margin: '0 0 10px' }}>Mined Source Pool</h3>
                        {selectedRawCandidates.length === 0 ? (
                          <div
                            style={{
                              background: C.redLight,
                              border: `1px solid ${C.red}`,
                              borderRadius: 8,
                              color: C.red,
                              fontWeight: 800,
                              padding: 14,
                            }}
                          >
                            No candidate excerpts have been mined for this text yet.
                          </div>
                        ) : (
                          groupCandidates(selectedRawCandidates).map((group) => (
                            <div key={group.key} style={{ marginBottom: 18 }}>
                              <div
                                style={{
                                  alignItems: 'center',
                                  display: 'flex',
                                  gap: 8,
                                  justifyContent: 'space-between',
                                  marginBottom: 8,
                                }}
                              >
                                <div style={{ color: C.dark, fontSize: 16, fontWeight: 900 }}>{group.title}</div>
                                <span style={pillStyle(C.amberLight, C.amber, C.amber)}>
                                  {group.candidates.length} candidates
                                </span>
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>
                                {group.candidates.map((candidate, index) => (
                                  <article
                                    key={`${group.key}-${candidate.location}-${index}`}
                                    style={{
                                      border: `1px solid ${C.border}`,
                                      borderRadius: 8,
                                      padding: 12,
                                    }}
                                  >
                                    <div style={{ color: C.blue, fontSize: 13, fontWeight: 900 }}>
                                      {candidate.location} · score {candidate.score}
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 900, marginTop: 5 }}>
                                      {candidate.suggestedQuestionStem}
                                    </div>
                                    <div
                                      style={{
                                        color: C.dark,
                                        fontFamily: FONTS.passage,
                                        fontSize: 15,
                                        lineHeight: 1.6,
                                        marginTop: 10,
                                        userSelect: 'text',
                                      }}
                                    >
                                      {candidate.excerpt}
                                    </div>
                                    <div
                                      style={{
                                        color: C.gray,
                                        fontSize: 12,
                                        fontStyle: 'italic',
                                        fontWeight: 800,
                                        marginTop: 6,
                                        textAlign: 'right',
                                        userSelect: 'text',
                                      }}
                                    >
                                      Source: {sourceAttribution(selectedText.title, selectedText.author)}
                                    </div>
                                    <div style={{ color: C.gray, fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
                                      <strong>Why:</strong> {candidate.justification}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                                      {candidate.evidenceSignals.map((signal, signalIndex) => (
                                        <span key={`${group.key}-${index}-${signalIndex}-${signal}`} style={pillStyle(C.blueLight, C.blue, C.blueMid)}>
                                          {signal}
                                        </span>
                                      ))}
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div> : null}
                    </>
                  ) : (
                    <div style={{ color: C.gray, fontWeight: 800 }}>No text selected.</div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
