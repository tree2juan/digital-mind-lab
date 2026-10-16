"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { FACTS, countMatchedFacts, factsToBand } = require("../../api/src/shared/facts.js");

test("FACTS: both languages have exactly 10 facts, each with at least one keyword", () => {
  assert.equal(FACTS.en.length, 10);
  assert.equal(FACTS.es.length, 10);
  for (const lang of ["en", "es"]) {
    for (const fact of FACTS[lang]) {
      assert.ok(Array.isArray(fact.keywords) && fact.keywords.length > 0, `${lang} fact missing keywords: ${fact.text}`);
    }
  }
});

test("countMatchedFacts: zero, partial, and full matches, both languages", () => {
  assert.equal(countMatchedFacts("", "en"), 0);
  assert.equal(countMatchedFacts("this has nothing to do with any of the facts", "en"), 0);
  // Fact 3 (EN): "working memory" / "four pieces" / "four things" / "four items"
  assert.equal(countMatchedFacts("working memory only holds four things at once", "en"), 1);
  // Two distinct facts in one recall: working memory (fact 3) + GPS (fact 10)
  assert.equal(
    countMatchedFacts("working memory holds four pieces, and people who use GPS use spatial memory less", "en"),
    2
  );
  assert.equal(countMatchedFacts("", "es"), 0);
  assert.equal(countMatchedFacts("la memoria de trabajo sostiene cuatro elementos", "es"), 1);
});

test("countMatchedFacts: unknown language falls back to English fact list instead of throwing", () => {
  assert.doesNotThrow(() => countMatchedFacts("working memory four things", "fr"));
  assert.equal(countMatchedFacts("working memory four things", "fr"), 1);
});

test("factsToBand: exact threshold boundaries (the only place band edges can silently drift)", () => {
  assert.equal(factsToBand(0), 1, "0 matched -> lowest band");
  assert.equal(factsToBand(3), 1, "3 matched -> still lowest band (boundary below 4)");
  assert.equal(factsToBand(4), 2, "4 matched -> crosses into middle band");
  assert.equal(factsToBand(6), 2, "6 matched -> still middle band (boundary below 7)");
  assert.equal(factsToBand(7), 3, "7 matched -> crosses into top band");
  assert.equal(factsToBand(10), 3, "10 matched (max) -> top band");
});

test("factsToBand: always returns a value in the same 1-3 range used by the rest of the app", () => {
  for (let matched = 0; matched <= 10; matched++) {
    const band = factsToBand(matched);
    assert.ok([1, 2, 3].includes(band), `factsToBand(${matched}) returned out-of-range ${band}`);
  }
});
