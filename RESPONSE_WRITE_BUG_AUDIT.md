# RESPONSE WRITE BUG AUDIT
Date: 2026-04-19  
Scope: Read-only investigation — no files modified

---

## Summary

Every diagnostic session writes zero rows to `responses`. Root cause is most likely a missing RLS INSERT policy on the `responses` table (see Finding 3). A secondary compounding issue is that the diagnostic page never checks the HTTP response from the API route, so any server-side failure is silently swallowed (Finding 1B).

---

## Finding 1 — Diagnostic page: the response-write code path

**File**: `src/app/standard/[standardId]/diagnostic/page.tsx`

### 1A. Full call chain from click to fetch

```
Student clicks answer option
  → handleSelect(letter)  [line 377]
    → if (locked || selectedLetter) return   ← Guard: prevents double-click
    → setSelectedLetter(letter); setLocked(true)
    → setTimeout(async () => {               ← 1500ms delay
        if (sessionId && studentId && standardUuid) {   ← Guard: all three must be truthy
          try {
            console.log('[Diagnostic] writing response...')
            await fetch('/api/responses/create', { method: 'POST', body: ... })
            // ← FETCH RESPONSE NEVER CHECKED
          } catch (err) {
            console.error('[DiagnosticPage] response write error:', err)
            // ← Only fires on network-level error (DNS/TCP), NOT on HTTP 4xx/5xx
          }
        }
        // navigation logic runs regardless of whether write succeeded
      }, 1500)
```

### 1B. The gate condition — `if (sessionId && studentId && standardUuid)`

All three are React state strings. They default to `''`. They are set during `init()`:

**`studentId`** — set at line 207–208:
```typescript
const resolvedStudentId = student?.id ?? '';
setStudentId(resolvedStudentId);
```
If the `students` table query returns no row (student record missing, or RLS blocks the SELECT), `resolvedStudentId` = `''`. Gate fails.

**`sessionId`** — set inside a conditional block at lines 240–252:
```typescript
if (resolvedStudentId) {               // ← only enters if studentId is non-empty
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .insert(...)
    .select('id')
    .single();
  if (sessErr) {
    console.error('[DiagnosticPage] step 4 ERROR — session insert:', sessErr.message);
    // resolvedSessionId stays '' — no throw, no view change, init continues
  } else {
    resolvedSessionId = session?.id ?? '';
  }
}
setSessionId(resolvedSessionId);
```
If `resolvedStudentId` is empty, the session is never created and `sessionId` stays `''`. Gate fails.
If the session insert itself fails (e.g. RLS blocks it), `sessErr` is logged but the code continues — `sessionId` stays `''`. Gate fails.

**`standardUuid`** — set at line 224 from `standard.id`. Should be non-empty if init reaches this point without throwing.

### 1C. The silent failure

The `await fetch(...)` call (lines 389–396) returns a `Response` object. This response is **never read**:
- No `res.ok` check
- No `await res.json()`
- No status code check

A 401 (Unauthorized), 400 (bad request), 403 (RLS block returning as 500), or 500 (insert error) from the server are all indistinguishable from success from the client's perspective. The `catch` block only catches network-level failures (connection refused, DNS failure, etc.). An HTTP error response is not a thrown exception in the Fetch API.

---

## Finding 2 — API route: `POST /api/responses/create`

**File**: `src/app/api/responses/create/route.ts`

### What it expects in the body

```typescript
{
  session_id,              // required — 400 if missing
  question_id,             // optional — null if missing
  student_id,              // required — 400 if missing
  standard_id,             // required — 400 if missing
  cognitive_skill_targeted,
  diagnostic_classification,
  intervention_type,
  intervention_content,
  student_response,
  mastery_achieved,        // defaults to false
  attempt_number,          // defaults to 1
}
```

### What it does with session_id

`session_id` is passed directly into the INSERT. It is **not validated against the authenticated user** — the route only checks that `user` is non-null (line 35–37). There is no check that `session_id` belongs to the authenticated student. This is not the bug, but it is an authorization gap.

### Auth check

