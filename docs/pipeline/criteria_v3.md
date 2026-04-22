# GOGI Pipeline Criteria v3 — Evidence Discrimination + Tiered Dosage

**Version:** 3.0
**Effective:** April 22, 2026
**Supersedes:** criteria_v2.md (Q1-Q4 retained, Q5 + tier added)

## Purpose

Pipeline v3 filters passages that support GOGI's evidence-discrimination
content model AND tags them by intervention tier for dosage-calibrated
student progression.

A passage passes filter if it meets all five criteria AND receives a
tier assignment.

## Q1 — Target signal present

Does the passage contain a clear instance of the target cognitive
primitive?

PASS if yes. FAIL if absent or ambiguous.

## Q2 — Signal dominance

Is the target primitive the dominant cognitive work?

PASS if target work is primary. FAIL if subordinate.

## Q3 — Accessibility

Can a Title I 9th grader detect the target using ONLY content on the
page plus universal human understanding?

PASS if self-contained or period-flavored but inferable.
FAIL if schema-gated.

Period-flavored but self-contained (ACCEPT):
- Setting is period but target operates through words on the page
- Period vocabulary resolvable from sentence context

Schema-gated (REJECT):
- Target requires knowing specific institutions
- Target lives in allusions not explained in passage

## Q4 — Clean isolation

Free of harmful language, format issues, competing primitives,
inappropriate content for unmoderated Title I 9th grade deployment.

## Q5 — Item constructability

Does the passage support at least ONE of patterns 5a-5d?

### 5a — Evidence Discrimination (4-option MCQ)
Minimum 4 pointable elements, 1-2 target-supporting, 2-3 non-supporting.

### 5b — Evidence Multi-Select (choose-N from 5-8)
Minimum 6 pointable elements, 3-4 supporting, 3-4 non-supporting.

### 5c — Discrete Concept Identification
Clear dominant concept + 3 plausible misreading distractors.

### 5d — Structural/Craft Analysis
Identifiable craft features at specific nameable locations.

### 5e — Cross-Text Comparative (flag only)
Strong distinctive feature for cross-text pairing.

### Q5 aggregate decision
PASS if supports at least 5a OR 5b OR 5c OR 5d.
FLAG 5e-compatible if strong cross-text potential.
FAIL if passes Q1-Q4 but supports none of 5a-5d → transfer-check
substrate only.

## Tier assignment (NEW)

Every passage that passes Q1-Q5 receives an intervention tier:

### Tier 1 — Foundation (40-150 words, 1 paragraph)
- Maximally accessible, target skill densely concentrated
- Used in Phase 2 "Name the Elements" of teach anatomy
- Primary Q5 patterns: 5a, 5c
- Example: Oliver Twist "industrious" passage

### Tier 2 — Guided Practice (100-300 words, 1-2 paragraphs)
- Target skill dominant but requires sustained reading
- Used in Phase 3 "Pattern Recognition" and early Phase 4
- Primary Q5 patterns: 5a, 5b, 5c
- Example: Two-paragraph characterization passage

### Tier 3 — Independent Practice (200-500 words, 2-3 paragraphs)
- Target skill present but more distributed
- Used in Phase 4 "Run the Move" later cycles
- Primary Q5 patterns: 5a, 5b, 5c, 5d
- Example: Multi-paragraph narrative arc

### Tier 4 — Transfer/Assessment (400-800 words, 3-5 paragraphs)
- Full-passage realistic length matching FAST item format
- Used in Phase 5 "Transfer Check" and diagnostic assessment
- Primary Q5 patterns: 5a, 5b, 5c, 5d, 5e
- Example: Full multi-paragraph excerpt (Ethan Frome opening,
  Dr. Heidegger's opening scene)

Tier is determined by word count primarily, with paragraph count as
secondary criterion, and complexity as tertiary adjustment.

## Decision matrix

| Q1 | Q2 | Q3 | Q4 | Q5 | Tier | Verdict |
|----|----|----|----|----|------|---------|
| pass | pass | pass | pass | pass | assigned | APPROVE — teach-eligible |
| pass | pass | pass | pass | fail | — | FLAG — transfer-check only |
| any fail | — | — | — | — | — | REJECT |

## Change log

- v3 — Added Q5 item constructability + tier-based dosage model
- v2 — Added Q3 accessibility distinction; null escape hatch in tag
- v1 — Initial Q1-Q4 criteria
