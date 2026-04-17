'use client';

import { C, FONTS, POWER_STATEMENTS, type StandardStatus } from '@/lib/constants/design';
import type { SkillGap } from '@/lib/data/getStudentStandardStatus';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StandardTileProps {
  standardId:                  string;   // URL-safe, e.g. 'ELA.9.R.1.1'
  standardCode:                string;   // display, e.g. 'ELA.9.R.1.1'
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
  onCTAClick:                  () => void;
}

// ─── Accent colors per status ─────────────────────────────────────────────────

const ACCENT: Record<StandardStatus, string> = {
  notStarted:     C.border,
  inDiagnostic:   C.blue,
  inIntervention: C.amber,
  mastered:       C.green,
};

const STATUS_LABEL: Record<StandardStatus, string> = {
  notStarted:     'Not Started',
  inDiagnostic:   'In Diagnostic',
  inIntervention: 'In Intervention',
  mastered:       'Mastered',
};

const STATUS_BADGE_BG: Record<StandardStatus, string> = {
  notStarted:     C.light,
  inDiagnostic:   C.blueLight,
  inIntervention: C.amberLight,
  mastered:       C.greenLight,
};

// ─── Intervention plain names ─────────────────────────────────────────────────

const INTERVENTION_LABELS: Record<string, string> = {
  vocabulary_frayer:    'Vocabulary — Frayer Model',
  schema_building:      'Schema — Background Knowledge',
  inferencing_scaffold: 'Inferencing — 3-Step Scaffold',
  evidence_organizer:   'Evidence Organizer',
  synthesis_scaffold:   'Synthesis Scaffold',
  morphology_breakdown: 'Morpheme Breakdown',
  strategy_card:        'Strategy Card',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize:      9,
        fontWeight:    700,
        color:         C.gray,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
        marginBottom:  6,
        marginTop:     14,
      }}
    >
      {children}
    </div>
  );
}

function SkillRow({ gap }: { gap: SkillGap }) {
  const isGap     = gap.status === 'gap';
  const isStrong  = gap.status === 'strong';
  const dotColor  = isStrong ? C.green : isGap ? C.amber : C.gray;
  const pillBg    = isStrong ? C.greenLight  : isGap ? C.amberLight  : C.light;
  const pillText  = isStrong ? C.green : isGap ? C.amber : C.gray;
  const pillLabel = isStrong ? 'Strong' : isGap ? 'Gap' : 'Pending';

  return (
    <div
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         8,
        marginBottom: 5,
      }}
    >
      <div
        style={{
          width:        7,
          height:       7,
          borderRadius: '50%',
          background:   dotColor,
          flexShrink:   0,
        }}
      />
      <span style={{ flex: 1, fontSize: 11, color: C.dark }}>{gap.skill}</span>
      <span
        style={{
          fontSize:     9,
          fontWeight:   700,
          color:        pillText,
          background:   pillBg,
          borderRadius: 10,
          padding:      '2px 7px',
          flexShrink:   0,
        }}
      >
        {pillLabel}
      </span>
    </div>
  );
}

function CTAButton({
  label,
  color,
  onClick,
}: {
  label:   string;
  color:   string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // don't close card when clicking CTA
        onClick();
      }}
      style={{
        width:        '100%',
        background:   color,
        color:        C.white,
        border:       'none',
        borderRadius: 8,
        padding:      '10px 12px',
        fontSize:     13,
        fontWeight:   700,
        cursor:       'pointer',
        fontFamily:   FONTS.ui,
        textAlign:    'center',
        marginTop:    14,
      }}
    >
      {label}
    </button>
  );
}

function SessionDots({
  total,
  filled,
  fillColor = C.green,
}: {
  total:      number;
  filled:     number;
  fillColor?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width:        10,
            height:       10,
            borderRadius: '50%',
            background:   i < filled ? fillColor : 'transparent',
            border:       `1.5px solid ${i < filled ? fillColor : C.border}`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Status-specific dropdown sections ───────────────────────────────────────

function NotStartedDropdown({ onCTAClick }: { onCTAClick: () => void }) {
  const bullets = [
    '10-question diagnostic — about 15 minutes',
    'Your specific skill gaps identified instantly',
    'Personal remediation plan built for you',
    'Work at your own pace across sessions',
  ];
  return (
    <div>
      <SectionLabel>What to expect</SectionLabel>
      {bullets.map((b) => (
        <div
          key={b}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}
        >
          <div
            style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   C.gray,
              marginTop:    4,
              flexShrink:   0,
            }}
          />
          <span style={{ fontSize: 11, color: C.dark, lineHeight: 1.5 }}>{b}</span>
        </div>
      ))}
      <CTAButton label="Start Diagnostic →" color={C.blue} onClick={onCTAClick} />
    </div>
  );
}

