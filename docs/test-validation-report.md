# Test & Validation Report — Digital Mind Lab / Mind in Control

**Date:** 2026-10-16

## 1. Automated tests — actual results

### Unit tests (`node --test tests/unit/*.test.js`, Node built-in test runner)

```
tests 29
pass 29
fail 0
```

| File | What it covers |
|---|---|
| `tests/unit/sufficiency.test.js` | `wordCount`, `isLowEffort` (including the fixed boundary defect, pinned as a named regression test), `hasDuplicateFields`, `checkSufficiency` (blank input, the exact 14/15-word boundary, the worse exploit found during the audit, a genuine substantive answer, missing/undefined input, localized reasons), plus 3 tests asserting the **client-side mirror in `index.html` §6c produces byte-identical results to the server module** across a shared input battery — extracted directly from the real source (not hand-retyped), so the two cannot silently drift. |
| `tests/unit/facts.test.js` | Fact-list shape (10 facts × keywords, both languages), `countMatchedFacts` (zero/partial/multi-fact matches, both languages, unknown-language fallback), `factsToBand` exact boundaries (0, 3, 4, 6, 7, 10 matched) and full-range validity. |
| `tests/unit/client-scoring.test.js` | `band()` exact boundaries across the full reachable 3-9 total range, `total()`/`scores()` summation and missing-score fallback-to-0 behavior — extracted from the real `index.html` source. |
| `tests/unit/i18n-parity.test.js` | EN/ES key-set equality (142/142), array-length parity, no-accidentally-identical-string check, and point-value parity for the three self-eval option tiers. |

### End-to-end tests (`npx playwright test`, Chromium, static file server — no API dependency)

```
8 passed (9.0s)
```

| Test | What it covers |
|---|---|
| Loads with expected brand/hero/status strip | Page loads, title/brand text render, status strip has its 4 facts. |
| Sidebar groups | Introduction and Meet-the-Team/Resources are standalone (no connector); Task→Evaluation is the 4-step connected stepper (Resources deliberately excluded from it). |
| Gated steps locked | Result-section tab is disabled before any checkpoint is completed. |
| Standalone pages reachable | Meet the Team and Resources load immediately, bypassing the gated sequence. |
| Keyboard focus on navigation | `#screen` receives focus after a nav click (the accessibility fix from this pass). |
| Language toggle | `<html lang>`, brand text, and the status strip all update; confirms the new bilingual chrome strings are wired correctly. |
| Persistence across reload | Step position survives a full page reload via `localStorage`. |
| Restart | Clears progress back to the Introduction page. |

**Note on scope:** these e2e tests intentionally do **not** exercise
`/api/evaluate` (AI grading) — that requires a running Azure Functions
host with real or mocked credentials, which is a second process the
Playwright `webServer` config does not orchestrate. That flow was
verified **manually** this session, end-to-end, against the real API —
see §2.

**Note on the test runner config:** Python's `http.server` (used as the
zero-dependency static file server for `webServer` in
`playwright.config.js`) is single-threaded and could not reliably serve
Playwright's default parallel workers — several tests intermittently
failed with `ERR_CONNECTION_REFUSED` under the default parallel config.
Fixed by setting `fullyParallel: false, workers: 1` (the suite is small —
9 seconds total — so serializing it has no real cost). This is itself a
small, demonstrated example of validating infrastructure before trusting
its output rather than assuming a reasonable-looking config "just works."

## 2. Manual verification this session (with evidence, not just claims)

All of the following were executed against a **real, running stack** —
`func start` (Azure Functions host, real `AZURE_OPENAI_*` credentials from
`api/local.settings.json`) + the Azure Static Web Apps CLI emulator
(`npx @azure/static-web-apps-cli start . --api-devserver-url http://localhost:7071`),
which is the same local stack Azure SWA's production routing/config engine
is modeled on — and the real browser (via a shared, scriptable Chromium
instance), not just curl-equivalent requests.

