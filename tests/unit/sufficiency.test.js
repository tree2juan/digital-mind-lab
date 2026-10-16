"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  wordCount,
  isLowEffort,
  hasDuplicateFields,
  checkSufficiency,
  MIN_WORDS_PER_FIELD,
  MIN_TOTAL_WORDS,
} = require("../../api/src/shared/sufficiency.js");
const { loadClientMirror } = require("./_extract-client-mirror.js");

/* =========================================================================
   wordCount
   ========================================================================= */
test("wordCount: boundary and malformed inputs", () => {
  assert.equal(wordCount(""), 0, "empty string");
  assert.equal(wordCount("   "), 0, "whitespace-only");
  assert.equal(wordCount(null), 0, "null");
  assert.equal(wordCount(undefined), 0, "undefined");
  assert.equal(wordCount(42), 1, "non-string (number) coerces to a string, still counts");
  assert.equal(wordCount("one"), 1, "single word");
  assert.equal(wordCount("one two three"), 3, "simple case");
  assert.equal(wordCount("  one   two  "), 2, "extra internal/edge whitespace collapses");
});

/* =========================================================================
   isLowEffort — the function with the fixed boundary defect (see below)
   ========================================================================= */
test("isLowEffort: empty and single-repeated-character inputs are low-effort", () => {
  assert.equal(isLowEffort(""), true);
  assert.equal(isLowEffort("   "), true);
  assert.equal(isLowEffort("...."), true);
  assert.equal(isLowEffort("aaaaaaa"), true);
});

test("isLowEffort: documented and gamed low-effort phrases are caught", () => {
  // These are the exact phrases this check exists to catch (see the function's
  // own doc comment and the regression this test locks in).
  assert.equal(isLowEffort("yes, yes, yes"), true);
  assert.equal(isLowEffort("idk idk idk"), true);
  assert.equal(isLowEffort("asdf asdf asdf"), true);
});

test("isLowEffort: exact-half-unique-word boundary (regression — previously a false negative)", () => {
  // BUG FOUND DURING AUDIT: the original check used `uniqueRatio < 0.5`, which
  // is a strict inequality. A 4-word answer with exactly 2 unique words
  // (e.g. "no se no se" — literally the function's own documented example)
  // has uniqueRatio === 0.5 exactly, so it was NOT flagged. Fixed to `<= 0.5`.
  // This test pins that fix so it cannot silently regress.
  assert.equal(isLowEffort("no se no se"), true, "the exact phrase named in the function's own comment");
  assert.equal(isLowEffort("yes yes"), true, "2 words, 1 unique, ratio 0.5");
  assert.equal(isLowEffort("a b a b"), true, "4 words, 2 unique, ratio exactly 0.5");
  assert.equal(isLowEffort("tal vez tal vez"), true);
  assert.equal(isLowEffort("casi casi casi casi"), true, "4 words, 1 unique, ratio 0.25");
});

test("isLowEffort: genuine short-but-real answers are NOT flagged (no false positives from the fix)", () => {
  const genuine = [
    "I think the AI answer was mostly correct but I checked it anyway",
    "No creo que sea correcto porque la fuente no parece confiable",
    "It helped me understand the problem but I changed the ending",
    "Me ayudo a pensar pero cambie la parte final del ensayo",
    "Trust but verify is what I always do with any source",
    "No, I do not think so",
    "Si, pero no completamente",
  ];
  for (const text of genuine) {
    assert.equal(isLowEffort(text), false, `should NOT be flagged: ${JSON.stringify(text)}`);
  }
});

/* =========================================================================
   hasDuplicateFields
   ========================================================================= */
test("hasDuplicateFields: catches short identical answers pasted into multiple fields", () => {
  assert.equal(hasDuplicateFields(["yes, yes, yes", "yes, yes, yes", "something else entirely different"]), true);
  assert.equal(hasDuplicateFields(["no se", "no se", "no se"]), true);
});

test("hasDuplicateFields: ignores blank fields, requires an actual duplicate, respects the 8-word cap", () => {
  assert.equal(hasDuplicateFields(["", "", ""]), false, "all blank — nothing to compare");
  assert.equal(hasDuplicateFields(["alpha", "beta", "gamma"]), false, "all distinct");
  const longAnswer =
    "this is a genuinely long and substantive answer that happens to repeat verbatim which should not trip the short-duplicate heuristic";
  assert.equal(
    hasDuplicateFields([longAnswer, longAnswer]),
    false,
    "duplicate text over 8 words is outside this specific heuristic's scope (by design — long verbatim duplicates are a different, rarer case)"
  );
});

/* =========================================================================
   checkSufficiency — integration of the above, exact threshold boundaries
   ========================================================================= */
test("checkSufficiency: all fields blank is insufficient", () => {
  const r = checkSufficiency({ a: "", b: "", c: "" }, "en");
  assert.equal(r.insufficient, true);
  assert.equal(typeof r.reason, "string");
  assert.ok(r.reason.length > 0);
});

