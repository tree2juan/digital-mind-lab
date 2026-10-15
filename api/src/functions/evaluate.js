const { app } = require("@azure/functions");
const { countMatchedFacts, factsToBand } = require("../shared/facts");
const { RUBRIC_SYSTEM, buildCp1Prompt, buildCp3Prompt, callJudge } = require("../shared/judge");
const { checkSufficiency, wordCount, isLowEffort } = require("../shared/sufficiency");

/**
 * POST /api/evaluate
 * Body: { lang: "en"|"es", cp1: {...}, cp2: {...}, cp3: {...} }
 * Returns: {
 *   cp1: {score, why, insufficient, reason},
 *   cp2: {score, why, insufficient, reason},
 *   cp3: {score, why, insufficient, reason},
 *   needsReview: boolean
 * }
 *
 * Replaces the old manual 1-3 self-pick with a score actually derived from
 * what the student wrote: CP1 and CP3 are judged by an LLM rubric (or a
 * transparent mock when no AI key is configured); CP2 is scored
 * deterministically by matching the recall text against the 10 real facts.
 *
 * Every checkpoint goes through a free deterministic sufficiency pre-check
 * before any AI call: empty, too-short, or obviously low-effort text (e.g.
 * "idk idk idk") is flagged as insufficient-to-grade rather than silently
 * scored. Text that passes the pre-check can still be flagged by the LLM
 * judge itself if it's nonsensical or off-topic. `needsReview` is true
 * whenever any checkpoint was flagged, so the UI/instructor can surface it.
 */
app.http("evaluate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "evaluate",
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "Invalid JSON body" } };
    }

    const lang = body.lang === "es" ? "es" : "en";
    const cp1 = body.cp1 || {};
    const cp2 = body.cp2 || {};
    const cp3 = body.cp3 || {};

    // --- CP2: deterministic fact-match scoring, plus its own sufficiency check ---
    const recall = String(cp2.recall || "");
    const cp2Insufficient = wordCount(recall) < 3 || isLowEffort(recall);
    const matched = countMatchedFacts(recall, lang);
    const cp2Result = {
      score: factsToBand(matched),
      why:
        lang === "es"
          ? `Coincide con ${matched} de 10 datos reales.`
          : `Matched ${matched} of 10 real facts.`,
      insufficient: cp2Insufficient,
      reason: cp2Insufficient
        ? lang === "es"
          ? "El recuerdo está vacío o es demasiado corto para evaluarlo con confianza."
          : "The recall is empty or too short to evaluate with confidence."
        : "",
    };

    // --- CP1 and CP3: deterministic pre-check, then LLM rubric judge (or mock) ---
    const cp1Pre = checkSufficiency(cp1, lang);
    const cp3Pre = checkSufficiency(cp3, lang);

    let cp1Result;
    let cp3Result;
    try {
      const [cp1Judged, cp3Judged] = await Promise.all([
        cp1Pre.insufficient
          ? Promise.resolve({ score: 1, why: "", insufficient: true, reason: cp1Pre.reason })
          : callJudge(RUBRIC_SYSTEM[lang], buildCp1Prompt(cp1, lang), lang),
        cp3Pre.insufficient
          ? Promise.resolve({ score: 1, why: "", insufficient: true, reason: cp3Pre.reason })
          : callJudge(RUBRIC_SYSTEM[lang], buildCp3Prompt(cp3, lang), lang),
      ]);
      cp1Result = cp1Judged;
      cp3Result = cp3Judged;
    } catch (err) {
      context.error("evaluate: judge call failed, using fallback", err);
      // Fail safe: never break the live demo. Fall back to a neutral score,
      // but still flag it so no one mistakes a fallback for a real grade.
      const fallback = {
        score: 2,
        why: lang === "es" ? "(calificación de respaldo)" : "(fallback score)",
        insufficient: true,
        reason:
          lang === "es"
            ? "El servicio de calificación por IA no estuvo disponible; esta nota es provisional."
            : "The AI grading service was unavailable; this score is provisional.",
      };
      cp1Result = fallback;
      cp3Result = fallback;
    }

    const needsReview = Boolean(cp1Result.insufficient || cp2Result.insufficient || cp3Result.insufficient);

    return {
      jsonBody: { cp1: cp1Result, cp2: cp2Result, cp3: cp3Result, needsReview },
    };
  },
});