function InDiagnosticDropdown({
  diagnosticQuestionsAnswered,
  diagnosticQuestionsTotal,
  skillGaps,
  onCTAClick,
}: Pick<StandardTileProps,
  'diagnosticQuestionsAnswered' | 'diagnosticQuestionsTotal' | 'skillGaps' | 'onCTAClick'>) {
  const pct      = Math.round((diagnosticQuestionsAnswered / Math.max(diagnosticQuestionsTotal, 1)) * 100);
  const remaining = diagnosticQuestionsTotal - diagnosticQuestionsAnswered;
  const nextQ     = diagnosticQuestionsAnswered + 1;

  return (
    <div>
      <SectionLabel>Diagnostic progress</SectionLabel>
      <div
        style={{
          background:   C.light,
          borderRadius: 3,
          height:       6,
          marginBottom: 6,
          overflow:     'hidden',
        }}
      >
        <div
          style={{
            height:     6,
            background: C.blue,
            width:      `${pct}%`,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: C.dark, marginBottom: 2 }}>
        {diagnosticQuestionsAnswered} of {diagnosticQuestionsTotal} questions answered
      </div>
      <div style={{ fontSize: 10, color: C.gray }}>
        {remaining} question{remaining !== 1 ? 's' : ''} remaining
      </div>

      {skillGaps.length > 0 && (
        <>
          <SectionLabel>Skills identified so far</SectionLabel>
          {skillGaps.map((g) => <SkillRow key={g.classification} gap={g} />)}
        </>
      )}

      <CTAButton
        label={`Continue Diagnostic (Q${nextQ} of ${diagnosticQuestionsTotal}) →`}
        color={C.blue}
        onClick={onCTAClick}
      />
    </div>
  );
}

function InInterventionDropdown({
  skillGaps,
  sessionsAttempted,
  sessionsPassed,
  currentIntervention,
  timeSpentMinutes,
  onCTAClick,
}: Pick<StandardTileProps,
  | 'skillGaps' | 'sessionsAttempted' | 'sessionsPassed'
  | 'currentIntervention' | 'timeSpentMinutes' | 'onCTAClick'>) {
  const interventionLabel = currentIntervention
    ? (INTERVENTION_LABELS[currentIntervention] ?? currentIntervention)
    : 'Intervention';

  const ctaLabel =
    sessionsPassed === 0
      ? 'Start Remediation →'
      : `Continue — Session ${sessionsPassed + 1} of 3 →`;

  return (
    <div>
      {/* Diagnostic complete */}
      <SectionLabel>Diagnostic — Complete</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: C.green }}>✓</span>
        <span style={{ fontSize: 11, color: C.dark }}>10 of 10 questions answered</span>
      </div>

      {/* Skill gaps */}
      {skillGaps.length > 0 && (
        <>
          <SectionLabel>Skill gaps identified</SectionLabel>
          {skillGaps.map((g) => <SkillRow key={g.classification} gap={g} />)}
        </>
      )}

      {/* Remediation progress — 9 lesson dots */}
      <SectionLabel>Remediation progress</SectionLabel>
      <SessionDots total={9} filled={Math.min(sessionsAttempted, 9)} />
      <div style={{ fontSize: 10, color: C.gray, marginTop: 5, marginBottom: 8 }}>
        {sessionsAttempted} of 9 lessons
      </div>
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          fontSize:       10,
          color:          C.dark,
        }}
      >
        <span>Current: {interventionLabel}</span>
        {timeSpentMinutes > 0 && <span>{timeSpentMinutes}min total</span>}
      </div>

      {/* Mastery sessions — 3 dots */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: C.gray, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 5 }}>
          SESSIONS TOWARD MASTERY
        </div>
        <SessionDots total={3} filled={sessionsPassed} />
        <div style={{ fontSize: 10, color: C.gray, marginTop: 5 }}>
          {sessionsPassed} of 3 sessions passed
        </div>
      </div>

      <CTAButton label={ctaLabel} color={C.navy} onClick={onCTAClick} />
    </div>
  );
}

