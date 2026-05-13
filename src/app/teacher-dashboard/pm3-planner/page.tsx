'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Loader2, Printer, Shuffle, Trash2, Upload } from 'lucide-react';
import { TeacherDashboardTopBar } from '@/components/teacher/TeacherDashboardTopBar';
import { C, FONTS } from '@/lib/constants/design';
import {
  blockForPeriod,
  formatSchoolDate,
  MDCPS_2026_2027_CALENDAR,
  monthLabel,
  nextInstructionalDate,
  nextMeetingsForPeriod,
  periodNumberFromLabel,
  remainingMeetingsInGradingPeriod,
  schoolDayInfo,
  schoolYearProgress,
  upcomingMeetingsForPeriod,
  weekOfLabel,
} from '@/lib/school/mdcpsCalendar';

type BenchmarkSummary = {
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

type CategorySummary = {
  category: string;
  earned: number;
  possible: number;
  accuracy: number;
  belowCount: number;
  atNearCount: number;
  aboveCount: number;
};

type StudentSummary = {
  name: string;
  studentId: string;
  sex?: string;
  scaleScore: number | null;
  achievementLevel: string;
  percentile: number | null;
  riskBand: 'urgent' | 'watch' | 'on-track' | 'extension';
  categoryPerformance?: Record<string, string>;
  weakStandards?: Array<{
    standard9: string;
    title: string;
    benchmark8: string;
    missed: number;
    possible: number;
    accuracy: number;
  }>;
};

type PeriodPlan = {
  periodLabel: string;
  fileName: string;
  studentCount: number;
  averageScaleScore: number | null;
  levelCounts: Record<string, number>;
  categorySummaries: CategorySummary[];
  benchmarkSummaries: BenchmarkSummary[];
  lessonQueue: BenchmarkSummary[];
  studentGroups: {
    urgent: StudentSummary[];
    watch: StudentSummary[];
    onTrack: StudentSummary[];
    extension: StudentSummary[];
  };
};

type PlannerDashboard = {
  periodCount: number;
  studentCount: number;
  periods: PeriodPlan[];
  updatedAt?: string;
};

type LessonLogEntry = {
  id: string;
  taughtAt: string;
  periodLabel: string;
  standard9: string;
  title: string;
  subskill: string;
  lessonType: 'whole_group' | 'small_group' | 'review' | 'fast_sprint';
};

type WorkspaceTab = 'daily' | 'pacing' | 'analytics' | 'history' | 'groups' | 'bubble' | 'seating';

type SeatingTable = {
  id: number;
  zone: 'Door side' | 'Middle' | 'Teacher side';
  seats: StudentSummary[];
  supportTotal: number;
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function scoreColor(value: number) {
  if (value < 0.4) return C.red;
  if (value < 0.55) return '#B45309';
  return C.green;
}

function levelLabel(levelCounts: Record<string, number>) {
  return Object.entries(levelCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([level, count]) => `${count} ${level}`)
    .join(' · ');
}

const PERIOD_OPTIONS = Array.from({ length: 8 }, (_, index) => `Period ${index + 1}`);
const PERIOD_SELECTOR_OPTIONS = ['All Periods', ...PERIOD_OPTIONS];

const STANDARD_SUBSKILLS: Record<string, string[]> = {
  'ELA.9.R.1.1': ['setting adds meaning', 'plot/conflict adds meaning', 'characterization', 'point of view', 'theme/tone', 'style technique'],
  'ELA.9.R.1.2': ['identify theme', 'track development', 'use evidence across the text', 'avoid summary-only answers'],
  'ELA.9.R.1.3': ['narrator perspective', 'reader knowledge gap', 'irony', 'satire'],
  'ELA.9.R.1.4': ['epic hero traits', 'in medias res', 'epic structure', 'theme in epic poetry'],
  'ELA.9.R.2.1': ['chronology', 'cause/effect', 'compare/contrast', 'problem/solution', 'text features'],
  'ELA.9.R.2.2': ['central idea', 'supporting evidence', 'development across paragraphs', 'best evidence'],
  'ELA.9.R.2.3': ['ethos', 'pathos', 'logos', 'purpose', 'figurative language in argument'],
  'ELA.9.R.2.4': ['opposing claims', 'evidence comparison', 'validity', 'effectiveness', 'counterclaim'],
  'ELA.9.R.3.1': ['figurative language', 'mood creation', 'mood shift', 'meaning/effect'],
  'ELA.9.R.3.3': ['source text', 'adaptation choice', 'similarities/differences', 'author effect'],
  'ELA.9.R.3.4': ['rhetorical device', 'appeal', 'reader effect', 'purpose'],
  'ELA.9.V.1.2': ['root/prefix/suffix', 'word parts in context', 'derivation'],
  'ELA.9.V.1.3': ['context clues', 'connotation', 'denotation', 'word relationships'],
};

function categoryFamily(standard: string) {
  if (standard.includes('.R.1.')) return 'Reading Prose and Poetry';
  if (standard.includes('.R.2.')) return 'Reading Informational Text';
  if (standard.includes('.R.3.') || standard.includes('.V.')) return 'Across Genres & Vocabulary';
  return 'Other';
}

function planningReason(lesson: BenchmarkSummary) {
  return `${lesson.misses} missed item opportunities and ${pct(lesson.accuracy)} correct on the Grade 8 benchmark. This is a strong whole-group candidate because many students need the same skill rep.`;
}

function standardLogCount(logs: LessonLogEntry[], periodLabel: string, standard: string) {
  return logs.filter((entry) => entry.periodLabel === periodLabel && entry.standard9 === standard).length;
}

function familyLogCount(logs: LessonLogEntry[], periodLabel: string, standard: string) {
  const family = categoryFamily(standard);
  return logs.filter((entry) => entry.periodLabel === periodLabel && categoryFamily(entry.standard9) === family).length;
}

function dailyLessonScore(lesson: BenchmarkSummary, logs: LessonLogEntry[], periodLabel: string) {
  const taughtStandardCount = standardLogCount(logs, periodLabel, lesson.standard9);
  const taughtFamilyCount = familyLogCount(logs, periodLabel, lesson.standard9);
  const repeatPenalty = taughtStandardCount === 0 ? 0 : taughtStandardCount === 1 ? 0.55 : 0.9;
  const familyBalancePenalty = taughtFamilyCount >= 4 ? 0.15 : 0;
  const urgentBonus = lesson.accuracy < 0.45 ? 0.18 : lesson.accuracy < 0.55 ? 0.1 : 0;
  return lesson.priorityScore + urgentBonus - repeatPenalty - familyBalancePenalty;
}

function chooseDailyLesson(period: PeriodPlan | null, logs: LessonLogEntry[]) {
  if (!period?.lessonQueue.length) return null;
  return [...period.lessonQueue].sort(
    (a, b) =>
      dailyLessonScore(b, logs, period.periodLabel) - dailyLessonScore(a, logs, period.periodLabel)
  )[0];
}

function buildPacingGuide(period: PeriodPlan | null, logs: LessonLogEntry[], meetingCount = 18) {
  if (!period?.lessonQueue.length) return [];
  const upcoming = upcomingMeetingsForPeriod(period.periodLabel, meetingCount);
  const plannedLogs = [...logs];

  return upcoming.map((meeting, index) => {
    const lesson = chooseDailyLesson(period, plannedLogs) ?? period.lessonQueue[index % period.lessonQueue.length];
    plannedLogs.push({
      id: `preview-${meeting.date}-${lesson.standard9}`,
      taughtAt: `${meeting.date}T12:00:00`,
      periodLabel: period.periodLabel,
      standard9: lesson.standard9,
      title: lesson.title,
      subskill: defaultSubskill(lesson.standard9),
      lessonType: index % 5 === 4 ? 'fast_sprint' : 'whole_group',
    });
    return {
      meeting,
      lesson,
      subskill: defaultSubskill(lesson.standard9),
      lessonType: index % 5 === 4 ? 'FAST check / spiral review' : 'Whole-group pull-out lesson',
      week: weekOfLabel(meeting.date),
      month: monthLabel(meeting.date),
    };
  });
}

function dailyRecommendationReason(lesson: BenchmarkSummary, logs: LessonLogEntry[], periodLabel: string) {
  const taughtCount = standardLogCount(logs, periodLabel, lesson.standard9);
  if (taughtCount === 0) {
    return `${planningReason(lesson)} GOGI is prioritizing it because it has not been logged for this period yet.`;
  }
  return `${planningReason(lesson)} GOGI is keeping it in view, but it has already been taught ${taughtCount} time${taughtCount === 1 ? '' : 's'}, so new unlogged gaps may rotate ahead.`;
}

function defaultSubskill(standard: string) {
  return STANDARD_SUBSKILLS[standard]?.[0] ?? 'Core skill';
}

function lessonLaunchHref(lesson: BenchmarkSummary, periodLabel: string) {
  const params = new URLSearchParams({
    standard_code: lesson.standard9,
    period: periodLabel,
    title: lesson.title,
    accuracy: String(lesson.accuracy),
    misses: String(lesson.misses),
  });
  return `/teacher-dashboard/lesson-launch?${params.toString()}`;
}

function buildSmallGroups(period: PeriodPlan | null) {
  if (!period) return [];
  const allStudents = [
    ...period.studentGroups.urgent,
    ...period.studentGroups.watch,
    ...period.studentGroups.onTrack,
    ...period.studentGroups.extension,
  ];
  const uniqueStudents = new Map<string, StudentSummary>();
  for (const student of allStudents) {
    uniqueStudents.set(student.studentId || student.name, student);
  }

  const candidates = [...uniqueStudents.values()]
    .map((student) => {
      const weakness = [...(student.weakStandards ?? [])]
        .filter((item) => item.missed > 0)
        .sort((a, b) => b.missed - a.missed || a.accuracy - b.accuracy)[0];
      if (!weakness) return null;
      return {
        student,
        weakness,
        severity: weakness.missed + (student.riskBand === 'urgent' ? 3 : student.riskBand === 'watch' ? 2 : 0),
      };
    })
    .filter(Boolean) as Array<{
    student: StudentSummary;
    weakness: NonNullable<StudentSummary['weakStandards']>[number];
    severity: number;
  }>;

  const demandByStandard = candidates.reduce<Record<string, { count: number; misses: number }>>(
    (map, candidate) => {
      const current = map[candidate.weakness.standard9] ?? { count: 0, misses: 0 };
      current.count += 1;
      current.misses += candidate.weakness.missed;
      map[candidate.weakness.standard9] = current;
      return map;
    },
    {}
  );

  type DailyTableGroup = {
    id: string;
    standard9: string;
    title: string;
    students: StudentSummary[];
    studentWeaknesses: Record<string, { missed: number; possible: number; standard9: string; title: string }>;
    totalMisses: number;
    sourcePoolSize: number;
  };

  const groups: DailyTableGroup[] = [];
  const sortedCandidates = candidates.sort((a, b) => {
    const aDemand = demandByStandard[a.weakness.standard9]?.misses ?? 0;
    const bDemand = demandByStandard[b.weakness.standard9]?.misses ?? 0;
    return bDemand - aDemand || b.severity - a.severity || a.student.name.localeCompare(b.student.name);
  });

  function addStudentToGroup(group: DailyTableGroup, candidate: (typeof sortedCandidates)[number]) {
    const key = candidate.student.studentId || candidate.student.name;
    group.students.push(candidate.student);
    group.studentWeaknesses[key] = {
      missed: candidate.weakness.missed,
      possible: candidate.weakness.possible,
      standard9: candidate.weakness.standard9,
      title: candidate.weakness.title,
    };
    group.totalMisses += candidate.weakness.missed;
  }

  for (const candidate of sortedCandidates) {
    const sameTarget = groups
      .filter((group) => group.standard9 === candidate.weakness.standard9 && group.students.length < 4)
      .sort((a, b) => b.students.length - a.students.length)[0];

    if (sameTarget) {
      addStudentToGroup(sameTarget, candidate);
      continue;
    }

    if (groups.length < 9) {
      const group: DailyTableGroup = {
        id: `${candidate.weakness.standard9}-${groups.length + 1}`,
        standard9: candidate.weakness.standard9,
        title: candidate.weakness.title,
        students: [],
        studentWeaknesses: {},
        totalMisses: 0,
        sourcePoolSize: demandByStandard[candidate.weakness.standard9]?.count ?? 1,
      };
      addStudentToGroup(group, candidate);
      groups.push(group);
      continue;
    }

    const bestAvailable = groups
      .filter((group) => group.students.length < 4)
      .sort((a, b) => {
        const aSameFamily = categoryFamily(a.standard9) === categoryFamily(candidate.weakness.standard9) ? 1 : 0;
        const bSameFamily = categoryFamily(b.standard9) === categoryFamily(candidate.weakness.standard9) ? 1 : 0;
        return bSameFamily - aSameFamily || a.students.length - b.students.length;
      })[0];
    if (bestAvailable) addStudentToGroup(bestAvailable, candidate);
  }

  for (const smallGroup of [...groups].filter((group) => group.students.length > 0 && group.students.length < 3)) {
    for (const student of [...smallGroup.students]) {
      const studentKey = student.studentId || student.name;
      const destination = groups
        .filter((group) => group !== smallGroup && group.students.length < 4)
        .sort((a, b) => {
          const aSameTarget = a.standard9 === smallGroup.studentWeaknesses[studentKey]?.standard9 ? 1 : 0;
          const bSameTarget = b.standard9 === smallGroup.studentWeaknesses[studentKey]?.standard9 ? 1 : 0;
          return bSameTarget - aSameTarget || a.students.length - b.students.length;
        })[0];
      if (!destination) continue;
      destination.students.push(student);
      destination.studentWeaknesses[studentKey] = smallGroup.studentWeaknesses[studentKey];
      destination.totalMisses += smallGroup.studentWeaknesses[studentKey]?.missed ?? 0;
      smallGroup.students = smallGroup.students.filter((row) => (row.studentId || row.name) !== studentKey);
      delete smallGroup.studentWeaknesses[studentKey];
    }
  }

  return groups
    .filter((group) => group.students.length >= 3)
    .sort((a, b) => b.totalMisses - a.totalMisses || b.students.length - a.students.length)
    .slice(0, 9)
    .map((group, index) => ({ ...group, tableSlot: index + 1 }));
}

function strongestCategory(student: StudentSummary) {
  const entries = Object.entries(student.categoryPerformance ?? {});
  return entries.find(([, value]) => /above/i.test(value))?.[0]?.replace(/^[0-9]\.\s*/, '') ??
    entries.find(([, value]) => /at\/near/i.test(value))?.[0]?.replace(/^[0-9]\.\s*/, '') ??
    'Not clear yet';
}

function weakestCategory(student: StudentSummary) {
  return (
    Object.entries(student.categoryPerformance ?? {})
      .find(([, value]) => /below/i.test(value))?.[0]
      ?.replace(/^[0-9]\.\s*/, '') ?? student.weakStandards?.[0]?.title ?? 'Not clear yet'
  );
}

function bubbleReason(student: StudentSummary, bucket: string) {
  const topLever = student.weakStandards?.[0];
  const leverText = topLever ? `${topLever.standard9} (${topLever.title})` : 'the highest-miss standard';
  if (bucket === 'Bubble to Level 3') {
    return `Close enough to target with focused reps. Best lever: ${leverText}.`;
  }
  if (bucket === 'Protect Level 3') {
    return `Currently Level 3, but needs maintenance reps so the score does not slide. Best lever: ${leverText}.`;
  }
  if (bucket === 'Push to Level 4') {
    return `Strong enough for advanced reps. Use the weakest remaining standard to push growth: ${leverText}.`;
  }
  return `Urgent support needed before bubble growth is realistic. Start with ${leverText}.`;
}

function buildBubbleGroups(period: PeriodPlan | null) {
  if (!period) return [];
  const allStudents = [
    ...period.studentGroups.urgent,
    ...period.studentGroups.watch,
    ...period.studentGroups.onTrack,
    ...period.studentGroups.extension,
  ];
  const groups = [
    {
      label: 'Bubble to Level 3',
      description: 'Level 2 students closest to proficiency. These are fast-move candidates.',
      students: allStudents.filter((student) => /level\s*2/i.test(student.achievementLevel) || student.riskBand === 'watch'),
      color: '#B45309',
    },
    {
      label: 'Protect Level 3',
      description: 'Level 3 students who still need steady reps to stay proficient.',
      students: allStudents.filter(
        (student) =>
          /level\s*3/i.test(student.achievementLevel) &&
          (student.percentile === null || student.percentile < 65) &&
          student.riskBand !== 'extension'
      ),
      color: C.blue,
    },
    {
      label: 'Push to Level 4',
      description: 'Higher-performing students who can move up with harder, cleaner reps.',
      students: allStudents.filter(
        (student) =>
          /level\s*3/i.test(student.achievementLevel) &&
          student.percentile !== null &&
          student.percentile >= 65
      ),
      color: C.green,
    },
    {
      label: 'Urgent Level 1',
      description: 'Students needing foundational intervention before move-up work.',
      students: allStudents.filter((student) => /level\s*1/i.test(student.achievementLevel) || student.riskBand === 'urgent'),
      color: C.red,
    },
  ];
  return groups.map((group) => ({
    ...group,
    students: group.students
      .sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1))
      .slice(0, 12),
  }));
}

