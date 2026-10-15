/**
 * The 10 memory facts shown in Checkpoint 2, in both languages, each with a
 * short list of distinctive keyword phrases used to detect whether a
 * student's free-text recall actually mentions that fact.
 *
 * This is a lightweight heuristic (string matching), not an AI call — it's
 * fast, free, deterministic, and good enough for "did they recall the gist
 * of fact #N", which is all CP2 scoring needs. Swap in embedding similarity
 * later if closer paraphrase matching is ever needed.
 */

const FACTS = {
  en: [
    { text: "When people expect information to stay available online, they remember the information itself less well — but remember where to find it better.", keywords: ["available online", "where to find", "remember it less", "remember where"] },
    { text: "A smartphone lying face-down and switched off on the desk still reduces available mental capacity.", keywords: ["face-down", "face down", "switched off", "phone on the desk", "mental capacity"] },
    { text: "Working memory holds only about four pieces of information at once.", keywords: ["working memory", "four pieces", "four things", "four items"] },
    { text: "Pulling a fact out of memory strengthens it far more than reading it again.", keywords: ["pulling a fact", "retrieving", "recall strengthens", "strengthens it more", "re-reading"] },
    { text: "You remember ideas you produced yourself better than identical ideas you only read.", keywords: ["produced yourself", "your own idea", "ideas you created", "wrote yourself"] },
    { text: "People who photograph objects remember them worse than people who simply look at them.", keywords: ["photograph", "take a photo", "picture", "worse than people who"] },
    { text: "After switching tasks, part of your attention stays behind on the previous one.", keywords: ["switching tasks", "task switch", "attention residue", "stays behind", "previous task"] },
    { text: "Humans have always outsourced memory to other people. Devices are only a newer partner.", keywords: ["outsourced memory", "other people", "newer partner", "always delegated"] },
    { text: "Material reviewed across several days is retained far longer than the same time spent in one session.", keywords: ["several days", "spaced", "one session", "spread out", "retained longer"] },
    { text: "People who navigate by GPS engage spatial memory less than people who navigate from memory.", keywords: ["gps", "spatial memory", "navigate from memory"] },
  ],
  es: [
    { text: "Cuando uno espera que la información siga disponible en internet, recuerda peor la información misma — pero recuerda mejor dónde encontrarla.", keywords: ["disponible en internet", "dónde encontrarla", "recuerda peor la información"] },
    { text: "Un celular boca abajo y apagado sobre el escritorio igual reduce la capacidad mental disponible.", keywords: ["boca abajo", "apagado", "capacidad mental"] },
    { text: "La memoria de trabajo sostiene apenas unos cuatro elementos a la vez.", keywords: ["memoria de trabajo", "cuatro elementos", "cuatro cosas", "cuatro datos"] },
    { text: "Sacar un dato de la memoria lo fortalece mucho más que volverlo a leer.", keywords: ["sacar un dato", "fortalece", "volverlo a leer", "releer"] },
    { text: "Uno recuerda mejor las ideas que produjo que las mismas ideas que solo leyó.", keywords: ["produjo", "propias ideas", "solo leyó"] },
    { text: "Quien fotografía un objeto lo recuerda peor que quien simplemente lo observa.", keywords: ["fotografía", "foto", "recuerda peor"] },
    { text: "Al cambiar de tarea, una parte de la atención se queda en la tarea anterior.", keywords: ["cambiar de tarea", "atención se queda", "tarea anterior"] },
    { text: "Los seres humanos siempre le han delegado memoria a otras personas. Los dispositivos son apenas un socio más nuevo.", keywords: ["delegado memoria", "otras personas", "socio más nuevo"] },
    { text: "El material repasado a lo largo de varios días se retiene mucho más que el mismo tiempo en una sola sentada.", keywords: ["varios días", "una sola sentada", "repasado"] },
    { text: "Quien navega con GPS activa menos la memoria espacial que quien navega de memoria.", keywords: ["gps", "memoria espacial", "navega de memoria"] },
  ],
};

/**
 * Counts how many of the 10 facts are reasonably reflected in a student's
 * free-text recall, by checking whether any of each fact's keyword phrases
 * appear in the (lower-cased) recall text.
 * @param {string} recallText
 * @param {"en"|"es"} lang
 * @returns {number} matched fact count, 0-10
 */
function countMatchedFacts(recallText, lang) {
  const list = FACTS[lang] || FACTS.en;
  const haystack = String(recallText || "").toLowerCase();
  let matched = 0;
  for (const fact of list) {
    if (fact.keywords.some((kw) => haystack.includes(kw.toLowerCase()))) matched++;
  }
  return matched;
}

/**
 * Maps a matched-fact count (0-10) to the same 1-3 band the rest of the app
 * uses for per-skill scores.
 */
function factsToBand(matched) {
  if (matched >= 7) return 3;
  if (matched >= 4) return 2;
  return 1;
}

module.exports = { FACTS, countMatchedFacts, factsToBand };

