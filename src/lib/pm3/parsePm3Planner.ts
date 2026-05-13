import { inflateRawSync } from 'zlib';

export type Pm3BenchmarkSummary = {
  benchmark8: string;
  standard9: string;
  title: string;
  category: string;
  earned: number;
  possible: number;
  accuracy: number;
  misses: number;
  studentsSeen: number;
  priorityScore: number;
  lessonHref: string;
};

export type Pm3CategorySummary = {
  category: string;
  earned: number;
  possible: number;
  accuracy: number;
  belowCount: number;
  atNearCount: number;
  aboveCount: number;
};

export type Pm3StudentSummary = {
  name: string;
  studentId: string;
  sex: string;
  scaleScore: number | null;
  achievementLevel: string;
  percentile: number | null;
  riskBand: 'urgent' | 'watch' | 'on-track' | 'extension';
  categoryPerformance: Record<string, string>;
  weakStandards: Array<{
    standard9: string;
    title: string;
    benchmark8: string;
    missed: number;
    possible: number;
    accuracy: number;
  }>;
};

export type Pm3PeriodPlan = {
  periodLabel: string;
  fileName: string;
  studentCount: number;
  averageScaleScore: number | null;
  levelCounts: Record<string, number>;
  categorySummaries: Pm3CategorySummary[];
  benchmarkSummaries: Pm3BenchmarkSummary[];
  lessonQueue: Pm3BenchmarkSummary[];
  studentGroups: {
    urgent: Pm3StudentSummary[];
    watch: Pm3StudentSummary[];
    onTrack: Pm3StudentSummary[];
    extension: Pm3StudentSummary[];
  };
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const STANDARD_TITLES: Record<string, string> = {
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

const HIGH_YIELD_STANDARDS = new Set([
  'ELA.9.R.1.1',
  'ELA.9.R.1.2',
  'ELA.9.R.2.1',
  'ELA.9.R.2.2',
  'ELA.9.R.3.1',
  'ELA.9.R.3.3',
  'ELA.9.R.3.4',
  'ELA.9.V.1.2',
  'ELA.9.V.1.3',
]);

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function colIndex(cellRef: string) {
  const letters = cellRef.match(/[A-Z]+/)?.[0] ?? 'A';
  let index = 0;
  for (const char of letters) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function parseZip(buffer: Buffer) {
  const entries = new Map<string, ZipEntry>();
  const minOffset = Math.max(0, buffer.length - 66000);
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Could not read the Excel file structure.');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.toString('utf8', centralOffset + 46, centralOffset + 46 + fileNameLength);
    entries.set(name, { name, compressionMethod, compressedSize, localHeaderOffset });
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipText(buffer: Buffer, entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name);
  if (!entry) return null;
  const local = entry.localHeaderOffset;
  if (buffer.readUInt32LE(local) !== 0x04034b50) return null;
  const fileNameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const dataStart = local + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed.toString('utf8');
  if (entry.compressionMethod === 8) return inflateRawSync(compressed).toString('utf8');
  throw new Error('This Excel file uses a compression format GOGI cannot read yet.');
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return [];
  const strings: string[] = [];
  const itemMatches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g);
  for (const match of itemMatches) {
    const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) =>
      decodeXml(part[1])
    );
    strings.push(textParts.join(''));
  }
  return strings;
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowMatches = xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g);
  for (const rowMatch of rowMatches) {
    const row: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);
    for (const cellMatch of cellMatches) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? 'A1';
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? '';
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      const inlineValue = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
      let value = '';
      if (type === 's') value = sharedStrings[Number(rawValue)] ?? '';
      else if (type === 'inlineStr') value = decodeXml(inlineValue);
      else value = decodeXml(rawValue);
      row[colIndex(ref)] = value;
    }
    rows.push(row);
  }
  return rows;
}

function firstWorksheetPath(buffer: Buffer, entries: Map<string, ZipEntry>) {
  const workbookXml = readZipText(buffer, entries, 'xl/workbook.xml');
  const relsXml = readZipText(buffer, entries, 'xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) return 'xl/worksheets/sheet1.xml';
  const firstSheetRelId = workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  if (!firstSheetRelId) return 'xl/worksheets/sheet1.xml';
  const relMatch = [...relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)].find((match) =>
    match[1].includes(`Id="${firstSheetRelId}"`)
  );
  const target = relMatch?.[1].match(/Target="([^"]+)"/)?.[1];
  if (!target) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\.\//, '')}`;
}

