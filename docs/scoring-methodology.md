# Scoring Methodology — Digital Mind Lab / Mind in Control

This documents the **actual implementation** of every scoring/calculation
path in the app, as it exists after the fixes in this modernization pass.
Nothing here is aspirational — every number and threshold below is taken
directly from the source and is covered by an automated test in `tests/unit/`.

## 1. Overview: three independent scoring paths

| Checkpoint | How it's scored | Score range | Where |
|---|---|---|---|
| CP1 — Critical Thinking | LLM rubric judge | 1-3 | `api/src/shared/judge.js` |
| CP2 — Memory | Deterministic keyword matching | 1-3 | `api/src/shared/facts.js` |
| CP3 — Problem-Solving | LLM rubric judge (same rubric engine as CP1) | 1-3 | `api/src/shared/judge.js` |

All three scores feed into one combined **Digital Thinking Identity** (§4).

## 2. Sufficiency pre-check (runs before any paid AI call)

**Purpose:** catch empty, too-short, or obviously low-effort answers
*before* spending an LLM call on them, and give an honest "can't grade this
confidently" signal instead of forcing a number on garbage input.

**Location:** `api/src/shared/sufficiency.js` (authoritative/server-side),
mirrored in `index.html` §6c (`wcLive`/`lowEffortLive`/`duplicateFieldsLive`/
`cpLiveInsufficient`) for an inline, live warning as the student types. **The
client copy is a preview only** — the server always makes the final
`needsReview` decision. A dedicated test (`tests/unit/sufficiency.test.js`,
"client-side ... mirrors server-side ...") asserts both copies produce
identical output across a shared battery of inputs, so the two cannot
silently drift apart again.

### `wordCount(text)`
Trims, splits on whitespace, counts non-empty tokens. `0` for empty/null/undefined.

### `isLowEffort(text)` — flags keyboard-mashing / trivial repeats
1. Empty string → `true`.
2. The whole string (whitespace stripped) is one character repeated 4+
   times (e.g. `"...."`) → `true`.
3. Otherwise: split into words, strip trailing punctuation from each word,
   compute `uniqueRatio = (distinct words) / (total words)`.
   **If `words.length >= 2 AND uniqueRatio <= 0.5` → `true`.**

   > **This pass fixed a boundary defect here.** The threshold was
   > previously `uniqueRatio < 0.5` (strict), which does **not** catch a
   > 4-word answer with exactly 2 unique words (ratio exactly `0.5`) —
   > including `"no se no se"`, the exact example named in the function's
   > own doc comment. Changed to `<= 0.5`. See `docs/application-audit.md`
   > §4 defect #1 for the full writeup and verification.