test("checkSufficiency: exact MIN_TOTAL_WORDS boundary (14 fails, 15 passes)", () => {
  // 14 words total, each field individually well above MIN_WORDS_PER_FIELD and not low-effort.
  const under = checkSufficiency(
    { a: "one two three four five six seven", b: "eight nine ten eleven twelve thirteen fourteen" },
    "en"
  );
  assert.equal(wordCount("one two three four five six seven"), 7);
  assert.equal(under.totalWords, 14);
  assert.equal(under.insufficient, true, "14 words total must fail the 15-word minimum");

  const atMin = checkSufficiency(
    { a: "one two three four five six seven eight", b: "eight nine ten eleven twelve thirteen fourteen" },
    "en"
  );
  assert.equal(atMin.totalWords, 15);
  assert.equal(atMin.insufficient, false, "15 words total (the documented minimum) must pass");
});

test("checkSufficiency: the worse exploit found during audit — distinct-but-each-internally-repetitive fields", () => {
  // Every individual field is a DIFFERENT phrase (so the cross-field duplicate
  // check alone wouldn't catch it), but each one is internally a trivial
  // two-word repeat. Before the isLowEffort fix this sailed through as
  // "sufficient" with totalWords: 20.
  const r = checkSufficiency(
    {
      pasted: "tal vez tal vez",
      correct: "no se no se",
      trust: "casi casi casi casi",
      source: "puede ser puede ser",
      reflect: "puede que puede que",
    },
    "es"
  );
  assert.equal(r.insufficient, true, "must be caught now — was a false negative before the fix");
});

test("checkSufficiency: a genuine, substantive answer still passes (no over-correction)", () => {
  const r = checkSufficiency(
    {
      pasted: "La inteligencia artificial me dijo que Bogota es la capital de Colombia y que tiene ocho millones de habitantes",
      correct: "Si, la informacion es correcta segun lo que yo sabia de antes",
      trust: "Confio parcialmente pero igual revise otra fuente para confirmar el dato",
      source: "Si hizo falta revisar otra fuente porque el dato de poblacion variaba",
      reflect: "Normalmente seria mas cuidadoso con los datos numericos que con los generales",
    },
    "es"
  );
  assert.equal(r.insufficient, false);
  assert.equal(r.reason, null);
});

test("checkSufficiency: missing/undefined fields object does not throw", () => {
  assert.doesNotThrow(() => checkSufficiency(undefined, "en"));
  assert.doesNotThrow(() => checkSufficiency({}, "en"));
  assert.equal(checkSufficiency(undefined, "en").insufficient, true);
});

test("checkSufficiency: es and en both produce a non-empty localized reason when insufficient", () => {
  const en = checkSufficiency({ a: "" }, "en");
  const es = checkSufficiency({ a: "" }, "es");
  assert.ok(en.reason.length > 0);
  assert.ok(es.reason.length > 0);
  assert.notEqual(en.reason, es.reason, "reasons should actually be translated, not the same string");
});

/* =========================================================================
   Client-side mirror (index.html §6c) must behave identically to the
   server-side module on the same battery of inputs — enforces the
   "keep these two in sync" contract stated in both files' comments.
   ========================================================================= */
test("client-side lowEffortLive mirrors server-side isLowEffort on the full battery", () => {
  const { lowEffortLive } = loadClientMirror();
  const cases = [
    "", "   ", "....", "aaaaaaa",
    "yes, yes, yes", "idk idk idk", "asdf asdf asdf",
    "no se no se", "yes yes", "a b a b", "tal vez tal vez", "casi casi casi casi",
    "I think the AI answer was mostly correct but I checked it anyway",
    "No creo que sea correcto porque la fuente no parece confiable",
    "Trust but verify is what I always do with any source",
    "Si, pero no completamente",
  ];
  for (const text of cases) {
    assert.equal(
      lowEffortLive(text),
      isLowEffort(text),
      `client/server mismatch for ${JSON.stringify(text)}`
    );
  }
});

test("client-side wcLive mirrors server-side wordCount", () => {
  const { wcLive } = loadClientMirror();
  const cases = ["", "   ", "one", "one two three", "  one   two  "];
  for (const text of cases) {
    assert.equal(wcLive(text), wordCount(text), `mismatch for ${JSON.stringify(text)}`);
  }
});

test("client-side duplicateFieldsLive mirrors server-side hasDuplicateFields", () => {
  const { duplicateFieldsLive } = loadClientMirror();
  const batteries = [
    ["yes, yes, yes", "yes, yes, yes", "something else"],
    ["", "", ""],
    ["alpha", "beta", "gamma"],
  ];
  for (const values of batteries) {
    assert.equal(
      duplicateFieldsLive(values),
      hasDuplicateFields(values),
      `mismatch for ${JSON.stringify(values)}`
    );
  }
});

/* Sanity-check the exported constants are still what the tests above assume. */
test("exported thresholds match what this test file assumes", () => {
  assert.equal(MIN_WORDS_PER_FIELD, 3);
  assert.equal(MIN_TOTAL_WORDS, 15);
});
