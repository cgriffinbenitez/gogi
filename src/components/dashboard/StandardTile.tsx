'use client';

import { useRouter } from 'next/navigation';
import { C, FONTS, type StandardStatus } from '@/lib/constants/design';
import type { SkillGap } from '@/lib/data/getStudentStandardStatus';

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_DISPLAY_NAMES: Record<string, string> = {
  '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e': 'Literary Elements & Layers of Meaning',
  'e9bd1f36-5bab-4dbf-ac57-132c55dd439c': 'Universal Themes in Literary Texts',
  '595a9506-5cf6-4e5a-8e8d-74473fed3fe8': 'Text Structure and Purpose',
};

const GAP_DISPLAY_NAMES: Record<string, string> = {
  vocabulary_gap:                    'Vocabulary & Word Meaning',
  figurative_language_failure:       'Figurative Language',
  mood_misreading:                   'Mood Identification',
  tone_misreading:                   "Tone & Author's Attitude",
  inferencing_literal:               'Reading Between the Lines',
  inferencing_schema:                'Connecting Text to World',
  inferencing_wm:                    'Tracking Ideas Across Text',
  evidence_retrieval_failure:        'Finding Text Evidence',
  comprehension_integration_failure: 'Synthesizing Meaning',
  no_metacognitive_strategy:         'Reading Strategy',
  morphology_gap:                    'Word Structure',
  syntax_barrier:                    'Sentence Structure',
  topic_vs_theme_confusion:          'Theme vs Topic',
  structure_purpose_disconnect:      'Structure & Purpose',
};