### `hasDuplicateFields(values)` — flags copy-pasting the same trivial answer into multiple boxes
For each non-blank field value (trimmed, lower-cased): if the **same**
text appears in 2+ fields **and** that text is 8 words or fewer, flag it.
(Longer verbatim duplicates are outside this specific heuristic's scope —
intentionally; it exists to catch the "typed one lazy phrase, pasted it
everywhere" pattern, not genuine long-form duplication.)

### `checkSufficiency(fields, lang)` — the combined gate
```
answeredFields = fields where wordCount(v) >= 3 AND !isLowEffort(v)
totalWords     = sum of wordCount(v) across ALL fields
insufficient   = (answeredFields.length === 0)
                 OR (totalWords < 15)
                 OR hasDuplicateFields(all field values)
```
Returns `{ insufficient, reason, totalWords }` — `reason` is a localized,
human-readable explanation when `insufficient` is `true`, otherwise `null`.

**Field sets actually sent for each checkpoint** (must match what the
client posts — enforced by the "client-side mirror" tests above):
- CP1: `{ pasted, correct, trust, source, reflect }` (5 fields)
- CP3: `{ first, ai, improved, compare, reflect }` (5 fields)
- CP2 uses a separate, simpler check: `wordCount(recall) < 3 || isLowEffort(recall)` — **not** `checkSufficiency`, since CP2 has only one free-text field (`recall`) and is graded deterministically, not by an LLM rubric.

> **Flagged finding (investigated, not changed):** CP2's written
> reflection (`cp2.reflect`) is **required** to proceed past that page
> (`gateAt("cp2r")`) and is preserved in the printable transcript, but is
> **never sent to `/api/evaluate` and never factors into the CP2 score**
> — only `recall` does (see `runEvaluate()`'s fetch body: `cp2: { recall: S.cp2.recall }`).
> This is asymmetric with CP1/CP3, where the reflection text **is** part
> of what the LLM judge reads and scores.
>
> This was investigated during the modernization audit and left
> **unchanged**: it matches the original architecture's own stated
> intent ("Checkpoint 2 (Memory) is scored deterministically in facts.js
> instead, since it's objectively checkable" — source comment in
> `evaluate.js`), i.e. CP2 is deliberately the one purely objective,
> non-gameable checkpoint, and its reflection is a separate reflective
> exercise for the student/transcript rather than a graded input. Per the
> directive's instruction not to silently reinterpret an ambiguous
> existing design, **the formula was not changed**. If an instructor
> wants the CP2 reflection to also influence that checkpoint's score,
> that is a deliberate rubric decision for them to make, not something
> this pass should decide unilaterally.

## 3. CP1 / CP3 — LLM rubric judge

`api/src/shared/judge.js`. If `cp1Pre.insufficient` / `cp3Pre.insufficient`
is already `true` from the pre-check above, the checkpoint is **not** sent
to the LLM at all — it's scored `{ score: 1, insufficient: true, reason: <pre-check reason> }`
directly, saving the API call entirely.

Otherwise, `callJudge()`:
- If `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_KEY` / `AZURE_OPENAI_DEPLOYMENT`
  are configured (production): calls Azure OpenAI chat completions with a
  strict JSON-only system prompt (`RUBRIC_SYSTEM`), asking for
  `{score: 1|2|3, why, insufficient, reason}`. Uses `reasoning_effort: "low"`
  (the deployed model, `gpt-5-mini`, is a reasoning model) and a
  `max_completion_tokens` budget; if the model's response is truncated
  before producing a scorable JSON object, the call **throws** rather than
  silently returning a default score.
- If not configured (local dev / CI without secrets): falls back to
  `mockJudge()` — a transparent, clearly-labeled heuristic
  (`words > 80 → 3, words > 30 → 2, else → 1`), explicitly **not** meant to
  be an accurate grader, used only so the API can be exercised end-to-end
  for free without credentials.
- Network/parse failures in `evaluate.js` are caught and replaced with a
  **visibly-flagged fallback score** (`score: 2, insufficient: true`,
  `reason: "the AI grading service was unavailable; this score is provisional"`)
  rather than silently returning as if a real grade had been produced.

**Rubric bands (same in both languages, by design — see `judge.js`
`RUBRIC_SYSTEM`):**
- **1** — accepted things at face value with little verification or
  independent effort.
- **2** — did some real checking/thinking, but a solid partner would have
  reasoned better.
- **3** — named specific evidence, questioned assumptions, or showed clear
  independent reasoning before/alongside using the tool.

This is an **existing academic design decision**, not something this audit
changed — see `docs/application-audit.md` §8.

## 4. CP2 — deterministic fact-matching

`api/src/shared/facts.js`. Ten fixed facts per language (`FACTS.en` /
`FACTS.es`), each with keyword phrases used to detect whether the
student's free-text recall mentions that fact's gist.

```
countMatchedFacts(recallText, lang):
  for each of the 10 facts in FACTS[lang] (falls back to FACTS.en for an
  unrecognized lang code):
    if any of that fact's keyword phrases appears in the lower-cased
    recall text → count it as matched
  returns matched count, 0-10

factsToBand(matched):
  matched >= 7  → 3
  matched >= 4  → 2
  else          → 1
```
Boundary values (0, 3, 4, 6, 7, 10 matched) are pinned in
`tests/unit/facts.test.js`.

## 5. Combining the three checkpoint scores → Digital Thinking Identity

`index.html`:
```
scores() = [S.self.cp1 || 0, S.self.cp2 || 0, S.self.cp3 || 0]   // each 0-3
total()  = sum of scores()                                       // range 3-9 once all three are graded
band(n):
  n <= 4  → 0   "Automatic Outsourcer" / "Delegador Automático"
  n <= 7  → 1   "Assisted Thinker"     / "Pensador Asistido"
  else    → 2   "Cognitive Navigator"  / "Navegante Cognitivo"
```
`band()` boundaries are pinned in `tests/unit/client-scoring.test.js`
(every integer 3-9 is asserted against its expected band; a 5-way split
of the 3-9 range into `{3,4}` / `{5,6,7}` / `{8,9}`).

`S.self.cp1/cp2/cp3` are populated either (a) automatically from
`/api/evaluate`'s per-checkpoint `score`, or (b) manually, if the student
picks one of three self-described habit tiers (`c1Opts`/`c2Opts`/`c3Opts`,
each worth exactly `1`/`2`/`3` points, identical in both languages — see
`tests/unit/i18n-parity.test.js`) when the AI grading API is unreachable.

**This 3-9 → 3-band mapping is an existing academic design decision** — it
was audited for internal consistency (every value in range maps to a valid
band, boundaries are exactly where the code says they are) but **not**
reinterpreted. If different cut points are wanted, that's a decision for
the instructor, not something this pass silently changed.

## 6. What changed vs. what didn't

| Changed | Not changed (existing design, verified consistent) |
|---|---|
| `isLowEffort()` boundary (`< 0.5` → `<= 0.5`), server + client mirror | The 1-3 rubric bands and their written descriptions |
| Evaluation page text corrected from "a score from 1 to 9" to "3 to 9" — 1-2 is mathematically impossible since every scoring path is hard-constrained to 1/2/3, verified empirically (see §7) | `factsToBand` thresholds (0-3/4-6/7-10) |
| — | `band()` thresholds (3-4/5-7/8-9) |
| — | The three Digital Thinking Identities and their names/descriptions |
| — | The manual self-pick point values (1/2/3) |
| — | CP2's reflection not factoring into its score (flagged in §2, left as-is — matches the original architecture's own stated intent) |

## 7. Verification: "did you parse the grading parameters to ensure all are accounted for and the right formula is used?"

Re-audited end to end in response to that exact question, rather than relying on the earlier pass:

1. **Confirmed every scoring path's achievable range empirically**, not by reading the code and assuming:
   ```
   $ node -e "const {factsToBand}=require('./api/src/shared/facts.js');
   for(let m=0;m<=10;m++)process.stdout.write(factsToBand(m)+',')"
   1,1,1,1,2,2,2,3,3,3,3,   // never 0, even at 0 matched facts
   ```
   Plus: the AI judge's system prompt constrains `score: 1|2|3` and the
   Azure OpenAI call `throw`s rather than accepting an out-of-range
   value; every manual self-pick option in both languages is worth
   exactly 1, 2, or 3 (`tests/unit/i18n-parity.test.js` already pinned
   this). **Conclusion: minimum achievable total is 3, not 1** — found
   the Evaluation page text contradicted this, fixed it (§6).
2. **Traced every submitted field for CP1/CP2/CP3 to confirm none are silently dropped** between the UI and the actual scoring call: CP1's and CP3's full 5-field sets are each included in both the sufficiency pre-check *and* the LLM prompt (`buildCp1Prompt`/`buildCp3Prompt`) — nothing is collected and then ignored. **CP2 is the one exception** — its `reflect` field is collected and required, but neither pre-checked nor sent to `/api/evaluate`; flagged explicitly in §2 rather than silently left unmentioned.
3. **Re-confirmed the identity-band formula** (`band()`/`total()`) is self-consistent across its full reachable range (already pinned by `tests/unit/client-scoring.test.js`), and that the manual-fallback point values exactly match the AI-path score range (1/2/3) in both languages.