function MasteredDropdown({
  standardCode,
  skillGaps,
  timeSpentMinutes,
  lastSessionAt,
  onCTAClick,
}: Pick<StandardTileProps,
  'standardCode' | 'skillGaps' | 'timeSpentMinutes' | 'lastSessionAt' | 'onCTAClick'>) {
  const powerStatement = POWER_STATEMENTS[standardCode] ?? '';
  const masteredDate   = lastSessionAt
    ? new Date(lastSessionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const resolvedGaps = skillGaps.length > 0
    ? skillGaps.map((g) => ({ ...g, status: 'strong' as const }))
    : [];

  return (
    <div>
      {/* Diagnostic complete */}
      <SectionLabel>Diagnostic — Complete</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: C.green }}>✓</span>
        <span style={{ fontSize: 11, color: C.dark }}>10 of 10 answered</span>
      </div>

      {/* All gaps resolved */}
      {resolvedGaps.length > 0 && (
        <>
          <SectionLabel>All gaps resolved</SectionLabel>
          {resolvedGaps.map((g) => <SkillRow key={g.classification} gap={g} />)}
        </>
      )}

      {/* Mastery confirmed */}
      <SectionLabel>Mastery confirmed</SectionLabel>
      <SessionDots total={3} filled={3} />
      <div style={{ fontSize: 11, color: C.dark, marginTop: 5 }}>
        3 of 3 sessions — Mastered
      </div>
      {masteredDate && (
        <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>
          Confirmed {masteredDate}
          {timeSpentMinutes > 0 ? `  ·  ${timeSpentMinutes}min invested` : ''}
        </div>
      )}

      {/* Power statement */}
      {powerStatement && (
        <div
          style={{
            marginTop:    12,
            fontSize:     11,
            color:        C.navy,
            fontStyle:    'italic',
            lineHeight:   1.6,
            borderLeft:   `2px solid ${C.green}`,
            paddingLeft:  10,
          }}
        >
          {powerStatement}
        </div>
      )}

      <CTAButton label="Review →" color={C.green} onClick={onCTAClick} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StandardTile({
  standardId,
  standardCode,
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
  isOpen,
  onToggle,
  onCTAClick,
}: StandardTileProps) {
  const accent  = ACCENT[status];
  const badgeBg = STATUS_BADGE_BG[status];
  const label   = STATUS_LABEL[status];

  return (
    <div
      onClick={onToggle}
      style={{
        background:    C.white,
        border:        `0.5px solid ${C.border}`,
        borderLeft:    `3px solid ${accent}`,
        borderRadius:  10,
        overflow:      'hidden',
        cursor:        'pointer',
        fontFamily:    FONTS.ui,
        transition:    'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* ── Card header (always visible) ────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 14px 10px',
        }}
      >
        {/* Left: code + title */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize:      10,
              fontWeight:    700,
              color:         accent,
              letterSpacing: 0.5,
              lineHeight:    1.3,
            }}
          >
            {standardCode}
          </div>
          <div
            style={{
              fontSize:   13,
              fontWeight: 700,
              color:      C.dark,
              marginTop:  3,
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
        </div>

        {/* Right: badge + chevron */}
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        6,
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              background:   badgeBg,
              border:       `1px solid ${accent}`,
              borderRadius: 20,
              padding:      '3px 8px',
              fontSize:     9,
              fontWeight:   700,
              color:        accent,
              whiteSpace:   'nowrap',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize:   12,
              color:      C.gray,
              transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              display:    'inline-block',
              lineHeight: 1,
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* ── Dropdown content ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()} // prevent toggle when interacting inside
          style={{
            padding:    '0 14px 14px',
            borderTop:  `0.5px solid ${C.border}`,
          }}
        >
          {status === 'notStarted' && (
            <NotStartedDropdown onCTAClick={onCTAClick} />
          )}
          {status === 'inDiagnostic' && (
            <InDiagnosticDropdown
              diagnosticQuestionsAnswered={diagnosticQuestionsAnswered}
              diagnosticQuestionsTotal={diagnosticQuestionsTotal}
              skillGaps={skillGaps}
              onCTAClick={onCTAClick}
            />
          )}
          {status === 'inIntervention' && (
            <InInterventionDropdown
              skillGaps={skillGaps}
              sessionsAttempted={sessionsAttempted}
              sessionsPassed={sessionsPassed}
              currentIntervention={currentIntervention}
              timeSpentMinutes={timeSpentMinutes}
              onCTAClick={onCTAClick}
            />
          )}
          {status === 'mastered' && (
            <MasteredDropdown
              standardCode={standardCode}
              skillGaps={skillGaps}
              timeSpentMinutes={timeSpentMinutes}
              lastSessionAt={lastSessionAt}
              onCTAClick={onCTAClick}
            />
          )}
        </div>
      )}
    </div>
  );
}
