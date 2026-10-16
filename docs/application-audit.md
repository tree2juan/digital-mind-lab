# Application Audit — Digital Mind Lab / Mind in Control

**Date:** 2026-10-16
**Scope:** Full repository inspection per the modernization directive, Phase 1.
**Production URL:** https://www.digital-mind-lab.com/

## 1. Architecture

| Aspect | Finding |
|---|---|
| Framework / build system | **None.** `index.html` is a single, self-contained file (~1,700 lines): inline `<style>`, inline `<script>`, no bundler, no framework, no build step. Deployed as-is. |
| Dependencies (frontend) | Zero npm dependencies. One external resource: Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`), loaded via `<link>`. |
| Backend | `api/` — an Azure Functions (Node.js, v4 programming model) app with one HTTP function, `POST /api/evaluate` (`api/src/functions/evaluate.js`), plus shared pure-logic modules under `api/src/shared/` (`sufficiency.js`, `judge.js`, `facts.js`). Dependency: `@azure/functions` only. |
| Hosting | Azure Static Web Apps (`digital-mind-lab`, `rg-digital-mind-lab`, eastus2), custom domain `www.digital-mind-lab.com` with managed SSL. Deployed via `.github/workflows/azure-static-web-apps-lively-coast-04256140f.yml` (`Azure/static-web-apps-deploy@v1`, triggers on push to `main`). A parallel GitHub Pages deployment also exists for the same repo/branch (`tree2juan.github.io/digital-mind-lab`) — both auto-deploy from the same source, Azure is the primary/production target. |
| Routes | Effectively one route: `/` (the SPA renders 16 "pages" as in-memory state transitions, there is no client-side URL routing / no deep links). Plus `/api/evaluate` on the Functions API. No `staticwebapp.config.json` existed before this audit (see §7). |
| State management | A single global `S` object, persisted to `localStorage` (key `dml.v2`) after every change via `save()`. A small `store` wrapper (`try/catch`-guarded `localStorage` access) degrades gracefully to an in-memory object if `localStorage` is unavailable (e.g. certain embedded/preview contexts), with a visible warning to the user. |

**Verdict:** the single-file, no-build architecture is a deliberate, working choice for a small academic project (no server-side rendering or routing is actually needed). It does **not** demonstrably require a rewrite — per the directive's own instruction, no rewrite was performed. All work below is a remediation/modernization pass on the existing architecture.

## 2. Interactive components, assessments, and calculators

| Component | Location | What it does |
|---|---|---|
| Checkpoint 1 — Critical Thinking | `V.cp1` / `reflectPage` | Free-text: paste an AI answer, judge correctness/trust/need-to-verify, reflect. Graded by an LLM rubric judge (`judge.js`) when AI credentials are configured, 1-3. |
| Checkpoint 2 — Memory | `V.cp2` | A 90-second (configurable via `?t=`) memorize-then-recall challenge against 10 fixed facts. Graded **deterministically** by keyword matching (`facts.js`), not by AI. |
| Checkpoint 3 — Problem-Solving | `V.cp3` | Two-round free-text: solve unaided, then solve again with AI help, then compare. Graded by the same LLM rubric judge as CP1. |
| Self-Evaluation | `V.selfeval` | Calls `/api/evaluate`; falls back to a manual 1-3 self-pick (`c1Opts`/`c2Opts`/`c3Opts`) if the API is unreachable. |
| Digital Thinking Identity | `V.identity`, `V.card` | Derives one of 3 identities from the summed 1-3 scores (see `docs/scoring-methodology.md`). |
| Live sufficiency flag | §6c of `index.html` | A client-side mirror of the server's sufficiency pre-check, shown inline as the student types (not just after grading). |

## 3. Calculation / scoring surfaces identified

1. `api/src/shared/sufficiency.js` — deterministic pre-check (`wordCount`, `isLowEffort`, `hasDuplicateFields`, `checkSufficiency`) run **before** any paid LLM call, on both CP1 and CP3.
2. `api/src/shared/facts.js` — deterministic CP2 scoring (`countMatchedFacts`, `factsToBand`).
3. `api/src/shared/judge.js` — LLM rubric scoring for CP1/CP3 (`callJudge`, with a transparent `mockJudge` fallback for credential-less dev/CI).
4. `index.html` §6c — a **duplicate, hand-maintained mirror** of `isLowEffort`/`wordCount`/`hasDuplicateFields` for the live, pre-grading UI flag. The comments in both files explicitly call out that they must be kept in sync.
5. `index.html` `band()`/`total()`/`scores()` — sums the three 1-3 checkpoint scores (range 3-9) into one of 3 Digital Thinking Identity bands.

Full before/after behavior of each is documented in `docs/scoring-methodology.md`.

## 4. Defects found (this audit) and their status

| # | Severity | Location | Issue | Status |
|---|---|---|---|---|
| 1 | **High** | `api/src/shared/sufficiency.js` `isLowEffort()` | The repetition check used `uniqueRatio < 0.5` (strict). A 4-word answer with exactly 2 unique words (`uniqueRatio === 0.5` exactly) was **not** flagged — including the exact phrase (`"no se no se"`) named in the function's own doc comment as something it catches. Confirmed empirically (not just read) — see below. Worse: combining 5 *distinct* (non-identical, so the cross-field duplicate check didn't help either) but each internally two-word-repetitive answers passed `checkSufficiency` as fully sufficient (`totalWords: 20`, `insufficient: false`), which would have sent trivial filler straight to a paid LLM grading call as if it were real content — the same class of gaming issue fixed earlier in the project (the "yes, yes, yes" bug), reopened via a different boundary. | **Fixed.** Changed to `uniqueRatio <= 0.5` in both the server module and its client-side mirror. Verified with a battery of 11 adversarial inputs (all now correctly flagged) and 10 genuine short-but-real answers in both languages (zero false positives introduced). Regression-pinned in `tests/unit/sufficiency.test.js`. |
| 2 | **Medium (accessibility, WCAG 2.2 AA)** | `index.html` `.gate` (inline validation message) | `--warn` was initially mapped directly to the new design-system `--highlight` color (`#F1B967`, a light gold meant for background tints). Used as **text** color, it measures **1.77:1** contrast against white — fails WCAG AA (needs 4.5:1 for normal text). Caught before shipping via an actual contrast computation, not by inspection. | **Fixed.** `--warn` now resolves to a darker shade in the same hue family (`#8A6212`, 5.47:1), kept distinct from `--highlight` (which remains reserved for background tints only, via explicit `rgba()`, not the `--warn` variable). |
| 3 | **Medium (accessibility, WCAG 2.4.1)** | `index.html` | `#screen` has `tabindex="-1"` (clearly intended for programmatic focus management) but nothing ever called `.focus()` on it — keyboard/screen-reader users got no focus movement on page navigation. No "skip to main content" link existed either. | **Fixed.** `go()` now calls `$("screen").focus()` after each navigation. A localized skip-link was added (visually hidden until keyboard-focused, standard pattern). |
| 4 | **Low (deployment risk)** | Repository root / Azure Static Web Apps config | No `staticwebapp.config.json` existed. Separately, adding a root `package.json` (needed for the new `tests/` npm scripts) sits directly in `app_location: "/"` — Azure's Oryx build step auto-detects a root `package.json` and would attempt an `npm run build`, which doesn't exist, on the next deploy. | **Fixed.** Added `skip_app_build: true` to the existing GitHub Actions workflow (this is Microsoft's documented way to opt out of Oryx auto-build; verified this doesn't touch the separate, already-working `api_location` Functions build). Added `staticwebapp.config.json` with explicit `404` routes for `/tests/*`, `/package.json`, `/package-lock.json`, `/playwright.config.js`, `/node_modules/*`, and the two pre-existing untracked stray files (`models.json`, `task-process-resources-evaluation.md`) so none of this tooling/content is ever publicly servable, even if accidentally present in a deploy. Verified locally end-to-end with the SWA CLI emulator (see `docs/test-validation-report.md`). |
| 5 | **Low (no functional impact)** | `index.html` (`postHeight()` / `window.parent.postMessage`) | Leftover height-reporting code from an earlier (abandoned) plan to embed this site in a Wix iframe. Inert and harmless on Azure (no parent frame to message), but dead code. | **Not changed** — flagged only. Out of scope for this pass per "prioritize calculation defects before aesthetic changes"; removing dead code is a pure cleanup with no user-facing effect, and every other finding in this audit was prioritized ahead of it. Safe to remove in a future pass. |

