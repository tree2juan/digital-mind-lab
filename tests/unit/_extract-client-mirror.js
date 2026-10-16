"use strict";
/**
 * Extracts the client-side sufficiency mirror (wcLive / lowEffortLive /
 * duplicateFieldsLive) straight out of index.html's inline <script>, so the
 * "keep this in sync with api/src/shared/sufficiency.js" contract in the
 * source comments is actually enforced by a test instead of just trusted.
 *
 * This deliberately does NOT re-type the logic by hand (that would test the
 * test, not the app) — it slices the real source between two stable
 * function-declaration markers and evaluates it in an isolated context.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadClientMirror() {
  const htmlPath = path.join(__dirname, "..", "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const startMarker = "function wcLive(text)";
  const endMarker = "function cpLiveInsufficient(n)";
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      "loadClientMirror: could not locate wcLive/lowEffortLive/duplicateFieldsLive block in index.html " +
        "(markers moved/renamed) — update the markers in tests/unit/_extract-client-mirror.js"
    );
  }
  const src = html.slice(startIdx, endIdx);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + "\nthis.wcLive = wcLive; this.lowEffortLive = lowEffortLive; this.duplicateFieldsLive = duplicateFieldsLive;", sandbox);
  return {
    wcLive: sandbox.wcLive,
    lowEffortLive: sandbox.lowEffortLive,
    duplicateFieldsLive: sandbox.duplicateFieldsLive,
  };
}

module.exports = { loadClientMirror };
