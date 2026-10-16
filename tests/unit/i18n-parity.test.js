"use strict";
/**
 * Formalizes the bilingual-parity check performed during the audit: both
 * locale blocks (C.en / C.es in index.html) must expose exactly the same
 * set of keys, and any array-valued string (tCps, ids, pSteps, cred, etc.)
 * must have the same length in both languages — a length mismatch there
 * means one language is missing an option, a scoring tier, or a credit line
 * the other has, which would silently break the page in that language.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadLocales() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const startIdx = html.indexOf("var C = {");
  if (startIdx === -1) throw new Error("loadLocales: could not find 'var C = {' in index.html");
  const endRe = /\r?\n\};\r?\n/g;
  endRe.lastIndex = startIdx;
  const em = endRe.exec(html);
  if (!em) throw new Error("loadLocales: could not find the closing '};' for the C object in index.html");
  const src = html.slice(startIdx, em.index + em[0].length);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + "\nthis.C = C;", sandbox);
  return sandbox.C;
}

test("locale parity: en and es expose exactly the same set of top-level keys", () => {
  const C = loadLocales();
  const enKeys = Object.keys(C.en).sort();
  const esKeys = Object.keys(C.es).sort();
  assert.deepEqual(enKeys, esKeys);
});

test("locale parity: every array-valued key has the same length in both languages", () => {
  const C = loadLocales();
  const mismatches = [];
  for (const key of Object.keys(C.en)) {
    const a = C.en[key];
    const b = C.es[key];
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
      mismatches.push(`${key}: en=${a.length} es=${b.length}`);
    }
  }
  assert.deepEqual(mismatches, []);
});

test("locale parity: no leftover untranslated string is accidentally identical between en and es", () => {
  const C = loadLocales();
  const identical = [];
  for (const key of Object.keys(C.en)) {
    const a = C.en[key];
    const b = C.es[key];
    if (typeof a === "string" && typeof b === "string" && a === b && a.trim().length > 3) {
      identical.push(key);
    }
  }
  assert.deepEqual(identical, []);
});

test("locale parity: the three self-eval option tiers (c1/c2/c3Opts) carry the same point values in both languages", () => {
  const C = loadLocales();
  for (const key of ["c1Opts", "c2Opts", "c3Opts"]) {
    // Array.from re-materializes as a host-realm array — see the matching
    // comment in client-scoring.test.js for why this is needed with vm.
    const enPts = Array.from(C.en[key].map((o) => o[2]));
    const esPts = Array.from(C.es[key].map((o) => o[2]));
    assert.deepEqual(enPts, esPts, `${key} point values differ between en/es`);
    assert.deepEqual(enPts, [1, 2, 3], `${key} should be exactly [1,2,3] in en`);
  }
});
