# Pipeline v2 Re-Audit — Tone Misreading Passages

**Date:** April 22, 2026
**Method:** Apply sharpened Q3 accessibility criterion (per criteria_v2) 
to all passages approved in the first-pass tone_misreading review.
**Purpose:** Catch Q3 failures that slipped through on first pass before 
pilot deployment.

## Method

For each approved passage, re-apply the sharpened Q3:

> Can a Title I 9th grader detect this passage's tone using ONLY content 
> present in the passage, plus universal human/social understanding — 
> WITHOUT requiring specific historical, institutional, cultural, or 
> allusive schema?

Three possible verdicts per passage:

- **HOLD** — self-contained, tone accessible, keep approved
- **FLAG** — marginal accessibility, keep approved but note concern for 
  post-pilot review
- **UN-APPROVE** — schema-gate detected that was missed on first pass

## Results

| # | Source | Author | Canonical | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | Pride and Prejudice | Austen | amused | HOLD | Universal social dynamic (flattery met with indifference). Period vocabulary inferable. |
| 2 | The Picture of Dorian Gray | Wilde | admiring | HOLD | Tone accessible at surface; novel-level irony is post-pilot complexity not required. |
| 3 | Adventures of Huckleberry Finn | Twain | detached | HOLD | Biblical allusion present but tone detection does not depend on it. Canonical corrected from dismissive (not in vocab) to detached. |
| 4 | The Adventures of Tom Sawyer | Twain | amused | HOLD on Q3 | Universal kid-dodges-chores dynamic. Pilot-exclusion flag separate (historically problematic racial language). |
| 5 | Sense and Sensibility | Austen | ironic | HOLD | Structurally self-contained; "But" pivot carries tonal work. Would survive period substitution. |
| 6 | Oliver Twist | Dickens | ironic | HOLD | Character-level irony via "industrious" modifier. Period execution context not required. |
| 7 | Emma | Austen | ironic | HOLD | One-word-dependent ("seemed") but word is on the page. Tier 3 precision demand, not schema gate. |
| 8 | Life on the Mississippi | Twain | affectionate | UN-APPROVED | Biographical memoir. Accidentally approved without clinical review. Reject per biography/memoir exclusion. |
| 9 | Persuasion | Austen | ironic | HOLD | Baronetage is named institution but target skill detection does not require knowing its specific function. |
| 10 | David Copperfield | Dickens | ironic | HOLD | Self-deprecating first-person voice. No institutional references. Register shifts on the page. |

## Summary

- **9 of 10 HOLD** after sharpened Q3 application
- **1 UN-APPROVED** (Life on the Mississippi — accidental approval, not a 
  first-pass Q3 failure)
- **0 first-pass Q3 failures detected** — existing clinical judgment was 
  already operating at the right bar before Q3 was formalized

## Dickens Pattern (cross-passage finding)

Dickens appeared 6 times in the tone batch (3 approved, 3 rejected). 
Pattern is clinically clear:

| Mode | Example | Verdict |
|---|---|---|
| Institutional irony | Tale of Two Cities, Bleak House | REJECT (schema) |
| Symbolic description | Christmas Carol | REJECT (no tone) |
| Construct mismatch | Great Expectations | REJECT (mood/characterization) |
| Character-level irony | Oliver Twist | APPROVE |
| First-person self-deprecation | David Copperfield | APPROVE |

**Source strategy note:** Dickens is high-variance for tone_misreading — 
works when operating at character/scene level, fails when operating at 
institutional/symbolic level requiring schema. Consider deprioritized 
sampling cap for Dickens in future runs until filter accessibility 
criterion (Q3) is battle-tested against institutional patterns.

## Tag Prompt Pattern (cross-passage finding)

Tag prompt accuracy in v1 tone run:

- **Correct precise tag:** 8 of 15 (Austen passages consistently, some 
  Twain, some Dickens)
- **Correct but soft tag** (near-miss, needs edit): 1 (Huck Finn amused → 
  detached)
- **Fabricated tag** (no tone present): 2 (Great Expectations amused, 
  Christmas Carol solemn)
- **Correct tag but schema-gated passage:** 2 (Tale of Two Cities 
  ironic, Bleak House mocking)
- **Filtered out for format/biographical reasons:** 2 (Earnest play, 
  Life on the Mississippi memoir)

**Fix shipped in v2:** Null-tone escape hatch at tag stage kills 
fabrication failure mode. Precision requirement language pushes toward 
most-precise canonical vocabulary term rather than safest/most common.

## Clinical Takeaway

First-pass clinical judgment was sound. v2 criterion formalizes what 
Carlos was doing intuitively on rejections (Bleak House, Tale of Two 
Cities). The value of v2 is not overturning past decisions — it is 
(a) preventing schema-gated passages from reaching future review queues, 
and (b) propagating the accessibility criterion to every future 
classification without requiring the reviewer to re-derive it each time.
