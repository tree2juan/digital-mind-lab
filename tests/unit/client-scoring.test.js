"use strict";
/**
 * Locks in the identity-card scoring boundaries (band/scores/total) by
 * extracting the real implementation straight out of index.html, the same
 * technique used in _extract-client-mirror.js — this is the ONLY
 * implementation (no server-side duplicate to compare against), but the
 * exact band thresholds silently decide every user's Digital Thinking
 * Identity, so a boundary regression here would be invisible without a test.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadScoring(selfScores) {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const startMarker = "var SELF_KEYS = ";
  const endMarker = "function evalSignature";
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error("loadScoring: could not locate SELF_KEYS/scores/total/band block in index.html");
  }
  const src = html.slice(startIdx, endIdx);
  const sandbox = { S: { self: selfScores } };
  vm.createContext(sandbox);
  vm.runInContext(src + "\nthis.band = band; this.total = total; this.scores = scores;", sandbox);
  return { band: sandbox.band, total: sandbox.total, scores: sandbox.scores };
}

test("band: exact threshold boundaries across the full 3-9 possible total range", () => {
  const { band } = loadScoring({ cp1: 1, cp2: 1, cp3: 1 });
  // total() ranges 3 (all 1s) to 9 (all 3s); band 0/1/2 = Automatic Outsourcer /
  // Assisted Thinker / Cognitive Navigator.
  assert.equal(band(3), 0, "minimum possible total");
  assert.equal(band(4), 0, "boundary just below the first cutoff");
  assert.equal(band(5), 1, "crosses into the middle band");
  assert.equal(band(7), 1, "boundary just below the second cutoff");
  assert.equal(band(8), 2, "crosses into the top band");
  assert.equal(band(9), 2, "maximum possible total");
});

test("total/scores: sums the three self-eval scores and treats missing scores as 0", () => {
  const { total, scores } = loadScoring({ cp1: 2, cp2: 3, cp3: 1 });
  // Array.from re-materializes the vm-context array as a host-realm array —
  // without it, deepEqual's prototype check fails even on identical content,
  // since vm.createContext gives the sandbox its own separate Array global.
  assert.deepEqual(Array.from(scores()), [2, 3, 1]);
  assert.equal(total(), 6);

  const { total: totalMissing, scores: scoresMissing } = loadScoring({ cp1: 2 });
  assert.deepEqual(Array.from(scoresMissing()), [2, 0, 0], "ungraded checkpoints (undefined) fall back to 0, not NaN");
  assert.equal(totalMissing(), 2);
});

test("band: every reachable total (3-9) maps to a valid band index (0, 1, or 2)", () => {
  const { band } = loadScoring({ cp1: 1, cp2: 1, cp3: 1 });
  for (let n = 3; n <= 9; n++) {
    const b = band(n);
    assert.ok([0, 1, 2].includes(b), `band(${n}) returned out-of-range ${b}`);
  }
});
