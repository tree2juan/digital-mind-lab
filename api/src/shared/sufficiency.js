/**
 * Deterministic, free pre-check that runs BEFORE any AI call. Flags a
 * checkpoint's text fields as "insufficient to grade" when they are empty,
 * too short, or obviously low-effort (e.g. "asdf asdf asdf", a single
 * repeated character). This catches the cheap/obvious cases without
 * spending an LLM call, and gives the grader (human or AI) an honest
 * "can't score this confidently" signal instead of forcing a number.
 */

const MIN_WORDS_PER_FIELD = 3; // fewer words than this = field not really answered
const MIN_TOTAL_WORDS = 15; // minimum words across all fields to attempt grading

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * True if the text is empty, a repeated single character/punctuation run,
 * or mostly the same word over and over (keyboard-mashing / placeholder
 * text like "idk idk idk" or "......").
 */
function isLowEffort(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (/^(.)\1{3,}$/i.test(t.replace(/\s+/g, ""))) return true;
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const uniqueRatio = new Set(words).size / words.length;
  if (words.length >= 4 && uniqueRatio < 0.3) return true;
  return false;
}

/**
 * Checks a set of free-text fields (e.g. a checkpoint's {pasted, correct,
 * trust, source, reflect}) for overall sufficiency.
 * @param {Record<string,string>} fields
 * @param {"en"|"es"} lang
 * @returns {{insufficient:boolean, reason:string|null, totalWords:number}}
 */
function checkSufficiency(fields, lang) {
  const values = Object.values(fields || {}).map((v) => String(v || ""));
  const answeredFields = values.filter(
    (v) => wordCount(v) >= MIN_WORDS_PER_FIELD && !isLowEffort(v)
  );
  const totalWords = values.reduce((sum, v) => sum + wordCount(v), 0);
  const insufficient = answeredFields.length === 0 || totalWords < MIN_TOTAL_WORDS;
  const reason = insufficient
    ? lang === "es"
      ? "La respuesta está vacía, es muy corta o no tiene suficiente contenido para calificar con confianza."
      : "The response is empty, too short, or doesn't have enough content to grade with confidence."
    : null;
  return { insufficient, reason, totalWords };
}

module.exports = { checkSufficiency, wordCount, isLowEffort, MIN_WORDS_PER_FIELD, MIN_TOTAL_WORDS };