| Check | Method | Result |
|---|---|---|
| The gaming exploit found in this audit is actually caught end-to-end | Set `S.cp1` to the 5-distinct-trivial-phrase exploit inside the live page, called the real `runEvaluate()` (the actual in-browser `fetch`), through the SWA CLI proxy to the real Azure Functions host | `insufficient: true`, `needsReview: true`, confirmed in the live `S.selfEval.result` |
| A genuine, substantive submission still grades normally | Same method, with real multi-sentence answers in Spanish | `insufficient: false` for all three checkpoints, real LLM-written `why` text returned |
| `isLowEffort` fix has zero false positives | `node -e` battery of 11 adversarial + 10 genuine inputs against the real module | 0/11 false negatives, 0/10 false positives |
| New CSP doesn't break Google Fonts | Loaded the live page through the SWA CLI (which honors `staticwebapp.config.json`), checked `document.fonts.check('700 33px Montserrat')` and `document.fonts.size` in the real browser | `true`, `31` font faces registered — fonts genuinely loaded, not just "no console error" |
| New CSP doesn't break the API call | Triggered the real in-page `fetch("/api/evaluate")` (subject to the page's CSP, unlike a bare HTTP client) via `runEvaluate()` | `S.selfEval.status === "done"` with a real result object |
| `staticwebapp.config.json` route-blocking works | Requested `/tests/e2e/smoke.spec.js`, `/tests`, `/package.json`, `/playwright.config.js`, `/node_modules/...`, `/models.json` through the SWA CLI | All return `404`; real site assets (`/assets/brand/...`, `/favicon` equivalent) still return `200` |
| `--warn` color contrast | Computed WCAG relative-luminance contrast ratio directly (not eyeballed) for the light highlight gold vs. the fixed darker gold | `1.77:1` (fails AA) vs. `5.47:1` (passes AA) — confirmed numerically before shipping |
| Sidebar restructure (Resources moved out of the stepper) | DOM inspection of `#tabs > div` group structure + real click-through navigation, both languages | 3 groups confirmed (`navmenu` / `stepper-wrap` / `navmenu`), stepper has exactly 4 tabs, trailing group has exactly 2 |
| Focus management fix | `document.activeElement.id` checked immediately after a real `go()` navigation | `"screen"` |
| Bilingual toggle updates all new chrome | Clicked the real language button, re-read `#statusStrip`/`.rail .cap`/`#brandTitle` | All updated to the new language's text |
| Live deployment (Azure) | `gh run watch` on each push to the feature branch's corresponding workflow run; fetched the live production URL after each merge-equivalent deploy during earlier parts of this project | All deploys this project succeeded; this pass's changes are on a feature branch, not yet merged — see note below |

## 3. YAML / JSON syntax validation

- `.github/workflows/azure-static-web-apps-lively-coast-04256140f.yml` — parsed successfully with Python's `yaml.safe_load`; confirmed `skip_app_build: true` is a real boolean, not a string, in the parsed structure.
- `staticwebapp.config.json` — parsed successfully with `json.load`.
- `index.html`'s inline `<script>` — extracted and run through `node --check` after every edit in this pass (not just at the end).
- `index.html`'s inline `<style>` — brace-balance checked (`{` count == `}` count) after every edit in this pass.

## 4. What was NOT automated / explicitly deferred

- A full WCAG 2.2 AA automated audit (axe-core or equivalent) and manual
  screen-reader pass (NVDA/VoiceOver) — the three concrete accessibility
  defects actually found (contrast, focus management, skip link) were
  fixed and are documented in `docs/application-audit.md`, but this is
  not a claim of full formal AA certification.
- Cross-browser testing beyond Chromium (no Firefox/Safari/Edge runs this
  pass).
- A live production deployment of this pass's changes — this work was
  done on `feature/modernization-audit` per the directive's explicit
  instruction to "create an initial baseline commit and work on a feature
  branch." The changes are verified locally/via emulator as described
  above and are ready for review via pull request, not yet merged to
  `main`/deployed to `www.digital-mind-lab.com`.

## 5. Summary

| Metric | Result |
|---|---|
| Unit tests | 29/29 passing |
| E2E tests | 8/8 passing |
| Total automated tests | **37/37 passing** |
| Real calculation defects found | 1 (sufficiency boundary) |
| Real accessibility defects found | 2 (contrast, focus management/skip-link) |
| Real deployment-risk defects found | 1 (Oryx auto-build + unprotected tooling files) |
| Defects fixed this pass | 4/4 |
| Bilingual key parity | 142/142 (no mismatches) |