const TABLE_ZONES: SeatingTable['zone'][] = [
  'Door side',
  'Door side',
  'Door side',
  'Middle',
  'Middle',
  'Middle',
  'Teacher side',
  'Teacher side',
  'Teacher side',
];
const TABLE_FILL_GROUPS = [
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
];

function normalizeSex(sex?: string) {
  if (/^m/i.test(sex ?? '')) return 'M';
  if (/^f/i.test(sex ?? '')) return 'F';
  return 'Not listed';
}

function studentSupportScore(student: StudentSummary) {
  let score = 0;
  if (student.riskBand === 'urgent') score += 100;
  else if (student.riskBand === 'watch') score += 72;
  else if (student.riskBand === 'on-track') score += 28;
  else score += 8;

  if (/level\s*1/i.test(student.achievementLevel)) score += 25;
  if (/level\s*2/i.test(student.achievementLevel)) score += 12;
  if (student.percentile !== null && student.percentile < 25) score += 12;
  score += (student.weakStandards?.length ?? 0) * 3;
  return score;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function allStudentsForPeriod(period: PeriodPlan) {
  const students = new Map<string, StudentSummary>();
  for (const student of [
    ...period.studentGroups.urgent,
    ...period.studentGroups.watch,
    ...period.studentGroups.onTrack,
    ...period.studentGroups.extension,
  ]) {
    students.set(student.studentId || student.name, student);
  }
  return [...students.values()];
}

function teacherDistance(table: SeatingTable) {
  if (table.zone === 'Teacher side') return 0;
  if (table.zone === 'Middle') return 1;
  return 2;
}

function buildSeatingChart(period: PeriodPlan | null, seed: number) {
  const tables: SeatingTable[] = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    zone: TABLE_ZONES[index],
    seats: [],
    supportTotal: 0,
  }));
  if (!period) return { tables, overflow: [] as StudentSummary[], missingSexCount: 0 };

  const students = allStudentsForPeriod(period).sort((a, b) => {
    const supportDiff = studentSupportScore(b) - studentSupportScore(a);
    if (supportDiff !== 0) return supportDiff;
    return stableHash(`${a.studentId || a.name}-${seed}`) - stableHash(`${b.studentId || b.name}-${seed}`);
  });

  const overflow: StudentSummary[] = [];
  for (const student of students) {
    const sex = normalizeSex(student.sex);
    const support = studentSupportScore(student);
    const candidatePool =
      TABLE_FILL_GROUPS
        .map((group) => tables.filter((table) => group.includes(table.id) && table.seats.length < 4))
        .find((groupTables) => groupTables.length > 0) ?? [];
    const candidates = candidatePool.length ? candidatePool : tables.filter((table) => table.seats.length < 4);
    if (!candidates.length) {
      overflow.push(student);
      continue;
    }

    const bestTable = candidates
      .map((table) => {
        const sameSex = table.seats.filter((seat) => normalizeSex(seat.sex) === sex).length;
        const urgentCount = table.seats.filter((seat) => seat.riskBand === 'urgent' || seat.riskBand === 'watch').length;
        const proximityPenalty = support >= 85 ? teacherDistance(table) * 14 : support >= 55 ? teacherDistance(table) * 6 : (2 - teacherDistance(table)) * 2;
        const genderPenalty = sex === 'Not listed' ? sameSex : sameSex * 5 + (sameSex >= 2 ? 14 : 0);
        const supportBalancePenalty = table.supportTotal / 28;
        const urgentPenalty = urgentCount * 7;
        const loadPenalty = table.seats.length * 3;
        const shuffleNudge = stableHash(`${student.studentId || student.name}-${table.id}-${seed}`) / 1000000000;
        return {
          table,
          score: proximityPenalty + genderPenalty + supportBalancePenalty + urgentPenalty + loadPenalty + shuffleNudge,
        };
      })
      .sort((a, b) => a.score - b.score)[0].table;

    bestTable.seats.push(student);
    bestTable.supportTotal += support;
  }

  const singletonTables = tables.filter((table) => table.seats.length === 1);
  for (const singleton of singletonTables) {
    const student = singleton.seats[0];
    const destination = [...tables]
      .filter((table) => table.id !== singleton.id && table.seats.length > 1 && table.seats.length < 4)
      .sort((a, b) => {
        const distanceDiff = teacherDistance(a) - teacherDistance(b);
        if (distanceDiff !== 0) return distanceDiff;
        return a.seats.length - b.seats.length;
      })[0];
    if (!student) continue;
    if (destination) {
      singleton.seats = [];
      singleton.supportTotal = 0;
      destination.seats.push(student);
      destination.supportTotal += studentSupportScore(student);
      continue;
    }

    const donor = [...tables]
      .filter((table) => table.id !== singleton.id && table.seats.length > 2)
      .sort((a, b) => {
        const distanceDiff = teacherDistance(b) - teacherDistance(a);
        if (distanceDiff !== 0) return distanceDiff;
        return b.seats.length - a.seats.length;
      })[0];
    if (!donor) continue;
    const donorStudentIndex = donor.seats
      .map((seat, index) => ({ index, score: studentSupportScore(seat) }))
      .sort((a, b) => a.score - b.score)[0]?.index;
    if (donorStudentIndex === undefined) continue;
    const [movedStudent] = donor.seats.splice(donorStudentIndex, 1);
    donor.supportTotal -= studentSupportScore(movedStudent);
    singleton.seats.push(movedStudent);
    singleton.supportTotal += studentSupportScore(movedStudent);
  }

  return {
    tables,
    overflow,
    missingSexCount: students.filter((student) => normalizeSex(student.sex) === 'Not listed').length,
  };
}

