/**
 * LLM-based rubric judge for Checkpoint 1 (Critical Thinking) and
 * Checkpoint 3 (Problem-Solving). Checkpoint 2 (Memory) is scored
 * deterministically in facts.js instead, since it's objectively checkable.
 *
 * In local/dev mode (no AZURE_OPENAI_* settings configured), callJudge()
 * falls back to a transparent heuristic so the whole /api/evaluate flow can
 * be built and tested end-to-end without an API key or any cost. Swap in
 * real Azure OpenAI credentials via app settings to get real AI scoring.
 */

const RUBRIC_SYSTEM = {
  en:
    "You are grading a student's reflection in a short classroom activity about " +
    "cognitive offloading (how technology helps or replaces thinking). Score strictly " +
    "from the text given — do not reward long answers that are vague. Respond with ONLY " +
    "a JSON object: {\"score\": 1|2|3, \"why\": \"one short sentence, max 20 words\", " +
    "\"insufficient\": true|false, \"reason\": \"\"}. " +
    "1 = accepted things at face value with little verification or independent effort. " +
    "2 = did some real checking/thinking but a solid partner reasoned better. " +
    "3 = named specific evidence, questioned assumptions, or showed clear independent reasoning before/alongside using the tool. " +
    "Set insufficient to true ONLY when the text is empty, nonsensical, off-topic, copy-pasted filler, or too vague/short " +
    "for you to honestly judge reasoning quality — in that case still give your best-guess score, but fill reason with a short " +
    "explanation (max 20 words) of why it can't be graded with confidence. Otherwise insufficient is false and reason is \"\".",
  es:
    "Estás calificando la reflexión de un estudiante en una actividad corta de clase sobre " +
    "la descarga cognitiva (cómo la tecnología ayuda o reemplaza el pensar). Califica estrictamente " +
    "según el texto dado — no premies respuestas largas pero vagas. Responde SOLO con un objeto " +
    "JSON: {\"score\": 1|2|3, \"why\": \"una frase corta, máximo 20 palabras\", " +
    "\"insufficient\": true|false, \"reason\": \"\"}. " +
    "1 = aceptó las cosas tal cual, con poca verificación o esfuerzo propio. " +
    "2 = hizo algo de verificación o pensamiento propio real, un compañero sólido razonaría mejor. " +
    "3 = nombró evidencia específica, cuestionó supuestos o mostró razonamiento propio claro antes o junto con usar la herramienta. " +
    "Marca insufficient como true SOLO cuando el texto esté vacío, no tenga sentido, no tenga relación con el tema, sea relleno " +
    "copiado y pegado, o sea demasiado vago/corto para juzgar honestamente la calidad del razonamiento — en ese caso igual da tu " +
    "mejor calificación estimada, pero llena reason con una explicación corta (máximo 20 palabras) de por qué no se puede calificar " +
    "con confianza. De lo contrario insufficient es false y reason es \"\".",
};

function buildCp1Prompt(cp1, lang) {
  const l = lang === "es" ? "es" : "en";
  const label =
    l === "es"
      ? "Respuesta de la IA (sin editar):"
      : "AI's answer (unedited):";
  const user = [
    label,
    cp1.pasted || "(empty)",
    "",
    l === "es" ? "¿Es correcta la información? →" : "Is the information correct? →",
    cp1.correct || "(empty)",
    "",
    l === "es" ? "¿Se debe confiar en ella? →" : "Should you trust it? →",
    cp1.trust || "(empty)",
    "",
    l === "es" ? "¿Hace falta revisar otra fuente? →" : "Is it necessary to check another source? →",
    cp1.source || "(empty)",
    "",
    l === "es" ? "Reflexión final:" : "Final reflection:",
    cp1.reflect || "(empty)",
  ].join("\n");
  return user;
}

function buildCp3Prompt(cp3, lang) {
  const l = lang === "es" ? "es" : "en";
  const user = [
    l === "es" ? "Primera solución, sin tecnología (Ronda 1):" : "First solution, no technology (Round 1):",
    cp3.first || "(empty)",
    "",
    l === "es" ? "Lo que sugirió la tecnología (Ronda 2):" : "What technology suggested (Round 2):",
    cp3.ai || "(empty)",
    "",
    l === "es" ? "Solución mejorada:" : "Improved solution:",
    cp3.improved || "(empty)",
    "",
    l === "es" ? "Comparación entre ambas:" : "Comparison of both:",
    cp3.compare || "(empty)",
    "",
    l === "es" ? "Reflexión final:" : "Final reflection:",
    cp3.reflect || "(empty)",
  ].join("\n");
  return user;
}

/**
 * Very small, transparent heuristic used only when no Azure OpenAI
 * credentials are configured (local dev / CI), so the API can be exercised
 * end-to-end for free. NOT meant to be an accurate grader.
 */
function mockJudge(userPrompt, lang) {
  const { isLowEffort } = require("./sufficiency");
  const words = userPrompt
    .split(/\s+/)
    .filter((w) => w && w !== "(empty)").length;
  const score = words > 80 ? 3 : words > 30 ? 2 : 1;
  const insufficient = words < 10 || isLowEffort(userPrompt);
  const l = lang === "es" ? "es" : "en";
  return {
    score,
    why: "(mock judge — set AZURE_OPENAI_* app settings for real AI scoring)",
    insufficient,
    reason: insufficient
      ? l === "es"
        ? "(mock) texto muy corto o de bajo esfuerzo para calificar con confianza."
        : "(mock) text too short or low-effort to grade with confidence."
      : "",
  };
}

/**
 * Calls Azure OpenAI chat completions if configured, otherwise returns a
 * mock score. Always resolves to
 * { score: 1|2|3, why: string, insufficient: boolean, reason: string }.
 */
async function callJudge(systemPrompt, userPrompt, lang) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    return mockJudge(userPrompt, lang);
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-06-01`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // gpt-5-mini is a reasoning model: it doesn't accept a custom
      // "temperature" (only the default), uses "max_completion_tokens"
      // instead of "max_tokens", and spends some of that budget on hidden
      // reasoning tokens before writing the visible JSON. reasoning_effort
      // is turned down since this is a short, well-scoped grading task —
      // keeps cost/latency down and leaves headroom for the actual answer.
      reasoning_effort: "low",
      max_completion_tokens: 900,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Azure OpenAI call failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") {
    // Reasoning ate the whole token budget and the model never wrote a
    // real answer — don't silently return a blank/default score for this.
    throw new Error("Azure OpenAI response was truncated before producing a scorable answer");
  }
  const raw = choice?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  if (!parsed || ![1, 2, 3].includes(parsed.score)) {
    throw new Error("Azure OpenAI response did not include a usable score");
  }
  return {
    score: parsed.score,
    why: String(parsed.why || "").slice(0, 160),
    insufficient: Boolean(parsed.insufficient),
    reason: String(parsed.reason || "").slice(0, 160),
  };
}

module.exports = { RUBRIC_SYSTEM, buildCp1Prompt, buildCp3Prompt, callJudge, mockJudge };