```typescript
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

`createServerSupabaseClient()` reads auth from request cookies. This works correctly for same-origin fetch calls from authenticated browser sessions. The anon key is used — writes go through RLS.

### What it writes

```typescript
await supabase
  .from('responses')
  .insert({ session_id, question_id, student_id, standard_id, ... })
  .select('id')
  .single();
```

Insert uses the **anon key** (not service_role). This means RLS is enforced. If no INSERT policy exists on `responses`, this insert fails.

### Error handling

```typescript
if (error) {
  console.error('[api/responses/create] insert error:', error.message);
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

The error IS logged server-side and the route returns a 500 with the error message. But as shown in Finding 1C, the client never reads this response, so the error is invisible to the diagnostic page.

---

## Finding 3 — RLS policies on the `responses` table

**Files searched**: All 10 files in `supabase/migrations/`

### Result: Zero RLS policies exist for the `responses` table

No migration contains any of the following for `responses`:
- `CREATE POLICY`
- `ENABLE ROW LEVEL SECURITY`
- `ALTER TABLE responses`

### What policies DO exist (across all migrations)

| Table | Policy | Type | Migration file |
|---|---|---|---|
| `cognitive_profiles` | `"students read own profile"` | SELECT | sprint_k_reading_profile.sql |
| `cognitive_profiles` | `"teachers read own students profiles"` | SELECT | fix_teacher_rls_cog_vocab.sql |
| `vocab_readiness` | `"students read own vocab readiness"` | SELECT | sprint_l_vocab_check.sql |
| `vocab_readiness` | `"teachers read own students vocab readiness"` | SELECT | fix_teacher_rls_cog_vocab.sql |

These are the only four policies defined in any migration. No INSERT policy on `responses`. No SELECT policy on `responses`. No reference to `responses` in any policy context at all.

### Implication

If RLS is enabled on the `responses` table in Supabase (which is the Supabase default for new tables in projects with RLS turned on, and is strongly implied by the patterns across this codebase), then:

- **No INSERT policy = all inserts blocked**
- **No SELECT policy = all selects blocked**

This would explain both why writes produce zero rows and why `classifySession` reads back zero rows even if somehow a write succeeded.

Evidence that RLS is actively being used everywhere else:
- `20260418_reading_profile_complete_trigger.sql` explicitly states: "students have no RLS UPDATE policy on the students table (by design)"
- The `fix_teacher_rls_cog_vocab.sql` migration exists specifically to debug a broken RLS policy
- All student-owned tables (cognitive_profiles, vocab_readiness) have student-scoped SELECT policies

The `responses` table was almost certainly created with RLS enabled but never received any policies.

---

## Finding 4 — Supabase client initialization

### Client-side (`src/lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Uses `createBrowserClient` from `@supabase/ssr`. This correctly reads and stores auth tokens in browser cookies. Auth context is attached — authenticated student's JWT is used for all calls. RLS applies. No issue here.

### Server-side (`src/lib/supabase/server.ts`)

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(...) { ... } } }
  );
}
```

Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`, NOT `SUPABASE_SERVICE_ROLE_KEY`. Reads auth from cookies. This is correct for a server component reading the student's session. BUT: because it uses the anon key, all database operations in the API route run under the authenticated student's identity and are subject to RLS.

If a service_role key were used instead, RLS would be bypassed entirely. The route intentionally does NOT do this — it validates `auth.getUser()` and expects RLS to enforce ownership. But RLS can only enforce what policies exist. If there are no policies on `responses`, every insert fails.

### No anon/unauthenticated writes possible

The fetch call from the browser includes cookies by default (same-origin). The student is authenticated via Supabase session cookie. The server client correctly reconstructs the auth session from those cookies. Writes are not happening with an unauthenticated anon key — the student IS authenticated. The problem is the absence of a policy allowing that authenticated student to INSERT.

---

## Finding 5 — Console.log / console.error along the write path

### Client-side (diagnostic page)