function parseXlsxRows(buffer: Buffer) {
  const entries = parseZip(buffer);
  const sharedStrings = parseSharedStrings(readZipText(buffer, entries, 'xl/sharedStrings.xml'));
  const sheetPath = firstWorksheetPath(buffer, entries);
  const sheetXml = readZipText(buffer, entries, sheetPath);
  if (!sheetXml) throw new Error('Could not find the student data sheet in this Excel file.');
  return parseSheetRows(sheetXml, sharedStrings);
}

function toNumber(value: string | undefined) {
  if (!value || value === 'N/A') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function grade8ToGrade9Benchmark(benchmark: string) {
  const code = benchmark.includes('|') ? benchmark.split('|')[1] : benchmark;
  return code.replace('ELA.8.', 'ELA.9.');
}

function riskBand(level: string, percentile: number | null): Pm3StudentSummary['riskBand'] {
  if (/level\s*1/i.test(level)) return 'urgent';
  if (/level\s*2/i.test(level)) return 'watch';
  if (percentile !== null && percentile >= 75) return 'extension';
  return 'on-track';
}

function percent(earned: number, possible: number) {
  return possible > 0 ? earned / possible : 0;
}

function inferPeriodLabel(fileName: string, fallback: string) {
  const match = fileName.match(/period\s*([0-9]+)/i);
  return match ? `Period ${match[1]}` : fallback;
}

export function parsePm3Workbook(buffer: Buffer, fileName: string, periodLabel?: string): Pm3PeriodPlan {
  const rows = parseXlsxRows(buffer).filter((row) => row.some(Boolean));
  if (rows.length < 2) throw new Error('This PM3 file does not appear to have student rows.');

  const headers = rows[0];
  const headerIndex = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header) headerIndex.set(header, index);
  });

  const studentRows = rows.slice(1).filter((row) => row[0]);
  const getIndex = (header: string) => headerIndex.get(header) ?? -1;
  const getValue = (row: string[], header: string) => {
    const index = getIndex(header);
    return index >= 0 ? row[index] ?? '' : '';
  };

  let students: Pm3StudentSummary[] = studentRows.map((row) => {
    const scaleScore = toNumber(getValue(row, 'Grade 8 FAST ELA Reading Scale Score'));
    const percentile = toNumber(getValue(row, 'Grade 8 FAST ELA Reading Percentile Rank'));
    const achievementLevel = getValue(row, 'Grade 8 FAST ELA Reading Achievement Level') || 'Unknown';
    return {
      name: getValue(row, 'Student Name') || 'Student',
      studentId: getValue(row, 'Student ID') || '',
      sex: getValue(row, 'Sex') || '',
      scaleScore,
      achievementLevel,
      percentile,
      riskBand: riskBand(achievementLevel, percentile),
      categoryPerformance: {},
      weakStandards: [],
    };
  });

  const levelCounts = students.reduce<Record<string, number>>((acc, student) => {
    acc[student.achievementLevel] = (acc[student.achievementLevel] ?? 0) + 1;
    return acc;
  }, {});
  const scores = students.map((student) => student.scaleScore).filter((score): score is number => score !== null);

  const categoryPerformanceHeaders = [
    '1. Reading Prose and Poetry Performance',
    '2. Reading Informational Text Performance',
    '3. Reading Across Genres & Vocabulary Performance',
  ];

  const categoryCounts = new Map<string, { belowCount: number; atNearCount: number; aboveCount: number }>();
  for (const [studentIndex, row] of studentRows.entries()) {
    for (const header of categoryPerformanceHeaders) {
      const category = header.replace(' Performance', '');
      const value = getValue(row, header);
      students[studentIndex].categoryPerformance[category] = value;
      const counts = categoryCounts.get(category) ?? { belowCount: 0, atNearCount: 0, aboveCount: 0 };
      if (/below/i.test(value)) counts.belowCount += 1;
      else if (/above/i.test(value)) counts.aboveCount += 1;
      else if (value) counts.atNearCount += 1;
      categoryCounts.set(category, counts);
    }
  }

  const categoryCols = headers
    .map((header, index) => ({ header, index }))
    .filter((item) => item.header === 'Category')
    .map((item) => item.index);

  const benchmarkMap = new Map<
    string,
    { category: string; earned: number; possible: number; misses: number; students: Set<number> }
  >();
  const categoryMap = new Map<string, { earned: number; possible: number }>();
  const studentBenchmarkMaps = studentRows.map(
    () => new Map<string, { benchmark8: string; standard9: string; title: string; earned: number; possible: number }>()
  );

  studentRows.forEach((row, studentIndex) => {
    for (const col of categoryCols) {
      const category = row[col];
      const benchmark = row[col + 1];
      const earned = toNumber(row[col + 2]);
      const possible = toNumber(row[col + 3]);
      if (!category || !benchmark || benchmark === 'N/A' || earned === null || possible === null || possible <= 0) {
        continue;
      }
      const current = benchmarkMap.get(benchmark) ?? {
        category,
        earned: 0,
        possible: 0,
        misses: 0,
        students: new Set<number>(),
      };
      current.earned += earned;
      current.possible += possible;
      current.students.add(studentIndex);
      if (earned < possible) current.misses += 1;
      benchmarkMap.set(benchmark, current);

      const standard9 = grade8ToGrade9Benchmark(benchmark);
      const studentBenchmark = studentBenchmarkMaps[studentIndex].get(standard9) ?? {
        benchmark8: benchmark,
        standard9,
        title: STANDARD_TITLES[standard9] ?? 'Official benchmark',
        earned: 0,
        possible: 0,
      };
      studentBenchmark.earned += earned;
      studentBenchmark.possible += possible;
      studentBenchmarkMaps[studentIndex].set(standard9, studentBenchmark);

      const categoryCurrent = categoryMap.get(category) ?? { earned: 0, possible: 0 };
      categoryCurrent.earned += earned;
      categoryCurrent.possible += possible;
      categoryMap.set(category, categoryCurrent);
    }
  });

  students = students.map((student, index) => {
    const weakStandards = [...studentBenchmarkMaps[index].values()]
      .map((item) => ({
        standard9: item.standard9,
        title: item.title,
        benchmark8: item.benchmark8,
        missed: Math.max(0, item.possible - item.earned),
        possible: item.possible,
        accuracy: percent(item.earned, item.possible),
      }))
      .filter((item) => item.missed > 0)
      .sort((a, b) => b.missed - a.missed || a.accuracy - b.accuracy)
      .slice(0, 6);
    return { ...student, weakStandards };
  });

  const categorySummaries = [...categoryMap.entries()].map(([category, values]) => {
    const counts = categoryCounts.get(category) ?? { belowCount: 0, atNearCount: 0, aboveCount: 0 };
    return {
      category,
      earned: values.earned,
      possible: values.possible,
      accuracy: percent(values.earned, values.possible),
      ...counts,
    };
  });

  const benchmarkSummaries = [...benchmarkMap.entries()]
    .map(([benchmark8, values]) => {
      const standard9 = grade8ToGrade9Benchmark(benchmark8);
      const accuracy = percent(values.earned, values.possible);
      const highYieldBoost = HIGH_YIELD_STANDARDS.has(standard9) ? 0.08 : 0;
      const missLoad = values.misses / Math.max(1, studentRows.length);
      return {
        benchmark8,
        standard9,
        title: STANDARD_TITLES[standard9] ?? 'Official benchmark',
        category: values.category,
        earned: values.earned,
        possible: values.possible,
        accuracy,
        misses: values.misses,
        studentsSeen: values.students.size,
        priorityScore: 1 - accuracy + missLoad + highYieldBoost,
        lessonHref: `/teacher-dashboard/teaching-readiness?standard=${encodeURIComponent(standard9)}`,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const groups = {
    urgent: students.filter((student) => student.riskBand === 'urgent'),
    watch: students.filter((student) => student.riskBand === 'watch'),
    onTrack: students.filter((student) => student.riskBand === 'on-track'),
    extension: students.filter((student) => student.riskBand === 'extension'),
  };

  return {
    periodLabel: periodLabel?.trim() || inferPeriodLabel(fileName, fileName.replace(/\.[^.]+$/, '')),
    fileName,
    studentCount: students.length,
    averageScaleScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 : null,
    levelCounts,
    categorySummaries,
    benchmarkSummaries,
    lessonQueue: benchmarkSummaries.slice(0, 6),
    studentGroups: groups,
  };
}