function tableStats(table: SeatingTable) {
  const male = table.seats.filter((student) => normalizeSex(student.sex) === 'M').length;
  const female = table.seats.filter((student) => normalizeSex(student.sex) === 'F').length;
  const highSupport = table.seats.filter((student) => student.riskBand === 'urgent' || student.riskBand === 'watch').length;
  return { male, female, highSupport };
}

function studentStrengthLabel(student: StudentSummary) {
  const strength = strongestCategory(student);
  if (/prose|poetry/i.test(strength)) return 'Literary analysis strength';
  if (/informational/i.test(strength)) return 'Informational text strength';
  if (/genres|vocabulary/i.test(strength)) return 'Vocabulary / cross-genre strength';
  if (student.riskBand === 'extension') return 'Challenge-ready reader';
  if (student.riskBand === 'on-track') return 'Steady table contributor';
  if (student.riskBand === 'watch') return 'Focused growth partner';
  return 'Ready-to-grow reader';
}

function fileKey(file: File, index: number) {
  return `${file.name}-${file.lastModified}-${file.size}-${index}`;
}

function inferPeriodFromFileName(fileName: string) {
  const match = fileName.match(/period\s*([1-8])/i);
  return match ? `Period ${match[1]}` : '';
}

export default function Pm3PlannerPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [filePeriods, setFilePeriods] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<PlannerDashboard | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('Period 1');
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonLogs, setLessonLogs] = useState<LessonLogEntry[]>([]);
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [openBubbleBucket, setOpenBubbleBucket] = useState<string | null>('Bubble to Level 3');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('daily');
  const [seatingSeed, setSeatingSeed] = useState(1);

  const activePeriod = useMemo(() => {
    if (!dashboard?.periods.length) return null;
    return dashboard.periods.find((period) => period.periodLabel === selectedPeriod) ?? null;
  }, [dashboard, selectedPeriod]);
  const selectedPeriodFile = files.find((file, index) => {
    const key = fileKey(file, index);
    return (filePeriods[key] ?? inferPeriodFromFileName(file.name) ?? `Period ${index + 1}`) === selectedPeriod;
  });
  const allPeriodPriorities = useMemo(() => {
    const totals = new Map<string, BenchmarkSummary & { periods: Set<string> }>();
    for (const period of dashboard?.periods ?? []) {
      for (const lesson of period.lessonQueue) {
        const current = totals.get(lesson.standard9) ?? { ...lesson, periods: new Set<string>() };
        current.earned += lesson.earned;
        current.possible += lesson.possible;
        current.misses += lesson.misses;
        current.studentsSeen += lesson.studentsSeen;
        current.periods.add(period.periodLabel);
        current.accuracy = current.possible ? current.earned / current.possible : lesson.accuracy;
        current.priorityScore += lesson.priorityScore;
        totals.set(lesson.standard9, current);
      }
    }
    return [...totals.values()].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 8);
  }, [dashboard]);
  const visibleLogs = lessonLogs.filter((entry) => selectedPeriod === 'All Periods' || entry.periodLabel === selectedPeriod);
  const coverageByStandard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of visibleLogs) counts.set(entry.standard9, (counts.get(entry.standard9) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleLogs]);
  const coverageByFamily = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of visibleLogs) {
      const family = categoryFamily(entry.standard9);
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [visibleLogs]);
  const dailyLesson = useMemo(
    () => chooseDailyLesson(activePeriod, lessonLogs),
    [activePeriod, lessonLogs]
  );
  const smallGroups = useMemo(() => buildSmallGroups(activePeriod), [activePeriod]);
  const bubbleGroups = useMemo(() => buildBubbleGroups(activePeriod), [activePeriod]);
  const seatingChart = useMemo(() => buildSeatingChart(activePeriod, seatingSeed), [activePeriod, seatingSeed]);
  const nextSchoolDate = useMemo(() => nextInstructionalDate(), []);
  const nextSchoolDay = useMemo(
    () => (nextSchoolDate ? schoolDayInfo(nextSchoolDate) : null),
    [nextSchoolDate]
  );
  const activePeriodMeetings = useMemo(
    () => nextMeetingsForPeriod(activePeriod?.periodLabel, 4),
    [activePeriod?.periodLabel]
  );
  const pacingGuide = useMemo(
    () => buildPacingGuide(activePeriod, lessonLogs, 18),
    [activePeriod, lessonLogs]
  );
  const activePeriodBlock = blockForPeriod(periodNumberFromLabel(activePeriod?.periodLabel));
  const activePeriodMeetingsLeft = useMemo(
    () => remainingMeetingsInGradingPeriod(activePeriod?.periodLabel),
    [activePeriod?.periodLabel]
  );
  const yearProgress = useMemo(() => schoolYearProgress(), []);

  async function loadSavedPlanner() {
    setLoadingSaved(true);
    setError(null);
    try {
      const res = await fetch('/api/teacher/pm3-planner');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not load saved class planner.');
      setDashboard(json.dashboard);
      if (json.dashboard?.periods?.length) {
        const selectedStillExists = json.dashboard.periods.some(
          (period: PeriodPlan) => period.periodLabel === selectedPeriod
        );
        if (!selectedStillExists) setSelectedPeriod(json.dashboard.periods[0].periodLabel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved class planner.');
    } finally {
      setLoadingSaved(false);
    }
  }

  async function loadLessonLogs() {
    try {
      const res = await fetch('/api/teacher/class-lesson-log');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not load lesson log.');
      setLessonLogs(json.log?.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lesson log.');
    }
  }

  useEffect(() => {
    void loadSavedPlanner();
    void loadLessonLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buildPlanner() {
    if (!files.length) {
      setError('Choose at least one PM3 Excel file.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      files.forEach((file, index) => {
        form.append('files', file);
        form.append('periodLabels', filePeriods[fileKey(file, index)] || inferPeriodFromFileName(file.name) || `Period ${index + 1}`);
      });
      const res = await fetch('/api/teacher/pm3-planner', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not build class planner.');
      setDashboard(json.dashboard);
      const selectedStillExists = json.dashboard.periods?.some(
        (period: PeriodPlan) => period.periodLabel === selectedPeriod
      );
      if (!selectedStillExists) setSelectedPeriod(json.dashboard.periods?.[0]?.periodLabel ?? 'Period 1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build class planner.');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  async function deletePeriodData(periodLabel: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/pm3-planner?period=${encodeURIComponent(periodLabel)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not delete period data.');
      setDashboard(json.dashboard);
      if (json.dashboard?.periods?.length) {
        setSelectedPeriod(json.dashboard.periods[0].periodLabel);
      } else {
        setSelectedPeriod(periodLabel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete period data.');
    } finally {
      setLoading(false);
    }
  }

  async function logLesson(periodLabel: string, lesson: BenchmarkSummary) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/teacher/class-lesson-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodLabel,
          standard9: lesson.standard9,
          title: lesson.title,
          subskill: defaultSubskill(lesson.standard9),
          lessonType: 'whole_group',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Could not log lesson.');
      setLessonLogs(json.log?.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log lesson.');
    } finally {
      setLoading(false);
    }
  }

  function removeFile(indexToRemove: number) {
    setFiles((current) => {
      const removed = current[indexToRemove];
      if (removed) {
        const key = fileKey(removed, indexToRemove);
        setFilePeriods((periods) => {
          const next = { ...periods };
          delete next[key];
          return next;
        });
      }
      return current.filter((_, index) => index !== indexToRemove);
    });
    setDashboard(null);
    setError(null);
  }

  function printSeatingChart() {
    document.body.classList.add('print-seating-chart');
    window.print();
    window.setTimeout(() => document.body.classList.remove('print-seating-chart'), 250);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.light, color: C.dark, fontFamily: FONTS.ui }}>
      <TeacherDashboardTopBar active="pm3" />
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.16in;
          }
          nav,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          body.print-seating-chart * {
            visibility: hidden !important;
          }
          body.print-seating-chart .printable-seating,
          body.print-seating-chart .printable-seating * {
            visibility: visible !important;
          }
          .printable-seating {
            border: none !important;
            box-shadow: none !important;
          }
          body.print-seating-chart .printable-seating {
            background: white !important;
            left: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            position: absolute !important;
            top: 0 !important;
            width: 100% !important;
          }
          body.print-seating-chart .printable-seating h3 {
            font-size: 16px !important;
            margin: 0 0 4px !important;
          }
          .teacher-only-print {
            display: none !important;
          }
          .student-print-strength {
            display: block !important;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5px !important;
            margin-top: 5px !important;
          }
          .print-table-card {
            border-radius: 5px !important;
            padding: 5px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-table-title {
            font-size: 13px !important;
          }
          .print-table-zone {
            font-size: 9px !important;
          }
          .print-seat {
            border-radius: 5px !important;
            min-height: 29px !important;
            padding: 4px !important;
          }
          .print-seat-name {
            font-size: 10px !important;
            line-height: 1.1 !important;
          }
          .student-print-strength {
            font-size: 8.5px !important;
            line-height: 1.1 !important;
            margin-top: 2px !important;
          }
        }
      `}</style>
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 20px 64px' }}>
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
            NEXT YEAR LAUNCH TOOL
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.08, margin: '8px 0' }}>Class Planner</h1>
          <p style={{ color: C.gray, fontSize: 16, lineHeight: 1.45, margin: 0, maxWidth: 850 }}>
            Drop in one Excel file per period. GOGI ranks the weakest standards, maps Grade 8 FAST
            evidence to Grade 9 teaching targets, and gives you a classwide lesson queue.
          </p>

          <div
            style={{
              alignItems: 'end',
              background: '#F8FAFC',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              marginTop: 18,
              padding: 14,
            }}
          >
            <label style={{ display: 'grid', gap: 5, minWidth: 280 }}>
              <span style={{ color: C.gray, fontSize: 12, fontWeight: 950 }}>Class command center</span>
              <select
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  color: C.dark,
                  fontSize: 15,
                  fontWeight: 850,
                  padding: '10px 12px',
                }}
              >
                {PERIOD_SELECTOR_OPTIONS.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 800, lineHeight: 1.35, maxWidth: 680 }}>
              {selectedPeriod === 'All Periods'
                ? dashboard
                  ? `${dashboard.periodCount} period${dashboard.periodCount === 1 ? '' : 's'} loaded. Review cross-class priorities below.`
                  : 'Use this view once you have more than one period loaded.'
                : activePeriod
                ? `${activePeriod.periodLabel} is loaded. Review the lesson queue below.`
                : selectedPeriodFile
                  ? `${selectedPeriodFile.name} is assigned to ${selectedPeriod}. Click Build class plan to generate the lesson queue.`
                  : loadingSaved
                    ? 'Checking for saved class planner data...'
                    : `${selectedPeriod} is ready. Upload that period's PM3 file when you have it, and GOGI will fill this workspace with priorities.`}
            </div>
          </div>

          <div
            style={{
              alignItems: 'center',
              background: '#F8FAFC',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 18,
              padding: 14,
            }}
          >
            <label
              style={{
                alignItems: 'center',
                background: C.dark,
                borderRadius: 7,
                color: C.white,
                cursor: 'pointer',
                display: 'inline-flex',
                fontSize: 13,
                fontWeight: 900,
                gap: 8,
                padding: '10px 12px',
              }}
            >
              <Upload size={16} />
              Choose PM3 files
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                multiple
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files ?? []);
                  setFiles(selectedFiles);
                  setFilePeriods(
                    Object.fromEntries(
                      selectedFiles.map((file, index) => [
                        fileKey(file, index),
                        inferPeriodFromFileName(file.name) || `Period ${index + 1}`,
                      ])
                    )
                  );
                  setDashboard(null);
                }}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="button"
              onClick={buildPlanner}
              disabled={loading || !files.length}
              style={{
                alignItems: 'center',
                background: files.length ? C.blue : '#CBD5E1',
                border: 'none',
                borderRadius: 7,
                color: C.white,
                cursor: loading || !files.length ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                fontSize: 13,
                fontWeight: 950,
                gap: 8,
                padding: '10px 12px',
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Build class plan
            </button>
            <div style={{ color: C.gray, fontSize: 13, fontWeight: 800 }}>
              {files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'No files selected yet'}
            </div>
          </div>
          {files.length ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {files.map((file, index) => {
                const key = fileKey(file, index);
                return (
                <div
                  key={key}
                  style={{
                    alignItems: 'center',
                    background: '#F8FAFC',
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    display: 'flex',
                    gap: 10,
                    justifyContent: 'space-between',
                    padding: '9px 10px',
                  }}
                >
                  <div>
                    <div style={{ color: C.dark, fontSize: 13, fontWeight: 950 }}>{file.name}</div>
                    <div style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>
                      Ready to build into the class planner
                    </div>
                  </div>
                  <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <label style={{ alignItems: 'center', display: 'flex', gap: 7 }}>
                      <span style={{ color: C.gray, fontSize: 12, fontWeight: 950 }}>Class period</span>
                      <select
                        value={filePeriods[key] ?? `Period ${index + 1}`}
                        onChange={(event) => {
                          setFilePeriods((current) => ({ ...current, [key]: event.target.value }));
                          setDashboard(null);
                          setSelectedPeriod(event.target.value);
                        }}
                        style={{
                          background: C.white,
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          color: C.dark,
                          fontSize: 13,
                          fontWeight: 850,
                          padding: '7px 9px',
                        }}
                      >
                        {PERIOD_OPTIONS.map((period) => (
                          <option key={period} value={period}>
                            {period}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      style={{
                        alignItems: 'center',
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        color: C.red,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        fontSize: 12,
                        fontWeight: 950,
                        gap: 6,
                        padding: '7px 9px',
                      }}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : null}
          {error ? <div style={{ color: C.red, fontSize: 13, fontWeight: 900, marginTop: 10 }}>{error}</div> : null}
        </section>

        {dashboard ? (
          <>
            <section
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                marginTop: 18,
              }}
            >
              <div style={metricCardStyle}>
                <div style={metricLabelStyle}>Periods loaded</div>
                <div style={metricValueStyle}>{dashboard.periodCount}</div>
              </div>
              <div style={metricCardStyle}>
                <div style={metricLabelStyle}>Students</div>
                <div style={metricValueStyle}>{dashboard.studentCount}</div>
              </div>
              <div style={metricCardStyle}>
                <div style={metricLabelStyle}>First planning move</div>
                <div style={{ color: C.dark, fontSize: 20, fontWeight: 950 }}>
                  {dailyLesson?.standard9 ?? 'Select loaded period'}
                </div>
              </div>
              <div style={metricCardStyle}>
                <div style={metricLabelStyle}>Next school day</div>
                <div style={{ color: C.dark, fontSize: 20, fontWeight: 950 }}>
                  {nextSchoolDay ? `${nextSchoolDay.label} · ${nextSchoolDay.blockDay} day` : 'Not set'}
                </div>
              </div>
            </section>

            {activePeriod ? (
              <section
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  marginTop: 14,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                      PERIOD PLAN
                    </div>
                    <h2 style={{ fontSize: 28, margin: '5px 0' }}>{activePeriod.periodLabel}</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                      <span style={{ ...headerStatPillStyle, background: '#EFF6FF', borderColor: '#BFDBFE', color: C.blue }}>
                        {activePeriod.studentCount} students
                      </span>
                      <span style={headerStatPillStyle}>
                        Avg scale {activePeriod.averageScaleScore ?? 'n/a'}
                      </span>
                      {Object.entries(activePeriod.levelCounts)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([level, count]) => (
                          <span key={level} style={headerStatPillStyle}>
                            {level}: {count}
                          </span>
                        ))}
                      {dashboard.updatedAt ? (
                        <span style={{ ...headerStatPillStyle, color: C.gray }}>
                          Saved {new Date(dashboard.updatedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, maxWidth: 430 }}>
                    <div
                      style={{
                        background: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        borderRadius: 8,
                        color: '#92400E',
                        fontSize: 13,
                        fontWeight: 900,
                        padding: 12,
                      }}
                    >
                      Start with the highest-priority standard below. This is the classwide whole-group
                      lesson queue, not individual remediation yet.
                    </div>
                    <div
                      style={{
                        background: '#EFF6FF',
                        border: `1px solid ${C.blue}`,
                        borderRadius: 8,
                        color: C.dark,
                        fontSize: 13,
                        fontWeight: 850,
                        lineHeight: 1.45,
                        padding: 12,
                      }}
                    >
                      <div style={{ color: C.blue, fontSize: 11, fontWeight: 1000, letterSpacing: 0.8 }}>
                        MDCPS BLOCK CALENDAR
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 1000, marginTop: 3 }}>
                        {activePeriod.periodLabel} is a {activePeriodBlock ?? '?'}-day class.
                      </div>
                      <div style={{ color: C.gray, marginTop: 3 }}>
                        Next meetings:{' '}
                        {activePeriodMeetings.length
                          ? activePeriodMeetings.map((day) => formatSchoolDate(day.date)).join(' · ')
                          : 'none found'}
                      </div>
                      <div style={{ color: C.gray, marginTop: 3 }}>
                        {activePeriodMeetingsLeft} meetings left in the current grading-period window.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePeriodData(activePeriod.periodLabel)}
                      disabled={loading}
                      style={{
                        alignItems: 'center',
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 7,
                        color: C.red,
                        cursor: loading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        fontSize: 12,
                        fontWeight: 950,
                        gap: 7,
                        justifyContent: 'center',
                        padding: '8px 10px',
                      }}
                    >
                      <Trash2 size={14} />
                      Delete saved {activePeriod.periodLabel}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                  {[
                    ['daily', 'Daily Plan'],
                    ['pacing', 'Pacing Guide'],
                    ['analytics', 'Class Analytics'],
                    ['history', 'Lesson History'],
                    ['groups', 'Small Groups'],
                    ['bubble', 'Bubble Kids'],
                    ['seating', 'Seating Chart'],
                  ].map(([key, label]) => {
                    const active = workspaceTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setWorkspaceTab(key as WorkspaceTab)}
                        style={{
                          background: active ? C.dark : C.white,
                          border: `1px solid ${active ? C.dark : C.border}`,
                          borderRadius: 999,
                          color: active ? C.white : C.dark,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 950,
                          padding: '8px 12px',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {workspaceTab === 'daily' ? (
                  <>
                {dailyLesson ? (
                  <section
                    style={{
                      background: '#EFF6FF',
                      border: `1px solid ${C.blue}`,
                      borderRadius: 8,
                      marginTop: 18,
                      padding: 16,
                    }}
                  >
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                      TODAY'S BEST MOVE
                    </div>
                    <h3 style={{ color: C.dark, fontSize: 23, margin: '6px 0' }}>
                      {dailyLesson.standard9}: {dailyLesson.title}
                    </h3>
                    <p style={{ color: C.dark, fontSize: 15, lineHeight: 1.45, margin: '0 0 12px' }}>
                      {dailyRecommendationReason(dailyLesson, lessonLogs, activePeriod.periodLabel)}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {(STANDARD_SUBSKILLS[dailyLesson.standard9] ?? ['Core skill']).map((subskill) => (
                        <span key={subskill} style={smallPillStyle}>
                          {subskill}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <a href={lessonLaunchHref(dailyLesson, activePeriod.periodLabel)} style={primaryLinkStyle}>
                        Launch lesson <ArrowRight size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => logLesson(activePeriod.periodLabel, dailyLesson)}
                        disabled={loading}
                        style={secondaryButtonStyle}
                      >
                        <CheckCircle2 size={14} />
                        Mark taught today
                      </button>
                    </div>
                    <div
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 7,
                        color: C.gray,
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.35,
                        marginTop: 12,
                        padding: 10,
                      }}
                    >
                      Recommendation logic: GOGI starts with PM3 weakness, boosts urgent low-accuracy
                      standards, then lowers a standard after you log it so the class gets balanced
                      coverage over time.
                    </div>
                    <div
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderRadius: 7,
                        color: C.gray,
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.45,
                        marginTop: 8,
                        padding: 10,
                      }}
                    >
                      Calendar logic: GOGI is using the {MDCPS_2026_2027_CALENDAR.schoolYear}{' '}
                      MDCPS calendar, skips holidays/recesses, and alternates A/B block days from
                      the first student day. Year progress:{' '}
                      {yearProgress.completedInstructionalDays}/{yearProgress.totalInstructionalDays}{' '}
                      instructional days completed.
                    </div>
                  </section>
                ) : null}

                <div
                  style={{
                    display: 'grid',
                    gap: 14,
                    gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.7fr)',
                    marginTop: 18,
                  }}
                >
                  <div>
                    <h3 style={sectionTitleStyle}>Recommended Lesson Queue</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {activePeriod.lessonQueue.map((lesson, index) => (
                        <article
                          key={lesson.standard9}
                          style={{
                            border: `1px solid ${C.border}`,
                            borderRadius: 8,
                            padding: 14,
                          }}
                        >
                          <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
                            <span
                              style={{
                                alignItems: 'center',
                                background: C.dark,
                                borderRadius: 999,
                                color: C.white,
                                display: 'inline-flex',
                                flex: '0 0 auto',
                                fontSize: 12,
                                fontWeight: 950,
                                height: 28,
                                justifyContent: 'center',
                                width: 28,
                              }}
                            >
                              {index + 1}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: C.dark, fontSize: 18, fontWeight: 950 }}>
                                {lesson.standard9}: {lesson.title}
                              </div>
                              <div style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                                Grade 8 evidence: {lesson.benchmark8} · {lesson.category}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              alignItems: 'center',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 10,
                              marginTop: 12,
                            }}
                          >
                            <span style={{ ...pillStyle, color: scoreColor(lesson.accuracy) }}>
                              {pct(lesson.accuracy)} correct
                            </span>
                            <span style={pillStyle}>{lesson.misses} missed items</span>
                            <span style={pillStyle}>{lesson.studentsSeen} students saw this benchmark</span>
                            <a
                              href={lessonLaunchHref(lesson, activePeriod.periodLabel)}
                              style={{ ...primaryLinkStyle, marginLeft: 'auto' }}
                            >
                              Launch lesson <ArrowRight size={14} />
                            </a>
                          </div>
                          <div
                            style={{
                              background: '#F8FAFC',
                              borderRadius: 7,
                              color: C.dark,
                              fontSize: 13,
                              fontWeight: 750,
                              lineHeight: 1.4,
                              marginTop: 12,
                              padding: 10,
                            }}
                          >
                            <strong>Why it matters:</strong> {planningReason(lesson)}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                            {(STANDARD_SUBSKILLS[lesson.standard9] ?? ['Core skill']).map((subskill) => (
                              <span key={subskill} style={smallPillStyle}>
                                {subskill}
                              </span>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => logLesson(activePeriod.periodLabel, lesson)}
                            disabled={loading}
                            style={{ ...secondaryButtonStyle, marginTop: 10 }}
                          >
                            <CheckCircle2 size={14} />
                            Mark as taught
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>

                  <aside>
                    <h3 style={sectionTitleStyle}>Reporting Categories</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {activePeriod.categorySummaries.map((category) => (
                        <div key={category.category} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ color: C.dark, fontSize: 14, fontWeight: 950 }}>{category.category}</div>
                          <div style={{ color: scoreColor(category.accuracy), fontSize: 24, fontWeight: 1000 }}>
                            {pct(category.accuracy)}
                          </div>
                          <div style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                            {category.belowCount} below · {category.atNearCount} at/near · {category.aboveCount} above
                          </div>
                        </div>
                      ))}
                    </div>

                    <h3 style={{ ...sectionTitleStyle, marginTop: 18 }}>Student Buckets</h3>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {[
                        ['urgent', 'Urgent support', activePeriod.studentGroups.urgent, C.red],
                        ['watch', 'Watch list', activePeriod.studentGroups.watch, '#B45309'],
                        ['onTrack', 'On track', activePeriod.studentGroups.onTrack, C.green],
                        ['extension', 'Extension', activePeriod.studentGroups.extension, C.blue],
                      ].map(([key, label, students, color]) => {
                        const bucketOpen = openBucket === key;
                        const typedStudents = students as StudentSummary[];
                        return (
                          <div key={String(key)} style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}>
                            <button
                              type="button"
                              onClick={() => setOpenBucket(bucketOpen ? null : String(key))}
                              style={{
                                alignItems: 'center',
                                background: C.white,
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: 10,
                                width: '100%',
                              }}
                            >
                              <span style={{ color: C.dark, fontSize: 13, fontWeight: 900 }}>{String(label)}</span>
                              <span style={{ alignItems: 'center', color: String(color), display: 'inline-flex', fontSize: 18, fontWeight: 1000, gap: 6 }}>
                                {typedStudents.length}
                                {bucketOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </button>
                            {bucketOpen ? (
                              <div style={{ borderTop: `1px solid ${C.border}`, display: 'grid', gap: 5, padding: 10 }}>
                                {typedStudents.length ? typedStudents.map((student) => (
                                  <div key={student.studentId || student.name} style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                                    {student.name} · {student.achievementLevel}
                                    {student.percentile !== null ? ` · ${student.percentile} percentile` : ''}
                                  </div>
                                )) : (
                                  <div style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>No students in this bucket.</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <h3 style={{ ...sectionTitleStyle, marginTop: 18 }}>Coverage Tracker</h3>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                      <div style={{ color: C.dark, fontSize: 24, fontWeight: 1000 }}>{visibleLogs.length}</div>
                      <div style={{ color: C.gray, fontSize: 12, fontWeight: 900 }}>logged lesson{visibleLogs.length === 1 ? '' : 's'} for this view</div>
                      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                        {coverageByFamily.length ? coverageByFamily.map(([family, count]) => (
                          <div key={family} style={{ display: 'flex', justifyContent: 'space-between', color: C.dark, fontSize: 12, fontWeight: 850 }}>
                            <span>{family}</span>
                            <strong>{count}</strong>
                          </div>
                        )) : (
                          <div style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                            No lessons logged yet. Use “Mark as taught” after you teach a recommendation.
                          </div>
                        )}
                      </div>
                      {coverageByStandard.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {coverageByStandard.map(([standard, count]) => (
                            <span key={standard} style={smallPillStyle}>
                              {standard} · {count}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </aside>
                </div>
                  </>
                ) : null}

                {workspaceTab === 'pacing' ? (
                  <section style={{ marginTop: 18 }}>
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                      HIGH-LEVEL PACING GUIDE
                    </div>
                    <h3 style={{ color: C.dark, fontSize: 23, margin: '6px 0' }}>
                      Upcoming {activePeriod.periodLabel} Lessons
                    </h3>
                    <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.45, margin: '0 0 14px' }}>
                      This view uses the MDCPS block calendar, skips non-school days, and previews
                      standards from the PM3 priority queue. Logging a lesson changes the next pacing
                      recommendations.
                    </p>

                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 14 }}>
                      <div style={metricCardStyle}>
                        <div style={metricLabelStyle}>Block</div>
                        <div style={{ ...metricValueStyle, fontSize: 24 }}>{activePeriodBlock ?? '?'} day</div>
                      </div>
                      <div style={metricCardStyle}>
                        <div style={metricLabelStyle}>Meetings this window</div>
                        <div style={{ ...metricValueStyle, fontSize: 24 }}>{activePeriodMeetingsLeft}</div>
                      </div>
                      <div style={metricCardStyle}>
                        <div style={metricLabelStyle}>Preview range</div>
                        <div style={{ color: C.dark, fontSize: 17, fontWeight: 950 }}>
                          {pacingGuide[0]?.month ?? 'No meetings found'}
                        </div>
                      </div>
                    </div>

                    {pacingGuide.length ? (
                      <div style={{ display: 'grid', gap: 12 }}>
                        {Object.entries(
                          pacingGuide.reduce<Record<string, typeof pacingGuide>>((map, item) => {
                            map[item.week] = [...(map[item.week] ?? []), item];
                            return map;
                          }, {})
                        ).map(([week, items]) => (
                          <article key={week} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                            <div style={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, color: C.dark, fontSize: 14, fontWeight: 1000, padding: '10px 12px' }}>
                              {week}
                            </div>
                            <div style={{ display: 'grid', gap: 0 }}>
                              {items.map((item) => (
                                <div
                                  key={`${item.meeting.date}-${item.lesson.standard9}`}
                                  style={{
                                    alignItems: 'center',
                                    borderBottom: `1px solid ${C.border}`,
                                    display: 'grid',
                                    gap: 12,
                                    gridTemplateColumns: '150px minmax(0, 1fr) 190px',
                                    padding: 12,
                                  }}
                                >
                                  <div>
                                    <div style={{ color: C.dark, fontSize: 14, fontWeight: 1000 }}>
                                      {formatSchoolDate(item.meeting.date)}
                                    </div>
                                    <div style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>
                                      {item.meeting.blockDay} day · GP{item.meeting.gradingPeriod}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ color: C.dark, fontSize: 15, fontWeight: 1000 }}>
                                      {item.lesson.standard9}: {item.lesson.title}
                                    </div>
                                    <div style={{ color: C.gray, fontSize: 12, fontWeight: 850, marginTop: 3 }}>
                                      Focus: {item.subskill} · {pct(item.lesson.accuracy)} PM3 accuracy · {item.lesson.misses} missed items
                                    </div>
                                  </div>
                                  <a href={lessonLaunchHref(item.lesson, activePeriod.periodLabel)} style={{ ...primaryLinkStyle, justifyContent: 'center' }}>
                                    Launch lesson <ArrowRight size={14} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, color: C.gray, fontSize: 14, fontWeight: 850, padding: 14 }}>
                        No upcoming block meetings found for this period.
                      </div>
                    )}
                  </section>
                ) : null}

                {workspaceTab === 'analytics' ? (
                  <section style={{ marginTop: 18 }}>
                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      <div style={metricCardStyle}>
                        <div style={metricLabelStyle}>Average scale score</div>
                        <div style={metricValueStyle}>{activePeriod.averageScaleScore ?? 'n/a'}</div>
                      </div>
                      <div style={metricCardStyle}>
                        <div style={metricLabelStyle}>Urgent + watch</div>
                        <div style={metricValueStyle}>
                          {activePeriod.studentGroups.urgent.length + activePeriod.studentGroups.watch.length}
                        </div>
                      </div>
                      <div style={metricCardStyle}>
                        <div style={metricLabelStyle}>Lowest category</div>
                        <div style={{ color: C.dark, fontSize: 18, fontWeight: 950, marginTop: 6 }}>
                          {[...activePeriod.categorySummaries].sort((a, b) => a.accuracy - b.accuracy)[0]?.category.replace(/^[0-9]\.\s*/, '') ?? 'n/a'}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: 14,
                        gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
                        marginTop: 16,
                      }}
                    >
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                        <h3 style={sectionTitleStyle}>FAST Category Breakdown</h3>
                        <div style={{ display: 'grid', gap: 12 }}>
                          {activePeriod.categorySummaries.map((category) => (
                            <div key={category.category}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.dark, fontSize: 13, fontWeight: 900 }}>
                                <span>{category.category.replace(/^[0-9]\.\s*/, '')}</span>
                                <span>{pct(category.accuracy)}</span>
                              </div>
                              <div style={{ background: '#E5E7EB', borderRadius: 999, height: 10, marginTop: 5, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    background: scoreColor(category.accuracy),
                                    height: '100%',
                                    width: `${Math.max(4, Math.round(category.accuracy * 100))}%`,
                                  }}
                                />
                              </div>
                              <div style={{ color: C.gray, fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                                {category.belowCount} below · {category.atNearCount} at/near · {category.aboveCount} above
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                        <h3 style={sectionTitleStyle}>Benchmark Heat Map</h3>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {activePeriod.benchmarkSummaries.slice(0, 12).map((benchmark) => (
                            <div
                              key={benchmark.standard9}
                              style={{
                                alignItems: 'center',
                                border: `1px solid ${C.border}`,
                                borderRadius: 7,
                                display: 'grid',
                                gap: 8,
                                gridTemplateColumns: 'minmax(170px, 1fr) 78px 80px 92px',
                                padding: 9,
                              }}
                            >
                              <div>
                                <div style={{ color: C.dark, fontSize: 13, fontWeight: 950 }}>{benchmark.standard9}</div>
                                <div style={{ color: C.gray, fontSize: 11, fontWeight: 800 }}>{benchmark.title}</div>
                              </div>
                              <span style={{ color: scoreColor(benchmark.accuracy), fontSize: 13, fontWeight: 1000 }}>
                                {pct(benchmark.accuracy)}
                              </span>
                              <span style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>{benchmark.misses} misses</span>
                              <span style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>
                                taught {standardLogCount(lessonLogs, activePeriod.periodLabel, benchmark.standard9)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {workspaceTab === 'history' ? (
                  <section style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 18, padding: 14 }}>
                    <h3 style={sectionTitleStyle}>Lesson History</h3>
                    {visibleLogs.length ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {visibleLogs.map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              border: `1px solid ${C.border}`,
                              borderRadius: 7,
                              display: 'grid',
                              gap: 6,
                              gridTemplateColumns: '140px minmax(0, 1fr) 130px',
                              padding: 10,
                            }}
                          >
                            <div style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>
                              {new Date(entry.taughtAt).toLocaleDateString()}
                            </div>
                            <div>
                              <div style={{ color: C.dark, fontSize: 13, fontWeight: 950 }}>
                                {entry.standard9}: {entry.title}
                              </div>
                              <div style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                                {entry.subskill} · {entry.lessonType.replace('_', ' ')}
                              </div>
                            </div>
                            <div style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>{entry.periodLabel}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.45, margin: 0 }}>
                        No lessons logged for this period yet. Use “Mark taught” from the Daily Plan tab.
                      </p>
                    )}
                  </section>
                ) : null}

                {workspaceTab === 'groups' ? (
                  <section style={{ marginTop: 18 }}>
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                      DIFFERENTIATED PRECISION GROUPS
                    </div>
                    <h3 style={{ color: C.dark, fontSize: 23, margin: '6px 0' }}>Small Group Recommendations</h3>
                    <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.45, margin: '0 0 14px' }}>
                      Daily table plan: each student appears once, 3-4 students per group, capped at your 9 classroom tables.
                    </p>
                    {smallGroups.length ? (
                      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                        {smallGroups.map((group) => (
                          <article key={group.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 0.5 }}>
                              Table group {group.tableSlot}
                            </div>
                            <div style={{ color: C.dark, fontSize: 16, fontWeight: 1000, marginTop: 3 }}>{group.standard9}</div>
                            <div style={{ color: C.gray, fontSize: 13, fontWeight: 850, marginTop: 2 }}>{group.title}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              <span style={pillStyle}>{group.students.length}/4 seats</span>
                              <span style={pillStyle}>{group.totalMisses} missed item opportunities</span>
                              {group.sourcePoolSize > group.students.length ? (
                                <span style={pillStyle}>{group.sourcePoolSize} total need this skill</span>
                              ) : null}
                            </div>
                            <div style={{ color: C.dark, fontSize: 13, fontWeight: 900, marginTop: 10 }}>
                              Suggested work: open {group.standard9} workspace and assign 1 targeted pull-out + 1 FAST-style check.
                            </div>
                            <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                              {group.students.map((student) => {
                                const weakness = group.studentWeaknesses[student.studentId || student.name];
                                return (
                                  <div key={student.studentId || student.name} style={{ color: C.gray, fontSize: 12, fontWeight: 800 }}>
                                    {student.name} · missed {weakness?.missed ?? '?'} of {weakness?.possible ?? '?'}
                                    {weakness && weakness.standard9 !== group.standard9 ? ` · target ${weakness.standard9}` : ''}
                                  </div>
                                );
                              })}
                            </div>
                            <a href={`/teacher-dashboard/teaching-readiness?standard=${encodeURIComponent(group.standard9)}`} style={{ ...primaryLinkStyle, marginTop: 12 }}>
                              Open standard workspace <ArrowRight size={14} />
                            </a>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, color: C.gray, fontSize: 14, fontWeight: 850, padding: 14 }}>
                        Small groups will populate after this period is rebuilt with the latest PM3 parser. Re-upload the PM3 file once to attach student-level weak standards.
                      </div>
                    )}
                  </section>
                ) : null}

                {workspaceTab === 'bubble' ? (
                  <section style={{ marginTop: 18 }}>
                    <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                      MOVE-THE-NEEDLE STUDENTS
                    </div>
                    <h3 style={{ color: C.dark, fontSize: 23, margin: '6px 0' }}>Bubble Kids</h3>
                    <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.45, margin: '0 0 14px' }}>
                      Use this view to decide who can move fastest with targeted instruction and who needs protection from sliding.
                    </p>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {bubbleGroups.map((group) => (
                        <article key={group.label} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => setOpenBubbleBucket(openBubbleBucket === group.label ? null : group.label)}
                            style={{
                              alignItems: 'center',
                              background: C.white,
                              border: 'none',
                              cursor: 'pointer',
                              display: 'grid',
                              gap: 12,
                              gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                              padding: 14,
                              textAlign: 'left',
                              width: '100%',
                            }}
                          >
                            <div>
                              <div style={{ color: String(group.color), fontSize: 16, fontWeight: 1000 }}>{group.label}</div>
                              <div style={{ color: C.gray, fontSize: 12, fontWeight: 850, marginTop: 2 }}>{group.description}</div>
                            </div>
                            <span style={{ ...pillStyle, color: String(group.color) }}>
                              {group.students.length} students
                            </span>
                            <span style={{ color: C.gray, display: 'inline-flex' }}>
                              {openBubbleBucket === group.label ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                          </button>
                          {openBubbleBucket === group.label ? (
                          <div style={{ borderTop: `1px solid ${C.border}`, display: 'grid', gap: 8, padding: 14 }}>
                            {group.students.length ? group.students.map((student) => {
                              const lever = student.weakStandards?.[0];
                              return (
                                <div key={student.studentId || student.name} style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 7, padding: 10 }}>
                                  <div style={{ color: C.dark, fontSize: 13, fontWeight: 950 }}>
                                    {student.name}
                                  </div>
                                  <div style={{ color: C.gray, fontSize: 12, fontWeight: 800, marginTop: 2 }}>
                                    {student.achievementLevel}
                                    {student.scaleScore !== null ? ` · ${student.scaleScore} scale` : ''}
                                    {student.percentile !== null ? ` · ${student.percentile} percentile` : ''}
                                  </div>
                                  <div style={{ color: C.dark, fontSize: 12, fontWeight: 850, lineHeight: 1.35, marginTop: 6 }}>
                                    {bubbleReason(student, group.label)}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                                    <span style={smallPillStyle}>Strongest: {strongestCategory(student)}</span>
                                    <span style={smallPillStyle}>Weakest: {weakestCategory(student)}</span>
                                  </div>
                                  {lever ? (
                                    <a
                                      href={`/teacher-dashboard/teaching-readiness?standard=${encodeURIComponent(lever.standard9)}`}
                                      style={{ ...primaryLinkStyle, marginTop: 8 }}
                                    >
                                      Target {lever.standard9} <ArrowRight size={14} />
                                    </a>
                                  ) : null}
                                </div>
                              );
                            }) : (
                              <div style={{ color: C.gray, fontSize: 13, fontWeight: 850 }}>
                                No students currently match this bucket.
                              </div>
                            )}
                          </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {workspaceTab === 'seating' ? (
                  <section className="printable-seating" style={{ marginTop: 18 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                          CLASSROOM MANAGEMENT
                        </div>
                        <h3 style={{ color: C.dark, fontSize: 23, margin: '6px 0' }}>
                          {activePeriod.periodLabel} Seating Chart
                        </h3>
                        <p className="teacher-only-print" style={{ color: C.gray, fontSize: 14, lineHeight: 1.45, margin: 0, maxWidth: 760 }}>
                          Nine tables, four seats each. Tables 1-3 are door side, 4-6 are middle, and
                          7-9 are teacher side. GOGI spreads high-support students and balances listed sex when the PM3 file includes it.
                        </p>
                      </div>
                      <div className="no-print" style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setSeatingSeed((current) => current + 1)}
                          style={secondaryButtonStyle}
                        >
                          <Shuffle size={14} />
                          Shuffle again
                        </button>
                        <button
                          type="button"
                          onClick={printSeatingChart}
                          style={primaryLinkStyle}
                        >
                          <Printer size={14} />
                          Print / save PDF
                        </button>
                      </div>
                    </div>

                    <div
                      className="teacher-only-print"
                      style={{
                        background: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        borderRadius: 8,
                        color: '#92400E',
                        display: 'grid',
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 900,
                        lineHeight: 1.35,
                        marginTop: 14,
                        padding: 12,
                      }}
                    >
                      <span>Teacher logic: urgent/watch students are spread out first, with stronger support near tables 7-9.</span>
                      {seatingChart.missingSexCount ? (
                        <span>
                          {seatingChart.missingSexCount} student{seatingChart.missingSexCount === 1 ? '' : 's'} do not have sex listed in the saved data, so gender balance will improve after rebuilding this period with the latest PM3 upload.
                        </span>
                      ) : null}
                    </div>

                    <div
                      className="print-grid"
                      style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        marginTop: 14,
                      }}
                    >
                      {seatingChart.tables.map((table) => {
                        const stats = tableStats(table);
                        return (
                          <article
                            key={table.id}
                            className="print-table-card"
                            style={{
                              background: table.zone === 'Teacher side' ? '#EFF6FF' : C.white,
                              border: `1px solid ${table.zone === 'Teacher side' ? C.blue : C.border}`,
                              borderRadius: 8,
                              padding: 12,
                            }}
                          >
                            <div style={{ alignItems: 'start', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <div>
                                <div className="print-table-title" style={{ color: C.dark, fontSize: 17, fontWeight: 1000 }}>Table {table.id}</div>
                                <div className="print-table-zone" style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>{table.zone}</div>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'end' }}>
                                <span className="teacher-only-print" style={smallPillStyle}>M {stats.male}</span>
                                <span className="teacher-only-print" style={smallPillStyle}>F {stats.female}</span>
                                <span className="teacher-only-print" style={{ ...smallPillStyle, color: stats.highSupport ? '#B45309' : C.gray }}>
                                  support {stats.highSupport}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
                              {Array.from({ length: 4 }, (_, seatIndex) => {
                                const student = table.seats[seatIndex];
                                return (
                                  <div
                                    key={`${table.id}-${seatIndex}`}
                                    className="print-seat"
                                    style={{
                                      background: '#F8FAFC',
                                      border: `1px solid ${C.border}`,
                                      borderRadius: 7,
                                      minHeight: 52,
                                      padding: 9,
                                    }}
                                  >
                                    {student ? (
                                      <>
                                        <div className="print-seat-name" style={{ color: C.dark, fontSize: 13, fontWeight: 950 }}>
                                          Seat {seatIndex + 1}: {student.name}
                                        </div>
                                        <div className="teacher-only-print" style={{ color: C.gray, fontSize: 11, fontWeight: 850, marginTop: 3 }}>
                                          {normalizeSex(student.sex)} · {student.achievementLevel}
                                          {student.percentile !== null ? ` · ${student.percentile} percentile` : ''}
                                        </div>
                                        <div className="teacher-only-print" style={{ color: student.riskBand === 'urgent' ? C.red : student.riskBand === 'watch' ? '#B45309' : C.gray, fontSize: 11, fontWeight: 950, marginTop: 3 }}>
                                          {student.riskBand.replace('-', ' ')}
                                        </div>
                                        <div
                                          className="student-print-strength"
                                          style={{ color: C.green, fontSize: 11, fontWeight: 950, marginTop: 3 }}
                                        >
                                          {studentStrengthLabel(student)}
                                        </div>
                                      </>
                                    ) : (
                                      <div style={{ color: C.gray, fontSize: 12, fontWeight: 850 }}>
                                        Seat {seatIndex + 1}: open
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {seatingChart.overflow.length ? (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 14, padding: 12 }}>
                        <div style={{ color: C.dark, fontSize: 14, fontWeight: 1000 }}>Overflow</div>
                        <div style={{ color: C.gray, fontSize: 12, fontWeight: 850, marginTop: 4 }}>
                          These students do not fit in 9 tables x 4 seats. Add another table or split the arrangement.
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {seatingChart.overflow.map((student) => (
                            <span key={student.studentId || student.name} style={smallPillStyle}>
                              {student.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </section>
            ) : null}
            {selectedPeriod === 'All Periods' && dashboard ? (
              <section
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  marginTop: 14,
                  padding: 18,
                }}
              >
                <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                  ALL-PERIODS COMMAND VIEW
                </div>
                <h2 style={{ fontSize: 28, margin: '5px 0' }}>Cross-Class Priorities</h2>
                <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.45, margin: '0 0 14px' }}>
                  Use this to spot the lesson that can move the most classes at once.
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {allPeriodPriorities.map((lesson, index) => (
                    <article key={lesson.standard9} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                      <div style={{ color: C.dark, fontSize: 17, fontWeight: 950 }}>
                        {index + 1}. {lesson.standard9}: {lesson.title}
                      </div>
                      <div style={{ color: C.gray, fontSize: 12, fontWeight: 850, marginTop: 4 }}>
                        Appears in {(lesson as BenchmarkSummary & { periods: Set<string> }).periods.size} period priority queue{(lesson as BenchmarkSummary & { periods: Set<string> }).periods.size === 1 ? '' : 's'} · {lesson.misses} total missed item opportunities
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        <a href={lesson.lessonHref} style={primaryLinkStyle}>
                          Open standard <ArrowRight size={14} />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {selectedPeriod !== 'All Periods' && !activePeriod ? (
              <section
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  marginTop: 14,
                  padding: 18,
                }}
              >
                <div style={{ color: C.blue, fontSize: 12, fontWeight: 1000, letterSpacing: 1 }}>
                  PERIOD PLAN
                </div>
                <h2 style={{ fontSize: 28, margin: '5px 0' }}>{selectedPeriod}</h2>
                <p style={{ color: C.gray, fontSize: 15, lineHeight: 1.45, margin: 0 }}>
                  No saved PM3 data for this period yet. Upload this period&apos;s Excel file, assign it
                  to {selectedPeriod}, and build the class plan.
                </p>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

const metricCardStyle = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: 16,
} as const;

const metricLabelStyle = {
  color: C.gray,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
} as const;

const metricValueStyle = {
  color: C.dark,
  fontSize: 28,
  fontWeight: 1000,
  marginTop: 4,
} as const;

const sectionTitleStyle = {
  color: C.gray,
  fontSize: 13,
  fontWeight: 1000,
  letterSpacing: 0.5,
  margin: '0 0 10px',
  textTransform: 'uppercase',
} as const;

const pillStyle = {
  background: '#F8FAFC',
  border: `1px solid ${C.border}`,
  borderRadius: 999,
  color: C.gray,
  fontSize: 12,
  fontWeight: 900,
  padding: '5px 8px',
} as const;

const smallPillStyle = {
  background: '#F8FAFC',
  border: `1px solid ${C.border}`,
  borderRadius: 999,
  color: C.gray,
  fontSize: 11,
  fontWeight: 900,
  padding: '4px 7px',
} as const;

const headerStatPillStyle = {
  background: '#F8FAFC',
  border: `1px solid ${C.border}`,
  borderRadius: 999,
  color: C.dark,
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1,
  padding: '7px 10px',
} as const;

const primaryLinkStyle = {
  alignItems: 'center',
  background: C.blue,
  borderRadius: 6,
  color: C.white,
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 950,
  gap: 6,
  padding: '8px 10px',
  textDecoration: 'none',
} as const;

const secondaryButtonStyle = {
  alignItems: 'center',
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.dark,
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 950,
  gap: 6,
  padding: '8px 10px',
} as const;