const GOGI_MESSAGES: Record<string, string> = {
  notStarted:     'Complete your Reading Profile first — it helps me understand exactly how to support you on this standard.',
  inDiagnostic:   'Time to find out exactly where to focus. The diagnostic takes about 15 minutes.',
  inIntervention: "Diagnostic complete. I found your gaps. Your first intervention is ready — let's get to work.",
  practicing:     'New passage, same skill. Each session makes it stronger.',
  gap_complete:   'First gap addressed. Loading your next intervention now.',
  mastered:       "You did it. That skill is yours now — no one can take it from you.",
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StandardTileProps {
  standardId:                  string;   // URL-safe code, e.g. 'ELA.9.R.1.1'
  standardCode:                string;
  standardUuid?:               string;   // DB UUID for display name lookup
  title:                       string;
  status:                      StandardStatus;
  sessionsPassed:              number;
  sessionsAttempted:           number;
  currentIntervention:         string | null;
  diagnosticQuestionsAnswered: number;
  diagnosticQuestionsTotal:    number;
  timeSpentMinutes:            number;
  skillGaps:                   SkillGap[];
  lastSessionAt:               string | null;
  currentStatus:               string;
  isOpen:                      boolean;
  onToggle:                    () => void;
  onCTAClick?:                 () => void;   // kept for compat; tile routes internally
  vocabCheckComplete?:         boolean;
  vocabCoverageScore?:         number | null;
  // Sprint 3 — gap journey
  gapsIdentified?:             string[];
  gapsAddressed?:              string[];
  currentGap?:                 string | null;
  profileComplete?:            boolean;
}

// ─── Step state type ──────────────────────────────────────────────────────────

type StepState = 'complete' | 'active' | 'pending' | 'locked';

// ─── Progress calculator ──────────────────────────────────────────────────────

function computeProgress({
  profileComplete,
  vocabCheckComplete,
  diagnosticDone,
  gapsIdentified,
  gapsAddressed,
  status,
}: {
  profileComplete:    boolean;
  vocabCheckComplete: boolean;
  diagnosticDone:     boolean;
  gapsIdentified:     string[];
  gapsAddressed:      string[];
  status:             StandardStatus;
}): number {
  if (status === 'mastered') return 100;
  const setupDone = [profileComplete, vocabCheckComplete, diagnosticDone].filter(Boolean).length;
  const setupPct  = (setupDone / 3) * 25;
  const totalGaps = gapsIdentified.length;
  const gapPct    = totalGaps > 0 ? (gapsAddressed.length / totalGaps) * 70 : 0;
  return Math.round(Math.min(setupPct + gapPct, 95));
}

// ─── "Next step" label ────────────────────────────────────────────────────────

function getNextStepLabel(
  status:             StandardStatus,
  profileComplete:    boolean,
  vocabCheckComplete: boolean,
  isPracticing:       boolean,
  sessionsPassed:     number,
  currentGap:         string | null,
): string {
  if (status === 'mastered') return 'Mastered ✓';
  if (!profileComplete) return 'Reading Profile';
  if (!vocabCheckComplete) return 'Vocabulary Check';
  if (status === 'notStarted' || status === 'inDiagnostic') return 'Diagnostic';
  if (status === 'inIntervention') {
    if (!isPracticing) {
      const gapName = currentGap ? (GAP_DISPLAY_NAMES[currentGap] ?? currentGap) : 'Intervention';
      return `Intervention — ${gapName}`;
    }
    return `Practice Session ${sessionsPassed + 1}`;
  }
  return 'Next Step';
}

// ─── Journey step ─────────────────────────────────────────────────────────────

function JourneyStep({
  state,
  stepNum,
  name,
  sub,
  isLast,
}: {
  state:   StepState;
  stepNum: number;
  name:    string;
  sub:     string;
  isLast:  boolean;
}) {
  const isComplete = state === 'complete';
  const isActive   = state === 'active';
  const isLocked   = state === 'locked';

  const circleStyle: React.CSSProperties = {
    width:          24,
    height:         24,
    borderRadius:   '50%',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       isLocked ? 10 : 11,
    fontWeight:     700,
    flexShrink:     0,
    position:       'relative',
    zIndex:         1,
    ...(isComplete ? {
      background: '#C6EFCE',
      border:     '1.5px solid #3B6D11',
      color:      '#27500A',
    } : isActive ? {
      background: '#E6F1FB',
      border:     '2px solid #2E75B6',
      color:      '#2E75B6',
      animation:  'tile-pulse 2s infinite',
    } : {
      background: '#F8F8F8',
      border:     '1.5px solid #E0E0E0',
      color:      '#CCCCCC',
    }),
  };

  const nameColor  = isComplete ? '#3B6D11' : isActive ? '#2E75B6' : '#CCCCCC';
  const subColor   = isComplete ? '#3B6D11' : isActive ? '#2E75B6' : '#E0E0E0';
  const badgeBg    = isComplete ? '#C6EFCE' : isActive ? '#E6F1FB' : '#F2F2F2';
  const badgeColor = isComplete ? '#27500A' : isActive ? '#2E75B6' : '#CCCCCC';
  const badgeText  = isComplete ? '✓' : isActive ? 'Now' : '—';

  let circleContent: string;
  if (isLocked) circleContent = '🔒';
  else if (isComplete) circleContent = '✓';
  else if (isActive) circleContent = '→';
  else circleContent = String(stepNum);

  const connectorColor = isComplete ? '#C6EFCE' : '#E6E6E6';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative', paddingBottom: isLast ? 0 : 22 }}>
      {/* Connector line to next step */}
      {!isLast && (
        <div style={{
          position:   'absolute',
          left:       11,
          top:        26,
          width:      2,
          height:     18,
          background: connectorColor,
        }} />
      )}
      {/* Circle */}
      <div style={circleStyle}>{circleContent}</div>
      {/* Text + badge */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize:   11,
            fontWeight: (isComplete || isActive) ? 700 : 400,
            color:      nameColor,
            lineHeight: 1.3,
          }}>
            {name}
          </span>
          <span style={{
            fontSize:     9,
            fontWeight:   700,
            background:   badgeBg,
            color:        badgeColor,
            borderRadius: 10,
            padding:      '1px 6px',
            flexShrink:   0,
          }}>
            {badgeText}
          </span>
        </div>
        <div style={{ fontSize: 10, color: subColor, marginTop: 2, lineHeight: 1.3 }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── Journey tracker ──────────────────────────────────────────────────────────

function JourneyTracker({
  status,
  profileComplete,
  vocabCheckComplete,
  gapsIdentified,
  gapsAddressed,
  currentGap,
  sessionsPassed,
  isPracticing,
  allGapsDone,
}: {
  status:             StandardStatus;
  profileComplete:    boolean;
  vocabCheckComplete: boolean;
  gapsIdentified:     string[];
  gapsAddressed:      string[];
  currentGap:         string | null;
  sessionsPassed:     number;
  isPracticing:       boolean;
  allGapsDone:        boolean;
}) {
  const diagnosticDone = status !== 'notStarted' && status !== 'inDiagnostic';

  // ── Setup step states ──────────────────────────────────────────────────────

  function setupState(idx: number): StepState {
    const done = [profileComplete, vocabCheckComplete, diagnosticDone];
    if (done[idx]) return 'complete';
    const allPrevDone = done.slice(0, idx).every(Boolean);
    return allPrevDone ? 'active' : 'pending';
  }

  // ── Gap step states ────────────────────────────────────────────────────────
  // stepIdx: 0=Intervention, 1=Practice1, 2=Practice2, 3=Practice3

  function gapState(gapCode: string, stepIdx: number): StepState {
    const isAddressed = gapsAddressed.includes(gapCode);
    const isCurrent   = gapCode === currentGap;

    if (isAddressed) return 'complete'; // entire gap cycle complete

    if (!isCurrent) return 'locked'; // future gap

    if (status !== 'inIntervention') return 'locked';

    if (stepIdx === 0) {
      // Intervention step: active until student enters practice
      return isPracticing ? 'complete' : 'active';
    }

    // Practice steps: stepIdx 1/2/3 require sessionsPassed >= stepIdx
    if (sessionsPassed >= stepIdx) return 'complete';
    if (sessionsPassed === stepIdx - 1) return isPracticing ? 'active' : 'pending';
    return 'pending';
  }

  // Phase label style
  const phaseLabel: React.CSSProperties = {
    fontSize:      8,
    fontWeight:    700,
    color:         '#CCCCCC',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding:       '6px 0 4px 34px',
  };

  const showCompletion = gapsIdentified.length === 0 || allGapsDone || status === 'mastered';

  return (
    <div>
      {/* Tracker heading */}
      <div style={{
        fontSize:      9,
        fontWeight:    700,
        color:         C.gray,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
        marginBottom:  10,
      }}>
        YOUR JOURNEY TO MASTERY
      </div>

      {/* ── Phase 1: Setup ─────────────────────────────────────────────────── */}
      <div style={phaseLabel}>SETUP</div>
      <JourneyStep state={setupState(0)} stepNum={1} name="Reading Profile"   sub="Understand how you learn"   isLast={false} />
      <JourneyStep state={setupState(1)} stepNum={2} name="Vocabulary Check"  sub="Preview key passage words"  isLast={false} />
      <JourneyStep state={setupState(2)} stepNum={3} name="Diagnostic"        sub="Identify your skill gaps"   isLast={false} />

      {/* ── Phase 2: Gap cycles ────────────────────────────────────────────── */}
      {gapsIdentified.map((gap, gapIdx) => {
        const isAddressed = gapsAddressed.includes(gap);
        const isCurrent   = gap === currentGap;
        const showFull    = isAddressed || isCurrent;
        const gapName     = GAP_DISPLAY_NAMES[gap] ?? gap;
        const cycleNum    = gapIdx + 1;
        const totalCycles = gapsIdentified.length;

        if (!showFull) {
          // Future gap — single locked row
          return (
            <div key={gap}>
              <div style={phaseLabel}>
                INTERVENTION {cycleNum} of {totalCycles} — {gapName}
              </div>
              <JourneyStep
                state="locked"
                stepNum={0}
                name={`Intervention ${cycleNum}: ${gapName}`}
                sub="Unlocks after current intervention"
                isLast={false}
              />
            </div>
          );
        }

        return (
          <div key={gap}>
            <div style={phaseLabel}>
              INTERVENTION {cycleNum} of {totalCycles} — {gapName}
            </div>
            <JourneyStep state={gapState(gap, 0)} stepNum={1} name={`Intervention — ${gapName}`} sub="Targeted support"         isLast={false} />
            <JourneyStep state={gapState(gap, 1)} stepNum={2} name="Practice — Session 1"         sub="New passage, same skill"  isLast={false} />
            <JourneyStep state={gapState(gap, 2)} stepNum={3} name="Practice — Session 2"         sub="Strengthen it"            isLast={false} />
            <JourneyStep state={gapState(gap, 3)} stepNum={4} name="Practice — Session 3"         sub="Confirm mastery"          isLast={false} />
          </div>
        );
      })}

      {/* ── Phase 3: Completion ────────────────────────────────────────────── */}
      <div style={phaseLabel}>COMPLETION</div>
      <JourneyStep
        state={status === 'mastered' ? 'complete' : showCompletion ? 'active' : 'locked'}
        stepNum={1}
        name="Exit Assessment"
        sub="Prove your growth"
        isLast={true}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StandardTile({
  standardId,
  standardCode,
  standardUuid    = '',
  title,
  status,
  sessionsPassed,
  sessionsAttempted,
  currentIntervention,
  diagnosticQuestionsAnswered,
  diagnosticQuestionsTotal,
  timeSpentMinutes,
  skillGaps,
  lastSessionAt,
  currentStatus,
  isOpen,
  onToggle,
  onCTAClick,
  vocabCheckComplete  = false,
  vocabCoverageScore  = null,
  gapsIdentified      = [],
  gapsAddressed       = [],
  currentGap          = null,
  profileComplete     = false,
}: StandardTileProps) {
  // Suppress unused-var warnings for props kept for backward compat
  void currentIntervention; void timeSpentMinutes; void skillGaps;
  void lastSessionAt; void currentStatus; void vocabCoverageScore; void onCTAClick;

  const router       = useRouter();
  const displayName  = STANDARD_DISPLAY_NAMES[standardUuid] ?? title;
  const diagnosticDone = status !== 'notStarted' && status !== 'inDiagnostic';
  const allGapsDone    = gapsIdentified.length > 0 && gapsAddressed.length >= gapsIdentified.length;
  // "practicing" = has had at least one practice session evaluated
  const isPracticing   = sessionsAttempted > 0 && status === 'inIntervention';

  // ── Section A: badge ───────────────────────────────────────────────────────

  const BORDER_COLOR: Record<StandardStatus, string> = {
    notStarted:     '#CCCCCC',
    inDiagnostic:   '#2E75B6',
    inIntervention: '#BA7517',
    mastered:       '#3B6D11',
  };
  const borderColor = BORDER_COLOR[status];

  function getBadge(): { text: string; bg: string; color: string } {
    switch (status) {
      case 'notStarted':    return { text: 'Not Started',    bg: '#F2F2F2', color: '#888780' };
      case 'inDiagnostic':  return { text: 'In Diagnostic',  bg: '#E6F1FB', color: '#2E75B6' };
      case 'inIntervention':
        return isPracticing
          ? { text: `Session ${sessionsPassed + 1} of 3`, bg: '#FAEEDA', color: '#BA7517' }
          : { text: 'Intervention',                        bg: '#FAEEDA', color: '#BA7517' };
      case 'mastered':      return { text: '✓ Mastered',     bg: '#C6EFCE', color: '#27500A' };
    }
  }
  const badge = getBadge();

  // ── Section B: progress ────────────────────────────────────────────────────

  const progressPct = computeProgress({
    profileComplete,
    vocabCheckComplete,
    diagnosticDone,
    gapsIdentified,
    gapsAddressed,
    status,
  });

  const nextStep = getNextStepLabel(
    status, profileComplete, vocabCheckComplete, isPracticing,
    sessionsPassed, currentGap,
  );

  // ── Section B2: CTA ────────────────────────────────────────────────────────

  function getCTA(): { label: string; route: string } {
    switch (status) {
      case 'notStarted':
        if (!profileComplete)     return { label: 'Start Reading Profile →',   route: '/profile/reading' };
        if (!vocabCheckComplete)  return { label: 'Start Vocabulary Check →',  route: `/standard/${standardId}/vocab-check` };
        return                           { label: 'Start Diagnostic →',        route: `/standard/${standardId}/diagnostic` };
      case 'inDiagnostic': {
        const qNum = Math.min(diagnosticQuestionsAnswered + 1, diagnosticQuestionsTotal);
        return { label: `Continue Diagnostic (Q${qNum} of ${diagnosticQuestionsTotal}) →`, route: `/standard/${standardId}/diagnostic` };
      }
      case 'inIntervention':
        return isPracticing
          ? { label: `Continue — Session ${sessionsPassed + 1} of 3 →`, route: `/standard/${standardId}/practice` }
          : { label: 'Begin Intervention →',                             route: `/standard/${standardId}/intervention`   };
      case 'mastered':
        return { label: 'View My Growth →', route: `/standard/${standardId}/mastery` };
    }
  }
  const cta = getCTA();

  // ── Section C gogi message key ─────────────────────────────────────────────

  function gogiKey(): string {
    if (status === 'mastered')       return 'mastered';
    if (status === 'inIntervention') return isPracticing ? 'practicing' : 'inIntervention';
    return status;
  }
  const gogiMsg = GOGI_MESSAGES[gogiKey()] ?? '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes tile-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(46,117,182,0.3); }
          70%  { box-shadow: 0 0 0 6px rgba(46,117,182,0);   }
          100% { box-shadow: 0 0 0 0   rgba(46,117,182,0);   }
        }
      `}</style>

      <div
        style={{
          background:   C.white,
          border:       `0.5px solid ${C.border}`,
          borderLeft:   `3px solid ${borderColor}`,
          borderRadius: 10,
          overflow:     'hidden',
          fontFamily:   FONTS.ui,
        }}
      >

        {/* ── Section A: Card header (always visible) ──────────────────────── */}
        <div
          onClick={onToggle}
          style={{
            padding:        '12px 16px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            cursor:         'pointer',
            userSelect:     'none',
          }}
        >
          {/* Left: code + title */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: borderColor, letterSpacing: 0.5 }}>
              {standardCode}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginTop: 2, lineHeight: 1.3 }}>
              {displayName}
            </div>
          </div>
          {/* Right: badge + chevron */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, flexShrink: 0 }}>
            <span style={{
              background:   badge.bg,
              color:        badge.color,
              borderRadius: 20,
              padding:      '3px 8px',
              fontSize:     9,
              fontWeight:   700,
              whiteSpace:   'nowrap',
            }}>
              {badge.text}
            </span>
            <span style={{
              fontSize:   12,
              color:      '#888780',
              transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              display:    'inline-block',
              lineHeight: 1,
            }}>
              ▾
            </span>
          </div>
        </div>

        {/* ── Section B: Status bar (always visible) ───────────────────────── */}
        <div style={{
          borderTop:      '1px solid #F8F8F8',
          padding:        '8px 16px 0',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 11, color: '#2C2C2A' }}>
            Next: <strong style={{ color: '#2E75B6' }}>{nextStep}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 80, height: 4, background: '#F2F2F2', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height:     4,
                background: '#2E75B6',
                width:      `${progressPct}%`,
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 9, color: '#888780' }}>{progressPct}%</span>
          </div>
        </div>

        {/* ── Section B2: CTA button (always visible) ──────────────────────── */}
        <div style={{ padding: '8px 16px 12px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(cta.route);
            }}
            style={{
              background:   '#1F4E79',
              color:        C.white,
              border:       'none',
              borderRadius: 8,
              padding:      '11px 16px',
              fontSize:     13,
              fontWeight:   700,
              width:        '100%',
              cursor:       'pointer',
              fontFamily:   FONTS.ui,
              textAlign:    'center',
            }}
          >
            {cta.label}
          </button>
        </div>

        {/* ── Section C: Expandable body ───────────────────────────────────── */}
        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ borderTop: '1px solid #F2F2F2', padding: '14px 16px' }}
          >
            {/* Gogi message */}
            <div style={{
              display:      'flex',
              gap:          10,
              alignItems:   'flex-start',
              background:   '#F8F8F8',
              borderRadius: 8,
              padding:      '10px 12px',
              marginBottom: 14,
            }}>
              <div style={{
                width:          30,
                height:         30,
                borderRadius:   '50%',
                background:     '#1F4E79',
                color:          C.white,
                fontSize:       11,
                fontWeight:     700,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
              }}>
                G
              </div>
              <div style={{ fontSize: 12, color: '#2C2C2A', lineHeight: 1.5 }}>
                {gogiMsg}
              </div>
            </div>

            {/* Journey tracker */}
            <JourneyTracker
              status={status}
              profileComplete={profileComplete}
              vocabCheckComplete={vocabCheckComplete}
              gapsIdentified={gapsIdentified}
              gapsAddressed={gapsAddressed}
              currentGap={currentGap}
              sessionsPassed={sessionsPassed}
              isPracticing={isPracticing}
              allGapsDone={allGapsDone}
            />
          </div>
        )}
      </div>
    </>
  );
}