| Location | Statement | When it fires |
|---|---|---|
| `page.tsx:188` | `console.log('[DiagnosticPage] init starting for user:', user.id, ...)` | On every init |
| `page.tsx:206` | `console.error('[DiagnosticPage] step 1 ERROR:', sErr.message)` | Student record query fails |
| `page.tsx:216` | `console.error('[DiagnosticPage] step 2 ERROR:', stdErr.message)` | Standard query fails |
| `page.tsx:247` | `console.error('[DiagnosticPage] step 4 ERROR — session insert:', sessErr.message)` | Session insert fails |
| `page.tsx:261` | `console.error('[DiagnosticPage] step 5 ERROR:', qErr.message)` | Question fetch fails |
| `page.tsx:387` | `console.log('[Diagnostic] writing response — question_id:', ...)` | Fires just before fetch (only if gate passes) |
| `page.tsx:403` | `console.error('[DiagnosticPage] response write error:', err)` | Network-level failure only |

**Diagnostic**: If `'[Diagnostic] writing response'` never appears in the browser console, the gate (`sessionId && studentId && standardUuid`) is failing. If it appears but responses table is still empty, the server is rejecting the write silently.

### Server-side (API route — visible in Next.js server logs, not browser console)

| Location | Statement | When it fires |
|---|---|---|
| `route.ts:58` | `console.error('[api/responses/create] insert error:', error.message)` | Supabase insert rejected (including RLS block) |
| `route.ts:64` | `console.error('[api/responses/create] unexpected error:', err)` | Thrown exception |

**Diagnostic**: The RLS error message from Supabase would appear here. It would look like: `new row violates row-level security policy for table "responses"`. This is only visible in the Next.js server process logs (terminal running `next dev`), not in the browser DevTools console.

### classifySession

| Location | Statement | When it fires |
|---|---|---|
| `classifySession.ts:66` | `console.error('[classifySession] response query failed:', error.message)` | SELECT on responses fails (e.g. RLS blocks read) |
| `classifySession.ts:77-79` | `console.log('[classifySession] sessionId=... total=0 correct=0')` | Always fires — `total=0` is the smoking gun |
| `classifySession.ts:98-100` | `console.log('[classifySession] SKIP TEACH — ...')` | Fires if correctCount >= 8 |
| `classifySession.ts:143-146` | `console.log('[classifySession] dominant=... allGaps=...')` | Normal path — fires with default dominant |

**Diagnostic**: `total=0` in the `[classifySession]` log line is the confirming signal. Also: if RLS blocks the SELECT on `responses`, `[classifySession] response query failed:` would appear — but note `responseRows ?? []` means it silently returns an empty array on error, still producing `total=0`.

---

## Cascade Effect

When `responses` has zero rows:

1. `classifySession` reads back 0 rows
2. `total = 0`, `correctCount = 0`
3. Does not hit `skipTeach` path (0 < 8)
4. `counts = {}` — no classifications to tally
5. `dominant` falls through to hardcoded default: `'no_metacognitive_strategy'`  (Layer 1 — highest priority)
6. `allGaps = []` (nothing meets GAP_THRESHOLD of 2)
7. Session written to DB with `dominant_classification = 'no_metacognitive_strategy'`
8. Student routed to teach for metacognitive strategy — wrong for every student regardless of actual gap

This explains why every student hits the same teach path: the classification system is running on no data.

---

## Probable Root Causes (in order of likelihood)

**1. (MOST LIKELY) No RLS INSERT policy on `responses` table**
RLS is enabled on the table (consistent with every other table in this project) but no INSERT policy was ever written. Every insert attempt is silently blocked by Postgres, the API route returns 500, and the diagnostic page ignores the 500. Evidence: zero policies on `responses` in all 10 migration files; every other student-owned table has explicit policies.

**2. (SECONDARY) Gate condition failure — studentId / sessionId empty**
If the student's record in the `students` table cannot be read (RLS blocks SELECT, or student row was never created), then `studentId = ''` and `sessionId = ''`, and the fetch is never called at all. The `'[Diagnostic] writing response'` log line would never appear. This may compound Root Cause 1.

**3. (TERTIARY) Silent HTTP failure on client**
Even if the insert fails server-side for any reason, the diagnostic page never reads the fetch response. This is not the root cause of the failed write, but it guarantees the bug goes undetected.
