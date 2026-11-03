// AI relevance, as a triage aid only: which AI terms a text mentions.
// Deterministic and explainable (the matched terms are stored and shown);
// it is not a probability and never decides anything on its own.

/** Clear AI terms (French and English). */
const STRONG = [
  "intelligence artificielle", "artificial intelligence", "ia generative", "generative ai",
  "apprentissage automatique", "machine learning", "apprentissage profond", "deep learning",
  "apprentissage par renforcement", "reinforcement learning",
  "reseau de neurones", "reseaux de neurones", "reseaux neuronaux", "neural network", "neural networks",
  "vision par ordinateur", "computer vision", "traitement automatique du langage", "traitement du langage naturel",
  "natural language processing", "modele de langage", "modeles de langage", "language model", "language models",
  "llm", "llms", "modele de fondation", "foundation model",
]

/** Often near AI work but not AI by themselves. */
const WEAK = [
  "algorithme", "algorithmes", "algorithm", "algorithms", "jumeau numerique", "digital twin",
  "robotique", "robotics", "robot", "robots", "predictif", "predictive", "prediction",
  "donnees massives", "big data", "analyse de donnees", "data analysis", "automatisation", "automation",
  "imagerie", "segmentation", "classification", "optimisation", "simulation",
]

/** Uppercase abbreviations, matched case-sensitively so "ia" inside words doesn't count. */
// ("transformer" and "ML" are left out: a French verb and millilitres.)
const ABBREVIATIONS = ["IA", "AI", "NLP", "LLM"]

export const RELEVANCE_THRESHOLD = 0.5

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function hasPhrase(folded: string, phrase: string) {
  return new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(folded)
}

export function scoreAiRelevance(text: string): { score: number; terms: string[] } {
  const folded = fold(text)
  const strong = STRONG.filter((t) => hasPhrase(folded, t))
  for (const a of ABBREVIATIONS) {
    if (new RegExp(`(^|[^A-Za-z0-9])${a}([^A-Za-z0-9]|$)`).test(text) && !strong.includes(a.toLowerCase())) strong.push(a)
  }
  const weak = WEAK.filter((t) => hasPhrase(folded, t))
  const score = Math.min(1, strong.length * 0.5 + weak.length * 0.15)
  return { score: Math.round(score * 100) / 100, terms: [...strong, ...weak] }
}
