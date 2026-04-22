# Pipeline Known Bugs

---

### Review CLI — reviewed_at not written on reject

**Surfaced:** April 22, 2026 during tone_misreading review audit
**Severity:** Low (data integrity, not functional)
**Location:** `src/pipeline/review-cli.ts` — `doReject()` function (line 156)

The review CLI writes `rejection_reason` on reject but does not write
`reviewed_at`. Only approvals trigger `reviewed_at` updates. Results in
rejected rows with `null` reviewed_at, requiring manual backfill.

**Fix:** Update `doReject()` to set `reviewed_at = new Date().toISOString()`
alongside `rejection_reason`:

```ts
async function doReject(supabase, id) {
  const reason = await prompt('  Rejection reason: ');
  await supabase
    .from('intervention_passages')
    .update({ rejection_reason: reason, reviewed_at: new Date().toISOString() })
    .eq('id', id);
}
```

**Workaround applied:** Manual PATCH backfill on 4 tone_misreading rows
(2026-04-22T11:50:33).

**Timeline:** Week 13-14 bug fix window (non-blocking for pilot).