### Verification method for defect #1 (shown, not just asserted)
```
$ node -e "const {isLowEffort} = require('./api/src/shared/sufficiency.js'); console.log(isLowEffort('no se no se'))"
false        // before the fix — contradicts the function's own doc comment
```
After the fix, the same call returns `true`, and the fix is covered by `tests/unit/sufficiency.test.js` (`isLowEffort: exact-half-unique-word boundary (regression — previously a false negative)`).

## 5. Bilingual (Spanish/English) completeness

Checked **programmatically**, not by manual reading (see `tests/unit/i18n-parity.test.js`):
- `C.en` and `C.es` expose **exactly the same 142 keys** — zero keys missing in either language.
- Every array-valued string set (checkpoint options, identities, process steps, credits, etc.) has **matching length** in both languages.
- Zero strings are accidentally identical between languages (no leftover untranslated copy).
- The three self-evaluation option tiers (`c1Opts`/`c2Opts`/`c3Opts`) carry identical point values (`[1, 2, 3]`) in both languages.

**Verdict: bilingual parity is clean.** This reflects a prior "naturalize Spanish copy" pass earlier in the project; no further translation work was needed this round.

## 6. Accessibility, responsiveness, navigation

- Mobile breakpoint (<900px): horizontal scrollable stepper, already implemented and working.
- Desktop (≥900px): sticky sidebar with a vertical stepper.
- `prefers-reduced-motion` is respected (panel entrance animation and all transitions disabled).
- `:focus-visible` outlines are defined on all interactive elements.
- **Fixed this pass:** focus management on navigation (#3 above), skip link (#3 above), the `--warn` contrast defect (#2 above).
- **Not done / explicitly deferred:** a full formal WCAG 2.2 AA audit (automated tooling pass with axe-core or similar, plus manual screen-reader testing with NVDA/VoiceOver) was not run this pass — flagging this for review rather than silently claiming full AA compliance. The fixes above address the three concrete defects actually found during manual/code inspection.

## 7. Azure deployment configuration

- Build/deploy pipeline: confirmed working (GitHub Actions → Azure Static Web Apps, auto-deploy on push to `main`).
- HTTPS / custom domain: confirmed working, free managed SSL certificate active.
- Security headers: Azure Static Web Apps already sends sensible defaults out of the box (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `X-DNS-Prefetch-Control`) even with no config file — confirmed via direct inspection of live response headers. This pass adds a `Content-Security-Policy`, `X-Frame-Options: DENY`, and a restrictive `Permissions-Policy`, none of which existed before (see `docs/test-validation-report.md` for how the CSP was verified not to break Google Fonts or the `/api/evaluate` call).
- No new Azure services or paid tiers were added — per the directive's explicit instruction not to add cost without a documented requirement.

## 8. Out of scope / explicitly flagged for review (not silently skipped)

- The exact 1-3 rubric bands for CP1/CP3 (LLM judge) and the `factsToBand` / identity-band thresholds (0-3→1, 4-6→2, 7-10→3 matched facts; total 3-4→Outsourcer, 5-7→Assisted, 8-9→Navigator) are **existing, already-in-production academic design decisions**, not bugs. They were **not** changed — per the directive's instruction not to silently reinterpret existing assessment design. If the instructor wants different cut points, that's a design decision for them to make, not something this audit unilaterally altered.
- A full cross-browser test matrix (Safari/Firefox/Edge, iOS/Android) was not run — only Chromium, via Playwright, was exercised this pass.
- The two pre-existing untracked files in the repo root (`models.json`, `task-process-resources-evaluation.md`) are not part of the site and were left untouched content-wise; they are now blocked from being publicly servable (see defect #4) as a safety measure, but their origin/purpose was not investigated further since they predate this work and aren't referenced anywhere in the app.
